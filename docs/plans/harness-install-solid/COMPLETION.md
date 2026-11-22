---
slug: harness-install-solid
date: 2026-11-21
implemented-by: "standard / gpt-6.1-terra (T1); standard / claude-sonnet-5-5 (T2); light / claude-haiku-5-5 (T3); sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: claude-opus-5-5 (PASS)
    checks: gpt-6.1-terra (T1); claude-sonnet-5-5 (T2); claude-haiku-5-5 (T3)
  - round: 1
    lane: gpt-6.2-sol (FAIL, 6 gaps)
    checks: gpt-6.1-terra (T1); claude-sonnet-5-5 (T2); claude-haiku-5-5 (T3)
  - round: 2
    lane: claude-opus-5-5 (PASS)
    checks: all of round 1 plus gpt-6-luna (R1-1) and claude-haiku-5-5 (R1-3)
  - round: 2
    lane: gpt-6.2-sol (PASS)
    checks: all of round 1 plus gpt-6-luna (R1-1) and claude-haiku-5-5 (R1-3)
---

# Completion Report — Make agent installs solid

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line numbers are at the feature-branch commit this report is committed in.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Job leader registers SIGTERM handler as first act, before waiting for PID file | this run | machine/lib/harness-install.js:55 | harness-install.test.js:86 (cancel modes) |
| Steps run via awaited async spawn, each `detached: true` (own group); output to log as before | this run | machine/lib/harness-install.js:73-88, 95-118 | harness-install.test.js:13 (existing restart/validate test), :45 (Node checks), :86 |
| Stop causes: SIGTERM → cancelled; `WHEELCHAIR_INSTALL_LIMIT_MS` timer (default 900000) → timeout; timer cleared on end; second request ignored | this run | machine/lib/harness-install.js:55-60, 123 | harness-install.test.js:86 (timeout mode with 500 ms) |
| Stopping: no further step; SIGTERM to group, wait ≤5 s for step exit, then SIGKILL group unconditionally (ESRCH ignored); result then PID removal | this run | machine/lib/harness-install.js:58-72, 74, 86, 122-126 | harness-install.test.js:86 (TERM-ignoring child gone in all three modes) |
| Results: cancelled / failed+timeout with `exit_code: null`, `reason`; `reason: "recipe"` when recipe exits non-zero; no log append | this run | machine/lib/harness-install.js:102, 124 | harness-install.test.js:86 (reason checks incl. `exit 17` → recipe) |
| `stopJob(p)` | this run | machine/lib/harness-install.js:35-39 | harness-install.test.js:86 |
| Explanations rules 1–4, rules 2–4 only for `reason: "recipe"`, null otherwise, full log | this run | machine/lib/harness-install.js:17-34 (state 15-23, explain 24-34) | harness-install.test.js:64 |
| Machine DELETE route: 404 / 409 `not installing` / 202 `cancelling` | this run | machine/service.js:2066, 2071 | harness-install.test.js:86 (409 idle, 404 unknown, 202) |
| API.md row: DELETE, cancelled, reason, explanation | this run | machine/API.md:31 | read |
| Hub passthrough accepts DELETE, same validation and 502 | this run | viewer/app/routes.js:97-103 | app-harnesses.test.js:280 |
| Hub refuses POST with 409 `<name> is switched off` while Use is off | this run | viewer/app/routes.js:101 | app-harnesses.test.js:280; app-harnesses.spec.js:293 |
| PUT `enabled:false` fires DELETE to every known machine, not awaited, errors ignored; `enabled:true` none | this run | viewer/app/routes.js:223-226 | app-harnesses.test.js:298 |
| Settings: Cancel after 202/GET running only, aria-label, "Cancelling…", 409 keeps polling, 5xx/network → "isn't reachable", other → "update wheelchair" | this run (T2, fixed by T3) | viewer/pages/settings.js:1697-1700, 1711-1726, 1786-1788 | app-harnesses.spec.js:199, 226, 251 |
| Cancel hidden while offline | this run | viewer/pages/settings.js:1786 | app-harnesses.spec.js:274 |
| `cancelled` branch before `!st.installed`, only when not installed, not role=alert, tail, Install | this run | viewer/pages/settings.js:1796-1798 | app-harnesses.spec.js:199 |
| `failed`: `.h-explain` line between "Install failed" and tail; job keeps explanation | this run | viewer/pages/settings.js:1703, 1791-1795; viewer/pages/settings.css:277 | app-harnesses.spec.js:312 |
| POST 409s told apart by `body.error` | this run | viewer/pages/settings.js:1691-1694 | app-harnesses.spec.js:293 |
| Switch off keeps page behaviour; switching back on GETs state | this run (unchanged page code) | viewer/pages/settings.js (existing switch handler) | existing switch-off tests in app-harnesses.spec.js:412-628 |
| Phone and desktop sizes | this run | — | app-harnesses.spec.js runs every test in the phone/desktop loop |

