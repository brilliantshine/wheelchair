# wheelchair — agent entry point

The app drives a feature from mapping and agreement through planning, adversarial review, building and verification. Read this file, then the router for the directory you touch.

## Layout

Every stage reads rules from `protocol/` and writes state to `docs/plans/<slug>/`; nothing else a stage needs lives in a wrapper or context window. The three kinds differ by reader:

| Kind | Directory | Read by |
|---|---|---|
| Canonical rules | `protocol/` | an agent executing a stage |
| Per-feature state | `docs/plans/<slug>/` | every stage |
| Executable | `sensitivity/`, `install/`, `test-support/`, `connectors/`, `viewer/`, `machine/`, `sudo-helper/`, `install.sh` | commands, not guidance |

The diagram-sensitivity dial is the deliberate exception: `sensitivity/set.sh` is the only writer of the region rendered from `protocol/sensitivity.md` into each present harness's global instruction file, loaded every turn in every project. That repo-owned region is overwritten on every run; other context-window rules belong in `protocol/`.

The root sudo helper is the other reach outside the clone and the only part that runs as root. The user installs it as a system service with `sudo-helper/install.sh` from a root-owned copy agents cannot edit; `./install.sh` never installs or updates it.

**`status:` in `PLAN.md` is the state machine, not a label.** Stages refuse to run out of order; editing it to pass a gate skips the gate.

## Where to go

| Directory | Router | Go here for |
|---|---|---|
| `protocol/` | [AGENTS.md](protocol/AGENTS.md) | stages, writing and diagram rules, templates |
| `sensitivity/` | [AGENTS.md](sensitivity/AGENTS.md) | dial block writer |
| `install/` | — | `guard.sh` canonical-clone guard; `unseen.py` old hook removal; `test/run.sh` installer fixtures. Temp homes and command shims only; real harness and machine state stay untouched |
| `test-support/` | — | `run-dir.js`: every temp folder a machine or viewer test makes lives in one per-process folder, removed at exit and swept when its owner is gone; `pick-tests.js` with `test-map.json` (test picker), `full-run.sh` (full run), `browser-workers.js` (worker count); smoke and Mac CI checks |
| `.github/workflows/macos.yml` | — | Mac CI job |
| `connectors/` | [README.md](connectors/README.md) | per-tool connectors: manifests, machine and hub halves, registry |
| `codex/` | [AGENTS.md](codex/AGENTS.md) | `preflight.sh` login check and model heads-up; `model.sh` GPT model pins; fixtures |
| `docs/` | — | plans, maps, proposals and known issues; state, not rules or contracts |
| `machine/` | [AGENTS.md](machine/AGENTS.md) | session service, hooks, API and tests; runs as the `wheelchair-machine` user service |
| `sudo-helper/` | [AGENTS.md](sudo-helper/AGENTS.md) | root sudo helper, run page, installer and tests |
| `viewer/` | [AGENTS.md](viewer/AGENTS.md) | viewer, server, hub app, pages, vendor and tests; runs as the `wheelchair-viewer` user service |

## Files at the root

| File | Role |
|---|---|
| `README.md` | workflow and usage for new readers |
| `CONTRIBUTING.md` | conventions, sources of truth and validation |
| `install.sh` | idempotent installer; updates harness and service state outside the tree, never the sudo helper |
| `.gitignore` | generated dependencies, graphs, test output and scratch files |

## Navigation

1. Read the router for the directory you are touching.
2. Grep for the phrase.
   No module-docstring rung: the routers' file/role tables already say what each file does.
3. Graphify last: routers are the spine; graphify is an opt-in supplement, overriding the graphify skill's graph-first default. Never answer "where does X live" or "what owns Y" from it; use routers. Use it only for what a router cannot do, such as cross-file blast radius, shortest paths between distant concepts or community structure. Confirm every result in source before acting.

## Verification

```bash
bash sensitivity/test/run.sh          # the dial's block writer, exit-code gated
bash codex/test/run.sh                # the GPT model pins and heads-up, exit-code gated
bash install/test/run.sh              # presence-aware installer assertions, exit-code gated
bash machine/test/run.sh              # the machine service, with fake tmux, CLIs and hub
python3 -m unittest discover -s sudo-helper/test   # the root sudo helper, with shim runuser and sudo
bash sudo-helper/test/install-test.sh              # the helper's installer, against a temp root
node --test test-support/test/*.test.js     # the shared test run folder
bash test-support/smoke/run.sh        # hearth only
bash test-support/smoke/live.sh       # hearth only, costs model turns
./install.sh && ./install.sh          # canonical clone only: refused from a worktree; elsewhere, install/test/run.sh
node --test viewer/test/*.test.js     # unquoted glob; works on Node 20 and 26
npm --prefix viewer run test:browser  # Chromium and Firefox; fails loudly if either is missing
```

Run `./install.sh` only from the canonical clone; it and its two writers refuse linked worktrees and paths under `~/.local/state/wheelchair/worktrees` (exit 3 unless `WHEELCHAIR_ALLOW_WORKTREE=1`). From a worktree use `bash install/test/run.sh` instead. Leave the `node --test viewer/test/*.test.js` glob unquoted.

**Never check the viewer by starting a server by hand.** Start your own isolated server with `--port` and `--cache-root` as in `viewer/test/helpers/server.js:72`. There is no cache-root environment variable.

There is no protocol document test suite; stages enforce their order and each stage's output is the next stage's input.

## Test picker and full run

Verifiers and workers run the tests that cover a change; one full run covers each pushed commit.

```bash
node test-support/pick-tests.js --base <commit>   # prints the commands that cover base..HEAD; --head <commit>, --json
bash test-support/full-run.sh <log-dir>           # every suite above except smoke, live and install.sh; writes <log-dir>/summary.txt
```

`summary.txt` starts with `commit <sha>`, then one `suite <name> exit <n> seconds <s>` line per suite. The
role rules in `protocol/app/` use these two commands because this heading exists.

## Maintaining routers

Keep routers true: when ownership moves between directories, update both routers as part of the change.

For the reasons and history behind these rules, see [Why the agent rules are the way they are](CONTRIBUTING.md#why-the-agent-rules-are-the-way-they-are).
