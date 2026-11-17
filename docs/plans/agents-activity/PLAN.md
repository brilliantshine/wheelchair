---
slug: agents-activity
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Agents screen: live activity, context ring, question path

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None open.

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
| 8 | Question path is explicit: an asking `message` carries `asks: true`; an agent passing a question up names it with `passes_on: <message id>`; the lead's `question` card may carry `passes_on` too. The hub follows the chain; no guessing from `waiting_on` | A guessed path can send Collin to the wrong agent | user |
| 9 | Step labels come from the CLI's own description or a short action plus target; no model call summarises output | Told Collin in the thread; a model call per step costs more than it shows | defaulted |
| 10 | Steps live on the session record (last 30) and in a per-project history file pruned to 30 days, not in a new store | Thread files are already rewritten on every event; history needs to outlive sessions | defaulted |
| 11 | Context for Claude is posted at most every 15 seconds, separate from the once-a-minute rate-limit throttle | Live enough for a ring, cheap | defaulted |
| 12 | Codex steps follow an operation until it finishes (cell `wait` and process `write_stdin` polls end the original step), and a script is one step; supersedes Decision 3 | Review round 1: a tool response is not completion, and script source shows possible, not executed, calls | review-round-1 |
| 13 | A still-running Codex command stays the current step until the agent starts something new or the turn ends; check-backs never start steps; only clearly finished steps feed "is this normal?". Supersedes Decision 12's poll-tracking rules (one step per script stays) | Three review rounds kept finding finer cases in exact tracking; right in the common case, and wrong guesses stay out of the timings | user |

## Spec

Read IDEA.md and MAP.md first. The screen this extends is mapped in
`docs/maps/app-agents-screen.md`; the design is
`docs/proposals/app-shell/design/AgentsActivity.dc.html` (side panel),
`AgentsNowOptions.dc.html` option A ("now" motion) and `AgentsTree.dc.html` (amber path and
the waiting agent's panel). Match their layout, wording and colours; where this Spec and a
design disagree, this Spec wins.

### 1. Steps: what one is

A **step** is one tool call by one session:

```
{ id, kind, label, key, started_at, ended_at|null, failed: true|false|null, clean: true|false|null }
```

- `id`: the CLI's own call id (`tool_use_id` for Claude, the starting call's `call_id` for Codex).
- `kind`: `files`, `shell`, `helpers`, `web` or `starter`. (`thinking` is never stored; see 4.)
- `label`: plain words for the Latest list, at most 80 characters, cut with "…".
- `key`: the matching key for "is this normal?" (section 5).
- `ended_at`, `failed` and `clean` null while running. `clean` is true when the CLI itself
  reported the end, false when the step was closed by something else (section 2, section 4).

Classification (first match wins):

| kind | Claude Code tool names | Codex tool names |
|---|---|---|
| starter | `Bash` whose command runs `card.js message` or `card.js result` | `exec_command` / `shell` whose command runs `card.js message` or `card.js result` |
| helpers | `Agent`, `Task` | `spawn_agent`, `send_input`, `wait_agent`, `close_agent` |
| web | `WebFetch`, `WebSearch` | `web_search`, `web_fetch` |
| files | `Read`, `Write`, `Edit`, `MultiEdit`, `Glob`, `Grep`, `NotebookEdit`, `LS` | `apply_patch`, `view_image`, and any name containing `file` |
| shell | everything else, including `Bash`, MCP tools and unknown names | everything else, including `exec_command`, `shell`, `write_stdin` |

Labels:

| Case | Label |
|---|---|
| Claude `Bash` with `tool_input.description` | that description |
| any shell step otherwise | "Ran " + the command's first line, after dropping a leading `cd <dir> &&` |
| Read / view_image | "Read " + file basename |
| Write, Edit, MultiEdit, NotebookEdit, apply_patch | "Edited " + basename (apply_patch: first file in the patch; "Edited N files" when several) |
| Glob, Grep, LS | "Searched " + the pattern or path |
| helpers | "Asked a helper: " + `description` or the first line of the prompt |
| web | "Searched the web: " + query, or "Read " + URL host |
| starter | "Messaged <recipient>" or "Reported back" |
| failed step | "Failed: " + the label above |

No model call is made to write a label (Decision 9).

### 2. Where steps come from

