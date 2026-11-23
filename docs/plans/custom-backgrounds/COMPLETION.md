---
slug: custom-backgrounds
date: 2026-11-20
implemented-by: standard gpt/gpt-6.1-terra (including xhigh completion lanes); sub-lead gpt/gpt-6.1-sol
verified-by: ["/root/finish_normal_use/verify_remediation (native independent)", "/root/finish_normal_use/verify_main_integration (native independent)"]
---

# Completion Report — Custom image and GIF backgrounds

Viewer-only implementation is complete. Initial independent verification found two normal-use readiness/focus gaps, fixed in REMEDIATION-1.md, and one accepted rare combination. Fresh independent verification passed on corrected commit4cf9349548597a09560b2c0197ce8736bb008177; validation ordering is recorded below.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Settings appended #background with picker/name/size/visibility/actions/local-copy | this run | viewer/pages/settings.js:8; viewer/pages/settings.js:1462 | background-editor.spec.js |
| Local native decoded preview; invalid candidate preserves previous; original bytes upload | this run | viewer/pages/settings.js:1413 | background-editor.spec.js:84; background-network.spec.js:100 |
| Clean follows remote; dirty captures observed revision; conflicts retain draft; Cancel latest | this run | viewer/pages/settings.js:1403; viewer/pages/settings.js:1446 | background-editor.spec.js:60 |
| Save disables edits and generation-scopes late success/error; same-section rebuild retains state | this run | viewer/pages/settings.js:1378; viewer/pages/settings.js:1446 | background-network.spec.js:181; background-network.spec.js:215 |
| Remove invalidates decoding; previews reset35; zero opacity retains image | this run | viewer/pages/settings.js:1491 | background-editor.spec.js:60; background-editor.spec.js:126 |
| Navigation/reload/pageshow discard local resources; no draft storage or broadcast | this run | viewer/pages/settings.js:1390; viewer/pages/settings.js:1501; viewer/pages/settings.js:1542 | background-editor.spec.js:84 |
| Initial baseline disables file choice; saved replacement loading disables slider while choose/remove remain usable | this run | viewer/pages/settings.js:1473 | background-readiness.spec.js:19; background-network.spec.js:165 |
| Normalized metadata defaults/type/hash/opacity/revision; unrelated settings survive | this run | viewer/app/background.js:7; viewer/app/settings.js:212 | background-completion.test.js:80 |
| Private immutable content-addressed files under stateDir; single hub writer | this run | viewer/app/background.js:17; viewer/app/background.js:63; viewer/app/API.md:214 | background.test.js:18; background-completion.test.js:80 |
| Settings queue transaction/revision recheck; atomic pre-rename mode; commit-safe errors | this run | viewer/app/background.js:63; viewer/app/state.js:23 | background-completion.test.js:142; background-completion.test.js:157 |
| Queued reference-aware cleanup/orphan initialization; cleanup error preserves success | this run | viewer/app/background.js:27; viewer/app/hub.js:60 | background-completion.test.js:157 |
| Missing image safe fallback with ordinary removal/replacement | this run | viewer/app/background.js:18; viewer/pages/background.js:44 | background-network.spec.js:202 |
| Authenticated reads and same-origin writes; private image bytes; no-store/nosniff | this run | viewer/server.js:1286; viewer/app/background.js:108 | background-completion.test.js:122; routes.test.js |
| Four background routes; strict keys/IDs/integers; reset35; unchanged PUT | this run | viewer/app/background.js:108 | background-completion.test.js:80 |
| Early binary/JSON dispatch;25MiB/4KiB declared and streamed bounds; aborted upload | this run | viewer/app/routes.js:41; viewer/app/background.js:37 | background-completion.test.js:122 |
| Bounded format signatures/container payload checks; safe errors; native UI decoding | this run | viewer/pages/background-format.js:15; viewer/app/background.js:159 | background-completion.test.js:67 |
| GIF block walk infinite loop/no-loop/finite/GIF87a promotion without frame changes | this run | viewer/pages/background-format.js:93 | background-completion.test.js:48; background.test.js:9 |
| Shared browser/CommonJS helper; original bounded bytes vs normalized preview | this run | viewer/pages/background-format.js:1; viewer/pages/settings.js:1422 | background-completion.test.js; background-editor.spec.js |
| Shared external renderer/css on eleven signed-in shells; ownership routers | this run | viewer/pages/background.js:1; viewer/pages/background.css:1; viewer/AGENTS.md | background-rendering.spec.js:107 |
| Fixed centered-cover decorative layer; only image opacity; original reset painting | this run | viewer/pages/background.js:13; viewer/pages/background.css:1 | background-editor.spec.js:111; background-rendering.spec.js:162 |
| Solid content surfaces, gutters,390/1280 widths, input/focus/scroll | this run | viewer/pages/background.css:5; viewer/pages/background.css:24; viewer/pages/settings.css | background-rendering.spec.js:107 |
| Standalone graph exempt; framed documents skip initialization before requests | this run | viewer/index.html; viewer/pages/background.js:6 | background-rendering.spec.js:107; existing graph browser suite |
| Visible10-second single-flight polling/focus/pageshow;15-second abort retry | this run | viewer/pages/background.js:68 | background-network.spec.js:59 |
| Revision-ordered metadata; preload with60-second timeout; retry unchanged image | this run | viewer/pages/background.js:44 | background-network.spec.js:39; background-network.spec.js:78 |
| Separate last saved display/preview; Cancel failure fallback/reset/missing default | this run | viewer/pages/background.js:8; viewer/pages/background.js:88 | background-network.spec.js:138; background-network.spec.js:202 |
| No repeated image/node assignment on opacity/poll; native GIF beyond finite stop | this run | viewer/pages/background.js:23; viewer/pages/background.js:54 | background-editor.spec.js:111; background-rendering.spec.js:77 |
| Narrow img-src blob CSP; no arbitrary HTML/styles from images | this run | viewer/server.js:45; viewer/pages/settings.js:1424 | routes.test.js; background-completion.test.js |
| Isolated shared/helper and manual browser fixture state; sequential restart | this run | viewer/test/helpers/server.js:66; viewer/test/pages.spec.js:85; viewer/test/server-isolation.test.js | server-isolation.test.js; background.test.js:18 |
| All eight Settings categories keep unboxed text/control groups opaque, with transparent outer gutters | this run | viewer/pages/background.css:28 | background-settings-surfaces.spec.js:25 (red before fix, green both browsers) |
| Thread controls wait for own initial data; slow appearance metadata does not block Send | this run | viewer/pages/thread.html:50; viewer/pages/thread.js:1141 | background-rendering.spec.js:200 (red before fix, green both browsers) |
| Unchanged clean polling preserves slider keyboard focus and native image identity | this run | viewer/pages/settings.js:1413; viewer/pages/settings.js:1506 | background-readiness.spec.js:45 |
| Existing auth, graph interactions and unrelated Settings behavior | pre-existing | viewer/server.js; viewer/pages/settings.js | pre-existing architecture; full Node and both-browser suite |

