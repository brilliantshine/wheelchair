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
| 32 | Supersedes 13, 25 (overhead part), 27 and 28 (overhead part): the warning compares the newest session's raw startup with the median of earlier sessions of the same role and project (+5,000, at least 5 earlier samples); no estimate of the parts | Three rounds of estimate formulas each broke; a comparison needs no arithmetic about the parts. Collin chose Keep going | review-round-3 |
| 33 | Supersedes 32's comparison: per role only, newest-3 median against the earlier-20 median, from the ledger; the machine reports `startup_growth` in its status | Session records vanish on archive; one long brief shouldn't trip it | review-round-4 |
| 34 | Sizing runs from the repository root; compact output keeps `branch` and `worktree`; Settings preview and the moved approval section follow the new behavior | Round 4 mechanics | review-round-4 |
| 35 | Startup lines carry role and project; comparison is per role and project | No join on reusable names; a heavier project's instructions are not blamed on Claude Code | review-round-5 |
| 36 | Growth comes from its own ledger-only route; ledger failures give `{}`; `scout_diff` quotes the path; the no-scout fallback is an explicit exception | Round 5 mechanics | review-round-5 |
| 37 | Supersedes 33's "per role only" (now per role and project, 35) and "in its status" (now its own route, 36); the route filters to the thread's project | Round 6 intent | review-round-6 |
| 38 | Starting text composed before the worktree is created; explicit rename detection; ledger appends best-effort | Round 6 mechanics | review-round-6 |
| 39 | Supersedes 25's lookup and 36/37's per-request route use: the hub refreshes a per-machine growth cache in its background poll; cards and the Ready check read only the cache; project key is the start input's `project_dir` | Removes every deadline from the card path; Collin chose Keep going | review-round-6 |
| 40 | Supersedes 31's 2-second deadline and 37's route-side project filter (the route returns all projects; the hub filters by `thread.project`) | Decision 39 | review-round-7 |
| 41 | Paths classified from `-z` output; growth refresh independent of the session poll; GPT re-measure per worker and verifier session via the ledger | Round 7 mechanics | review-round-7 |
| 42 | Excluded paths are structured `{status, old, new}` and read with literal pathspecs; refresh rejects on a cut-off body; press saves refreshed warnings | Round 8 mechanics | review-round-8 |
| 43 | Supersedes 26: no Codex ledger line; GPT is measured by first-message role, per session sums of `last_token_usage`, with per-session baseline recorded | Codex still gets the role in its first message; counts interrupted attempts | review-round-8 |
| 44 | Starting text opens with `Role: <role>`; GPT re-measure matches it and scans Codex account homes | Role paths no longer identify the session | review-round-9 |
| 45 | GPT measured by the last cumulative total per session (baseline recomputed); pinned approval card redraws when `ready` changes | Round 9 mechanics | review-round-9 |
| 12 | No GPT tool-schema trimming | Codex offers no supported way to drop its built-in tools; revisit if it adds one | defaulted |

## Spec

(grows as decisions land)

### Claude startup tools

