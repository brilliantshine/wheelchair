---
slug: custom-backgrounds
date: 2026-11-20
implemented-by: standard gpt/gpt-6.1-terra (including xhigh completion lanes); sub-lead gpt/gpt-6.1-sol
verified-by: []
---

# Completion Report — Custom image and GIF backgrounds

DRAFT: Final full-browser validation is running on3ab9a309. This document will be completed before verifying status.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Settings appended #background with picker/name/size/visibility/actions/local-copy | this run | viewer/pages/settings.js:8; viewer/pages/settings.js:1462 | background-editor.spec.js |
| Local native decoded preview; invalid candidate preserves previous; original bytes upload | this run | viewer/pages/settings.js:1413 | background-editor.spec.js:84; background-network.spec.js:100 |
| Clean follows remote; dirty captures observed revision; conflicts retain draft; Cancel latest | this run | viewer/pages/settings.js:1403; viewer/pages/settings.js:1446 | background-editor.spec.js:60 |
| Save disables edits and generation-scopes late success/error; same-section rebuild retains state | this run | viewer/pages/settings.js:1378; viewer/pages/settings.js:1446 | background-network.spec.js:181; background-network.spec.js:215 |
| Remove invalidates decoding; previews reset35; zero opacity retains image | this run | viewer/pages/settings.js:1491 | background-editor.spec.js:60; background-editor.spec.js:126 |
| Navigation/reload/pageshow discard local resources; no draft storage or broadcast | this run | viewer/pages/settings.js:1390; viewer/pages/settings.js:1501; viewer/pages/settings.js:1542 | background-editor.spec.js:84 |
| Baseline loading disables slider while choose/remove remain usable | this run | viewer/pages/settings.js:1468 | background-network.spec.js:165 |
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
| Shared external renderer/css on ten signed-in shells; ownership routers | this run | viewer/pages/background.js:1; viewer/pages/background.css:1; viewer/AGENTS.md | background-rendering.spec.js:106 |
| Fixed centered-cover decorative layer; only image opacity; original reset painting | this run | viewer/pages/background.js:13; viewer/pages/background.css:1 | background-editor.spec.js:111; background-rendering.spec.js:162 |
| Solid content surfaces, gutters,390/1280 widths, input/focus/scroll | this run | viewer/pages/background.css:5; viewer/pages/background.css:23; viewer/pages/settings.css | background-rendering.spec.js:106 |
| Standalone graph exempt; framed documents skip initialization before requests | this run | viewer/index.html; viewer/pages/background.js:6 | background-rendering.spec.js:106; existing graph browser suite |
| Visible10-second single-flight polling/focus/pageshow;15-second abort retry | this run | viewer/pages/background.js:68 | background-network.spec.js:59 |
| Revision-ordered metadata; preload with60-second timeout; retry unchanged image | this run | viewer/pages/background.js:44 | background-network.spec.js:39; background-network.spec.js:78 |
| Separate last saved display/preview; Cancel failure fallback/reset/missing default | this run | viewer/pages/background.js:8; viewer/pages/background.js:88 | background-network.spec.js:138; background-network.spec.js:202 |
| No repeated image/node assignment on opacity/poll; native GIF beyond finite stop | this run | viewer/pages/background.js:23; viewer/pages/background.js:54 | background-editor.spec.js:111; background-rendering.spec.js:106 |
| Narrow img-src blob CSP; no arbitrary HTML/styles from images | this run | viewer/server.js:45; viewer/pages/settings.js:1424 | routes.test.js; background-completion.test.js |
| Test helper isolated state before appearance requests; sequential restart | this run | viewer/test/helpers/server.js; viewer/test/server-isolation.test.js | server-isolation.test.js; background.test.js:18 |
| Existing auth, graph interactions and unrelated Settings behavior | pre-existing | viewer/server.js; viewer/pages/settings.js | pre-existing architecture; full Node and both-browser suite |

## Deviations from plan

None in product scope. Existing helper/test environment requires command-local Git default branch and writable private Firefox config; no persistent user configuration is changed.

## Routers

Bootstrap root ROUTER.md, machine/ROUTER.md, protocol/ROUTER.md, viewer/ROUTER.md and viewer/app/ROUTER.md explicitly included in18bb3257. viewer/AGENTS.md and viewer/ROUTER.md describe background module/helper/renderer ownership and isolated server state. No machine implementation changed.

## Validation evidence

Each invocation uses a distinct mktemp directory under /tmp, with private config/cache/runtime/tmp (runtime0700). Browser environment: TMPDIR=<root>/tmp XDG_CONFIG_HOME=<root>/config XDG_CACHE_HOME=<root>/cache XDG_RUNTIME_DIR=<root>/runtime GSETTINGS_BACKEND=memory PLAYWRIGHT_BROWSERS_PATH=/home/junjie/.cache/ms-playwright. No live viewer, installation or live model smoke suite used. Shared helpers isolate state; the audit additionally corrected the manual pages.spec.js server fixture, which could previously attempt default hub initialization. The agent did not inspect or alter actual user state.

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

Full log /tmp/backgrounds-resume-node-DDlhDq/output.log.

```text
npm --prefix viewer run test:browser -- background-editor.spec.js background-network.spec.js --output=/tmp/backgrounds-resume-T7-tjKiXB/results
Running 40 tests using 2 workers
40 passed (58.7s)
exit 0
```

Full log /tmp/backgrounds-resume-T7-tjKiXB/output.log. Screenshot paths: /tmp/backgrounds-resume-T7-tjKiXB/results/background-editor-represen-d1a88-re-appearance-after-removal-{chromium,firefox}/settings-{1280,390}.png. These private paths supersede the older colliding global artifacts.

Superseded broad browser runs were intentionally interrupted during the readability/fixture audit. The initial1114-case run exposed a stale exact CSP expectation, now corrected without widening any additional directive. The final1122-case run includes all eight T6 checks and isolated manual fixtures; its final evidence follows when complete.

```text
npm --prefix viewer run test:browser -- background-rendering.spec.js --output=/tmp/backgrounds-T6-final-xxI2wj/results
8 passed (26.6s)
exit 0
npm --prefix viewer run test:browser -- pages.spec.js --output=/tmp/backgrounds-pages-final-GJgVps/results
20 passed (11.3s)
exit 0
```

Unique focused screenshot root /tmp/backgrounds-T6-final-xxI2wj/results. Firefox phone terminal /background-rendering-repre-6ab8a-and-solid-surfaces-at-390px-firefox/terminal-390.png (relative to that root) was inspected after the opaque terminal fix. Report T6.md lists matching Settings/thread/agents/terminal paths for both browsers and sizes.

## Known gaps / residual risks

The seven Accepted Risks in PLAN.md remain unchanged: external file loss/corruption, multiple hub writers, orphan files after crash, abnormal filesystem permissions, exhaustive browser/failure combinations, narrow metadata/cleanup read race, and repeated uncached navigation downloads. Ordinary restart/network/navigation/multiple-device behavior remains required and covered.

## Remediation rounds

None yet.
