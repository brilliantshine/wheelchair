---
slug: app-paper-cuts
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-14
---

# The app's screen paper cuts

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md`, with detail in `docs/maps/app-thread-page.md` and
`docs/maps/viewer-serving.md`.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q1: Where does a thread's title come from?
- **Context:** Nothing sets `thread.title` except a stub card (`viewer/app/threads.js:72`);
  the pages fall back to slug, then project name (`viewer/pages/threads.js:38`,
  `viewer/pages/thread.js:109`). The first message is never stored on the thread.
- **Options:** (a) the first message's opening words, set when the thread is made;
  (b) the lead names it with a new card; (c) both: the first message's words at once, the
  lead's name replacing them when it knows what the thread is.
- **Recommendation:** (c).

### Q2: What does "Keep talking first" do?
- **Context:** The design (`docs/proposals/app-shell/design/Thread.dc.html:97`) puts it
  beside "Plan it". Today `lead.md` says keeping on talking makes the thread a feature and
  the offer is never repeated (`protocol/app/lead.md:101-102`).
- **Options:** (a) "not yet": the lead keeps talking, doesn't start mapping or collect the
  idea, and may offer once more later when it has more; (b) same as typing today: it's a
  feature, the lead goes on with ideation, the button only dismisses the offer.
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Split the paper-cuts list three ways: screen fixes here; session and card cleanup, and the real smoke suite with hub risks, as stub threads | The parts touch different code and test differently | user |
| D2 | The idea-confirm question carries an optional `doc` field (a file name in the thread's plan directory, e.g. `IDEA.md`); the card shows an "Open IDEA.md" link to the in-app document page. Not the document inline | A link is one tap and keeps the card short on a phone; IDEA.md inline would push the options off screen. Collin asked for "show or link" | defaulted |
| D3 | Plan documents open in a new app page (in `APP_PAGES`, `viewer/pages/`), with the app nav and a "Back to the thread" link; it renders Markdown with `doc.js`'s renderer (tables) rather than `pages/md.js`. Archived threads' documents open on the same page, from the branch | Collin asked for the nav and a way back; the archived `<pre>` panel was the same problem in another form | defaulted |
| D4 | A press stores the pressed value on the card (`answered_value`), and an answered card marks the picked option and says "You picked <label>" | The value is already known at press time (`viewer/app/threads.js:213-225`); nothing else needs deciding | defaulted |
| D5 | "Answered in chat": `resolve` is extended to the lead's own `question` cards; the card shows "Answered in chat" and the note. `lead.md` tells the lead to resolve a question he answered by typing, as it already does for `needs` | Nothing links a typed message to a card; the lead already knows, and `resolve` is the existing way a lead closes a card | defaulted |
| D6 | Fonts are bundled from the `@fontsource/inter` and `@fontsource/jetbrains-mono` npm packages (SIL OFL), served by the viewer under its own origin, with `@font-face` in `app.css` and `font-src 'self'` added to `PAGE_CSP` | IDEA constraint: no third-party font host, strict CSP. The packages ship woff2 files and are the usual way to self-host these fonts | defaulted |

## Spec

The settled design, grown as decisions land.

(Written as the questions are settled.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
