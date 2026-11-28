---
slug: agent-model-preferences
status: confirmed
mode: thorough
created: 2026-11-27
---

# Better agent model preferences in Settings

## What we're building

A reworked **Settings → Models** UI with a clearer, less cluttered way to choose models and tiers for every kind of agent, bringing agent model preferences and model tiers together into one coherent setup instead of splitting them into separate blocks.

## Why — the problem

Right now **Settings → Models** splits model choices across separate blocks: a provider-by-tier table, a separate list of per-provider model pickers for Leads and Sub-leads, an Escalation block, and an Other agents list that picks tiers. It feels cluttered, the controls for choosing models and tiers are cumbersome, and it forces you to jump between separate places to understand or change what an agent will run on.

## What good looks like

- Opening **Settings → Models** makes it immediately clear what models are configured for each tier and which agents use them, without scrolling through separate, cluttered blocks.
- Choosing or changing model preferences and tiers for any agent role uses a cleaner, more intuitive UI on both desktop and phone.
- Existing saved model settings continue to work without losing preferences or breaking new sessions.

## Not doing

- Adding new AI providers or changing how providers are signed in or balanced.
- Changing how individual agent roles work or what tasks they perform.
- Redesigning unrelated Settings categories.

## Constraints

- Existing saved `settings.json` model preferences must remain compatible or migrate cleanly so new sessions keep working.
- Changes must work cleanly on both desktop and mobile viewports in the Settings page.