**Claude Code (machine).** `machine/adapters/claude.js` adds `PreToolUse`,
`PostToolUse` and `PostToolUseFailure` to the per-session settings hooks, each with
matcher `*` and the same `machine/hook.sh claude <session>` command as the existing hooks,
plus `"async": true` so the hook never delays a tool call (confirm the installed `claude`
honours `async`; if it does not, register them synchronously with `"timeout": 5`). `hookEvent`
maps:

- `PreToolUse` → `{type:'step', phase:'start', step:{id, kind, label, key, started_at: now}}`
- `PostToolUse` → `{type:'step', phase:'end', step:{id, ended_at: now, failed:false}}`
- `PostToolUseFailure` → same with `failed: true` (an `is_interrupt` failure also counts as failed)

"now" is the hook process's receipt time (ISO). Classification and labels happen here so
raw tool input never leaves the machine.

**Codex (machine).** A new timer in `machine/service.js`, every 2 seconds, reads each live
Codex session's rollout from a new `steps_offset` (kept beside `usage_offset`, persisted in
`sessions.json` the same way), complete lines only, using the rollout path the adapter
already finds once `codex_thread_id` is bound. The timer skips sessions whose thread is not
bound yet; the first turn's steps therefore arrive when that turn ends and binding happens
(Accepted Risk 1). For each line:

A Codex step is one **operation**. Codex often answers a slow call with "still running"
and the agent then checks back. The rule (Decision 13) is: a still-running operation stays
the current step **until the agent moves on**.

- **Polls.** A `wait` call, a `write_stdin` call, or an `exec` script whose source calls only
  `tools.wait` / `tools.write_stdin` is a check-back (poll). A poll never starts a step.
- **Start.** Any other `response_item` `custom_tool_call` / `function_call` starts a step: id
  `call_id`, `started_at` = the line's `timestamp`.
- **Finished in its own output.** If the matching `..._output` (same `call_id`) shows the
  operation complete, the step ends there, `clean: true`. Complete means: no
  `Script running with cell ID` line, and no command result carrying a `session_id` without
  an `exit_code`.
- **Yielded.** Otherwise the step is **yielded** and stays running. At most one step is
  yielded at a time, because:
  - when the next non-poll operation starts, a yielded step ends at that start's
    `timestamp`, `clean: false` (it may still be running in the background; Accepted Risk 4);
  - when a poll's output shows a finish (`Script completed` or a script error from a `wait`,
    or any command result with an `exit_code`), the yielded step ends at that line's
    `timestamp`, `clean: true`;
  - turn end closes it like any running step (section 4), `clean: false`.
- **Failed** is true when the finishing output shows a script error, a non-zero `exit_code`
  or a tool error; null when the step ended `clean: false`.
- End events carry `clean`. Claude ends from `PostToolUse` / `PostToolUseFailure` are
  `clean: true`.
- **One step per script.** The script's source is not split into nested steps (it shows
  possible calls, not executed ones). Its kind and label come from the first `tools.<name>(`
  call in its source (classified per section 1). Its target text is the call's argument when that is a string
  literal; when it is an object literal, the string-literal value of the first of these keys
  present: `cmd`, `command`, `path`, `file_path`, `query`, `url`, `prompt`, `message`; for
  `apply_patch`, the first `*** ... File: <path>` line. No such literal: no target, label
  "Ran a script"; with
  two or more distinct calls in the source the label gets " and more"; with none it is a
  `shell` step "Ran a script".
- Build and test this against real rollouts from `~/.codex/sessions/**` on this machine,
  copied as fixtures into `machine/test/`: a script that completes at once; one that yields
  and is finished by `wait`; a command that yields and is finished by a wrapped
  `write_stdin` (`rollout-2026-11-17T04-53-49-01a1e992-...jsonl` lines 73–89); a poll chain
  ending in `exit_code` 1 (`rollout-2026-11-15T23-51-57-01a1e357-...jsonl` lines 191–212);
  and a yielded step cut short by a new operation.
- `event_msg` `token_count` with `info.model_context_window` → a context event (section 3).

The existing turn-end usage scan is unchanged.

**Transport.** Step and context events go through the existing path unchanged in shape:
`hook()` / `emitEvent` → event spool → drain → hub `POST /api/machine/events`, each with its
own `delivery_id`. `hook()` adds `session` and `thread_id` as it does today and passes
`step` / `context` through.

