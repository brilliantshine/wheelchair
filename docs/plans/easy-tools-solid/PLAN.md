---
slug: easy-tools-solid
status: planning
created: 2026-11-28
---

# Make folder tools solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q1: Should keyed folder tools also work over MCP in sandboxed Codex sessions?
- **Context:** Today sandboxed Codex sessions get no folder MCP entries (scripts run via `wc.js tool run`, and keyed tools are skipped on sandboxed Codex unless Codex is set to unrestricted). Once folder tools are wrapped in `codex sandbox` (with the worktree as writable root and matching `CODEX_HOME`/trust), the bridge/launcher can either load keys outside the sandbox and pass them into the sandboxed tool process (redacting output as usual), or keep keyed folder tools unrestricted-only.
- **Options:**
  - Enable both unkeyed and keyed folder tools over MCP in sandboxed Codex
  - Enable only unkeyed folder tools over MCP in sandboxed Codex; keep keyed tools unrestricted-only
- **Recommendation:** Enable both unkeyed and keyed folder tools over MCP in sandboxed Codex.

### Q2: Should HTTP folder tools keep secret header keys hidden behind a local proxy, or pass them directly in the agent's MCP config?
- **Context:** Folder tools can now use existing project/shared key stores. For an HTTP folder tool (`url` + optional `headers` with `${KEY}` placeholders), passing keys directly in the agent's MCP config/env is simpler, while routing keyed HTTP tools through a local proxy keeps raw keys out of the agent's config and environment (matching how script and stdio server folder tools protect keys today).
- **Options:**
  - Keep keys hidden behind a local proxy (agent never sees raw key values)
  - Pass keys directly in the agent's MCP config / environment (like `.mcp.json`)
- **Recommendation:** Keep keys hidden behind a local proxy.

### Q3: Which languages should `wc.js tool new --kind server --lang` support?
- **Context:** Today `wc.js tool new --kind server` only generates a Node.js echo server. We are adding `--lang` while keeping Node.js as the default when `--lang` is omitted.
- **Options:**
  - Node.js (default) and Python 3 (stdlib only, no extra packages)
  - Node.js (default), Python 3, and Shell (`sh`)
- **Recommendation:** Node.js (default) and Python 3 (stdlib only).

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---|---|---|---|
| 1 | 2026-11-28 | Verify whether `codex sandbox` preserves injected env vars (and what exact CLI flags `codex-cli 0.172.0` accepts for `workspace-write` and `read-only` with `CODEX_HOME` and worktree trust). | no | open |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Skip mockups for this thread. | Almost all work is machine/connector/CLI behavior; any Tools page change for HTTP folder tools is a small text/badge detail on the existing read-only list. | defaulted |
| 2 | Fix the keyless launcher output-drain race in `machine/lib/tool-launch.js` by waiting for `process.stdout` to flush before exiting, and verify both keyless and keyed drain paths under load in `machine/test/folder-tools-run.test.js`. | `child.on('close')` currently calls `process.exit(code)` while piped `process.stdout` still has buffered bytes under load. | defaulted |
| 3 | Support Windows-side folder tools from WSL for both stdio servers and scripts (and localhost HTTP forwarding if marked) by reusing the existing Windows readiness file and `win-tool-wrap.js` / `win-tool-proxy.js` handoff. | Matches existing `.mcp.json` WSL behavior and `IDEA.md`. | defaulted |

## Spec

(To be filled as Open Questions are settled.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-28: Checked `session leads` right after creating PLAN.md; no overlapping active threads (only theme options and Settings auto-refresh are active).
