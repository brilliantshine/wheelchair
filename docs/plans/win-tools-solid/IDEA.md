---
slug: win-tools-solid
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-22
---

# Make Windows tools solid

## What we're building

The hardening left over from the Windows tools go-between (plan `win-tool-gobetween`, PR #159).
On WSL, an agent's Windows tools run in a Windows copy of the project, and a go-between
starts them. This thread makes that hold up across a machine service restart and when an
agent stops listening.

## Why — the problem

- If the machine service restarts while a Windows tool is still waiting to start, it
  waits forever: what it was waiting on lived only in the old service's memory.
- When the agent closes only its side of the connection and goes quiet, the go-between
  does not notice until it next tries to send something.

## What good looks like

- Restart the machine service while a session's Windows tools are starting: the tools
  still come up for that session, without restarting it.
- An agent that stops listening: the go-between and its Windows tool shut down soon
  after, rather than lingering.

## Not doing

- Stop, cleanup and archive waiting for Windows tools (and the programs they start) to
  finish writing, including for crashed or killed sessions sharing a copy: split into its
  own thread ("Windows tools: wait before sync"), see PLAN.md D14.
- Any change to how tools behave once running, or to which tools run on Windows.
- Changes to the go-between's startup handshake, held calls or tool list, already built.
- Anything outside WSL with Windows tools; other machines are untouched.

## Constraints

- Machine service tests run without Windows (fakes), as today.
