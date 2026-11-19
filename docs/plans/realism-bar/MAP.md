# Map: realism bar

Checked against: `3abf9df2694e434f6879e147a2338ca9882d5219` (origin/main); historical evidence is from branch `wc/01b8cb1bf051`. Current flow and file coverage: `docs/maps/realism-review-verification.md`.

```text
review finding -> lead triage -> Spec fix / Accepted Risk / question -> clean test
verification gap -> lighter-mode classification or remediation -> re-verify -> surviving-gap question
```

The current normal-use boundary applies to lighter-mode Deferred hardening, not as a universal review or verification bar; thorough moves Deferred back to Spec (`protocol/app/lead.md:209-230,272-278`). Reviewer severity is based on worker consequences, while verifier GAPs are evidence-backed Spec failures; the lead can already accept review risks, but verification ordinarily remediates and escalates a gap surviving two fixes (`protocol/app/reviewer.md:41-70`; `protocol/app/verifier.md:38-50,93-117`; `protocol/app/lead.md:285-324`; `protocol/app/sub-lead.md:264-278`). PLAN's Accepted Risks and Deferred have different existing roles (`protocol/templates/PLAN.md:53-88`).

In `wc/01b8cb1bf051:docs/plans/kimi-code/PLAN.md:81-96`, decisions 44–58 record repeated rare-path and surviving-gap choices; decision 59 applies from attempt 13: fix normal-use breakage and anything checked by a Spec validation command, and record rare paths as Accepted Risks without asking. It defines normal use for Kimi and lists lost-state restarts, mid-operation file corruption or swaps, malformed inputs Kimi never writes, unusual approval layouts and sub-second races as rare. Earlier remediation files show the previous per-gap choices: `wc/01b8cb1bf051:docs/plans/kimi-code/REMEDIATION-3.md:18`, `REMEDIATION-10.md:15`, `REMEDIATION-11.md:14`, and `REMEDIATION-12.md:14`.

Viewer dependencies exist: reviewer lines are parsed for display and approval card severity is validated (`viewer/app/agents.js:114-120`; `viewer/app/card.js:101-108`). The focused map records the lighter-mode card validator as well.

## Not looked at

No live workflow, exhaustive machine or viewer parser audit, or every historical remediation task was checked. Existing broad maps have changes since their checked commits and were not relied on for this focused flow.
