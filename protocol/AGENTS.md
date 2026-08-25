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
| `plan-review.md` | Stage 2. Parallel GPT and Claude adversarial review; the lead adjudicates every finding |
| `implementation.md` | Stage 3. The lead briefs and integrates, cheap lanes implement |
| `verification.md` | Stage 4. A verifier from the opposite model family tries to falsify the completion claims |
| `adopt.md` | The on-ramp for a plan document written elsewhere |
| `lanes.md` | How every stage spawns a subagent. **The only place invocations live** |
| `writing.md` | How anything a person reads is written. Governs messages, not documents |
| `map.md` | How to explain existing code: flow first, grounded in `file:line`, no filler |
| `diagrams.md` | Which diagram a document gets, and what keeps it from lying |
| `graphs.md` | The graph format read by both harnesses — schema, verdicts, preservation, how the viewer starts |
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
harness produces the same artifacts, and that `install.sh` symlinks rather than copies,
so an edit here takes effect immediately in both.
