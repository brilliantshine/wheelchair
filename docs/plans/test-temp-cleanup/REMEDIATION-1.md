# Remediation 1 — test-temp-cleanup

Verification attempt 1 (verifier `wc-25ba351f336d-verifier`, GPT `gpt-6.1-sol`, commit `db1dc52`): FAIL.

## Gap list (verbatim)

> GAP: Spec §7, router documentation — `viewer/AGENTS.md:65` still places cache roots under `test/.tmp/`; the new cleanup guidance at `:73` is inside the Bash fence. Extracting that command block and running `bash -n` exits 2: "syntax error near unexpected token `('".

The sub-lead also found the same staleness at root `AGENTS.md:69`, where `.gitignore`'s row says the viewer suites write `viewer/test/.tmp/`. It is folded into R1.

## Tasks

### R1 — fix the viewer router and the root `.gitignore` row (GPT light)

Ownership: `viewer/AGENTS.md`, `AGENTS.md`, `docs/plans/test-temp-cleanup/reports/R1.md`.

1. `viewer/AGENTS.md` "## Tests": the code block must contain only the two command lines. Close the fence directly after the `npm --prefix viewer run test:browser` line, then one blank line, then the "Test temp folders come from…" sentence as ordinary prose, outside the fence.
2. `viewer/AGENTS.md:65`, the `test/` row: replace `starts a server on a free port with its own cache root under \`test/.tmp/\`` with `starts a server on a free port with its own cache root, a folder from \`test-support/run-dir.js\` under system temp`.
3. Root `AGENTS.md:69`, the `.gitignore` row: replace `and the two scratch paths the viewer's suites write, \`viewer/test/.tmp/\` and \`test-results/\`.` with `\`test-results/\`, which the browser suite writes, and \`viewer/test/.tmp/\`, where older checkouts' viewer suites wrote scratch folders (\`test-support/run-dir.js\` sweeps entries there over an hour old).`

Validation: extract every ```bash block of `viewer/AGENTS.md` and `bash -n` it (exit 0); `grep -n "test/.tmp" viewer/AGENTS.md AGENTS.md`; `git diff`.
