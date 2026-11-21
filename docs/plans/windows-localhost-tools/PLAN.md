---
slug: windows-localhost-tools
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Windows localhost tools from WSL

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Background: the parent plan's design for this (removed Spec §1 at
`d861dbb2:docs/plans/windows-bridge-solid/PLAN.md` lines 71-190, Decision Log D2-D20,
Review Rounds and Accepted Risks on `wc/d5233e17e73d`), summarised in `MAP.md`.

## Open Questions

### Q1: Same port, or a private port per forwarded tool?
- **Context:** The parent design listened on Linux `127.0.0.1:<the tool's own port>` and
  left the URL unchanged. Almost every review problem came from that: a port means Windows
  for one project and Linux for another; a Linux program already on the port blocks the tool;
  WSL's localhostForwarding can publish our listener back on Windows at that same port and
  loop; a freed port can be taken by an unrelated program that then gets the headers.
- **Options:** (a) same port, URL unchanged (parent design); (b) the machine picks a free
  private port per forward and the session's config points the tool at it (Codex and
  Antigravity build their own config already; Claude gets the original entry disabled and a
  same-name entry via `--mcp-config`, to be checked live).
- **Recommendation:** (b). Removes port ownership across projects, the Linux-port clash and
  the relay loop (our port is never the Windows tool's port); the restart gap shrinks to
  "another program grabs a random high port in seconds", a rare path.

### Q2: Mirrored networking: relay too, or connect directly?
- **Context:** In mirrored mode Linux can reach Windows 127.0.0.1 directly, but a Linux
  program on the same port would get the requests instead.
- **Recommendation:** decide after Q1.

### Q3: Where the switch is stored
- **Recommendation:** parent D7 (top-level `"wheelchair": {"windows": [...]}` in `.mcp.json`),
  defaulted unless Q1 changes it.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | 2026-11-21 | Thread "Windows bridge: Unity setup, disk use, warnings" (`wc/d5233e17e73d`, verifying, not merged) changes adapters (`loaded: [{name, windows}]`), startIn readying, restart recovery of `WinBridge.toolSessions`, `detectWsl` and the Project tools page. Plan should build on it; confirm whether it merges before build | yes | |
| W2 | 2026-11-21 | Claude: does a `--mcp-config` entry with the same name as a disabled `.mcp.json` entry load (parent C2)? Needed if Q1 = private port | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode thorough | User's choice | user |

## Spec

(Grown as decisions land.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
