# Map: what the viewer server serves (pages, assets, document page, fonts)

Checked against: `5742e2f990d2f99c82aa82b01403ee772a6bf502` (origin/main)
Files covered: `viewer/server.js`, `viewer/doc.html`, `viewer/doc.js`,
`viewer/pages/app.css`, `viewer/pages/thread.html`, `viewer/pages/md.js`,
`viewer/pages/doc.html`, `viewer/pages/doc.js`, `viewer/pages/nav.js`, `viewer/package.json`

## Flow

1. A request reaches the one HTTP handler. `/wheelchair/api/*` goes to the app hub: the hub
   is built lazily on the first API request, then a non-machine route needs the remember
   cookie (read) or the write auth, and `hub.handle` answers (`viewer/server.js:2210-2224`).
   Then, by path (`server.js:2226-2232`):
   - `/wheelchair/assets/*` → `handleAsset`, no auth
   - `/wheelchair/app/<page>` → `handleAppPage`
   - `/wheelchair/docs` → `handleDocs` (the old document page), `/wheelchair/doc` (raw
     Markdown), `/wheelchair/plan` (file list)
2. **Assets.** `handleAsset` serves `list.js` and `doc.js` by name, four allowlisted fonts
   under `fonts/` from `node_modules/@fontsource` (`server.js:1835-1840`, `1850-1859`),
   else only names matching `^(pages|vendor)/…\.(js|css)$` (`server.js:1841`, `1860-1864`).
3. **App pages.** `handleAppPage` serves `viewer/pages/<name>.html` for the six names in
   `APP_PAGES` — threads, thread, doc, features, sessions, terminal (`server.js:1830`,
   `1867-1885`) — behind the remember cookie (a `token` query is swapped for the cookie by a
   redirect), with `APP_PAGE_CSP` = `PAGE_CSP` plus `frame-src 'self'` (`server.js:1832`).
   `PAGE_CSP` now includes `font-src 'self'` (`server.js:47`).
4. **The in-app document page** (`/wheelchair/app/doc?thread=&file=`) loads `nav.js`,
   `markdown.js`, `doc.js` (`viewer/pages/doc.html:7-9`). It reads the thread's chat to find
   the plan, then the file from `/api/threads/:id/doc` for an archived thread or
   `/wheelchair/doc?plan=&file=` for a live one (`viewer/pages/doc.js:49-63`).
5. **The old document page** `/wheelchair/docs` still exists: it checks the cookie and the
   registered plan and serves `viewer/doc.html` (`server.js:1897-1909`).
6. **The app nav** is built by `viewer/pages/nav.js` into `<header id="app-nav">`; its view
   links are a fixed list of three: Features, Threads, Sessions (`nav.js:38-42`).

```
browser -> server.js handler
             |- /api/*        -> app hub (cookie or write auth; /api/machine/* by machine secret)
             |- /assets/*     -> list.js, doc.js, 4 fonts, pages|vendor *.js|*.css
             |- /app/<page>   -> pages/<page>.html (6 names), APP_PAGE_CSP
             |- /docs         -> old doc.html
             |- /doc, /plan   -> Markdown text, file list of a registered plan
```

## Adding an app page

- A new page is a name in `APP_PAGES` (`server.js:1830`), an HTML file in `viewer/pages/`,
  and its script/CSS under `viewer/pages/` (served by the existing asset pattern with no
  further change). A nav entry is one more row in `nav.js:38-42`.
- Its data comes from `/wheelchair/api/*`, routed by `viewer/app/routes.js` (see
  `docs/maps/app-sessions.md`).

## Tests that cover these spots

- `viewer/test/app-pages.test.js`: app page sign-in, unknown page refused, asset names
  outside `pages/` and `vendor/` refused.
- `viewer/test/routes.test.js`: `/plan`, `/doc`, CSP on `/docs`, asset names.

## What I did not look at

- The body of `viewer/doc.js` and `viewer/pages/doc.js` beyond their URLs.
- `viewer/pages/md.js` and `markdown.js` beyond which page loads which.
- The font tests added since the last check, and any browser test that inspects fonts.
- `sendFile` and caching headers beyond `no-store` in the route comment.
