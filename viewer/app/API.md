# App API

All browser routes are below `/wheelchair/api/`, use the viewer remember cookie (or graph
token during sign-in), and require the viewer origin on writes. Responses are JSON. The
machine callback routes use `X-Wheelchair-Machine-Secret` instead, and do not accept a
browser cookie or an Origin requirement. This is the contract for the page tasks.

| Route | Request | Response |
|---|---|---|
| `GET /threads` | — | `{threads:[Thread]}` newest first |
| `POST /threads` | `{project,machine?,message?}` | a `Thread`, with its lead started or waiting for room. Before anything is saved the thread's machine checks `project` (`GET /v1/projects?check=`): not a usable git repository → `400 "<path> <reason> on <machine>"`, unknown machine → `404`, no answer or an older service → `502`; nothing is saved or added to `projects.json` on any of these, and the stored `project` is the path the machine returned (`~` and `~/…` expanded there). A non-empty string `message` sets `title` from its trimmed, whitespace-collapsed first line, cut at a word boundary to 60 characters plus `…` |
| `GET /threads/:id/chat` | — | `{thread,items,cards,pinned,queued,asides}`; `items` leaves out the lead's tool steps when Settings has `tool_steps:"hide"` |
| `POST /threads/:id/asides` | `{message_id,start,end,quote,action}` | `201` aside without history; action is `ask`, `simpler`, or `draw` |
| `GET /threads/:id/asides/:aside` | — | full aside including history and computed `heavy_usable` boolean (not stored); also works when archived |
| `POST /threads/:id/asides/:aside/messages` | `{text}` | `202`, queues a message and reopens the aside |
| `POST /threads/:id/asides/:aside/close` | `{outcome:"done"}` or `{outcome:"changed",line}` | `200`; changed sends the line to the lead |
| `POST /threads/:id/asides/:aside/retry` | — | `200`, retries a failed message |
| `POST /threads/:id/asides/:aside/think-harder` | — | `200`, repeats the last question on Heavy when enabled |
| `POST /threads/:id/asides/:aside/summary` | — | `200`, queues a handoff draft when enabled |
| `POST /threads/:id/messages` | `{text}` | `{queued:true}`; delivery waits for the lead turn end |
| `POST /threads/:id/cards/:cardId/press` | `{action,value?}` | `{queued:true,text}` for lead actions and records `answered_action` and `answered_value` on an answered card; `recheck` updates an approval in place, and `start-building` first re-checks Ready. On an open lead `needs` card, `keep-going` and `talk` (value: the card title) also close it as `resolved_by:"collin"`; a `system` or answered needs card is refused with 422. `answered` (value: Collin's own words, trimmed) works only on an open `question` card: 400 for another kind or empty text, 422 once answered; it reaches the lead as `[card <id>] answered: <text>` |
| `POST /threads/:id/cards/:cardId/dismiss` | — | `{ok:true}`; closes an open `needs` card a lead posted (`resolved_by:"collin"`, shown dimmed as resolved). The thread page no longer shows a Dismiss button; it uses the press actions above. A `system` needs card is refused with 422, an unknown card with 404 |
| `POST /threads/:id/open` | `{start_now?:boolean}` | a started stub, or `{waiting:true,thread}` |
| `POST /threads/:id/restart` | — | replacement lead session; its restart context is queued first |
| `POST /threads/:id/archive` | — | the machine archive response |
| `GET /threads/:id/doc?file=PLAN.md` | — | `{content}` from the archived branch, read-only |
| `GET /features` | — | `{idea,planning,review,building,verifying,done,needs}` |
| `GET /projects` | — | `{projects:[path]}`, the repos in `projects.json`, added when a thread is created |
| `GET /sessions` | — | machine groups `{machine,hub,reachable,last_seen,sessions}, `hub:true` on the entry `"hub"` resolves to`; other tmux sessions appear as `{name,managed:false}` (read-only) |
| `GET /sessions/:name/pane` | — | `{pane}` |
| `POST /sessions/:name/keys` | `{keys}` | `{ok:true}` |
| `POST /machine/cards` | service envelope `{thread_id,session,...card}` | accepted card, `202` |
| `POST /machine/events` | `{thread_id,session,type,...}` | `{ok:true}`, `202` |
| `POST /machine/session` | `{calling_session,action,...}` | the hub-authorized session result |
| `GET /settings` | — | `{models,model_options,heads_up,permission_mode,codex_mode,tool_steps,review_families,reserved_provider,other_agents,escalation,escalation_text,templates,in_use,style,style_version,projects,default_project_folder,saved_dirs}`; `projects` is `projects.json` plus every saved directory's path; templates include `in_use`, `live_sessions`, and `scope_missing` when a saved project is no longer listed |
| `PUT /settings/models` | `{provider:"claude"|"gpt",slot,model|null,effort?}` | `{models}`; `slot` is `light`, `standard`, `heavy`, `critical`, or `lead`; effort is `low`, `medium`, `high`, `xhigh`, and for Claude also `max`; omission clears it |
| `POST /settings/models/heads-up` | `{action:"switch",tier,model}`, `{action:"skip",model}`, or `{action:"reset"}` | `{models,heads_up}` |
| `PUT /settings/preferences` | `{permission_mode?:"auto"|"bypass",codex_mode?:"sandboxed"|"unrestricted",tool_steps?:"show"|"hide",review_families?:"both"|"claude"|"gpt",lead_names?:string[],other_agents?:{reviewer?,verifier?,mapper?},default_project_folder?:string,escalation?:{first?,max_effort?,max_tier?,ask_before?}}` | saved preference values, including `default_project_folder`, `escalation` and `escalation_text`; that field is trimmed, `""` clears it, otherwise it must be absolute, exactly `~`, or start with `~/` (`~user` → `400`); it is not checked against a machine |
| `GET /new-thread?machine=` | — | `{machines,machine,default_folder,saved,found,found_error?,previous}` for `machine` (default `hub`; unknown → `404`). `machines`: `hub` first, then the names in `machines.json` except the hub's own hostname entry. `saved`: `saved_dirs` entries of that machine. `found`: that machine's `/v1/projects?folder=` when a default folder is set, else `[]`; its `folder_error` becomes `found_error`, and an unreachable or older machine gives `found: []` with `found_error` `"<machine> is not reachable"` or `"<machine> needs updating"`, still `200`. `previous`: distinct `project` paths of threads on that machine (a thread stored under the hub's hostname counts as `hub`), newest first |
| `POST /settings/saved-dirs` | `{name,path,machine}` | `201 {saved}` (that machine's entries). `path` is checked on `machine` and stored as the expanded path the machine returned. `400` for a field error (a `name` of `.` or `..` is refused) or the check's reason (`"<path> <reason> on <machine>"`), `404` for an unknown machine, `409` when the name exists for that machine, `502` when the machine does not answer |
| `DELETE /settings/saved-dirs/:name?machine=` | — | `{saved}` for that machine (default `hub`); `404` for an unknown name; changes no thread |
| `POST /settings/templates` | `{name,role,scope,switches?,text}` | new template, including generated `id` and `in_use:false`; `scope` is `all`, a path in `projects.json`, or a saved directory path |
| `PUT /settings/templates/:id` | template fields and optional `in_use` | saved template; enabling one clears the other template for its role and scope |
| `DELETE /settings/templates/:id` | — | `{ok:true}` |
| `PUT /settings/style` | `{length,lists,terms,never_say,text}` | `{style,style_version}` |
| `POST /settings/style/preview` | unsaved style object | `{before,after}`; previewing never saves it |
| `GET /settings/prompt?role=&project=` | — | `{text}` with the exact composed starting instructions, using the hub root in its pointer |

`Thread` has `id`, `project`, `cli`, `machine`, `stub`, `context`, `parent`,
`depends_on_parent`, `waiting_on_parent`, `sessions`, `cards`, `pinned`, `queues`, `sent`,
`worktree`, `branch`, `slug`, and `archived`. Card records retain their card fields plus `id`,
`session`, `at`, `created_at`, `answered`, `answered_action`, `answered_value`, and `system`.
A closed `needs` card, or a question the lead resolved after an answer in chat, also has
`resolved_by` (a lead's session name, or `collin` for a needs dismissal), `resolved_note` and
`resolved_at`; a lead closes one by posting a `resolve` card (`{card,note}`, never stored).
Collin's dismiss remains needs-only. `at` is the ISO time the hub stored the card.

Accepted agent cards include a lead-only `title` card: it trims and word-cuts its `title`
field to 80 characters, renames the thread, and is never stored. `question.doc`, when
present, is one of `MAP.md`, `IDEA.md` or `PLAN.md`. The hub accepts an `offer` only when no
offer exists, or when exactly one prior offer was answered with `answered_value: "keep talking
first"`; otherwise it returns 422, `the offer was already asked`.

An aside turn records its resolved `model` and `effort` alongside `id`, `state`, and `message`; retries reuse them and history records the model actually used. Aside-changing routes return 409 when the thread is archived. Chat `asides` holds each aside without its history. Lead assistant text items have a stable `id` of `<session name>#<index>`.

The thread record carries `pending_cancels`: aside turn ids archive cancelled that the machine hasn't confirmed yet; the hub retries them.

Chat `items` are `{type:"human"|"assistant"|"tool"|"context",text,at}`. `at` is the
ISO timestamp on that transcript line, so pages can interleave chat and cards in time order.
`human` card presses include `card:true`; context items include `context:"stub"|"restart"`.
Tool items are collapsed summaries; the transcript remains the authoritative detail.

`sent` records successful app submissions as `{to,text,source,at}`. A thread keeps its most
recent 500; older records append to `threads/<id>.sent.jsonl` in the hub state directory.

Session start resolves a provider cell through `codex/model.sh`: leads and sub-leads use `lead`, reviewers,
verifiers, and mappers use Settings' Other agents tier, and workers use their requested tier (`top` means
Heavy). The tiers are `light`, `standard`, `heavy`, and `critical`; `luna`, `terra`, `sol`, `astra` and,
for Claude, `haiku`, `sonnet`, `opus` are accepted aliases for slots, not model names — for example
`--tier opus` runs whatever the Heavy cell holds. Every session receives a model and its configured effort when present. A provider cell set to `none` is a 400 directing the caller to the other CLI.
A start is a 409 ("machine service out of date") while that machine's `/v1/status` commit differs from the hub's.

Worker restart (`wc.js session start --role worker ... --replaces <session>`): the hub checks the named session is a worker in the same thread and not live, then starts the new worker in that session's `worktree` on its `branch`. A live session or a non-worker is refused with 400. The hub then asks the machine (`GET /v1/sessions`): if the old worker's tmux session is still listed as running, or running is unknown, or the machine cannot be reached, the start is refused with 409, because the hub's record can say ended while the old worker still runs and both would write one worktree.

### Accounts and usage

`GET /settings` includes `reserved_provider` (the label Claude or GPT, or null, based on accounts signed in on any machine), `review_families`, `accounts`, `lead_order`, `worker_order`, `within`, `leave`,
`notify_below`, `save_for_leads`, `margin`, and `held_back` (an object with boolean
`worker`, `reviewer`, `verifier`, and `mapper` keys, all defaulting to true). `POST /settings/accounts` accepts
`{provider, name, plan}`; `PUT /settings/accounts/:id` accepts `{name?, plan?, weight?, paused?}`;
`DELETE /settings/accounts/:id` removes a non-default account. `PUT /settings/balancing`
updates the balancing keys and returns `reserved_provider`; an old saved file’s boolean `save_claude_for_leads` carries over to `save_for_leads`. `PUT /settings/preferences` accepts `review_families` as `both`, `claude`, or `gpt` and returns it. Invalid values and attempts to remove a default return 400.

`GET /usage` returns `{providers}` with each provider's forecast and account readings,
machine sign-in states, placement reason and live session count. `GET /usage/alert` returns
`{dot}`; `POST /usage/seen` marks current provider alerts seen for their refill week.
`POST /accounts/:id/signin` accepts `{machine}` and starts sign-in on that machine.
`GET /accounts/:id/signin/:machine` returns its state; `POST .../code` sends `{code}`;
`GET .../pane` and `POST .../keys` provide the login terminal. Unknown accounts or machines
return 404.

Session starts through `POST /machine/session` accept `role`, `tier`, `brief`, `attempt_id`, and optional `provider` or `not_provider` (`claude` or `gpt`) for workers, reviewers and verifiers. The flags are mutually exclusive; the reserve follows the first signed-in provider in lead order. A worker preference for a provider with no signed-in account is dropped with a note; a signed-in preference remains strict, subject to the reserve margin. Reviewer and verifier constraints are preferences when `review_families` is `both`. For a single-family setting, those flags are ignored and the chosen family is used or waited for; if it is signed out or its model is unused, normal placement applies with a note. The obsolete `cli` field is ignored. The response has `session` and may have a `note`. Sessions carry `provider` and `account`; a waiting session has `status: "waiting"`, `waiting_until`, `waiting_reason`, `waiting_provider` (the pinned provider, the first explicit lead-order provider for a new lead, or null), and `pending_start`. Its identity and queue survive promotion.

`POST /machine/session` with action `list` (and `wc.js session list`) returns `{sessions, review_families}`.

Machine events may carry a `reading`, including Codex `turn-ended` events; they include `usage` with a reading, `limit-hit` with `limited_until` and `error`, and `turn-failed` with `error`. A limit-ended turn never delivers a report: a future limit holds delivery until reset, while an already expired limit queues `Continue.` immediately, in both cases at the front of the queue. A failed turn releases the queue and informs the starter without delivering a partial reviewer or verifier report; a failed lead turn creates a needs card.

A sub-lead starting a worker may pass `--effort <e>` to `wc.js session start`; the
`POST /machine/session` start body carries it as `effort`. Other starts with effort receive
400 `effort can only be set for a worker`. Claude accepts low, medium, high, xhigh, max;
a GPT worker accepts low, medium, high, xhigh and refuses max with 400 `GPT's highest effort is xhigh`.
Other invalid values receive 400 `effort must be one of …`. Worker tiers above Settings'
`max_tier` receive 400 `tier <t> is above the highest tier in Settings (<max>)`; requested
effort above `max_effort` receives 400 `effort <e> is above the highest effort in Settings (<max>)`.
Aliases resolve before the tier check. A GPT max ceiling counts as xhigh. Pinned efforts are
not checked against the ceiling, and explicit effort overrides the pin. The tier check runs before a provider is chosen or a wait is queued; effort checks run once the provider is chosen, before preflight. The ask-before switch is guidance, not enforced.

Escalation preference values are `first: effort|model`, `max_effort: high|xhigh|max`,
`max_tier: standard|heavy|critical`, and `ask_before: never|critical|any`. Partial updates
are accepted; invalid keys, values, and non-object inputs receive 400.


### Agents and lead names

`GET /wheelchair/api/agents` returns `{leads, machines}` for unarchived threads. Each lead has `thread_id`, `thread_title`, `lead_name`, `machine`, `session`, and `children`; agent sessions omit tokens and include `children` and `waiting_on` session names. Ended ancestors remain when they have live descendants. Machines carry `machine`, `reachable`, `last_seen`, and `hub`.

Threads include `lead_name`, retained until and after archive; archived threads release the name for reuse. Settings `lead_names` is an array of up to 200 unique case-insensitive names, trimmed to 1–40 characters, with blank entries discarded; an empty list uses Greek letters. New session records include the resolved `model` and `effort` (which may be null). Older sessions may omit them.

Diagram cards accept optional `format` (`graph`, the default, `form`, or `html`). Image
cards are lead-only and contain `path` and `title`; stored image cards also carry `file`,
the basename supplied by the machine. Form and HTML diagrams register their plan but do
not enter the graph registry.

`POST /threads/:id/uploads?name=...` streams a raw file of at most 25 MiB to the lead's
machine and returns `201 {path}`. It returns 409 for an archived thread or absent live lead,
and 413 for a missing or excessive Content-Length. `GET /threads/:id/files/:file` streams a
machine file whose name matches `[0-9]+-[A-Za-z0-9._-]+` and preserves its content headers.
`GET /threads/:id/graph?file=...json` reads an archived diagram as JSON;
`GET /threads/:id/diagram-html?file=...html` reads archived HTML with the static sandbox CSP.
Outside the API prefix, `GET /wheelchair/diagram-form?path=<absolute>` reads unchanged JSON
(up to 2 MiB) and `GET /wheelchair/diagram-html?path=<absolute>` serves static HTML with the
same CSP. Both require a file directly inside a registered plan's `graphs/` directory.
Archive leaves the thread open with a system needs card if the machine reports that upload
removal failed; its response includes `uploads_removed` and, on failure, `uploads_error`.
