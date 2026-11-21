---
slug: win-tool-gobetween
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Windows tools that start before their copy is ready

## What we're building

On a WSL machine, agents can use project tools (MCP servers) that are Windows programs and
work on the thread's own Windows copy of the project. The agent's command-line tool often
starts those tools before that copy is ready. This makes such a tool start working on its
own once the copy is ready, with no action from the agent and no delay to the agent's start.

## Why — the problem

- Today the agent starts after at most 45 seconds of waiting, even if the Windows copy is
  still being prepared. A Windows tool started then points at a copy that is missing or
  half-made, and it stays broken for the whole session.
- Cleanup (the final sync back, the periodic sweep, archiving) does not wait for those
  Windows tools to stop, so changes they are still writing can be lost or the copy removed
  under them.

## What good looks like

- An agent started before its Windows copy is ready sees its Windows project tools appear
  once the copy is ready, and can use them, without restarting or asking.
- The agent starts as fast as it does today.
- Stopping the agent normally brings back everything its Windows tools wrote.
- Codex, Claude and Antigravity agents all get this.

## Not doing

- Loading project tools for Pi agents.
- Windows tools reached over `localhost` (HTTP or SSE): that is the thread "Windows localhost
  tools from WSL".
- Tools that are not Windows programs.

## Constraints

- Must not hold back the agent's start; Codex gives up on a tool after about 10 seconds.
- Builds on the merged Windows bridge (PR #140, #149).
