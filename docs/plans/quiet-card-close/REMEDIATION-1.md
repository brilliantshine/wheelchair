# Remediation 1 — quiet-card-close

Verification attempt 1 at `f7584922`: GPT verifier PASS, Claude verifier FAIL with one gap.

## Gap list (verbatim)

GAP: Validation (`node --test viewer/test/*.test.js` passes) — The branch adds a test, "dismissed quiet episode rearms the ladder after starter message or child start" (`viewer/test/app-quiet.test.js:132`), that fails intermittently when the machine is busy. Run 2 of the full suite failed only on it: `# tests 789 # pass 788 # fail 1`, `not ok 443`, `1 !== 2` at `app-quiet.test.js:141`. Run alone it passed 5 of 5. Running 6 copies of `app-quiet.test.js` at once, twice over, it failed in 2 of 12 runs, each time on this test only. Likely cause, from reading the code but not proven: the test's `ladder()` changes the thread and calls `checkQuiet` through a second `Hub` object in the test process, without the running server's thread lock (`app-quiet.test.js:134-140`). Meanwhile the server's own timer runs every 20 ms (`WHEELCHAIR_QUEUE_RETRY_MS: '20'`) and delivers the reminder queued at the previous step, so either side can overwrite the other's save. That is a race inside the test. The real app has one hub and does not race this way. The product code looks right; the fix is to make the test stable, for example by driving it through the server or retrying with `until(...)` instead of asserting straight away.

Judgment: normal use of a Spec validation command (always fixed). The product code is not in question.

## R1 — make the rearm test stable

# Brief R1 — make one flaky test stable (quiet-card-close remediation 1)

Plan slug: `quiet-card-close`. Task id: **R1**. Lead session: `wc-4866136bd5dd-lead` (message it only for something this brief does not settle). Gap: `docs/plans/quiet-card-close/REMEDIATION-1.md`.

## Problem
`viewer/test/app-quiet.test.js`, test "dismissed quiet episode rearms the ladder after starter message or child start" (~line 132), fails about 1 run in 6 under load at `assert.equal((await f.session(who)).quiet_stage, stage + 1)`. Its `ladder()` edits the thread and calls `quiet.checkQuiet` through a second `Hub` object (`f.hub`) in the test process, outside the running server's thread lock, while the server's own retry timer (every 20 ms) is delivering the reminder queued at the previous step. Either side can overwrite the other's save. The product code is correct; only the test races.

## Objective
Rewrite that one test so it no longer races, keeping what it proves: after a dismissed quiet card is reset by (a) a starter message and (b) a child start, the quiet ladder runs again from stage 0 and raises a **new** quiet card (id different from the dismissed one), for the worker case and for the sub-lead case.

Required approach: drive the ladder through the real server path, as the existing tests 1-4 do — `f.end(session)` turn-ended events, with `until(...)` waiting for each observable step (the agent reminder submitted, the starter reminder submitted, then a quiet card that is new and unanswered). Do not call `checkQuiet` or `f.hub.save` from the test while the server is running for the ladder steps. Seeding the dismissed card with the existing `seedQuiet` helper before the reset is fine (that happens before the server has anything queued for that session). For the sub-lead case, make sure the sub-lead's live children do not protect it (tests 7 and 13-18 show what protects a starter); use whatever the fixture already offers, e.g. a child that has reported (`f.result(child)`), and say in your report what you did.

## Ownership boundary
Only `viewer/test/app-quiet.test.js` (and only that test plus any small helper it needs inside the same file), and your report `docs/plans/quiet-card-close/reports/R1.md`. No product code changes. If you find the product code is actually wrong, stop and report it instead of changing it.

## Rules
- Never delete files with `rm` (or any other deletion).
- Never run `./install.sh`. Never start a viewer server by hand.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <exact paths>`.
- Your own `wc.js` and `card.js` calls are always allowed.
- If the same gate fails twice, stop and report rather than iterating.

## Validation (paste the summary lines of each into your report)
```bash
# load test: 6 copies at once, twice; all 12 must pass
for r in 1 2; do for i in 1 2 3 4 5 6; do node --test viewer/test/app-quiet.test.js > /tmp/r1-$r-$i.log 2>&1 & done; wait; grep -h '^# fail' /tmp/r1-$r-*.log; done
node --test viewer/test/*.test.js     # unquoted glob; must pass
```

## Deliverable
The commit, and `docs/plans/quiet-card-close/reports/R1.md` with the change, the pasted output, and a closing section:

**Choices:** List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.

Then post your `result` card (task `R1`).
