---
slug: openrouter-harness
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-19
---

# OpenRouter models as wheelchair agents

## What we're building

A new kind of agent in wheelchair that runs models from OpenRouter, the service that sells
access to many companies' models behind one key. It runs inside a lightweight coding
program (Pi or OpenCode, chosen during planning), and wheelchair starts, watches and reads it
the same way it does Claude, Codex, Antigravity and Kimi agents.

## Why — the problem

Today wheelchair can only run agents on the four programs it already knows, each tied to
its own company's models and login. There is no way to put an OpenRouter model to work as
a reviewer, worker or other agent in a thread.

## What good looks like

- OpenRouter appears in Settings alongside the other providers, with its key status and a
  model you can pick.
- A thread can start an agent on an OpenRouter model, and it shows up on the Agents screen
  like any other.
- Its replies show in the thread, and wheelchair notices when each of its turns finishes.
- A finished OpenRouter reviewer or verifier delivers its report back the way others do.

## Not doing

- Replacing or changing how the existing four providers work.
- Pointing an existing program (Claude Code, Codex) at OpenRouter instead of adding a new one.
- Supporting both Pi and OpenCode; one is picked.
- Hardening beyond normal day-to-day use in this first part; that goes to a follow-up thread.

## Constraints

- The OpenRouter key must never leak into logs, transcripts shown in the app, or cards.
