---
slug: startup-growth-warning
status: confirmed   # draft | confirmed
created: 2026-11-17
---

# Warn when agent sessions start bigger again

## What we're building

A warning on the approval card when Claude agent sessions have started noticeably bigger
than before, most likely because a Claude Code update added tools we have not turned off.
The warning says what grew and by about how much, so Collin knows the tool list needs
another look.

## Why — the problem

Turning off unused Claude Code tools cut each agent session's starting size from about
47,000 tokens to about 17,000. Every call in a session pays for that starting size again,
so it drives most of the cost. A Claude Code update can quietly add new tools, and the
saving would leak away with nobody noticing until someone measures by hand.

## What good looks like

- After a Claude Code update that makes sessions start several thousand tokens bigger,
  the next approval card shows a warning saying so.
- On a normal day, with no growth, no warning appears.
- The warning never stops or delays Start building, and a failed check never does either:
  it just shows no warning.

## Not doing

- Not turning off the new tools automatically. Collin decides what to do about them.
- Not watching GPT or Gemini sessions; only Claude Code's tools are trimmed today.
- Not a dashboard or history of session sizes.
- Not a warning anywhere other than the approval card.

## Constraints

- Never blocks or delays a build.
- Builds on the session record the token-savings work added (merged in pull request #100).
