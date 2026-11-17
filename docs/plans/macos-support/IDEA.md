---
slug: macos-support
status: confirmed   # draft | confirmed
created: 2026-11-16
---

# Run wheelchair on a Mac

## What we're building

Make a Mac a full wheelchair machine: `./install.sh` sets it up, it runs agent sessions
(Claude and GPT), and it serves the app to your other devices over Tailscale, the same as
a Linux machine does today.

## Why — the problem

Today wheelchair runs only on Linux with systemd, or on Windows through WSL2. On a Mac,
the installer finishes but sets up nothing that runs in the background, so no agent
sessions can start. GPT sessions, the diagram setting and restarts after a side
conversation also fail, because they rely on commands and files only Linux has.

## What good looks like

- On a Mac, `./install.sh --serve` sets up the app and the machine service, and both
  come back by themselves after a crash or a reboot and login.
- From a phone, you can open the app served by the Mac, start a thread on it, and its
  Claude and GPT sessions run.
- Changing Settings → Diagrams works on the Mac.
- Restarting the machine service doesn't kill running sessions, the same as on Linux.
- The README has a macOS section covering what to install and how to keep the Mac awake.
- Nothing changes on Linux, and the existing test suites still pass there.

## Not doing

- The sudo helper on the Mac. Sudo cards won't work there; it can come in its own thread.
- Running when no one is logged in to the Mac. Services run under your login.
- Making every test suite pass on a Mac. Only the suites that cover changed code need to.
- Intel-specific or older-macOS work beyond what the code needs anyway.

## Constraints

- Linux behavior and the installer's existing flags stay as they are.
- macOS ships bash 3.2, and its command-line tools differ from Linux's (BSD rather than GNU).
- This build machine is Linux, so Mac behavior can only be shown by a person running it on a Mac.
