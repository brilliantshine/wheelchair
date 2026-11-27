# Remediation 1 — escaped-keys

Verification attempt 1 on `9f2ed5da740f9b6a0163947bb95404b46eff1ffd`: verifier (claude / claude-opus-5-5) VERDICT: PASS; the starter's full run on the same commit failed three suites.

## Gaps (verbatim)

- Full run `machine` exit 1: `not ok 152 - (c) noise with 20 keys and three-layer spellings` — `(c) took 4752.2 ms (limit 3000 ms)`; `not ok 153 - (d) JSON with three-layer spellings and both cut edges` — `(d) took 4701.7 ms (limit 3000 ms)`. Output was correct; only the wall-clock limit failed, with the whole full run loading the machine (the verifier measured a load average of 24–37 on 16 cores and saw (c) at 3073 ms once).
- Verifier note: "The Spec asked for these cases to go in `key-redact.test.js`, which its validation command runs. They are in a separate `key-redact-speed.test.js` ... As a result only `machine/test/run.sh` runs them, not the Spec command."

Not sent to remediation:
- `install` exit 1, `FAIL real wheelchair directory is byte-identical after suite`: same test, same error at the comparison commit `672764ae` (run from a `git archive` copy of it). Already on main; does not fail the gate.
- `viewer-node` exit 1, `not ok 548 - 6 message clears debt` (`viewer/test/app-quiet.test.js:41`, a `delay(220)` timing assertion): this change touches no viewer file and the file passes 27/27 alone. To be confirmed by the next full run.

## R1-T1. Speed fixtures measured as CPU time, inside the Spec's test file

Judged: always fixed (a Spec validation command checks it). The redaction's own work is about 0.8–0.9 s for (c); wall-clock time on a machine running the whole full run in parallel measures the other suites, not the redactor. Decision: each fixture's limit is checked against the CPU time of the `redactCapture` call (`process.cpuUsage()` before and after, user + system), with the same limits (1 s for (o), 3 s for the rest); wall time is still printed. The five fixtures move into `machine/test/key-redact.test.js` so the Spec's command runs them, and `machine/test/key-redact-speed.test.js` is deleted.
