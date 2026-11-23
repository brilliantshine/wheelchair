# Remediation 1 — win-tools-solid

Verification attempt 1 (commit `f4c67000`, verifier claude-opus-5-5): FAIL, 1 gap. No rare paths.

## Gaps (verbatim)

GAP: Validation (parent gone is noticed while an independent process keeps both pipe ends open) — the test passes even with the parent-gone check deleted, so nothing tests that check. In the test's setup the parent held the read end at start, so the pipe reader check catches the parent's exit first. The plan keeps the parent-gone check for the cases the other two checks miss, and none of those cases is tested. — Evidence: in a scratch copy of HEAD I replaced `process.ppid !== startPpid ||` with `false ||` at `machine/lib/win-tool-proxy.js:162`. `node --test machine/test/win-tool-proxy.test.js` then exited 0, and `parent loss ends proxy with held pipes, pending output, and a writing tool` (`machine/test/win-tool-proxy.test.js:194`) still passed. I also ran a scratch scenario where the pipe check is off at start: the parent closes its read end, a `sleep` process holds both pipe ends, then the parent exits. The real HEAD proxy exited. The mutant was still alive 1.5 s later. So the production code is correct, but deleting this check would not fail any test.

## Tasks

### R1-T1 — make the parent-loss test depend on the parent-gone check

Lane: light / gpt (same provider that built T1). Ownership: `machine/test/fixtures/win-tool/pipe-parent.py`
(and the test file only for a name change). In modes `off`, `gone`, `pending` and `writing`, start the holder
before the proxy and close the parent's read end, so the pipe check is off at start. Validation: the
proxy suite passes 3 times; a mutant without the ppid check fails the parent-loss test; a mutant without
the pipe check fails the OS-pipe test; `bash machine/test/run.sh` shows only the 5 pre-existing failures.
Full brief as dispatched is reproduced in the worker's report.
