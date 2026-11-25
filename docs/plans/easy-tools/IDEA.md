---
slug: easy-tools
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-25
---

# Easy, standard tools for agents

## What we're building

One standard, well-documented way to make a tool that wheelchair's agents can use, and an
easy way to connect it. A tool can belong to one project or be shared by every project on
the machine. The same standard works whether Collin writes the tool by hand or, ideally, just asks
wheelchair's agents to make and connect it.

## Why — the problem

Today a tool has to be a full MCP server (MCP is the protocol agents use to call outside
tools). Collin has to set that server up, then work out how to connect it: hand-edit a
`.mcp.json` file in the project's repository, get the command, paths and keys right, and
learn each AI's quirks. There is no recipe to follow, no way to share a tool across
projects, and agents have nothing standard to follow when asked to make one.

## What good looks like

- Making a new tool means following a short documented recipe, without first setting up
  or learning to run an MCP server.
- Connecting a tool is a small, obvious step, not hand-written server config.
- A tool can be made for one project, or once for every project on the machine.
- Asking a wheelchair agent to do it for you is easy: describe the tool in plain words
  ("make me a tool that does X", or "connect this one") and get a working, connected tool
  that follows the standard, without touching the files yourself.
- Once connected, the tool shows up for the agents that get project tools today, on each
  AI that can use tools, and a clear message says when it cannot be used and why.

## Not doing

- Replacing MCP for servers people already have: an existing `.mcp.json` keeps working.
- A public tool store or sharing tools between different people or machines.
- Making AIs that cannot load tools at all today (Kimi, Pi) load them, unless that turns
  out to come for free.

## Constraints

- Must work with the AIs wheelchair already supports, within each one's limits.
- Secrets (keys) stay on the machine, as project keys do today; never committed.
- Windows-side tools under WSL must keep working.
