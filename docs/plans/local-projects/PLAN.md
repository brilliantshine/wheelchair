---
slug: local-projects
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Custom MCP tools for a project's agents

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Mapping: `MAP.md` and `docs/maps/local-project-runtime.md`.

## Open Questions

### Q3: Antigravity has no per-session tool config
- **Context:** `agy --settings` rejects `mcpServers` (verified: `unknown setting "mcpServers"`); Antigravity reads servers only from the global `~/.gemini/config/mcp_config.json` or plugin dirs, and no per-session config-dir flag was found. Claude (`--settings` keys) and Codex (`-c mcp_servers.<name>.*`) both take per-session config (verified).
- **Options:** (a) Claude and Codex now, Antigravity in the follow-up thread (changes an IDEA constraint); (b) investigate a per-session config home for Antigravity now (untested, may not exist); (c) write into the account's global Antigravity config (tools leak into every session on that account).
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Claude Code asks for approval of project `.mcp.json` servers interactively | A session in tmux could stall on that prompt | no | Settled: pre-approve via `enableAllProjectMcpServers` in the per-session `--settings` file (verified); see Spec. Decision 5 |
| 2 | Codex and Antigravity config locations | Per-session MCP config without touching global config | no | Codex: `-c mcp_servers.<name>.*` per invocation (verified). Antigravity: none found; promoted to Q3 |
| 3 | IDEA asks for plain failure reporting | How a tool that fails to start is detected and shown | no | Settled by default, Decision 6 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode two-part | Collin's pick; get something usable, harden in a follow-up | user |
| 2 | This thread builds custom MCP tools only; seeing the app run and trying results locally became separate stub threads | Collin's pick of the three pieces | user |
| 3 | A project's tools are defined in the repo's own `.mcp.json` (Claude Code format); wheelchair translates it for Codex and Antigravity. No new settings UI | One versioned file, also works for Claude Code outside wheelchair | user |
| 4 | Lead, sub-lead, workers and verifiers get the project's tools; reviewers, the mapper, asides and usage probes do not | Read-only roles must not be able to change things through a tool | user |
| 5 | Claude sessions that get tools pre-approve them with `enableAllProjectMcpServers: true` in the per-session settings (`machine/adapters/claude.js:68`); sessions that don't get tools set `disabledMcpjsonServers` to every server name in `.mcp.json` | Otherwise an interactive session stalls on the approval prompt, which the adapter's `answerPrompts` (`claude.js:75-81`) does not handle | defaulted |
| 6 | Failure reporting for the first part: at session start the machine checks `.mcp.json` parses and each stdio server's `command` resolves on that machine's PATH; problems come back as a warning in the start output's `note`, the session still starts without the broken tools, and the lead tells Collin. A real connection health check is deferred | `claude mcp list` can health-check but `codex mcp list` and `agy mcp list` cannot; a command-exists check covers the common failure (missing program) for every CLI | defaulted |

## Spec

### Source of truth

- A project's tools are the servers in `.mcp.json` at the root of the session's worktree, in Claude Code's format. No file means no tools and today's behaviour, unchanged.
- Wheelchair adds no settings screen for tools. Codex and Antigravity sessions get the same servers translated into their own config, scoped to the session, without editing the account's global config.

### Who gets the tools

- Lead, sub-lead, workers and verifiers: yes.
- Reviewers, mapper, asides and usage probes: no. They run with project MCP servers switched off, as asides and probes already do.

### Claude Code
- Getting tools: per-session settings gain `enableAllProjectMcpServers: true`, so the project servers load without the approval prompt.
- Not getting tools: per-session settings gain `disabledMcpjsonServers` listing every server in `.mcp.json`.
- No `.mcp.json`: settings unchanged.

### Codex
- Getting tools: each server in `.mcp.json` becomes `-c mcp_servers.<name>.command=…`, `.args=[…]`, `.env={…}` (stdio) or `.url=…` (http) on the session argv (`machine/adapters/codex.js:50`). The account's `config.toml` is not touched.
- Not getting tools: no servers are added.

### Broken tools
- At session start the machine checks that `.mcp.json` parses and that each stdio server's `command` resolves on its PATH.
- A bad file or missing command: the session still starts, without the affected servers, and the start output's `note` names each problem in plain words. The lead passes it on to Collin.

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
