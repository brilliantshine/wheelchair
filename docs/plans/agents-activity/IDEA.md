---
slug: agents-activity
status: confirmed   # draft | confirmed
created: 2026-11-17
---

# Agents screen: what each agent is doing right now

## What we're building

The Agents screen shows who is running, but not what each agent is doing. This adds a live
record of every step an agent takes (reading files, running a command, thinking, starting a
helper, searching the web), how full its memory (context) is, and where a question it asked
went. The selected-agent panel uses this to show an activity map, the latest steps, and
whether a quiet spell is normal; the tree shows a question's path up to the lead in amber.

## Why — the problem

When an agent goes quiet, Collin can't tell whether it is stuck, waiting, or halfway through
a slow test run without opening its terminal and reading. He also can't see when an agent is
close to running out of context, or which agent a "Needs you" question really started from.

## What good looks like

- Selecting an agent shows a map with six spots (Files, Shell, Thinking, Helpers, Web, the
  agent that started it). Busier spots have thicker lines and a count, and a dotted line
  traces its last few moves.
- What it is doing now is marked by short dashes drifting toward that spot, with the elapsed
  time ("now · 2:14"). With reduced motion turned on in the OS, nothing moves.
- "Latest" lists its last four steps, each with a time and done, failed or running.
- A one-line answer to "is this normal?", from how long similar steps took before, e.g.
  "Quiet for 2m 14s. That's expected: the attach tests took about 3 minutes the last two times."
- A ring around the agent shows how full its context is: amber at 70%, red at 90%.
- When a question reaches Collin, the path from the agent that first asked it up to the lead
  is drawn in amber in the tree.
- All of this works for agents running on Claude Code and on Codex, and updates while the
  agent works, not only when its turn ends.

## Not doing

- No change to the tree, sidebar, bottom terminal or the rest of the layout the earlier
  thread built, beyond filling in these parts.
- No change to how questions travel between agents; this only records and shows the path.
- No history browser or charts of past activity beyond what the panel shows.
- No Gemini or other CLIs.

## Constraints

- No tmux commands from this screen.
- Respects reduced motion.
- Codex's own tool hooks don't cover every tool and don't report failures, so for Codex the
  steps have to come from somewhere that does (its session log records every call with times).
- Context fill has to come from what each CLI actually reports; nothing is estimated where a
  CLI gives a real number.
