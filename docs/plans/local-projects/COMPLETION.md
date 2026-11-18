---
slug: local-projects
date: 2026-11-18
implemented-by: "standard / gpt-6.1-terra (T1, T2); integration fixes by the sub-lead (claude-opus-5-5)"
verified-by: []
---

# Completion Report — Custom MCP tools for a project's agents

Written for a hostile reviewer: every claim checkable, no claim without evidence.

All lines are on branch `wc/21cc83a58882`. Mode is two-part: the Deferred items D1-D4 were not built.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Roles that get tools: lead, sub-lead, worker, verifier. Reviewer, mapper, asides and probes don't | this run | `machine/lib/project-mcp.js:6` (`TOOL_ROLES`); `machine/service.js:565` (`tools: TOOL_ROLES.has(input.role)`). Asides and probes are untouched: `machine/adapters/claude.js:54-55`, `machine/adapters/codex.js:28` | `project-mcp.test.js:25`, `:59`; `project-mcp-codex.test.js:30` |
| Read `<worktree>/.mcp.json` in `startIn` before `commandFor`, and pass `mcp` (null or `{names, servers}`) through the context | this run | `machine/service.js:612` (read), `:565` (context) | `project-mcp.test.js:59` |
| Missing file: no servers, no warnings, today's settings and argv | this run | `machine/lib/project-mcp.js:15`; `claude.js:69` (gated on `mcp?.names.length`); `codex.js:56`; `agy.js:32` | `project-mcp.test.js:19`; `project-mcp-codex.test.js:15` |
| `stat` first: regular file of at most 32 KiB, otherwise unreadable; never open a non-regular file | this run | `machine/lib/project-mcp.js:14-19`; re-checked on a non-blocking handle `:22-29` (sub-lead integration, see Deviations) | `project-mcp.test.js:50` (directory, named pipe, 32769 bytes; 2 s timeout proves the pipe never blocks) |
| Read error, bad JSON, `mcpServers` missing, not an object or an array: `mcp = null`, one warning, never throw | this run | `machine/lib/project-mcp.js:16`, `:29`, `:31`, `:32`, catch-all `:42` | `project-mcp.test.js:33` |
| Per-entry validation (stdio: command, args, env; http: url; everything else dropped for both CLIs, with a warning naming it) | this run | `machine/lib/project-mcp.js:33-40` | `project-mcp.test.js:40` |
| Warnings quote the file's own text, never an expanded value; names and reasons through `JSON.stringify` | this run | `machine/lib/project-mcp.js:8`, `:39`; `codex.js:67` | `project-mcp.test.js:59` (name with a line break logged on one line); `project-mcp-codex.test.js:52`, `:59` |
| Warnings only for roles that get tools (and Antigravity); other roles read the file and log nothing | this run | `machine/service.js:614` | `project-mcp.test.js:59` (reviewer with a broken file logs nothing) |
| One `console.error` line per warning: `<session>: project tools: <warning>`; nothing added to the start response, hub or thread | this run | `machine/service.js:614` | `project-mcp.test.js:59` |
| Claude, tools role: rejected entries in `disabledMcpjsonServers` even when none are valid; `enableAllProjectMcpServers` only with at least one valid entry | this run | `machine/adapters/claude.js:69-72` | `project-mcp.test.js:25`, `:40` |
| Claude, other roles: `disabledMcpjsonServers` lists every name | this run | `machine/adapters/claude.js:70-71` | `project-mcp.test.js:25` |
| Claude, unparseable file: settings unchanged | this run | `machine/adapters/claude.js:69` (`mcp` is null) | `project-mcp.test.js:33` |
| Codex, tools role: `-c mcp_servers.project_<name>.*` after the existing overrides | this run | `machine/adapters/codex.js:56-83` | `project-mcp-codex.test.js:23` |
| Codex: names must match `[A-Za-z0-9_-]+`, otherwise skip with a warning | this run | `machine/adapters/codex.js:60` | `project-mcp-codex.test.js:52` |
| Codex: any `${...}` in command, args, url, or an env value other than exactly `${KEY}` for its own key skips the server | this run | `machine/adapters/codex.js:62-65` | `project-mcp-codex.test.js:36` |
| Codex stdio: command, args (`[]` if absent), env literal table, `env_vars` for pass-through keys, `enabled=true` | this run | `machine/adapters/codex.js:71-82` | `project-mcp-codex.test.js:23` |
| Codex http: url, `enabled=true` | this run | `machine/adapters/codex.js:70`, `:82` | `project-mcp-codex.test.js:23` |
| Codex: `headers` servers skipped with a warning | this run | `machine/adapters/codex.js:61` | `project-mcp-codex.test.js:52` |
| Codex, other roles: nothing added; account `config.toml` never written | this run | `machine/adapters/codex.js:56` | `project-mcp-codex.test.js:30` |
| No expanded value in the argv (`session.command`, `session list --full`) | this run | `machine/adapters/codex.js` reads no environment in `command` (only `:23`, pre-existing usage probe) | `project-mcp-codex.test.js:59` (sentinel in `process.env` never appears) |
| Antigravity: argv unchanged; warning line when the file has servers and the role gets tools | this run | `machine/adapters/agy.js:32` | `project-mcp.test.js:19`, `:59` |
| Edge cases: re-read at every start (restart, replacement); mid-session changes ignored | this run | `machine/service.js:612` runs on every `startIn`; nothing reads it later | by construction |
| Edge cases: README section "Project MCP tools" | this run | `README.md:168-172` | read it |
| Manual: Claude and Codex workers in a scratch repo reach ready without a prompt, `/mcp` shows the server, each calls the tool once | not run | — | Left to the verifier, as the lead's brief allowed (needs real sessions in a scratch repo outside this worktree) |

