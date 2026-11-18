---
slug: project-tools-screen
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-18
---

# A screen for a project's tools

## What we're building

A screen in the wheelchair app where Collin sees, adds, edits and removes the MCP tools a
project's agents get, instead of editing the project's `.mcp.json` file by hand and
committing it himself.

## Why — the problem

Today the only way to give a project's agents a tool is to hand-write `.mcp.json` in Claude
Code's format and get it committed on the project's main branch, since threads start from
that branch, not from a local checkout. Doing that from a phone means starting a whole
thread. And when an entry is wrong, the warning goes to a machine log nobody sees, so the
tool silently doesn't show up.

## What good looks like

- From the app, Collin can open a project and see its tools, each with what it runs.
- He can add, change or remove a tool from his phone without writing JSON.
- Once saved, the next thread he starts in that project has the change.
- A tool entry the agents would skip is flagged on the screen, not hidden in a log.
- A tool that needs a key or password works without that key ending up in the project's
  git history.

## Not doing

- Writing or shipping any particular MCP server (such as a game-engine bridge).
- Changing which roles get project tools (lead, sub-lead, worker, verifier stay as they are).
- Changing threads that are already running; they keep the tools they started with.
- Tools set up in Collin's own CLI accounts, outside any project.

## Constraints

- The file stays `.mcp.json` in Claude Code's format at the repo root, so the project still
  works with Claude Code outside wheelchair.
- Works on a phone.
