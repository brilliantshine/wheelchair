# `protocol/` — the stage definitions

Owned by [the repo root](../AGENTS.md). Every rule the app's agents run on is a markdown
file here.

The organizing idea: **a document here is read by an agent mid-task, so it states the
failure it exists against rather than describing a process.** A rule whose reason is
missing gets optimized away by the next agent that finds it inconvenient.

| File | Role |
|---|---|
| `app/` | The app's role protocol, one file per agent role plus the card formats; [its router](app/AGENTS.md). Every session the app starts reads its role file from here |
| `app/assistant.md` | The personal assistant's cross-project role and actions |
| `diagrams.md` | Which diagram a document gets, and what keeps it from lying |
| `graphs.md` | The graph format: schema, how the viewer starts, the run-picture switch |
| `sensitivity.md` | The diagram-sensitivity dial: the region rendered into present harnesses' always-on files, and what each level draws |
| `templates/` | The skeletons a plan is written from: `MAP.md`, `IDEA.md`, `PLAN.md`, `COMPLETION.md` |

The old stage files (`planning.md`, `plan-review.md`, `implementation.md`, `verification.md`,
`adopt.md`, `lanes.md`, `map.md`, `writing.md`, `seen.md`) and the `SEEN.md` template are
gone. The role files in `app/` replace them.

## Boundaries

- **Never add a second gate for a rule that already has one.** Two overlapping
  instructions with neither marked authoritative is worse than one in an imperfect place.
- **A template edit is a contract change.** The sub-lead briefs workers to write
  COMPLETION.md from `templates/COMPLETION.md`, so a rule added to the prose and not the
  template reaches nobody.
- Nothing here is per-feature state. That lives in `docs/plans/<slug>/`, and editing the
  rules is not the same act as editing a plan.

## Tests

`viewer/test/protocol-rules.test.js` checks some of these documents. The rest have no test;
the check that they work is that a thread run through the app produces the artifacts the
next role reads.

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
