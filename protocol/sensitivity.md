# The diagram-sensitivity dial

How readily an agent answers with a picture instead of prose alone. Three positions —
`ask`, `default`, `high` — one setting, moved by `/diagram-sensitivity` and remembered
afterwards.

The dial has to be in effect *before* Collin types, because the turns it governs are
ordinary questions where no slash command runs and nothing under `protocol/` is otherwise
read. So the rule and the current level do not live here to be looked up: they live in a
delimited region below, **rendered into each present harness's global instruction file**,
which that harness loads on every turn in every project. By the time a question arrives
the level is already in the window and no agent spends a tool call finding it.

## The region

Everything between the markers is what lands in each present global file.
`sensitivity/set.sh` extracts it, substitutes `{{WHEELCHAIR_ROOT}}`, and writes it —
nothing else reads this region or writes the installed copies.

<!-- wheelchair:diagram-sensitivity start -->
## Answering with a picture

diagram-sensitivity: default

Three levels — `ask`, `default`, `high`. This block is owned by the wheelchair repo and
rewritten in place. Move the dial with `/diagram-sensitivity <level>`, never by editing
these lines: an edit here is overwritten the next time the writer runs.

An answer has a **shape** when it names three or more things that relate to each other, or
it has a branch, or the order matters. No shape, no picture — at every level, including
`high`. A name, a number, a yes-or-no gets prose.

- `ask` — draw nothing unprompted. The one carve-out: a planning turn discussing a
  proposed flow writes or updates that flow's graph, exactly as the trigger in
  `{{WHEELCHAIR_ROOT}}/protocol/planning.md` already has it.
- `default` — draw when the shape **is** the answer: the thing being explained is the
  arrangement itself.
- `high` — draw whenever a shape is present at all, even where the arrangement is
  incidental to the point. At `high` the prose stays complete but terse — the words still
  carry the whole answer, said shorter, because the picture is always redundant with them
  and a turn gets read where no viewer runs.

When an answer earns a picture, read `{{WHEELCHAIR_ROOT}}/protocol/graphs.md` and follow
it. Fill in the graph's `explanation` field: one or two sentences saying what the picture
shows, what to look at, and what it leaves out.

A subagent executing an assigned brief — a worker lane, a reviewer, any delegated agent —
ignores this block entirely.
<!-- wheelchair:diagram-sensitivity end -->

## The level line

Exactly one line inside the region, in exactly this form:

```
diagram-sensitivity: <ask|default|high>
```

Three things parse it — a refresh that must preserve an existing level, the bare command
that reports the present harness files, and the suite that strips it before comparing
regions — so the form is fixed rather than tolerant. Intact markers around zero such
lines, or around two, is **malformed**: refused on the same footing as a broken marker,
never repaired and never defaulted over.

## The writer's contract

`sensitivity/set.sh` is the only thing that writes a present harness's global file. It is an
executable
rather than a paragraph telling an agent what to write, because a guard written as prose is
a guard an agent can skip — `spine/scan.sh` is the same call.

The level is resolved **once, across the present files, before any is written**:

| Present files' blocks | Resolved level |
|---|---|
| No present files | Report, write nothing, exit 0 |
| None hold a block | The requested level, or `default` when none was requested |
| One or more hold blocks, same level | That level, unless a level was requested |
| Two hold blocks, different levels | **Refuse.** Report both, require an explicit level |

With one present harness, its block supplies the level, or the writer uses `default`.
Resolving separately on two would make a divergent dial reachable: one file at `high`, the
other markerless, and seeding `default` into the second leaves them disagreeing.

The rest of the contract, in `sensitivity/AGENTS.md`'s words as well as here: duplicated or
malformed markers refuse without touching anything; a non-empty `AGENTS.override.md` in the
Codex home refuses, naming it; the write across all present files is all-or-nothing,
preflighted then committed; a present harness's missing target file is created holding just
the block; and content between the markers is this repo's, overwritten on every run.

`install.sh` calls the writer **last**, after the wrappers, npm and Chromium, and a refusal
**warns without failing the install** — `install.sh` runs under `set -euo pipefail`, so a
non-zero writer would abort it mid-run and break its own idempotence check for a reason
unrelated to what that check tests. None of the other commands depends on the block existing.

## The command

`/diagram-sensitivity`, from either harness:

- **With a level** — `ask`, `default` or `high` — sets it in every present file, creating the
  block where it is absent. Run `sensitivity/set.sh <level>` and report what it says.
- **Bare** — reports the resolved level. Run `sensitivity/set.sh --report`, which reads present
  files, names absent harnesses, and writes neither. A disagreement between two present files is
  reported as a disagreement, never resolved by picking one.
- **An unrecognised level** is refused, naming the three that exist.

The paths are absolute in the rendered wrapper, as every wrapper's are.

Moving the dial does not affect a session already running; it applies from the next one.
A harness reads its global file at session start, and nothing re-reads it mid-session.

## What the dial does not govern

- **Diagrams inside documents.** `MAP.md`, `PLAN.md`, `COMPLETION.md` and the routers keep
  the rules in `protocol/diagrams.md` — which kind of diagram each gets, and that one is
  drawn only once the document has stopped changing. This dial governs a conversation turn
  and the viewer, nothing else.
- **`/graph`.** That command is the explicit ask, so there is nothing for a dial to make more
  or less eager. Its wrappers point at `protocol/graphs.md` and stay pointed there.
- **Whether a picture is invented.** The dial changes how eagerly a shape is drawn, never
  whether one exists. The floor holds at every level.

## Worked examples

- *"What port does the viewer bind?"* — a number. No picture at any level.
- *"How does a graph get from an agent's PUT onto disk?"* — validate, canonicalize, lock,
  write, rename: five steps where the order matters. The shape **is** the answer, so this
  draws at `default` and at `high`.
- *"Should the explanation carry a verdict?"* — a choice between two arrangements. Not a
  proposed flow, so `ask` draws nothing; `default` and `high` both draw, and the graph is a
  new file rather than a refresh of an existing flow's.
- *"Why did that install fail?"* — one cause, one fix. Prose at `default`. At `high`, if the
  answer walks a chain of three or more things, it earns a picture too.
