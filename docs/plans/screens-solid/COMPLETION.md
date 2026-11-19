---
slug: screens-solid
date: 2026-11-19
implemented-by: "standard · gpt-6.1-terra (T1, T2, T3); sub-lead claude-opus-5-5 (two test adjustments, one test addition)"
verified-by: []
---

# Completion Report — Make agent screens solid

Written for a hostile reviewer: every claim checkable, no claim without evidence.

Scope: S1, S2, S3, S5, S6, S7. S4 (window manager) was moved to its own thread (Decision 24) and is not built here, so nothing below starts openbox or changes window listing or focus.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 `screenTools(searchPath)` returning `{ missing }` in `TOOLS` order, same `findCommand` as `start()`; `start()` uses it with the unchanged 422 | this run | `machine/lib/screen.js:10-11` (keep-in-step comment, `TOOLS`), `:24-26`, `start()` `:142-143`, export `:272` | `machine/test/screen.test.js:258` `screenTools reports missing tools in TOOLS order`; existing `missing tools and unavailable user bus` test |
| S1 approval-card warning (Linux only, after the startup warning, `warnings` only when non-empty, ≤10) | this run | `machine/service.js:231` (`platform` seam), `:1943-1951` | `machine/test/screen-tools-warning.test.js:15` (missing, partial, all present with no `warnings` key, startup first, darwin) |
| S1 installer warning (Linux only, before the first `configure_service`, stderr, package mapping and dedupe, exit unchanged) | this run | `install.sh:477-497` (block before `case $serve_flag in`) | `install/test/run.sh` cases `screen_missing`, `screen_partial`, `screen_present`, `screen_darwin` (assertions `Linux screen warning lists missing tools and unique packages`, `screen warning leaves bookmark last`, `screen warning leaves the exit status at 0`, `Linux screen warning names only the missing tools and their packages`, `Linux with screen tools prints no screen warning`, `Darwin prints no screen warning`) |
| S2 cap: `maxScreens = 8` instance property; check only when creating, no `await` between the check and `set`; 422 text | this run | `machine/lib/screen.js:40`, `:147-149` | `machine/test/screen.test.js:265` (refusal, first unaffected, reuse, stop then second starts, slice signalled), `:274` (simultaneous starts give one screen) |
| S2 no stranded slots: first `save()` rollback; `reset()` frees in `finally`, never throws; `trySave` | this run | `machine/lib/screen.js:51` (`trySave`), `:61-65` (`reset`), `:150` (rollback) | `machine/test/screen.test.js:281` (first write fails: no slot, no scope, later start succeeds), `:290` (final write fails: cookie removed, slice signalled) |
| S3 prune to newest 50 `shot-<n>.png` after a successful shot; others untouched; errors logged; numbering unchanged | this run | `machine/lib/screen.js:12` (`KEEP_SHOTS`), `:260-262` | `machine/test/screen.test.js:298` (52 shots: 1–2 gone, 3–52 kept, next is 53, non-shot file survives), `:307` (pruning error still returns the shot) |
| S5 `pid`/`pgid` = `child.pid ?? null`, after listeners, then `trySave`; `null` on spawn throw; `status` shows `pid` | this run | `machine/lib/screen.js:199` (record with nulls), `:203-207` (listeners, pid, trySave, codex comment), `:252` (status) | `machine/test/screen.test.js:314`, `:365` (async spawn error keeps `null`) |
| S6 marker prefix `sh -c '(umask 077; : > "$0") \|\| exit 127; exec "$@"' <dir>/app-<n>.started …`; `registered()` no longer used by `launch()` | this run | `machine/lib/screen.js:197-198` | `machine/test/screen.test.js:339` (marker 0600, app sees service umask) |
| S6 hand-over wait: 50 ms poll, single 5 s deadline from spawn, final check wins, activation doesn't end it; failure reasons; immediate once → fence → reason → `failed` → trySave; 422 text; `status` shows failed as `exited` | this run | `machine/lib/screen.js:200-228`, `:252` | `machine/test/screen.test.js:321` (Failed to line → 422 with that line; failed shows exited while scope active), `:328` (signal), `:331` (timeout: exact `no hand-over within 5 s`, 422, child killed, one scope stop), `:346` (missing interpreter and fast `Failed to x` after hand-over → ok), `:354` (failing writes keep outcome), `:365` (spawn error → 422), `:374` (active then exit 1 → 422), `:377` (stopped during hand-over → 409, scope stopped), `:385` (log removed → fallback or 409; archive leaves the dir absent), `:393` (unreadable log fallback) |
| S7 drag `mouseupReserveMs` (default 1000); moves and mousedown use `end - reserve`; mouseup `Math.max(0, end - now)` | this run | `machine/lib/screen-input.js:69-82` | `machine/test/screen-input.test.js:54-56` (second move hangs with fast or hanging mouseup: under 3.3 s and mouseup attempted; first move fails: no mousedown/mouseup); `:40` existing drag test |
| S7 `runTool` timeout: SIGKILL, destroy pipes, resolve at once | this run | `machine/lib/screen-input.js:7-19` (timer `:18`) | `machine/test/screen-input.test.js:53` (background `sleep` holding stdout; 100 ms timeout resolves within 300 ms) |

