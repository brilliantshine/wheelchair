---
slug: windows-localhost-tools
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Windows localhost tools from WSL

## What we're building

On a machine where wheelchair runs inside WSL, a project tool whose server runs on Windows
and is set up as `http://localhost:<port>` (or SSE) works for agents, as long as the user
turns on a "Runs on Windows" switch for that tool in Project tools. Nobody edits addresses.

## Why — the problem

Under WSL's default networking, `localhost` inside Linux is not Windows' `localhost`. A
tool server running on Windows (for example an editor's or game engine's MCP server) is
unreachable from agents, so the tool silently fails, and the only workaround is changing
WSL's networking mode or hand-editing addresses.

## What good looks like

- In Project tools, each localhost HTTP/SSE tool has a "Runs on Windows" switch.
- With it on and the Windows server running, an agent in a new session can call the tool,
  whether WSL uses its default networking or mirrored networking.
- With it off, the tool behaves exactly as today.
- If the tool can't be reached safely (for example a Linux program already holds that
  port), the agent doesn't get the tool, and the user can see why.
- A tool's settings and headers never go to some unrelated Linux program.
- Several threads and projects can run at once, restarts of the machine service included,
  without tools breaking or getting mixed up.

## Not doing

- Guessing automatically which tools run on Windows.
- Changing WSL's networking settings for the user.
- Tools started as commands (stdio), and tools at addresses other than localhost.
- Machines that are not WSL.
- Kimi sessions, which load no project tools today.

## Constraints

- A tool's headers can carry secrets; sending them to the wrong program is never acceptable.
- Works with the agents that load project tools today: Claude, Codex and Antigravity.
