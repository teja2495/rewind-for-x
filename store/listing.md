# Chrome Web Store listing

## Store listing tab

**Name:** Rewind for X

**Summary (max 132 chars):**
Ever lose the post you were reading when X refreshes your feed? Click once to bring it back.

**Category:** Social & Communication

**Language:** English

**Description:**

Ever get frustrated when X refreshes your feed and the post you were reading just disappears?

I built Rewind for X to fix that.

When your feed refreshes, a small banner shows up at the top of your timeline:
"Wait, I didn't finish reading those posts. Bring them back!"

Click it, and the posts you were reading come right back, inline in your timeline, looking just like regular posts with their images and counts. Done reading? Click "All caught up? Hide them" and they're gone.

What it does
• Brings back up to 5 posts from before the refresh
• Works when X refreshes on its own, or when you tap Home while you're already on the Home feed
• Skips ads
• Matches X's Default, Dim, and Lights out themes
• Stays quiet when you refresh on purpose, like switching tabs or tapping "Show new posts"

Private by design
Everything happens inside the page. No account, no settings, no data collected, nothing sent anywhere.

Rewind for X is an independent project and is not affiliated with or endorsed by X Corp.

**Graphic assets:**
- Store icon: `icons/icon128.png`
- Screenshots (1280×800 or 640×400, at least 1): take on x.com — banner collapsed, then posts expanded. Not included yet.
- Small promo tile (440×280): `store/promo-small-440x280.png`
- Marquee promo tile (1400×560, optional): `store/promo-marquee-1400x560.png`

## Privacy practices tab

**Single purpose:**
Restores the posts a user was reading on X (Twitter) after the timeline refreshes, by showing them inline above the refreshed feed.

**Host permission justification (content script on x.com / twitter.com):**
The extension must run on X pages to detect when the timeline refreshes and to show the previously visible posts inline. It runs on no other sites.

**Remote code:** No, I am not using remote code.

**Data usage:** Collects none of the listed data types. Certify all three disclosures (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://github.com/teja2495/rewind-for-x/blob/main/privacy-policy.md
