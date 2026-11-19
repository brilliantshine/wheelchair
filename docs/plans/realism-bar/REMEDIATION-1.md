# Remediation 1 — realism-bar

Verification attempt 1 on `648d1d3`: two verifiers (claude-opus-5-5, gpt-6.2-sol), both FAIL.
Merged gap list (duplicates merged); the sub-lead judged every gap normal use, none a rare path.

## Gaps, verbatim

From gpt verifier:

- GAP: S3/S8 — The settled-findings rule can suppress a normal-use defect that survives a claimed Spec fix. It declares anything listed in the Review Rounds table closed and removes the prior evidence-based `RE-RAISE:` exception for non-rare findings — `protocol/app/reviewer.md:54` and `protocol/app/lead.md:296`, which puts every finding in that table.
- GAP: S5 — The review progress rule excludes rare-path Accepted Risks from `found` but still tells the lead to increment `fixed` for each Accepted Risk saved. A round with one Spec fix and one rare risk can therefore reach `found: 1, fixed: 2`, which the card validator rejects — `protocol/app/lead.md:315` and `viewer/app/card.js:212`.
- GAP: S5 — Lighter-mode plan review still directs the lead to move hardening findings to Deferred without first excluding rare paths. The explicit restriction to realistic hardening appears in the later build-verification procedure, leaving conflicting instructions for a rare hardening finding during plan review — `protocol/app/lead.md:283`, `protocol/app/lead.md:326`, and `protocol/app/lead.md:404`.

From claude verifier (duplicate of the first gap above, merged):

- GAP: S3 / Non-goals ("reviewer line format unchanged") — the build deleted the reviewer's `RE-RAISE:` exception. On `main`, `reviewer.md:54-57` let a reviewer re-raise a `declined` or `accepted-risk` finding with concrete evidence its rationale was factually wrong, by starting the line with `RE-RAISE:`. T1b (`5741f16`) replaced it with an unconditional "do not raise it again". Neither S3 nor S8 asks for this. The app still parses the prefix (`viewer/app/agents.js:118-119`).

Cause of gap 1: the sub-lead's T1b brief supplied replacement text that dropped the pre-existing clause (brief defect, not worker error).

## Tasks

### R1-1 — restore `RE-RAISE:` (gap 1)
`protocol/app/reviewer.md`, settled-findings paragraph. Restore the pre-existing evidence exception for settled findings, keeping the new rule that rare paths and their variants are not re-raised.

### R1-2 — `fixed` counts only counted findings (gap 2)
`protocol/app/lead.md` ~318: `fixed` rises only for findings counted in `found`; a rare-path Accepted Risk or a `check-once-built` row never raises it.

### R1-3 — lighter-mode plan review: rare paths are not Deferred (gap 3)
`protocol/app/lead.md` ~286: "Move other hardening findings to Deferred" becomes realistic hardening only; rare paths go to Accepted Risks as the triage text below says.

All three are dispatched as one brief (same two files, sequential edits): `R1` below the exact text in the worker brief.