## Deviations from plan

- **S7 test timing.** The existing drag test passes `baseDeadlineMs: 600, mouseupReserveMs: 400`, not the Spec's `100`/`25` (`machine/test/screen-input.test.js:40`). With 25 ms, the bash `xdotool` fake for mouseup was SIGKILLed before logging in 3 of 6 parallel runs. With 400 ms, 8 of 8 passed. The test still asserts the same behaviour.
- **S6 deadline as an instance property.** `handoverMs` (5000) is an instance property, a test hook the Spec didn't name. The timeout message derives its seconds from it. The timeout test runs at the production 5 s and asserts the exact Spec text.
- **S1 ordering.** Round 8's change summary says "one warning, no ordering", but the Spec body says the screen warning goes after the startup-size warning. The body is followed.

## Routers

None. No ownership moved and no new top-level files. The `machine/AGENTS.md` rows for `lib/screen.js` and `lib/screen-input.js` stay true. The new test file `machine/test/screen-tools-warning.test.js` sits under `test/`, which the router covers as a directory.

## Validation evidence

Run on the merged feature branch on hearth. The machine was heavily loaded, with load average about 33 from other sessions.

`bash machine/test/run.sh`:
```text
exit 0
# tests 369
# pass 369
# fail 0
```

`node --test viewer/test/*.test.js` (unquoted glob):
```text
exit 0
# tests 694
# pass 694
# fail 0
```
An earlier run on this tree stalled under load and was cut off at 500 s, with no failures before the stall. `viewer/test/app-project-tools.test.js`, the file it stalled in, passes alone (4/4). The full rerun passed as shown above.

`bash install/test/run.sh`:
```text
PASS Linux screen warning lists missing tools and unique packages
PASS screen warning leaves bookmark last
PASS screen warning leaves the exit status at 0
PASS Linux screen warning names only the missing tools and their packages
PASS Linux with screen tools prints no screen warning
PASS Darwin prints no screen warning
FAIL real wheelchair directory is byte-identical after suite
RESULT 197 passed, 1 failed
```
The one failure is environmental, not from this build. The same assertion fails on the base commit before T3 (`RESULT 191 passed, 1 failed`, same FAIL line). It hashes the live `~/.wheelchair`, which the running app writes to while the suite runs.

`bash machine/test/screen-live.sh` (hearth, real Xvfb):
```text
ok - no process from the screen survives stop (polled up to 10 s)
ok - no wcscreen unit of this test is left
live: 22 ok, 0 failed
```

T1 regression check (worker-reported, `docs/plans/screens-solid/reports/T1.md`): the new `drag: second move and mouseup hang` test fails on the pre-change code (4030 ms > 3300 ms).

Worker reports: `docs/plans/screens-solid/reports/T1.md`, `T2.md`, `T3.md`.

## Known gaps / residual risks

- **Accepted Risks still apply.** A screen being torn down can overlap a new one for about 4 s past the cap. A thread keeps up to 50 screenshots per screen-using session until it is archived.
- **Mouseup can get a zero timeout.** If a drag step overruns its deadline, mouseup's timeout can be 0 ms and it may not run. The Spec accepts this as "unless a step overran". `wc.js screen stop` clears it.
- **Installer test environment.** The installer suite's live `~/.wheelchair` integrity assertion is flaky whenever the app is running. It is not addressed here.

## Remediation rounds
