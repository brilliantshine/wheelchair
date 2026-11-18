---
slug: local-projects
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Custom MCP tools for a project's agents

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Mapping: `MAP.md` and `docs/maps/local-project-runtime.md`.

## Open Questions

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
| 3 | A project's tools are defined in the repo's own `.mcp.json` (Claude Code format); wheelchair translates it for Codex and Antigravity. No new settings UI | One versioned file, also works for Claude Code outside wheelchair | user |
| 4 | Lead, sub-lead, workers and verifiers get the project's tools; reviewers, the mapper, asides and usage probes do not | Read-only roles must not be able to change things through a tool | user |

## Spec

### Source of truth

- A project's tools are the servers in `.mcp.json` at the root of the session's worktree, in Claude Code's format. No file means no tools and today's behaviour, unchanged.
- Wheelchair adds no settings screen for tools. Codex and Antigravity sessions get the same servers translated into their own config, scoped to the session, without editing the account's global config.

### Who gets the tools

- Lead, sub-lead, workers and verifiers: yes.
- Reviewers, mapper, asides and usage probes: no. They run with project MCP servers switched off, as asides and probes already do.

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
