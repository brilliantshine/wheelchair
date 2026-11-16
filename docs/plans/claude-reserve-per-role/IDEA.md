---
slug: claude-reserve-per-role
status: draft   # draft | confirmed
created: 2026-11-15
---

# Separate Claude reserve settings for workers and reviewers

## What we're building

When this week's Claude usage is projected to run short, the app holds Claude back from
everything except leads. Today one setting decides that for every other session at once.
We split it, so workers and reviewers each have their own setting for when Claude is held
back.

## Why — the problem

- Holding Claude back from workers saves the most usage, since they do the bulk of the
  work. But the same rule also takes Claude away from reviewers.
- Reviews are meant to pair one Claude reviewer with one GPT reviewer, each checking the
  plan from a different side. With Claude held back, both reviewers end up on GPT and the
  pairing is lost.
- Unticking "Save Claude for leads" looks like it should turn the reserve off, but it
  doesn't. The two settings interact in a way the Settings page doesn't show.

## What good looks like

- On Settings → Usage, you can set how workers behave and how reviewers behave when
  Claude is running short, independently.
- With workers held back and reviewers not, a plan review still gets one Claude reviewer
  and one GPT reviewer while workers go to GPT.
- Each setting does what its label says. Turning a reserve off actually turns it off.
- Leads and sub-leads keep getting Claude as they do now.

## Not doing

- Changing how the app forecasts the week's usage.
- Changing how leads and sub-leads pick a provider.
- Per-account or per-thread reserves.
- Changing which model tier reviewers, verifiers or mappers run on (that's the separate
  "Other agents" setting).

## Constraints

- Existing saved settings keep working after the change: nobody's current behaviour
  changes until they edit the new settings.
