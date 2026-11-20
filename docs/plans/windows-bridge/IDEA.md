---
slug: windows-bridge
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-19
---

# A bridge from Wheelchair in WSL to the Windows side of the same PC

## What we're building

Wheelchair keeps running inside WSL on a Windows PC, and its agents get a smooth way to
work on the Windows side of that same PC: their own Windows copy of the project, Windows
programs and apps they can run and see, and tools that live on Windows. It is general, not
Unity-only, but Unity is the first and main use and must work well.

## Why — the problem

Wheelchair only works inside Linux. On a Windows PC that means WSL, and anything that has
to run on Windows (Unity above all) is awkward today: the project lives in Linux where
Windows tools are slow or confused by it, each thread's copy is invisible to a Windows app,
reaching a Windows-side tool needs networking tweaks by hand, and agents cannot see or run
Windows apps at all. A native Windows version would be far more work than a bridge.

## What good looks like

- An agent in any thread can get a Windows copy of its own project, kept in step as it
  edits, without the user setting anything up per thread.
- Files a Windows tool writes into that copy (such as Unity's own files) make it back to
  the thread, so nothing is lost or drifts.
- An agent can run a Windows program (PowerShell, a build tool, Unity, the game itself)
  and get its output and success or failure back.
- An agent can open Unity on its own copy, run Unity's tests there, and report the results.
- An agent can open a Windows app, take a screenshot, and the user can see it in the thread.
- A tool that lives on Windows, such as Unity's editor bridge, can be used by that thread's
  agents like any other project tool, without hand-editing networking settings.
- Two threads at once each have their own Windows copy and don't step on each other.
- Setting it up is a one-time step on the PC, written down plainly.

## Not doing

- A native Windows version of Wheelchair.
- Wheelchair on a separate Linux computer bridging to a Windows PC (a possible later thread).
- Keeping Wheelchair's own files or projects on the Windows drive.
- Anything on Linux machines without Windows, or on Macs: they behave exactly as today.

## Constraints

- Wheelchair and its projects stay in the WSL Linux home folder, as the README already says.
- Machines without WSL must be unaffected.
- An agent's own `wc.js` and `card.js` calls stay always allowed.
- Git for Windows must be installed on the Windows side, and WSL's git and Git for Windows must be 2.43 or newer (added during planning, when the user chose git-based syncing).
