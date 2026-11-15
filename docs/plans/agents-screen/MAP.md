# Agents screen: current code map

Checked against `7c380321f4556a08b63485203d613feeeae1f640` (origin/main). The reusable maps are `docs/maps/app-sessions.md`, `app-thread-page.md` and `viewer-serving.md`.

## Flow

A thread creates a lead; that lead starts children, and a sub-lead can start its own children. Each thread persists its sessions; `started_by` names the actual starter, and the internal name is `wc-<thread>-<role>[-N]` (`viewer/app/threads.js:20-36`, `:63-74`; `viewer/app/sessions.js:43-61`, `:130-146`, `:401-409`). Restart adds `lead-2` and retains the old lead and its children, moving only queued messages (`viewer/app/threads.js:118-153`). There is no friendly lead name in these records. A tree can follow `started_by`, but a restarted lead does not automatically become parent of the old lead's children.

The Sessions page polls `/threads` for titles and `/sessions` for machine groups every five seconds; cards show internal name, thread, machine, CLI, optional `model`, role, running status, attach command and terminal/thread links (`viewer/pages/sessions.js:47-87`, `:138-164`). The sessions endpoint normally returns machine records; if a machine is unreachable it falls back to the hub's live recorded sessions only (`viewer/app/views.js:109-141`). Pending starts exist only at the hub until machine start (`viewer/app/sessions.js:83-94`), so the reachable-machine list does not include them; archived machine sessions can also be removed (`machine/service.js:473-484`). The Threads endpoint returns all stored threads and token-stripped sessions (`viewer/app/routes.js:314-325`); its list polls that endpoint and features, rendering the entire row as a thread link (`viewer/pages/threads.js:40-67`, `:88-111`).

```text
thread -> lead -> child -> grandchild
   |        |       |
   |        +-------+---- result -> starter queue -> delivered after turn end
   +-> stored sessions -> Threads API
machine registry -> Sessions API -> machine-grouped cards -> terminal by session name
```

The terminal URL takes `?name=`, polls pane and sends keys through the hub (`viewer/pages/terminal.js:5-14`, `:59-70`, `:96-122`; `viewer/app/routes.js:370-401`). The app page allowlist and shared nav contain `sessions`; terminal also links back to it (`viewer/server.js:1830`, `viewer/pages/nav.js:38-41`, `viewer/pages/terminal.html:11-14`).

Settings are JSON at the hub's state directory `settings.json` (`viewer/app/state.js:41-47`, `:176-194`). Settings routes validate updates and `normalize` reconstructs known fields, dropping unknown top-level fields (`viewer/app/routes.js:118-122`, `:184-215`; `viewer/app/settings.js:171-196`, `:212-224`). No lead-name list exists in those defaults or normalized fields (`settings.js:27`, `:184-196`). Model pins are a separate file `~/.wheelchair/models`, read/written by `codex/model.sh` (`codex/model.sh:42`, `:123-129`, `:294-301`).

The hub picks provider/account, resolves model and effort by role/tier from those pins, and sends them to the machine; workers may request effort under a configured ceiling (`viewer/app/sessions.js:18-27`, `:64-71`, `:83-96`, `:120-123`, `:153-168`). The machine stores `effort` and the launch command, **not a `model` field** (`machine/service.js:301-308`), although the page tries to display `session.model` (`viewer/pages/sessions.js:61`). Both adapters put model and optional effort in argv (`machine/adapters/claude.js:21`, `machine/adapters/codex.js:30`). Waiting and recovered records may have even less metadata (`viewer/app/sessions.js:85-90`; `machine/service.js:173-185`).

A child result is sent to its `started_by`; reviewers and verifiers have their report extracted at turn end (`viewer/app/cards.js:87-93`, `viewer/app/sessions.js:205-228`). Hook events set `turn_ended` and release queued messages when ready and unheld (`machine/hook.sh:6-30`, `machine/lib/hook-post.js:15-30`, `machine/service.js:588-618`, `viewer/app/sessions.js:260-262`, `:278-297`, `:340-344`). There is no explicit parent-is-waiting-for-child field in this path: unfinished children and an idle parent do not establish which child, if any, the parent is waiting for. Placement `status: waiting` means waiting for provider capacity, a different condition (`sessions.js:83-94`).

## What I did not look at

- Full balancing and usage algorithms, detailed CLI hook payload translation, and transcript rendering beyond result extraction.
- Other file-based configuration outside Settings and model pins, visual styling, and browser test fixtures.
