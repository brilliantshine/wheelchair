# Map: what the viewer server serves (pages, assets, document page, fonts)

Checked against: `7246e9004148f83038be4210583a521d4cbe997f` (origin/main)
Files covered: `viewer/server.js`, `viewer/doc.html`, `viewer/doc.js`,
`viewer/pages/app.css`, `viewer/pages/thread.html`, `viewer/pages/md.js`,
`viewer/package.json`

## Flow

1. A request reaches the one HTTP handler. `/wheelchair/api/*` goes to the app hub with
   cookie auth (`viewer/server.js:2192-2206`). Then, by exact path
   (`server.js:2208-2214`):
   - `/wheelchair/assets/*` → `handleAsset`, no auth
   - `/wheelchair/app/<page>` → `handleAppPage`
   - `/wheelchair/docs` → `handleDocs` (the document page HTML)
   - `/wheelchair/doc` → `handleDoc` (raw Markdown), `/wheelchair/plan` → file list
2. **Assets.** `handleAsset` serves `list.js` and `doc.js` by name, else only names matching
   `^(pages|vendor)/…\.(js|css)$` (`server.js:1833-1847`). The content type is CSS or JS,
   nothing else. **There is no font route and no font extension the pattern accepts.**
3. **App pages.** `handleAppPage` serves `viewer/pages/<name>.html` for the five names in
   `APP_PAGES` (`server.js:1830`, `1849-1864`), behind the remember cookie, with
   `APP_PAGE_CSP` = `PAGE_CSP` plus `frame-src 'self'` (`server.js:1832`).
4. **The document page.** `handleDocs` checks the cookie and that `plan` is a registered
   plan directory, then serves `viewer/doc.html` with `PAGE_CSP` (`server.js:1879-1891`).
   `doc.js` reads `plan` and `file` from the URL, fetches `/wheelchair/plan?dir=` and
   `/wheelchair/doc?plan=&file=`, and renders the Markdown itself (`viewer/doc.js:6-26`,
   `460`, `479`). `handleDoc` reads the file from the registered plan path
   (`server.js:1815-1820`). The page has its own inline styles, no app nav, and a single
   "← list" link back to `/wheelchair/` (`viewer/doc.html:73-86`, `doc.js:12-14`).
5. **Fonts.** `app.css` asks for `--sans: Inter, system-ui, …` and
   `--mono: 'JetBrains Mono', ui-monospace, …` (`viewer/pages/app.css:15-16`, used on
   `body` at `:21`). There is no `@font-face` anywhere in `viewer/`. So each name is used
   only if the font is installed on the viewing device; otherwise the fallback.

```
browser -> server.js handler
             |- /api/*        -> app hub (cookie)
             |- /assets/*     -> handleAsset: list.js, doc.js, pages|vendor *.js|*.css  (no fonts)
             |- /app/<page>   -> pages/<page>.html, APP_PAGE_CSP
             |- /docs         -> doc.html (own styles, "← list" to /wheelchair/), PAGE_CSP
             |- /doc, /plan   -> Markdown text, file list of a registered plan
```

## What matters for fonts

- No font file exists in the repository or in `viewer/node_modules` (the only dependency
  is `@playwright/test`, `viewer/package.json:10`; checked with `find` for
  woff/woff2/ttf/otf). Serving the fonts means vendoring the files (for example under
  `viewer/vendor/`) and adding them to `handleAsset`.
- **The CSP blocks fonts today regardless of a route.** `PAGE_CSP` starts with
  `default-src 'none'` and has no `font-src` (`server.js:46`), so `font-src` falls back to
  `'none'`. A font served from `/wheelchair/assets/` also needs `font-src 'self'` added to
  the page CSP (and `APP_PAGE_CSP` inherits it). Loading from Google Fonts would also need
  `style-src` and `font-src` to allow that origin; that would make the app depend on the
  network for its look.
- `handleAsset`'s content type is a two-way CSS/JS choice (`server.js:1846`); fonts need
  `font/woff2` (or similar).
- The terminal page's xterm.js is created with `fontSize: 13` and no `fontFamily`
  (`viewer/pages/terminal.js:73-80`), so it uses xterm's default, not `--mono`.

## What matters for an in-app document page

- A new app page needs its name added to `APP_PAGES` (`server.js:1830`) and an HTML file in
  `viewer/pages/`; its script and CSS are then served by the existing asset pattern.
- It can reuse `/wheelchair/plan` and `/wheelchair/doc` as `doc.js` does; both need the
  plan to be registered, which `findSlug` already does for a thread's plan
  (`viewer/app/views.js:81`). For an archived thread the source is
  `GET /api/threads/:id/doc` instead (see `docs/maps/app-thread-page.md`).
- `viewer/pages/md.js` is the app's own Markdown renderer for chat (paragraphs, headings as
  bold lines, emphasis, code, links, lists; `md.js:3-6`). It does not do tables, which plan
  documents use; `doc.js` has the fuller renderer.

## Tests that cover these spots

- `viewer/test/app-pages.test.js`: app page sign-in, unknown page refused (`:30`), asset
  names outside `pages/` and `vendor/` refused (`:37`) — the place for a font asset test.
- `viewer/test/routes.test.js`: `/plan` and `/doc` (`:121`, `:134`), CSP on `/docs` (`:149`),
  `/assets/list.js` and other asset names (`:170`).
- `viewer/test/app-ui.spec.js`, `app-views.spec.js`: browser checks of the app pages; I did
  not read them for font assertions.

## What I did not look at

- The body of `doc.js`'s renderer (lines ~40-506) beyond its URLs.
- `viewer/index.html` and `list.html` font use beyond a grep.
- Whether any browser test inspects computed fonts.
- `sendFile` and caching headers beyond `no-store` in the route comment.
