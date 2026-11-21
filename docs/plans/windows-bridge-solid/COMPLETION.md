---
slug: windows-bridge-solid
date: 2026-11-21
implemented-by: "standard / gpt-6.1-terra (T1, T2, T3, T4, T5, T5b, T6); light / gpt-6-luna (T3b, T3c, T4b, T5c at effort high); sub-lead claude-opus-5-5 (integration, merge of main, routers)"
verified-by: []
---

# Completion Report — Make the Windows bridge solid

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line numbers
are on the feature branch `wc/d5233e17e73d` at the commit named in the sub-lead's result
(after the merge of `origin/main` at `fc33131f` and T3c).

## Spec coverage

The plan has no Prior Work section; every row is `this run`.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Loaded entries: each adapter returns `loaded: [{ name, windows }]` from its final config (Claude: `mcp.servers` when tools; Codex: after skip reasons and budget; Agy: translated `servers`; Pi, Kimi: `[]`); `windows` only for stdio with an `isWindowsProgram` original command | this run | `machine/adapters/common.js:19`, `claude.js:68`, `codex.js:143`, `agy.js:67`, `pi.js:61`, `kimi.js:166` | `machine/test/adapters-loaded.test.js:19,27` |
| `windowsTools` comes from the build, not `.mcp.json` | this run | `machine/service.js:848-849` | `machine/test/win-service.test.js:111` (Claude/Codex/Agy true, Pi/Kimi false), `:125` (Codex budget → false) |
| 1. "Add MCP for Unity" button: `unity`/`unity-N`, stdio, fixed args; command from the machine | this run | `viewer/pages/project-tools.js:339-372` | `viewer/test/app-project-tools.spec.js:1033,1048,1054` |
| 1. `POST /v1/project-tools/unity-prep` (hub auth): non-Microsoft kernel → `uvx`; interop off → message; WSL → `(Get-Command uvx.exe).Source` + `toLinux`, 10 s deadline, 10-minute cache; not found → install message; background `uvx.exe --from mcpforunityserver mcp-for-unity --help` (5 min) reported as running/ready/failed; poll never starts a fetch | this run | `machine/lib/unity-prep.js` (whole file), route `machine/service.js:2078-2083`, viewer pass-through `viewer/app/routes.js:68` | `machine/test/unity-prep.test.js:9,22,29,37` |
| 1. Page load makes no `unity-prep` call; progress messages "Getting MCP for Unity ready on Windows…", "Ready", "Couldn't fetch it: …; the first agent will fetch it instead"; saving never blocked | this run | `viewer/pages/project-tools.js:345-372` | `viewer/test/app-project-tools.spec.js:1033` (asserts zero calls on load), `:1048` |
| 1. Help text and install link | this run | `viewer/pages/project-tools.js:340` | `viewer/test/app-project-tools.spec.js:1033` |
| 1. Unity prompt lines for a WSL tool-role session loading a Windows stdio `mcp-for-unity` entry: copy path, `win start --` with `Unity.exe` from `ProjectVersion.txt` only when it exists, fallback sentence, sandboxed Codex sentence, unknown-copy fallback | this run | `machine/lib/win-prompt.js:3-14`, caller `machine/service.js:900-906` | `machine/test/win-launch.test.js:6` (every variant), `machine/test/win-service.test.js:140` (prompt file written at start, Unity.exe path and fallback, no-entry case) |
| 1. README "Unity" paragraph (uv on Windows, package committed) | this run | `README.md:96` | read |
| 2. `win info` `disk`: `copies`, `copies_bytes`, `git_bytes` (`count-objects -v`), `conflict_refs`, `windows_free_bytes`, `measured_at`, `warnings`, `reason` | this run | `machine/lib/win-disk.js` (whole file), `machine/lib/win.js:378-380` | `machine/test/win-disk.test.js:10` |
| 2. Copy-walk PowerShell literal keeps typographic quotes in the path (doubled in place) | this run | `machine/lib/win-disk.js:36` | `machine/test/win-disk.test.js:81` |
| 2. Copy walks cached per thread, refreshed in the background after 10 minutes, `info` never waits; a failed walk keeps values, sets `reason`, retries only after the window | this run | `machine/lib/win-disk.js:28-57` | `machine/test/win-disk.test.js:10` |
| 2. Warnings: copies > 20 GB, conflict refs ≥ 10, free < 10 GB; none for `git_bytes` | this run | `machine/lib/win-disk.js:12-14,78-80` | `machine/test/win-disk.test.js:48,68` |
| 2. `wc.js win info`: JSON on stdout unchanged, each warning on stderr | this run | `viewer/app/wc.js:195` | `viewer/test/wc-win.test.js:114` |
| 3. Recovery after a service restart: live tool-role sessions with an existing copy re-added to `toolSessions`, registered and marked used | this run | `machine/lib/win.js:346-358` (`startup`) | `machine/test/win.test.js:351,402` |
| 3. Copy marked used right after tmux starts and again when a pending readying task finishes | this run | `machine/lib/win.js:145-151` (`afterLaunch`), caller `machine/service.js:922` | `machine/test/win.test.js:373` (final reconcile runs), `:388` (control: none without it) |
| 4. `detectWsl` → `{ wsl, kernel, interop, mount }`; interop needs the registration's first line `enabled` | this run | `machine/lib/win-env.js:8-30` | `machine/test/win-env.test.js:8,46` |
| 4. `%LOCALAPPDATA%` and `git.exe` lookups not memoized on failure; probe does fresh lookups, success replaces the cached path, failure doesn't | this run | `machine/lib/win-env.js:124-185` | `machine/test/win-env.test.js:60` |
| 4. `bridgeHealth()` cached, never waits; not kernel → ok; interop off → reason; 15 s deadline reason; background probe at startup and every 10 minutes | this run | `machine/lib/win.js:315-337`, timer in `startup` `:339-344`, cleared on close `machine/service.js:2293` | `machine/test/win-health.test.js:19` |
| 4. Approval card warning on Linux when not ok and the lead's `.mcp.json` has a Windows `.exe` stdio entry; waits up to 15 s for `ok: null`; 10-warning cap | this run | `machine/service.js:2218-2226` | `machine/test/screen-tools-warning.test.js:17` |
| 4. Session start line "Windows bridge: not working on this machine (…)" for cached `ok: false`; none for `ok: null`; start never waits on a probe | this run | `machine/lib/win-prompt.js:5`, `machine/service.js:904` | `machine/test/win-launch.test.js:6`, `machine/test/win-service.test.js:140,168` |
| Validation: positive WSL fixtures write `enabled` | this run | `machine/test/win.test.js:18`, `machine/test/win-service.test.js:22`, `machine/test/win-env.test.js:13` | the suites below |
| Validation: live harness Unity MCP part (package in manifest before the copy; `initialize` → `notifications/initialized` → `tools/list`; instance poll up to 120 s before `win stop`; else `Unity MCP part skipped`) | this run | `machine/test/windows-live.js:74-123` (`unityMcp`), `:197-212`, `:239` | `bash machine/test/windows-live.sh` (skip path only here, see below) |

