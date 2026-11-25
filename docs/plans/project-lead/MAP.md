# Map: project lead

Checked against `779e2560e9803e6a3e5ae7a511ad61b19a73b8b2` (origin/main). The current end-to-end evidence is in [project-assistant-flow](../../maps/project-assistant-flow.md).

```text
user enables assistant -> singleton lead -> all-project actions -> target leads
page -> singleton status -> same assistant conversation
thread list -> assistant row -> basename project groups
```

The personal assistant is a projectless hub thread, with a single opt-in setting, special prompt and machine directory; its authenticated actions read and operate across machines and projects (`viewer/app/assistant.js:17-41`; `viewer/app/assistant-actions.js:8-38`; `machine/service.js:634-638`). A project lead needs an explicit authorization boundary: current action dispatch checks the singleton caller but does not filter targets by project (`viewer/app/assistant-actions.js:8-14,25-26,40-78`). The existing `[wc:assistant]` marker already makes forwarded instructions and card presses visible as assistant actions, and lead rules treat them as user instructions (`viewer/app/assistant-actions.js:43,65`; `viewer/app/threads.js:339-341`; `protocol/app/lead.md:23`).

The popup currently always opens the singleton returned by `/assistant` and sends text without current page or project context (`viewer/pages/nav.js:171-180`; `viewer/pages/assistant-popup.js:8-14,337-345`). Choosing a project conversation and communicating page context are new behavior. The list pins one personal assistant above all projects and groups normal threads by basename, even across different full paths or machines (`viewer/pages/threads.js:104-114,145-155`). Project identity needs a deliberate definition: normal threads store a machine and checked path, while `session leads` compares the exact path and resolved machine and excludes assistant threads (`viewer/app/threads.js:21-25,59-66`; `viewer/app/peers.js:42-50`). Its same-project discovery is narrower than the personal assistant's all-machine thread actions (`viewer/app/assistant-actions.js:25-38`; `viewer/app/peers.js:42-63`).

Other singleton assumptions include the first-match lifecycle and authorization, shared assistant directory, global seen and preview keys, and single settings toggle (`viewer/app/assistant.js:17-27`; `viewer/app/assistant-actions.js:8-12`; `machine/service.js:634-638`; `viewer/pages/assistant-popup.js:8`; `viewer/pages/threads.js:197-202`; `viewer/pages/settings.js:558-560`). The two assistants' division of work, handoff and popup selection remain design choices; the current code does not implement a project lead.

Not checked: live provider behavior, every card press implementation, every page's own project context, or all tests and deployment configurations.
