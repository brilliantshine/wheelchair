---
slug: agent-lessons
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Agents save lessons learned

## What we're building

Agents working in wheelchair can save a short lesson when they learn something the hard
way, such as "an extra question card is a minor review finding, not a major one". A
lesson is for the agent's own type (lead, sub-lead, worker, reviewer, verifier, mapper):
later agents of that type read it alongside their role rules, whichever AI runs them,
unless the lesson is marked as only for one AI. Collin can see, edit and remove the
lessons in the app.

## Why — the problem

Agents repeat the same mistakes across threads. After a 34-round plan review churn, one
lead saved its lesson in Claude Code's own memory. That only helps Claude sessions: GPT,
Gemini and Kimi agents never read it. It is tied to one folder on one machine, and Collin
cannot see or edit it from the app.

## What good looks like

- An agent that learns something worth keeping saves it as a lesson, without Collin
  having to ask.
- The next agent of the same type, on any AI, has that lesson in its starting
  instructions. Agents of other types do not.
- A lesson about one AI's habits (say, a Codex quirk) is marked as such and reaches only
  agents on that AI.
- Collin opens a page in the app, sees every lesson in plain words, and can edit or remove
  any of them. A removed lesson stops reaching new agents.
- The list stays short: lessons are few, specific and still true.

## Not doing

- Not a replacement for the protocol rules. A lesson that should apply always becomes a
  protocol change in its own thread (as "Stricter bar for major review findings" is doing
  for the severity lesson).
- Not using or syncing each AI's own built-in memory.
- Not changing agents that are already running: lessons reach agents when they start.

## Constraints

- Works for every provider wheelchair runs: Claude, GPT (Codex), Gemini, Kimi, OpenRouter.
- Collin manages lessons from a phone, through the app.
