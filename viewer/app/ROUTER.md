# Router

## Purpose
Compose the application hub and coordinate persistent state and agent sessions.

## Important Files
- hub.js — composes hub modules and initialization
- routes.js — dispatches application HTTP requests
- state.js — state paths, atomic persistence, and per-file transaction queues
- settings.js — preference normalization, role prompts, models, writing style, and saved background metadata
- background.js — bounded image uploads, immutable storage, revision checks, and cleanup through the settings queue
- sessions.js — session policy and lifecycle
- cards.js — card processing and thread transitions
- threads.js — thread lifecycle operations
- API.md — browser-facing application route contracts
- wc.js — agent session and git command client
- card.js — agent card validation and delivery client
