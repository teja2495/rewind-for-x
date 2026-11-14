(function () {
    if (window.__rewindForXLoaded) return;
    window.__rewindForXLoaded = true;

    const TWEET_SELECTOR = 'article[data-testid="tweet"]';
    const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
    let anchor = null;
    let recovery = null;
    let host = null;
    let expanded = false;
    let bannerPostId = null;
    let feedSnapshot = [];
    let timer = null;
    let route = location.pathname + location.search;
    let tab = '';
    let ignoreUntil = 0;
    let touching = false;
    let scrollbarDragging = false;
    let manualRefresh = null;

    function validPost(post) {
        if (!post || typeof post.url !== 'string' || typeof post.id !== 'string') return false;
        try {
            const url = new URL(post.url);
            return ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname) &&
                url.protocol === 'https:' && /^\/[^/]+\/status\/\d+$/.test(url.pathname) &&
                url.pathname.endsWith('/' + post.id);
        } catch (_) { return false; }
    }

    function getPosts() {
        const column = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main');
        if (!column) return [];
        return Array.from(column.querySelectorAll(TWEET_SELECTOR)).flatMap((article) => {
            // The timestamp links to the outer post, unlike quoted-post and media links.
            const time = article.querySelector('a[href*="/status/"] time');
            // Promoted posts can omit the timestamp but still expose a post analytics link.
            const link = time?.closest('a') || article.querySelector('a[href*="/status/"][href$="/analytics"]');
            if (!link) return [];
            const url = new URL(link.href, location.origin);
            url.pathname = url.pathname.replace(/\/analytics$/, '');
            const match = url.pathname.match(/^\/[^/]+\/status\/(\d+)$/);
            if (!match || !validPost({ id: match[1], url: url.origin + url.pathname })) return [];
            return [{ id: match[1], url: url.origin + url.pathname, article, rect: article.getBoundingClientRect() }];
        });
    }

    function readingPost(posts) {
        const visible = posts.filter((post) => post.rect.bottom > 80 && post.rect.top < innerHeight && post.rect.width > 0);
        const line = innerHeight * 0.5;
        return visible
            .sort((a, b) => distance(a.rect) - distance(b.rect))[0] || null;

        function distance(rect) {
            return rect.top <= line && rect.bottom >= line ? 0 : Math.min(Math.abs(rect.top - line), Math.abs(rect.bottom - line));
        }
    }

    const SNAPSHOT_SIZE = 5;

    // Ads are wrapped in placementTracking and carry an "Ad"/"Promoted" label outside the post text.
    function isAd(article) {
        if (article.closest('[data-testid="placementTracking"]')) return true;
        return Array.from(article.querySelectorAll('span')).some((span) => !span.firstElementChild &&
            /^(?:Ad|Promoted)$/.test(span.textContent.trim()) && !span.closest('[data-testid="tweetText"]'));
    }

    function snapshotPosts(posts) {
        // Keep live article references; they are cloned only once a refresh is detected.
        return posts.filter((post) => !isAd(post.article)).slice(0, SNAPSHOT_SIZE)
            .map((post) => ({ id: post.id, url: post.url, article: post.article }));
    }

    function updateSnapshot(posts, replace = false) {
        const next = snapshotPosts(posts);
        // Keep the original feed's first posts when X virtualizes them away.
        if (replace || !feedSnapshot.length) feedSnapshot = next;
        else if (feedSnapshot.every((post, index) => post.id === next[index]?.id)) feedSnapshot = next;
    }

    function remember(post) {
        anchor = post ? { id: post.id, url: post.url, top: post.rect.top } : null;
    }

    function dismiss() {
        host?.remove();
        host = null;
        recovery = null;
        bannerPostId = null;
        expanded = false;
    }

    // X themes (Default / Dim / Lights out) are set by body background, not prefers-color-scheme.
    function xTheme() {
        const [r, g, b] = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [0, 0, 0]).map(Number);
        if (r + g + b > 600) return 'light';
        return r + g + b > 40 ? 'dim' : 'dark';
    }

    const BORDERS = { dark: 'rgb(47, 51, 54)', dim: 'rgb(56, 68, 77)', light: 'rgb(239, 243, 244)' };

    // A static copy of X's own markup, so it keeps X's styling and media but none of its behavior.
    function clonePost(post) {
        const node = post.article.cloneNode(true);
        // Renamed so neither this script nor X's keyboard navigation treats the copy as a live post.
        node.setAttribute('data-testid', 'rewindForXPreviousTweet');
        node.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
        // The "more" menu and Grok would be dead buttons; the action bar stays and opens the post instead.
        node.querySelectorAll('[data-testid="caret"], button[aria-label*="Grok" i]')
            .forEach((element) => element.remove());
        // Video sources are blob URLs tied to X's player; show the poster frame instead.
        node.querySelectorAll('video').forEach((video) => {
            if (!video.poster) return video.remove();
            const image = document.createElement('img');
            image.src = video.poster;
            image.alt = '';
            image.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
            video.replaceWith(image);
        });
        node.style.cursor = 'pointer';
        return node;
    }

    function renderPosts() {
        const list = host?.querySelector('.rewind-for-x-posts');
        if (!list) return;
        list.replaceChildren();
        if (!expanded) return;
        const border = BORDERS[host.dataset.theme] || BORDERS.dark;
        for (const post of recovery) {
            const cell = document.createElement('div');
            cell.style.borderBottom = '1px solid ' + border;
            cell.dataset.url = post.url;
            cell.appendChild(post.node);
            list.appendChild(cell);
        }
    }

    function toggleExpanded() {
        if (!recovery?.length) return;
        expanded = !expanded;
        // The inserted posts push the feed down; that is not another refresh.
        anchor = null;
        ignoreUntil = performance.now() + 1000;
        const button = host.querySelector('.rewind-for-x-banner').shadowRoot.querySelector('.open');
        button.setAttribute('aria-expanded', String(expanded));
        button.querySelector('span').textContent = expanded ? 'All caught up? Hide them' : COLLAPSED_LABEL;
        renderPosts();
        schedule();
    }

    function onPostsClick(event) {
        // Keep clicks away from X's delegated React handlers on the surrounding cell.
        event.stopPropagation();
        if (event.defaultPrevented || event.button !== 0) return;
        if (String(getSelection()).trim()) return;
        event.preventDefault();
        const postUrl = event.target.closest('[data-url]')?.dataset.url;
        // Reply/repost/like/views can't act on a copy, so they open the real post to act there.
        const link = !event.target.closest('[role="group"]') && event.target.closest('a[href]');
        const url = link ? link.href : postUrl;
        // A new tab keeps this feed (and the recovered posts) in place.
        if (url) window.open(url, '_blank', 'noopener');
    }

    function mountBanner(posts) {
        if (!host) return;
        const first = posts.find((post) => post.id === bannerPostId);
        if (!first || first.article.previousElementSibling === host) return;
        // Insert into the first post's normal flow so X can measure the taller cell.
        first.article.before(host);
        ignoreUntil = performance.now() + 250;
    }

    const COLLAPSED_LABEL = 'Wait, I didn’t finish reading those posts. Bring them back!';

    function showBanner(previousPosts, posts) {
        if (!previousPosts.length || !posts.length) return;
        dismiss();
        recovery = previousPosts.map((post) => ({ id: post.id, url: post.url, node: clonePost(post) }));
        bannerPostId = posts[0].id;
        // Light-DOM wrapper: the copied posts need X's page stylesheet, which shadow DOM would block.
        host = document.createElement('div');
        host.id = 'rewind-for-x';
        host.dataset.theme = xTheme();
        const banner = document.createElement('div');
        banner.className = 'rewind-for-x-banner ' + host.dataset.theme;
        const list = document.createElement('div');
        list.className = 'rewind-for-x-posts';
        list.addEventListener('click', onPostsClick);
        list.addEventListener('auxclick', (event) => event.stopPropagation());
        host.append(banner, list);
        const shadow = banner.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                /* Mirrors X's "Show N posts" row, with a mint accent so it reads as Rewind for X's. */
                :host { all: initial; display: block; box-sizing: border-box; width: 100%;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    --accent: #5fd4b4; --border: rgb(47, 51, 54); --muted: rgb(113, 118, 123);
                    --hover: #5fd4b40d; --close-hover: #ffffff14; --strong: #e7e9ea; }
                :host(.dim) { --border: rgb(56, 68, 77); --muted: rgb(139, 152, 165); --strong: #f7f9f9; }
                :host(.light) { --accent: #0b8a6c; --border: rgb(239, 243, 244); --muted: rgb(83, 100, 113);
                    --hover: #0b8a6c0d; --close-hover: #0f14190d; --strong: #0f1419; }
                .banner { position: relative; display: flex; align-items: center; min-height: 52px;
                    border-bottom: 1px solid var(--border); color: var(--accent); animation: appear .2s ease-out; }
                button { font: inherit; color: inherit; border: 0; cursor: pointer; background: transparent; }
                .open { flex: 1; align-self: stretch; display: flex; align-items: center; justify-content: center; gap: 8px;
                    padding: 14px 52px; text-align: center; font-size: 15px; font-weight: 400; line-height: 20px; transition: background .15s; }
                .open:hover { background: var(--hover); }
                .icon { flex-shrink: 0; }
                .close { position: absolute; right: 8px; display: inline-flex; align-items: center; justify-content: center;
                    padding: 0; border-radius: 50%; width: 34px; height: 34px; color: var(--muted); }
                .close:hover { background: var(--close-hover); color: var(--strong); }
                button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
                @keyframes appear { from { opacity: 0; } to { opacity: 1; } }
                @media (prefers-reduced-motion: reduce) { .banner { animation: none; } }
            </style>
            <div class="banner" role="status" aria-live="polite">
                <button class="open" type="button" aria-expanded="false">
                    <svg class="icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/></svg>
                    <span></span>
                </button>
                <button class="close" type="button" aria-label="Dismiss previous posts banner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
            </div>`;
        shadow.querySelector('span').textContent = COLLAPSED_LABEL;
        shadow.querySelector('.close').addEventListener('click', dismiss);
        shadow.querySelector('.open').addEventListener('click', toggleExpanded);
        mountBanner(posts);
    }

    function check() {
        timer = null;
        const nextRoute = location.pathname + location.search;
        // A refresh can briefly remove the tab bar; that is not a tab switch.
        const nextTab = document.querySelector('[data-testid="primaryColumn"] [role="tab"][aria-selected="true"]')?.textContent.trim() || (nextRoute === route ? tab : '');
        if (nextRoute !== route || nextTab !== tab) {
            // Switching timeline tabs is intentional, not a lost reading position.
            if (nextRoute !== route || tab) {
                if (!manualRefresh) suppressManualRefresh();
                else dismiss();
            }
            anchor = null;
            feedSnapshot = [];
            route = nextRoute;
            tab = nextTab;
        }
        if (document.hidden) {
            anchor = null;
            return;
        }
        if (/\/status\/\d+|^\/(?:compose|messages|settings|notifications)(?:\/|$)/.test(location.pathname)) {
            anchor = null;
            dismiss();
            return;
        }
        const posts = getPosts();
        mountBanner(posts);
        const current = readingPost(posts);
        // Wait through empty intermediate renders rather than forgetting the old post.
        if (!current) return;
        if (manualRefresh) {
            const now = performance.now();
            if (now >= manualRefresh.expires || (manualRefresh.changed && now >= manualRefresh.quietUntil)) {
                manualRefresh = null;
            } else {
                const head = posts.slice(0, 3).map((post) => post.id).join(',');
                if (head !== manualRefresh.head) {
                    manualRefresh.head = head;
                    manualRefresh.changed = true;
                    manualRefresh.quietUntil = now + 1500;
                }
                updateSnapshot(posts, true);
                remember(current);
                return;
            }
        }
        const tracked = anchor;
        const scrolling = touching || scrollbarDragging || performance.now() <= ignoreUntil;
        let lost = false;
        if (tracked && !scrolling && !expanded) {
            const previous = posts.find((post) => post.id === tracked.id);
            const displaced = previous && current.id !== tracked.id &&
                (previous.rect.bottom <= 80 || previous.rect.top >= innerHeight ||
                    Math.abs(previous.rect.top - tracked.top) > Math.max(120, innerHeight * 0.2));
            lost = !previous || displaced;
            if (lost) {
                showBanner(feedSnapshot, posts);
            }
        }
        updateSnapshot(posts, lost);
        // DOM updates must not overwrite the pre-refresh position in small steps.
        if (!anchor || scrolling || lost) remember(current);
    }

    function schedule() {
        // One scan per burst, even when the feed continuously mutates.
        if (timer === null) timer = setTimeout(check, 100);
    }

    function onScrollIntent() {
        ignoreUntil = performance.now() + 1000;
        schedule();
    }

    function suppressManualRefresh() {
        dismiss();
        manualRefresh = {
            head: getPosts().slice(0, 3).map((post) => post.id).join(','),
            changed: false, quietUntil: 0, expires: performance.now() + 15000,
        };
        anchor = null;
        feedSnapshot = [];
        schedule();
    }

    window.addEventListener('wheel', onScrollIntent, { passive: true });
    window.addEventListener('touchstart', () => { touching = true; onScrollIntent(); }, { passive: true });
    window.addEventListener('touchend', () => { touching = false; onScrollIntent(); }, { passive: true });
    window.addEventListener('touchcancel', () => { touching = false; onScrollIntent(); }, { passive: true });
    window.addEventListener('pointerdown', (event) => {
        scrollbarDragging = event.clientX >= document.documentElement.clientWidth;
        // Only scrollbar dragging and middle-click autoscroll imply scrolling.
        if (scrollbarDragging || event.button === 1) onScrollIntent();
    }, { passive: true });
    window.addEventListener('pointerup', () => { scrollbarDragging = false; }, { passive: true });
    document.addEventListener('click', (event) => {
        const control = event.target instanceof Element ? event.target.closest('a, [role="tab"], button, [role="button"]') : null;
        if (!control) return;
        const inTimeline = !!control.closest('[data-testid="primaryColumn"]');
        const timelineRefresh = inTimeline && (control.matches('[role="tab"]') ||
            /^(?:see|show)\s+(?:[\d,]+\s+(?:new\s+)?|new\s+)(?:posts?|tweets?)$/i.test((control.innerText || control.textContent).trim()));
        // Home-button refreshes are deliberately not suppressed: they also show the banner.
        if (timelineRefresh) suppressManualRefresh();
    }, true);
    window.addEventListener('keydown', (event) => {
        if (SCROLL_KEYS.has(event.key)) onScrollIntent();
        if (event.key === 'Escape') {
            dismiss();
        }
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => { anchor = null; schedule(); }, { passive: true });
    document.addEventListener('visibilitychange', () => { anchor = null; schedule(); });
    new MutationObserver((mutations) => {
        // X repositions virtualized posts via inline transforms without adding nodes.
        if (mutations.some((mutation) => mutation.type !== 'attributes' || mutation.attributeName === 'aria-selected' ||
            mutation.target.matches('[data-testid="cellInnerDiv"]'))) schedule();
    }).observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'style'],
    });
    // Also catches History API navigation without patching X's page scripts.
    setInterval(() => {
        if (location.pathname + location.search !== route) schedule();
    }, 1000);
    schedule();
})();
