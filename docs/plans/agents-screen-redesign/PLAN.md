---
slug: agents-screen-redesign
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Agents screen: layout and terminal

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. Design source: `docs/proposals/app-shell/agents-screen.md`
and `docs/proposals/app-shell/design/AgentsTree.dc.html`, `AgentsTerminal.dc.html`,
`AgentsTerminalTyping.dc.html`. How the code works today: `MAP.md`.

## Open Questions

### Q1: Where does each box's title come from?
- **Context:** The design labels each agent by what it is doing. The hub does not reliably
  keep an agent's brief (MAP.md, session records paragraph), and briefs are long.
- **Options:** (a) Whoever starts an agent gives it a short title (`wc.js session start
  --title`), with the brief's first line as a fallback; the role files say to pass it.
  (b) Always take the brief's first line. (c) A cheap model summarises the brief.
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | The sidebar shows a lead's stage ("Building") | Which record says a thread's stage today (progress card, PLAN status) | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Split the design: this thread builds layout, tree, side panel basics and bottom terminal; activity map, Latest, "is this normal?", context ring and question path go to the stub "Agents screen: live activity per agent" | Those need a per-step event stream that doesn't exist yet | user |
| 2 | "Waiting on X" for an agent is inferred: its turn has ended, its last card was a `message` to X, and X has not sent it a `message` since. A lead waiting on its own unfinished children keeps today's wording | Uses cards the hub already stores; no new protocol | defaulted |
| 3 | View-only scrolling moves through tmux scrollback fetched into the browser (last 2000 lines when the panel opens, then the live snapshot as today) | Today the page keeps no history (`viewer/pages/terminal.js:94-139`), so there is nothing to scroll without it | defaulted |
| 4 | The tree keeps every session of the lead's thread, including stopped ones (dashed, "finished"); archived threads are left out | The design shows finished agents; today they're pruned (`viewer/app/agents.js:3-27`) | defaulted |
| 5 | "Finished today" means leads whose sessions all ended since local midnight | Plain reading of the label | defaulted |
| 6 | Pop out opens today's terminal page, which also starts view only with the same typing switch | The stray-key problem exists there too | defaulted |
| 7 | The project tag is the basename of the thread's project path | Already stored on the thread (`viewer/app/threads.js:20-38`) | defaulted |
| 8 | On a phone (under 900px) the screen stacks: lead list, then the lead's tree, then the agent's panel full screen; the terminal opens full screen with the same view-only switch | Keeps everything reachable on a phone | user |

## Spec

(Grows as decisions land.)

- **Phone, under 900px:** the screen stacks. First the list of leads; tapping one shows its tree with a back link; tapping an agent shows its panel full screen with a back link; Open terminal opens the terminal full screen, starting view only, with the same typing switch and close.

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
