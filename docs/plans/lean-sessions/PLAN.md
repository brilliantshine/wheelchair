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
| 17 | Test output: suite output goes to a log; exit status and tail are printed; never `| tail` | A pipe hides a failing exit status | review-round-1 |
| 18 | Starting text names `<root>` explicitly; role files stop deriving it from their path | Inlined text has no file path | review-round-1 |
| 19 | The hub attaches startup warnings to the approval card when accepting it and refreshes them on press without consuming Start building | Approval cards carry the lead's Ready result; warnings must not gate | review-round-1 |
| 20 | Card split is documentation only; card.js schema unchanged | Keeps accepted cards identical | review-round-1 |
| 21 | Band from non-plan paths; scout gets the diff without `docs/plans/`; other excluded paths read by the sub-lead | Report file inflated sizes; nothing escapes review | review-round-1 |
| 22 | Asides keep their own pointer prompt | Separate path in aside-turns.js | review-round-1 |
| 23 | Briefs stop telling sessions to read their role file | Would bring the reread back | review-round-2 |
| 24 | Band sized on the same filtered diff the scout reads; excluded paths list both rename ends | Renames across docs/plans/ skewed both | review-round-2 |
| 25 | Warning uses the newest session with a sample; lookup failure accepts the card with no warnings; overhead subtracts the transcript's first user message | Robust advisory; leads start with an empty brief | review-round-2 |
| 26 | Ledger gets a second Codex line with its thread id | Codex learns its transcript id after start | review-round-2 |
| 27 | Supersedes 3: the threshold applies to `tool_overhead`, not raw startup tokens | Decisions 13 and 25 | review-round-3 |
| 28 | Overhead subtracts every transcript record before the first reply; AskUserQuestion and EndConversation join the deny list; everything else is kept | Project instructions and skills are not tool growth | review-round-3 |
| 29 | Excluded paths come from the unfiltered name-status; renames across `docs/plans/` go to the sub-lead | Path-limited listing shows one end only | review-round-3 |
| 30 | `session start` prints a compact view | It would echo the inlined starting text | review-round-3 |
| 31 | Warning lookup has a 2-second deadline; ledger records account_dir; role files keep a pointer fallback | Relay timeout, account homes, sessions spanning a deploy | review-round-3 |
| 12 | No GPT tool-schema trimming | Codex offers no supported way to drop its built-in tools; revisit if it adds one | defaulted |

## Spec

(grows as decisions land)

### Claude startup tools

- `machine/adapters/claude.js` `command()` adds `--disallowedTools` with: Artifact, Workflow, ScheduleWakeup, SendFeedback, ShareOnboardingGuide, ReportFindings, ListAgents, and the deferred-tool names that only reach interactive users (ArtifactComments, ArtifactData, CronCreate, CronDelete, CronList, RemoteTrigger, PushNotification, PublishPlugin, DesignSync, EnterWorktree, ExitWorktree, EnterPlanMode, ExitPlanMode, AskUserQuestion, EndConversation).
- Every tool not on the deny list stays, including Bash, Read, Edit, Write, Agent (the scout), Skill (project skills), ToolSearch, TaskStop, SendMessage, Monitor, WebFetch, WebSearch, NotebookEdit.
- The list lives in one constant beside `command()`, so adding a tool is a one-line change.
- Every role uses this list: lead, sub-lead, worker, reviewer, verifier, mapper. Asides and the usage probe keep their own argv.
- No `--strict-mcp-config` or `--disable-slash-commands`: measured savings were ~0.5k, and they would drop a target project's own MCP servers and skills.
- **Growth warning.** After a Claude session's first assistant message, the machine reads its `usage` (input + cache write + cache read) from the transcript and records on the session `startup_tokens` and `tool_overhead` = `startup_tokens` − ceil((characters of the composed starting instructions + characters of every transcript record before the first assistant message, including `attachment` records such as project instructions and the skill listing) / 4). These are read from the transcript itself, not the launch brief, since a lead launches with an empty brief and its first input is whatever arrives first. The Ready check (`viewer/app/ready.js` `check`) returns a `warnings` array alongside `missing`: one entry when the newest Claude session on the build machine that has a recorded `tool_overhead` is above 25,000 (sessions without a sample yet are skipped; no sample at all means no warning), so a lead's longer rule text never trips it. Warnings never change `ok`.
- **Where the warning shows.** When the hub accepts an `approval` card (`viewer/app/cards.js`, the add-card path), it runs the Ready check's warning part and stores `card.ready.warnings`; the lookup has its own 2-second deadline, shorter than the card relay's, and if it fails or times out the card is accepted with `warnings: []`; the lead's submitted `ok`/`missing` are kept as today. A `recheck` press replaces `card.ready` whole, warnings included. On `start-building`, `same()` keeps comparing `missing` only; the hub writes the fresh `warnings` onto the card and, if `ok`, starts the build on that same press. A warning that appears or clears never consumes the press. The approval card shows the warning text: "Estimated startup overhead is now <n>k tokens in the newest Claude session (expected under 25k), mostly Claude Code's built-in tools. An update may have added some; tell the lead." `<n>` is `tool_overhead` in thousands. The Ready result stays Ready.
- Measured: interactive haiku session in this worktree, first-call context 47,869 tokens by default, 17,093 with the deny list (2026-11-17).

