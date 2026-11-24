# Map: contributing law

```text
target project -> worktree -> role prompt and provider launch -> agent work
  -> verifier checks work against remit -> evidence and verdict
```

The common delivery path and provider differences are mapped in `docs/maps/project-instruction-delivery.md`. The prompt is composed before the worktree exists (`machine/service.js:200-211,816-825`), while agents run in their target checkout (`machine/service.js:843-846`; `viewer/app/sessions.js:775-780`). No inspected role directs a general read of CONTRIBUTING.md; native CLI project-file discovery is not guaranteed by the inspected launcher. A pointer after checkout or a change to composition are possible integration points, with different timing and checkout implications.

The verifier currently falsifies Spec and request claims, checks validation and non-goals, and reports `COMMIT`, `VERDICT`, and evidence-backed `GAP` lines; steps-only replaces that remit and uses `STEP` lines (`protocol/app/verifier.md:33-50,59-70,96-136`). The sub-lead merges and judges GAPs (`protocol/app/sub-lead.md:243-261`); a new law check needs an explicit fit with that handling. Reviewers attack the plan through mechanics and intent lenses and report severity/lens lines, rather than verify built work (`protocol/app/reviewer.md:20-39,73-85`).

Wheelchair's own CONTRIBUTING.md requires root and nearest routers before changing a directory, search before graphify, router upkeep, single sources of truth, and area/full validation (`CONTRIBUTING.md:3-23,40-51,73-93`). Its installer instruction has an explicit worktree exception (`CONTRIBUTING.md:55-65`). The lead's scout rule covers code questions over a couple of files, while mapper instructions require source-grounded maps and map freshness checks (`protocol/app/lead.md:170-184`, `protocol/app/mapper.md:31-39,48-61`); these do not themselves direct reading routers. No direct conflict between these checked instructions was identified; the scout rule must be reconciled with any future requirement to read project instructions directly.

Not checked: live CLI native discovery, CLI context limits, all target-project policies or all protocol rules for conflicts.
