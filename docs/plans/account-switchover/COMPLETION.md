---
slug: account-switchover
date: 2026-11-22
implemented-by: "T1 standard gpt-6.1-terra (attempt 2 at effort xhigh); T2 standard gpt-6.1-terra; T3 standard claude-sonnet-5-5; T4 live probe by the sub-lead (claude-opus-5-5)"
verified-by: []
---

# Completion Report — Switch accounts when one hits its limit

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

All rows are `this run` (the plan has no Prior Work).

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 Claude trigger: `limit-hit` with a future `limited_until` | this run | `viewer/app/sessions.js:619-636` (existing future-limit branch now starts a switch at `:626-634`) | `viewer/test/app-switch.test.js` (claude switch case) |
| §1 Codex trigger: `turn-ended` with a future `reading.limited_until` | this run | same branch, `viewer/app/sessions.js:619-636` | `viewer/test/app-switch.test.js` (gpt switch case); T4 live probe |
| §1 no report from the limited turn | this run (unchanged code path kept) | `viewer/app/sessions.js` turn-ended block (`limitEnded` skips `deliverReport`) | `app-switch.test.js` switch cases assert no report reaches the starter |
| §1 limit recorded on the old account before the account changes | this run | `viewer/app/sessions.js:619-625` (record) before `:627` (choose) and `:588` (account change on acceptance) | `app-switch.test.js` |
| §1 machine drops hook events while `switching` | this run | `machine/service.js:1586` | `machine/test/switch-http.test.js:112`, `machine/test/switch.test.js:24` |
| §2 switch selector, same provider and machine, no model-slot check | this run | `viewer/app/balancer.js:51-65` | `app-switch.test.js:67` |
| §2 lead reserve gate and live-session counts shared with `choose()` | this run | `viewer/app/balancer.js:45-50` used by `choose()` (`:99-100`) and `chooseSwitch` (`:54-55`) | `app-switch.test.js:86`; existing `app-balancer.test.js` unchanged and passing |
| §2 `usage.rank()` unchanged, its `next` taken | this run | `viewer/app/balancer.js:58` | `app-switch.test.js:67` (alternates for lead, mapper, reviewer) |
| §2 gpt preflight on the winner, pick once more on failure | this run | `viewer/app/balancer.js:59-62` | `app-switch.test.js:67` |
| §2 no account left: today's hold and `Continue.` | this run (fallthrough) | `viewer/app/sessions.js:623-636` (`limited_until` kept when `chooseSwitch` is null) | `app-switch.test.js:48` (incl. gemini never switches) |
| §3 hub 2: `switching = {id,to,at}` holds delivery; then `limited_until` deleted | this run | `viewer/app/sessions.js:630-632`, `held()` at `:506` | `app-switch.test.js` (held message not delivered) |
| §3 hub 3: request after the handler returns; body (`switch_id`, account id/dir, session `model`, `project`, `project_dir`); 3 tries; give up on HTTP error or unreachable | this run | `viewer/app/sessions.js:711` (setImmediate), `:576-593` | `app-switch.test.js:76` (404 and unreachable) and the switch cases (body asserted) |
| §3 hub 4: on acceptance `account`, `switches[]`, `recordChosen` | this run | `viewer/app/sessions.js:586-589` | `app-switch.test.js` switch cases |
| §3 hub 5: only matching `ready`/`switch-failed`; carry-on first, then held messages; session end clears `switching` | this run | `viewer/app/sessions.js:609`, `:656-668`, `:910`; carry-on text `:571` | `app-switch.test.js:57` and switch cases |
| §3 hub 5: no quiet reminders while `switching` | this run | `viewer/app/quiet.js:7`, `:12`, `:40` | `app-switch.test.js:76` |
| §3 machine route, async accept, idempotent `switch_id`, outcome kept outside the snapshot | this run | `machine/service.js:865-883`, route `:2313`; `machine/API.md:11` | `switch-http.test.js:112`, `:162`; `switch.test.js:24` |
| §3 machine 1: final transcript flush | this run | `machine/service.js:891` | `switch-http.test.js:136` |
| §3 machine 2: copy (never move) the Claude / Codex conversation file to the same relative path | this run | `machine/service.js:892-897` | `switch.test.js:55`, `switch-http.test.js:136` (old file still present); T4 live probe |
| §3 machine 3: record update, `switching`, transcript rebind with offset kept, `last_reading` and statusline throttle cleared | this run | `machine/service.js:898-904`, `:871-874` | `switch-http.test.js:136` |
| §3 machine 4: shared launch builder; inputs from the record plus request `model`/`project`/`project_dir`; saved prompt reused; resume args; worktree, reservation, first message, ledger, `new-session` skipped | this run | `machine/service.js:928-1021` (`prepareLaunch`, used by start at `:839` and switch at `:908`); `machine/adapters/claude.js:73` (`--resume`), `machine/adapters/codex.js:145` (`resume <id>`) | `switch-http.test.js:136` (real preparation both CLIs, reviewer read-only, no worktree, no first message); `switch.test.js:11` |
| §3 machine 5: `respawn-pane -k`, then `starting`; any failure restores the whole snapshot and emits `switch-failed` | this run | `machine/service.js:909-920` | `switch-http.test.js:162` (missing transcript, copy, preparation, respawn failures) |
| §3 machine 6: own 30 s readiness window; ready emits `switch_id`; exit or miss ends the session with no `stuck` | this run | `machine/service.js:1190-1215`, `:1238`, `:922-927` (`stopFatal`) | `switch-http.test.js:181`, `switch.test.js:45` |
| §3 carry-on text and `[wc:context switch]` marker: hidden with no line, reply shown | this run | `viewer/app/chat.js:128`; `protocol/app/cards.md:193` | `viewer/test/app-chat.test.js` (switch marker test) |
| §4 failed resume = crash; normal dead-session handling restarts | this run | `machine/service.js:922-927`; `viewer/app/sessions.js:910` | `switch-http.test.js:181` |
| §5 Agents details: account name, "moved from", "a removed account" | this run | `viewer/app/agents.js:62-66`, `:84`, `:138`; `viewer/pages/agents.js:246` | `viewer/test/app-agents.test.js` (account test), `viewer/test/app-agents-account.spec.js` |
| Validation: first build task live probe (CLI level and through the machine) | this run | PLAN.md Log, 2026-11-22 Probe and T4 lines | Log entries with pasted facts |
| Check Once Built 1: `--session-id` beside `--resume` | this run | settled: dropped (`machine/adapters/claude.js:73`) | probe: CLI exits "--session-id with --continue or --resume also needs --fork-session" |

