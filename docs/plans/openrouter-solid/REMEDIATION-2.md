# Remediation 2 — openrouter-solid

Verification attempt 2 on commit 8e8d638f: Claude verifier PASS; GPT verifier FAIL. Gaps verbatim (GPT verifier):

- GAP: S3 — Pi adds out-of-worktree instructions to read-only aside prompts — An offline Pi 1.5.2 check used the shipped argv from `machine/adapters/pi.js:64` and confirmed that the system prompt included fixture `AGENTS.md` files from the worktree's parent and the Pi account directory while the guard was loaded.
- GAP: S3 validation — The Pi aside test races two fixture stores writing the same temporary file — Both machine suite runs failed with `ENOENT` renaming `aside-turns.json.tmp`. The second store at `machine/test/aside-turns.test.js:188` shares the directory and fixed temporary filename used by the first store at lines 13 and 168.

Judgment: the context-file gap repeats review round 4's declined finding (the aside forks the lead's session, which already holds what Pi loaded for the lead; the files are instructions, not secrets; tool reads stay guarded). Raised to the lead as not a gap. The test race fails a Spec validation command: must-fix.

## Tasks

### R2a — test race (built by GPT in T5/R1b; routed to GPT)
`machine/test/aside-turns.test.js`: the version-gate store gets its own state folder, and the test awaits the first store's pending writes first. Validation: the aside test five times, then `bash machine/test/run.sh`.
