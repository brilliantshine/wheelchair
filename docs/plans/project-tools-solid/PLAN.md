---
slug: project-tools-solid
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Make project tools solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

None.

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Codex research | Header keys Codex accepts | no | Folded into Spec (Decision 6) |
| 2 | Codex research | Literal header values land in the stored argv | no | Settled (Decision 7): a literal is already committed in `.mcp.json`, so copying it exposes nothing new |
| 3 | Codex budget | 64 KiB budget counts UTF-16 units | no | Folded into Spec (Decision 8) |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode thorough | Collin's pick; this thread is already the follow-up | user |
| 2 | Connection check: wheelchair itself connects to each project tool (MCP handshake + tool list), once per thread when a tools-getting agent first starts and again whenever `.mcp.json` changes; one result shared by every CLI | Collin's pick: catches bad tokens and URLs without slowing every agent start. No CLI offers a reliable check (research 2026-11-18) | user |
| 3 | Problems reach Collin as one system `needs` card per thread listing plain-language lines, closed by the hub when a later check or start leaves no lines (design carried from local-projects review rounds 1-3 / D4) | Already worked through three review rounds; system cards close themselves | defaulted |
| 4 | Antigravity gets project tools through a per-session plugin directory outside the worktree, passed with `--add-dir`; sessions that must not get tools do not pass it | Verified 2026-11-18 on agy 1.5.11: `--add-dir <dir>` discovers `<dir>/.agents/plugins/<name>/` and a model turn reached the tool; no HOME change, home hooks still fire. A plugin in the shared worktree would reach reviewers; `--settings` cannot disable plugins; a fake HOME isolates login and history | defaulted |
| 5 | The connection check also covers "program exists": a stdio server whose program cannot be started is reported as such. No separate PATH check. The check uses the tmux server's global environment, as the agent would | One launch answers both; avoids a second PATH guess | defaulted |
| 6 | Codex headers: `Authorization: Bearer ${NAME}` → `bearer_token_env_var`; a header whose whole value is `${NAME}` → `env_http_headers`; a literal header → `http_headers`; any other `${...}` skips the server with a line; `type: "sse"` skips on Codex and Antigravity | Verified keys on codex-cli 0.169.0; secrets stay out of argv; Codex silently treats sse as HTTP | defaulted |
| 7 | Literal values in `.mcp.json` (env, headers) are copied as is | They are already committed in the project's file; copying exposes nothing new | defaulted |
| 8 | The Codex 64 KiB budget counts UTF-8 bytes | Fixes the known undercount | defaulted |
| 9 | "Whenever `.mcp.json` changes" is detected at the next tools-getting agent start; the check also reruns while the last one found a problem, so a fix clears the card at the next start | The machine sees the file only at starts; rerunning while broken lets a fixed token clear without editing the file | defaulted |
| 10 | No card when every tool is fine; `session list` shows each tool's last result so a lead can answer "did it connect" | A card that needs nothing would sit under "Needs you" | defaulted |

## Spec

