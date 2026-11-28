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

The Settings page now has nine categories with many controls. When Collin knows what he wants changed, hunting through categories to find the right toggle or dropdown slows him down—especially on a phone.

## What good looks like

- Collin can ask the personal assistant in chat to inspect or update settings (for example, changing a preference, model choice, balancing rule, or behavior option) and see clearly what changed.
- Changes made by the assistant take effect the same way as using the Settings page directly and show up on the Settings page.
- Settings that are risky, touch secrets or logins, or live only in the browser have clear boundaries—either asking first or staying manual—so nothing breaks silently.

## Not doing

- Reworking or reorganizing the Settings page layout again.
- General hardening of the personal assistant itself (tracked in the separate "Make the personal assistant solid" stub).

## Constraints

- Plan against the current nine-category Settings page layout (including the PR #193 rework and Shared tools).
- Follow the project's repository rules in `CONTRIBUTING.md`.
