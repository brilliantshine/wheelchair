# Remediation 1 — Initial loading and clean polling

Date: 2026-11-23
Baseline: 75ee33193f699a19ed40e9f48cc74aa97b0b919a

## Findings and dispositions

| Finding | Disposition | Result |
|---|---|---|
| A valid local file can be selected before initial metadata, decoded and then discarded. | Fix: normal slow first load and ordinary file choice. | Disable the native file picker until saved metadata exists. It remains usable while a later saved image is loading. |
| Every unchanged metadata poll rebuilds clean controls and steals slider keyboard focus. | Fix: normal ten-second polling and keyboard use. | Compare effective metadata, readiness, display availability and error with the last rendered state; skip an identical clean-editor repaint. Actual remote changes still repaint. |
| Pending invalid candidate + independent remote replacement + local slider input overlap. | Accepted risk, per the lead's explicit realism disposition. | Recorded in PLAN.md Accepted Risks with round verification-1. No separate recovery subsystem or exhaustive matrix. |

The correction changes only the Settings editor, its focused regression tests and feature-state documents. The prior seven Accepted Risks stay closed. Backend persistence, revision ordering, preview tokens and image ownership are unchanged.

## Validation

Each command uses a fresh private temporary root, with writable config/cache/runtime/tmp, mode0700 runtime; TMPDIR/XDG_CONFIG_HOME/XDG_CACHE_HOME/XDG_RUNTIME_DIR point inside that root, GSETTINGS_BACKEND=memory and PLAYWRIGHT_BROWSERS_PATH=/home/junjie/.cache/ms-playwright. Tests start isolated helper servers with temporary state/cache roots. No HOME/global config, live state, installation or model-consuming smoke suite is used.

New regression before source change:

```text
npm --prefix viewer run test:browser -- background-readiness.spec.js --output=/tmp/backgrounds-remediation-red-RC0IkO/results
Running 4 tests using 2 workers
4 failed (expected red: both findings reproduced in Chromium and Firefox)
exit 1
```

Log: /tmp/backgrounds-remediation-red-RC0IkO/output.log. The picker is enabled while held initial metadata is null; the slider loses focus after a real unchanged metadata refresh.

After source change:

```text
npm --prefix viewer run test:browser -- background-readiness.spec.js --output=/tmp/backgrounds-remediation-green-05e80Z/results
Running 4 tests using 2 workers
4 passed (3.7s)
exit 0
```

Log: /tmp/backgrounds-remediation-green-05e80Z/output.log. After metadata release the first enabled file choice previews and saves; unchanged refresh retains the exact focused slider and saved image, makes no image read, and keyboard ArrowRight changes visibility and enables Save.

Final appearance gate:

```text
npm --prefix viewer run test:browser -- background-editor.spec.js background-network.spec.js background-rendering.spec.js background-settings-surfaces.spec.js background-readiness.spec.js --output=/tmp/backgrounds-remediation-appearance-final-tVzVtE/results
Running 56 tests using 2 workers
56 passed (47.2s)
exit 0
```

Log: /tmp/backgrounds-remediation-appearance-final-tVzVtE/output.log. Both browsers execute every appearance case, including the two new regressions. This rerun preserves clean remote updates, native GIF playback, image identity, preview ownership and readable surfaces.

Earlier attempts are not passing evidence: the combined appearance/Settings command was interrupted with SIGTERM after 106 passing cases; a newly started combined retry was intentionally stopped and split into bounded commands. The first completed appearance-only command passed55/56, with the Chromium category loop inspecting shared `.models` selectors during a hash transition. The test now waits for the target tab's `aria-current=page` before inspection; its opaque-surface and gutter assertions are unchanged. The final56/56 result above follows that test-only readiness correction.

Relevant Settings gate:

```text
npm --prefix viewer run test:browser -- app-settings.spec.js --output=/tmp/backgrounds-remediation-settings-ivcCxX/results
Running 66 tests using 2 workers
66 passed (34.1s)
exit 0
```

Log: /tmp/backgrounds-remediation-settings-ivcCxX/output.log. Native Settings navigation, model controls, writing/template behavior, uploads and mobile layouts remain covered in both browsers.

`node --check` on the changed source and both test files, and `git diff --check`, exit0. Fresh independent verification is recorded below after completion. The previously clean broad Node/browser gates remain recorded in COMPLETION.md; this bounded Settings correction does not restart unrelated suites.


## Fresh independent verification

Verifier: /root/finish_normal_use/verify_remediation (native independent agent)

```text
COMMIT: 4cf9349548597a09560b2c0197ce8736bb008177
VERDICT: PASS
npm --prefix viewer run test:browser -- background-readiness.spec.js background-editor.spec.js --grep 'file choice waits|unchanged saved metadata|clean editor follows shared' --output=/tmp/backgrounds-independent-remediation-OzIART/results
6 passed (6.1s)
exit 0
```

Log: /tmp/backgrounds-independent-remediation-OzIART/output.log. Independent source review confirms the initial metadata gate, unchanged focused-slider/image retention, and continued clean-editor updates on actual remote saves. Syntax and remediation whitespace checks pass; no normal-use gap was found. The documented compound overlap remains accepted. The verifier left the worktree clean and did not repeat broad suites.

The follow-up commit recording this report changes only feature-state documents; source and tests remain at the verified correction.