### Starting instructions carry the rules

- `composeRolePrompt` (`machine/service.js:127-132`) builds, in order: a one-line header ("Your role rules and card rules are below, already loaded: do not read these files again unless this text is no longer in your context."), the full text of `protocol/app/<role>.md`, then the card files that role needs, each under a `--- <file name> ---` line, then the layers as today. `role_prompt` still wins.
- Card files per role: lead gets `cards.md` and `cards-lead.md`; sub-lead, worker and mapper get `cards.md`; reviewer and verifier get none.
- The header also states the clone: "`<root>` is `<absolute path of the machine's clone>`." Role files and `cards.md` stop deriving `<root>` from their own path and say "`<root>` is named in your starting instructions", so a session never resolves it to a feature worktree.
- Briefs stop naming role files. `lead.md` (mapper, reviewer, sub-lead and verifier briefs) and `sub-lead.md` (worker and verifier briefs) say instead: the session's role rules are already in its starting instructions, so a brief never tells it to read its role file. "Brief them from `reviewer.md`" style lines that tell the lead what to put in a brief stay; only the instruction to the started session changes.
- Sessions started before the change keep a pointer and read the files from disk. So role files keep a fallback line: "If your starting instructions only point you to this file, `<root>` is this file's path with `/protocol/app/<role>.md` dropped, and read `cards.md` (the lead also `cards-lead.md`) beside it."
- Asides are out of scope: `machine/lib/aside-turns.js` keeps its own pointer prompt.
- The files are read from the machine's clone when the session starts. A session keeps the text it started with; a later edit reaches the next session.
- Role files lose their "Read `cards.md`, beside this file, first" lines; cross-references ("see the `diagram` section of `cards-lead.md`") stay, and resolve inside the starting text.
- Claude carries it in `--append-system-prompt`, Codex and Antigravity in the first `[wc:role]` message, exactly as the pointer travels today.
- The 12,000-character cap at `viewer/app/settings.js:177` stays on the layers only.

### The card rules split

- `cards.md` keeps: Posting a card, Which kinds exist (the full table, so everyone knows what exists), `progress`, `message`, `result`, What reaches a session and the markers, and The commands.
- `cards-lead.md` gets every other kind section (offer, idea, question, approval, needs, resolve, done, merged, diagram, image, stub, sudo, retract, title), moved verbatim.
- The split is documentation only. `card.js` keeps its JavaScript schema (`viewer/app/card.js:24-41,145-191`) unchanged, so exactly the same cards are accepted. `protocol-rules.test.js` checks that every kind in the schema has exactly one section across the two files.
- `protocol/app/AGENTS.md` lists both files and who gets each, and says reviewer and verifier get neither.

### Sizing worker changes

