---
slug: app-cutover
status: confirmed
created: 2026-11-15
---

# Remove the old terminal workflow

## What we're building

The app now drives every feature, from the first idea to the pull request. The old way of
doing the same thing from a terminal, by typing `/plan`, `/adopt`, `/plan-review`,
`/implement` and `/verify`, comes out in one change, along with its rule files and the
per-turn wording hook (`seen/`). The two commands that stayed, `/graph` and
`/diagram-sensitivity`, go too: graphs become something the app does itself, and how
readily agents draw becomes a setting on the app's Settings page.

## Why — the problem

Two ways to drive a feature means two sets of rules to keep in step. Every agent session on
the machine still carries the old commands and the old hook, so an agent can start a stage
the app knows nothing about, and the diagram dial still sends agents to a planning rule
file the app no longer follows.

## What good looks like

- Neither Claude Code nor Codex offers any wheelchair slash command any more (`/plan`,
  `/adopt`, `/plan-review`, `/implement`, `/verify`, `/graph`, `/diagram-sensitivity`),
  on a machine that had them installed.
- Graphs are drawn and opened from the app, with no command needed: the thread's right
  column lists every graph the thread uses, each still shows inside the thread, and
  clicking one opens it full size in the app with an easy way back to the thread.
- Diagram sensitivity (ask, default, high) is set on the Settings page. Changing it
  reaches every agent session on the machine, in the app and in a plain terminal alike,
  as the command does today.
- The `seen/` hook no longer runs on every turn. Terminal agents lose the confirmed
  wording list and the long-gap notice it added; app leads already use the writing style
  from Settings instead.
- The diagram rules point agents at the app's lead rules, not the old planning file.
- The app's own roles (lead, sub-lead, mapper, reviewer, worker, verifier) lose no rule
  they still rely on.
- Installing twice in a row leaves the repository unchanged, and the installer's tests show
  the removed pieces are gone from a machine that had them.

## Not doing

- No change to how the app works beyond the new setting and the thread's graph list and
  full-size view.
- Not redesigning the Settings page; the app-settings proposal does that. This adds one
  control that fits beside it.
- Old plans under `docs/plans/` stay as they are, as history.
- Not removing `codex/model.sh`, the graph viewer, or the graph and diagram rules.

## Constraints

- One change, one pull request.
- `./install.sh` writes machine-wide settings and runs only from the main clone; this work
  is checked with the installer's own tests against temporary homes.
