---
slug: agent-model-preferences
status: confirmed
mode: thorough
created: 2026-11-27
---

# Better agent model preferences in Settings

## What we're building

A reworked **Settings → Models** UI with a clearer, less cluttered way to choose models, tiers, and provider fallback ladders for every kind of agent — bringing model tiers, the default Lead and Worker provider ladders, and per-agent preferences together into one coherent setup instead of scattering them across **Models** and **Usage and balancing**.

## Why — the problem

Right now **Settings → Models** splits model choices across separate blocks (a provider-by-tier table, a separate list of per-provider model pickers for Leads and Sub-leads, an Escalation block, and an Other agents list that picks tiers), while the Lead and Worker provider orders live over in **Usage and balancing** with no per-agent provider ladders. It feels cluttered, the controls are cumbersome, and it forces you to jump between separate places to understand or change what an agent will run on.

## What good looks like

- Opening **Settings → Models** makes it immediately clear what models are configured for each tier, what the default Lead and Worker provider ladders are, and which tier and provider ladder each agent uses.
- Choosing or changing model tiers, provider fallback ladders, and per-provider tier models uses a cleaner, more intuitive UI on both desktop and phone.
- Agents that don't build directly (Personal assistant and Project leads) sit in their own separate block, distinct from thread/build agents.
- **Usage and balancing** stays focused on usage bars, forecasts, and reserves (without provider order editors).
- Existing saved model and balancing settings continue to work without losing preferences or breaking new sessions.

## Not doing

- Adding new AI providers or changing how providers are signed in, forecasted, or reserved for leads.
- Changing how individual agent roles work or what tasks they perform.
- Redesigning unrelated Settings categories beyond moving the Lead and Worker provider orders out of **Usage and balancing** into **Models**.

## Constraints

- Existing saved `settings.json` model preferences must remain compatible or migrate cleanly so new sessions keep working.
- Changes must work cleanly on both desktop and mobile viewports in the Settings page.
