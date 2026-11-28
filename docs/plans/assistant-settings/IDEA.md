---
slug: assistant-settings
status: draft
mode: thorough
created: 2026-11-28
---

# Let the personal assistant change settings

## What we're building

Let Collin ask the personal assistant in its chat to check or change settings from the Settings page, instead of having to find and toggle the right control himself.

## Why — the problem

The Settings page now has eight categories with many controls. When Collin knows what he wants changed, hunting through categories to find the right toggle or dropdown slows him down—especially on a phone.

## What good looks like

- Collin can ask the personal assistant in chat to inspect or update settings (for example, changing a preference, model choice, or behavior option) and see clearly what changed.
- Changes made by the assistant take effect the same way as using the Settings page directly and show up on the Settings page.
- Any settings that are risky or cannot be changed safely by the assistant have clear boundaries so nothing breaks silently.

## Not doing

- Reworking or reorganizing the Settings page layout again.
- General hardening of the personal assistant itself (tracked in the separate "Make the personal assistant solid" stub).

## Constraints

- Plan against the current eight-category Settings page layout (PR #193 is merged).
- Follow the project's repository rules in `CONTRIBUTING.md`.
