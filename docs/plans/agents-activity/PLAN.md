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
{ id, kind, label, key, started_at, ended_at|null, failed: true|false|null }
```

- `id`: the CLI's own call id (`tool_use_id` for Claude, `call_id` for Codex; for a Codex
  nested call, `<call_id>#<n>`, n from 1 in source order).
- `kind`: `files`, `shell`, `helpers`, `web` or `starter`. (`thinking` is never stored; see 4.)
- `label`: plain words for the Latest list, at most 80 characters, cut with "…".
- `key`: the matching key for "is this normal?" (section 5).
- `ended_at` null and `failed` null while running.

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

- `response_item` with `payload.type` `custom_tool_call` or `function_call` → start event(s),
  `started_at` = the line's `timestamp`. When `name` is `exec`, parse `input` for every
  `tools.<name>(` call and its first string argument (`cmd`, `path`, `query`…) and emit one
  step per nested call, ids `<call_id>#<n>`; if none parse, one `shell` step labelled
  "Ran a script".
- `..._output` with the same `call_id` → end event(s) for that call (all nested ids),
  `ended_at` = the line's `timestamp`. `failed` is true when the output reports a non-zero
  `exit_code`, a script error, or a tool error; build this from real rollout fixtures
  (`~/.codex/sessions/**` on this machine) and keep the fixtures in `machine/test/`.
- `event_msg` `token_count` with `info.model_context_window` → a context event (section 3).

The existing turn-end usage scan is unchanged.

**Transport.** Step and context events go through the existing path unchanged in shape:
`hook()` / `emitEvent` → event spool → drain → hub `POST /api/machine/events`, each with its
own `delivery_id`. `hook()` adds `session` and `thread_id` as it does today and passes
`step` / `context` through.

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

- `session.steps`: the last 30 steps, newest last. A start adds a step (ignore a repeat id);
  an end fills `ended_at` and `failed` on the matching id. An end with no start is dropped.
- `session.step_counts`: `{files, shell, helpers, web, starter, thinking}`, counts over the
  session's life, incremented on start (thinking: see below).
- When a step ends, append `{kind, key, ms, at}` to a per-project history file
  `<state>/step-history/<project basename>.jsonl`. On hub start and once a day, rewrite each
  file without rows older than 30 days.
- When a turn ends, any step still running is closed with `ended_at` = turn end and
  `failed: null` (shown as done).

**Thinking.** A session is thinking when its turn is running (the existing
`turn_started_at` is later than `turn_ended_at`) and no step is running. It begins at the
latest step `ended_at` in this turn, or the turn start. Each gap of 5 seconds or more adds 1
to `step_counts.thinking` when the next step starts or the turn ends.

`viewer/app/agents.js` adds to each node:

- `context` (passthrough).
- `activity`: `{counts, trail, current, latest, normal}`:
  - `counts`: `step_counts`.
  - `trail`: kinds of the last five steps, oldest first, consecutive repeats collapsed.
  - `current`: `{kind, label, since}`: the running step, else thinking (label
    "Thinking"), else null when the turn is not running.
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
- `sub-lead.md` (after the worker-question relay, ~line 125): when passing a worker's question
  to the lead, send `asks: true` and `passes_on: <the question id from the [question <id>]
  tag>`; answering it yourself needs nothing.
- `lead.md` (Build section, step 7 items 3–4): a `question` card that passes on a sub-lead's
  or worker's question carries `passes_on`. `cards.md` documents the fields and the tag.

API per node, `question`: when this session's latest `asks` message is not yet answered
(no later message or result back from its recipient to it, and no `passes_on` card from the
lead that is answered or retracted), `{asked_at, to, trail:[{who, at, text}], card_id|null}`:
one entry per hop, `text` the first line of each message (80 chars); `card_id` is the lead's
open question card when the chain reached Collin.

### 7. Screen (`viewer/pages/agents.js`, `views.css`)

Side panel, below today's details and in this order, as in `AgentsActivity.dc.html`:

1. **Normal line** (section 5), or for a waiting agent the **question trail** as in
   `AgentsTree.dc.html`: "Asked the sub-lead at 19:58", then each hop ("The sub-lead passed
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

Tree (`AgentsTree.dc.html`): for each path in the lead's `question_paths`, the connectors
and the boxes' left edges along it are drawn in `--warn`, from the asking agent up to the
lead. A legend item "Where a question went" appears only when a path is drawn.

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
commands, and their steps and context show on the Agents screen within 5 seconds.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| 1. A Codex session's first turn shows its steps only when that turn ends | The rollout is found only once the first turn-complete binds the thread; binding earlier means guessing which rollout is ours | planning |
| 2. Claude tool calls that the CLI rejects before running, or that are cancelled, may show as running until the turn ends | The CLI fires no end hook for them; turn end closes them | planning |

## Review Rounds

### Round 1 — 2026-11-17

**Lanes:** intent: pending; mechanics: pending; cross-family: pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