- New: `node <root>/viewer/app/wc.js diff size <feature-branch> <worker-branch> [--tricky]`. It runs `git diff --numstat <feature>...<worker> -- . ':(exclude)docs/plans'` locally (read-only), the same filtered diff the scout reads, sums added and removed lines, lists `excluded_paths` from the unfiltered `git diff --name-status <feature>...<worker>`: every entry with an endpoint under `docs/plans/`, giving both endpoints of a rename (`old -> new`), and prints one JSON line: `{"lines": N, "band": "scout" | "bigger-scout" | "self", "excluded_paths": [...], "scout_diff": "git diff <feature>...<worker> -- . ':(exclude)docs/plans'"}`. Under 200 is `scout`, 200–800 `bigger-scout`, over 800 or `--tricky` `self`. Binary files count 0.
- `sub-lead.md` step 1 replaces its sizing prose: run the command for every worker result; the band is binding; the no-scout fallback stays as written. The acceptance Log line names the band: `- <date> — T<n> accepted (band: scout): ...`. A `self` read of a scout band is not allowed. The scout (or the sub-lead, for `self`) gets, as today, the brief, the Spec and the worker's report, plus the diff from the `scout_diff` command, which leaves out changes under `docs/plans/`. Each excluded path must be the worker's own `docs/plans/<slug>/reports/<task>.md`, which step 2 already reads; a rename into or out of `docs/plans/` and any other excluded path is read by the sub-lead itself (`git diff <feature>...<worker> -- <path>`) and, being outside a worker's ownership, is normally sent back.

### Shorter output and fewer calls

- `wc.js session start` prints the same compact view of the started session (plus `note` and any waiting line), never `command`, so the inlined starting text is not echoed into the starter's context. `--full` prints today's output.
- `wc.js session list` default prints, per session: name, role, provider, model, status, live, ready, started_by, attempt_id, title; plus `review_families`. `--full` prints the raw response. Nothing in the app parses `wc.js` stdout today; the lead and sub-lead rules that read `review_families` and the lead's provider still work.
- `worker.md` and `verifier.md`: run a suite as `<command> > <log> 2>&1; echo "exit $?"; tail -n 80 <log>` (log in a scratch directory), so the exit status is the suite's own and is always printed. On a non-zero exit, read the failures from the log (`grep -n -A30 'not ok\|FAIL\|Error' <log>`) before reporting; never pipe a suite straight into `tail`. Reports paste the exit line and the tail.
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

- `bash machine/test/run.sh` (Claude argv carries the deny list and neither `--strict-mcp-config` nor `--disable-slash-commands`; composed prompt holds role text and the right card files per role; `startup_tokens` and `tool_overhead` recorded from a fixture transcript with attachment records; ledger start line and Codex thread-id line written).
- `node --test viewer/test/*.test.js` (Ready check warning above 25,000 and not below, sessions without a sample skipped, none at all gives no warning; approval card accepted with `warnings: []` when the lookup fails; Start building not consumed by a warning-only change; `wc.js diff size` bands and the `docs/plans/` exclusion on a temp repo; compact and `--full` list; every schema kind has exactly one section across `cards.md` and `cards-lead.md`; `card.js` accepts the same cards as before; `protocol-rules.test.js` updated).
- `npm --prefix viewer run test:browser` (approval card shows the warning).
- Live: after install, start a Claude lead (a test thread) and a Claude worker on this machine; both record `tool_overhead` under 25,000, and the lead's composed instructions hold lead.md, cards.md and cards-lead.md.
- Re-measure after a few threads with the baseline method above, taking each Claude session's role from the session ledger (joined on `cli_session_id` = transcript file name), and reporting the same metrics: cost share by role, average context per call, calls per session.

### Measured baseline (2026-11-17)

- Claude, sessions since 2026-11-17 00:00, cost-weighted (cache read 0.1×, cache write 1.25×, output 5×): lead 52%, sub-lead 44%, verifier 4%. Average context per call: lead 102k, sub-lead 149k. Cache reads are about two-thirds of cost, so cost tracks calls × context.
- GPT, sessions since 2026-11-10: verifier 106M input tokens, worker 163M, reviewer 37M; 84–97% cached.
- Method: Claude transcripts under `~/.claude/projects/*wheelchair-worktrees*`, role from the first user message or the first tool call naming `protocol/app/<role>.md`; Codex from `~/.codex/sessions` `token_count` events. After this change the role no longer appears in a Claude transcript, so re-measuring takes it from the session ledger below.

### Session ledger