## Deviations from plan

- **Non-blocking open (sub-lead).** The Spec says to stat before reading and never open a non-regular file. The reader still stats first (`project-mcp.js:14-19`). It then opens with `O_NONBLOCK` and repeats the regular-file and size checks on the open handle (`:22-29`). Without the second check, a file swapped for a pipe between the stat and the read could block the start. In normal use a non-regular file is still never opened.
- **Test isolation fix outside the Spec (sub-lead).** The existing test `Codex and Antigravity first messages point to prompt files` (`machine/test/service.test.js:885`) ran Antigravity's `prepare` against the real home. Every run of the machine suite therefore rewrote `~/.gemini/config/hooks.json` to point at whichever worktree ran it. The test now runs under a temporary `HOME`. The real file was put back to the canonical clone's hook by running the canonical `prepare`. Test-only change.
- **`names` order.** The reader uses `Object.keys` order, which puts integer-like names first. This differs from file order only for such names.

## Routers

`machine/AGENTS.md:15` gained a row for `lib/project-mcp.js`, which reads and validates project MCP servers when a session starts. No other ownership moved.

## Validation evidence

On the merged branch at commit `69e48f9` (sub-lead run):

```
$ node --test machine/test/project-mcp.test.js machine/test/project-mcp-codex.test.js
# pass 12
# fail 0
$ bash machine/test/run.sh
# pass 166
# fail 0
$ node --test viewer/test/*.test.js
# pass 632
# fail 0
```

`cmp` of `~/.gemini/config/hooks.json` before and after `bash machine/test/run.sh`: unchanged. Before the test isolation fix, every run rewrote it.

Worker reports with full pasted output: `docs/plans/local-projects/reports/T1.md` and `T2.md`. One viewer run failed while the machine suite ran at the same time. T1 hit a port collision; the sub-lead saw a single failure in `the global write lock serializes concurrent writes and retry retains both changes`. Both passed on an isolated re-run.

## Known gaps / residual risks

- The manual end-to-end check (real Claude and Codex sessions, `/mcp`, one tool call) has not been run yet.
- A valid `.mcp.json` over 32 KiB, or an unreadable one, gives `mcp = null`. Claude then leaves settings unchanged and reads the file itself. For such a file, a role that should not get tools gets no `disabledMcpjsonServers`, and Claude may show its approval prompt. This follows the Spec's rule ("unreadable: settings unchanged"), but the Spec's "never shows the approval prompt" does not hold for that edge.
- Accepted Risks in PLAN.md still apply (an account server already named `project_<name>`; the file changing between the two reads).
- A stray real tmux session `wc-t-worker-1` (created about 2 days before this build, running `claude` in a deleted test temp folder) is a leak from some earlier test run. It is not from this build and was left alone.

## Remediation rounds
