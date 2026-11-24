# Remediation 2 — faster-verification

Verification attempt 2 on cb98f7a2: Claude verifier FAIL, GPT verifier FAIL. The lead's per-gap answers are in PLAN.md's Log (2026-11-23).

## Gaps (verbatim, merged)

- GAP (GPT): S1 rule 3 — Existing test-map entries suppress fallback while omitting tests that read the changed files directly — In a scratch clone, deleting `connectors/pi/guard.js` selected only `connectors-contract.test.js`, which passed 4/4. The omitted `pi-guard.test.js` failed with `ENOENT`. Deleting `viewer/doc.js` selected only `render.spec.js`, while the omitted `routes.test.js:202` got HTTP 500 instead of 200. See `test-support/test-map.json:35` and `:56`.
- GAP (Claude): S1 rule 3 — The picker misses a protocol file that a suite outside viewer/machine reads. `sensitivity/test/run.sh:78-85,242` reads the repository's own `protocol/sensitivity.md`, but `test-support/test-map.json:2-11` maps `protocol/**` only to the six viewer and machine tests.
- GAP (Claude): S1 rule 3 — The picker misses a script that other suites copy and run. `sensitivity/test/run.sh:310` and `sudo-helper/test/install-test.sh:8` copy `$repo/install/guard.sh` and run it. No map entry covers this, so a change to `install/guard.sh` picks only `bash install/test/run.sh`.
- GAP (GPT): S1 command output — Rare path: Test filenames containing spaces produce unusable shell commands — `test-support/pick-tests.js:100` prints the filename unquoted. → Accepted Risks (verification-2).
- GAP (GPT): S5.0/S5.3 — The verifier instructions assume Wheelchair's picker flags for every opted-in project — `protocol/app/verifier.md:49` specifies `--base` and `--head`, although S5.0 permits a project to declare any picker command that takes a base commit.
- GAP (GPT): S5.5 — The sub-lead can hand off before saving the required full-run evidence — `protocol/app/sub-lead.md:273` directs it to send the build result before pasting `summary.txt` into `COMPLETION.md`.

The first three are one gap class (incomplete map entries), and the second time it has come up (attempt 1: the kimi fixture).

## Tasks

| Task | Gap | Lane | Brief |
|---|---|---|---|
| R3 | S1 rule 3, map completeness: every entry lists every reader across all suites, or is removed; real-tree sample test | standard, gpt (built T1/R1); brief rewritten with the bar and method, not a bigger model | ownership `test-support/test-map.json`, add-only tests |
| R4 | S5.0/S5.3 and S5.5 wording | sub-lead (claude, built T5/R2), two sentences | — |
