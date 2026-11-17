---
slug: lean-sessions
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Make wheelchair sessions leaner

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Sub-leads ran 63 `git diff` reads (~97k tokens) across 8 builds | Which were sizing (`--shortstat`), which full diffs, and whether the bands or a skipped rule caused them | no | |
| 2 | Codex sessions start at ~18k; workers average 54k, verifiers 65k per call | What fills GPT worker and verifier context, and what Codex launch options can trim | no | Worker tool output: role/card file reads 35%, file reads 33%; verifiers: file reads 46%, tests 19%. Startup: tool schemas ~9.5k, base instructions, repo AGENTS.md (~3.5k, logged twice). Feeds the cards split and an AGENTS.md trim |
| 3 | Leads read `cards.md` ~2.2 times per session | Whether rereads follow compaction or restarts | no | Spec: role file and card rules go into the starting instructions, so nothing is reread |
| 4 | `protocol/app/AGENTS.md:16-17` says every role reads cards.md; reviewer and verifier files do not | Fix router or role files | no | Spec: the router names who reads which card file |
| 5 | Lead and sub-lead make ~40 and ~70 calls per session | Which routine sequences can become one command | no | Spec: chaining rule in role files, compact `session list`, the sizing command |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | GPT work aims at total GPT tokens against plan limits, workers and verifiers first | Collin, before IDEA.md | user |
| 2 | Claude sessions launch with a deny list of unused tools, and the Ready check warns (never blocks) when a Claude session's startup grows past a threshold | Saves ~30k per call now; an allow list risks breaking on a renamed tool; the warning catches the next heavy tool | user |
| 3 | Warning threshold is 25k startup tokens, measured from the first assistant message's usage in the session transcript | 17k measured today with the deny list; 25k leaves room for normal growth | defaulted |
| 4 | Sub-leads size every worker change with a new `wc.js diff size` command, whose band is binding and recorded in the acceptance Log line | 19 of 38 full reads were scout-band; one command replaces a skipped judgment | user |
| 5 | The sizing command ignores `docs/plans/` | A worker's report file pushed a ~100-line change over 800 | defaulted |
| 6 | Each session's starting instructions carry its role file's text, and the card rules it needs, instead of a pointer to read them | Removes the read calls and the rereads (cards.md ~2.2 reads per lead session); same text, fewer copies | defaulted |
| 7 | cards.md splits: `cards.md` keeps what every card-posting role needs; the lead-only kinds move to `cards-lead.md`, given to the lead only | Workers' tool output was 35% role/card reads on GPT; each rule still lives in one file | defaulted |
| 8 | `wc.js session list` prints a compact view by default; `--full` prints today's raw output | One live list was 10.7KB for two sessions, mostly steps and command | defaulted |
| 9 | Root `AGENTS.md` is cut below 6,000 bytes without dropping a rule; reasons and history move to `CONTRIBUTING.md` | It loads into every session on this repo, twice on Codex (~3.5k tokens each) | defaulted |
| 10 | Workers and verifiers run test suites printing only the summary and failures, rerunning a failing test alone for detail | Tests are 15–19% of GPT worker and verifier tool output; reports still paste real output | defaulted |
| 11 | Role files tell sessions to chain routine commands that do not depend on each other into one shell call | Each call rereads the whole context | defaulted |
| 13 | Startup warning measures tool overhead: startup minus the starting text and first message, at 25,000 | Rule text in the starting instructions would otherwise trip it for every lead | review-round-1 |
| 14 | Drop `--strict-mcp-config` and `--disable-slash-commands` | ~0.5k saving; they would cut a project's own MCP servers and skills | review-round-1 |
| 15 | The machine keeps an append-only session ledger with role and CLI session id | Re-measuring needs a role source once the role leaves the transcript | review-round-1 |
| 16 | Verifier file reading is deliberately left alone | It is the verification itself; verifiers still gain from shorter test output, AGENTS.md trim and loaded rules | review-round-1 |
| 12 | No GPT tool-schema trimming | Codex offers no supported way to drop its built-in tools; revisit if it adds one | defaulted |

