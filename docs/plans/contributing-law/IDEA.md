---
slug: contributing-law
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-24
---

# Follow a project's CONTRIBUTING.md as repo law

## What we're building

Every wheelchair agent working in a project treats that project's CONTRIBUTING.md as
binding rules, the same way it follows wheelchair's own role rules. When a build is
checked, the verifier also checks the work against CONTRIBUTING.md and reports anything
that breaks it.

## Why — the problem

Nothing tells agents to read CONTRIBUTING.md today, so they follow it only by luck. Agents
from other people's machines brought in work that broke wheelchair's own CONTRIBUTING.md:
Junjie's custom backgrounds PR added ROUTER.md files beside the AGENTS.md routers that
CONTRIBUTING.md names as the routers. No check caught it.

## What good looks like

- In any project with a CONTRIBUTING.md, agents read it before they change anything, and
  their work follows it.
- A verifier that finds a change breaking a CONTRIBUTING.md rule reports it as a gap, and
  the gap gets fixed like any other.
- A project without CONTRIBUTING.md works exactly as it does today.

## Not doing

- Removing the ROUTER.md files (that is its own thread).
- Writing or changing any project's CONTRIBUTING.md.
- Making agents follow other project documents (README, style guides) as law.

## Constraints

- Works for every AI provider wheelchair runs (Claude, GPT, Gemini, Kimi, OpenRouter).
- Wheelchair's own role rules stay in charge of how agents work together; CONTRIBUTING.md
  governs the project's code and files.
