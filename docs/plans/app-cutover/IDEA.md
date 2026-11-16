---
slug: app-cutover
status: draft   # draft | confirmed
created: 2026-11-15
---

# Remove the old terminal workflow

## What we're building

The app now drives every feature, from the first idea to the pull request. The old way of
doing the same thing from a terminal, by typing `/plan`, `/adopt`, `/plan-review`,
`/implement` and `/verify`, comes out in one change, along with the rule files and the
per-turn hook (`seen/`) that only it used.

## Why — the problem

Two ways to drive a feature means two sets of rules to keep in step. Every agent session on
the machine still carries the old commands and the old hook, so an agent can start a stage
the app knows nothing about, and the diagram dial still sends agents to a planning rule
file the app no longer follows.

## What good looks like

- Neither Claude Code nor Codex offers `/plan`, `/adopt`, `/plan-review`, `/implement` or
  `/verify` any more, on a machine that had them installed.
- `/graph` and `/diagram-sensitivity` still work.
- The `seen/` hook no longer runs on every turn.
- The diagram dial points agents at the app's lead rules.
- The app's own roles (lead, sub-lead, mapper, reviewer, worker, verifier) lose no rule
  they still rely on.
- Installing twice in a row leaves the repository unchanged, and the installer's tests show
  the removed pieces are gone from a machine that had them.

## Not doing

- No change to how the app itself works.
- Old plans under `docs/plans/` stay as they are, as history.
- Not removing `/graph`, `/diagram-sensitivity`, `sensitivity/`, `codex/model.sh`, or the
  graph and diagram rules.

## Constraints

- One change, one pull request.
- `./install.sh` writes machine-wide settings and runs only from the main clone; this work
  is checked with the installer's own tests against temporary homes.
