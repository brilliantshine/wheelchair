---
slug: router-spine
status: confirmed   # draft | confirmed
created: 2026-08-22
---

> **Redacted for publication.** Repository and directory names in this document are stand-ins:
> the reference repo appears as `almanac`, and one employer's repositories as `atlas-*`,
> `beacon` and `dev-tooling` under `~/src/work`. Absolute paths were rewritten to `~/src/...`.
> This includes names inside pasted command output and `file:line` citations, so a path here is
> a redaction rather than a result. Every observation, count and verdict is otherwise unchanged.

# A router document in every directory that owns a rule

## What we're building

A short document in each code directory saying what that directory owns, what must never
happen there, and where to go next. This pattern is already running in almanac: a
root `AGENTS.md` names the one idea that explains the layout, a table sends you to a router per
package, and each one names its files, its flow, and its rules in about forty lines.

Two things get built. A command that backfills a repo that has none, and a rule folded into the
implementation stage that keeps them true as ownership moves. Where a repo already has routing
documents, both extend what is there and never stand up a competing set.

## Why — the problem

An agent dropped into an unfamiliar directory has three ways to find out what it does: grep,
read everything, or ask a knowledge graph. The first is slow and misses intent, the second does
not fit in a context window, and the third is worse than it looks — the graph for one repo here
is 7,000 nodes and 25,000 edges, it is gitignored so it cannot carry a contract, and once stale
it misroutes silently rather than failing.

A router is the cheap accurate answer, because a person wrote down what the directory owns and
keeps that true. almanac already proved it across twenty directories and wrote the
reasoning into its own root router: the routers are the spine, and the graph is an opt-in
supplement that must never answer "where does X live."

Nothing in this workflow produces or maintains routers, and this repo has none at all.

## What good looks like

An agent dropped cold into any directory reads one short document and knows what that directory
owns, what it may not touch, and where to go next — without grepping and without loading a
graph.

Routers stay true. Moving ownership between packages updates the routers on both sides as part
of that change, not as a follow-up someone forgets.

A repo that already has routing documents ends up with those documents improved. Nobody opens
it later and finds two overlapping sets of instructions disagreeing with each other, and no
existing file was overwritten or reformatted to get there.

The number of routers stays close to the number of real boundaries. A repo does not end up with
a router in every folder restating its parent.

## Not doing

Not rewriting existing routing documents into a house style. They get extended and corrected,
never normalized.

Not a router in every directory. A directory that merely groups files does not get one.

Not routers carrying line numbers or exhaustive file lists. That is the staleness failure
almanac deliberately designed out, and copying it would produce routers that lie.

Not touching the diagram or graph-viewer work. That is a separate plan (`editable-node-graphs`)
and this one delivers value without it.

Not generating routers unattended. The command proposes and a person confirms before anything
is written.

## Constraints

Three different filename conventions are live on this machine and one of them is a symlink pair:
`atlas-engine/CLAUDE.md` is a symlink to `AGENTS.md`, `src/work/AGENTS.md` is a symlink
to `CLAUDE.md` — the inverse — and almanac uses a real `CLAUDE.md` pointer file at its
root with bare `AGENTS.md` below. Writing to a fixed filename would overwrite a real router
through a link.

A router that lies is worse than no router. Anything that generates or updates one has to leave
it true or leave it alone.

Router work meets existing documents more often than a blank slate. atlas-engine,
almanac, atlas-infra, atlas-api and several others already have some
form of it, at different depths and in different styles.

The routers are the spine and graphify is a supplement, never the source for "where does X live"
or "what owns Y."

Both harnesses load `AGENTS.md` and `CLAUDE.md` hierarchically as live instructions, so any
example or fixture router committed inside a repo is read as real guidance by agents working in
that subtree.
