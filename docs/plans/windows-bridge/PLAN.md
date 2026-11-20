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

### Q1: Where do agents' Windows apps appear, and may agents send them mouse and keyboard input?
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
| D3 | Sync around each Windows step, not live: Linux edits copied to the Windows copy right before any bridge command, Windows changes copied back right after, plus an explicit sync command | User's pick; live two-way sync left out | user |
| D4 | What syncs is what git would see: tracked files plus untracked files git does not ignore; deletions sync too. Ignored files (Unity's `Library/`, `Temp/`) live only on the Windows side | Keeps caches on Windows and never pollutes the thread's worktree | defaulted |
| D5 | A file changed on both sides since the last sync: the Linux version wins, the Windows version is saved to a conflicts folder beside the copy, and the command's result names each conflict | Agent edits are the source of truth; nothing is lost silently | defaulted |
| D6 | Each session's Windows copy lives at `%LOCALAPPDATA%\Wheelchair\copies\<thread-id>\<session-name>` | Fast local drive, per session so workers and verifiers do not collide | defaulted |

## Spec

To be completed as decisions land.

### Keeping the Windows copy in step (D3–D6)

- Each session that uses the bridge gets its own Windows copy (D6), created on first use.
- Before every bridge command, the session's worktree is pushed to its copy: files git would
  see (tracked, plus untracked not ignored) are copied if changed, and files removed in Linux
  are removed from the copy. Ignored paths on the Windows side are never touched.
- After every bridge command, files git would see that changed or appeared in the copy are
  copied back to the worktree, and files deleted in the copy are deleted in the worktree.
- A file changed on both sides since the last sync keeps the Linux version; the Windows
  version goes to the conflicts folder and the result lists it (D5).
- An explicit sync command does both directions without running anything.
- The copy is not watched between commands: an app left open on Windows sees Linux edits
  only at the next bridge command or sync.

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
