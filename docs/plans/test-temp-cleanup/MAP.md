# Map: test temp cleanup

Tests allocate per-case roots, start services or child commands, then close processes. Machine and many viewer tests never remove system-temp roots; viewer's shared helper leaves checkout-local scratch to a later one-hour sweep (`machine/test/service.test.js:16`, `machine/test/service.test.js:65`, `viewer/test/helpers/server.js:26`, `viewer/test/helpers/server.js:100`). Shell fixture suites already remove their enclosing root on EXIT (`install/test/run.sh:8`, `codex/test/run.sh:8`, `seen/test/hook_test.sh:5`, `sensitivity/test/run.sh:7`).

```text
test -> temp root -> services and fixtures -> stop writers -> root remains
                                              -> shell EXIT removes fixture
```

The full allocation inventory, prefixes, lifetimes, teardown gaps, signals, subprocesses and TMPDIR behavior are in [test-temp-dirs](../../maps/test-temp-dirs.md). `service.test.js` has 85 static allocation call sites, so a run creates roughly that many or more roots; `wc-doc-` and `wc-git-` are independent viewer allocations (`machine/test/service.test.js:16`, `viewer/test/app-doc.spec.js:22`, `viewer/test/app-hub.test.js:668`). Cleanup needs to cover failure during setup and wait for all child processes, including the helper's KILL fallback, before removing their roots (`viewer/test/helpers/server.js:94`, `viewer/test/helpers/server.js:103`).

Not looked at: product-internal or external-tool allocations, actual historical leftovers, and runner internals. No tests were run.
