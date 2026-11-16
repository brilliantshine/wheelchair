# App paper cuts from the first runs

Nov 14, 2026 · collected from `docs/plans/app-shell/` (acceptance run, verification, UI pass)

## What this is

Small fixes to the app (slice 1, `docs/plans/app-shell/`), gathered while Collin used it on
`wc-sandbox` and while it was verified. Each is small. Together they're the friction he hit.
Start it as a thread in the app and point the lead at this file. The detail behind each item
is in `docs/plans/app-shell/acceptance-followups.md` and COMPLETION.md's residual risks.
Items already fixed are left out: Markdown in chat, Archive placement, the terminal link on
permission cards, needs cards that close, and a restarted worker's worktree.

## What Collin hit

- **Threads without a title.** A fix thread shows its project name. Take the title from the
  first message, or let the lead name the thread.
- **The idea question should carry the idea.** Confirming IDEA.md means hunting for the link.
  The question card should show IDEA.md or link to it.
- **Plan documents open in the old viewer.** MAP, IDEA and PLAN links leave the app. Open them
  inside it, with the nav and a way back to the thread.
- **An answered question doesn't say what was picked.** Show the option pressed, or "answered
  in chat".
- **The offer has no "Keep talking first".** The design has it. Today the only way to decline
  is to keep typing.
- **Fonts.** The design's Inter and JetBrains Mono are only used if installed, because the
  server has no font route.

## Seen while watching

- **Escape doesn't end a turn for the hub.** An interrupted Claude turn fires no Stop hook,
  so the hub holds that session's queue until something else ends a turn.
- **A lead doesn't learn its pull request merged.** It kept calling a merged PR open.
- **A checker left running** after its result arrived.
- **Old sessions keep stale environment** after a fix, until restarted.
- **"Sessions ended" cards pile up** in the history, one per dead lead.
- **A dead plan in the viewer's list** after archive removes its worktree.
- **An empty Enter in the browser terminal** marks the session busy until a later turn ends.

## Risks to close

- **A smoke suite against the real thing.** Closed by `test-support/smoke/run.sh`; see `docs/plans/app-risks/`.
- **Model tiers in a live build.** Closed by `test-support/smoke/live.sh`; see `docs/plans/app-risks/`.
- **Permission prompt clearing.** Closed by `test-support/smoke/live.sh`; see `docs/plans/app-risks/`.
- **Timeouts.** Starts already get 60 seconds and one retry, pinned by the `live.sh` slow-start check; other calls are out of scope. See `docs/plans/app-risks/`.
- **A hub 500 on a relayed card.** Closed in the `machine/service.js` cards route; see `docs/plans/app-risks/`.
- **`projects.json`.** Out of scope (D1); see `docs/plans/app-risks/`.

## Checks

Each fix comes with a test that fails before it. The smoke suite runs on hearth without
touching the live services, the same way the existing suites don't.
