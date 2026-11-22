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
starts them. This thread makes the go-between notice when the agent stops listening, so it and its
Windows tool don't linger.

## Why — the problem

- When the agent closes only its side of the connection and goes quiet, the go-between
  does not notice until it next tries to send something.

## What good looks like

- An agent that stops listening: the go-between and its Windows tool shut down soon
  after, rather than lingering.

## Not doing

- Recovering Windows tools still waiting to start after a machine service restart: split
  into its own thread ("Windows tools: recover after a service restart"), see PLAN.md D16.
- Stop, cleanup and archive waiting for Windows tools (and the programs they start) to
  finish writing, including for crashed or killed sessions sharing a copy: split into its
  own thread ("Windows tools: wait before sync"), see PLAN.md D14.
- Any change to how tools behave once running, or to which tools run on Windows.
- Changes to the go-between's startup handshake, held calls or tool list, already built.
- Anything outside WSL with Windows tools; other machines are untouched.

## Constraints

- Machine service tests run without Windows (fakes), as today.