## Deviations from plan

- Added (not in the Spec): `claude.answerPrompts` answers "Try the new fullscreen renderer?" with "Not now" (`machine/adapters/claude.js:80`). The probe showed it on a resumed launch under the second account; unanswered it would keep readiness false and turn every Claude switch into a crash. It applies to plain starts too.
- The machine sets `status = 'switching'` when it accepts the request rather than at step 3, so hook drops start a little earlier. The Spec's order is otherwise kept.
- None else.

## Routers

None — this change moved no ownership. `machine/API.md` (contract doc, not a router) gained the switch route row.

## Validation evidence

Merged tip `bd6223c2` (code identical to `94eb862c`).

`bash machine/test/run.sh`:
```
# tests 622
# pass 603
# fail 19
EXIT 1
```
All 19 failures are Windows bridge tests that cannot run here: 16 in `win.test.js` (these 16 also fail on the base commit 12f9c5ea, run by the sub-lead: `# tests 21 # pass 5 # fail 16`), 2 in `win-tool-ready.test.js` (`spawnSync wslpath ENOENT`; file and `machine/lib/win*.js` untouched by this build), and 1 `win-tool-proxy.test.js` test (579) whose fixture child hung in the full run and was killed so the run could finish. The same hang hit the T1 worker's run. Run alone, it passes:
```
node --test machine/test/win-tool-proxy.test.js machine/test/switch.test.js machine/test/switch-http.test.js
# tests 29
# pass 29
# fail 0
```

`node --test viewer/test/*.test.js`:
```
# tests 844
# pass 844
# fail 0
EXIT 0
```

`npm --prefix viewer run test:browser`:
```
  34 skipped
  1310 passed (14.3m)
EXIT 0
```

Live probe through the machine (T4; details in PLAN.md Log): Claude default -> personal, `ready` with `switch_id`, carry-on reply "KESTREL-7064" (pre-switch fact), `turn-ended` at the hub with the copied transcript path; Codex work1 -> work2, `ready` with `switch_id`, reply "PLOVER-3391", `turn-ended` reading `account: work2`, week 79% (work1 was 90%) stamped during the carry-on turn. Both CLIs append to the copied file.

