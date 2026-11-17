---
slug: agents-activity
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Agents screen: live activity, context ring, question path

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: How does the app know which agent a question started from?
- **Context:** MAP.md: a `message` stores sender and recipient, and a lead's `question` card
  stores only its author. Nothing joins a worker's message to the sub-lead's message to the
  lead's question card. `waiting_on` is a guess at turn end, not proof.
- **Options:**
  - A. Explicit: a `message` that asks something carries `asks: true`; an agent passing a
    question on names the message it is passing (`passes_on: <message id>`), and the lead's
    `question` card may name it too. The hub follows the chain. Needs edits to cards.md,
    lead.md, sub-lead.md, worker.md and the card checker.
  - B. Inferred: when the lead posts a question, the hub walks `waiting_on` down the tree
    from the lead and draws the longest current chain. No protocol change; wrong when two
    agents wait at once or the chain changed before the card was posted.
- **Recommendation:** A. A path drawn on a guess sends Collin to the wrong agent.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Claude Code steps come from `PreToolUse`, `PostToolUse` and `PostToolUseFailure` hooks, paired by `tool_use_id`, timed by hook receipt time | They cover every tool call with start, end and failure (MAP.md, Hook signals) | defaulted |
| 2 | Codex steps come from its rollout log (`custom_tool_call` / `function_call` and their `_output`, paired by `call_id`, timed by the record `timestamp`), read as it grows, not from Codex hooks | Codex 0.169 hooks cover shell only and report no failures; the rollout records every call with times (checked on a live rollout, 2026-11-17) | defaulted |
| 3 | A Codex `exec` script call that runs several nested tools becomes one step per nested tool, sharing the script's start and end; the script's own failure marks all of them failed | Counts and Latest then match what the agent actually did | defaulted |
| 4 | Thinking is the gap between steps inside a turn, shown as a running Thinking step when no tool is running and the turn has not ended | Neither CLI reports thinking as a tool | defaulted |
| 5 | Context fill: Claude from the statusline's `context_window.used_percentage`; Codex from the latest `token_count` as `last_token_usage.total_tokens / model_context_window`. No number yet: grey empty ring | Both are the CLI's own numbers (MAP.md, Context and copies) | defaulted |
| 6 | "Is this normal?" matches past steps by kind plus a normalised target (command's first two words, or the file path's directory), using the last five finished matches from the last 30 days in the same project | Simple, explainable, and enough for "took about 3 minutes the last two times" | defaulted |
| 7 | The page keeps polling `/wheelchair/api/agents` every 5 seconds; "now · 2:14" ticks locally between polls | Matches today's screen; no push channel exists | defaulted |

## Spec

Draft, growing as decisions land.

### Steps

A **step** is one tool call by one session: `{id, session, kind, target, started_at,
ended_at|null, failed|null}`. `kind` is one of `files`, `shell`, `thinking`, `helpers`,
`web`, `starter`.

| Kind | Claude Code tools | Codex tools |
|---|---|---|
| files | Read, Write, Edit, Glob, Grep, NotebookEdit | apply_patch, view_image, read/write file tools |
| shell | Bash and anything not listed elsewhere | exec_command, shell, write_stdin |
| helpers | Agent / Task | spawn_agent and its kin |
| web | WebFetch, WebSearch | web_search |
| starter | a shell command running `card.js message` or `card.js result` | same |
| thinking | gaps (Decision 4) | gaps |

`target` is a short label: the file path, the command's first line cut to 80 characters, the
URL's host, or the helper's description.

### Context

Each session gains `context: {percent, at}` or null (Decision 5). Ring amber at 70%, red at 90%.

### Question path

Pending Q1.

### Screen

The selected-agent panel gains, under the existing details: the "is this normal?" line, the
activity map (six spots, line weight by count, count under busy spots, dotted trail of the
last five moves, drifting dashes toward the current spot with "now · m:ss", no motion under
`prefers-reduced-motion: reduce`), the context ring around the centre, and Latest (four
steps, time, ✓ / ✕ / ●). Design: `docs/proposals/app-shell/design/AgentsActivity.dc.html`,
`AgentsNowOptions.dc.html` option A, `AgentsTree.dc.html` for the amber path.

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
