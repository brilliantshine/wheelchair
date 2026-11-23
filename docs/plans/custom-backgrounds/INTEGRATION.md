# Current main integration — 2026-11-23

Merged upstream main0682593b69c19bc93ee2af333f57cbf5b9efd685 into the verified feature branch in merge commitd83cb509626dd4ffb1c219bc0088efb1c55b30bc. The merge had five conflicted paths; all incoming staged changes were the intended upstream update, with no pre-existing uncommitted user changes.

## Resolution and source seams

| Path / seam | Resolution |
|---|---|
| viewer/AGENTS.md | Retain incoming ownership rows and the background module/helper/renderer rows. |
| viewer/app/API.md | Keep incoming handoff/download notes in their section, then append the background route contract. |
| viewer/app/settings.js | Keep incoming Harnesses, onboarding, lessons/history/waiting, auto-merge flags, user name and five-provider defaults; add background defaults and normalization. |
| viewer/pages/settings.js | Retain incoming Harnesses and lesson editing, preserve the complete background visit/controller integration and readiness/focus correction; append Background after the seven current sections. |
| viewer/test/app-settings.spec.js | Expect all eight sections in the incoming order plus Background; preserve the template hash target. The phone count also becomes eight. |
| New lesson deep-links | Discard a local background preview before transitioning to templates/lessons/<role>. |
| New sent-file page | Load the shared background assets in this signed-in shell; existing doc/error/plain-text surfaces stay solid. |
| New Harnesses UI | Apply the existing conditional palette backing to its inner children, preserving transparent outer gutters and all existing behavior. |

Auto-merged hub initialization, early background route dispatch, atomic pre-rename permissions, server image CSP and page entry points were checked in source. No background route was put behind the generic unbounded body reader; new main preference fields are not dropped by background normalization.

New bounded integration checks cover the combined normalized preferences, lesson deep-link draft discard, the sent-file shell and Harnesses surfaces. The previous eight Accepted Risks are unchanged, including the verification-1 compound overlap. No new recovery subsystem, feature plan or exhaustive matrix was introduced.

## Validation

Each run uses its own private /tmp root and isolated helper state/cache. Browser commands set writable private XDG_CONFIG_HOME, XDG_CACHE_HOME, XDG_RUNTIME_DIR and TMPDIR, with GSETTINGS_BACKEND=memory and PLAYWRIGHT_BROWSERS_PATH=/home/junjie/.cache/ms-playwright. No HOME/global config, live state or installation was used. The Harnesses browser tests stub install/status routes; no program is installed.

```text
TMPDIR=<private>/tmp GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=init.defaultBranch GIT_CONFIG_VALUE_0=main node --test viewer/test/app-settings.test.js viewer/test/app-harnesses.test.js viewer/test/app-openrouter-settings.test.js viewer/test/app-kimi-settings.test.js viewer/test/background*.test.js viewer/test/routes.test.js viewer/test/server-isolation.test.js
77 passed; 0 failed; duration10887.5ms; exit0
```
Log: /tmp/backgrounds-main-node-IjxXGW/output.log.

```text
npm --prefix viewer run test:browser -- background-editor.spec.js background-network.spec.js background-rendering.spec.js background-settings-surfaces.spec.js background-readiness.spec.js --output=/tmp/backgrounds-main-appearance-s82FZP/results
58 passed (50.3s); exit0
```
Log: /tmp/backgrounds-main-appearance-s82FZP/output.log. Both Chromium and Firefox execute all appearance cases.

```text
npm --prefix viewer run test:browser -- app-settings.spec.js --project=chromium --output=/tmp/backgrounds-main-settings-chromium-final-0PysgN/results
35 passed (20.6s); exit0
npm --prefix viewer run test:browser -- app-settings.spec.js --project=firefox --output=/tmp/backgrounds-main-settings-firefox-6Y0oTe/results
35 passed (32.4s); exit0
```
Logs are output.log beside each results directory. Initial Chromium run found only the stale phone expectation of seven tabs; it failed before the remaining serial cases. The corrected complete file ran in both browsers, covering all previously unrun cases, with unchanged layout assertions.

```text
npm --prefix viewer run test:browser -- app-harnesses.spec.js app-file-preview.spec.js --grep 'five rows|install: running on load|switching off asks first|Markdown renders|plain text shows|file over|previewable helper' --output=/tmp/backgrounds-main-harness-file-NeKStR/results
20 passed (20.0s); exit0
```
Log: /tmp/backgrounds-main-harness-file-NeKStR/output.log. Representative Harnesses rows/switch/install UI and all sent-file preview cases execute in both browsers.

Changed JS syntax checks and the integration viewer diff whitespace check pass. The earlier full Node/browser passes remain documented historical results; no claim is made that the entire evolved upstream suite was rerun. Fresh independent verification follows this committed integration.
