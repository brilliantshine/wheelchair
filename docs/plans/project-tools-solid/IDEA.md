---
slug: project-tools-solid
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-18
---

# Make project tools solid

## What we're building

Agents already get the tools listed in a project's `.mcp.json` when they run on Claude Code or Codex. This finishes that work: Antigravity agents get the tools too, Codex handles the tool setups it skips today, Collin is told in the thread when a tool is broken or skipped, and a real check confirms each tool actually connects.

## Why — the problem

- Antigravity agents get no project tools at all.
- Codex quietly skips tools that need headers (such as a login token), use other connection types, or use variables beyond plain pass-through.
- When a tool is broken, skipped or its program is missing, the only trace is a line in the machine service log. Collin never sees it, so agents just work without the tool.
- Only "configured" is known, never "connected".
- Codex's 64 KB size limit counts text units, not bytes, so text with non-English characters can exceed it unnoticed.

## What good looks like

- An Antigravity agent in a project with `.mcp.json` can use that project's tools.
- A Codex agent can use a project tool that needs a header or token.
- When a tool is skipped, broken or its program can't be found, the thread shows it once, in plain words, and it clears itself after a clean start.
- Collin can tell which tools actually connected, not only which were configured.
- The Codex size limit counts real bytes.

## Not doing

- Tools for CLIs other than Claude Code, Codex and Antigravity.
- Editing or managing `.mcp.json` from the app.
- Fixing a broken tool for Collin; the thread only tells him.

## Constraints

- Builds on the merged local-projects work (PR #112); plan record in `docs/plans/local-projects/PLAN.md`.
- Secrets in headers or tokens must not be written into stored session data or logs. One exception, Collin's choice: an Antigravity agent's private tool file (readable only by Collin, deleted when the agent ends) may hold a token, because Antigravity cannot read it from the environment.
- Antigravity must keep its login and hooks working with whatever per-session setup is used.
