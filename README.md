<p align="center"><img src="store/logo-1024.png" width="128" alt="Rewind for X logo"></p>

<h1 align="center">Rewind for X</h1>

<p align="center">A Chrome extension that brings back the posts you were reading when the X (Twitter) feed refreshes under you.</p>

When X refreshes your timeline on its own, or you click **Home** while already on the Home feed, the post you were reading vanishes. Rewind for X notices and adds a small banner above the new feed:

> **Wait, I didn't finish reading those posts. Bring them back!**

Click it and the previous feed's first five posts (ads skipped) reappear inline, above your current feed, looking like regular posts with their images. Once they're back, the banner goes away. ✕ or Escape dismisses the banner without restoring anything.

Not affiliated with or endorsed by X Corp.

## How it works

- Tracks the post nearest the middle of the screen. If it disappears or jumps without you scrolling, that counts as a refresh.
- Keeps references to the first five non-ad posts in the feed; when a refresh is detected, copies them so they survive X removing the originals.
- Recovered posts are static copies of X's own markup, so they keep X's styling and theme. Videos show their poster frame. The reply / repost / like / views bar is shown but opens the real post in a new tab, since a copy can't act on X.
- Refreshes you start yourself stay quiet: switching timeline tabs, or clicking **Show N posts** / **See new posts**. Clicking Home from another page counts as navigation.
- Banner colors follow X's Default, Dim, and Lights out themes.

Everything runs locally in the page. No permissions beyond running on x.com / twitter.com, no storage, no network requests. See [privacy-policy.md](privacy-policy.md).

Detection is heuristic and depends on X's markup: a big layout jump can trigger it, and a refresh during active scrolling can be missed.

## Install

**Chrome Web Store:** coming soon.

**From source:**

1. Download or clone this repository.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the folder.
3. Open x.com, scroll the Home feed a bit, stop, and click **Home**. The banner should appear.

## Privacy

Rewind for X collects nothing, stores nothing, and sends nothing anywhere. Read the full [privacy policy](privacy-policy.md).

## Contributing

Issues and pull requests are welcome. The extension is plain JavaScript with no build step: edit `content-script.js`, then click the reload button on the extension's card in `chrome://extensions` and refresh x.com.

## Release (maintainers)

```bash
./build.sh
```

Creates `dist/rewind-for-x-<version>.zip` (only the files the extension needs) for upload to the Chrome Web Store. Store listing copy and images are in [store/](store/).

## License

[MIT](LICENSE)
