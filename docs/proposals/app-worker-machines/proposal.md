# Run app workers on other machines

Nov 14, 2026 · split out of `docs/plans/app-shell/` (decision D44, formerly slice 2)

## What this is

The app (`docs/plans/app-shell/`) runs every session on the hub. This feature lets
workers run on Collin's other Linux machines on the tailnet. Start it as a thread in the
app and point the lead at this file. Decisions D27, D34, D36, D37 and D40 in the app-shell
plan were made for this and stand.

## Settled so far

- **Machine services elsewhere (D34, D36, D40).** Each worker machine runs the same
  `wheelchair-machine.service` the hub already runs, listening on its Tailscale address
  with its own secret. Only Linux machines with tmux and wheelchair installed count, so
  not the Windows desktop or the phone.
- **Pairing.** On the hub, `node viewer/server.js --add-machine <name>` creates the secret
  and prints one command to run on the new machine
  (`./install.sh --machine --hub <hub-address> --secret-file <path>`), which installs the
  service there.
- **Versions.** Every hub-to-service call compares the git commit of each side's clone. A
  mismatch shows as "out of date" in the Ready check, and no new sessions start there.
- **Code moves through git.** Each worker machine keeps its own clone of a project, cloned
  from the project's `origin` remote the first time it is needed. The sub-lead pushes the
  build's base branch to `origin`. A remote worker branches from it, commits and pushes,
  and the sub-lead fetches and merges. The worker's report travels in its `result` card.
  A project with no `origin` remote runs its workers on the hub only, and the Ready check
  says so.
- **Offline machines (D27).** The hub polls each service every 10 seconds. One that
  doesn't answer shows as unreachable with when it was last seen, and its sessions stay
  listed, greyed out. If a running build has a worker there, a `needs` item says so.
  Nothing moves automatically.
- **Ready check (D37).** It runs `codex/preflight.sh` on each machine the build will use.

## Acceptance

A worker runs on a second machine and its work lands in the pull request. Putting that
machine to sleep shows it as unreachable and raises a `needs` item.
