# Map: New thread stubs

Checked against `8f8b262c5270c8ae4d38aa0b65feb7e028b53566` (origin/main). Detailed flow and coverage: [New thread and stub flow](../../maps/new-thread-stub-flow.md). The older [stub lifecycle map](../../maps/stub-lifecycle.md) predates changes in its covered files; use the checked flow here for this feature.

```text
New thread -> create and start lead -> message or uploads then message
stub card -> child with context and parent -> list -> open -> lead receives context
```

- New thread always starts a lead, including with no message; its first line becomes the title. A lead-created stub instead saves summary as context and waits without a session (`viewer/app/threads.js:60`, `viewer/app/threads.js:96`).
- Both the upload route and the ordinary message route require a live lead. The existing create-then-upload-then-message flow therefore cannot populate a sessionless stub unchanged (`viewer/pages/new.js:208`, `viewer/app/routes.js:160`, `viewer/app/routes.js:755`).
- An independent parentless stub can use the existing unopened list badge and open action, but the transcript marker currently says `Started from parent thread` when no parent title exists. Parent dependency warnings also assume a parent when dependency is set (`viewer/pages/threads.js:73`, `viewer/pages/thread.js:627`, `connectors/hub-common.js:97`).
- Candidate stubs are visible to other leads and accept `adds_to` based on project, machine, status and sessions, regardless of parent; additions change the context delivered when opened and preserved on restart (`viewer/app/peers.js:44`, `viewer/app/cards.js:250`, `viewer/app/threads.js:121`, `viewer/app/threads.js:151`).

Not checked: machine-side upload storage and cleanup, all provider-specific transcript parsers, handoff and archive behavior beyond the guards in the detailed map, and unrelated screens and tests.
