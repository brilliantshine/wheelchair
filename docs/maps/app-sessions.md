# Map: message delivery and machine archive

Checked against: `7c380321f4556a08b63485203d613feeeae1f640` (origin/main)
Files covered: `viewer/app/routes.js`, `viewer/app/sessions.js`, `viewer/app/threads.js`, `viewer/app/state.js`, `viewer/app/machine-client.js`, `machine/service.js`

## Flow

1. A browser message selects the latest live lead (`viewer/app/routes.js:343-350`). The hub appends it to the lead's persisted queue and attempts delivery; delivery waits for live, ready, turn-ended, unheld state (`viewer/app/sessions.js:245-266,335-341`). A failed machine call keeps the message queued; a successful submit removes it and records sent history (`viewer/app/sessions.js:278-297`).
2. Session start and delivery both address `thread.machine` (`viewer/app/sessions.js:151-157,280-281`); it comes from the thread's requested machine, defaulting to `hub` (`viewer/app/threads.js:16-24,60-62`). `hub` can resolve to the uniquely matching local machine record (`viewer/app/state.js:152-168`). The machine client reads that machine's secret or secret file and sends `x-wheelchair-machine-secret` (`viewer/app/machine-client.js:53-70`); the service checks it for hub routes, while agent routes use a session token (`machine/service.js:192-209,829-834`).
3. Machine `/submit` requires a ready managed session, loads a tmux buffer, pastes with `-p`, and presses Enter (`machine/service.js:385-393,829-834`). Both the hub JSON reader and machine JSON reader accumulate all chunks without an application-level size check (`viewer/app/routes.js:13-21,32-36`; `machine/service.js:99-108`).
4. Archive calls the thread's machine `/v1/archive` (`viewer/app/threads.js:157-160`; `machine/service.js:828`). The service stops sessions, commits dirty service-created non-verifier worktrees where possible, and removes clean ones with `git worktree remove`. It retains worktrees on rebase or other failures and keeps their session records as `archived_pending` (`machine/service.js:430-486`). The hub leaves the thread unarchived for a retained rebase, but marks it archived for other kept reasons (`viewer/app/threads.js:161-174`).

```text
message -> persisted queue -> ready and idle -> machine /submit -> tmux paste -> Enter
archive -> thread machine -> stop sessions -> commit if needed -> remove or retain worktree -> hub records result
```

## State layout

The machine defaults to `~/.local/state/wheelchair`, holding `machine.json`, `sessions.json`, `spool/cards`, `spool/events`, `worktrees/<project>/<branch>` and `transcripts/<thread>/<session>.jsonl` (`machine/service.js:24,130-160,250-256,502-507`). The hub defaults to the same directory on its own host and holds thread records, machine, project and settings files (`viewer/app/state.js:9,41-47,107-117`). Archive retains transcript copies (`machine/service.js:516-519`).

## What I did not look at

Account placement, session startup details, recovery and hooks beyond the turn-ended gate, and archive paths on other machines. This focused map replaces the older broad map because its covered files changed; the prior version remains in git history.

> Current risk-flow recheck at `635c45f07991f31191f2ab1443b52b4ee76559d5`: see [app-risks.md](app-risks.md). The original checked commit above still applies to the rest of this map; files have changed since then.
