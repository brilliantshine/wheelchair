# Router

## Purpose
Serve authenticated graph and document viewers and the Wheelchair application hub.

## Directories
- app/ — persisted hub state, settings, session orchestration, cards, and HTTP dispatch
- pages/ — browser pages, Settings editors, navigation, and shared rendering
- test/ — isolated HTTP, state, graph, and browser checks

## Important Files
- AGENTS.md — component ownership and authentication boundaries
- server.js — HTTP authentication, public asset allowlists, graph validation, and layout
- index.html — interactive standalone graph canvas
- doc.html — legacy plan document viewer shell
- doc.js — legacy document loading and rendering
- playwright.config.js — Chromium and Firefox browser test configuration
- package.json — viewer dependencies and browser test command
