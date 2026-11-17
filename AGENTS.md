# wheelchair — agent entry point

A feature workflow the app drives: a lead agent in a thread maps how the code works,
agrees an idea, plans against it, has the plan reviewed adversarially, has it built, and
has it verified. Read this file, then the router in the directory you are about to touch.

## The one concept that explains the layout

Every stage reads its rules from `protocol/` and writes its state into
`docs/plans/<slug>/`. Nothing a stage needs lives anywhere else — not in a wrapper, not
in a context window. Everything here is one of three things, and the distinction is who
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

**A second reach outside the clone, and the only one that runs as root: the sudo helper.** Collin installs it with `sudo-helper/install.sh` as a system service, from a root-owned copy agents cannot edit, so the password he types for a `sudo` card never passes through the hub, the machine service or anything an agent can read. `./install.sh` never installs or updates it.

| Kind | Directory | Read by |
|---|---|---|
| Canonical rules | `protocol/` | an agent executing a stage |
| Per-feature state | `docs/plans/<slug>/` | every stage, to find out where the work stands |
| Executable | `sensitivity/`, `install/`, `test-support/`, `viewer/`, `machine/`, `sudo-helper/`, `install.sh` | run by a command, not read as guidance |

One rule follows, and it covers most of what can go wrong here:

- **`status:` in `PLAN.md` is the state machine, not a label.** Each stage refuses to run
  out of order, so editing `status` to get past a gate has skipped the gate rather than
  passed it.

## Where to go

| Directory | Router | Go here for |
|---|---|---|
| `protocol/` | [AGENTS.md](protocol/AGENTS.md) | the stage definitions, the writing and diagram rules, the document templates |
| `sensitivity/` | [AGENTS.md](sensitivity/AGENTS.md) | `set.sh`, the only writer of each present harness's global instruction file |
| `install/` | — | `guard.sh`, the canonical-clone check `install.sh` and `sensitivity/set.sh` source before writing (a linked worktree or anything under `~/.local/state/wheelchair/worktrees` is refused, exit 3, unless `WHEELCHAIR_ALLOW_WORKTREE=1`); `unseen.py`, which removes the old seen hook from the harness homes (`install.sh` itself removes the retired skill and prompt wrappers); `test/run.sh`, the installer fixture suite. Temp homes and command shims only; real harness and machine state stay untouched |
| `test-support/` | — | `run-dir.js`, the shared run folder for the JavaScript test suites: every temp folder a machine or viewer test makes lives in one per-process folder, removed at exit and swept when its owner is gone; `test/`, its own suite; `smoke/` (`harness.js`, `run.sh` free smoke suite, `live.sh` live checks); `macos/` (`check.sh`, the Mac CI end-to-end check, and fake `claude` and `tailscale`) |
| `.github/workflows/macos.yml` | — | Mac CI job, including the end-to-end check |
| `codex/` | [AGENTS.md](codex/AGENTS.md) | `preflight.sh`, the login check that also prints the model heads-up; `model.sh`, the GPT model pins' reader and writer; and `test/`, its fixture suite |
| `docs/` | — | `plans/<slug>/` per feature; `proposals/<name>/`, ideas written outside the workflow, waiting to be taken into a thread; `known-issues.md`, failures recorded but not yet fixed. State, not rules — nothing here is a contract |
| `machine/` | [AGENTS.md](machine/AGENTS.md) | the per-machine agent session service the app's hub drives: `service.js` (sessions in tmux, worktrees, git for agents, transcript copies, spools), `hook.sh` and `lib/hook-post.js` (the CLIs' turn-end and prompt hooks), `API.md` (its route contract), `test/run.sh`. Runs as the `wheelchair-machine` user service, never read as guidance |
| `sudo-helper/` | [AGENTS.md](sudo-helper/AGENTS.md) | the root sudo helper behind `sudo` cards: `helper.py`, its run page in `static/`, `install.sh` (Collin runs it with sudo), and its tests |
| `viewer/` | [AGENTS.md](viewer/AGENTS.md) | the browser graph viewer, its document page, the sign-in page a browser gets before it is remembered, and the server behind them — `index.html`, `doc.html`, `doc.js`, `signin.html`, `server.js`, `playwright.config.js` — plus the app served from the hub: `app/` (the hub: state, threads, sessions, cards, the Ready check, `wc.js` and `card.js` that agents run, `API.md`), `pages/` (the Threads, thread, Features, Agents, Settings and terminal pages) and `vendor/` (xterm.js). Runs as the `wheelchair-viewer` user service or is started by an agent turn, never read as guidance |

