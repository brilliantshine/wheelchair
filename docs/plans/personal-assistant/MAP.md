# Map: personal assistant

The current hub owns a cross-project inventory, but agent APIs are scoped to the caller's thread and machine. Starting a thread currently requires a project and machine, and starts its lead as part of creation (`viewer/app/threads.js:59-83`). The detailed flow, source pointers and limits are in [cross-project assistant runtime](../../maps/personal-assistant-runtime.md), checked against origin/main `25f34a4572c4beb9032f16f818b6502cc59f62bd` and this checkout.

```text
hub thread records -> list and Needs you -> user
                   -> same-machine lead discovery -> linked lead message -> lead queue
project + machine -> thread creation -> lead session -> worktree and role prompt
```

- **Seeing status:** `allThreads` spans hub records and the browser's list/features expose summaries, but agent `session leads --all-projects` excludes other machines and hides detailed status of unlinked projects (`viewer/app/state.js:194-200`; `viewer/app/routes.js:511-540`; `viewer/app/views.js:20-52`; `viewer/app/peers.js:42-65`). Decide what assistant-visible state and machine reachability mean, including archived and handed-off threads.
- **Starting and steering:** agent session start only creates permitted subordinate roles inside the caller's existing thread; no lead-start action is in that interface (`viewer/app/sessions.js:128-141,729-781`). Browser thread creation and restart are separate routes (`viewer/app/routes.js:542-544,709-710`). Cross-project messages require same-machine reach approval, and rate limiting applies (`viewer/app/cards.js:175-194`; `viewer/app/threads.js:330-349`). Decide whether and how the assistant gets independent authority to create, restart and steer leads, and how those existing consent and rate boundaries apply.
- **Identity and presentation:** session records, prompt creation and card acceptance all assume a thread and project (`viewer/app/threads.js:21-40`; `viewer/app/sessions.js:368-387,729-731`; `viewer/app/cards.js:58-71`; `machine/service.js:791-825`). Decide whether the assistant lives in a special thread/project or needs a separate identity, persistence and user-facing conversation; Needs you currently derives from thread cards (`viewer/app/views.js:140-150`).
- **New role:** registration spans session roles and start policy, card permissions, settings templates and lessons, model slots and placement, machine role prompt composition and role protocol (`viewer/app/sessions.js:128-141`; `viewer/app/card.js:29-51`; `viewer/app/settings.js:14-24,223-257`; `viewer/app/balancer.js:12-18`; `machine/service.js:198-211`). Decide its user-facing cards, model and provider policy, instruction layers and lifecycle before implementing.

Existing area maps were compared with fetched origin/main; their covered files changed, so their historical claims are not relied on here. The linked map rechecks the paths relevant to this idea. Not checked: every connector, full card schemas, handoff/import internals, and complete settings UI or authorization surfaces.
