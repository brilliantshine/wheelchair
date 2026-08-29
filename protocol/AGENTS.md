# `protocol/` — the stage definitions

Owned by [the repo root](../AGENTS.md). Every rule this workflow runs on is a markdown
file here. The wrappers in `skills/` and `codex/prompts/` only point at one.

The organizing idea: **a document here is read by an agent mid-task, so it states the
failure it exists against rather than describing a process.** A rule whose reason is
missing gets optimized away by the next agent that finds it inconvenient.

## Stage order

```
map.md → planning.md → plan-review.md → implementation.md → verification.md
MAP.md    IDEA.md +      approved         COMPLETION.md      REMEDIATION-N.md
          PLAN.md
```

`adopt.md` is the side door: a plan written outside this workflow enters through it and
lands at one of the statuses the machine already has.

| File | Role |
|---|---|
| `planning.md` | Stage 1. Map the code before the idea; one question at a time, the queue lives in the doc |
| `plan-review.md` | Stage 2. Two independent adversarial reviewers; the lead adjudicates every finding |
| `implementation.md` | Stage 3. The lead briefs and integrates, cheap lanes implement |
| `verification.md` | Stage 4. A fresh verifier tries to falsify the completion claims |
| `adopt.md` | The on-ramp for a plan document written elsewhere |
| `lanes.md` | How every stage spawns a subagent. **The only place invocations live** |
| `writing.md` | How anything a person reads is written. Governs messages, not documents |
| `map.md` | How to explain existing code: flow first, grounded in `file:line`, no filler |
| `diagrams.md` | Which diagram a document gets, and what keeps it from lying |
| `graphs.md` | The graph format read by both harnesses — schema, verdicts, preservation, how the viewer starts |
| `sensitivity.md` | The diagram-sensitivity dial: the region rendered into present harnesses' always-on files, and what each level draws |
| `routers.md` | The router format — what `/spine` creates and the Stage 3 upkeep rule maintains |
| `spine.md` | The `/spine` run sequence. Takes a path, not a slug, and sits outside the state machine |
| `templates/` | The skeletons a stage writes from: `MAP.md`, `IDEA.md`, `PLAN.md`, `COMPLETION.md` |

## Boundaries

- **A stage document never restates a lane invocation.** `lanes.md` owns those. A copied
  invocation drifts, and a stale one silently spends the wrong model or races the single
  account's one-shot credential.
- **Never add a second gate for a rule that already has one.** Two overlapping
  instructions with neither marked authoritative is worse than one in an imperfect place.
  The router-spine plan's own review caught this twice.
- **A template edit is a contract change.** Stage 3 tells lanes to write COMPLETION.md
  from `templates/COMPLETION.md`, so a rule added to the prose and not the template
  reaches nobody.
- Nothing here is per-feature state. That lives in `docs/plans/<slug>/`, and editing a
  stage's rules is not the same act as editing a plan.

## Tests

None — these are documents. The check that they work is that a stage run from either
harness produces the same artifacts, and that a rendered wrapper points back into this
working tree, so an edit here takes effect immediately in every rendered harness.

`sensitivity.md` is the one file here that does not: its delimited region is rendered into
each present harness's global instruction file, so editing inside the markers needs
`sensitivity/set.sh` to run before it reaches that harness. `bash sensitivity/test/run.sh`
asserts what lands there — that present targets receive the substituted region and, when both
are present, match each other; and that every rule the plan requires the region to carry remains.

**That last part is a regression tripwire, not a conformance test**, and the difference matters
if you are the one editing the region. It greps for a phrase per rule, so it catches a rule
quietly disappearing; it cannot catch one *qualified* into meaning something else, and a green
run is not evidence the region is right. The authority for what the region must contain is the
plan that specified it — `docs/plans/diagram-sensitivity/PLAN.md`, the region-contents list in
its Spec. `sensitivity/AGENTS.md` carries the full boundary.
