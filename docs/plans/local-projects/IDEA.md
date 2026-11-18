---
slug: local-projects
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-18
---

# Custom MCP tools for a project's agents

## What we're building

A way to give a project its own MCP tools (for example a bridge into a game engine) so
that every agent wheelchair starts for that project can use them, without setting each
tool up by hand in every CLI account.

## Why — the problem

Wheelchair is hard to use for local work like a game in an engine. One reason is that
agents only get whatever MCP tools happen to be set up in the account they run under, and
a project has no way to say "agents working on me need this tool". So an agent working on
a game cannot reach the engine, and every account and machine would need to be set up by
hand.

This is the first of three pieces. The other two (agents seeing the running app, and
trying a thread's work in your own checkout) are their own threads.

## What good looks like

- Collin sets up an MCP tool once for a project.
- Any new thread in that project, on any CLI wheelchair supports, has agents that can see
  and call that tool, without touching account settings.
- Projects without custom tools behave exactly as today.
- If a tool can't start (missing program, wrong path), Collin finds out plainly rather
  than agents silently going without it.

## Not doing

- Letting agents see or drive a running app (separate thread).
- Applying a thread's work to Collin's own checkout (separate thread).
- Writing or shipping any particular MCP server, such as a game-engine bridge.
- Installing the programs a tool needs on the machine; that stays Collin's job.

## Constraints

- Must work for the CLIs wheelchair runs (Claude Code, Codex, Antigravity).
- Must not change anything for existing projects that set up no tools.
