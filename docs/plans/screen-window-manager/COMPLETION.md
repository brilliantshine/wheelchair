---
slug: screen-window-manager
date: 2026-11-22
implemented-by: "T1 standard (gpt-6.1-terra); T2 light (gpt-6-luna); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — A window manager for agent screens

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by: []
```

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 `screenTools()` returns `openboxInstalled` (openbox and xprop, same `findCommand`); `missing`/`TOOLS` unchanged | this run | machine/lib/screen.js:24-26 | machine/test/screen.test.js:410 (`optional window manager detection requires both tools`) |
| S2 approval card no-window-manager line, only when tools complete, Linux only, `ready` unchanged | this run | machine/service.js:2377-2379 | machine/test/screen-tools-warning.test.js:26,44-50 (full → `[wmWarning]`, wm → none, empty/partial → missing line only, darwin empty/full → none; Windows-bridge cases moved to the wm PATH) |
| S2 installer optional line, only when required tools present, Linux only, exit status unchanged, bookmark last | this run | install.sh:528-533 (`elif`) | install/test/run.sh:756,768 (absent with missing tools), 771-778 (`screen_present`: hint, no warning, status 0, bookmark last), 779-787 (`screen_wm`: no `screens:`), `screen_darwin` unchanged |
| S3 gate: `allowOpenbox` instance property default true, and `openboxInstalled` | this run | machine/lib/screen.js:40, :177 | screen.test.js:444 (`disabled openbox ...`), :445 (`openbox not on PATH ...`); fixture sets `allowOpenbox = false` at screen.test.js:64 |
| S3 fixed rc.xml: dir 0700, file 0600, empty `<keyboard/>`, Focus+Raise Press bindings for Left/Middle/Right in Client and Frame only, no menu/Root/Execute/ShowMenu, `<application class="*"><decor>no</decor>` | this run | machine/lib/screen.js:178-182 | screen.test.js:420-437 (modes, contexts exactly `[Client, Frame]`, actions exactly 6×Focus,Raise, no Execute/ShowMenu/menu/Root, decor no) |
| S3 spawn: `systemd-run` + `scopeArgs(screen,'wm')`, `openbox --sm-disable --config-file <rc.xml>`, env DISPLAY/XAUTHORITY + XDG_CONFIG_HOME/XDG_CONFIG_DIRS/HOME = screen dir, output to `wm.log` 0600 append, exit/error listeners | this run | machine/lib/screen.js:183-188 | screen.test.js:420-437 (args, home/xdgHome/xdgDirs equal dir, `-wm.scope` systemd-run call) |
| S3 readiness: 5 s deadline from spawn, 100 ms poll, probe timeout `min(1000, left)`, exact `_OB_CONFIG_FILE(UTF8_STRING) = "<rc.xml>"`, not exited | this run | machine/lib/screen.js:189-193 | screen.test.js:420 (ready), :439 (missing and wrong path → not ready, start < 7 s) |
| S3 not ready: SIGKILL child if running, stop `wm` scope immediately, log, carry on with null | this run | machine/lib/screen.js:195-198 | screen.test.js:439 (wm scope stopped via systemctl, `window_manager` null), :442 (openbox exits at once → null, screen runs) |
| S3 fence before `running` save; "screen replaced" catch branch stops `wm` scope | this run | machine/lib/screen.js:201-202, :207 | screen.test.js:443 (session stopped during readiness → 409, not saved running) |
| S3 `load()` default, `reset()` and `start()` set `window_manager` null; `status` reports it | this run | machine/lib/screen.js:57, :62, :148, :278-280 | screen.test.js:420, :439, :442, :444, :445 (status checks) |
| S4 `ctx.openbox` in launch and execute | this run | machine/lib/screen.js:219, :284 | screen.test.js:420 (run autofocus and windows go through openbox path) |
| S4 `windows()` from `xprop -root _NET_CLIENT_LIST`, ids after `#`, none when absent | this run | machine/lib/screen-input.js:34-35 | screen.test.js:420 (windows lists 0x200001 from client list; baseline before launch is the empty `# ` case) |
| S4 focus and autofocus use `xdotool windowactivate -- <id>` without `--sync`; without openbox unchanged `windowfocus` | this run | machine/lib/screen-input.js:115, :125 | screen.test.js:420 (≥2 windowactivate calls, no `--sync`), :444/:445 (`windowfocus`, `xwininfo -root`) |
| Live test openbox assertions (status, windows, focus xmessage → Chromium, F11 fills screen in 3 s) | this run | machine/test/screen-live.js:147-155 | Runs only where openbox and xprop exist; hearth has neither, so the live run below exercised the unchanged path only |

## Deviations from plan

None in behaviour. Additions the Spec did not state (logged as choices in PLAN.md Log):
- A stopped screen's `status` also carries `window_manager: null` (machine/lib/screen.js:278).
- Any error while writing rc.xml or spawning openbox is logged and the screen continues without it (machine/lib/screen.js:196-199); a generation fence also runs just before the spawn (:184).
- The readiness poll ends early once openbox exits (:189).
- The live test presses F11 a second time to leave full screen before the existing checks continue (screen-live.js:154).

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

Run on the feature branch after both merges (commit f61fc651), on hearth.

`bash machine/test/run.sh` — exit 1:
```
# tests 688
# pass 669
# fail 18
# skipped 1
```
All 18 failures are in `machine/test/win.test.js` / `win-tool-ready.test.js` (Windows bridge; `spawnSync wslpath ENOENT`, hearth has no `wslpath`). The same 18 fail on the feature branch before this build (checked at 4c8571ed's parent state: `node --test machine/test/win.test.js machine/test/win-tool-ready.test.js` → `# fail 18`). The skip is `Windows relay live # SKIP skipped: not WSL`. Every screen test passes, including:
```
ok 322 - optional window manager detection requires both tools
ok 323 - openbox starts with isolated click-only config and drives windows
ok 324 - openbox falls back when config path is missing
ok 325 - openbox falls back when config path is wrong
ok 326 - exited openbox leaves screen running
ok 327 - stopping session during openbox readiness fences the save
ok 328 - disabled openbox preserves root listing and direct focus
ok 329 - openbox not on PATH keeps today's window handling
```

`bash install/test/run.sh` — exit 1: 212 PASS, 1 FAIL:
```
FAIL real wheelchair directory is byte-identical after suite
PASS missing screen tools do not print optional window manager hint
PASS partially missing screen tools do not print optional window manager hint
PASS Linux with screen tools prints optional window manager hint only
PASS Linux with screen tools and openbox prints no screen message
```
The one failure also fails on the feature branch before T2 (run alone at ac8a0a5c-era tree): the live wheelchair app on hearth writes into `~/.wheelchair` while the suite runs. It does not concern this change.

`node --test viewer/test/*.test.js` — exit 0: `# tests 897 # pass 897 # fail 0`.

`bash machine/test/screen-live.sh` — exit 0, `live: 22 ok, 0 failed` (openbox not installed on hearth, so the openbox block is skipped).

## Known gaps / residual risks

- Real openbox was never run here; the openbox live assertions (screen-live.js:147-155) are unexercised until a machine with openbox runs `bash machine/test/screen-live.sh`.
- Plan Check Once Built row 1 (focus without `--sync` is asynchronous; typing right after could hit the old window) is left to verifiers.
- Deferred rows 1-2 (openbox exiting after a healthy start; Xvfb liveness re-check) are not built, by plan.

## Remediation rounds
