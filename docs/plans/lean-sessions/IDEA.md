---
slug: lean-sessions
status: confirmed   # draft | confirmed
created: 2026-11-17
---

# Make wheelchair sessions leaner

## What we're building

A second round of token savings, for Claude and GPT sessions alike. Each session starts
with less, rereads less, makes fewer round trips, and gets shorter command output, so the
same thread costs fewer tokens on both plans.

## Why — the problem

Measured since the first token-saving round shipped (2026-11-17):

- Every Claude session starts at about 44k tokens before doing anything; GPT sessions start
  at about 18k. The difference is mostly connectors and skills that agent sessions never use.
- Leads now spend 52% of Claude tokens and sub-leads 44%. About two-thirds of the cost is
  rereading the whole context on every call, so cost is calls × context size.
- Leads read their rule file (7k) and the card rules (6.5k), and often read the card rules
  twice. Other roles read all the card rules, though each uses only a few kinds.
- Sub-leads still read raw worker diffs themselves (63 times across 8 builds, about 97k
  tokens), although a rule sends those to the scout.
- `session list` prints about 3k tokens of detail nobody needs.
- On GPT, workers and verifiers use the most tokens (about 270M input in a week), and
  that is what runs into plan limits.

## What good looks like

- A new Claude session starts well below 44k tokens.
- Leads and sub-leads do not reread a rule file they have already read.
- Each role reads only the card rules it uses.
- Sub-leads hand small and medium worker diffs to the scout, as intended.
- Routine steps take fewer calls, and routine command output is short.
- GPT workers and verifiers use fewer tokens per task.
- Re-measuring the same way after a few threads shows lower Claude and GPT use, with
  builds still passing verification as often as before.

## Not doing

- Moving any role to a cheaper model (that is a Settings choice already).
- Changing what Collin sees in a thread.
- Weakening reviews or verification to save tokens.

## Constraints

- Works for Claude, GPT and Gemini sessions, or falls back to today's behavior where a
  provider can't do it.
- Anything a session genuinely needs (its rules, the project's instructions) still reaches it.
