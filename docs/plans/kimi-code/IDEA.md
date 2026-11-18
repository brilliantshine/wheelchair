---
slug: kimi-code
status: draft   # draft | confirmed
mode: thorough
created: 2026-11-18
---

# Kimi Code support

## What we're building

Kimi Code (Moonshot's coding CLI) becomes a fourth CLI the app can run agents on, next to
Claude Code, Codex (GPT) and Gemini. Any agent (lead, sub-lead, worker, reviewer,
verifier, mapper) can run on it, and it can be chosen in Settings like the others.

## Why — the problem

Today the app only drives Claude, Codex and Gemini. Collin wants Kimi as another option:
another model family to spread work and review across, and another account to draw on.

## What good looks like

- Kimi Code shows up in Settings wherever the other CLIs do, and can be picked for any
  role.
- An agent started on Kimi runs to the end of its task the same way one on another CLI
  does: it posts its cards, commits through the app, and its report reaches whoever
  started it.
- The Ready check reports whether the kimi CLI is installed and logged in to a Kimi
  account on the machine, and says exactly what is missing if not.
- Kimi counts as its own model family for review, so a review can pair it with another
  family.

## Not doing

- Signing in with a Moonshot API key. Kimi is used through a Kimi account login only.
- Changing how Claude, Codex or Gemini work.
- Installing the kimi CLI or logging in for Collin; the app reports what is missing.

## Constraints

- Follow the pattern the existing CLIs set, so Kimi is not a special case.
- Existing tests keep passing.
