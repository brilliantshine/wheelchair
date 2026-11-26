---
slug: settings-rework
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-24
---

# Rework the Settings page

## What we're building

A reorganised Settings page in the wheelchair app. Settings are grouped into new categories, and the ones in the wrong place are moved, so each setting sits where you would look for it and no section is a catch-all.

## Why — the problem

The page grew one section at a time and is now cluttered. "Models and preferences" mixes model choices with unrelated things (your name, project folder, auto-merge, the assistant switch, diagrams). Related settings are split apart: lead provider order is under Models while worker order is under Usage, and usage readings and sign-in each show up in two sections.

## What good looks like

- Opening Settings, Collin can guess which category a setting is in and find it there.
- No category is a grab bag; each one's name says what is inside.
- Related settings sit together instead of across two sections.
- Every setting that exists today is still there and saves the same way.
- It reads well on a phone.

## Not doing

- Changing what any setting does, or adding new settings.
- Letting the personal assistant change settings for you (its own thread).

## Constraints

- No setting is lost or changes how it is stored.
