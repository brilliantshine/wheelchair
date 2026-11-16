# Remediation 1 — silent-stops

Verification attempt 1 (verifier `wc-989abf66ac00-verifier`, claude-opus-5-5) checked
`34a33d6`: **FAIL**, one gap.

## Gap list (verbatim)

```
GAP: Tests, item 5 (and the IDEA constraint that a report that's only late must not be flagged) — test 5 doesn't test the grace period. It posts the `result` right after the `turn-ended` event, before any timer tick, so the late-report case never happens. It passes with the grace removed, so it doesn't "fail before its fix" — evidence: `viewer/test/app-quiet.test.js:31`. In a scratch copy of HEAD with `viewer/app/quiet.js:12` changed to `quiet_check_at = new Date(Date.now())` (no grace), `node --test --test-name-pattern='^5 ' viewer/test/app-quiet.test.js` printed `ok 1 - 5 late result within grace prevents nudge` 5 times out of 5. The detector code itself does apply the grace correctly; only the test that should guard it is missing. A fix would hold the result back past at least one retry tick but inside the grace (for example, a grace of about 150 ms and the card posted after about 60 ms).
```

The verifier also noted that COMPLETION.md's failing-first figure (17 of 18 fail, only test 9
passing) is off for the final test file: run against the pre-build code, tests 5, 6 and 9 pass.
The 17-of-18 figure was measured with the test file as first committed (`4b750ca`), where tests
5 and 6 still expected the wrong HTTP status. Corrected in COMPLETION.md's Remediation 1 section.

## Tasks

### R1-T1 — test 5 must exercise the grace

- **Objective:** replace test 5 so the `result` arrives after several retry ticks but inside a
  longer grace, and the test fails when the grace is removed.
- **Ownership:** `viewer/test/app-quiet.test.js` only.
- **Change:** exactly the diff given in the brief (the fixture and `run` take extra env; test 5
  uses `WHEELCHAIR_QUIET_GRACE_MS: '300'`, posts the result 100 ms after the turn end, then
  waits 500 ms and asserts no submit and `owes_reply` false). Already checked by the sub-lead in
  a scratch copy: 18/18 pass three runs in a row; with `quiet.js:12` arming at `Date.now()`,
  test 5 fails three runs out of three.
- **Lane:** Light, `--provider gpt` (the provider that built T1).
- **Validation:** `node --test viewer/test/app-quiet.test.js`; the mutation check below;
  `node --test viewer/test/*.test.js`.

### R1-T2 — app-quiet tests reliable under load (found by the sub-lead, not the verifier)

- **Evidence:** 8 runs of `node --test viewer/test/app-quiet.test.js` at 4 concurrent: test 7
  failed once (`expected: 2, actual: 3`), test 12 once (`timed out waiting for condition`); one
  of 6 sequential runs failed test 16; R1-T1's full-suite run failed test 7.
- **Cause:** tests change persisted thread state through a second `Hub` (`edit`, `hub.save`,
  `hub.enqueue`) outside the server's per-thread lock while the 20 ms tick reads and saves the
  same thread; `until` times out at 2 s.
- **Objective:** the 18 tests keep their meaning and become reliable under load; no product
  code change unless a real detector bug is found (then report it, do not fix it).
- **Lane:** Standard, `--provider gpt`.

