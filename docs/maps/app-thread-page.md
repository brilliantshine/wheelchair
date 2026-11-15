# Map: thread diagrams and message composer

Checked against: `7c380321f4556a08b63485203d613feeeae1f640` (origin/main)
Files covered: `protocol/app/cards.md`, `viewer/app/card.js`, `viewer/app/cards.js`, `viewer/app/chat.js`, `viewer/app/routes.js`, `viewer/app/state.js`, `viewer/pages/thread.js`, `viewer/pages/thread.html`, `viewer/pages/thread.css`, `viewer/index.html`

## Flow

1. A lead writes a graph and posts a `diagram` with nonempty `plan`, `graph`, `title` (`protocol/app/cards.md:184-195`). The CLI rejects unknown fields; the hub repeats validation with the session role, allowing only leads (`viewer/app/card.js:21-30,96,115-137,180-196`; `viewer/app/cards.js:38-48`).
2. The hub registers the plan and graph before storing the card with an id and timestamp in the thread (`viewer/app/cards.js:11-28,50-55,79`; `viewer/app/state.js:122-130`). `/chat` returns unreplaced cards alongside lead transcript items (`viewer/app/chat.js:202-229`); the page polls and renders them (`viewer/pages/thread.js:720-728,748-750`).
3. The card renders a full-screen link and iframe. Live graphs point to the thread worktree; archived graphs use the archive route (`viewer/pages/thread.js:166-170,571-581`). The graph page fetches its graph, with archived data read-only (`viewer/index.html:320-322,462-479,513`). The iframe has no `sandbox` attribute (`viewer/pages/thread.js:580`). It is 100% wide and 340px high; at widths up to 899px, cards can occupy the chat width and the composer reflows (`viewer/pages/thread.css:176-182,204-225`).
4. The composer has a textarea and send button (`viewer/pages/thread.html:33-42`). On submit it trims text, ignores empty input and posts `{text}`; it clears the textarea after success (`viewer/pages/thread.js:732-745`). The route selects the most recent live lead and enqueues the text (`viewer/app/routes.js:343-350`).

```text
lead -> graph file + diagram card -> validate -> register -> store -> /chat -> iframe graph
textarea -> POST messages -> latest live lead queue
```

## What I did not look at

Other card kinds, button presses, transcript parsing, thread list, graph drawing internals and browser tests. This replaces the older broad map because its covered files changed; its prior version remains in git history.