- `machine/adapters/claude.js` `command()` adds `--disallowedTools` with: Artifact, Workflow, ScheduleWakeup, SendFeedback, ShareOnboardingGuide, ReportFindings, ListAgents, and the deferred-tool names that only reach interactive users (ArtifactComments, ArtifactData, CronCreate, CronDelete, CronList, RemoteTrigger, PushNotification, PublishPlugin, DesignSync, EnterWorktree, ExitWorktree, EnterPlanMode, ExitPlanMode, AskUserQuestion, EndConversation).
- Every tool not on the deny list stays, including Bash, Read, Edit, Write, Agent (the scout), Skill (project skills), ToolSearch, TaskStop, SendMessage, Monitor, WebFetch, WebSearch, NotebookEdit.
- The list lives in one constant beside `command()`, so adding a tool is a one-line change.
- Every role uses this list: lead, sub-lead, worker, reviewer, verifier, mapper. Asides and the usage probe keep their own argv.
- No `--strict-mcp-config` or `--disable-slash-commands`: measured savings were ~0.5k, and they would drop a target project's own MCP servers and skills.
- **Growth warning.** After a Claude session's first assistant message, the machine reads its `usage` (input + cache write + cache read) from the transcript as `startup_tokens`, stores it on the session, and appends `{at, name, role, project, startup_tokens}` to the session ledger, where `project` is the start input's `project_dir` (the hub sends `thread.project`, `viewer/app/sessions.js:315`), so hub and machine use the same key. The ledger is the sample source, because the machine deletes session records when a thread is archived (`machine/service.js:762`). Growth is found by comparison, per role and project, using only startup lines (no join): for each role and project, take the median of its newest 3 samples and the median of the up to 20 samples before those. When some role's newest median exceeds its earlier median by more than 5,000, a new hub-authorized route `GET /v1/startup-growth`, which reads only the ledger and runs no login checks, returns `{ "<project_dir>": {role, newest_median, earlier_median} }` with, per project, the role with the largest gap above 5,000; projects without one are left out. A role with fewer than 3 + 5 samples in a project is skipped. The window rolls: once a new level fills most of the earlier window (about 13 sessions of that role) the warning clears; an approval card's warning stays until a `recheck` or Start building press refreshes it from the cache. A missing, empty or unreadable ledger (a fresh install included) returns `{}` with status 200. `/v1/status` is unchanged.
- **Delivery without a deadline.** The refresh's promise rejects on a request error, a response-stream error (a body cut off mid-way) or the client timeout, and the in-flight mark clears in a `finally`, so the next eligible refresh always runs and the previous cached answer stays. For each machine the session poll (`viewer/app/sessions.js:693-699`) visits, the hub starts a `/v1/startup-growth` refresh at most once a minute, never awaited by the poll and with at most one in flight per machine, so a stalled refresh never delays session checks on any machine; with the machine client's normal timeout, and keeps the latest answer in memory per machine. A failed call keeps the previous answer. Nothing on the card or press path calls the machine for it: the Ready check (`viewer/app/ready.js` `check`) and the approval-card accept read the hub's cached copy for the thread's machine and `thread.project`, synchronously. A slow login check on the machine can delay the cache refresh, never a card. The Ready check turns a cached entry into one entry of a `warnings` array alongside `missing`; warnings never change `ok`. A Claude Code update that adds tools is a step change for every role, so it shows; ordinary role-file edits move a few hundred tokens and do not.
- **Where the warning shows.** When the hub accepts an `approval` card (`viewer/app/cards.js`, the add-card path), it stores `card.ready.warnings` from the hub's cached copy (none cached means `[]`); the lead's submitted `ok`/`missing` are kept as today. A `recheck` press replaces `card.ready` whole, warnings included. On `start-building`, `same()` keeps comparing `missing` only; the hub writes the fresh `warnings` onto the card and saves it (the thread page's pinned-card render signature, `viewer/pages/thread.js:849-850`, includes the card's `ready`, so an open tab redraws the warning on its next poll), whether or not the gate passes, and, if `ok`, starts the build on that same press. A warning that appears or clears never consumes the press. The approval card shows the warning text: "Claude <role> sessions now start about <n>k tokens bigger than before. A Claude Code update may have added tools; tell the lead." `<n>` is `newest_median − earlier_median`, in thousands. The Ready result stays Ready.
- Measured: interactive haiku session in this worktree, first-call context 47,869 tokens by default, 17,093 with the deny list (2026-11-17).

### Starting instructions carry the rules

