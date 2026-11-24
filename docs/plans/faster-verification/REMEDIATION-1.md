# Remediation 1 — faster-verification

Verification attempt 1 on 091fbcdc: Claude verifier PASS, GPT verifier FAIL. The lead's per-gap answers are in PLAN.md's Log (2026-11-23).

## Gaps (verbatim, GPT verifier)

- GAP: S1 rule 3 — The picker skips a tracked fixture read by the Kimi tests — Removing `docs/plans/kimi-code/samples/wire.jsonl` in a scratch commit produced `suites: []`, while `viewer/test/app-kimi-hub.test.js:8` failed with `ENOENT`.
- GAP: S2 — The runner can exit 0 without writing the required summary — With passing stub suites and `summary.txt` occupied by a directory, the writes at `test-support/full-run.sh:33,41,65` failed and the runner still exited 0. → rare path, Accepted Risks (verification-1).
- GAP: S2 validation — The recorded full run does not establish a pass — `COMPLETION.md:82–101` records browser and machine exits of 1 on `87b61340`. The browser comparison found a different failing test on main, so it does not meet the same-test, same-error exception.
- GAP: S5.1/S5.3 — The verifier rules conflict when an older Spec names a whole suite that the picker omits — `protocol/app/verifier.md:47–50` requires every Spec command as written and separately forbids any whole suite the picker did not select.
- GAP: S5.5 — Finishing after deferral can hand off a build without a passing full run — `protocol/app/sub-lead.md:34–38,294–297` directs the sub-lead to send the build result on that path without applying the full-run gate at line 271.
- GAP: S5.6 — The after-done flow can advance to a push after the commit changes — `protocol/app/lead.md:532–537` gates the pre-merge commit on a full run, then instructs the lead to merge incoming PR commits, re-verify and push without requiring a passing full run for the resulting merge commit.

Deferred (lead): free-port race in `viewer/test/helpers/server.js` (PLAN.md Deferred 4).

## Tasks

| Task | Gap | Lane | Brief |
|---|---|---|---|
| R1 | S1 rule 3 kimi fixture: map every docs/ fixture tests read in `test-support/test-map.json` | light, gpt (built T1) | objective, boundary `test-support/test-map.json`, grep-and-classify method, scratch-clone pick per new glob |
| R2 | S5.1/S5.3, S5.5, S5.6 wording in verifier.md, sub-lead.md, lead.md | light, claude (built T5) | exact sentences to add, protocol-rules test |
| — | S2 validation | sub-lead | fresh full run on the fixed commit at a quieter time; each failure confirmed on main by S5.2 or re-run alone as a load flake, recorded in COMPLETION.md (lead's ruling, PLAN.md Log) |
