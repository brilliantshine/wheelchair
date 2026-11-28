---
slug: easy-tools-solid
status: draft
mode: thorough
created: 2026-11-28
---

# Make folder tools solid

## What we're building

The hardening follow-up for folder tools: running Windows-side folder tools from WSL, adding non-Node server starter templates, supporting HTTP folder tool servers (if key handling is ready), connecting folder tools directly through MCP inside sandboxed Codex sessions, and fixing an output-drain race in the folder-tool launcher.

## Why — the problem

The first folder-tools release left four follow-up capabilities deferred (WSL-to-Windows tools, non-Node server templates, HTTP tool servers, and direct MCP in sandboxed Codex), and load testing caught a race where the folder-tool launcher can exit before finishing its child's output.

## What good looks like

- Windows-side folder tools work from WSL sessions using the existing Windows wrapper and readiness check.
- `wc.js tool new --kind server` can generate server starters in languages other than Node.js (such as Python) via `--lang`.
- Folder tools defined as HTTP MCP servers work once header key handling is available (or are cleanly kept out if that dependency is not ready).
- Sandboxed Codex sessions connect to folder tools directly over MCP with the worktree as the writable root, verified by a real Codex sandbox test.
- The folder-tool launcher drains all child output reliably under load and `machine/test/folder-tools-run.test.js` passes consistently.

## Not doing

- Redesigning the core folder-tool layout, discovery, or Settings repo pinning built in the parent thread.
- Rebuilding key storage from scratch if it belongs to the separate *Keys for folder tools* thread.

## Constraints

- Follow `CONTRIBUTING.md` and keep existing folder-tool behavior working for Claude, Codex, Gemini, and Antigravity.
- Draft pending mapper results before confirmation.