## Deviations from plan

None in product scope. Existing helper/test environment requires command-local Git default branch and writable private Firefox config; no persistent user configuration is changed.

## Routers

Bootstrap root ROUTER.md, machine/ROUTER.md, protocol/ROUTER.md, viewer/ROUTER.md and viewer/app/ROUTER.md explicitly included in18bb3257. viewer/AGENTS.md and viewer/ROUTER.md describe background module/helper/renderer ownership and isolated server state. No machine implementation changed.

## Validation evidence

Every run uses a distinct private /tmp root. Browser setup creates config/cache/runtime/tmp and chmod0700 runtime, then sets TMPDIR=<root>/tmp XDG_CONFIG_HOME=<root>/config XDG_CACHE_HOME=<root>/cache XDG_RUNTIME_DIR=<root>/runtime GSETTINGS_BACKEND=memory PLAYWRIGHT_BROWSERS_PATH=/home/junjie/.cache/ms-playwright. No HOME/global Git changes, installation, live viewer or live model smoke suite. Shared helper state was isolated before feature tests; the later manual pages.spec.js fixture audit added its own temporary --state-dir before the final runs. That earlier fixture could attempt default hub initialization; actual user state was not inspected for diagnosis.

Full required Node command (before only CSS/HTML/browser-test follow-ups):

```text
TMPDIR=/tmp/backgrounds-resume-node-DDlhDq/tmp GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=init.defaultBranch GIT_CONFIG_VALUE_0=main node --test viewer/test/*.test.js
# tests 707
# pass 707
# fail 0
# cancelled 0
# skipped 0
# duration_ms 104665.447438
exit 0
```

Log /tmp/backgrounds-resume-node-DDlhDq/output.log. The command-local Git setting is needed because existing fixture tests assume main; no persistent Git config changed.

Full required browser command on068a4dc3, including the initial-composer fix and all50 then-existing appearance cases:

```text
npm --prefix viewer run test:browser -- --output=/tmp/backgrounds-delivery-browser-bd0p9i/results
Running 1124 tests using 2 workers
34 skipped
1090 passed (13.4m)
exit 0
```

Log /tmp/backgrounds-delivery-browser-bd0p9i/output.log. Both Chromium and Firefox execute. No failures/did-not-run cases. The34 skipped cases are existing suite conditions; no appearance case was skipped.

After that full command, the only product addition is the conditional Settings inner-surface CSS rule at background.css:28. The new two-browser category loop covers previously untested active-image Settings sections; all existing appearance cases were rerun with it on final source:

