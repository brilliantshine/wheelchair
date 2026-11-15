# Map: the app's thread page and Threads list (titles, cards, presses, plan links)

Checked against: `7246e9004148f83038be4210583a521d4cbe997f` (origin/main)
Files covered: `viewer/app/threads.js`, `viewer/app/cards.js`, `viewer/app/chat.js`,
`viewer/app/views.js`, `viewer/app/routes.js`, `viewer/pages/thread.js`,
`viewer/pages/thread.html`, `viewer/pages/threads.js`, `viewer/pages/nav.js`

## Flow

1. **A thread is made.** The New thread form posts `{project, cli, machine, message?}`
   (`viewer/pages/threads.js:131-148`). `createThread` builds a record with no `title`
   (`viewer/app/threads.js:20-39`), starts the lead, and queues the first message to it as
   an ordinary message (`threads.js:53-54`). Only a stub thread is born with a title, from
   its stub card (`threads.js:72`). Nothing else ever writes `thread.title`: no card kind
   carries one and no route sets it.
2. **The plan slug is discovered, not declared.** Every `GET /threads/:id/chat` and
   `GET /features` runs `findSlug` (`viewer/app/chat.js:220`, `viewer/app/views.js:35`):
   the one directory under `docs/plans/` this worktree added or left untracked becomes
   `thread.slug`, and the plan is registered with the server (`views.js:75-82`). Zero or
   two such directories: no slug.
3. **The name shown** is `title || slug || basename(project)` on both pages
   (`viewer/pages/threads.js:38`, `viewer/pages/thread.js:109`, tab title `thread.js:570`).
   So a fresh thread is named after its project until the lead creates its plan directory,
   then after the slug.
4. **A lead posts a card.** `acceptCard` validates it and `addCard` stores it with
   `answered: false` (`viewer/app/cards.js:11-29`). `offer`, `idea` and `progress` are
   singletons: the new one replaces the old and is put in `thread.pinned` at once
   (`cards.js:9`, `22-26`).
5. **The page renders.** It polls `GET /chat` every 2 s (`thread.js:589-618`). Pinned kinds
   render at the top in offer, idea, progress order (`thread.js:557-565`); every other card
   is interleaved with the transcript by time (`thread.js:269-301`). One `renderCard`
   switch draws every kind (`thread.js:352-555`).
