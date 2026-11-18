---
slug: local-projects
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Custom MCP tools for a project's agents

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Mapping: `MAP.md` and `docs/maps/local-project-runtime.md`.

## Open Questions

### Q1: Where does a project's tool list live?
- **Context:** Claude Code already reads a checked-in `.mcp.json` at the repo root; Codex and Antigravity have their own config formats. Wheelchair's hub already has project-scoped settings (`viewer/app/routes.js:340-348`) but the machine start payload has no MCP field (`viewer/app/sessions.js:304-330`).
- **Options:** (a) the repo's own `.mcp.json`, which wheelchair translates for Codex and Antigravity; (b) a per-project list in wheelchair's Settings, kept out of the repo; (c) both, Settings overriding the repo.
- **Recommendation:** (a). One file, versioned with the project, works for Collin's own Claude Code outside wheelchair too, no new settings UI.

### Q2: Which agents get the tools?
- **Context:** Reviewers and the mapper are read-only by role; an engine bridge can change things. Asides and usage probes deliberately disable MCP (`machine/adapters/claude.js:54-55`, `machine/adapters/codex.js:28`).
- **Options:** (a) every agent; (b) agents that build or check (lead, sub-lead, workers, verifiers), not reviewers, mapper or asides.
- **Recommendation:** (b).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Claude Code asks for approval of project `.mcp.json` servers interactively | A session in tmux could stall on that prompt; check how to pre-approve per worktree | no | |
| 2 | Codex and Antigravity config locations | Confirm each CLI's per-session or per-worktree MCP config mechanism without touching the account's global config | no | |
| 3 | IDEA asks for plain failure reporting | How a tool that fails to start is detected and shown | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode two-part | Collin's pick; get something usable, harden in a follow-up | user |
| 2 | This thread builds custom MCP tools only; seeing the app run and trying results locally became separate stub threads | Collin's pick of the three pieces | user |

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