## Deviations from plan

- None in behaviour. Wording choices the Spec left open are logged in PLAN.md's Log (`Choice:` lines), among them: the fallback `Open Unity …` sentence keeps ", never on another path."; polling every 3 s; a failed background fetch is retried on the next button press.

## Routers

- `machine/AGENTS.md`: new rows for `lib/win-disk.js`, `lib/win-prompt.js`, `lib/unity-prep.js`; `lib/win.js` row now names tool tracking across restarts and cached bridge health; `lib/win-env.js` row names enabled-interop detection and the health probe; the `windows-live` row names the MCP for Unity check.
- `viewer/AGENTS.md`: the `pages/project-tools.js` row names the Add MCP for Unity button.

## Validation evidence

All run by the sub-lead on the feature branch after merging `origin/main` (commit `fc33131f` plus the router and report commit).

`bash machine/test/run.sh`:
```text
ℹ tests 568
ℹ pass 564
ℹ fail 4
test at machine/test/aside-turns.test.js:152:1   (Pi asides: 'failed' !== 'ok')
test at machine/test/kimi.test.js:166:1          (Error: Kimi Code is not installed)
test at machine/test/plan-files.test.js:21:1     (listen EADDRINUSE 127.0.0.1:7374)
test at machine/test/plan-files.test.js:36:1     (listen EADDRINUSE 127.0.0.1:7374)
```
All four fail the same way on `origin/main` alone (a `git archive` of `origin/main`: `aside-turns.test.js` + `plan-files.test.js` → pass 6, fail 3; `kimi.test.js:166` fails on the pre-merge feature branch and on main because Kimi Code isn't installed on this machine). `plan-files` binds the real service port 7374, which the running machine service holds.

`node --test viewer/test/*.test.js`:
```text
ℹ tests 778
ℹ pass 776
ℹ fail 2
test at viewer/test/app-slug.test.js:43:1
test at viewer/test/app-slug.test.js:65:1
```
Both fail identically on the feature branch before this build's viewer changes (`app-slug.test.js` alone: pass 6, fail 2).

`npm --prefix viewer run test:browser`, run per project (after the user installed `libnspr4` and `libnss3`):
```text
[chromium]  1 failed  [chromium] › test/app-send-now.spec.js:84:1 › Enter sends, Shift+Enter starts a new line, and the switch turns Enter-to-send off
            17 skipped
            580 passed (5.1m)
[firefox]   17 skipped
            581 passed (5.8m)
```
The one Chromium failure is a flake outside this build: re-running `app-send-now` alone, it failed once and passed once on the feature branch, and failed the same way on `origin/main`.

`bash machine/test/windows-live.sh` (this machine is the user's WSL2 PC; `WHEELCHAIR_UNITY` unset):
```text
ok - commit base
Unity MCP part skipped: WHEELCHAIR_UNITY unset
ok - info reports ready
ok - sync round trip
ok - cmd.exe echo hi exits 0
ok - windows lists WinForms title
ok - screenshot is PNG
ok - PNG is 8-bit RGB/RGBA without interlace
ok - PNG has complete pixel data
ok - screenshot contains more than one colour
ok - stop removes WinForms window
ok - commit round trip
Unity part skipped
exit 77
```
Exit 77 is the harness's existing skip code when `WHEELCHAIR_UNITY` is unset.

## Known gaps / residual risks

- The live MCP for Unity part (and so C1 and C5 in Check Once Built) has not run: `WHEELCHAIR_UNITY` is unset on this machine. Its code is read and syntax-checked only.
- The two final-reconcile tests (`machine/test/win.test.js:373,402`) set `used_since_ok: false` directly to simulate a readying reconcile that ran before the CLI existed, instead of driving a real one.
- `app-project-tools.spec.js:1054` (double press) asserts the button is disabled and a single unity-prep request, not the entry count directly.
- Accepted Risks rows 2 and 4 (failed `%LOCALAPPDATA%` lookup sequences; restart inside the launch window) are not handled, as the plan accepts.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
