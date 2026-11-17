---
slug: lean-sessions
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Make wheelchair sessions leaner

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q2: How to make sub-leads follow the diff-check sizes
- **Context:** 38 full diffs read by 8 sub-leads since 2026-11-17 (~81k tokens). 19 were in the scout bands (11 under 200 lines, 8 at 200–800); 5 of 8 sub-leads never used a scout. Only 8 were legitimately over 800 or tricky; one was "over 800" only because the worker's report file was counted.
- **Options:** (a) stronger wording in sub-lead.md; (b) a `wc.js diff-check <branch>` command that sizes the diff (excluding `docs/plans/`), names the band, and prints the exact scout instruction or "read it yourself"; (c) the hub runs the scout itself and hands the sub-lead only the report.
- **Recommendation:** (b).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Sub-leads ran 63 `git diff` reads (~97k tokens) across 8 builds | Which were sizing (`--shortstat`), which full diffs, and whether the bands or a skipped rule caused them | no | |
| 2 | Codex sessions start at ~18k; workers average 54k, verifiers 65k per call | What fills GPT worker and verifier context, and what Codex launch options can trim | no | Worker tool output: role/card file reads 35%, file reads 33%; verifiers: file reads 46%, tests 19%. Startup: tool schemas ~9.5k, base instructions, repo AGENTS.md (~3.5k, logged twice). Feeds the cards split and an AGENTS.md trim |
| 3 | Leads read `cards.md` ~2.2 times per session | Whether rereads follow compaction or restarts | no | |
| 4 | `protocol/app/AGENTS.md:16-17` says every role reads cards.md; reviewer and verifier files do not | Fix router or role files | no | |
| 5 | Lead and sub-lead make ~40 and ~70 calls per session | Which routine sequences can become one command | no | |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | GPT work aims at total GPT tokens against plan limits, workers and verifiers first | Collin, before IDEA.md | user |
| 2 | Claude sessions launch with a deny list of unused tools, and the Ready check warns (never blocks) when a Claude session's startup grows past a threshold | Saves ~30k per call now; an allow list risks breaking on a renamed tool; the warning catches the next heavy tool | user |
| 3 | Warning threshold is 25k startup tokens, measured from the first assistant message's usage in the session transcript | 17k measured today with the deny list; 25k leaves room for normal growth | defaulted |

## Spec

(grows as decisions land)

### Claude startup tools

- `machine/adapters/claude.js` `command()` adds `--disallowedTools` with: Artifact, Workflow, ScheduleWakeup, SendFeedback, ShareOnboardingGuide, ReportFindings, ListAgents, and the deferred-tool names that only reach interactive users (ArtifactComments, ArtifactData, CronCreate, CronDelete, CronList, RemoteTrigger, PushNotification, PublishPlugin, DesignSync, EnterWorktree, ExitWorktree, EnterPlanMode, ExitPlanMode). It also adds `--strict-mcp-config` and `--disable-slash-commands`: small today, but they keep account connectors and skills out of agent sessions.
- Kept: Bash, Read, Edit, Write, Agent (the scout), ToolSearch, TaskStop, SendMessage, Monitor, WebFetch, WebSearch, NotebookEdit.
- The list lives in one constant beside `command()`, so adding a tool is a one-line change.
- Every role uses this list: lead, sub-lead, worker, reviewer, verifier, mapper. Asides and the usage probe keep their own argv.
- **Growth warning.** After a Claude session's first assistant message, the machine reads its `usage` (input + cache write + cache read) from the transcript and records it on the session as `startup_tokens`. The Ready check adds a non-blocking warning, not a missing item, when the newest Claude session on the build machine recorded more than 25,000. The approval card shows the warning text: "Claude sessions now start at <n>k tokens (expected under 25k). A Claude Code update may have added tools; tell the lead." The Ready result stays Ready.
- Measured: interactive haiku session in this worktree, first-call context 47,869 tokens by default, 17,093 with the deny list (2026-11-17).

### Measured baseline (2026-11-17)

- Claude, sessions since 2026-11-17 00:00, cost-weighted (cache read 0.1×, cache write 1.25×, output 5×): lead 52%, sub-lead 44%, verifier 4%. Average context per call: lead 102k, sub-lead 149k. Cache reads are about two-thirds of cost, so cost tracks calls × context.
- GPT, sessions since 2026-11-10: verifier 106M input tokens, worker 163M, reviewer 37M; 84–97% cached.
- Method: Claude transcripts under `~/.claude/projects/*wheelchair-worktrees*`, role from the first user message or the first tool call naming `protocol/app/<role>.md`; Codex from `~/.codex/sessions` `token_count` events.

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
