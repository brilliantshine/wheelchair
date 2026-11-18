---
slug: drive-local-app
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-18
---

# Agents run, screenshot and drive the app they build

## What we're building

A way for wheelchair's agents to launch the desktop app or game they are working on, look
at it through screenshots, and use it with the mouse and keyboard, so they can check their
own work the way a person would. The app runs on an invisible screen of the agent's own, on
the machine the thread runs on.

## Why — the problem

Wheelchair is hard to use for local applications and game engines. Agents can build them
but cannot see them: sessions have no screen, and the only visual checks today are of web
pages in a browser. So an agent cannot tell whether a window opened, a button works or a
game scene draws correctly, and Collin has to check it all by hand.

## What good looks like

- An agent working on a desktop app or game can start it and get a screenshot of what it
  shows.
- The agent can click, type and press keys in it, then screenshot again to see the result.
- It works for any app with a window, without app-specific setup, on hearth (which has no
  monitor).
- Several agents can do this at once without seeing or disturbing each other's apps.
- When an agent wants Collin to see something, the screenshot shows up in the thread.
- Verifiers can use it to check a build's visible behaviour.

## Not doing

- Showing the app on Collin's real desktop or a computer he sits at (a possible later step).
- Engine-specific hooks (reading a game's scene or state from inside the engine); those can
  come later as a project tool.
- Live video or watching the agent work in real time.
- Recording and replaying test scripts.
- Mobile or console targets.

## Constraints

- Runs on hearth: Linux, no monitor, no desktop login.
- Must not disturb anything else running on the machine, including the screens tests
  already use.
- Must work for the Claude and Codex agents; Antigravity cannot take project tools yet.
- Without a graphics card on the invisible screen, heavy 3D may be slow or fail; that is
  accepted.
