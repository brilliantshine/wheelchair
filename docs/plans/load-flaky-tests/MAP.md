# Map: load-flaky-tests

Checked against: `9bd3be986490e12839778f2f5c470b28c3ef251d` (origin/main). See [load-sensitive tests](../../maps/load-sensitive-tests.md) for the named cases and [full test runs](../../maps/full-test-runs.md) for the runner and picker.

A full run starts browser workers alongside the sequential viewer-node, machine and remaining suites, then records every exit and fails on any nonzero result (`test-support/full-run.sh:47-58,60-73,84-107`). The named failures span process startup and signal races, local polling and timing budgets, browser rendering/requests, and a comparison against a live home directory; the observed reports do not establish each cause (`test-support/test/full-run.test.js:17,50-56`; `viewer/test/lifecycle.test.js:68-73`; `viewer/test/app-quiet.test.js:41`; `viewer/test/app-uploads-archive.test.js:92-105`; `viewer/test/app-hub.test.js:1327-1354`; `viewer/test/app-threads.spec.js:573-587`; `viewer/test/app-agents-decks.spec.js:247-277`; `machine/test/switch-http.test.js:136-159`; `install/test/run.sh:229-234,700-705`).

```text
full run -> browser workers ---------------------> suite result
         -> node and machine tests -> other tests -> suite results
         -> live home comparison ----------------> install result
         -> all results -> summary and overall exit
```

The holder's exit 1 has no captured stderr and is distinct from its 2 s start timeout; a port clash after the free-port probe is possible but unproved (`viewer/test/lifecycle.test.js:68-73`; `viewer/test/helpers/server.js:15-22`). The quiet case can let its 50 ms grace pass between turn end and asking message (`viewer/test/app-quiet.test.js:6,41`; `viewer/app/quiet.js:12,45-48`). The install hash detects live changes but cannot identify their writer (`install/test/run.sh:27-49,234,705`).

The escaped-keys completion report on `origin/wc/ac4d5c6479fe:docs/plans/escaped-keys/COMPLETION.md` reports the switch, verifier, upload and browser failures there and confirms the install failure on its main comparison; it does not prove the other failures occur on main. No test or full run was executed for this map.

Not checked: actual failing logs, live account contents, all helpers and timeout knobs, or a load reproduction.
