---
slug: agent-model-preferences
status: draft
mode: thorough
created: 2026-11-27
---

# Better agent model preferences in Settings

## What we're building

A cleaner way in **Settings → Models** to choose which models each kind of agent uses, bringing agent model preferences and model tiers together into one coherent setup instead of splitting them into separate blocks.

## Why — the problem

Right now **Settings → Models** splits model choices across separate blocks (model tiers, lead models, escalation, and other agents). It feels cluttered and forces you to jump between separate places to understand or change which model an agent will actually run on.

## What good looks like

- Opening **Settings → Models** makes it immediately clear what models are configured for each tier and which agents use them, without scrolling through separate, cluttered blocks.
- Changing model preferences for any agent role is quick and straightforward on both desktop and phone.
- Existing saved model settings continue to work without losing preferences or breaking new sessions.

## Not doing

- Adding new AI providers or changing how providers are signed in or balanced.
- Changing how individual agent roles work or what tasks they perform.
- Redesigning unrelated Settings categories.

## Constraints

- Existing saved `settings.json` model preferences must remain compatible or migrate cleanly so new sessions keep working.
- Changes must work cleanly on both desktop and mobile viewports in the Settings page.