- `composeRolePrompt` (`machine/service.js:127-132`) builds, in order: a first line `Role: <role>` (what re-measuring matches), a one-line header ("Your role rules and card rules are below, already loaded: do not read these files again unless this text is no longer in your context."), the full text of `protocol/app/<role>.md`, then the card files that role needs, each under a `--- <file name> ---` line, then the layers as today. `role_prompt` still wins.
- Card files per role: lead gets `cards.md` and `cards-lead.md`; sub-lead, worker and mapper get `cards.md`; reviewer and verifier get none.
- The header also states the clone: "`<root>` is `<absolute path of the machine's clone>`." Role files and `cards.md` stop deriving `<root>` from their own path and say "`<root>` is named in your starting instructions", so a session never resolves it to a feature worktree.
- Briefs stop naming role files. `lead.md` (mapper, reviewer, sub-lead and verifier briefs) and `sub-lead.md` (worker and verifier briefs) say instead: the session's role rules are already in its starting instructions, so a brief never tells it to read its role file. "Brief them from `reviewer.md`" style lines that tell the lead what to put in a brief stay; only the instruction to the started session changes.
- Sessions started before the change keep a pointer and read the files from disk. So the lead, sub-lead, worker and mapper role files keep a fallback line: "If your starting instructions only point you to this file, `<root>` is this file's path with `/protocol/app/<role>.md` dropped, and read `cards.md` (the lead also `cards-lead.md`) beside it." `reviewer.md` and `verifier.md` get only its `<root>` part.
- Settings' prompt preview (`viewer/app/settings.js:167-171`, shown at `viewer/pages/settings.js:657-659`) uses the same composition: the header, then one line per included file ("[full text of protocol/app/<role>.md]", and likewise each card file), then the layers.
- Asides are out of scope: `machine/lib/aside-turns.js` keeps its own pointer prompt.
- The files are read from the machine's clone when the session starts. A session keeps the text it started with; a later edit reaches the next session.
- Role files lose their "Read `cards.md`, beside this file, first" lines; cross-references ("see the `diagram` section of `cards-lead.md`") stay, and resolve inside the starting text.
- Claude carries it in `--append-system-prompt`, Codex and Antigravity in the first `[wc:role]` message, exactly as the pointer travels today.
- The 12,000-character cap at `viewer/app/settings.js:177` stays on the layers only.

### The card rules split

- `cards.md` keeps: Posting a card, Which kinds exist (the full table, so everyone knows what exists), `progress`, `message`, `result`, What reaches a session and the markers, and The commands.
- `cards-lead.md` gets every other kind section (offer, idea, question, approval, needs, resolve, done, merged, diagram, image, stub, sudo, retract, title), moved verbatim.
- The moved `approval` section is updated to the new behavior: a change in warnings alone never consumes the Start building press; only a change in `missing` does.
- The split is documentation only. `card.js` keeps its JavaScript schema (`viewer/app/card.js:24-41,145-191`) unchanged, so exactly the same cards are accepted. `protocol-rules.test.js` checks that every kind in the schema has exactly one section across the two files.
- `protocol/app/AGENTS.md` lists both files and who gets each, and says reviewer and verifier get neither.

### Sizing worker changes

- New: `node <root>/viewer/app/wc.js diff size <feature-branch> <worker-branch> [--tricky]`. It resolves the repository root (`git rev-parse --show-toplevel`) and runs everything there, whatever the caller's directory: `git -C <top> diff --numstat <feature>...<worker> -- . ':(exclude)docs/plans'` locally (read-only), the same filtered diff the scout reads, sums added and removed lines, lists `excluded_paths` from the unfiltered `git diff --name-status -z --find-renames <feature>...<worker>` (explicit renames whatever `diff.renames` says; `-z` so paths are raw, never quoted, and are classified before any formatting): every entry with an endpoint under `docs/plans/`, giving each as `{status, old, new}` (`old` null unless renamed or copied), so no path is ever joined into a string, and prints one JSON line: `{"lines": N, "band": "scout" | "bigger-scout" | "self", "excluded_paths": [{"status", "old", "new"}, ...], "scout_diff": "git -C <shell-quoted top> diff <feature>...<worker> -- . ':(exclude)docs/plans'"}`. Under 200 is `scout`, 200–800 `bigger-scout`, over 800 or `--tricky` `self`. Binary files count 0.
- `sub-lead.md` step 1 replaces its sizing prose: run the command for every worker result; the band is binding; the no-scout fallback stays as written. The acceptance Log line names the band: `- <date> — T<n> accepted (band: scout): ...`. A `self` read of a `scout` or `bigger-scout` band is not allowed, except under the no-scout fallback (no scout model for that band or above, as `sub-lead.md` already says). The scout (or the sub-lead, for `self`) gets, as today, the brief, the Spec and the worker's report, plus the diff from the `scout_diff` command, which leaves out changes under `docs/plans/`. Each excluded path must be the worker's own `docs/plans/<slug>/reports/<task>.md`, which step 2 already reads; a rename into or out of `docs/plans/` and any other excluded path is read by the sub-lead itself (`git -C <top> --literal-pathspecs diff <feature>...<worker> -- <path>` for each endpoint, shell-quoted, so wildcard characters are never pathspec syntax) and, being outside a worker's ownership, is normally sent back.

