# Atlas of All Time

An interactive timeline from the Big Bang to today, with Claude built in.

- **Open the website:** https://sisyphus22.github.io/atlas-of-all-time/
- **Download for Windows:** https://github.com/Sisyphus22/atlas-of-all-time/releases/latest

© 2026 Valeria · All rights reserved · Made with Claude. See [LICENSE](LICENSE).

## About this project folder

- `atlas.html` – the page itself, shared by the claude.ai version and the Windows app
- `data.json` – every event and era (one per line)
- `img/` – pictures that ship with the Atlas; `media/` – videos that ship with it
- `desktop/` – the Windows app (Electron)
- Published page: https://claude.ai/artifact/QAAwVCDc23jZyfPnPHaVAM (private until you share it)

## Adding your own pictures and videos for everyone

1. Put the file in `img/` (pictures) or `media/` (MP4 or WebM videos).
2. In `data.json`, find the event and add `"img": "img/your-file.jpg"` or `"video": "media/your-file.mp4"`
   to its last `{ ... }` part, for example:
   `[1144, "art", "Gothic architecture is born", "...", {"img": "img/gothic-section.jpg"}]`
3. Rebuild the app (below).

Pictures added with the "Add a picture or video" button stay on that computer (or in that claude.ai page) only.

## Event format

`[year, category, title, text, {extras}]` – year is negative for BCE (`-2560`), and deep time is written like `-66e6`.
Extras: `d` exact date `"1888-09-30"`, `q` newspaper search words, `r` regions for archive order
(`uk au nz us de at fr nl es br sg jp in world`), `img`, `video`, `f` era-guide tag,
`w` the Wikipedia article whose pictures appear under **Tell me more** (`""` for none).

## Pictures in Tell me more

When someone clicks **Tell me more**, up to four pictures from that event's Wikipedia article appear
as the text starts, with each picture's author and licence linked to its Wikimedia Commons page.
They load from Wikipedia, so they work in the desktop app and on the website when online, but not
on the claude.ai page, which can't load pictures from other sites.

## Building the Windows app

Needs Node.js. In `desktop/`:

- `npm install` – first time only
- `npm start` – run the app
- `npm run dist` – make the installer in `desktop/dist/` ("Atlas of All Time Setup x.y.z.exe")

The installer isn't code-signed yet, so Windows SmartScreen will warn ("More info" → "Run anyway").
To share it publicly without that warning, it needs a code-signing certificate.

Ask Claude in the app uses each person's own Anthropic API key (Claude settings, top right).
The key is encrypted with their Windows account and only sent to Anthropic.
