# Remediation 1

Verification attempt 1 (verifier `wc-ce2c2126fc85-verifier`, GPT gpt-6.1-sol, commit `6e3d4e5`). Verdict FAIL.

## Gap list (verbatim)

```text
GAP: Required Node validation — command exits 1, with 347/349 passing — known lifecycle failure (`viewer/test/lifecycle.test.js:449`) and missing font returning 404 (`viewer/test/routes.test.js:181`).
GAP: Required browser validation — unable to verify browser behavior or phone layout because `viewer/node_modules` is absent — `npm --prefix viewer run test:browser` exits 127: `playwright: not found`. Dependencies were not installed.

No implementation defect found in the Spec review. Feature tests and 384 additional placement checks passed. Working tree is clean.
```

## Diagnosis

Neither gap is in the implementation. Both trace back to the verifier's environment and to the verify brief:

- The verifier's worktree had no `viewer/node_modules`, and the brief told it not to install them. Without them the font route test 404s and Playwright is missing.
- The lifecycle failure is `docs/known-issues.md:6`. It fails the same way before this change.

## Tasks

### R1-1 — re-verify with dependencies installed (brief fix, no code change)

- Objective: a fresh verifier runs both validation commands after `npm --prefix viewer ci`. It checks every failing test against the pre-change base `99a6a3a`, by running that same test from `git show`, or by reading `docs/known-issues.md`. A failure recorded there that this change does not touch counts as pre-existing, not a gap.
- Ownership: none (verifier is read-only apart from `viewer/node_modules`, which is gitignored).
- Validation: `npm --prefix viewer ci && node --test viewer/test/*.test.js && npm --prefix viewer run test:browser`.
