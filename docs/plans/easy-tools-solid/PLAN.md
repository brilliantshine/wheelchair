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
| 4 | Enable both unkeyed and keyed folder tools over MCP in sandboxed Codex sessions. The bridge/launcher runs outside the sandbox to load keys and redact output, and confines each tool process inside `codex sandbox` with the worktree as writable root and matching `CODEX_HOME` and worktree trust. | Gives sandboxed Codex full folder-tool parity without exposing raw keys in the agent's config or environment. | user |
| 5 | Route keyed HTTP folder tools through a local proxy that loads declared keys from the project/shared key store, injects header values on outbound HTTP requests, and redacts any leaked key values from responses so raw keys never appear in the agent's MCP config or environment. | Matches how script and stdio server folder tools protect keys and works uniformly across Claude, Codex, and Antigravity. | user |

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
