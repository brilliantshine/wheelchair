---
slug: windows-bridge-solid
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Make the Windows bridge solid

## What we're building

The Windows bridge lets agents in WSL work on their own Windows copy of a project. This
finishes three things it left out: a ready-made Unity MCP setup, disk-use reporting for
Windows copies, and a clear warning when the bridge is broken, plus small fixes to how the
bridge keeps track of Windows tools.

## Why — the problem

- Wiring a Unity MCP to the Windows copy is left to the user each time.
- Copies and the git data the sync leaves behind grow silently; nothing shows how much space they take.
- After a machine service restart, or when the copy was readied before the agent started, the bridge can lose track that a session's Windows tools were used and skip its final sync.
- When the bridge is broken on a WSL machine, agents only find out when a Windows command fails.

## What good looks like

- Choosing the Unity MCP preset gives an agent a working Unity MCP pointed at its Windows copy, with no hand editing.
- `win info` shows how much disk the thread's Windows copies use, the repository's git object storage, how many conflict snapshots are kept and how much space is free on Windows, and warns when copies, snapshots or free space pass a limit.
- Stopping an agent whose Windows tools were used always brings their changes back, even after a machine service restart.
- On a WSL machine with a broken bridge, the user sees a warning that says what is wrong, before work depends on it.

## Not doing

- Making Store-packaged apps (Windows 11 Notepad, Calculator, Paint) visible to or stoppable by the bridge.
- Loading project tools for Pi agents.
- Automatically deleting copies or git data to stay under the limit; it warns only.
- Bridges from anything other than WSL to Windows.
- Windows tools that serve on Windows `localhost` (HTTP or SSE): moved to their own thread, "Reach Windows localhost tools from WSL" (split from this plan's review; see PLAN.md D20).
- Holding back Windows tools that start before their copy is ready: moved to their own thread, "Hold Windows tools until their copy is ready" (see PLAN.md D21).

## Constraints

- Works on the user's WSL2 PC with WSL's default networking, and must not break mirrored networking.
- Nothing changes for machines that are not WSL, except that the MCP for Unity setup button also works there.
