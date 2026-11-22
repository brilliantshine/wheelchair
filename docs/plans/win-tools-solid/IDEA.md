---
slug: win-tools-solid
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-22
---

# Make Windows tools solid

## What we're building

The hardening left over from the Windows tools go-between (plan `win-tool-gobetween`, PR #159).
On WSL, an agent's Windows tools run in a Windows copy of the project, and a go-between
starts them. This thread makes that hold up when things go wrong: a machine service
restart, a session that crashes or is killed, a stop while a Windows tool is still
writing, and an agent that stops listening.

## Why — the problem

- If the machine service restarts while a Windows tool is still waiting to start, it
  waits forever: what it was waiting on lived only in the old service's memory.
- Several sessions can share one Windows copy. Stop, the periodic cleanup and archive
  check only the session being stopped, so a crashed or killed sibling's tools can still
  be writing when the copy is synced back or removed.
- A normal stop does not wait for a session's Windows tools, or the programs they
  started, to finish writing before the final sync. Late writes can be lost or land
  after the sync.
- When the agent closes only its side of the connection and goes quiet, the go-between
  does not notice until it next tries to send something.

## What good looks like

- Restart the machine service while a session's Windows tools are starting: the tools
  still come up for that session, without restarting it.
- Crash or kill one session that shares a Windows copy with others: its tools are
  cleaned up, and the copy is not synced back or removed while any of them are still writing.
- Stop a session while a Windows tool, or something it started, is writing: the final
  sync waits for it (up to a limit), so the work it wrote reaches the project.
- An agent that stops listening: the go-between and its Windows tool shut down soon
  after, rather than lingering.

## Not doing

- Any change to how tools behave once running, or to which tools run on Windows.
- Changes to the go-between's startup handshake, held calls or tool list, already built.
- Anything outside WSL with Windows tools; other machines are untouched.

## Constraints

- Every wait is bounded: a stuck Windows tool must never hold a stop, cleanup or archive
  forever.
- Machine service tests run without Windows (fakes), as today.
