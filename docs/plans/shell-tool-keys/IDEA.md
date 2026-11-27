---
slug: shell-tool-keys
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-27
---

# Keyed folder tools for Kimi and Pi

## What we're building

Kimi and Pi (OpenRouter) agents run folder tools from the command line, not through the
built-in tool connection. When such an agent runs a folder tool that needs keys, the
machine runs it on the agent's behalf with the keys added. The agent gets the tool's result
back with any key values blanked out, the same way the built-in tool connection does it for
Claude, Gemini and unrestricted Codex.

## Why — the problem

Since "Keys for folder tools" (pull request #200), a folder tool can declare keys, but only
agents using the built-in tool connection get them. On Kimi and Pi a keyed tool shows a
"needs keys, which this AI can't use yet" problem, so those agents can't use the tool at
all.

## What good looks like

- A Kimi or Pi agent runs a keyed folder tool and gets the same result a Claude agent would,
  with key values never shown to the agent.
- The "needs keys, which this AI can't use yet" problem no longer appears for Kimi and Pi.
- Listing tools on Kimi and Pi shows which keys are set, and agrees with what running does.
- If the connection to the machine drops mid-run, the agent is told the tool may already
  have run, instead of getting a half result.
- A tool that is cut off (the agent stops, or the machine service restarts) does not keep
  running in the background.
- Tools without keys keep running exactly as they do today.

## Not doing

- Sandboxed Codex: it keeps its current message telling you to set Codex to unrestricted.
  Its sandbox is there to limit what it can do, and having the machine run tools for it
  would get around that.
- Server-style (long-running) folder tools on Kimi and Pi: only script tools.
- Any change to how keys are stored, entered or blanked out.
- Reviewers, the assistant and project leads still get no folder tools.

## Constraints

- Key values never reach the agent, its transcript or the thread.
- Only sessions that already get folder tools may ask the machine to run one, checked with
  the session's own login token.
- Which AIs can do this is decided by what their connector says it supports, never by
  checking AI names outside `connectors/`.