### Shorter output and fewer calls

- `wc.js session start` prints the same compact view of the started session (plus `note` and any waiting line), with `branch` and `worktree` kept, never `command`, so the inlined starting text is not echoed into the starter's context. `--full` prints today's output.
- `wc.js session list` default prints, per session: name, role, provider, model, status, live, ready, started_by, attempt_id, title, branch, worktree; plus `review_families`. `--full` prints the raw response. Nothing in the app parses `wc.js` stdout today; the lead and sub-lead rules that read `review_families` and the lead's provider still work.
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

- A role file or card file missing at start: the start fails with the reason. The machine loads and composes the starting text before `git worktree add`, so a failed start leaves no branch or worktree behind and a retry works.
- A Claude Code release that renames a denied tool: the deny entry is ignored by the CLI; startup grows and the warning fires.
- A diff where every path is under `docs/plans/`: `lines` 0, band `scout`.

### Validation

- `bash machine/test/run.sh` (Claude argv carries the deny list and neither `--strict-mcp-config` nor `--disable-slash-commands`; composed prompt holds role text and the right card files per role; `startup_tokens` recorded from a fixture transcript and its ledger startup line written; the ledger start line carries `account_dir`; `/v1/startup-growth` has an entry for a project when a role's newest-3 median exceeds its earlier median by more than 5,000, none at 5,000 or below or below 8 samples, computed per project (a heavier project does not trip another's), and still computed after the sessions are archived; a missing role or card file fails the start and leaves no branch or worktree; a ledger append error does not fail a start, hook or report; `wc.js diff size` lists both rename ends with `diff.renames=false`).
- `node --test viewer/test/*.test.js` (Ready check turns the cached entry for the thread's machine and `thread.project` into a warning and gives none without one; the cache is keyed by machine and an entry for another project is ignored; `wc.js diff size` lists both ends of a rename across `docs/plans/`; `session start` default output is compact and has no `command`; the approval card and the Ready check's warning part read only the hub's cache and never call `/v1/startup-growth` (the Ready gate's existing `/v1/status` and `/v1/preflight` calls stay); a stalled growth refresh leaves the session poll running; the background refresh runs at most once a minute and keeps the last answer on failure; approval card gets `warnings: []` with nothing cached; Start building not consumed by a warning-only change; an open thread page redraws the pinned approval card when only its warnings change; `wc.js diff size` bands and the `docs/plans/` exclusion on a temp repo; compact and `--full` list; every schema kind has exactly one section across `cards.md` and `cards-lead.md`; `card.js` accepts the same cards as before; `wc.js diff size` run from a subdirectory sizes the whole repository, and its `scout_diff` runs unchanged from a nested directory of a worktree whose path contains spaces; `/v1/startup-growth` returns `{}` with no ledger and filters nothing it shouldn't (one entry per project with growth); `/v1/status` is unaffected by a broken ledger; a sub-lead with no scout may read a `scout`-band diff itself; compact `session start` and `session list` keep `branch` and `worktree`; Settings preview shows the header and file lines; the moved approval section says a warning-only change does not consume the press; `protocol-rules.test.js` updated).
- `npm --prefix viewer run test:browser` (approval card shows the warning).
- Live: after install, start a Claude lead (a test thread) and a Claude worker on this machine; both record `startup_tokens`, the worker's at least 25,000 below today's comparable worker sessions, and the lead's composed instructions hold lead.md, cards.md and cards-lead.md.
- Re-measure after a few threads with the baseline method above, taking each Claude session's role from the session ledger (joined on `cli_session_id` = transcript file name), and reporting the same metrics: cost share by role, average context per call, calls per session. For GPT, role comes from the `Role: <role>` line at the start of the first `[wc:role]` message (or, for sessions started before the change, the first `protocol/app/<role>.md` it names), so no join is needed and interrupted attempts are counted; scan `~/.codex/sessions` and each Codex `account_dir`'s `sessions/`; per session, take the last `token_count` event's cumulative `total_token_usage.input_tokens` (repeated snapshots are not summed); report the mean per worker session and per verifier session against the baseline above.

### Measured baseline (2026-11-17)