6. **Collin presses a button.** The page posts `{action, value}` to
   `/cards/:id/press` (`thread.js:310-322`). The hub sets `card.answered = true` (except an
   approval's "Talk about this") and queues `[card <id>] <suffix>` to the live lead
   (`viewer/app/threads.js:213-225`). **The pressed value is not stored on the card.** It
   survives only in the queued text, then in `thread.sent` once delivered
   (`viewer/app/sessions.js:227-228`), and in the transcript, where `cardBubble` turns it
   into a "Picked <label>" bubble that no longer carries the card id
   (`viewer/app/chat.js:23-30`, `143-146`).
7. **An answered card** gets the `is-answered` class, its buttons disabled, and a generic
   "✓ Answered" tag (`thread.js:355-356`, `335-345`, `550-552`). The options all still
   render the same; nothing marks which was picked.

```
New thread form -> POST /threads -> createThread (no title) -> lead started, first message queued
                                                                    |
lead writes docs/plans/<slug>/ -> next GET /chat or /features -> findSlug -> thread.slug
                                                                    |
name shown = title || slug || project basename   (threads.js:38, thread.js:109)

lead posts card -> acceptCard -> addCard (answered:false; offer/idea/progress pinned)
     -> GET /chat poll -> renderCard
     -> press -> POST /cards/:id/press -> answered = true, "[card id] picked: X" queued
                                            | value kept nowhere on the card
                                         "Answered" tag only
```

## The offer card

- Rendered at `thread.js:358-368`: a pin icon, "This looks like a feature", the summary, and
  one button, "Take it into planning", which presses `picked` with value
  `take it into planning`.
- "Kept talking pins it" has **no code of its own**. The offer is pinned the moment it is
  posted, because it is a singleton (`cards.js:9`, `25`), and it stays pressable at the top
  until pressed. The rule "never ask again" lives only in the lead's instructions
  (`protocol/app/lead.md:101-102`, `protocol/app/cards.md:65-67`).
- The press route only knows the suffixes `picked`, `removed`, `talk`, `start-building`,
  `start-thread` (`viewer/app/threads.js:215-222`). A "Keep talking first" button could use
  `picked` with a new value (no hub change, but the lead must be told what it means in
  `cards.md`/`lead.md`), or a new action (a new suffix here, a new press form in
  `cards.md`). Either way it should mark the offer answered so the button row disables.
  The design has the button beside "Take it into planning"
  (`docs/proposals/app-shell/design/Thread.dc.html:97`).

## The question card and IDEA.md

- Rendered at `thread.js:393-413`: eyebrow (`progress` or "Question"), the question, `fits`,
  one button per option (letter, label, "leaning" tag, consequence as inline Markdown),
  then "Why the lean". No field links to a document; the card schema has none
  (`protocol/app/cards.md`, `question`). The lead confirms IDEA.md through an ordinary
  question card (`protocol/app/lead.md:125-127`).
- Plan document links live only in the page chrome: `fileLinks` puts MAP.md, IDEA.md,
  PLAN.md in the right column and, on phones, under the header (`thread.js:141-180`). They
  appear only once a slug is known (`thread.js:143`).
- For the card to show or link IDEA.md it needs either a new optional card field (for
  example a document name, validated in `viewer/app/card.js` and documented in
  `cards.md`), or the page to recognise the confirm question by some marker. The page can
  build the link itself from `planDir()` (`thread.js:89-92`) the same way `fileLinks` does.

## Plan document links today

- A live thread links to the old viewer's page:
  `/wheelchair/docs?plan=<worktree>/docs/plans/<slug>&file=<F>.md` (`thread.js:148-149`).
  That page is `viewer/doc.html` + `viewer/doc.js`, outside the app (see
  `docs/maps/viewer-serving.md`). Its only way back is "← list", to `/wheelchair/`
  (`viewer/doc.js:12-14`, `37`), not to the thread, and it has no app nav.
- An archived thread instead fetches `GET /threads/:id/doc?file=` (git show from the
  branch, `viewer/app/threads.js:159-174`) and shows the raw text in a `<pre>` inside the
  `#docview` panel on the thread page (`thread.js:185-196`).
- The app nav is `viewer/pages/nav.js`, injected into `<header id="app-nav">` on each app
  page (`viewer/pages/thread.html:7`, `11`; links at `nav.js:39-41`).

## Tests that cover these spots

- `viewer/test/app-threads.spec.js` (Playwright, phone and desktop):
  list ordering and titles (`:50-72`, sets `title` by patch), every card kind and its press
  body including the question's `{action:'picked', value:'Light'}` and the "Answered" tag
  (`:216-300`), the offer press (`:305-328`), plan links use the API slug (`:410-419`),
  and plan links go through `/wheelchair/docs` (`:421-430`) — **this last test asserts the
  current behaviour and must change if links move into the app.**
- `viewer/test/app-hub.test.js`: a press queues `[card ...]` to the lead (`:477-492`),
  archived documents (`:525`), slug discovery on thread and chat routes (`:535`).
- `viewer/test/app-chat.test.js:78`: a card press becomes a short Collin bubble.
- `viewer/test/app-slug.test.js`: `findSlug` cases.

## What I did not look at

- `viewer/app/card.js`'s validation code beyond the `answered` check and kind lists, and
  how it would accept a new field.
- `viewer/pages/thread.css` beyond the font lines; how a new card element would be styled.
- `viewer/test/helpers/app-threads-world.js`, the fixture world the browser tests use.
- `viewer/app/sessions.js` delivery beyond the `sent` write.
- Whether any Codex-transcript path renders card presses differently from Claude's.
