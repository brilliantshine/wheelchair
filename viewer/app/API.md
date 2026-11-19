# App API

All browser routes are below `/wheelchair/api/`, use the viewer remember cookie (or graph
token during sign-in), and require the viewer origin on writes. Responses are JSON. The
machine callback routes use `X-Wheelchair-Machine-Secret` instead, and do not accept a
browser cookie or an Origin requirement. This is the contract for the page tasks.

| Route | Request | Response |
|---|---|---|
| `GET /threads` | — | `{threads:[Thread]}` newest first; `?view=list` leaves out each thread's `cards`, `sent`, `delivered_ids`, `context`, `pinned`, `archive` and `queues`, and keeps only each session's `name`, `role`, `live`, `ready`, `turn_ended` and `created_at` — what the pages poll |
| `POST /threads` | `{project,machine?,message?,title?}` | a `Thread`, with its lead started or waiting for room. Before anything is saved the thread's machine checks `project` (`GET /v1/projects?check=`): not a usable git repository → `400 "<path> <reason> on <machine>"`, unknown machine → `404`, no answer or an older service → `502`; nothing is saved or added to `projects.json` on any of these, and the stored `project` is the path the machine returned (`~` and `~/…` expanded there). A non-empty string `message` sets `title` from its trimmed, whitespace-collapsed first line, cut at a word boundary to 60 characters plus `…`. Without `message`, a string `title` sets it the same way: the New thread screen sends the first message after uploading its attachments |
| `GET /threads/:id/chat` | — | `{thread,items,cards,pinned,queued,asides}`; `items` leaves out the lead's tool steps when Settings has `tool_steps:"hide"` |
| `POST /threads/:id/asides` | `{message_id,start,end,quote,action}` | `201` aside without history (with `graphs`, as in chat); action is `ask`, `simpler`, or `draw`; Antigravity and Kimi Code sessions return `400` |
| `GET /threads/:id/asides/:aside` | — | full aside including history and computed `heavy_usable` boolean (not stored); also works when archived |
| `POST /threads/:id/asides/:aside/messages` | `{text}` | `202`, queues a message and reopens the aside |
| `POST /threads/:id/asides/:aside/close` | `{outcome:"done"}` or `{outcome:"changed",line}` | `200`; changed sends the line to the lead |
| `POST /threads/:id/asides/:aside/retry` | — | `200`, retries a failed message |
| `POST /threads/:id/asides/:aside/think-harder` | — | `200`, repeats the last question on Heavy when enabled |
| `POST /threads/:id/asides/:aside/summary` | — | `200`, queues a handoff draft when enabled |
| `POST /threads/:id/messages` | `{text}` | `{queued:true}`; delivery waits for the lead turn end |
| `POST /threads/:id/send-now` | `{at}` | `{sent}`; submits the user's queued message with that `at` to the live lead mid-turn. `404` if it is no longer queued, `409` with no live lead or while the lead is unready or held (permission, needs, usage limit). `sent:false` means the submit failed and it stays first in the queue |
| `POST /threads/:id/cards/:cardId/press` | `{action,value?}` | `{queued:true,text}` for lead actions and records `answered_action` and `answered_value` on an answered card; `keep` resolves an open app `merged` card as Kept without a live lead and returns `{queued:false}`; other actions on it return 400 and repeating keep returns 422. `recheck` updates an approval in place, and `start-building` first re-checks Ready. Any press on a retracted card returns 422 `this card was withdrawn`. On an open lead `needs` card, `keep-going` and `talk` (value: the card title) also close it as `resolved_by:"user"`; a `system` or answered needs card is refused with 422. `answered` (value: the user's own words, trimmed) works only on an open `question` card: 400 for another kind or empty text, 422 once answered; it reaches the lead as `[card <id>] answered: <text>` |
| `POST /threads/:id/cards/:cardId/dismiss` | — | `{ok:true}`; closes an open `needs` card a lead posted (`resolved_by:"user"`, shown dimmed as resolved). The thread page no longer shows a Dismiss button; it uses the press actions above. A `system` needs card is refused with 422, an unknown card with 404 |
| `POST /threads/:id/open` | `{start_now?:boolean}` | a started stub, or `{waiting:true,thread}` |
| `POST /threads/:id/export` | — | `200` JSON file with attachment filename; checks eligibility, pushes and freezes the thread. A refusal is `409` with the reason in `detail` |
| `GET /threads/:id/try` | — | Machine checkout status with `active_thread_title`; available on archived threads |
| `POST /threads/:id/try` | `{action:"try"|"back"|"dismiss"|"forget",version?,kept?}` | Machine write answer with `active_thread_title` in `status`; available on archived threads |
| `GET /threads/:id/handoff` | — | `{state:"unchanged"|"moved"|"inspect-failed"|"own-cancelled"|"undo-unfinished",at,picked_up_at?,last_error?,can_cancel?}`; remote inspection is cached for 60 seconds |
| `GET /threads/:id/handoff-file` | — | Saved JSON file with attachment filename; `404` if no saved file matches the handed-off head |
| `POST /threads/:id/restart` | — | replacement lead session; its restart context is queued first |
| `POST /threads/:id/archive` | — | the machine archive response |
| `GET /threads/:id/doc?file=PLAN.md` | — | `{content}` from the archived branch, read-only |
| `GET /features` | — | `{idea,planning,review,building,verifying,done,needs}` |
| `GET /projects` | — | `{projects:[path]}`, the repos in `projects.json`, added when a thread is created |
| `GET /sessions` | — | machine groups `{machine,hub,reachable,last_seen,sessions}, `hub:true` on the entry `"hub"` resolves to`; other tmux sessions appear as `{name,managed:false}` (read-only) |
| `GET /sessions/:name/pane?history=<n>` | Optional integer history, 0–2000 | `{pane}` |
| `GET /sessions/:name/brief` | — | `{brief}`; 404 if missing |
| `POST /sessions/:name/keys` | `{keys}` | `{ok:true}` |
| `POST /machine/cards` | service envelope `{thread_id,session,...card}` | accepted card, `202` |
| `POST /machine/sudo-outcome` | `{request_id,state,exit_code?,output?,truncated?,reason?,delivery_id}`; `state` is `running`, `ran` (needs an integer `exit_code`), `declined`, `expired` or `failed` | `200 {ok:true,changed}`. Finds the thread by `request_id` (its `sudo_index`) and calls `applySudoState`; a repeat, an older or equal state changes nothing and is still `200`. `409` for an unknown `request_id` (the machine retries later), `400` for a bad body, `401` without the machine secret |
| `POST /machine/events` | `{thread_id,session,type,...}` | `{ok:true}`, `202` |
| `POST /machine/session` | `{calling_session,action,...}` | the hub-authorized session result |
| `GET /settings` | — | `{models,model_options,heads_up,permission_mode,codex_mode,aside_access,tool_steps,review_families,reserved_provider,other_agents,escalation,escalation_text,templates,in_use,style,style_version,projects,default_project_folder,saved_dirs}`; `projects` is `projects.json` plus every saved directory's path; templates include `in_use`, `live_sessions`, and `scope_missing` when a saved project is no longer listed; `model_options` has `claude`, `gpt` and `kimi` lists of `{value,label}`, Kimi's read from the `[models."<alias>"]` tables of `~/.kimi-code/config.toml` on the hub's machine (`WHEELCHAIR_KIMI_CONFIG` overrides the path) plus any pinned Kimi model not in it |
| `PUT /settings/models` | `{provider:"claude"|"gpt"|"gemini"|"kimi",slot,model|null,effort?}` | `{models}`; `slot` is `light`, `standard`, `heavy`, `critical`, `lead`, or `sub-lead`; model IDs are at most 64 characters (Kimi aliases may hold one `/`, as `kimi-code/k3`, each side at most 64); effort is `low`, `medium`, `high`, `xhigh`, and for Claude and Gemini also `max`; Kimi takes no effort (any `effort` is a 400, "Kimi Code has no effort setting"); omission clears it |
| `POST /settings/models/heads-up` | `{action:"switch",tier,model}`, `{action:"skip",model}`, or `{action:"reset"}` | `{models,heads_up}` |
| `PUT /settings/preferences` | `{permission_mode?:"auto"|"bypass",codex_mode?:"sandboxed"|"unrestricted",aside_access?:"read-only"|"full",tool_steps?:"show"|"hide",review_families?:"both"|"claude"|"gpt"|"gemini"|"kimi",lead_name_list?:"greek"|"nato"|"stars"|"people"|"custom",lead_names?:string[],other_agents?:{reviewer?,verifier?,mapper?,scout?,"scout-heavy"?},default_project_folder?:string,escalation?:{first?,max_effort?,max_tier?,ask_before?}}` | saved preference values, including `default_project_folder`, `escalation` and `escalation_text`; that field is trimmed, `""` clears it, otherwise it must be absolute, exactly `~`, or start with `~/` (`~user` → `400`); it is not checked against a machine |
| `GET /new-thread?machine=` | — | `{machines,machine,default_folder,saved,found,found_error?,previous}` for `machine` (default `hub`; unknown → `404`). `machines`: `hub` first, then the names in `machines.json` except the hub's own hostname entry. `saved`: `saved_dirs` entries of that machine. `found`: that machine's `/v1/projects?folder=` when a default folder is set, else `[]`; its `folder_error` becomes `found_error`, and an unreachable or older machine gives `found: []` with `found_error` `"<machine> is not reachable"` or `"<machine> needs updating"`, still `200`. `previous`: distinct `project` paths of threads on that machine (a thread stored under the hub's hostname counts as `hub`), newest first |
| `POST /settings/saved-dirs` | `{name,path,machine}` | `201 {saved}` (that machine's entries). `path` is checked on `machine` and stored as the expanded path the machine returned. `400` for a field error (a `name` of `.` or `..` is refused) or the check's reason (`"<path> <reason> on <machine>"`), `404` for an unknown machine, `409` when the name exists for that machine, `502` when the machine does not answer |
| `DELETE /settings/saved-dirs/:name?machine=` | — | `{saved}` for that machine (default `hub`); `404` for an unknown name; changes no thread |
| `POST /settings/templates` | `{name,role,scope,switches?,text}` | new template, including generated `id` and `in_use:false`; `scope` is `all`, a path in `projects.json`, or a saved directory path |
| `PUT /settings/templates/:id` | template fields and optional `in_use` | saved template; enabling one clears the other template for its role and scope |
| `DELETE /settings/templates/:id` | — | `{ok:true}` |
| `PUT /settings/style` | `{length,lists,terms,never_say,text}` | `{style,style_version}` |
| `POST /settings/style/preview` | unsaved style object | `{before,after}`; previewing never saves it |
| `GET /settings/prompt?role=&project=` | — | `{text}` with the exact composed starting instructions, using the hub root in its pointer |
| `GET /settings/diagram-sensitivity` | — | `{machines:{<machine>:{level,files}|{error}}}`; asks every configured machine's `GET /v1/diagram-sensitivity` in parallel, 5 s each. `level` is `ask`, `default`, `high` or `null` (its CLIs' files disagree or hold none); `files` is `[{harness,level|null}]`. A machine that times out, refuses the connection or fails is `{error:"did not answer"}`; a machine's own 4xx gives `{error:<its text>}`. Separate from `GET /settings` so no other caller waits on machines. The hub stores nothing |
| `POST /settings/diagram-sensitivity` | `{level:"ask"|"default"|"high"}` | `{machines:{<machine>:{level}|{error}}}`, forwarded to every machine's `POST /v1/diagram-sensitivity`; `200` when all succeeded, `502` with the same map when any failed (machines that succeeded keep the new level; posting again retries all); `400` for any other level. Same 5 s limit and error texts as the GET |

`Thread` has `id`, `project`, `cli`, `machine`, `stub`, `context`, `parent`,
`depends_on_parent`, `waiting_on_parent`, `sessions`, `cards`, `pinned`, `queues`, `sent`,
`worktree`, `branch`, `slug`, `archived`, and `handed_off` (`null` or `{at,head,stage}`); chat `thread.export` is `{ok,reason}`. It has optional `merge_noticed_url` and `merge_noticed_at` (the reported PR URL and its ISO notice time). Card records retain their card fields plus `id`,
`session`, `at`, `created_at`, `answered`, `answered_action`, `answered_value`, and `system`.
A closed `needs` card, or a question the lead resolved after an answer in chat, also has
`resolved_by` (a lead's session name, or `user` for a needs dismissal), `resolved_note` and
`resolved_at`; a lead closes one by posting a `resolve` card (`{card,note}`, never stored).
A lead can post a hidden `retract` card (`{card,note}`, never stored) for an open question,
offer, approval, lead needs or waiting sudo card. It marks the target `answered` with
`retracted_at`, `retracted_by` and `retracted_note`, removes its pin, and leaves it dimmed
in the conversation with its note. A waiting sudo request is cancelled first; a running or
finished request refuses retraction and reports its outcome as usual. An approval is pinned
until accepted Start building or retraction; a fresh approval replaces an open one. An offer
may be posted a second time after retraction, but a third is refused. The user's dismiss remains needs-only. `at` is the ISO time the hub stored the card.

A `sudo` card (lead only) is posted by an agent with `command`, `does` and `why` alone; the
machine service adds `request_id` (32 hex), `url` (`https://…`) and `editable` (array of strings)
before it reaches `POST /machine/cards`, and the hub requires all six, refusing a non-lead
poster, a repeated `request_id` or any other field (422). The stored card has `state`
(`waiting` on arrival; then `running`, `ran`, `declined`, `expired` or `failed`) and, once set,
`exit_code`, `output`, `truncated` and `reason`. The thread carries `sudo_index`, `{request_id:
card id}`, written in the same save as the card (`?view=list` leaves it out). Sudo retraction sets a cancelled card to `declined` in the card transaction without queuing a message. Other state
changes go through one function, `applySudoState` (`app/cards.js`): ranks `waiting` <
`running` < terminal, ignores `waiting` and any state not newer than the card's, and on the
first terminal state queues exactly one message to the lead in the same save (`[card <id>] sudo
ran: exit <n>` and the output, `declined`, `sudo expired`, `sudo failed: <reason>`). Presses on
a sudo card: `talk` (value `sudo request`) tells the lead `[card <id>] talk about: sudo
request` and leaves the card `waiting` and unanswered; `decline` is one synchronous call to the
thread's machine, `POST /v1/sudo/<request_id>/cancel`, ten seconds overall, whose answer (the
helper's status shape) goes to `applySudoState`: `declined` closes the card, a run result is
shown instead if Run won, `running` leaves it running. Nothing is saved before the answer; an
unreachable, timed-out, non-2xx or malformed answer is `502 "Couldn't reach <machine> to
decline. Try again."` with the card unchanged. Both presses are `409` once the card is no longer
`waiting`; any other action on a sudo card is `400`.

Accepted agent cards include a lead-only `title` card: it trims and word-cuts its `title`
field to 80 characters, renames the thread, and is never stored. `question.doc`, when
present, is one of `MAP.md`, `IDEA.md` or `PLAN.md`. The hub accepts an `offer` only when no
offer exists, or when exactly one prior offer was answered with `answered_value: "keep talking
first"`; otherwise it returns 422, `the offer was already asked`.

An aside turn records its resolved `model` and `effort` alongside `id`, `state`, and `message`; retries reuse them and history records the model actually used. Aside-changing routes return 409 when the thread is archived. Chat `asides` holds each aside without its history, plus `graphs: [{entry, path}]`, one per history entry that has a `graph`: `entry` is that entry's index in the aside's `history` (the `entry` the app's picture page takes) and `path` is the saved graph file. The create route returns the same shape. Lead assistant text items have a stable `id` of `<session name>#<index>`.

The thread record carries `pending_cancels`: aside turn ids archive cancelled that the machine hasn't confirmed yet; the hub retries them.

Chat `items` are `{type:"human"|"assistant"|"tool"|"context",text,at}`. `at` is the
ISO timestamp on that transcript line, so pages can interleave chat and cards in time order.
`human` card presses include `card:true`; context items include `context:"stub"|"restart"`.
Tool items are collapsed summaries; the transcript remains the authoritative detail.

`sent` records successful app submissions as `{to,text,source,at}`. A thread keeps its most
recent 500; older records append to `threads/<id>.sent.jsonl` in the hub state directory.

Session start resolves a provider cell through `codex/model.sh`: leads use `lead`, sub-leads use `sub-lead`, reviewers,
verifiers, and mappers use Settings' Other agents tier, and workers use their requested tier (`top` means
Heavy). The tiers are `light`, `standard`, `heavy`, and `critical`; `luna`, `terra`, `sol`, `astra` and,
for Claude, `haiku`, `sonnet`, `opus` are accepted aliases for slots, not model names — for example
`--tier opus` runs whatever the Heavy cell holds. Every session receives a model and its configured effort when present. A provider cell set to `none` is a 400 directing the caller to the other CLI.
Other agents `scout` and `scout-heavy` are tiers defaulting to `light` and `standard`. Lead and sub-lead role layers include the resolved scout model (Claude family alias or GPT/Gemini model ID), or say it is unavailable; sub-leads also receive the bigger-changes scout. Missing sub-lead model cells inherit the lead cell until the next model save.

A start is a 409 ("machine service out of date") while that machine's `/v1/status` commit differs from the hub's.

Worker restart (`wc.js session start --role worker ... --replaces <session>`): the hub checks the named session is a worker in the same thread and not live, then starts the new worker in that session's `worktree` on its `branch`. A live session or a non-worker is refused with 400. The hub then asks the machine (`GET /v1/sessions`): if the old worker's tmux session is still listed as running, or running is unknown, or the machine cannot be reached, the start is refused with 409, because the hub's record can say ended while the old worker still runs and both would write one worktree.

### Accounts and usage

`GET /settings` includes `reserved_provider` (the provider label or null, based on accounts signed in on any machine), `review_families`, `accounts`, `lead_order`, `worker_order`, `within`, `leave`,
`notify_below`, `save_for_leads`, `margin`, and `held_back` (an object with boolean
`worker`, `reviewer`, `verifier`, and `mapper` keys, all defaulting to true). `POST /settings/accounts` accepts
`{provider, name, plan}`; a second Antigravity account is refused with 400; `PUT /settings/accounts/:id` accepts `{name?, plan?, weight?, paused?}`;
`DELETE /settings/accounts/:id` removes an account, a provider's default (the CLI's own login) included; a removed default stays removed until `POST /settings/accounts/default-<provider>/restore` adds it back (400 when it is already there or Antigravity already has an account, 404 for an unknown provider). `PUT /settings/balancing`
updates the balancing keys and returns `reserved_provider`; an old saved file’s boolean `save_claude_for_leads` carries over to `save_for_leads`. `PUT /settings/preferences` accepts `review_families` as `both`, `claude`, `gpt`, `gemini`, or `kimi` and returns it. Invalid values return 400.

`GET /usage` returns `{providers}` with each provider's forecast and account readings,
machine sign-in states, placement reason and live session count. `GET /usage/alert` returns
`{dot}`; `POST /usage/seen` marks current provider alerts seen for their refill week.
`POST /accounts/:id/signin` accepts `{machine}` and starts sign-in on that machine.
`GET /accounts/:id/signin/:machine` returns its state; `POST .../code` sends `{code}`;
`GET .../pane` and `POST .../keys` provide the login terminal. Unknown accounts or machines
return 404.

Reviewer starts accept optional `round` (a positive integer), exposed in session data; `wc.js session start --round <N>` supplies it. Other roles and invalid values are refused before attempt deduplication, and a retry preserves the stored round.

Session starts through `POST /machine/session` accept `role`, `tier`, `brief`, `attempt_id`, and optional `provider` or `not_provider` (`claude`, `gpt`, `gemini`, or `kimi`) for workers, reviewers and verifiers. The flags are mutually exclusive; the reserve follows the first signed-in provider in lead order. A worker preference for a provider with no signed-in account is dropped with a note; a signed-in preference remains strict, subject to the reserve margin. Reviewer and verifier constraints are preferences when `review_families` is `both`. For a single-family setting, those flags are ignored and the chosen family is used or waited for; if it is signed out or its model is unused, normal placement applies with a note. The obsolete `cli` field is ignored. The response has `session` and may have a `note`. Sessions carry `provider` and `account`; a waiting session has `status: "waiting"`, `waiting_until`, `waiting_reason`, `waiting_provider` (the pinned provider, the first explicit lead-order provider for a new lead, or null), and `pending_start`. Its identity and queue survive promotion.

`POST /machine/session` with action `list` (and `wc.js session list`) returns `{sessions, review_families}`. `wc.js session list` and `session start` print a compact view by default with name, role, provider, model, status, live, ready, started_by, attempt_id, round, title, branch, and worktree; `--full` prints the raw response.

`wc.js diff size <feature-branch> <worker-branch> [--tricky]` runs locally with read-only git and prints JSON fields `lines`, `band`, `excluded_paths`, and `scout_diff`. Bands are `scout` below 200 lines, `bigger-scout` from 200 through 800, and `self` above 800 or with `--tricky`.

Machine events may carry a `reading`, including Codex `turn-ended` events; they include `usage` with a reading, `limit-hit` with `limited_until` and `error`, and `turn-failed` with `error`. A limit-ended turn never delivers a report: a future limit holds delivery until reset, while an already expired limit queues `Continue.` immediately, in both cases at the front of the queue. A failed turn releases the queue and informs the starter without delivering a partial reviewer or verifier report; a failed lead turn creates a needs card.

A sub-lead starting a worker may pass `--effort <e>` to `wc.js session start`; the
`POST /machine/session` start body carries it as `effort`. Other starts with effort receive
400 `effort can only be set for a worker`. Claude and Gemini accept low, medium, high, xhigh, max;
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

`GET /wheelchair/api/agents` returns `{leads, machines}` for unarchived threads with a lead session. Each lead has `thread_id`, `thread_title`, `lead_name`, `machine`, `project` (basename of the thread's project), `stage` (`idea`, `planning`, `review`, `building`, `verifying`, `done`, as on the Features page), `finished` (no live session), `finished_at` (latest `ended_at`, when finished), `asides` (open asides: `{kind:'aside', id, number, display_title, state}`, state `working` or `idle`), `counts` (`total`, `working`, `waiting`, `not_started`, `finished`, `idle`, over the lead and its descendants; a lead that needs the user counts as waiting), `session` (the newest lead) and `children`. Every session node keeps all sessions, finished ones included, omits `token`, `brief`, `steps`, `pending_ends`, `turns` and `step_counts`, and adds `display_title` (the start title, else the brief's first line, else the role; the thread title for a lead), `result_summary` (non-lead sessions with a result card: the newest one's summary; absent otherwise), `state` (`not-started`, `finished`, `needs-you` (lead only), `waiting`, `working`, `idle`), `waiting_on` (`{name, label}` when it messaged its starter and has had no reply, `{names, label}` for live unfinished children, else `null`), `has_brief` and `children`. Each lead also has `rounds.review`, keyed by review pass, with `found` and optional `clean: true` from the latest fixing or clean progress card for that pass, including replaced cards. Reviewer nodes with a result summary have `report: {findings, first}` parsed from finding lines. Finished nodes have `finished_at` from `ended_at`, the newest result card time, or their creation time, in that order. Machines carry `machine`, `reachable`, `last_seen`, and `hub`.

Threads include `lead_name`, retained until and after archive; archived threads release the name for reuse. Settings `lead_name_list` picks where names come from: `greek` (the default), `nato`, `stars` (one-word proper star names), `people` (popular US first names) or `custom`, which uses `lead_names`. A saved file from before the choice existed reads as `custom` when it has names. `lead_names` is an array of up to 1000 unique case-insensitive names, trimmed to 1–40 characters, with blank entries discarded; the Settings page fills it from an uploaded text file. `custom` with no names uses Greek letters. Sending `lead_names` without `lead_name_list` keeps the older meaning: names switch to `custom`, and an empty list switches `custom` back to `greek`. A new lead gets a random free name from the list; only when every plain name is held does it draw from "<name> 2", then "<name> 3". New session records include the resolved `model` and `effort` (which may be null). Older sessions may omit them.

Diagram cards accept optional `format` (`graph`, the default, `form`, or `html`). Image
cards are lead-only and contain `path` and `title`; stored image cards also carry `file`,
the basename supplied by the machine. Form and HTML diagrams register their plan but do
not enter the graph registry.

`POST /threads/:id/uploads?name=...` streams a raw file of at most 25 MiB to the lead's
machine and returns `201 {path}`. A lead waiting for room or starting counts as live: the hub passes `vouched=1`, so the machine does not judge the lead itself. It returns 409 for an archived thread or absent live lead,
and 413 for a missing or excessive Content-Length. `GET /threads/:id/files/:file` streams a
machine file whose name matches `[0-9]+-[A-Za-z0-9._-]+` and preserves its content headers.
`GET /threads/:id/graph?file=...json` reads an archived diagram as JSON;
`GET /threads/:id/diagram-html?file=...html` reads archived HTML with the static sandbox CSP.
Outside the API prefix, `GET /wheelchair/diagram-form?path=<absolute>` reads unchanged JSON
(up to 2 MiB) and `GET /wheelchair/diagram-html?path=<absolute>` serves static HTML with the
same CSP. Both require a file directly inside a registered plan's `graphs/` directory.
Archive leaves the thread open with a system needs card if the machine reports that upload
removal failed; its response includes `uploads_removed` and, on failure, `uploads_error`.

Quiet-turn detection persists `owes_reply`, `quiet_stage`, `quiet_check_at`,
`quiet_starter_at`, and `quiet_card` on sessions. The hub options `quietGraceMs` and
`quietEscalateMs` (or `WHEELCHAIR_QUIET_GRACE_MS` and `WHEELCHAIR_QUIET_ESCALATE_MS`)
set the grace and escalation intervals in milliseconds; defaults are 30000 and 600000.

### Agent activity and context

Each Agents API session node includes `context` (`{percent, at}` or null) and `activity`: `counts` for files, shell, helpers, web, starter and thinking; `trail`, the last five step kinds with adjacent repeats collapsed; `current` (`{kind, label, since, id}` for a running step, or Thinking without an id) or null; and `latest`, up to four `{label, at, state}` entries newest first. Failed labels begin with `Failed: `.

`POST /api/machine/events` accepts `step` events with `phase: start` and `step: {id, kind, label, key, started_at}`, or `phase: end` and `step: {id, ended_at, failed, clean}`; and `context` events with `context: {percent, at}`. These events do not deliver queued messages or change turn or hold state.

Each node has `question`, null or `{asked_at, to, trail, card_id}` for its latest unanswered asking message. Trail entries are `{who, at, text}` (first line, at most 80 characters); `card_id` identifies the open lead question when present. Each lead record has `question_paths`, arrays of session names from asker to lead for open passed-on question cards.

Message cards accept optional `asks` (boolean) and `passes_on` (string); question cards accept optional `passes_on` (string). A `passes_on` id must name an asking message in the same thread. Asking messages are delivered as `[wc:from <sender>] [question <id>] <text>`.

Handoff recovery: `POST /threads/:id/undo-handoff` starts or retries an undo;
`POST /threads/:id/retry-handoff` retries a saved operation; and
`POST /threads/:id/cancel-handoff` cancels before the claim is known to have landed.
They return `{outcome, id, note?}` or `409 {error}`. The thread view's `handoff_op`
is null or `{kind, last_error, can_cancel}`. A saved undo's handoff banner uses
`state: "undo-unfinished"` with `last_error` and `can_cancel`.

The threads list includes `revoke_notices: [{thread_id, sha, text}]` for failed
cancelled-claim revocations. `POST /handoff-revokes/dismiss` accepts
`{thread_id, sha}` and removes a matching failed notice.

`POST /threads/import?machine=<machine>&project=<project>` accepts a raw handoff file (at most 10 MB). It returns `{outcome, id, note?}` with outcome `created`, `advanced`, or `opened`; invalid files return 422, conflicts return 409, and oversized bodies return 413.

Handoff exports use version 2 with `who: user` for the user's history; version 1 files still import.