```text
npm --prefix viewer run test:browser -- background-editor.spec.js background-network.spec.js background-rendering.spec.js background-settings-surfaces.spec.js --output=/tmp/backgrounds-appearance-verified-oCRys4/results
Running 52 tests using 2 workers
52 passed (45.3s)
exit 0
```

Log /tmp/backgrounds-appearance-verified-oCRys4/output.log. This is exact combined coverage, not a claim that a full1126 command ran after the final CSS rule. At that gate no JS/routes/persistence had changed after the clean full command; the later bounded Settings JS remediation and its targeted validation are recorded separately below.

Relevant Node follow-up after the HTML correction:

```text
TMPDIR=/tmp/backgrounds-final-routes-nQy4kA/tmp node --test viewer/test/routes.test.js viewer/test/server-isolation.test.js
# tests 23
# pass 23
# fail 0
# duration_ms 5122.834859
exit 0
```

Log /tmp/backgrounds-final-routes-nQy4kA/output.log. JS syntax checks for source/new tests and git diff --check exit0.

Reports/T6.md preserves the earlier failed/superseded attempts, isolated reruns and expected red/green tests. Initial data readiness failed in both browsers before the three native disabled attributes, then passed while appearance metadata stayed held. The seven-category readability test failed before the final inner-surface rule, then passed in both browsers. The earlier broad failures are not reported as final passes.

Exact final screenshot paths are listed in reports/SCREENSHOTS.md. They include nonuniform100% Settings/thread/agents/terminal at1280/390 in both browsers and Project tools in both browsers. Earlier global /tmp/backgrounds-T5-artifacts paths are superseded because concurrent runs overwrote them.

## Known gaps / residual risks

The previous seven Accepted Risks in PLAN.md remain unchanged: external file loss/corruption, multiple hub writers, orphan files after crash, abnormal filesystem permissions, exhaustive browser/failure combinations, narrow metadata/cleanup read race, and repeated uncached navigation downloads. Ordinary restart/network/navigation/multiple-device behavior remains required and covered. Verification-1 additionally accepts the explicitly documented compound invalid-candidate/remote-replacement/slider overlap; it does not excuse initial loading loss or unchanged-poll focus theft.

## Remediation rounds

### Remediation-1 — 2026-11-23

The initial verifier on75ee3319 independently confirmed the prior gate counts and reproduced initial file-selection loss, unchanged-poll keyboard-focus loss and a compound invalid-candidate/remote-replacement/slider overlap. The lead accepted only the compound sequence as a rare risk. Initial loading now disables file choice until metadata exists; effective-state comparison suppresses unchanged clean-editor rebuilds, retaining focused controls and the native saved image. Actual saved changes still update clean editors.

Coverage: `viewer/pages/settings.js:1413`, `:1470`, `:1473`, `:1506`; `viewer/test/background-readiness.spec.js:19`, `:45`. See REMEDIATION-1.md for exact red/green commands, final targeted suite and fresh independent result. No backend, storage, authentication or layout change was made in this remediation.


Final remediation validation: the two new regressions passed4/4 in both browsers after reproducing4/4 expected red failures. All appearance cases passed56/56 (47.2s), and relevant Settings cases passed66/66 (34.1s), in separate isolated commands. Exact commands, paths and the one test-only hash-navigation readiness correction are recorded in REMEDIATION-1.md. The prior broad Node/browser gate results remain historical passing evidence, not a claim that the whole suite reran after this bounded Settings-only JS change.


Fresh independent remediation verification passed on4cf9349548597a09560b2c0197ce8736bb008177: six targeted Chromium/Firefox cases passed (6.1s), including both normal-use regressions and real clean-editor remote updates. Source/syntax/diff checks passed with no new normal-use gap. Report and exact command are in REMEDIATION-1.md. The final report-record commit is documentation only; the verified source/tests are unchanged.


## Current main integration

Upstream main0682593b was merged in d83cb509 with all incoming functionality retained. Background remains appended to the now-eight-section Settings UI; combined preferences retain Harnesses/onboarding/lessons/auto-merge/user-name fields. Lesson deep-links release local previews; the new sent-file shell loads shared appearance assets; Harnesses inner surfaces stay opaque. Focused post-merge Node77, appearance58, Settings70 and Harnesses/sent-file20 checks pass. Exact commands and limits are in INTEGRATION.md. No broad evolved-upstream pass is claimed, and no accepted risk was reopened. Fresh independent integration verification follows the committed merge/test expectation record.


Fresh independent integration verification PASS on174b4607e831df60a0b6d3d00994a90e16fab380:2 targeted Node and14 both-browser cases pass with no normal-use gap. The verifier confirmed incoming Harnesses is byte-for-byte preserved and settings differs from current main only by background defaults/normalization. All eight accepted risks stay closed; source/tests remain unchanged by the documentation-only verification record. See INTEGRATION.md for exact commands and limits.
