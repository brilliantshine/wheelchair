# wheelchair — agent entry point

A four-stage feature workflow: map how the code works, agree an idea, plan against it,
review the plan adversarially, implement, verify. Read this file, then the router in the
directory you are about to touch.

## The one concept that explains the layout

Every stage reads its rules from `protocol/` and writes its state into
`docs/plans/<slug>/`. Nothing a stage needs lives anywhere else — not in a wrapper, not
in a context window. Everything here is one of four things, and the distinction is who
reads it.

**One thing here breaks that, deliberately: the diagram-sensitivity dial.** It governs
ordinary conversation turns, where no command runs and nothing under `protocol/` is
otherwise read — so a rule that has to be in effect *before* Collin types cannot wait to be
looked up. `sensitivity/set.sh` renders a delimited region of `protocol/sensitivity.md` into
each present harness's global instruction file, which that harness loads every turn in
every project. That region is the one stage input resident in a context window, it is
**this repo's and overwritten on every run**, and it stays a rendering rather than a copy:
one source, one writer, nothing hand-maintained. Read it as the exception it is — anything
else that wants to live in a context window belongs in `protocol/`.

| Kind | Directory | Read by |
|---|---|---|
| Canonical rules | `protocol/` | an agent executing a stage |
| Per-feature state | `docs/plans/<slug>/` | every stage, to find out where the work stands |
| Harness adapter | `skills/`, `codex/prompts/` | Claude Code and the Codex CLI, at registration |
| Executable | `spine/`, `sensitivity/`, `install/`, `viewer/`, `install.sh` | run by a command, not read as guidance |

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
| `sensitivity/` | [AGENTS.md](sensitivity/AGENTS.md) | `set.sh`, the only writer of each present harness's global instruction file |
| `install/` | — | `test/run.sh`, the installer fixture suite. Temp harness homes only; real global files stay untouched |
| `codex/` | — | `prompts/`, the Codex CLI wrappers. Same convention as `skills/`, one line each |
| `docs/` | — | `plans/<slug>/` per feature. State, not rules — nothing here is a contract |
| `viewer/` | — | the browser graph viewer — `index.html`, `server.js`. Started by an agent turn, never read as guidance |

## Files at the root

| File | Role |
|---|---|
| `README.md` | What this workflow is and how to drive it, for a person arriving cold |
| `CONTRIBUTING.md` | The conventions, source-of-truth boundaries, and validation commands for someone changing this repository |
| `install.sh` | Renders each present harness's wrappers, substituting this clone's path for `{{WHEELCHAIR_ROOT}}`, installs the viewer's dependencies, and — last, and warning rather than failing if it refuses — calls `sensitivity/set.sh` to render the dial's region into each present global instruction file. Those files are **outside this tree**, and the region between the markers is overwritten. Idempotent, and it **globs** `skills/*/` and `codex/prompts/*.md`, so adding a command needs no edit here |
| `.gitignore` | `node_modules/`, `graphify-out/`, and the two scratch paths the viewer's suites write, `viewer/test/.tmp/` and `test-results/`. `graphify-out/` is what lets a root router claim a graph cannot carry a contract |

## How to navigate (in order)

1. **Read the router** for the directory you are touching.
2. **Grep** for the phrase. Every rule here is prose in a markdown file, so the words a
   rule uses are the words it is stored under.
3. **Graphify last**, under the policy below.

No module-docstring rung: `viewer/` is real JavaScript, but it is two files — the page and
the server — and a router's file/role table already says what each one does at that size, so
there is still nothing a docstring would tell you faster.

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
bash spine/test/run.sh                # the scanner's assertions, exit-code gated
bash sensitivity/test/run.sh          # the dial's block writer, exit-code gated
bash install/test/run.sh              # presence-aware installer assertions, exit-code gated
./install.sh && ./install.sh          # idempotent; git status --porcelain stays empty
node --test 'viewer/test/*.test.js'   # the glob is required
npm --prefix viewer run test:browser  # Chromium; fails loudly if the browser is missing
```

The glob on the `node --test` line is required, not decorative: on Node 26.7.0, pointing
`--test` at a bare directory does not discover the suite.

**Never check the viewer by starting a server by hand.** A `--open` or `--show` start
reuses whatever already holds the lock under the default cache root
(`viewer/server.js:1092`), and that process runs the code it was launched with — which,
after any edit of yours, is not yours. Canonicalization drops unknown keys by design
(`:119`), so a write carrying a field the running build predates comes back `200` with
the field gone: the check looks like it ran and quietly disagrees with the code you just
wrote. Start your own with `--port` and `--cache-root`, the way the suite's helper does
(`viewer/test/helpers/server.js:87`). There is no cache-root environment variable —
`server.js` reads only `WHEELCHAIR_NO_BROWSER` and `WHEELCHAIR_BROWSER` — so exporting
one puts you straight back on the default root.

There is no test suite for the protocol documents — what keeps them true is that each
stage refuses to run out of order and every stage's output is the next stage's input.
`viewer/` is real code, and this is what runs its tests.

## Maintaining these routers

A router that lies is worse than no router. `protocol/routers.md` is the format and
`protocol/spine.md` is the command that creates them. Moving ownership between
directories updates the routers on both sides as part of that change, not afterwards —
Stage 3 states that rule where an implementer will meet it.