- Claude, sessions since 2026-11-17 00:00, cost-weighted (cache read 0.1×, cache write 1.25×, output 5×): lead 52%, sub-lead 44%, verifier 4%. Average context per call: lead 102k, sub-lead 149k. Cache reads are about two-thirds of cost, so cost tracks calls × context.
- GPT, sessions since 2026-11-10 (last cumulative `total_token_usage.input_tokens` per session, sessions started 2026-11-10 to 2026-11-17 21:00, role from the first message naming `protocol/app/<role>.md`): verifier 105.6M over 89 sessions (1.19M per session), worker 163.2M over 117 (1.39M per session), reviewer 36.8M over 98; 84–97% cached.
- Method: Claude transcripts under `~/.claude/projects/*wheelchair-worktrees*`, role from the first user message or the first tool call naming `protocol/app/<role>.md`; Codex from `~/.codex/sessions` `token_count` events. After this change the role no longer appears in a Claude transcript, so re-measuring takes it from the session ledger below.

### Session ledger

- When the machine starts a session it appends one JSON line to `<stateDir>/session-ledger.jsonl`: `{at, name, role, provider, model, account_dir, cli_session_id, thread_id}`. Re-measuring scans each `account_dir`'s transcript home as well as the default one. Append-only, never pruned by the service; `cli_session_id` matches the Claude transcript file name, and for Codex it is the machine's own UUID and is not a join key.
- Ledger appends are best-effort: an append error is logged by the machine and swallowed, never failing a session start, a hook or a report delivery.
- The machine reads it for the growth warning; it is also the role source for re-measuring.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| The growth warning clears by itself after about 13 sessions of a role at the new level | It flags a recent change; by then it has shown on approval cards or been seen in Ready checks | 4 |

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
| mechanics | blocking | Overhead formula subtracts diagnostics records; 30 of 30 estimates negative | upheld | Budget reached; Collin chose Keep going; replaced the estimate with a comparison (Decision 32) |
| mechanics | blocking | Rename endpoints vs the path-limited listing | upheld | Decision 29 |
| mechanics | major | `session start` echoes the inlined prompt | upheld | Decision 30 |
| mechanics | major | Warning lookup can outlast the relay | upheld | Decision 31 |
| mechanics | major | Re-measure misses account directories | upheld | Decision 31 |
| mechanics | major | Sessions spanning a deploy lose `<root>` and lead card rules | upheld | Decision 31 |

### Round 4 — 2026-11-17

**Lanes:** intent: claude; mechanics: gpt; cross-family: yes.

**Changed since Round 3:** budget reset after Collin chose Keep going.
- Startup warning is now a comparison with earlier sessions of the same role and project (32)
- Excluded paths and renames in the sizing command (29)
- `session start` compact output (30)
- Warning lookup deadline, ledger account_dir and startup line, pointer fallback in role files (31)
- Round 3 intent wording fixes (scout inputs, ledger Codex id, kept tools, validation)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Warning samples have no durable source once threads archive | upheld | Decision 33 |
| intent | minor | One long brief can trip the warning | upheld | Decision 33 |
| intent | minor | Fallback line would send reviewer/verifier to card rules | upheld | Only `<root>` part for them |
| intent | minor | Validation misses round-3 changes | upheld | Validation extended |
| mechanics | blocking | Sizing depends on the caller's directory | upheld | Decision 34 |
| mechanics | major | No durable project-keyed samples | upheld | Already fixed by Decision 33 (ledger, per role) |
| mechanics | major | Rolling median absorbs a permanent increase | accepted-risk | Newest-3 vs earlier-20 still fires on the reviewer's case (5 old + 6 new gives gap 6,000); clears after ~13 sessions, accepted |
| mechanics | major | Compact output drops `branch` | upheld | Decision 34 |
| mechanics | minor | Settings preview keeps the pointer | upheld | Decision 34 |
| mechanics | minor | Moved approval text contradicts warning-only behavior | upheld | Decision 34 |

### Round 5 — 2026-11-17

**Lanes:** intent: claude; mechanics: gpt; cross-family: yes.

