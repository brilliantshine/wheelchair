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

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | 2026-11-21 | Thread "Windows bridge: Unity setup, disk use, warnings" (`wc/d5233e17e73d`, verifying, not merged) changes adapters (`loaded: [{name, windows}]`), startIn readying, restart recovery of `WinBridge.toolSessions`, `detectWsl` and the Project tools page. Plan should build on it; confirm whether it merges before build | yes | |
| W2 | 2026-11-21 | Claude: does a `--mcp-config` entry with the same name as a disabled `.mcp.json` entry load (parent C2)? Needed if Q1 = private port | no | Checked live 2026-11-21 (claude -p, two stub HTTP servers): with the `.mcp.json` entry in `disabledMcpjsonServers` and a same-name `--mcp-config` entry, only the `--mcp-config` URL is contacted; control without disabling contacts the `.mcp.json` URL. D5 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode thorough | User's choice | user |
| D2 | A marked tool is reached through a private Linux port the machine picks, not the tool's own port; each session's built config points the tool at `http://127.0.0.1:<private port><path>`; the user's `.mcp.json` is never changed | Removes cross-project port meaning, Linux-port clashes and the localhostForwarding loop; restart gap becomes a rare path | user |
| D3 | The forward (Linux private-port listener → Windows relay → Windows `127.0.0.1:<tool port>`) is used in every WSL networking mode, mirrored included; no networking-mode detection | Mirrored-mode direct access could reach a Linux listener on the tool's port; one path is simpler and always safe | defaulted |
| D4 | The switch is stored as parent D7: top-level `"wheelchair": {"windows": ["<name>", ...]}` in `.mcp.json` | CLIs that read `mcpServers` never see an unknown field; save flow already keeps other top-level keys | defaulted |
| D6 | Only `http` (streamable) entries can be marked; `sse` entries listed in `wheelchair.windows` are ignored with a warning and behave as today. IDEA.md: "(or SSE)" removed, SSE added to Not doing | SSE servers may send a full `endpoint` address at the tool's own port, bypassing the private port; SSE is deprecated and not editable in the form | idea-change |
| D5 | Claude: the marked `.mcp.json` entry is added to `disabledMcpjsonServers` and a same-name entry with the private URL is passed with `--mcp-config <file>`; tool names stay unchanged | Verified live (W2) | defaulted |

## Spec

(Grown as decisions land.)

- **Private port (D2).** Marked tools are not reached at their own port. The machine
  listens on a free `127.0.0.1` port it picks and each session's built config gets the
  tool's URL with host `127.0.0.1` and that port, path and query unchanged. `.mcp.json` is
  not modified. Claude per D5; Codex and Antigravity already build their config.
- **All networking modes (D3).** Same forward in NAT and mirrored mode.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
