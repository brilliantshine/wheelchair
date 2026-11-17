---
slug: token-efficiency
status: confirmed   # draft | confirmed
created: 2026-11-16
---

# Make wheelchair use fewer tokens

## What we're building

Three changes to how wheelchair's agents spend tokens. Sub-leads get their own model
setting, separate from leads. Leads and sub-leads hand code reading to a "scout" running
a cheap model chosen in Settings (the Light tier by default), which reads and reports conclusions instead of the expensive model reading
code itself. And the sub-lead's context stays small through a build instead of growing
with every worker's diff.

## Why — the problem

Measured across past threads, the sub-lead spends about 45% of all tokens and the lead
about 36%, both on the most expensive model. Nearly all of it is re-reading: every step
re-reads the whole conversation, and the sub-lead's conversation grows to 170k–330k tokens
because it keeps every worker's diff. Reading code is the lead's biggest single input.
Today there is no way to put sub-leads on a cheaper model without also moving leads.

## What good looks like

- Settings has a separate model choice for sub-leads; leads are unaffected by it.
- Settings has a scout model choice too.
- Leads and sub-leads send code-reading questions to the scout and get answers
  back, instead of reading many files themselves.
- A sub-lead's context during a long build stays well below today's size.
- Re-measuring the same way after some threads shows sub-lead and lead token use down,
  with builds still passing verification as often as before.

## Not doing

- Moving reviewers or verifiers to cheaper models (already a Settings choice).
- Trimming or splitting the rule files (lead.md, cards.md, graphs.md).
- Changing what Collin sees in a thread.

## Constraints

- Works for Claude, GPT and Gemini sessions, or degrades to today's behavior where a
  provider can't do it.
- Verification still catches a worker's bad code; saving tokens must not weaken that.
