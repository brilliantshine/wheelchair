---
slug: windows-bridge
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# A bridge from Wheelchair in WSL to the Windows side of the same PC

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: How do the Linux worktree and its Windows copy stay in step?
- **Context:** Each session has its own Linux worktree (`machine/service.js:554-589`). Windows tools need a copy on a Windows drive. Unity writes files (`.meta`, settings) that must come back; Unity's cache (`Library/`, `Temp/`) must not.
- **Options:** (A) sync around each bridge command: push Linux edits before, pull back Windows changes after, plus an explicit sync command; (B) a live two-way watcher.
- **Recommendation:** A. Predictable, no background process, and an agent touches Unity right after a bridge call anyway.

### Q2: Where do agents' Windows apps appear, and may agents send them mouse and keyboard input?
- **Context:** Linux screens are invisible (Xvfb). Windows client editions allow one active desktop; a hidden Win32 desktop is unreliable for GPU apps such as Unity and for input.
- **Options:** (A) apps open on the user's desktop; agents screenshot windows but send no input, and drive apps through their own tools (Unity's MCP, command-line modes); (B) A plus mouse/keyboard input on the user's desktop; (C) research a hidden desktop.
- **Recommendation:** A.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | Machine service runs as a systemd user service | Whether WSL interop (running `.exe` from Linux) works from a systemd service and inside tmux sessions it starts; `WSL_INTEROP` may be missing | no | |
| W2 | Codex screen apps run sandboxed (`machine/lib/screen.js:186-203`) | Whether Codex's sandbox blocks Windows interop, and whether that matters | no | |
| W3 | Per-thread Unity Editors | How a Windows MCP server bound to one Editor (port per instance) maps to the right thread | no | |
| W4 | Image cards need a Linux path (`machine/service.js:353-370`) | Windows screenshots must be copied to a Linux path first | no | |
| W5 | Windows copies accumulate | Cleanup when a session ends or the thread is archived | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode two-part | User's pick | user |
| D2 | Build for WSL on the same Windows PC; a separate Linux computer is out of scope | User's pick; recorded in IDEA.md Not doing | user |

## Spec

To be written as decisions land.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