## Spec

(grows as decisions land)

### Claude startup tools

- `machine/adapters/claude.js` `command()` adds `--disallowedTools` with: Artifact, Workflow, ScheduleWakeup, SendFeedback, ShareOnboardingGuide, ReportFindings, ListAgents, and the deferred-tool names that only reach interactive users (ArtifactComments, ArtifactData, CronCreate, CronDelete, CronList, RemoteTrigger, PushNotification, PublishPlugin, DesignSync, EnterWorktree, ExitWorktree, EnterPlanMode, ExitPlanMode).
- Kept: Bash, Read, Edit, Write, Agent (the scout), ToolSearch, TaskStop, SendMessage, Monitor, WebFetch, WebSearch, NotebookEdit.
- The list lives in one constant beside `command()`, so adding a tool is a one-line change.
- Every role uses this list: lead, sub-lead, worker, reviewer, verifier, mapper. Asides and the usage probe keep their own argv.
- No `--strict-mcp-config` or `--disable-slash-commands`: measured savings were ~0.5k, and they would drop a target project's own MCP servers and skills.
- **Growth warning.** After a Claude session's first assistant message, the machine reads its `usage` (input + cache write + cache read) from the transcript and records on the session `startup_tokens` and `tool_overhead` = `startup_tokens` − ceil((characters of the composed starting instructions + characters of the first message) / 4). The Ready check adds a non-blocking warning, not a missing item, when the newest Claude session on the build machine has `tool_overhead` above 25,000, so a lead's longer rule text never trips it. The approval card shows the warning text: "Claude sessions now start at <n>k tokens (expected under 25k). A Claude Code update may have added tools; tell the lead." The Ready result stays Ready.
- Measured: interactive haiku session in this worktree, first-call context 47,869 tokens by default, 17,093 with the deny list (2026-11-17).

### Starting instructions carry the rules

- `composeRolePrompt` (`machine/service.js:127-132`) builds, in order: a one-line header ("Your role rules and card rules are below, already loaded: do not read these files again unless this text is no longer in your context."), the full text of `protocol/app/<role>.md`, then the card files that role needs, each under a `--- <file name> ---` line, then the layers as today. `role_prompt` still wins.
- Card files per role: lead gets `cards.md` and `cards-lead.md`; sub-lead, worker and mapper get `cards.md`; reviewer, verifier and aside get none.
- The files are read from the machine's clone when the session starts. A session keeps the text it started with; a later edit reaches the next session.
- Role files lose their "Read `cards.md`, beside this file, first" lines; cross-references ("see the `diagram` section of `cards-lead.md`") stay, and resolve inside the starting text.
- Claude carries it in `--append-system-prompt`, Codex and Antigravity in the first `[wc:role]` message, exactly as the pointer travels today.
- The 12,000-character cap at `viewer/app/settings.js:177` stays on the layers only.

### The card rules split

- `cards.md` keeps: Posting a card, Which kinds exist (the full table, so everyone knows what exists), `progress`, `message`, `result`, What reaches a session and the markers, and The commands.
- `cards-lead.md` gets every other kind section (offer, idea, question, approval, needs, resolve, done, merged, diagram, image, stub, sudo, retract, title), moved verbatim.
- `card.js` validates against both files, so a kind's fields still live in exactly one place.
- `protocol/app/AGENTS.md` lists both files and who gets each, and says reviewer and verifier get neither.

### Sizing worker changes

- New: `node <root>/viewer/app/wc.js diff size <feature-branch> <worker-branch> [--tricky]`. It runs `git diff --numstat <feature>...<worker>` locally (read-only), drops paths under `docs/plans/`, sums added and removed lines, and prints one JSON line: `{"lines": N, "excluded": M, "band": "scout" | "bigger-scout" | "self"}`. Under 200 is `scout`, 200–800 `bigger-scout`, over 800 or `--tricky` `self`. Binary files count 0.
- `sub-lead.md` step 1 replaces its sizing prose: run the command for every worker result; the band is binding; the no-scout fallback stays as written. The acceptance Log line names the band: `- <date> — T<n> accepted (band: scout): ...`. A `self` read of a scout band is not allowed.

