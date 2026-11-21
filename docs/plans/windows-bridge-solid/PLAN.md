---
slug: windows-bridge-solid
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Make the Windows bridge solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Parent: `docs/plans/windows-bridge/PLAN.md` (merged in PR #140). Map: `MAP.md`.

## Open Questions

### Q2: How does the bridge know a `localhost` tool runs on Windows?
- **Context:** On a WSL machine a `localhost` URL could equally mean a Linux service.
- **Options:** a "runs on Windows" switch per tool in Project tools; automatic (forward when nothing on Linux listens on that port).
- **Recommendation:** explicit switch; automatic guessing can steal a port a Linux service wants later.

### Q3: How are Windows tools that started before the copy was ready handled?
- **Context:** The agent CLI (Claude, Codex, Antigravity) starts and owns its tool processes; the bridge cannot restart them from outside. The CLI gives up on a tool that does not answer within its start timeout (Codex about 10 s).
- **Options:** (a) a small go-between the bridge puts in front of each Windows tool, which restarts the real tool once the copy is ready while keeping the CLI's connection; (b) hold the agent's start until the copy is ready, however long it takes.
- **Recommendation:** (a): agents keep starting promptly, and the restart is invisible to them.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode is thorough | User's choice | user |
| D2 | Windows `localhost` HTTP/SSE tools are reached through a forward: a Linux listener on `127.0.0.1:<port>` pipes each connection through a Windows-side process (over WSL interop) to Windows `127.0.0.1:<port>`; skipped when WSL uses mirrored networking | Works for tools that bind only to Windows 127.0.0.1 and needs no firewall rule; rewriting to the host address fails for those tools and does not reach Claude's file-loaded config | defaulted |
| D3 | Disk report in `win info`: size of each copy of this thread, size of the repository's `.git`, count of kept conflict refs, and free space on the Windows drive. Warning when this thread's copies pass 20 GB, `.git` passes 10 GB, or the Windows drive has under 10 GB free. Warns only; never deletes | Measurable cheaply; unattributable shared objects are reported as one total; limits are generous so they fire only on real growth | defaulted |
| D4 | Broken bridge warning: added to the approval card's `warnings`, like the screen tools warning, and shown to the agent at session start; fires only on a Microsoft (WSL) kernel. Detection is widened so a WSL kernel with missing interop counts as "WSL, bridge broken: interop off" instead of "not WSL" | Mirrors the existing warning path; the user sees it before building starts | defaulted |
| D5 | The ready-made Unity setup is for MCP for Unity (CoplayDev), in its default HTTP mode (`http://localhost:8080/mcp`, served by the Editor on Windows) | User's choice; free, and it exercises the localhost forward end to end | user |

## Spec

### 1. Windows localhost tools
Reached through the forward in D2. (How a tool is marked as Windows: pending Q2.)

### 2. MCP for Unity preset
Project tools gets a ready-made entry for MCP for Unity: an HTTP tool at `http://localhost:8080/mcp`, running on Windows, reached through item 1. Saving it goes through the existing Project tools save flow. The user still installs the MCP for Unity package in their Unity project and starts its server from the Editor (Window > MCP for Unity); the preset's help text says so.

### 3. Disk report
As D3.

### 4. Tools started before the copy was ready
Pending Q3.

### 5. Broken bridge warning
As D4.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