- When the machine starts a session it appends one JSON line to `<stateDir>/session-ledger.jsonl`: `{at, name, role, provider, model, account_dir, cli_session_id, thread_id}`. Re-measuring scans each `account_dir`'s transcript home as well as the default one. Append-only, never pruned by the service; `cli_session_id` matches the Claude transcript file name, and for Codex it is the machine's own UUID and is not a join key.
- For Codex, when the adapter learns the transcript's thread id (`machine/adapters/codex.js:31-39`) the machine appends a second line `{at, name, codex_thread_id}`. Joins: Claude on `cli_session_id` = transcript file name; Codex on `codex_thread_id` = the `session_meta` id in `~/.codex/sessions`.
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
| mechanics | blocking | `| tail -n 80` hides a failing exit status | upheld | Decision 17 |
| mechanics | blocking | Inlined text loses the path `<root>` is derived from | upheld | Decision 18 |
| mechanics | blocking | Approval card never runs the hub check, so the warning can't show | upheld | Decision 19 |
| mechanics | major | Warning refresh vs consuming the Start building press | upheld | Decision 19 |
| mechanics | major | Threshold vs lead prompt load; live check only on a worker | upheld | Tool overhead (Decision 13); live check covers a lead |
| mechanics | major | Connector and skill flags drop project capabilities | upheld | Same as intent; Decision 14 |
| mechanics | major | card.js does not read the Markdown | upheld | Decision 20 |
| mechanics | major | Band excludes plan docs but the scout got the full diff | upheld | Decision 21 |
| mechanics | major | Re-measure loses role attribution | upheld | Same as intent; ledger join and metrics named |
| mechanics | minor | Asides in the role mapping | upheld | Decision 22 |

### Round 2 — 2026-11-17

**Lanes:** intent: claude; mechanics: gpt; cross-family: yes.

**Changed since Round 1:**
- Startup warning measures tool overhead and attaches to the approval card (Decisions 13, 19)
- Connector and skill flags dropped (14)
- Session ledger for re-measuring (15)
- Verifier file reads left alone on purpose (16)
- Test output via a log with the exit status printed (17)
- `<root>` named in the starting text; asides out of scope (18, 22)
- Card split is documentation only (20)
- Sizing command's excluded paths and scout diff (21)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Briefs still name role files | upheld | Decision 23 |
| intent | major | Validation still checks the dropped flags | upheld | Validation fixed |
| intent | major | Validation tests card.js reading Markdown | upheld | Validation fixed |
| intent | minor | Warning number ambiguous | upheld | `<n>` is tool_overhead |
| mechanics | blocking | Renames across docs/plans/ skew band and hide plan changes | upheld | Decision 24 |
| mechanics | major | New session without a sample suppresses the warning | upheld | Decision 25 |
| mechanics | major | Lookup failure on approval | upheld | Decision 25 |
| mechanics | major | Lead's first input is not the brief | upheld | Decision 25 |
| mechanics | major | Ledger can't hold the Codex id | upheld | Decision 26 |
| mechanics | minor | Warning copy overclaims | upheld | Copy relabelled as estimated |

### Round 3 — 2026-11-17

**Lanes:** intent: claude; mechanics: gpt; cross-family: yes.

**Changed since Round 2:**
- Briefs no longer name role files (23)
- Validation lines match Decisions 14 and 20
- Sizing on the filtered diff; rename ends listed (24)
- Warning: sample selection, lookup failure, first-message source, copy (25)
- Ledger Codex line and joins (26)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Scout wording could drop the Spec | upheld | Reworded: brief, Spec, report plus filtered diff |
| intent | minor | Overhead counts project instructions and skills | upheld | Decision 28 |
| intent | minor | Ledger's Codex cli_session_id wording | upheld | Reworded |
| intent | minor | Decision 3 not superseded | upheld | Decision 27 |
| intent | minor | Validation misses the round-2 items | upheld | Validation extended |
| intent | minor | Kept list incomplete | upheld | Decision 28 |
| mechanics | blocking | Overhead formula subtracts diagnostics records; 30 of 30 estimates negative | user-decision | Budget reached; the warning's measurement is a recurring objection, put to Collin |
| mechanics | blocking | Rename endpoints vs the path-limited listing | upheld | Decision 29 |
| mechanics | major | `session start` echoes the inlined prompt | upheld | Decision 30 |
| mechanics | major | Warning lookup can outlast the relay | upheld | Decision 31 |
| mechanics | major | Re-measure misses account directories | upheld | Decision 31 |
| mechanics | major | Sessions spanning a deploy lose `<root>` and lead card rules | upheld | Decision 31 |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
