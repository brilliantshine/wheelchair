---
slug: screen-window-manager
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-22
---

# A window manager for agent screens

## What we're building

Agent screens (the invisible desktops agents use to drive apps) start openbox, a small
window manager, when it is installed on the machine. Without it, screens work as they do
today.

## Why — the problem

Agent screens have no window manager, so apps that expect one misbehave: windows can't be
resized or made full screen, and dialogs land in odd places. Hearth has none installed.

## What good looks like

- On a machine with openbox installed, an app on an agent screen can be resized, go full
  screen, and its dialogs appear where the app puts them.
- An agent can still list and switch between windows on the screen.
- On a machine without openbox, screens behave exactly as today.
- The approval card's Ready check and the installer say openbox is optional and give the
  install command (`sudo apt install openbox`).

## Not doing

- Installing openbox automatically.
- Any window manager other than openbox.
- Window decorations, menus or keyboard shortcuts for the agent beyond clicking to focus.

## Constraints

- An agent must not be able to run commands through openbox (no menus or launch bindings).
- Builds on the screen work already merged in PR #122.
