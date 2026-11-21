---
slug: easy-onboarding
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-20
---

# Easy install and harness picker

## What we're building

Getting wheelchair running on a machine becomes one install command plus a short first-run
setup in the app. Settings gets a section listing every supported agent harness (Claude
Code, Codex, Antigravity, Kimi Code, Pi for OpenRouter), each with an Install button and its
state, and a way to leave any of them out.

## Why — the problem

- The installer refuses to run on a machine with no agent CLI yet, so you must install and
  set one up by hand before wheelchair will install at all.
- First-time setup is a list of manual steps in the README (install command, Tailscale,
  token link, then sign-ins), and the README only mentions two of the five harnesses.
- Settings and agent placement treat all five harnesses as available whether or not they
  are installed; there is no way to say "I don't use this one".
- A harness installed after wheelchair is not reliably seen by the running service until
  wheelchair is reinstalled.

## What good looks like

- On a fresh Linux or Mac machine with the basic tools present, one install command
  succeeds even with no agent CLI installed, and points you to the app.
- The app's first run walks you to choosing harnesses, without a terminal.
- In Settings, each harness shows whether it is installed and signed in. Pressing Install
  installs it on the chosen machine; you then sign in from the same place.
- A harness you leave out disappears from choices in Settings, and no agent is ever placed
  on it.
- A harness installed from Settings is usable right away, with no reinstall of wheelchair.

## Not doing

- Installing the basic tools themselves (Node, tmux, git, gh, Tailscale). The installer
  checks for them and says plainly what is missing and how to get it.
- Uninstalling harness CLIs from the machine. Leaving one out only stops wheelchair using it.
- Windows.
- Changing how sign-in works for each harness.

## Constraints

- Linux and macOS, both.
- Harness installs run as the user, into the user's own space, without root. Anything that
  truly needs root goes through the existing sudo card (Linux only).
- Usable from a phone.
- `./install.sh` still runs only from the canonical clone.