## Deviations from plan

- The Validation bullet's "cancel a sleeping recipe" and "a recipe whose child ignores SIGTERM" are one fixture: an outer shell waiting on a TERM-ignoring `sleep` child. It is used for Cancel, Cancel after a service restart, and the time limit (harness-install.test.js:86). So the plain-sleep case is covered by the stricter one.
- Browser test: the stale page's "switched off" row error (spec.js:293) and "Install cancelled" with Install (spec.js:199) are separate tests, not one sequence.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

`node --test machine/test/harness-install.test.js` (re-run by sub-lead on T1's branch):
```
1..7
# tests 7
# pass 7
# fail 0
# duration_ms 19983.113169
```

`node --test viewer/test/app-harnesses.test.js` (T2 branch):
```
# pass 20
# fail 0
```

`npm --prefix viewer run test:browser -- app-harnesses.spec.js` (after T3):
```
  116 passed (2.4m)
```

`bash machine/test/run.sh` (feature branch, all tasks merged):
```
# tests 576
# pass 560
# fail 16
```
All 16 failures are in machine/test/win.test.js (Windows bridge; `wslpath` missing on this Linux machine). `node --test machine/test/win.test.js` on the feature branch before T1 was merged: `# pass 5 / # fail 16`, the same failures.

`npm --prefix viewer run test:browser` (feature branch, all tasks merged):
```
  1 failed
    [chromium] › test/app-send-now.spec.js:84:1 › Enter sends, Shift+Enter starts a new line, and the switch turns Enter-to-send off
  34 skipped
  1295 passed (14.4m)
```
The failing test is in a file this build did not touch. Re-running it alone (`npm --prefix viewer run test:browser -- app-send-now.spec.js`) gives `12 passed (17.0s)`: a flake.

## Known gaps / residual risks

- Accepted Risks in PLAN.md stand as written.
- `stopJob` reads the PID file twice (`state()` then `read()`); if the job finishes between the two reads, the DELETE route throws (500). That needs a sub-second window between Cancel and the job ending.
- The real 15-minute default is not exercised by a test; only the env override at 500 ms and 15000 ms is.

## Remediation rounds

### Remediation 1 — 2026-11-21

Verification 1 at d6d1d01e: Claude verifier PASS; GPT verifier FAIL with 6 gaps (verbatim in REMEDIATION-1.md). Gaps 2, 4 and 5 were judged rare paths and added to PLAN.md Accepted Risks (round verification-1). Gaps 1, 3 and 6 were fixed:

| Gap | Fix | Task / lane | Validated by |
|-----|-----|-------------|--------------|
| 1: Kimi/Pi CLI check blocked the leader (spawnSync in adapters) | Async `command -v` through the job's `run()`, keeping the adapters' semantics; `adapters` require removed — machine/lib/harness-install.js:115-123 | R1-1, light / gpt-6-luna | harness-install.test.js "slow Kimi CLI lookup is stopped by the install limit" (fails before the fix: reason undefined) |
| 6: a step that failed to start reported a negative errno as exit code | `run()` resolves `status: null` on spawn error, so `?? 1` gives 1 as before — machine/lib/harness-install.js:83 | R1-1 | harness-install.test.js "missing step program reports exit code 1" (fails before the fix: -2 !== 1) |
| 3: Cancel error was keyed by provider, so it showed on other machines' rows and stayed after cancellation | Error kept on the job record as `cancelErr`, carried across running polls, dropped on terminal states, rendered only on a running row — viewer/pages/settings.js:1699, 1716, 1724, 1827 | R1-3, light / claude-haiku-5-5 | app-harnesses.spec.js: the alert clears once the install reports cancelled; the alert shows only on the failing machine's row (both fail before the fix) |

Validation after the merge (feature branch):
```
node --test machine/test/harness-install.test.js   → # tests 9 / # pass 9 / # fail 0
node --test viewer/test/app-harnesses.test.js       → # tests 20 / # pass 20 / # fail 0
bash machine/test/run.sh                             → # tests 578 / # pass 562 / # fail 16 (the same win.test.js failures as before)
npm --prefix viewer run test:browser -- app-harnesses.spec.js → 124 passed
```

### Verification 2 — 2026-11-21

Both verifiers (claude-opus-5-5, gpt-6.2-sol) passed at 442a9479 with no gaps. The full browser suite passed: Claude's run gave 1304 passed and 34 skipped, with no failures. GPT's run had the app-send-now test time out, and that test passed when re-run alone.
