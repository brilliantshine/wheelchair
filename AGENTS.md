# wheelchair — agent entry point

A four-stage feature workflow: map how the code works, agree an idea, plan against it,
review the plan adversarially, implement, verify. Read this file, then the router in the
directory you are about to touch.

## The one concept that explains the layout

Every stage reads its rules from `protocol/` and writes its state into
`docs/plans/<slug>/`. Nothing a stage needs lives anywhere else — not in a wrapper, not
in a context window. Everything here is one of four things, and the distinction is who
reads it.

| Kind | Directory | Read by |
|---|---|---|
| Canonical rules | `protocol/` | an agent executing a stage |
| Per-feature state | `docs/plans/<slug>/` | every stage, to find out where the work stands |
| Harness adapter | `skills/`, `codex/prompts/` | Claude Code and the Codex CLI, at registration |
| Executable | `spine/`, `install.sh` | run by a command, not read as guidance |

`spike/` is outside all four on purpose: throwaway, and its own README says so.

Two rules follow, and between them they cover most of what can go wrong here:

- **A wrapper carries no content.** A `SKILL.md` or a Codex prompt is a pointer to one
  `protocol/` file and nothing else. A rule duplicated into a wrapper gives the two
  harnesses different instructions the moment one copy is edited.
- **`status:` in `PLAN.md` is the state machine, not a label.** Each stage refuses to run
  out of order, so editing `status` to get past a gate has skipped the gate rather than
  passed it.

## Where to go

| Directory | Router | Go here for |
|---|---|---|
| `protocol/` | [AGENTS.md](protocol/AGENTS.md) | the stage definitions, the writing and diagram rules, the router format, the document templates |
| `skills/` | [AGENTS.md](skills/AGENTS.md) | the Claude Code wrappers and the convention every wrapper follows |
| `spine/` | [AGENTS.md](spine/AGENTS.md) | `scan.sh`, the read-only scanner behind `/spine` |
| `codex/` | — | `prompts/`, the Codex CLI wrappers. Same convention as `skills/`, one line each |
| `docs/` | — | `plans/<slug>/` per feature. State, not rules — nothing here is a contract |
| `spike/` | — | throwaway experiments. Its own README says not to grow one into the real thing |

## Files at the root

| File | Role |
|---|---|
| `README.md` | What this workflow is and how to drive it, for a person arriving cold |
| `install.sh` | Symlinks every wrapper into both harnesses. Idempotent, and it **globs** `skills/*/` and `codex/prompts/*.md`, so adding a command needs no edit here |
| `.gitignore` | `node_modules/` and `graphify-out/`. The second is what lets a root router claim a graph cannot carry a contract |

## How to navigate (in order)

1. **Read the router** for the directory you are touching.
2. **Grep** for the phrase. Every rule here is prose in a markdown file, so the words a
   rule uses are the words it is stored under.
3. **Graphify last**, under the policy below.

No module-docstring rung: this repo is markdown plus three shell scripts and one
throwaway JS file, so there is no docstring convention for one to read.

## Graphify policy

**The routers are the spine; graphify is an opt-in supplement.** This overrides the
graphify skill's default instruction to treat any codebase question as a graphify query
first.

- `graphify-out/` is gitignored here, so a graph is per-clone and may be absent or
  arbitrarily old in any given checkout. It cannot carry a contract.
- It is a point-in-time snapshot, and a stale graph misroutes silently instead of
  failing — worse than no graph, because someone acts on it.

Rules:

- Never answer "where does X live" or "what owns Y" from graphify. Use the routers.
- Use it only for what a router genuinely cannot do: blast radius across many files, the
  shortest path between two distant concepts, community structure. Confirm every result
  in source before acting on it.

## Verification

```bash
bash spine/test/run.sh          # the scanner's assertions, exit-code gated
./install.sh && ./install.sh    # idempotent; git status --porcelain stays empty
```

There is no test suite for the protocol documents. What keeps them true is that each
stage refuses to run out of order and every stage's output is the next stage's input.

## Maintaining these routers

A router that lies is worse than no router. `protocol/routers.md` is the format and
`protocol/spine.md` is the command that creates them. Moving ownership between
directories updates the routers on both sides as part of that change, not afterwards —
Stage 3 states that rule where an implementer will meet it.
