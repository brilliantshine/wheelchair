---
slug: editable-node-graphs
---

# How this works today

## End to end

```
/plan <desc>  →  skills/plan/SKILL.md (3-line pointer)  →  protocol/planning.md
                                                                  ↓
              docs/plans/<slug>/    MAP.md  →  IDEA.md  →  PLAN.md
                                                                  ↓
                                    one question per turn, markdown only
                                                                  ↓
                          /plan-review → /implement → /verify  (same shape)
```

Nothing in that chain produces a picture. Every artifact is markdown a human reads
top-to-bottom.

## What happens

1. You type `/plan <description>` in a target repo. The Claude wrapper is three lines of
   prose telling the agent to go read the protocol (`skills/plan/SKILL.md:6-8`); the Codex
   wrapper does the same (`codex/prompts/plan.md`). Both are symlinks that `install.sh`
   drops into `~/.claude/skills/` and `~/.codex/prompts/` (`install.sh:9-18`), so edits to
   `protocol/` take effect with no reinstall.
2. The agent reads the code the change touches and writes `MAP.md` — end-to-end flow, a
   **plain-text** diagram, `file:line` on every claim. The protocol explicitly bans Mermaid
   here, because the map gets read in a terminal (`protocol/map.md:25-26`).
3. It shows the map to you, then writes `IDEA.md` and stops for your confirmation before
   any design question (`protocol/planning.md:52-59`).
4. Once confirmed, it enumerates every open question into `PLAN.md` and asks exactly one
   per turn, recording each answer in an append-only Decision Log
   (`protocol/planning.md:61-133`).
5. `PLAN.md`'s frontmatter `status:` is the state machine, and each later stage refuses to
   run out of order (`README.md:76-79`).

## What matters for this change

**This repo contains no code.** 23 markdown files and `install.sh` — no `package.json`, no
source of any kind. A viewer would be the first executable thing here, and the first thing
that needs a runtime and a port rather than a symlink. Node 26.7.0 and npm 12.0.2 are
installed.

**Plan artifacts live in the target repo, not this one.** So a graph file at
`docs/plans/<slug>/graph.json` lands in whatever project you are planning, while the viewer
that opens it has to be installed once and globally. Those are two different homes, and
`install.sh` currently only knows how to make symlinks.

**graphify gives a summarizer real material, not just adjacency.** The graph for
`almanac` is 14.5 MB, 7,033 nodes, 25,926 edges — your read is right, nobody reads
that. But nodes carry `label`, `type`, and a human-readable `community_name`, and edges
carry a `relation` string ("rationale_for"), a `confidence` of EXTRACTED / INFERRED /
AMBIGUOUS, and `source_file` + `source_location`. An agent summarizing down to 15 nodes has
labeled edges and provenance to work from, so a proposed flow can cite where it came from.
`graphify query` already prints one line per node carrying label, source file, line, and
community name, which is close to the input a summarizer wants.

## Problems found

**Two graphify installs, now one.** `graphify-bin 0.9.31-1` from pacman owns
`/usr/bin/graphify` and `/usr/bin/graphify-mcp`, and matches the installed skill (0.9.31).
A second copy, `uv tool` `graphifyy` 0.9.30, shadowed nothing but printed a version-skew
warning on every invocation. Both had the identical command surface. Removed the uv copy
with `uv tool uninstall graphifyy`; `which -a graphify` now resolves only to `/usr/bin`, and
the warnings are gone. Reversible with `uv tool install graphifyy` if the pacman package
ever lags.

**A raw graphify query returns far too much to draw.** `graphify query "quill render
pipeline" --budget 400` in `almanac` matched 4 seed nodes and reached **436 nodes
at BFS depth 2**, then truncated to 11 and warned that the answer may be among the 425 it
cut. So the summarizer cannot take a query result and lay it out — it has to narrow first
(`--context` edge filters, or starting from one named symbol) and then choose what to keep.
Deciding *how* it narrows is a design question, not an implementation detail.

**This repo is not under git.** `git rev-parse` fails from the root and finds no parent
repo. The PR-as-the-atomic-unit discipline in your global instructions has no mechanism
here — changes land by editing files, and there is no review gate or revert path.

## Not checked

- The graphify MCP server's real tool signatures. I read the documented list in the skill
  (`query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`,
  `shortest_path`) but never started `graphify-mcp` or called a tool.
- `graphify-out/graph.html` (477 KB, regenerated per build) — I did not open it, so I can't
  say whether it already does part of what you want.
- The other `graphify-out/` directories (atlas-engine, atlas-data,
  atlas-engine/development). Only `almanac`'s was inspected.
- How Zed's agent panel registers an MCP server in practice. I confirmed from Zed's docs
  that extensions can provide MCP servers and cannot provide UI panels, but configured
  nothing.
- `protocol/implementation.md`, `lanes.md`, `plan-review.md`, `verification.md` — read only
  the README's summary of them, not the files.
