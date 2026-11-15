# MAP: app paper cuts

Checked against `7246e90` (origin/main). Built from two new maps:
`docs/maps/app-thread-page.md` (titles, cards, presses, plan links) and
`docs/maps/viewer-serving.md` (routes, document page, fonts). File:line detail is there;
this is the short version per item.

```
POST /threads -> thread (no title) -> lead -> docs/plans/<slug>/ -> findSlug -> thread.slug
lead card -> addCard (offer/idea/progress pinned) -> GET /chat poll -> renderCard
press -> POST /cards/:id/press -> answered=true + "[card id] picked: X" to lead (X not kept)
plan links -> /wheelchair/docs (doc.html, outside the app, back link to /wheelchair/)
app.css asks for Inter / JetBrains Mono -> no font files, no font route, CSP forbids fonts
```

1. **Titles.** Nothing sets `thread.title` except a stub card (`viewer/app/threads.js:72`).
   Both pages show `title || slug || project basename` (`viewer/pages/threads.js:38`,
   `viewer/pages/thread.js:109`), so a thread is named after its project until the lead's
   plan directory is found (`viewer/app/views.js:75-82`). The first message is queued to
   the lead (`threads.js:54`) and never kept on the thread. Fix spots: `createThread` (title
   from the first message) and/or a way for the lead to name the thread (no card kind or
   route does today).
2. **IDEA.md on the confirm question.** The question card has no document field
   (`protocol/app/cards.md`, `question`; rendered `thread.js:393-413`). Plan links exist
   only in the page's file column (`thread.js:141-180`), from `planDir()` (`:89-92`). Needs
   a new optional card field (validated in `viewer/app/card.js`, documented in `cards.md`)
   or a page-side rule, plus a lead instruction (`protocol/app/lead.md:125-127`).
3. **Plan documents leave the app.** Links go to `/wheelchair/docs?plan=…&file=…`
   (`thread.js:148-149`), the old `doc.html`/`doc.js`, with no app nav and "← list" back to
   `/wheelchair/` (`viewer/doc.js:12-14`). An in-app page needs a name in `APP_PAGES`
   (`viewer/server.js:1830`) and a file in `viewer/pages/`; it can read the existing
   `/wheelchair/plan` and `/wheelchair/doc` routes. Archived threads use a separate path
   (`GET /api/threads/:id/doc`, shown as `<pre>` in `#docview`, `thread.js:185-196`).
   `pages/md.js` cannot render tables; `doc.js` can.
4. **Answered questions don't say what was picked.** `press` sets only `answered = true`
   (`viewer/app/threads.js:223`); the value goes into the lead's message and `thread.sent`,
   not onto the card. The page draws a generic "Answered" tag (`thread.js:335-345`). A
   question Collin answers by typing stays unanswered (open) — nothing links a typed
   message to a card, so "answered in chat" needs a new signal (for example the lead
   resolving it, the way `resolve` closes `needs` cards).
5. **"Keep talking first".** The offer renders one button (`thread.js:358-368`). "Pinned"
   is just the offer being a singleton (`viewer/app/cards.js:9`, `25`); there is no
   kept-talking logic in code, only the lead's rule (`protocol/app/lead.md:101-102`). A
   second button can press `picked` with a new value (no hub change) or a new action (a
   new suffix at `threads.js:215-221`); either way `cards.md` and `lead.md` must say what
   the lead does with it.
6. **Fonts.** `app.css:15-16` names the fonts with no `@font-face`; no font files exist in
   the repo or `node_modules`; `handleAsset` accepts only `.js`/`.css` under `pages/` or
   `vendor/` (`server.js:1833-1847`); and **`PAGE_CSP` has `default-src 'none'` with no
   `font-src` (`server.js:46`), so even a served font is blocked** until `font-src 'self'`
   is added.

**Tests to extend** (each fix gets one that fails first): `viewer/test/app-threads.spec.js`
(list titles `:50-72`, card kinds and presses `:216-328`, plan links `:410-430` — the
`:421` test pins the old `/wheelchair/docs` link and must change for item 3),
`viewer/test/app-hub.test.js` (press `:477`, slug `:535`), `viewer/test/app-chat.test.js:78`,
`viewer/test/app-pages.test.js:37` (asset names), `viewer/test/routes.test.js:149`, `:170`
(CSP, assets).

**Not looked at:** `card.js` validation internals, `thread.css` styling, the browser test
world helper, `doc.js`'s renderer body, any computed-font browser assertion.
