---
slug: modular-harness-connectors
status: confirmed  # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-22
---

# Make harness connectors modular

## What we're building

A cleanup of how wheelchair connects to the AI coding tools it runs (Claude Code, Codex,
Antigravity, Kimi Code, Pi for OpenRouter). Each tool's quirks move into that tool's own
connector, and the app reads what each tool can do from one place, so adding a new tool
later is mostly writing one new connector.

## Why — the problem

Collin plans to add more connectors. Today each tool's special cases are spread across
the machine service, the app's account, usage and settings code, the installer and the
tests: about 80 places check a tool by name. Adding Kimi and OpenRouter each took around
five commits across dozens of files, and it is easy to miss a spot, so a new tool would
quietly lack something (usage tracking, account switching, a Ready check) without anyone
noticing.

## What good looks like

- Adding a new connector means writing one connector file and one entry in the list of
  tools, plus its install recipe and its settings-page details. Nothing else in the
  machine service or the app has to name it.
- Outside the connectors and that list, the code asks "can this tool do X?" rather than
  "is this tool Kimi?".
- All five existing tools behave exactly as before: starting, logging in, usage and
  limits, account switching, chat history, reports, Ready check, installing.
- A short written guide says what a new connector must provide, and a test fails if a
  connector or list entry is missing something required.

## Not doing

- Adding any new tool in this thread.
- Changing how any existing tool behaves, looks or is configured, or what users see.
- Redesigning the settings page or the installer beyond what the cleanup needs.
- Plugin-style loading of connectors from outside the repository.

## Constraints

- No change in behaviour for the five existing tools; existing tests keep passing.
- Existing saved settings, accounts and running sessions keep working across the update.
