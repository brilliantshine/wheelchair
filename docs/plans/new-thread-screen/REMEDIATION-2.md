# Remediation 2 — new-thread-screen

Verification attempt 2 (Codex verifier, `gpt-6.1-sol`) on `ccbc8b3b415189aadf8c8522eb171663093a52a5`: FAIL.

## Gap list (verbatim)

```
GAP: Machine-scoped project selection — a delayed refresh after Save overrides a later machine choice — reproduced in Chromium: save on hub, delay its refresh, select other and wait for `/srv/other-repo`, then release the refresh; the screen switches back to hub, selects `/srv/saved`, and enables Start. `viewer/pages/new.js:154` fetches outside `load()`’s sequence guard; `:155` and `:157` unconditionally replace state and selection.
```

This is the second fix attempt on the "machine-scoped project selection" gap (Remediation 1 was
the first, which closed the machine-switch and Remove paths). Attempt 1 patched each path that
writes the screen's state; this attempt removes the class: `load()`, which carries the
out-of-order guard, becomes the only code that replaces `state` or refills the dropdowns.

## Task

| # | Gap | Fix |
|---|-----|-----|
| R2 | Save's refresh bypasses `load()`'s guard | The Add submit handler refuses (returns, no request) when `state` is null or `state.machine !== machineEl.value`; posts with `machine: state.machine`; takes the added entry's path from the POST answer's `saved` list (the route returns that machine's entries); then calls `await load(addedPath)` instead of fetching `/new-thread` itself. `load()` is then the only place `state` is assigned from an answer and the only caller of `fillMachines`/`fillProjects`/`fillSaved` (the machine-change handler's `state.machine = null` stays). |

Lane: Claude standard (the family that built it). If this gap survives R2, it goes to the lead
as a plan defect rather than a third attempt.
