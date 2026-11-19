# Map: finished agents in the tree

Checked against: `207c02f5e0b56cfbcc96046cca10a8df92002a9c` (origin/main)
Files covered: `viewer/app/agents.js`, `viewer/app/sessions.js`, `viewer/app/state.js`, `viewer/app/routes.js`, `viewer/app/API.md`, `viewer/pages/agents.js`, `viewer/pages/views.css`, `viewer/test/app-agents.test.js`, `viewer/test/app-views.spec.js`, `viewer/test/helpers/app-views-setup.js`, `viewer/playwright.config.js`, `viewer/package.json`

```text
session start -> thread JSON -> Agents API builds parent tree -> page filters and draws boxes
                                                   -> select box -> URL -> details panel
                                                   -> show finished -> draw all boxes
```

A start creates a session in `thread.sessions` with name, role, `started_by`, `attempt_id`, `created_at`, optional title and brief; waiting starts are saved too (`viewer/app/sessions.js:213-238,280-298`). The hub persists each thread as `threads/<id>.json` under its state directory (`viewer/app/state.js:44,84-88,108-115`). `created_at` is creation, including waiting, and `ended_at` is set on stop or failure, not necessarily when a result arrives (`viewer/app/sessions.js:225-229,333,373-387,676-679`). Attempt IDs identify a caller's intended start and deduplicate retries; they are not a round number (`viewer/app/sessions.js:604-611`; `protocol/app/lead.md:82-83`).

`GET /wheelchair/api/agents` builds `{leads,machines}` from unarchived threads (`viewer/app/routes.js:86`; `viewer/app/agents.js:62-71,119-130`). Each node starts with the public session minus token, brief and pending start data, then adds children, state, title, result summary, activity, context, question and brief availability; raw step history is removed (`viewer/app/sessions.js:141-143`; `viewer/app/agents.js:71-77,89-110`; `viewer/app/API.md:163,195`). Parent links use `started_by`; old lead children attach to the newest lead and missing or cyclic parents fall back to it. Children sort by creation time (`viewer/app/agents.js:64-68,79-93`). A node is finished if not live or marked finished, including dead sessions; a result can mark finished before stop supplies an end time (`viewer/app/agents.js:106-110`; `viewer/app/sessions.js:373-387,676-679`). Only open asides are returned, as separate non-session nodes with working or idle state; finished asides cannot form decks from this payload (`viewer/app/agents.js:113-115`).

The page polls agents and thread timestamps every five seconds; selection is `?lead=` and `?agent=` and survives a redraw (`viewer/pages/agents.js:42-44,89-105,137-138`). Finished nodes are hidden by default except the selected node and ancestors of retained nodes; the toggle redraws them (`viewer/pages/agents.js:6,117-126`). Recursive branches draw one button per session, role/title/status inside; open asides are non-selectable divs. CSS draws parent stems and sibling bars and dashed finished borders (`viewer/pages/agents.js:124-127`; `viewer/pages/views.css:135-154`). Selecting a node renders its role, title, model, machine, duration, status, result, brief and activity in the right panel; terminal is available while live (`viewer/pages/agents.js:32-34,46,134`). Redraw preserves tree zoom/scroll and selected panel scroll, with refresh deferred during pointer gestures (`viewer/pages/agents.js:14-25,89-94,133-138`).

`viewer/test/app-agents.test.js:35-121` tests hierarchy, finished states, titles, result ownership, secrets and cycles. `viewer/test/app-views.spec.js:8-19,58-93,258-340` runs page cases for desktop and phone including links, selection and finished toggle, with intercepted fixtures; `viewer/test/helpers/app-views-setup.js:68-97` supplies isolated server and fake machine setup. Browser projects and command are in `viewer/playwright.config.js:8-16` and `viewer/package.json:8`.

## What I did not look at

Machine transcript storage internals, all activity rendering, or every browser test case. This focused map supersedes overlapping claims in older Agents and session maps only for the files and flows above.
