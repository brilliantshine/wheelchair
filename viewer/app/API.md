# App API

All browser routes are below `/wheelchair/api/`, use the viewer remember cookie (or graph
token during sign-in), and require the viewer origin on writes. Responses are JSON. The
machine callback routes use `X-Wheelchair-Machine-Secret` instead, and do not accept a
browser cookie or an Origin requirement. This is the contract for the page tasks.

| Route | Request | Response |
|---|---|---|
| `GET /threads` | — | `{threads:[Thread]}` newest first |
| `POST /threads` | `{project,cli,machine?,message?}` | a `Thread`, with its lead started. Before anything is saved the thread's machine checks `project` (`GET /v1/projects?check=`): not a usable git repository → `400 "<path> <reason> on <machine>"`, unknown machine → `404`, no answer or an older service → `502`; nothing is saved or added to `projects.json` on any of these, and the stored `project` is the path the machine returned (`~` and `~/…` expanded there). A non-empty string `message` sets `title` from its trimmed, whitespace-collapsed first line, cut at a word boundary to 60 characters plus `…` |
| `GET /threads/:id/chat` | — | `{thread,items,cards,pinned,queued}`; `items` leaves out the lead's tool steps when Settings has `tool_steps:"hide"` |
| `POST /threads/:id/messages` | `{text}` | `{queued:true}`; delivery waits for the lead turn end |
| `POST /threads/:id/cards/:cardId/press` | `{action,value?}` | `{queued:true,text}` for lead actions and records `answered_action` and `answered_value` on an answered card; `recheck` updates an approval in place, and `start-building` first re-checks Ready |
| `POST /threads/:id/cards/:cardId/dismiss` | — | `{ok:true}`; closes an open `needs` card a lead posted (`resolved_by:"collin"`, shown dimmed as resolved). A `system` needs card is refused with 422, an unknown card with 404 |
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
| `GET /settings` | — | `{models,model_options,heads_up,permission_mode,codex_mode,tool_steps,other_agents,templates,in_use,style,style_version,projects,default_project_folder,saved_dirs}`; `projects` is `projects.json` plus every saved directory's path; templates include `in_use`, `live_sessions`, and `scope_missing` when a saved project is no longer listed |
| `PUT /settings/models` | `{provider:"claude"|"gpt",slot,model|null,effort?}` | `{models}`; `slot` is `light`, `standard`, `heavy`, `critical`, or `lead` |
| `POST /settings/models/heads-up` | `{action:"switch",tier,model}`, `{action:"skip",model}`, or `{action:"reset"}` | `{models,heads_up}` |
| `PUT /settings/preferences` | `{permission_mode?:"auto"|"bypass",codex_mode?:"sandboxed"|"unrestricted",tool_steps?:"show"|"hide",other_agents?:{reviewer?,verifier?,mapper?},default_project_folder?:string}` | saved preference values, including `default_project_folder`; that field is trimmed, `""` clears it, otherwise it must be absolute, exactly `~`, or start with `~/` (`~user` → `400`); it is not checked against a machine |
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
`--tier opus` runs whatever the Heavy cell holds. Every session receives a model; Claude also receives its
configured effort when present. A provider cell set to `none` is a 400 directing the caller to the other CLI.
A start is a 409 ("machine service out of date") while that machine's `/v1/status` commit differs from the hub's.

Worker restart (`wc.js session start --role worker ... --replaces <session>`): the hub checks the named session is a worker in the same thread and not live, then starts the new worker in that session's `worktree` on its `branch`. A live session or a non-worker is refused with 400.
