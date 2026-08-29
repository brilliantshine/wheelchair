---
slug: <slug>
date: <YYYY-MM-DD>
implemented-by: <lanes/models used, e.g. "terra (lead: fable)" or "sonnet, terra">
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty. Shape below.
---

# Completion Report — <Title>

Written for a hostile reviewer: every claim checkable, no claim without evidence.

`verified-by` starts empty and Stage 4 appends to it — one entry per verifier per round, so a
mixed-family round contributes two. Rounds append and never overwrite: that stage loops through
remediation and forbids erasing history, and what checked round 3 is not what checked round 1.
`lane` and `checks` together say whether that pair crossed families, so nothing restates it.

```yaml
verified-by:
  - round: <n>
    lane: <verifier lane/model>
    checks: <the implementing lane it checked>
```

## Spec coverage

One row per spec item, no omissions.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
|           | this run / pre-existing | | |

`pre-existing` rows came from the plan's Prior Work section — code this run did not write.
They are listed so coverage is complete and provenance is honest, not because they are
exempt: Stage 4 verifies them like everything else.

## Deviations from plan

What differs from the Spec and why. "None" if none.

## Routers

What this change did to the routers (`AGENTS.md`/`CLAUDE.md`) in the directories it touched.
Name each router updated and what became true in it. "None — this change moved no ownership
and no router named a file it touched" is a valid answer, and is the common one; a blank
section is not.

## Validation evidence

Commands run and their pasted output (tests, builds, manual checks).

## Known gaps / residual risks

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