### Shorter output and fewer calls

- `wc.js session list` default prints, per session: name, role, provider, model, status, live, ready, started_by, attempt_id, title; plus `review_families`. `--full` prints the raw response. Nothing in the app parses `wc.js` stdout today; the lead and sub-lead rules that read `review_families` and the lead's provider still work.
- `worker.md` and `verifier.md`: run suites so only the summary and failures print (`node --test --test-reporter=dot`, `| tail -n 80`, or the suite's quiet flag); rerun a single failing test for detail. Reports paste that output.
- `lead.md`, `sub-lead.md`, `worker.md`, `verifier.md`, `mapper.md`: one line saying to chain routine commands that do not depend on each other's output into one shell call.

### Root AGENTS.md

- Cut to under 6,000 bytes. Every rule stays (the canonical-clone refusal, never starting a viewer by hand, the unquoted glob, graphify last); the reasons and history behind them move to `CONTRIBUTING.md`, with a one-line pointer.

### Boundaries and non-goals

- Nothing Collin sees in a thread changes, except the approval card's optional startup warning.
- No model or tier moves. Reviews and verification are not reduced.
- GPT's built-in tool schemas are not trimmed.
- Sessions already running keep their old instructions.

### Edge cases

- A role file or card file missing at start: the start fails with the reason, as a missing role file would be noticed today.
- A Claude Code release that renames a denied tool: the deny entry is ignored by the CLI; startup grows and the warning fires.
- A diff where every path is under `docs/plans/`: `lines` 0, band `scout`.

### Validation

- `bash machine/test/run.sh` (Claude argv carries the deny list and both flags; composed prompt holds role text and the right card files per role; `startup_tokens` recorded from a fixture transcript).
- `node --test viewer/test/*.test.js` (Ready check warning above 25,000 and not below; `wc.js diff size` bands and the `docs/plans/` exclusion on a temp repo; compact and `--full` list; `card.js` validates kinds from both card files; `protocol-rules.test.js` updated).
- `npm --prefix viewer run test:browser` (approval card shows the warning).
- Live: start a Claude worker on this machine after install; its `startup_tokens` is under 25,000.
- Re-measure after a few threads with the baseline method above, taking each Claude session's role from the session ledger.

### Measured baseline (2026-11-17)

- Claude, sessions since 2026-11-17 00:00, cost-weighted (cache read 0.1×, cache write 1.25×, output 5×): lead 52%, sub-lead 44%, verifier 4%. Average context per call: lead 102k, sub-lead 149k. Cache reads are about two-thirds of cost, so cost tracks calls × context.
- GPT, sessions since 2026-11-10: verifier 106M input tokens, worker 163M, reviewer 37M; 84–97% cached.
- Method: Claude transcripts under `~/.claude/projects/*wheelchair-worktrees*`, role from the first user message or the first tool call naming `protocol/app/<role>.md`; Codex from `~/.codex/sessions` `token_count` events. After this change the role no longer appears in a Claude transcript, so re-measuring takes it from the session ledger below.

### Session ledger

- When the machine starts a session it appends one JSON line to `<stateDir>/session-ledger.jsonl`: `{at, name, role, provider, model, cli_session_id, thread_id}`. Append-only, never pruned by the service; `cli_session_id` matches the Claude transcript file name, and for Codex the thread id the session reports once known (or `null`).
- It is for re-measuring only; nothing reads it at runtime.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-17

**Lanes:** intent: claude; mechanics: gpt; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Startup warning would fire for every lead once rules are in the starting text | upheld | Measures tool overhead (Decision 13) |
| intent | major | Re-measuring loses the role source for Claude | upheld | Session ledger (Decision 15) |
| intent | major | Connector and skill flags drop project MCP servers and skills for ~0 saving | upheld | Flags dropped (Decision 14) |
| intent | minor | Codex can compact away the first message; header forbids rereading | upheld | Header allows a reread when the text is gone |
| intent | minor | Verifier file reads (46%) unaddressed without saying why | upheld | Decision 16 |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