Builds on local-projects (PR #112, `docs/plans/local-projects/PLAN.md`). Everything there stays unless changed here. Reader: `machine/lib/project-mcp.js`; adapters: `machine/adapters/{claude,codex,agy}.js`; start path: `machine/service.js` `startIn` (~606-634); hub start: `viewer/app/sessions.js` `startSession` (~213-350) and `resumeUnanswered` (~185-210).

### 1. Reader (`machine/lib/project-mcp.js`)

- Accept `type: "sse"` (with a non-empty string `url`) as valid. Claude reads `.mcp.json` itself and handles sse; Codex and Antigravity skip it (sections 3, 4).
- `http` and `sse` entries: `headers`, when present, must be an object of string values; otherwise the entry is invalid (existing "not a valid ..." line, text updated to "not a valid stdio, http or sse entry").
- Return also `hash`: SHA-256 hex of the file's bytes (null when there is no file). Unchanged otherwise.

### 2. `${...}` rule (shared by Codex and Antigravity)

A value "passes through" when it is exactly `${NAME}`, `NAME` matching `[A-Za-z_][A-Za-z0-9_]*`. wheelchair never expands a variable into anything it stores (argv, `session.command`, files under the state dir, logs, card text).

### 3. Codex (`machine/adapters/codex.js` `command`)

For each tools-getting server, in addition to today's rules:
- `type: "sse"` → skip: "uses sse, which Codex does not support".
- `http` with `headers`: for each header —
  - name `Authorization` (case-insensitive) with value exactly `Bearer ${NAME}` (`Bearer` case-sensitive, one space) → `bearer_token_env_var="NAME"`;
  - value passes through (section 2) → entry in `env_http_headers={"<Header>"="NAME"}`;
  - value contains no `${` → entry in `http_headers={"<Header>"="<value>"}`;
  - anything else → skip the server: "a header uses ${...} that Codex cannot pass through".
  - Two Authorization-bearer headers cannot happen in JSON; header names are TOML-quoted with `tomlString`.
- Emit `http_headers` / `env_http_headers` only when non-empty. Never emit `bearer_token`.
- Budget: `quotedLength` measures `Buffer.byteLength(..., 'utf8')`; budget stays 64 KiB, still dropped as a whole with the same line.

### 4. Antigravity (`machine/adapters/agy.js` `command`)

For a tools-getting session with servers:
- Plugin dir: `<stateDir>/agy-tools/<session name>/.agents/plugins/wheelchair-project/`, created with mode 0700, holding `plugin.json` = `{"name":"wheelchair-project","version":"1"}` and `mcp_config.json` = `{"mcpServers":{...}}`, both written atomically (mode 0600). argv gains `--add-dir <stateDir>/agy-tools/<session name>`.
- Return the files to write from `command` (like `settingsPath`/`settings`) and let `startIn` write them before tmux starts; no writes inside `command`.
- Server translation: name kept as is (agy namespaces it `wheelchair-project_<name>`); stdio → `command`, `args`, `env`; http → `url`, `headers`. Before building, the worker verifies (fixture with a fake env var and the mock server pattern from research) whether agy expands `${NAME}` in `mcp_config.json`:
  - If it does: copy values unchanged; skip only entries with `${...}` forms other than section 2 and `${NAME:-default}`.
  - If it does not: an `env` value that passes through is omitted (the server inherits agy's environment); any other `${...}` in command, args, env, url or headers skips the server: "uses ${...} that Antigravity cannot pass through". Record which in the Log.
- `type: "sse"` → skip: "uses sse, which Antigravity does not support here".
- Names not matching `[A-Za-z0-9_-]+` → skip, same text as Codex.
- If every server is skipped, no plugin dir and no `--add-dir`.
- Remove the old "aren't supported on Antigravity yet" warning.
- `stop(name)` removes `<stateDir>/agy-tools/<name>` (fs.rm with `recursive`, path built only from the managed session name). A machine restart leaves live sessions' dirs alone.
- Non-tool roles (reviewer, mapper, asides, probes) never get `--add-dir` for this dir.

### 5. Connection check (new `machine/lib/project-tools-check.js`)

`checkProjectTools({ worktree, mcp, env, timeoutMs = 10000 })` → `{ results: [{ name, ok, reason }] }`.
- Environment: parse `tmux show-environment -g` (lines `NAME=value`; lines starting `-` remove a name); on failure use `process.env`. Never logged or returned.
- Every valid server, in parallel, each bounded by `timeoutMs`:
  - stdio: spawn `command args` with cwd `worktree`, env = check environment + entry `env` with `${NAME}` / `${NAME:-default}` expanded in memory, own process group, stdout piped, stderr ignored. Send JSON-RPC `initialize` (protocolVersion `2025-06-18`, clientInfo `wheelchair-check`), then `notifications/initialized`, then `tools/list`. Any other request from the server gets a JSON-RPC error `-32601`. ok when `tools/list` returns a result. Kill the group (SIGTERM, SIGKILL after 1 s) when done.
  - http: POST `initialize` to `url` with headers (expanded in memory), `Accept: application/json, text/event-stream`; then `tools/list` with the returned `Mcp-Session-Id` if any. Accept a JSON or SSE body.
  - sse: open GET `url` with `Accept: text/event-stream`; ok when the stream answers 200 within the timeout (no full handshake).
- Plain reasons (never containing variable values or server output):
  - `program not found` (ENOENT), `program could not start` (other spawn error);
  - `exited before answering`, `did not answer within 10 seconds`;
  - `needs login` (HTTP 401/403), `server error <status>`, `could not connect` (network error);
  - `uses a variable that isn't set: NAME` (a `${NAME}` with no value and no default; not launched);
  - `answered, but not as an MCP server` (bad JSON-RPC).
- Server names and reasons are capped at 100 characters each.

### 6. When the check runs (`machine/service.js`)

- Only for tools-getting roles, only when `.mcp.json` has at least one valid server.
- Cache: `<stateDir>/project-tools/<thread_id>.json` = `{ hash, results, at }`, atomic write.
- Run when the hash differs from the cache, or the cache has any non-ok result, or there is no cache. Otherwise reuse the cache and report no fresh check.
- Runs concurrently with the tmux launch in `startIn`; the start answer waits for both. A check that throws is logged and treated as no fresh check.
- Concurrent starts for one thread share one running check (map keyed by thread id).

### 7. What the start answer carries

The machine session gains `project_tools` (stored with the session, so a retried start returns it):
```
{ cli: "codex", file: [lines], cli_lines: [lines], check: null | { at, results: [{name, ok, reason}] } }
```
- `file`: reader lines (could not be read, invalid entries). `cli_lines`: the adapter's skip lines for this CLI. Each line is a plain sentence, e.g. `github: skipped on Codex: uses ${...} Codex cannot pass through`.
- Present only for tools-getting roles. `check` is the cached result even when not fresh, with `fresh: true|false`.
- Machine log lines stay as today.

### 8. Hub (`viewer/app/sessions.js`)

- Thread record gains `project_tools = { file: [], clis: { claude: [], codex: [], agy: [] }, check: [] , check_at }` (check lines are the non-ok results as `<name>: <reason>`).
- `applyProjectTools(thread, started)`: when `started.project_tools` exists, replace `file`, replace `clis[cli]`, and replace `check` when `check.fresh` is true. Then delete `project_tools` from the object merged into the session record, and store the results list on the session as `project_tools_results` for `session list`.
- Card: all lines = file + every CLI's lines + check lines, deduplicated, in that order.
  - Non-empty and different from the open card's lines (or no open card): mark the open `Project tools problem` card answered, add a system `needs` card `{ title: "Project tools problem", body: "Some project tools won't work for agents in this thread:\n• line\n• line…" }` (first 20 lines, then "and N more"), remember its id and lines on `thread.project_tools`.
  - Empty: mark the open card answered.
  - Same lines: leave the card.
- Called after a successful machine answer in `startSession` (covers queued promotion via `retryWaiting`) and in `resumeUnanswered`, before `hub.save`.
- `session list` shows `project_tools_results` (name, ok, reason) on sessions that have it.

### Edge cases

- `.mcp.json` deleted or emptied: no servers, reader `file` empty, `cli_lines` empty → card closes at the next tools-getting start. Cache left as is (hash null differs next time).
- A server fixed outside the file (token exported to tmux): next tools-getting start reruns the check (cache had a failure) and the card closes.
- A tool fine on Claude but skipped on Codex: card keeps the Codex line until a Codex start has no skip lines.
- Retried start returning an existing machine session: carries the stored `project_tools`; applying it twice is harmless.
- The check launches each stdio program once outside any agent; a program with side effects at start runs one extra time per change.
- An sse server is checked only for an open stream.
- Lines never contain variable values, header values or server output.

### Non-goals

- Live watching of `.mcp.json`; checks between starts.
- Fixing tools; editing `.mcp.json`; a settings screen.
- OAuth flows for tools that need login (reported as `needs login`).
- Health checks of the account's own (non-project) tools.

### Validation

- `bash machine/test/run.sh` — new tests:
  - Codex: bearer, env header, literal header, mixed `${}` header skip, sse skip, non-ASCII budget (a server whose quoted overrides are under 64 Ki UTF-16 units but over 64 KiB bytes is dropped).
  - Antigravity: plugin files and `--add-dir` for tool roles; none for reviewer; skip rules; files removed on stop; no old warning.
  - Check: fake stdio servers (ok; ENOENT; exit early; hang → timeout; unset variable; ignores unknown requests); fake HTTP server (ok with session id; 401 → needs login); no variable value in any result.
  - Service: check runs on first start, reuses cache on unchanged hash, reruns after a failure, reruns on hash change; concurrent starts share one check; non-tool roles never check; `project_tools` returned and returned again on a repeated start.
- `node --test viewer/test/*.test.js` — new tests: card opens with lines; same lines no new card; different lines replace; cleared lines close; per-CLI lines kept apart; applied in `startSession`, a queued promotion and `resumeUnanswered`; `project_tools` not left on the session record.
- `node --test test-support/test/*.test.js` still passes.
- Manual (hearth only, costs one model turn): a project with a stdio tool started on Antigravity as a worker can call it; a reviewer on Antigravity in the same thread cannot.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
