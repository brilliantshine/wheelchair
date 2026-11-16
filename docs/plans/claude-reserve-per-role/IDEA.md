---
slug: claude-reserve-per-role
status: confirmed   # draft | confirmed
created: 2026-11-15
---

# Separate Claude reserve settings for workers and reviewers

## What we're building

When this week's Claude usage is projected to run short, the app keeps Claude for leads
and sends every other session to GPT, reviewers included. We change that so reviewers can
keep using Claude, with separate settings for workers and reviewers.

## Why — the problem

- The reserve exists so leads never run out of Claude. But leads use little Claude.
- So when a reviewer is turned away to protect that reserve, the Claude it would have used
  mostly goes unused: far more is being held back than leads will ever need.
- Reviewers are forced onto GPT for nothing, and the pairing of one Claude reviewer with
  one GPT reviewer is lost.
- Separately, unticking "Save Claude for leads" doesn't turn the reserve off, though it
  looks like it should.

## What good looks like

- When Claude is projected to run short, reviewers still get Claude, while workers can be
  held back on their own setting.
- A plan review keeps one Claude reviewer and one GPT reviewer in that situation.
- Leads still don't run out of Claude.
- Each setting on Settings → Usage does what its label says. Turning a reserve off
  actually turns it off.

## Not doing

- Changing how the app forecasts the week's usage.
- Changing how leads and sub-leads pick a provider.
- Per-account or per-thread reserves.
- Changing which model tier reviewers, verifiers or mappers run on (that's the separate
  "Other agents" setting).

## Constraints

- Existing saved settings keep working after the change: nobody's current behaviour
  changes until they edit the new settings.
