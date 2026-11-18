---
slug: local-projects
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Custom MCP tools for a project's agents

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Mapping: `MAP.md` and `docs/maps/local-project-runtime.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Claude Code asks for approval of project `.mcp.json` servers interactively | A session in tmux could stall on that prompt | no | Settled: pre-approve via `enableAllProjectMcpServers` in the per-session `--settings` file (verified); see Spec. Decision 5 |
| 2 | Codex and Antigravity config locations | Per-session MCP config without touching global config | no | Codex: `-c mcp_servers.<name>.*` per invocation (verified). Antigravity: none found; promoted to Q3, settled as Decision 7 |
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
| 7 | Claude Code and Codex get project tools now; Antigravity sessions start without them and say so; Antigravity support is deferred to the follow-up. IDEA.md's "What good looks like" and Constraints updated to match | `agy --settings` rejects `mcpServers`; no per-session config found; writing global config would leak tools across projects | idea-change |
| 8 | Problems are surfaced through `session list` and the start output's `note`, and the lead tells Collin; lead.md gains one line saying so | No new card kind or screen needed; the lead already reads both | defaulted |
| 9 | For Codex, `${VAR}` and `${VAR:-default}` in `.mcp.json` are expanded from the session's environment at start; an unset variable with no default skips that server with a warning. Servers with `headers`, or of `type` other than `stdio`/`http`, are skipped for Codex with a warning (deferred) | Claude Code expands these itself; Codex's `-c` takes literal values | defaulted |

## Spec

### What this adds

A project gives its agents MCP tools through `.mcp.json` at the root of the repo, in
Claude Code's format (`{"mcpServers": {"<name>": {"command", "args", "env"} | {"type": "http", "url"}}}`).
Wheelchair reads that file from the session's own worktree when the machine starts a
session, and gives the tools to the roles that get them on Claude Code and Codex. No file
means today's behaviour, byte for byte: same settings file, same argv.

### Who gets the tools

- **Get them:** `lead`, `sub-lead`, `worker`, `verifier`.
- **Don't:** `reviewer`, `mapper`, asides, usage probes. Asides and probes already run with
  MCP off (`machine/adapters/claude.js:54-55`, `machine/adapters/codex.js:28`); leave them.

### Reading the file (machine side)

- In `startIn` (`machine/service.js`, before `commandFor`), read `<worktree>/.mcp.json`.
  Put the parsed server map (or `null`) and a `warnings` array into the context passed to
  the adapter's `command`.
- Missing file: no servers, no warnings.
- Unparseable JSON, or `mcpServers` not an object: no servers, one warning
  (`.mcp.json could not be read: <reason>`). The session still starts.
- For each stdio server in a role that gets tools: if `command` is not an absolute
  executable path and is not found on the session's PATH (the PATH the CLI will run
  with), drop the server and warn `tool "<name>": program "<command>" not found on <machine>`.
  An absolute path must exist and be executable.

### Claude Code (`machine/adapters/claude.js` `command`)

- Role gets tools, file has servers: add `enableAllProjectMcpServers: true` to `settings`.
  Servers dropped by the checks above go into `disabledMcpjsonServers` so Claude does not try them.
- Role doesn't get tools, file has servers: add `disabledMcpjsonServers: [<every server name>]`.
- Either way the session never shows the project-server approval prompt.

### Codex (`machine/adapters/codex.js` `command`)

- Role gets tools: for each kept server add `-c` overrides after the existing ones:
  - stdio: `mcp_servers.<name>.command=<toml string>`, `mcp_servers.<name>.args=[...]` if
    present, `mcp_servers.<name>.env={K="v",...}` if present.
  - `type: "http"`: `mcp_servers.<name>.url=<toml string>`.
  - Quote a name that is not `[A-Za-z0-9_-]+` the way `codex.js:28` already does.
  - Expand `${VAR}` and `${VAR:-default}` in `command`, `args`, `env` values and `url`
    from the session's environment. Unset with no default: skip the server, warn.
  - Skip with a warning: servers with `headers`, or a `type` other than `stdio`/`http`.
- Role doesn't get tools: add nothing. The account's `config.toml` is never written.

### Antigravity (`machine/adapters/agy.js`)

- No change to its argv. If the file has servers and the role would get tools, add the
  warning `project tools aren't supported on Antigravity yet; this agent runs without them`.

### Where warnings go

- The machine stores `mcp_warnings` (array of strings, possibly empty) on the session and
  returns it in the start response.
- The hub stores it on its session record, includes it in `wc.js session list` output for
  that session, and appends it to the start output's `note` (joined with `; `, after any
  existing note such as a dropped provider constraint).
- `protocol/app/lead.md`: one line under "What you may start and stop": when a start
  `note` or `session list` shows project tool problems, tell Collin in plain words in your
  reply; also run `session list` once at your first turn to see your own.

### Edge cases

- Session restart or replacement re-reads the file from its worktree at start.
- The file changing mid-session has no effect until the next session start.
- A worker's worktree is cut from the thread branch, so a `.mcp.json` added in a thread is
  seen by sessions started after the commit that adds it.
- `.mcp.json` servers already used by Collin's own Claude Code outside wheelchair behave the
  same there; nothing here writes the file.

### Non-goals

- Any settings screen for tools; writing `.mcp.json`; installing programs.
- Real connection health checks (deferred).
- Antigravity support (deferred).

### Validation

- `bash machine/test/run.sh` and `cd viewer && npm test` pass.
- New tests in `machine/test/` cover, for Claude and Codex: no file (settings and argv
  identical to today's), a worker with a stdio and an http server, a reviewer with servers
  (Claude `disabledMcpjsonServers`, Codex none), bad JSON, a missing command, `${VAR}`
  expansion and an unset variable (Codex), a `headers` server skipped (Codex), and the
  Antigravity warning.
- A viewer test covers `mcp_warnings` reaching the start output `note` and `session list`.
- Manual: in a scratch repo with `.mcp.json` naming a tiny stdio server, start a Claude
  worker and a Codex worker; each reaches ready without a prompt, and `claude mcp list` /
  the Codex session's `/mcp` show the server.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Antigravity support | Claude Code and Codex cover normal use; Antigravity has no per-session config | planning | `agy --settings` rejects `mcpServers` (verified). Servers live in global `~/.gemini/config/mcp_config.json` or `plugins/<name>/mcp_config.json`. Try a per-session config home (e.g. `XDG_CONFIG_HOME`/`HOME` override) or a per-session plugin dir |
| D2 | Real connection health check for tools | A missing-program check covers the common failure | planning | `claude mcp list` reports Connected/Failed; `codex mcp list` and `agy mcp list` only list config |
| D3 | Codex: servers with `headers` or other transport types | Stdio and plain http cover typical local tools | planning | Check Codex keys such as `http_headers` / `bearer_token_env_var` |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: see session; cross-family: yes.

**Changed since the last round:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
