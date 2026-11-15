# App API

All browser routes are below `/wheelchair/api/`, use the viewer remember cookie (or graph
token during sign-in), and require the viewer origin on writes. Responses are JSON. The
machine callback routes use `X-Wheelchair-Machine-Secret` instead, and do not accept a
browser cookie or an Origin requirement. This is the contract for the page tasks.

| Route | Request | Response |
|---|---|---|
| `GET /threads` | — | `{threads:[Thread]}` newest first |
| `POST /threads` | `{project,cli,machine?,message?}` | a `Thread`, with its lead started |
| `GET /threads/:id/chat` | — | `{thread,items,cards,pinned,queued}` |
| `POST /threads/:id/messages` | `{text}` | `{queued:true}`; delivery waits for the lead turn end |
| `POST /threads/:id/cards/:cardId/press` | `{action,value?}` | `{queued:true,text}` for lead actions; `recheck` updates an approval in place, and `start-building` first re-checks Ready |
| `POST /threads/:id/open` | `{start_now?:boolean}` | a started stub, or `{waiting:true,thread}` |
| `POST /threads/:id/restart` | — | replacement lead session; its restart context is queued first |
| `POST /threads/:id/archive` | — | the machine archive response |
| `GET /threads/:id/doc?file=PLAN.md` | — | `{content}` from the archived branch, read-only |
| `GET /features` | — | `{idea,planning,review,building,verifying,done,needs}` |
| `GET /projects` | — | `{projects:[path]}`, the repos in `projects.json`, added when a thread is created |
| `GET /sessions` | — | machine groups `{machine,reachable,last_seen,sessions}`; other tmux sessions appear as `{name,managed:false}` (read-only) |
| `GET /sessions/:name/pane` | — | `{pane}` |
| `POST /sessions/:name/keys` | `{keys}` | `{ok:true}` |
| `POST /machine/cards` | service envelope `{thread_id,session,...card}` | accepted card, `202` |
| `POST /machine/events` | `{thread_id,session,type,...}` | `{ok:true}`, `202` |
| `POST /machine/session` | `{calling_session,action,...}` | the hub-authorized session result |

`Thread` has `id`, `project`, `cli`, `machine`, `stub`, `context`, `parent`,
`depends_on_parent`, `waiting_on_parent`, `sessions`, `cards`, `pinned`, `queues`,
`worktree`, `branch`, `slug`, and `archived`. Card records retain their card fields plus `id`,
`session`, `at`, `created_at`, `answered`, and `system`. `at` is the ISO time the hub stored the card.

Chat `items` are `{type:"human"|"assistant"|"tool"|"context",text,at}`. `at` is the
ISO timestamp on that transcript line, so pages can interleave chat and cards in time order.
`human` card presses include `card:true`; context items include `context:"stub"|"restart"`.
Tool items are collapsed summaries; the transcript remains the authoritative detail.

Session start (`wc.js session start --tier`, and the hub's own lead starts, which use `top`): the hub
turns the tier into the machine request's `model`. Codex takes `luna`, `terra`, `sol` (resolved through
`codex/model.sh <tier>`) or `top` (Sol); Claude takes `haiku`, `sonnet`, `opus` (passed as `--model`)
or `top` (no `--model`). A tier that does not fit the CLI is a 400 with the reason. A start is a 409
("machine service out of date") while that machine's `/v1/status` commit differs from the hub's.
