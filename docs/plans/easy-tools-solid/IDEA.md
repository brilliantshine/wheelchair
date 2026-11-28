---
slug: easy-tools-solid
status: draft
mode: thorough
created: 2026-11-28
---

# Make folder tools solid

## What we're building

The hardening follow-up for folder tools. It adds the four capabilities deferred from the first release — running Windows-side folder tools from WSL, generating non-Node server starter templates, supporting HTTP folder tool servers (using the key storage that already landed), and connecting folder tools directly through MCP inside sandboxed Codex sessions — and fixes a load-dependent output-drain race in the folder-tool launcher.

## Why — the problem

Today, folder tools work for local scripts and stdio servers on Linux/macOS and in Claude, Antigravity, and unrestricted Codex, but leave gaps:
- Windows-side folder tools cannot run from WSL sessions the way project MCP tools already do.
- `wc.js tool new --kind server` only generates a Node.js starter, making it slower to add servers in languages like Python.
- Folder tools only accept a local `start` command, not a remote or local HTTP MCP server `url` with header keys.
- Sandboxed Codex sessions skip folder tools over MCP and force agents to fall back to shell `wc.js tool run`.
- Under heavy machine load, the folder-tool launcher can exit before draining all of its child's output, causing truncated stdout and intermittent test failures.

## What good looks like

- A Windows-side folder tool works from a WSL session, waiting on the Windows readiness handoff and passing the Windows project path just like wrapped project MCP tools.
- `wc.js tool new --kind server --lang <lang>` creates a working starter server in another language (including Python) that passes `wc.js tool check`.
- A folder tool can point at an HTTP MCP server `url` with optional header keys from the existing project/shared key stores, and agents receive it across connectors.
- Sandboxed Codex sessions connect to folder tools directly over MCP with writes confined to the worktree and matching Codex home/trust settings, backed by a real Codex sandbox test rather than only a fake.
- The folder-tool launcher reliably drains all child output before exiting under load, and `machine/test/folder-tools-run.test.js` passes consistently.

## Not doing

- Redesigning folder-tool discovery, precedence, or the Settings shared-repo pinning built in the parent thread.
- Rebuilding the folder-tool key storage or key-redaction system (we reuse what already exists).
- Adding a web editor on the Tools page for creating or editing folder tools.

## Constraints

- Follow `CONTRIBUTING.md` and keep existing folder-tool behavior working for Claude, Codex, and Antigravity (Gemini runs through Antigravity).
- Keep the existing `wc.js tool new --kind server` default behavior intact when `--lang` is omitted.
- Sandboxed Codex enforcement must be tested against real Codex sandboxing, not only mocked command-line checks.