## Known gaps / residual risks

- Accepted Risks in PLAN.md stand as written.
- `requestSwitch` holds the thread lock through up to 3 tries (about 2 x 2 s plus client timeouts) when the machine is unreachable; other events for that thread wait meanwhile.
- `viewer/app/agents.js` labels every account "a removed account" if Settings cannot be loaded (only reachable from test hubs without `state.settings`).
- The probe found Claude prints a one-time "can't use thinking from another organization" note after resuming under another account; harmless, the conversation continues.
- `protocol/app/lead.md` lists the other `[wc:context ...]` markers but not the switch one (outside this plan's ownership).

## Remediation rounds

### Remediation 1 — 2026-11-22

Verification attempt 1 (commit 38075fee): Claude verifier PASS; GPT verifier FAIL with 4 gaps (verbatim in `REMEDIATION-1.md`). Two were judged rare paths and added to Accepted Risks with round `verification-1`: a stop mid-switch followed by a late `ready` (sub-lead's call), and a switch the machine accepts while the hub loses every reply (lead's call). Two were fixed:

| Gap | Fix | Lane | Evidence |
|-----|-----|------|----------|
| A Claude first-run prompt that keeps showing bypasses the relaunch's 30 s window | `machine/service.js:1193`: once a relaunch's window has run out, `checkReady` ends the session (`failedResume` -> `stopFatal`) before answering any prompt; plain starts unchanged | R1, light / gpt-6-luna | `machine/test/switch-http.test.js:205-234` (expired ends with no keys sent and no stuck/ready; recent and plain start still answer); mutation failed the expired case |
| Validation tests did not guard report suppression with a starter, gemini with a second account, or the real quiet sweep | `viewer/test/app-switch.test.js`: gpt reviewer case (no report reaches its starter), worker cases with a live starter, gemini with a second signed-in account, the real `quiet.checkQuiet` sweep with a positive control | R2, standard / gpt-6.1-terra | mutations: removing `limitEnded` fails the reviewer case; allowing gemini to switch fails the gemini case; removing the `switching` checks in `quiet.js` fails the quiet case |

Validation on the remediated tip:

`node --test machine/test/switch.test.js machine/test/switch-http.test.js`: `# tests 9 # pass 9 # fail 0`.
`node --test viewer/test/app-switch.test.js`: `# tests 12 # pass 12 # fail 0`.
`bash machine/test/run.sh`: `# tests 623 # pass 605 # fail 18`. All 18 are the same Windows bridge tests as before (16 `win.test.js`, 2 `win-tool-ready.test.js`; no `wslpath` here). `win-tool-proxy.test.js` did not hang this time.
`node --test viewer/test/*.test.js`: `# tests 849 # pass 848 # fail 1`. The one failure, `viewer/test/server.test.js:579` "the global write lock serializes concurrent writes and retry retains both changes", is in a file this build never touched, and passed alone twice (`# pass 50 # fail 0`).
The browser suite was not re-run: no page, page script or browser-served file changed in remediation (only `machine/service.js` and a node test).

### Remediation 2 — 2026-11-22

Verification attempt 2 (commit 23e99161): Claude verifier PASS; GPT verifier FAIL with 3 gaps (verbatim in `REMEDIATION-2.md`). Two rare paths went to Accepted Risks with round `verification-2` (a failed tmux kill after a missed relaunch window; a failed state write when accepting a switch). One was fixed:

| Gap | Fix | Lane | Evidence |
|-----|-----|------|----------|
| No switch test fails when `project_dir` is dropped from the relaunch inputs | `machine/test/switch.test.js:69`: the stubbed `prepareLaunch` asserts `input.project_dir` equals the request's `project_dir` (the session record has none, so it can only come from the request) | R3, light / gpt-6-luna | worker's mutation (dropping `project_dir` at `machine/service.js:907`) failed at the new assertion; restored, `git diff -- machine/service.js` empty |

Validation on the remediated tip: `node --test machine/test/switch.test.js machine/test/switch-http.test.js`: `# tests 9 # pass 9 # fail 0`. Only a machine test file changed, so the other suites stand as recorded under Remediation 1 and in both attempt-2 verifier reports (viewer 849/849; browser 1310 passed).
