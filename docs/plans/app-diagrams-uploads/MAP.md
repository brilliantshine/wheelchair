# Map: diagram cards and uploads

Checked against `7c380321f4556a08b63485203d613feeeae1f640` (origin/main). The proposal and decisions D19, D20, D28, D29 and D46 set the desired behavior (`docs/proposals/app-diagrams-uploads/proposal.md:1-27`; `docs/plans/app-shell/PLAN.md:62-72,89`).

```text
lead -> diagram card -> machine spool -> hub validation and storage -> chat poll -> graph iframe
message box -> hub lead queue -> thread machine -> tmux paste -> lead
archive -> thread machine -> stop and remove or retain worktrees -> hub records archive
```

A lead's existing card only permits `plan`, `graph` and `title`; the hub validates role and registers the graph before saving (`viewer/app/card.js:21-30,96,115-137`; `viewer/app/cards.js:38-55,79`). The machine attaches session and thread identity and spools before relay, including when the hub is down (`machine/service.js:837-854`). Cards are returned by chat and rendered in a full-width, 340px-high unsandboxed graph iframe with a full-screen link; phone cards can use the available width (`viewer/app/chat.js:202-229`; `viewer/pages/thread.js:166-170,571-581`; `viewer/pages/thread.css:176-182,204-225`). The app page allows same-origin frames; the existing graph page response has no CSP header in either graph branch (`viewer/server.js:47,1830-1832,1912-1936`). The requested sandboxed HTML and four formats are not supported by the current card schema (`viewer/app/card.js:96,121-126`). Archived graph data instead comes from the committed branch, with a 2 MiB `git show` buffer (`viewer/app/threads.js:195-208`).

The composer currently sends trimmed nonempty text only (`viewer/pages/thread.html:33-42`; `viewer/pages/thread.js:732-745`). The hub picks the most recent live lead, persists its queue, and submits once ready and idle; failed submission stays queued (`viewer/app/routes.js:343-350`; `viewer/app/sessions.js:245-285`). The machine destination is `thread.machine`, also used to start the lead; its shared secret authenticates hub calls (`viewer/app/sessions.js:151-157,280-281`; `viewer/app/machine-client.js:53-70`; `machine/service.js:192-209`). The service pastes into tmux and presses Enter (`machine/service.js:385-393`). Both JSON body readers buffer all chunks without a size limit; neither supplies the proposed 25 MB file limit (`viewer/app/routes.js:13-21`; `machine/service.js:99-108`).

The machine's default state root is `~/.local/state/wheelchair`; it owns worktrees, session records, spools and transcript copies there (`machine/service.js:24,130-160,250-256,502-507`). Archive goes to `thread.machine`; the service stops sessions and removes clean service-created worktrees after saving dirty work, retaining failed ones (`viewer/app/threads.js:157-160`; `machine/service.js:430-486`). A retained rebase leaves the hub thread unarchived, but other retained-worktree reasons do not (`viewer/app/threads.js:161-174`). There is no upload cleanup in that archive code (`machine/service.js:430-486`).

Further flows and boundaries: `docs/maps/app-thread-page.md`, `docs/maps/app-sessions.md`, `docs/maps/viewer-serving.md`.

## What I did not look at

Browser behavior under actual phone viewport, reverse proxies and their body limits, graph layout internals, account placement, or archive behavior across machines other than the thread machine.