**Codex turn end.** When the machine receives a Codex turn-complete notify, it first runs
the rollout reader for that session to the end of the file and emits those step events,
then emits `turn-ended`, so a turn's last steps never arrive after its end. Every step
event carries the CLI-side times above, and the hub works from those times, not from
arrival order (section 4).

### 3. Context fill

- **Claude:** `machine/lib/statusline.js` today posts only when `rate_limits` is present.
  It also posts when `context_window.used_percentage` is a number, with its own stamp file
  (`<state>/statusline/<session>.context`) and a 15-second throttle; the rate-limit throttle
  is unchanged. The adapter turns it into `{type:'context', context:{percent, at}}`.
  `hookEvent` may need to return both a usage and a context event for one payload: let it
  return an array, and `hook-post.js` post each.
- **Codex:** from each `token_count` line, `percent = round(100 * last_token_usage.total_tokens / model_context_window)`.
- **Hub:** sets `session.context = {percent, at}` (newer `at` wins). Null until the first
  reading.

### 4. Hub storage and the Agents API

`viewer/app/sessions.js` `event()` handles `step` and `context`:

- `session.steps`: every running step, plus the last 30 finished steps, ordered by
  `started_at`. A finished step beyond 30 is dropped oldest first; a running step is never
  dropped for space. More than 50 running steps: the oldest are closed (`ended_at` = now,
  `failed: null`).
- **Order does not matter** (Claude hooks are async and can arrive out of order). A start
  adds a step; a repeat start for a known id is ignored. An end for an unknown id is kept
  in `session.pending_ends` (by id, at most 50, dropped after 10 minutes); a start that
  finds its id there is stored already finished.
- **A real end beats a closure.** An end event from the CLI for a step the hub already
  closed itself (`clean: false`, e.g. Stop arrived before `PostToolUse`) upgrades it:
  `ended_at`, `failed` and `clean: true` come from the event. A step is added to history at
  the moment it first becomes `clean: true`, so exactly once whatever the arrival order; a
  second clean end for the same id is ignored. If the closed step was already dropped for
  space, its late end is handled as an end with no start (kept in `pending_ends`, then
  expires) and adds no history sample.
