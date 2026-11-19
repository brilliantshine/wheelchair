# Map: cheap chat refresh

Checked against `899afb69395ed5dddc5828ae86bad1fd3e765947` (origin/main). The end-to-end flow, compatibility, callers and tests are in [chat transcript refresh](../../maps/chat-transcript-refresh.md); related historical maps are [thread page](../../maps/app-thread-page.md), [sessions](../../maps/app-sessions.md) and [handoffs](../../maps/thread-handoffs.md), with transcript-specific rechecks linked there.

```text
thread poll -> locked hub assembly -> machine source copy -> kept transcript -> whole reply -> parse
```

An idle poll still hashes the kept file, persists the machine registry, reads and transfers the whole copy, and parses it again (`machine/service.js:1217-1225`, `machine/service.js:1243-1245`, `viewer/app/chat.js:282-283`, `viewer/app/chat.js:325-329`). Reports require fresh reads; chat alone uses stale fallback, and aside creation also assembles chat (`viewer/app/sessions.js:428-435`, `viewer/app/chat.js:274-287`, `viewer/app/asides.js:34-37`). Chat's lock protects assembly against handoff mutations (`viewer/app/hub.js:250-264`, `viewer/test/app-handoff.test.js:373-381`).

The brief's stated 64 MB / 10-minute budget and identical-text parse reuse are not present at this commit: the lighter-server plan moved that work to this follow-up, and its later decision superseded the 64 MB cap (`docs/plans/lighter-server/PLAN.md:77`, `docs/plans/lighter-server/PLAN.md:87`, `docs/plans/lighter-server/PLAN.md:138`; `viewer/app/chat.js:278-285`, `viewer/app/chat.js:325-329`). Earlier continuity proposals and their review findings are history, not the shipped contract (`docs/plans/lighter-server/PLAN.md:56-63`, `docs/plans/lighter-server/PLAN.md:220-269`).

## Not checked

Live performance, every parser and test assertion, and external consumers outside this repository.
