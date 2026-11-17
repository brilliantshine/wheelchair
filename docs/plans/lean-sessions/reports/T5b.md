# T5b report

Restored the requested concise ownership and operating rules in `AGENTS.md`, including service users, global instruction loading, root execution, and the module-docstring note. Corrected the viewer helper reference there. Updated `CONTRIBUTING.md` line references and restored the requested wording for worktree code and stale temp entries.

## Validation

`wc -c AGENTS.md`

```text
5689 AGENTS.md
```

`grep -n 'guard.sh\|run-dir.js\|preflight.sh\|wheelchair-machine\|wheelchair-viewer\|every turn\|runs as root\|docstring\|server.js:72' AGENTS.md`

```text
15:The diagram-sensitivity dial is the deliberate exception: `sensitivity/set.sh` is the only writer of the region rendered from `protocol/sensitivity.md` into each present harness's global instruction file, loaded every turn in every project. That repo-owned region is overwritten on every run; other context-window rules belong in `protocol/`.
17:The root sudo helper is the other reach outside the clone and the only part that runs as root. Collin installs it as a system service with `sudo-helper/install.sh` from a root-owned copy agents cannot edit; `./install.sh` never installs or updates it.
27:| `install/` | — | `guard.sh` canonical-clone guard; `unseen.py` old hook removal; `test/run.sh` installer fixtures. Temp homes and command shims only; real harness and machine state stay untouched |
28:| `test-support/` | — | `run-dir.js`: every temp folder a machine or viewer test makes lives in one per-process folder, removed at exit and swept when its owner is gone; smoke and Mac CI checks |
30:| `codex/` | [AGENTS.md](codex/AGENTS.md) | `preflight.sh` login check and model heads-up; `model.sh` GPT model pins; fixtures |
32:| `machine/` | [AGENTS.md](machine/AGENTS.md) | session service, hooks, API and tests; runs as the `wheelchair-machine` user service |
34:| `viewer/` | [AGENTS.md](viewer/AGENTS.md) | viewer, server, hub app, pages, vendor and tests; runs as the `wheelchair-viewer` user service |
70:No module-docstring rung: the routers' file/role tables already say what each file does.
72:**Never check the viewer by starting a server by hand.** Start your own isolated server with `--port` and `--cache-root` as in `viewer/test/helpers/server.js:72`. There is no cache-root environment variable.
```

`grep -n 'server.js:\|about to be deleted\|hour old' CONTRIBUTING.md`

```text
106:`install.sh` installs viewer dependencies, stops an outdated viewer, initializes the hub machine service's private state and credentials, and decides once whether to serve other tailnet devices (asking only on a headless machine without a decision). On serving systemd or launchd machines it installs both user services. It removes retired skill and prompt wrappers and the old seen hook through `install/unseen.py`, runs `codex/model.sh init`, and finally calls `sensitivity/set.sh`, warning rather than failing if it refuses. It hints when the root sudo helper is absent but never installs or updates it. Its machine-wide writes would point harnesses and services at code that is about to be deleted if run from a worktree; the guard refuses linked worktrees and paths under `~/.local/state/wheelchair/worktrees` with exit 3 unless `WHEELCHAIR_ALLOW_WORKTREE=1` is set.
108:`.gitignore` excludes `node_modules/`, `graphify-out/`, browser `test-results/`, Python `__pycache__/`, and `viewer/test/.tmp/` from older viewer suites; `test-support/run-dir.js` sweeps entries there over an hour old.
112:A viewer `--open` or `--show` start can register with an existing server at the default port and reuse its old code (`viewer/server.js:2285, 2297`). Canonicalization drops unknown keys (`viewer/server.js:157`), so a write with a newer field can return 200 while silently losing it. The test helper starts an isolated server with `--port` and `--cache-root` (`viewer/test/helpers/server.js:72`). There is no cache-root environment variable: `server.js` reads `WHEELCHAIR_NO_BROWSER`, `WHEELCHAIR_BROWSER`, and `TMUX`, `TMUX_PANE`, `CLAUDECODE` for opener labels; exporting a cache-root variable leaves the default root in use.
```

`sed -n '70,74p' viewer/test/helpers/server.js`

```text
  const graphPath = open || path.join(graphDir, 'canonical.json');
  const chosenPort = port || await freePort();
  const args = ['viewer/server.js', '--port', String(chosenPort), '--cache-root', root, '--open', graphPath];
  if (stateDir) args.push('--state-dir', stateDir);
  const child = spawn(process.execPath, args, {
```

## Anything not done

None.

## Choices

none
