---
slug: thread-asides
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Asides

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md`.

## Open Questions

### Q1: What "This changes my answer" sends, and who writes it
- **Context:** The main thread must get one line the lead acts on. Today a browser message
  goes to the latest live lead as Collin's own visible text (`viewer/app/routes.js:343-350`).
  An open `question` card is answered by a press or by Collin typing, which the lead then
  resolves (`protocol/app/lead.md`).
- **Options:**
  - a) The aside drafts the line; Collin edits it in the panel and sends it. It lands in the
    main thread as his message, with a link back to the aside. If a question card is
    waiting, the lead treats it as his typed answer to that card.
  - b) Collin writes the line himself; the aside drafts nothing.
  - c) The aside sends its own summary straight away, no review.
- **Recommendation:** a.

### Q2: How an aside moves up to the stronger model
- **Context:** The design says an aside starts on the lead provider's Standard model,
  moves up to Heavy when the question needs it and says so in one line; "Draw it" starts on
  Heavy. Who decides is open (`docs/proposals/app-settings/proposal.md`, open questions).
  Both CLIs can reopen a conversation on another model (`claude --resume --model`,
  `codex resume -m`).
- **Options:**
  - a) The aside judges each question itself and steps up when needed, saying so in one line.
  - b) A "Think harder" button in the panel; Collin decides.
  - c) Both: the aside may step up, and the button is always there.
  - d) No switching: an aside runs on the lead's own model.
- **Recommendation:** pending Q1.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | MAP: fork readiness and copied history never tried | Start a real Claude and Codex fork in tmux; confirm the startup screen, that history carries over, and where the forked transcript lands | no | |
| 2 | MAP: phone text selection | Whether long-press selection on iOS/Android leaves room for our own bar, or the bar must sit fixed at the bottom | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Asides get their own thread; the settings thread no longer owns them, and the side-conversations thread only adds a free-text answer box to question cards | Collin, 2026-11-15 | user |
| 2 | An aside is a fork of the lead's CLI conversation (`claude --resume <id> --fork-session`, `codex fork <id>`), started under a new `aside` role with its own token | The design asks for a copy; authority follows the token's role (`viewer/app/cards.js:38-48`, `viewer/app/sessions.js:380-387`), so a copied lead history can't post cards or start sessions | defaulted |
| 3 | The fork is a snapshot taken when the aside opens; it doesn't see later lead turns | Feeding later turns in would add to the aside's cost for little use; the panel shows when it was opened | defaulted |
| 4 | Reopening a closed aside shows its conversation, and typing in it continues that aside's own copy | Closing stops its session; resuming by its saved id costs nothing until he types | defaulted |
| 5 | Several asides can exist in a thread; one panel shows at a time | The design's "1 aside open" count implies more than one | defaulted |
| 6 | On a phone the panel is a full-screen sheet over the thread, with a back control | The side column is hidden at phone width (`viewer/pages/app.css:141-150`) | defaulted |
| 7 | "What the main thread is waiting on" is the oldest open `question` card; with none, the panel says what the lead is doing or that nothing is waiting | Open cards are already in `/chat` (`viewer/app/chat.js:224-228`) | defaulted |
| 8 | An aside writes nothing in the worktree. "Draw it" graphs go in the hub's per-thread state outside the repository and are shown in the panel, not as a `diagram` card in the main thread | During a build the worktree belongs to the sub-lead; the main thread must not change | defaulted |

## Spec

To be written as decisions land.

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