**Changed since Round 4:**
- Growth warning per role from the ledger, reported in machine status (33); rolling-window risk accepted
- Sizing from the repository root; compact output keeps `branch` and `worktree`; Settings preview; moved approval section (34)
- Fallback line scope for reviewer and verifier; validation extended

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Pooling across projects blames project instructions on Claude Code | upheld | Decision 35 |
| intent | minor | Name join is fragile | upheld | Decision 35 |
| intent | minor | Validation misses Decision 34 | upheld | Validation extended |
| mechanics | blocking | No-scout fallback contradicts the self-read ban | upheld | Decision 36 |
| mechanics | major | Status endpoint runs slow login checks | upheld | Decision 36: own route |
| mechanics | major | Ledger failure could fail the status call | upheld | Decision 36 |
| mechanics | major | `<top>` unquoted in `scout_diff` | upheld | Decision 36 |

### Round 6 — 2026-11-17

**Lanes:** intent: claude; mechanics: gpt; cross-family: yes.

**Changed since Round 5:**
- Startup lines carry role and project; comparison per role and project (35)
- Growth served by a ledger-only route; ledger failures give `{}`; quoted `scout_diff`; no-scout exception (36)
- Validation extended for 34–36

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Warning may describe another project | upheld | Decision 37 |
| intent | minor | Decision 33 not marked superseded | upheld | Decision 37 |
| mechanics | blocking | Ledger route still blocked by synchronous login checks on the same event loop | upheld | Budget reached; Collin chose Keep going; background cache, no machine call on the card path (Decision 39) |
| mechanics | blocking | Missing rule file leaves a worktree behind | upheld | Decision 38 |
| mechanics | major | Rename detection depends on git config | upheld | Decision 38 |
| mechanics | major | Ledger append failures could break lifecycles | upheld | Decision 38 |

### Round 7 — 2026-11-17

**Lanes:** intent: claude; mechanics: gpt; cross-family: yes.

**Changed since Round 6:** budget reset after Collin chose Keep going.
- Growth warning delivered through a hub-side cache refreshed in the background poll; route returns all projects; project key is `project_dir` (39)
- Starting text composed before the worktree; explicit rename detection; best-effort ledger appends (38)
- Decision 33 superseded parts marked (37)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Decisions 31 and 37 not marked superseded | upheld | Decision 40 |
| intent | minor | Validation names the retired `startup_growth` status field | upheld | Validation reworded |
| intent | minor | Card warning: kept vs refreshed | upheld | Stays until a recheck or press refreshes it |
| intent | minor | Validation misses Decisions 38 and 39 | upheld | Validation extended |
| mechanics | major | Validation's zero-call assertion would break the Ready gate | upheld | Scoped to `/v1/startup-growth` |
| mechanics | blocking | Quoted paths escape the `docs/plans/` prefix check | upheld | Decision 41 |
| mechanics | minor | Awaited refresh delays the session poll | upheld | Decision 41 |
| mechanics | minor | GPT re-measure not specified | upheld | Decision 41 |

### Round 8 — 2026-11-17

**Lanes:** intent: claude; mechanics: gpt; cross-family: yes.

**Changed since Round 7:**
- Superseded decisions marked; validation wording and coverage (40)
- `-z` path classification; independent growth refresh; GPT re-measure (41)
- Card warning refresh wording

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | — | No findings | — | — |
| mechanics | blocking | `old -> new` strings and glob pathspecs let an excluded change escape | upheld | Decision 42 |
| mechanics | major | Refresh can stay in flight on a cut-off body | upheld | Decision 42 |
| mechanics | major | GPT baseline lacks per-session numbers and aggregation | upheld | Decision 43; baseline recorded |
| mechanics | major | Codex join misses interrupted attempts | upheld | Decision 43: no join needed |
| mechanics | minor | Press doesn't save refreshed warnings when the gate fails | upheld | Decision 42 |

### Round 9 — 2026-11-17

**Lanes:** intent: claude; mechanics: gpt; cross-family: yes.

**Changed since Round 8:**
- Structured excluded paths and literal pathspecs; refresh rejection; press saves warnings (42)
- GPT measured from the first message; Codex ledger line removed; per-session baseline (43)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | GPT role can't be read from the new first message | upheld | Decision 44 |
| intent | minor | Codex account homes left out of re-measure | upheld | Decision 44 |
| intent | minor | Duplicate ledger validation line | upheld | Merged |
| mechanics | blocking | Summing Codex snapshots double-counts | upheld | Decision 45; baseline recomputed (differences under 0.1%) |
| mechanics | major | Open tab keeps a stale warning | upheld | Decision 45 |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