## Files at the root

| File | Role |
|---|---|
| `README.md` | What this workflow is and how to drive it, for a person arriving cold |
| `CONTRIBUTING.md` | The conventions, source-of-truth boundaries, and validation commands for someone changing this repository |
| `install.sh` | Installs the viewer's dependencies, stops any running viewer that isn't running the code just pulled, initializes the hub machine service's private state and credentials, and decides once whether this machine serves the viewer to other tailnet devices (asking only on a headless machine that hasn't decided yet). On a serving systemd or launchd machine it installs both the viewer and machine user services. It renders no wrappers: it removes the retired skill and prompt wrappers from each harness's home, removes the old seen hook through `install/unseen.py`, runs `codex/model.sh init`, and, last, warning rather than failing if it refuses, calls `sensitivity/set.sh` to render the dial's region into each present global instruction file — **outside this tree**. Idempotent. It prints a one-line hint when the root sudo helper is not installed, and never installs it. |
| `.gitignore` | `node_modules/`, `graphify-out/`, `test-results/`, which the browser suite writes, `__pycache__/`, which Python test runs of `sudo-helper/test` leave behind, and `viewer/test/.tmp/`, where older checkouts' viewer suites wrote scratch folders (`test-support/run-dir.js` sweeps entries there over an hour old). `graphify-out/` is what lets a root router claim a graph cannot carry a contract |

## How to navigate (in order)

1. **Read the router** for the directory you are touching.
2. **Grep** for the phrase. Every rule here is prose in a markdown file, so the words a
   rule uses are the words it is stored under.
3. **Graphify last**, under the policy below.

No module-docstring rung: `viewer/` and `machine/` are real JavaScript, but each of their
files has one role, and their routers' file/role tables (`viewer/AGENTS.md`,
`viewer/app/API.md`, `machine/AGENTS.md`, `machine/API.md`) already say what each one does,
so there is still nothing a docstring would tell you faster.

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

The `./install.sh` line is only for the canonical clone. Every path it writes is
machine-wide, so run from a worktree it would point each harness and both services at code
that is about to be deleted; it and the two writers it calls refuse there. From a worktree,
`bash install/test/run.sh` checks the installer against temporary homes instead.

The glob on the `node --test` line matters twice over. Pointing `--test` at a bare
directory doesn't discover the suite on Node 26.7.0. And the glob has to be left unquoted,
for the shell to expand into a list of files, rather than quoted and handed to Node as a
literal pattern — quoted, it fails to find the suite on Node 20, which is what the
always-on viewer service runs. Unquoted is the one form that works on both.

**Never check the viewer by starting a server by hand.** A `--open` or `--show` start
that finds the default port already held by one of our servers registers with it and
reuses it (`viewer/server.js:2306-2307`) — on a serving machine that is the always-on
service — and that process runs the code it was launched with, which, after any edit of
yours, is not yours. Canonicalization drops unknown keys by design
(`:157`), so a write carrying a field the running build predates comes back `200` with
the field gone: the check looks like it ran and quietly disagrees with the code you just
wrote. Start your own with `--port` and `--cache-root`, the way the suite's helper does
(`viewer/test/helpers/server.js:87`). There is no cache-root environment variable —
`server.js` reads only `WHEELCHAIR_NO_BROWSER` and `WHEELCHAIR_BROWSER`, plus `TMUX`,
`TMUX_PANE` and `CLAUDECODE` to label who opened a graph — so exporting one puts you
straight back on the default root.

There is no test suite for the protocol documents — what keeps them true is that each
stage refuses to run out of order and every stage's output is the next stage's input.
`viewer/` is real code, and this is what runs its tests.

## Maintaining these routers

A router that lies is worse than no router. Moving ownership between directories updates
the routers on both sides as part of that change, not afterwards.
