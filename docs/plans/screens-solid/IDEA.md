---
slug: screens-solid
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-18
---

# Make agent screens solid

## What we're building

The hardening left over from the agent screens work (`wc.js screen`, pull request #113),
where each agent session gets its own invisible screen to launch an app, take screenshots
and click, drag and type. This thread finishes the items that work deferred.

## Why — the problem

Screens work for normal use, but have rough edges:

- A machine missing Xvfb, ffmpeg or xdotool is only found out when an agent tries a screen.
- Nothing limits how many screens run at once.
- Screenshots pile up for the whole life of a thread; only archiving removes them.
- The app's process ids are not saved in the screen's state.
- A launch that fails before the app starts says it succeeded.
- A drag can take about 11 seconds when its limit is 10.

## What good looks like

- The Ready check and the installer say plainly when a machine lacks Xvfb, ffmpeg or xdotool.
- Starting a screen past the limit gives a clear error instead of another screen.
- A long-running thread does not keep piling up old screenshots; they are cleared while
  the thread is still open.
- A screen's state shows each app's process ids.
- A launch that fails before the app starts returns an error with the reason.
- A drag never takes more than 10 seconds.

## Not doing

- Installing Xvfb, ffmpeg, xdotool or a window manager for Collin.
- Changing how screens are torn down (still by systemd user slice).
- New screen commands beyond what the parent work built.
- A window manager for apps that need one: moved to its own thread.

## Constraints

- Builds on merged pull request #113; its Spec and Decision Log
  (docs/plans/drive-local-app/PLAN.md on branch wc/940599e3df66) still hold unless changed
  here.
