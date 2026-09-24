# Remediation 2 — arriving-cold

Verification round 2 (closure review), 2026-09-24. The Claude verifier (checks terra) returned
`VERDICT: PASS`, with two non-blocking prose notes. The `gpt-5.6-sol` verifier (checks sonnet)
returned `VERDICT: FAIL` on one gap.

## Gap, verbatim

```
GAP: Malformed wording-list handling — a valid Confirmed row followed by malformed text is still injected instead of treating the whole register as empty — `seen/hook.sh:45-49` silently skips malformed lines; reproduced at HEAD despite the narrower missing-header test at `seen/test/hook_test.sh:34-35`
```

This gap survived round 1 because Remediation 1's brief told the lane to keep skipping
unmatched lines inside a well-formed file; the lane did what it was told. The brief was the
defect. Per `protocol/verification.md`, a gap surviving round 1 takes one rung in a fresh lane:
the work was nearly right, so the rung is `xhigh` at the same tier, on a rewritten brief.

**The rule, now decided:** inside the three sections, every line is either blank or a valid
entry (`- YYYY-MM-DD — "phrase" — instead`). Any other line inside a section makes the whole
file malformed. Text above `## Confirmed` (a hand-written preamble) is allowed. The hook
treats a malformed file as empty; `wording.sh` refuses to edit it (exit 1, file unchanged).

The Claude verifier's two prose notes were fixed by the lead: the README layout line for
`install.sh` now names the `seen/` step, and `protocol/seen.md`'s refusal list now names the
non-table and dotted-key forms `set.sh` refuses.

## Task

| # | Objective | Ownership boundary | Lane | Validation |
|---|-----------|--------------------|------|------------|
| R2-1 | Apply the rule above in `seen/hook.sh` (malformed → no entries) and `seen/wording.sh` (malformed → exit 1, unchanged), sharing no code but using the same definition. Tests: a valid Confirmed row followed by a garbage line inside `## Confirmed`, and separately inside `## Struck`, → hook prints nothing; `wording.sh suggest` on either file → exit 1, file byte-identical; a file with a preamble line above `## Confirmed` and valid sections → entries still carried and `suggest` still works | `seen/hook.sh`, `seen/wording.sh`, `seen/test/hook_test.sh`, `seen/test/wording_test.sh` | GPT / gpt-5.6-terra, `xhigh` (rung: round-2 surviving gap) | `WHEELCHAIR_LANE=1 bash seen/test/run.sh` and `env -u WHEELCHAIR_LANE bash seen/test/run.sh`, both exit 0 |
