---
slug: openrouter-solid
date: 2026-11-21
implemented-by: "T1 standard claude-sonnet-5-5; T2-T5 standard gpt-6.1-terra; integration and live check by sub-lead (claude-opus-5-5)"
verified-by:
  - round: 1
    lane: claude-opus-5-5 (PASS)
    checks: claude-sonnet-5-5, gpt-6.1-terra
  - round: 1
    lane: gpt-6.2-sol (FAIL, 3 fixed, 1 rare)
    checks: claude-sonnet-5-5, gpt-6.1-terra
  - round: 2
    lane: claude-opus-5-5 (PASS)
    checks: claude-sonnet-5-5, gpt-6.1-terra
  - round: 2
    lane: gpt-6.2-sol (FAIL, 1 fixed, 1 settled in review)
    checks: claude-sonnet-5-5, gpt-6.1-terra
  - round: 3
    lane: claude-opus-5-5 (PASS)
    checks: claude-sonnet-5-5, gpt-6.1-terra
  - round: 3
    lane: gpt-6.2-sol (PASS)
    checks: claude-sonnet-5-5, gpt-6.1-terra
---

# Completion Report — Make OpenRouter agents solid

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by: []
```

## Spec coverage

All rows are `this run`; the plan has no Prior Work section.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 spend text takes the remaining row width, name not squeezed, no limit bar | this run | `viewer/pages/settings.js:1393-1396`; `viewer/pages/settings.css:192-193` | `viewer/test/app-openrouter-spend.spec.js` (1200px viewport, no `usage-left`, no 76px basis, height <= 1.5 line boxes, no `.bar`) |
| S2 providers.js openrouter `effort: true` | this run | `viewer/app/providers.js:3` | `viewer/test/app-openrouter-settings.test.js` (round-trip) |
| S2 routes.js validates openrouter effort | this run | `viewer/app/routes.js:265` | same |
| S2 codex/model.sh accepts openrouter effort, kimi still rejected | this run | `codex/model.sh:104,441-442` | `codex/test/run.sh` (new openrouter and kimi cases) |
| S2 machine keeps Pi effort, only kimi clears | this run | `machine/service.js:780` | `machine/test/pi.test.js` "Pi argv carries --thinking only when the session has an effort" |
| S2 Pi argv `--thinking <effort>` when set | this run | `machine/adapters/pi.js:61` (`command()`) | same |
| S2 Settings effort select for OpenRouter | this run | `viewer/pages/settings.js:16` | settings round-trip test |
| S3 hub allows OpenRouter asides, parent = lead `cli_session_id` | this run | `viewer/app/providers.js:3` (`asideFork: true`); `viewer/app/asides.js:41` | `viewer/test/app-asides.test.js` |
| S3 machine validation: provider, new_id for forks, OpenRouter model grammar | this run | `machine/lib/aside-turns.js:61-65` | `machine/test/aside-turns.test.js` "Pi asides validate, fork, resume, settle and redact" |
| S3 explicit provider→adapter map | this run | `machine/lib/aside-turns.js:95-96` | same (unknown provider refused) |
| S3 `asideArgv` fork/resume, `--no-extensions`, `--thinking`, `--tools` every turn, guard `-e` for read-only | this run | `machine/adapters/pi.js:63-65` | aside-turns test (argv checks for both access settings, fork and resume) |
| S3 read-only path guard (resolve like Pi, realpath, worktree or wheelchair `protocol/`, rewrite input, refuse re-normalized paths) | this run | `machine/adapters/pi-guard.js:33-51` | `machine/test/pi-guard.test.js` (all fixtures, all four tools); `node test-support/smoke/pi-guard.js` against real Pi 1.5.2 |
| S3 output parsing (header id checks, settled outcome, last assistant `message_end`, error/aborted fail, `limit` rule) | this run | `machine/lib/aside-turns.js:129-141` | aside-turns test (fork, resume, error, error then retry success, aborted with exit 0, missing/mismatched header) |
| S3 redaction of reply, error, stderr | this run | `machine/lib/aside-turns.js:80,97,137,140` | aside-turns test (`sk-or-` in reply and stderr) |
| S3 version gate inside the runner, terminal failure | this run | `machine/lib/aside-turns.js:97`; `machine/service.js:232` (`piProblem`) | aside-turns test (old Pi: failed with problem text, no second dispatch) |
| S3 spend dedupe by entry id + timestamp | this run | `machine/adapters/pi.js:26,41` | `machine/test/pi-spend.test.js` (lead file plus fork) |
| S3 real-Pi guard check (offline script) | this run | `test-support/smoke/pi-guard.js` | run output below |
| S3 live check (one fork, one resume, deepseek/deepseek-v4.1-flash-1017) | this run | `test-support/smoke/pi-aside-live.js` | run output below |
| S4 version probe cached by executable + mtime, warmed at startup, failed probe = unknown | this run | `machine/service.js:416,1619-1634` | `machine/test/pi.test.js` (old, 1.5.2, 1.5.9, 1.6.0, probe failure) |
| S4 `cliStatus('pi')` version/problem/warning texts | this run | `machine/service.js:1635-1645,1679` | same |
| S4 problem blocks starts and marks OpenRouter accounts signed out; warning blocks nothing | this run | `machine/service.js:772,806,1601` | pi.test (start refused on old, allowed on 1.6.0) |
| S4 hub passes problem and non-blocking warning; Ready not blocked | this run | `viewer/app/usage.js:63,71,127`; `viewer/app/ready.js` unchanged (checks only `problem`) | `viewer/test/app-kimi-settings.test.js` (warning reaches `/usage`, Ready not blocked) |
| S4 Settings shows problem or warning (warning as a note) | this run | `viewer/pages/settings.js:1233`; `viewer/pages/settings.css` `.mstate.note` | none beyond code (see gaps) |
| S4 launch version persisted, used for notes | this run | `machine/service.js:806` (`session.pi_version`) | pi.test (launched on 1.5.2, fake changed to 1.6.0, service restarted: no note) |
| S4 notes on turn-failed, stuck event, "Pi exited before it was ready" end reason | this run | `machine/service.js:1408,1060,1610-1618,1037,1087,1995,2067` | pi.test (turn-failed untested/unknown/tested; pane gone before ready) |
| S4 hub stuck card appends `note` | this run | `viewer/app/sessions.js:639` | `viewer/test/app-hub.test.js` (stuck card text includes the note) |
| S5 strict transcript read: strict HTTP path, absent → local path, local failure throws | this run | `viewer/app/chat.js:312-327`; `viewer/app/machine-client.js:48-49` | `viewer/test/app-report-retry.test.js` "strict absence falls back locally and failed local reads throw" |
| S5 per-call caps 3s/1s, 4s deadline, call timeout min(cap, left), hard cap against dribbling responses (Check Once Built #1) | this run | `viewer/app/sessions.js:434-450`; `viewer/app/chat.js:315-325`; `viewer/app/machine-client.js:48` | report-retry test "strict request cuts off dribbling response at its wall cap" and deadline test |
| S5 inline retries (3 more, 500ms gaps, stop under 750ms) incl. Pi entry rule | this run | `viewer/app/sessions.js:438-449`; `viewer/app/chat.js:268-270` (`hasPiEntry`) | report-retry tests: retry then deliver once, Pi entry appears later, 749ms no retry / 750ms one retry, timeout then success, dropped after headers |
| S5 all fail / absent → no result, quiet reminder; never delivered twice | this run | `viewer/app/sessions.js:431,451` | report-retry test "absent non-Pi transcript reads once and arms quiet; failures exhaust retries" |

## Deviations from plan

- S1 test asserts the height is at most 1.5 line boxes rather than exactly one line box (the line-height is `normal`, so an exact match is font-dependent). A two-line wrap still fails it.
- S4: a second Pi version gate also runs in `startIn` (`machine/service.js:806`), after worktree creation, to record the launch version; the first gate at `:772` refuses first, so the second only fires if the version changed in between.
- S5: the hard wall-clock cap in `machine-client.js` applies to every strict pass-through, so the project-tools route (120s) now has a 120s wall cap instead of a 120s inactivity cap.
- Sub-lead integration fix: a strict 404 is treated as empty only when its body is not JSON (`viewer/app/machine-client.js:38-41`), so project-tools 404 error text still reaches the caller.

## Routers

None — this change moved no ownership. New files sit in directories whose routers describe them by role (`machine/adapters/`, `machine/test/`, `test-support/smoke/`).

## Validation evidence

Run by the sub-lead on the merged tip (after T5, before this report):

```
$ bash codex/test/run.sh
RESULT 159 passed, 0 failed
$ bash machine/test/run.sh
# tests 488
# pass 488
# fail 0
$ node --test viewer/test/*.test.js
# tests 755
# pass 755
# fail 0
$ bash install/test/run.sh
PASS missing sudo helper prints install hint and no test password
RESULT 206 passed, 0 failed
$ node test-support/smoke/pi-guard.js
Pi guard offline check passed
$ npm --prefix viewer run test:browser
  34 skipped
  1116 passed (12.6m)
$ node test-support/smoke/pi-aside-live.js     # live, deepseek/deepseek-v4.1-flash-1017, real Pi 1.5.2
fork | PASS | new id and reply
resume | PASS | same id and reply
$ pi --version
1.5.2
```

## Known gaps / residual risks

- No machine-level test of the `stuck` event's `note`, of the `/v1/status` / `/v1/sessions` reconcile path for a pane-gone Pi session, or of OpenRouter accounts marked signed out on a Pi problem; the behaviour is in the code at the lines above. No test renders the Settings warning.
- Pi sessions launched before this change have no recorded `pi_version`, so their failure notes say "Pi's version couldn't be read".
- `cliStatus('pi')` reports the unknown warning until the startup probe resolves (a few hundred ms after machine start).
- Read-only guard: grep/find on a directory inside the worktree rely on Pi's ripgrep/fd not following symlinks (their default); a symlink inside the worktree named directly is resolved and blocked.
- The live check proves fork, resume, header ids and reply on one cheap model; other models' JSON output was not exercised.

## Remediation rounds

### Remediation 1 (after verification attempt 1 on 1a9e3781)

Attempt 1: Claude verifier PASS; GPT verifier FAIL with 4 gaps (see `REMEDIATION-1.md`). One (S4 tmux snapshot window) judged a rare path and recorded in PLAN.md Accepted Risks; the lead answered fix for the other three.

| Gap | Fix (file:line) | Validated by |
|-----|-----------------|--------------|
| S1 spend spec flaked (empty computed flex-grow during a re-render) | `viewer/test/app-openrouter-spend.spec.js:34-42` retrying `toHaveCSS` / `not.toHaveClass` / `expect.poll` | spec x20 per browser by worker (40/40), x10 per browser by sub-lead (20/20) |
| S3 aside output split multi-byte UTF-8 characters at chunk boundaries | `machine/lib/aside-turns.js:105` `setEncoding('utf8')` on child stdout/stderr (all providers) | `machine/test/aside-turns.test.js` split-write fixture returns `café` |
| S3 Pi failure before the session header lost Pi's error and limit flag | `machine/lib/aside-turns.js:134-141`: no valid header + non-zero exit or stderr → redacted Pi error and limit rule; exit 0 with no header and no stderr keeps `invalid Pi session header`; a bad header is never saved | aside-turns tests: stderr 429 exit 1 → failed, limit true; key redacted; exit-0 missing header |

Validation on the merged tip after remediation (run by the sub-lead):

```
$ bash codex/test/run.sh
RESULT 159 passed, 0 failed
$ bash machine/test/run.sh
# tests 488
# pass 488
# fail 0
$ node --test viewer/test/*.test.js
# tests 755
# pass 755
# fail 0
$ bash install/test/run.sh
RESULT 206 passed, 0 failed
$ node test-support/smoke/pi-guard.js
Pi guard offline check passed
$ npm --prefix viewer run test:browser
  34 skipped
  1116 passed (11.7m)
```
The live aside check was not re-run (paid; the remediation does not change argv or the success path).

### Remediation 2 (after verification attempt 2 on 8e8d638f)

Attempt 2: Claude verifier PASS; GPT verifier FAIL with 2 gaps (see `REMEDIATION-2.md`). The out-of-worktree `AGENTS.md` context in read-only Pi asides is not a gap: settled in review round 4, and the lead agreed. The other gap was fixed:

| Gap | Fix (file:line) | Validated by |
|-----|-----------------|--------------|
| S3 validation: the Pi aside test's two stores raced on one `aside-turns.json.tmp` | `machine/test/aside-turns.test.js:188-190`: await the first store's writes; the version-gate store gets its own state folder | aside test x5 by worker, x6 by sub-lead (0 failures); machine suite |

Validation on the merged tip after remediation (run by the sub-lead):

```
$ bash codex/test/run.sh
RESULT 159 passed, 0 failed
$ bash machine/test/run.sh
# tests 488
# pass 488
# fail 0
$ node --test viewer/test/*.test.js
# tests 755
# pass 755
# fail 0
$ bash install/test/run.sh
RESULT 205 passed, 1 failed
FAIL real wheelchair directory is byte-identical after suite
$ node test-support/smoke/pi-guard.js
Pi guard offline check passed
```

The installer failure is that test's snapshot of the live `~/.wheelchair`, which running Codex sessions write to during the suite. Both attempt-2 verifiers saw it, the GPT verifier also on the pre-build commit, and an isolated-home rerun passed 206/206. This build changes nothing under `install/`. The first viewer run hung for 17 minutes in `app-balancer.test.js`, which this branch does not touch. That file then passed alone (43/43), and the full viewer rerun passed. The browser suite was not re-run: this remediation changed only a machine test, and both attempt-2 verifiers ran it green (1116 passed).