- **Turn boundaries.** The hub keeps `session.turns`: the last 20 `{started_at, ended_at}`
  (appended when a turn starts, `ended_at` filled when it ends). A start whose `started_at`
  falls inside an ended turn is stored finished at **that** turn's `ended_at`, `failed:
  null`, unless its end is already known. A start for a session that is no longer live or
  has `ended_at` is stored finished at the earlier of its own turn's end and the session's
  `ended_at`. A start older than every kept turn is stored finished at its own `started_at`
  and kept out of history.
- `session.step_counts`: `{files, shell, helpers, web, starter, thinking}`, counts over the
  session's life, incremented on start (thinking: see below).
- When a step ends with `clean: true`, append `{kind, key, ms, at}` to a per-project history
  file (steps the hub closes itself, at turn end, session stop or the running cap, are
  `clean: false` and never enter history):
  `<state>/step-history/<project key>.jsonl`, where the project key is the thread
  project path's basename, a hyphen, and the first 8 hex characters of the SHA-256 of its
  absolute path (`thread.project`, the value `agents.js` takes the basename of), so two
  projects with the same folder name never share history. On hub start and once a day, rewrite each
  file without rows older than 30 days.
- When a turn ends, every running step with `started_at` before the turn end is closed with
  `ended_at` = turn end and `failed: null` (shown as done).
- When a session stops, fails or disappears (the existing handlers that set `live=false`
  or `ended_at`, `viewer/app/sessions.js` ~571 and ~630), every running step is closed the
  same way at that time, and `current` is null from then on.

**Thinking.** A session is thinking when it is live, its turn is running (the existing
`turn_started_at` is later than `turn_ended_at`) and no step is running. It begins at the
latest step `ended_at` in this turn, or the turn start. Each gap of 5 seconds or more adds 1
to `step_counts.thinking` when the next step starts or the turn ends.

`viewer/app/agents.js` adds to each node:

- `context` (passthrough).
- `activity`: `{counts, trail, current, latest, normal}`:
  - `counts`: `step_counts`.
  - `trail`: kinds of the last five steps, oldest first, consecutive repeats collapsed.
  - `current`: `{kind, label, since, id}`: the most recently started running step (several
    run at once when Claude calls tools in parallel; the others still count and show in
    Latest); when it ends, the next most recent running step. Else thinking (label
    "Thinking", no id). Else null when the session is not live or its turn is not running.
    `since` is that step's `started_at`; "now · m:ss" and `normal` use this step.
  - `latest`: the last four steps, newest first: `{label, at: started_at, state: 'running'|'done'|'failed'}`.
  - `normal`: see section 5.
- `question`: see section 6.

Each lead gains `question_paths`: an array of session-name arrays, each from the asking
agent up to the lead, for every open lead `question` card that has `passes_on`.

Sessions with no steps get `activity` with zero counts and empty lists; the panel shows the
map with no lines, and Latest says "Nothing yet."

### 5. "Is this normal?"

`key` = `<kind>:<target key>`. Target key: for shell, the command's first two words after
dropping a leading `cd <dir> &&` (`npm test`, `node --test`); for files, the verb plus the
file's directory; for helpers and web, the kind alone; for starter, `starter`.

For the `current` step, look up the last five finished rows with the same `key` in the
project's history (ignoring this session's running step). `normal` is
`{samples: [ms...], typical_ms: median}` or null with no rows. The page writes the line:

| Situation | Line |
|---|---|
| not working, not waiting | no line |
| waiting on a question | the question trail instead (section 6) |
| current, no samples | "Busy for 1m 05s. Nothing earlier to compare it with." |
| elapsed ≤ 1.5 × typical | "Quiet for 2m 14s. That's expected." then "It's <label, lower-cased first letter>, which took about <typical, rounded> the last <n> times." |
| elapsed > 1.5 × typical | "Quiet for 6m 40s. Longer than usual." then the same second sentence, in amber |

"the last two times" for n = 2; "last time" for n = 1. Durations: "45s", "2m 14s", "about 3 minutes" for typical.

### 6. Question path

Card fields (`viewer/app/card.js` `fields`, and `protocol/app/cards.md`):

- `message` gains optional `asks` (boolean) and `passes_on` (string, a question id).
- `question` gains optional `passes_on`.

Hub (`viewer/app/cards.js`):

- A `message` with `asks: true` is a **question**; its card id is the question id. The
  delivered text becomes `[wc:from <sender>] [question <id>] <text>` (the `[wc:from`
  prefix stays first, so hiding is unchanged).
- `passes_on` must name a `message` card with `asks: true` in the same thread, else 422
  `passes_on names no question in this thread`.
- A question's path is followed backward through `passes_on` links to the message with no
  `passes_on`; the path is that chain's senders, then the final card's author. Loops stop at
  the first repeat.

Protocol text (short additions, in each file's own voice):

- `worker.md` (after its question rule, ~line 43): a message that needs an answer is sent with
  `asks: true`.
- `sub-lead.md` (its own questions to the lead, ~line 125): sent with `asks: true`. If a
  question ever reaches it from below and it passes it on, it adds `passes_on: <the id from
  the [question <id>] tag>`.
- `lead.md` (Build section, step 7 items 3–4): a `question` card that passes on a sub-lead's
  or worker's question carries `passes_on`. `cards.md` documents the fields and the tag.

Routing does not change: workers still ask the lead directly (`worker.md:39`,
`sub-lead.md:124`), so a path may skip the sub-lead. A path is the agents that actually
handled the question, not the tree route.

API per node, `question`: when this session's latest `asks` message is not yet answered
(no later message or result back from its recipient to it, and no `passes_on` card from the
lead that is answered or retracted), `{asked_at, to, trail:[{who, at, text}], card_id|null}`:
one entry per hop, `text` the first line of each message (80 chars); `card_id` is the lead's
open question card when the chain reached Collin.

### 7. Screen (`viewer/pages/agents.js`, `views.css`)

Side panel, below today's details and in this order, as in `AgentsActivity.dc.html`:

1. **Normal line** (section 5), or for a waiting agent the **question trail** as in
   `AgentsTree.dc.html`: "Asked <recipient's role or lead name> at 19:58", then each hop ("The sub-lead passed
   it to Beta: <its text>"), then "Beta is asking you in the thread" with **Go to the
   question** linking to the thread page at that card.
2. **Activity map** (inline SVG): the agent in the middle; six spots at equal distance —
   Files, Shell, Thinking, Helpers, Web, and the starter labelled by its role ("Sub-lead",
   "Lead"); a lead's starter spot is labelled "You". Line width from the spot's count
   (1px at 0 to 6px at the busiest spot), count under spots with 5 or more. A dotted path
   through the `trail`. The current spot's line has short dashes drifting toward it
   (CSS `stroke-dashoffset` animation, slow) and "now · m:ss" under the spot, ticking every
   second locally from `current.since`. Under `@media (prefers-reduced-motion: reduce)` the
   dashes are drawn still; the timer still ticks.
3. **Context ring** round the middle: arc = percent; neutral colour, `--warn` from 70,
   red from 90; grey and empty when `context` is null. Hover/title: "Memory 62% full".
   Small key under the map as in the design.
4. **Latest**: four rows, time (HH:MM, local), ● running / ✓ done / ✕ failed, label.

Tree (`AgentsTree.dc.html`): for each path in the lead's `question_paths`, the boxes of the
agents on the path get a `--warn` left edge, and the tree connectors from the asking agent up
to the lead are drawn in `--warn`. When the path skips an agent (a worker asked the lead
directly), the connectors through the skipped agent are still amber, since they are the only
line between the two, but the skipped agent's box keeps its normal edge. A legend item "Where a question went" appears only when a path is drawn.

### 8. Boundaries and non-goals

- No change to the layout, terminal, sidebar or polling interval (5 s).
- Raw tool input and output never reach the hub; only kind, label, key and times.
- No Gemini support; a Gemini session shows the empty activity map and a grey ring.
- No step data for sessions started before this ships.
- Routers and contracts updated with the code: `machine/API.md`, `machine/AGENTS.md`,
  `viewer/app/API.md`, `viewer/AGENTS.md`, `protocol/app/cards.md`.

### 9. Validation

```bash
bash machine/test/run.sh                 # hooks settings (update the deepEqual at service.test.js:970), Pre/Post/Failure mapping, statusline context + throttle, Codex rollout tail from real fixtures incl. exec nesting and a failed call
node --test viewer/test/*.test.js        # app-agents.test.js: steps/end/turn-end close, thinking counts, normal lookup and 30-day prune, question ids, passes_on refusal, question_paths; card.js field checks
npm --prefix viewer run test:browser     # app-views.spec.js: panel map, Latest, normal line, ring colours, amber path, and reduced motion (page.emulateMedia) leaves the dashes still
bash install/test/run.sh
```

Plus one live check on this machine (not from a worktree's own server; use `--port` and
`--cache-root` per the root AGENTS.md): a Claude and a Codex session each run a few
commands; each step shows on the Agents screen within 10 seconds of the call (2 s Codex
scan + 5 s page poll + delivery), and the context ring within 25 seconds (15 s Claude
throttle + 5 s page poll + delivery).

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| 1. A Codex session's first turn shows its steps only when that turn ends | The rollout is found only once the first turn-complete binds the thread; binding earlier means guessing which rollout is ours | planning |
| 2. Claude tool calls that the CLI rejects before running, or that are cancelled, may show as running until the turn ends | The CLI fires no end hook for them; turn end closes them | planning |
| 3. A Claude `Bash` call with `run_in_background: true` shows as done when it returns, and its later output checks show as separate shell steps | The CLI reports no end for the background process; agents here are told to wait in the foreground | review-round-1 |
| 4. A Codex command left running in the background while the agent starts something else shows as finished at that moment | Collin chose this simpler rule over exact tracking; such steps stay out of the timing history | user |

## Review Rounds

### Round 1 — 2026-11-17

**Lanes:** intent: gpt; mechanics: gpt (Claude unavailable at start); cross-family: no.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Codex "Script running" / yielded commands closed as done; durations wrong | upheld | Spec §2 Codex now follows cells and process sessions to completion (Decision 12) |
| intent | blocking | Nested steps parsed from script source are possible, not executed, calls | upheld | One step per script, kind/label from its first call (Decision 12) |
| mechanics | blocking | Async Claude hooks can arrive out of order; end-before-start dropped, start-after-Stop runs forever | upheld | §4: pending ends, time-based turn attribution |
| mechanics | blocking | Codex output is not completion (same as intent finding) | upheld | Decision 12, §2 |
| mechanics | major | Codex tailer can deliver a turn's last steps after turn end | upheld | §2 Codex turn end: flush before emitting turn-ended |
| mechanics | blocking | Stopped or crashed sessions keep running steps forever | upheld | §4: close on stop/fail/disappear; current null when not live |
| mechanics | major | `current` undefined with several running steps | upheld | §4: most recently started running step |
| mechanics | major | Last-30 retention can evict a running step | upheld | §4: running steps never evicted; 50-running cap |
| mechanics | blocking | History by project basename mixes projects | upheld | §4: basename + path hash key |
| mechanics | major | Workers ask the lead directly, so the planned sub-lead relay contradicts protocol and paths skip tree edges | upheld | §6: routing unchanged, paths are handlers; §7 skip rendering |

### Round 2 — 2026-11-17

**Lanes:** intent: gpt; mechanics: gpt (Claude unavailable at start); cross-family: no.

**Changed since Round 1:**
- §2 Codex: steps follow an operation to completion through `wait` (cell) and `write_stdin` (process) polls; one step per script (Decision 12).
- §2 Codex turn end: reader flushed before `turn-ended` is emitted.
- §4: order-independent start/end handling, pending ends, time-based turn attribution; running steps never evicted; closure on stop/failure; `current` with parallel steps; history key with path hash.
- §6/§7: question routing unchanged (workers ask the lead directly); path = agents that handled it; amber rendering when a path skips an agent.
- Accepted Risk 3 added (Claude background Bash).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Process polls wrapped in `exec` scripts start new steps instead of continuing the command | upheld | §2 "Polls inside scripts" |
| mechanics | blocking | Wrapped `write_stdin` polls start new steps; a poll script can itself yield a cell | upheld | §2 "Polls inside scripts", incl. yielded poll cells |
| mechanics | major | "First string argument" undefined for object arguments | upheld | §2 key list for object literals |
| mechanics | blocking | Late starts closed at the latest turn end, not their own | upheld | §4 turn boundaries (`session.turns`) |
| mechanics | blocking | Late starts after stop/disappearance inserted as running | upheld | §4 terminal boundary for incoming starts |

### Round 3 — 2026-11-17

**Lanes:** intent: gpt; mechanics: gpt (Claude unavailable at start); cross-family: no.

**Changed since Round 2:**
- §2 Codex: polls inside `exec` scripts join their owning step, incl. a poll script that itself yields a cell; target extraction from object-literal arguments.
- §4: `session.turns` keeps turn boundaries; late starts close at their own turn's end; starts after a session stops or disappears are stored finished.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | major | Ambiguous results in mixed scripts can close the wrong step | upheld | §2 "Attributing a result"; Accepted Risk 4 |
| mechanics | blocking | A step owning several processes ends when any one finishes | upheld | §2 "Ownership and completion" |

### Round 4 — 2026-11-17

**Lanes:** intent: gpt; mechanics: gpt (Claude unavailable at start); cross-family: no.

**Changed since Round 3:**
- Collin chose the simpler Codex rule (Decision 13): §2 Codex rewritten (polls, yielded step ends when the agent moves on, `clean` flag); Accepted Risk 4 replaced; §1 step shape gains `clean`; §4 history takes only `clean` steps.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | major | A clean end arriving after the hub's own closure is unspecified | upheld | §4 "A real end beats a closure" |
| mechanics | minor | 5 s live-check target is tighter than the timers allow | upheld | §9: 10 s for steps, 25 s for context |

### Round 5 — 2026-11-17

**Lanes:** intent: gpt; mechanics: gpt (Claude unavailable at start); cross-family: no.

**Changed since Round 4:**
- §4: a CLI end arriving after the hub closed the step upgrades it; history sample added exactly once.
- §9: live-check bounds 10 s (steps) and 25 s (context).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | major | Late-end upgrade lost once the step is evicted | downgraded (minor) | Behaviour was already defined by the end-with-no-start rule (§4); needs 30 newer steps to finish inside an async hook's delivery delay. Clarified in §4 |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
