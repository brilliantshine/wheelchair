# Remediation 2 — realism-bar

Verification attempt 2 on `9a6c511`: claude-opus-5-5 PASS; gpt-6.2-sol FAIL with two gaps.
Merged list: two gaps, both judged normal use by the sub-lead (none rare).

## Gaps, verbatim

- GAP: S3 / Non-goals — Remediation restored `RE-RAISE:`, but the closure rule still sweeps in upheld findings recorded in Review Rounds. If the lead correctly upholds a normal-use defect and the Spec edit only partly fixes it, the next reviewer can show the defect remains while the original rationale for upholding it is still correct. The exception only permits challenging a factually wrong rationale — `protocol/app/reviewer.md:54–59`, `protocol/app/lead.md:297–302`.
- GAP: S5 — The lead's planned-thread verifier briefs omit the Accepted Risks table. After-done checks receive the reported problem and Spec, and repair checks receive the Spec and repair details. A later verifier can therefore report an already settled rare path again, even though the lead recorded it as `lead-check` — `protocol/app/lead.md:106–109`, `protocol/app/lead.md:455–459`, `protocol/app/lead.md:637–639`. The sub-lead's build-verifier brief includes the table at `protocol/app/sub-lead.md:232–233`.

Judgment: gap 1 affects every review round (normal use); cause is the sub-lead's T1b replacement text ("anything listed in those sections" took in the Review Rounds table). Base `main` closed only `declined` and `accepted-risk`. Gap 2 goes slightly beyond S5's wording but serves IDEA.md ("later rounds do not raise them again") and is one sentence.

## Tasks

### R2-1 (gap 1)
`protocol/app/reviewer.md` settled-findings paragraph: closure applies to findings marked `declined`, `accepted-risk` or `check-once-built` and to rows in Accepted Risks and Check Once Built; an `upheld` or `downgraded` finding whose defect is still in the current Spec may be raised again as a new finding.

### R2-2 (gap 2)
`protocol/app/lead.md` "Gaps from your own verifiers" paragraph: on a planned thread, every such verifier brief includes the plan's Accepted Risks table.
