# Theme options map

Checked against `9517d3bc06afb8ca3f94c22ee760e8bf5ec48faf` (origin/main). See [viewer appearance and settings](../../maps/viewer-appearance.md) for the flow and source pointers.

```text
page loads shared palette -> background metadata fetch -> image displayed
Settings You -> preview on this page -> revision-checked save -> other pages poll
```

The app's blue is a family of seven independent accent tokens, alongside dark surfaces, status colors and fonts; some blue-tinted colors are literals, and graph and standalone document pages define their own palette (`viewer/pages/app.css:12-29`; `viewer/pages/assistant-popup.css:40`; `viewer/index.html:7-10,219`; `viewer/doc.html:9-12`). A single accent replacement would therefore leave related colors and separate contexts unchanged. The terminal, graph SVG and canvas exports have additional color paths (`viewer/pages/term-view.js:73-86,165-171`; `viewer/index.html:111-120`; `viewer/pages/picture-export.js:150-156`).

The existing You section only customizes a background image. It previews locally, saves validated revisioned metadata in shared settings, and other visible pages poll; the deferred fetch does not provide pre-paint color initialization (`viewer/pages/settings.js:12,2282-2329,2339-2375`; `viewer/app/background.js:63-97`; `viewer/pages/background.js:68-105`). Settings normalization and serialized writes are important for preserving new fields (`viewer/app/settings.js:318-320,420-434`; `viewer/app/state.js:238-255`). Public stylesheets and authenticated settings requests cross different serving boundaries (`viewer/server.js:7,1302-1319,1767-1780,2130`).

The existing Settings, thread visual design and app-page maps were compared to origin/main; their covered files changed, so their historical claims were not relied on. The relevant current paths were rechecked in the appearance map above.

## What I did not look at

Every individual CSS rule, vendor terminal internals, every test assertion, rendered contrast and timing, and detailed unrelated paths in the older maps. No application tests were run for this documentation-only map.
