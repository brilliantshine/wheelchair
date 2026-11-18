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
| 11 | Supersedes 7 for headers: literal header values are copied into what the CLI gets but redacted in `session.command`; reader/check exceptions are never echoed | IDEA constraint: no secrets in stored session data; the worktree file may be uncommitted | review-round-1 |
| 12 | Supersedes 9's timing: the check runs in the background after the start and reports through the machine event spool with an increasing `seq`; the start never waits | A hanging tool must not slow later starts; ordering by `seq` makes replays harmless | review-round-1 |
| 13 | The check runs only in the thread's own worktree; a confirmed empty or missing `.mcp.json` resets every line | One checkout owns the result; deleting the file must close the card | review-round-1 |
| 14 | `needs login` on a server with no configured auth header is shown as information ("needs a login inside the agent's CLI"), never a problem | Such a tool can work for Claude after an OAuth login wheelchair cannot see | review-round-1 |
| 15 | The card's identity is the set of affected tools, not the reason text; it lists working tools too; `session list` shows the last check by default | One card per set of problems; the lead can answer "did it connect" | review-round-1 |
| 16 | Antigravity variable rules are fixed by research, not left to the worker: agy expands nothing in plugin config and stdio servers inherit its environment | Verified 2026-11-18 on agy 1.5.11 | review-round-2 |
| 17 | Supersedes 12's ordering: check state per thread carries a generation bumped at each qualifying start under a per-thread serial queue; only the current generation publishes; publication is spooled before it is marked done and republished after a restart; agents cannot send the event | Rounds 2 findings on races, restart and spoofing | review-round-2 |
| 18 | Antigravity http header tokens are expanded into the agent's private plugin file (owner-only, deleted when the agent ends); IDEA's no-secrets constraint gains this one exception | Collin's pick "Write it, privately": otherwise token web tools never work on Antigravity | user |
| 19 | Decision 18 covers every `${NAME}` / `${NAME:-default}` in an Antigravity agent's private file (env aliases, args, url, headers), not only headers | Same reason as Collin's pick: Antigravity cannot rename or read a variable itself; the file is the private exception either way | review-round-3 |
| 20 | Supersedes 17: no event. The hub pulls check results from a hub-only machine route, by generation; only starts in the thread's own worktree (by path) touch check state or the hub's lines | Removes spoofing, spool replay and restart recovery problems; one checkout owns the result | review-round-3 |

## Spec

Builds on local-projects (PR #112, `docs/plans/local-projects/PLAN.md`). Everything there stays unless changed here. Reader: `machine/lib/project-mcp.js`; adapters: `machine/adapters/{claude,codex,agy}.js`; start path: `machine/service.js` `startIn` (~606-634); hub start: `viewer/app/sessions.js` `startSession` (~213-350) and `resumeUnanswered` (~185-210).

### 1. Reader (`machine/lib/project-mcp.js`)

- Accept `type: "sse"` (with a non-empty string `url`) as valid. Claude reads `.mcp.json` itself and handles sse; Codex and Antigravity skip it (sections 3, 4).
- `http` and `sse` entries: `headers`, when present, must be an object of string values; otherwise the entry is invalid (existing "not a valid ..." line, text updated to "not a valid stdio, http or sse entry").
- Return also `hash`: SHA-256 hex of the file's bytes (null when there is no file). Unchanged otherwise.

### 2. `${...}` rule (shared by Codex and Antigravity)

- An **env** value passes through when it is exactly `${NAME}` and its key is `NAME` (`[A-Za-z_][A-Za-z0-9_]*`). An env alias (`CHILD: ${PARENT}`) does not pass through.
- A **header** value passes through when it is exactly `${NAME}` (any header name).
- wheelchair never expands a variable into anything it stores or returns: argv, `session.command`, files under the state dir, logs, card text, check results. Two places expand: the connection check (section 5), in memory; and an Antigravity agent's private plugin file (section 4, Decision 18), the one file allowed to hold expanded values.

### 3. Codex (`machine/adapters/codex.js` `command`)

For each tools-getting server, in addition to today's rules:
- `type: "sse"` → skip: "uses sse, which Codex does not support".
- Two header names that are equal ignoring case → skip: "has the same header twice".
- `http` with `headers`, for each header:
  - name `Authorization` (any case) with value exactly `Bearer ${NAME}` (`Bearer` case-sensitive, one space) → `bearer_token_env_var="NAME"`;
  - value passes through (section 2) → entry in `env_http_headers={"<Header>"="NAME"}`;
  - value contains no `${` → entry in `http_headers={"<Header>"="<value>"}`;
  - anything else → skip: "a header uses ${...} that Codex cannot pass through".
  - Header names are TOML-quoted with `tomlString`. Emit `http_headers` / `env_http_headers` only when non-empty. Never emit `bearer_token`.
- `command` returns, besides `argv`, `redactions`: the argv indexes holding `http_headers` overrides. `startIn` stores `session.command` as argv with each such element's value replaced by `mcp_servers.project_<name>.http_headers=<redacted>`; tmux gets the real argv.
- Budget: `quotedLength` measures `Buffer.byteLength(..., 'utf8')`; budget stays 64 KiB, still dropped as a whole with the same line.

### 4. Antigravity (`machine/adapters/agy.js` `command`)

For a tools-getting session with servers:
- Plugin dir: `<stateDir>/agy-tools/<session name>/.agents/plugins/wheelchair-project/`, directories mode 0700, holding `plugin.json` = `{"name":"wheelchair-project","version":"1"}` and `mcp_config.json` = `{"mcpServers":{...}}`, files mode 0600, written atomically. argv gains `--add-dir <stateDir>/agy-tools/<session name>`.
- `command` returns the files to write (like `settingsPath`/`settings`); `startIn` writes them before tmux starts. No writes inside `command`.
- Translation: name kept (agy namespaces it `wheelchair-project_<name>`); stdio → `{command, args, env}`; http → `{type: "http", url, headers}` (`type` is required: verified format).
- Variables (verified 2026-11-18 on agy 1.5.11: plugin `mcp_config.json` expands nothing — not env, args, url or headers; stdio servers inherit agy's whole environment). Because the file is private (Decision 18), wheelchair expands for agy:
  - Every `${NAME}` and `${NAME:-default}` in command, args, env, url and headers is expanded when the file is written, from the same environment the check uses (section 5: tmux global environment, else `process.env`).
  - An unset `${NAME}` with no default skips the server: "uses a variable that isn't set: NAME". Any other `${...}` form skips the server: "uses ${...} that Antigravity cannot pass through".
  - Literal values are copied as is.
  - The expanded file is the private per-session file above (0600, in 0700 dirs), deleted by `sweepAgyTools` when the session ends. Expanded values never reach `session.command`, logs, lines or the card.
- Skips: `type: "sse"` ("uses sse, which Antigravity does not support here"); names not matching `[A-Za-z0-9_-]+` (same text as Codex); the same header twice ignoring case.
- If every server is skipped: no plugin dir and no `--add-dir`.
- Remove the old "aren't supported on Antigravity yet" warning.
- Non-tool roles (reviewer, mapper, asides, probes) never get `--add-dir` for this dir.
- Cleanup, by `sweepAgyTools()` in `machine/service.js`: removes `<stateDir>/agy-tools/<name>` for every `<name>` that is neither a live tmux session (`liveTmux()`) nor currently starting (`startingNames`). If `liveTmux()` returns null (unknown), removes nothing. Called after `stop(name)`, from `start()`'s `finally` after the name leaves `startingNames` (covers failed and cancelled starts), at service startup, and every 60 seconds on a timer like the others at `machine/service.js:366-372` (covers panes that exit on their own and handoff kills). The removal path is built only from directory entries of `<stateDir>/agy-tools` matching the session-name pattern, never from input.

### 5. Connection check (new `machine/lib/project-tools-check.js`)

`checkProjectTools({ worktree, mcp, env, timeoutMs = 10000 })` → `[{ name, ok, reason, login }]`.
- Checks every valid server in the file, whatever each CLI later does with it; a server Codex or Antigravity skips is still checked, and its skip line says why that CLI won't have it. It runs as the machine user with cwd `worktree`, as an agent's CLI would.
- Environment: parse `tmux show-environment -g` (`NAME=value`; a line `-NAME` removes it); on failure use `process.env`. Never logged or returned.
- All servers in parallel, each bounded by `timeoutMs`. `${NAME}` and `${NAME:-default}` in command, args, env, url and headers are expanded in memory from that environment; any other `${...}` form → reason `uses a variable form wheelchair can't check`, not launched.
- Handshake (MCP 2025-06-18), same for stdio and http:
  1. `initialize` with `protocolVersion: "2025-06-18"`, `capabilities: {}`, `clientInfo: {name: "wheelchair-check", version: "1"}`. Valid answer: a `result` with string `protocolVersion` and object `capabilities`.
  2. `notifications/initialized`.
  3. `tools/list`. Valid answer: a `result` whose `tools` is an array. ok, with `tools` count.
  - Requests carry ids 1, 2. An answer counts only when its `id` matches the pending request; other messages are handled by kind: a server request `ping` gets an empty `result`; any other server request gets error `-32601`; notifications and unmatched answers are ignored.
  - A JSON-RPC `error` answer to `initialize` or `tools/list` → `answered, but not as an MCP server`.
- stdio: spawn in its own process group, stdin/stdout piped, stderr ignored, newline-delimited JSON. Kill the group (SIGTERM, SIGKILL after 1 s) when done.
- http: each message is a POST to `url` with the configured headers (expanded), `Content-Type: application/json`, `Accept: application/json, text/event-stream`. After `initialize`, send `MCP-Session-Id` if the answer had one and `MCP-Protocol-Version: <negotiated version>` on every later request. Bodies are JSON or SSE (`data:` lines holding the JSON-RPC answer). `notifications/initialized` expects 202 or 200. A session id is closed with a DELETE afterwards, errors ignored.
- Redirects are never followed (`redirect: "manual"`); a 3xx → `server error <status>`.
- sse (legacy 2024-11-05 transport): GET `url` with the configured headers and `Accept: text/event-stream`; require 200, content type `text/event-stream` and an `endpoint` event. Resolve its data against `url`; an endpoint on a different origin (scheme, host, port) → `answered, but not as an MCP server`, and nothing is sent to it; then run the same three-step handshake by POSTing each message to that endpoint with the configured headers (expect 2xx) and reading answers from the stream. ok only when `tools/list` answers. Close the stream after.
- Reasons (fixed text; never variable values, header values, server output or exception messages):
  `program not found` (ENOENT), `program could not start`, `exited before answering`, `did not answer within 10 seconds`, `needs login` (HTTP 401/403), `server error <status>`, `could not connect`, `uses a variable that isn't set: NAME`, `answered, but not as an MCP server`.
- `login: true` on a `needs login` result when the server's config has no `Authorization` header and no header with `${...}` in it: the tool expects a login that a CLI keeps itself (OAuth). Such a result is information, not a problem (section 8).
- Exceptions inside the check are logged with fixed text plus the server name only.

### 6. When the check runs (`machine/service.js`)

- **Thread worktree:** a start is in the thread's worktree when `realpath(worktree)` equals `realpath(<stateDir>/worktrees/<project>/wc/<thread_id>)` (the path `createWorktree` gives the thread branch; `machine/service.js:490-492`). A verifier's own checkout and workers' checkouts never match.
- Only tools-getting starts in the thread's worktree touch check state. Other starts get CLI lines for the machine log only (section 7).
- State, per thread, in memory and in `<stateDir>/project-tools/<thread_id>.json` (atomic write): `{ generation, worktree, hash, running, result: null | { generation, at, results } }`.
- All state changes for a thread go through one serial queue (a promise chain keyed by thread id).
- At a qualifying start, after the session is registered, in the queue:
  - Reader confirmed no tools (`reset`, section 7): `generation` += 1; `result = { generation, at: now, results: [] }`; `hash = null`; nothing runs.
  - Reader failed (`mcp: null` and not a reset): nothing changes; the reader's line shows the problem.
  - A check is running for the same `worktree` and `hash`: join it (nothing changes).
  - Else, when there is no result, or `worktree` or `hash` differs, or a result is a problem (not ok and not `login`): `generation` += 1, record `worktree`, `hash`, `running: true`, and start a check in the background tagged with that generation. A check for an older generation still running is left to finish and its result discarded.
  - Else nothing.
- On completion, in the queue: if its generation is still current, `result = { generation, at: now, results }`, `running: false`; else discard. A check that throws sets `running: false` for its generation and logs fixed text.
- At service startup, every state file with `running: true` is set to `running: false` (the check died with the service); the next qualifying start reruns it.
- New machine route `GET /v1/project-tools/<thread_id>`, authorized for the hub only (`this.authorize(request, 'hub')`, as `/v1/preflight` at `machine/service.js:1494`): answers `{ generation, running, result }`, or `{ generation: 0, running: false, result: null }` when there is no state. Agents cannot write check results: there is no write route and no event.
- The start answer carries the state's `generation` after the step above, as `project_tools.check_generation` (section 7).
- The check never delays the start answer.

### 7. What the start answer carries

Computed before the session is registered (`this.sessions[name] = session`), so a retried start that returns the registered session carries it too:
```
session.project_tools = { cli: "codex", reset: false, file: [lines], cli_lines: [lines], check_generation: 3 }
```
- `file`: reader lines (could not be read, invalid entries). `cli_lines`: this adapter's skip lines. Plain sentences, e.g. `github: skipped on Codex: uses ${...} Codex cannot pass through`.
- `reset: true` when the reader confirmed there are no tools (no `.mcp.json`, or a valid file whose `mcpServers` is empty) and the start is in the thread's own worktree. A read failure, an invalid file or another worktree is never a reset.
- Present only for tools-getting starts in the thread's worktree (section 6). Other starts carry none; their lines still go to the machine log as today.

### 8. Hub (`viewer/app/sessions.js`)

- Thread record gains `project_tools = { file: [], clis: { claude: [], codex: [], agy: [] }, check: { generation: 0, at: null, results: [] }, pending: 0, card: null, card_names: [] }`.
- `applyProjectTools(thread, started)` after a successful machine answer in `startSession` (covers queued promotion via `retryWaiting`) and in `resumeUnanswered`, before `hub.save`. When `started.project_tools` exists: `reset: true` clears `file` and every CLI's lines; otherwise replace `file` and `clis[cli]`. Set `pending = max(pending, check_generation)` when `check_generation` > `check.generation`. Delete `project_tools` from the object merged into the session record. Reconcile the card.
- Pull: on the hub's existing 60-second timer (`viewer/app/hub.js:89`), and once 15 seconds after any start that set `pending`, for each thread with `pending` > `check.generation`, call `GET /v1/project-tools/<thread_id>` on the thread's machine. If `result.generation` > `check.generation`, store `check = result` and reconcile. Then, if `running` is false and `result` (or 0) is older than `pending`, set `pending = check.generation` (the check died; the next start reruns it). Errors leave `pending` for the next tick. Runs inside `hub.withThread`.
- Card reconcile:
  - Problem lines = `file` lines + each CLI's lines + `<name>: <reason>` for each check result that is not ok and not `login`, deduplicated, in that order.
  - Card identity is the sorted set of server names (plus `file` for reader lines) in the problem lines, not the reason text.
  - Lines present and identity differs from `card_names` (or no open card): mark the open card answered, add a system `needs` card `{ title: "Project tools problem", body }`, store its id and names. Body: "Some project tools won't work for agents in this thread:" then `• line` per line (first 20, then "and N more"), then, when any check result is ok, "Connects: a, b (not on Codex), c", where "(not on <CLI>)" marks a tool that some CLI's lines say it skips, and, when any is `login`, "Needs a login inside the agent's CLI (not checked): x".
  - Same identity: keep the card and its id; update its body in place if it changed.
  - No lines: mark the open card answered.
- `session list`: the hub adds `project_tools: { checked_at, results: [{name, ok, reason}], skipped: {<cli>: [lines]} }` (`checked_at` = `check.at`, the machine's completion or reset time; null before any check) to the thread's lead session entry, and `viewer/app/wc.js`'s compact field allowlist keeps `project_tools`, so the default `wc.js session list` shows it.

### Edge cases

- `.mcp.json` deleted or emptied: the next tools-getting start in the thread's own worktree resets; the card closes. Starts in other checkouts never change the thread's lines.
- `.mcp.json` unreadable or invalid: its line shows on the card; earlier check results stay until the file is fixed (hash changes → new check).
- A token exported to tmux after a failure: the next start in the thread's worktree reruns the check in the background; the card closes when the hub pulls the result.
- A tool fine on Claude but skipped on Codex: the Codex line stays until a Codex start has no skip lines or a reset.
- A result for a superseded generation is discarded on the machine; the hub only takes a higher generation.
- A retried start returns the registered session with the same `project_tools`; applying it again changes nothing.
- The check launches each stdio program once outside any agent; a program with side effects runs one extra time per check.
- Lines and results never contain variable values, header values or server output.

### Non-goals

- Live watching of `.mcp.json`; checks between starts; checks in worker-only worktrees.
- On Codex, `${...}` forms beyond section 2 (`${NAME:-default}`, env aliases, `${}` in command, args or url): Codex does not expand them and wheelchair will not put expanded values in its argv. They stay skipped, with a line on the card. (Antigravity handles them through its private file, section 4.)
- Fixing tools; editing `.mcp.json`; a settings screen.
- OAuth flows for tools that need login.
- Health checks of the account's own (non-project) tools.

### Validation

- `bash machine/test/run.sh`, new tests:
  - Codex: bearer, env header, literal header (real in argv, `<redacted>` in `session.command`), mixed `${}` header skip, duplicate header skip, sse skip, non-ASCII budget (under 64 Ki UTF-16 units, over 64 KiB bytes → dropped).
  - Antigravity: plugin files and `--add-dir` for tool roles, none for reviewer; http entry written with `type: "http"`; `${NAME}` and `${NAME:-default}` expanded in env, args, url and headers from a fake tmux environment; unset variable → skip line naming only the variable; other forms skip; files 0600 and dirs 0700; the expanded value absent from `session.command`, the log, `cli_lines` and `project_tools`; sweep deletes the expanded file; sweep removes dirs of sessions not live, keeps live and starting ones, removes nothing when tmux state is unknown; no old warning.
  - Check: no redirect followed; SSE endpoint on another origin refused with nothing sent; `ping` from server answered; mismatched ids ignored; legacy SSE full handshake via endpoint (endpoint POST 401 → needs login); fake stdio servers (ok with tools array; ENOENT; exit early; hang → timeout; result without `tools` array → not MCP; server request answered `-32601`; unset variable); fake HTTP server (ok with session id and protocol header asserted on later requests; 401 → needs login, `login: true` only without auth headers); fake SSE server (endpoint event → ok; HTML 200 → not ok); no variable value in any result or log line.
  - Service: thread-worktree gate by path (a verifier checkout on the same branch does not qualify); generation ordering (a slow older check is discarded after a newer start); an identical start joins the running check; `running` cleared at startup; `GET /v1/project-tools/<id>` refuses agent tokens; reset only from the thread's worktree; failed read changes no state; sweep timer removes a dir after its pane exits; check runs after registration and does not delay the start answer; cache reuse on same worktree and hash; rerun after a problem; no rerun for `login`-only results; rerun on hash or worktree change; one check per (thread, worktree, hash); no check in other worktrees or for non-tool roles; `project_tools` present on a repeated start.
- `node --test viewer/test/*.test.js`, new tests: card opens; same names with different reasons keep the card and update its body; different names replace it; reset closes it; per-CLI lines kept apart; older generation ignored; pull after `pending` applies a newer result and drops `pending` when the machine says nothing runs; starts in other checkouts ignored; `login` results not problems; applied in `startSession`, a queued promotion and `resumeUnanswered`; `project_tools` not left on the session record; default `wc.js session list` shows `project_tools`.
- `node --test test-support/test/*.test.js` still passes.
- Manual (hearth only, one model turn): an Antigravity worker in a project with a stdio tool can call it; an Antigravity reviewer in the same thread cannot.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|
| The check and an agent's CLI can run the same stdio server at once; a server holding an exclusive resource (fixed port) may fail in one of them | Several agents in one thread already run their own copies at once; such a server is broken for wheelchair regardless of the check | review-round-1 |
| An Antigravity skip line for an unset variable stays on the card after Collin sets it, until the next Antigravity start in the thread's worktree | The check line clears sooner; a CLI's lines can only change when that CLI starts | review-round-3 |
| A tool that needs an OAuth login (`login` result) is never on a card by itself; a Codex or Antigravity agent without that CLI's login silently lacks it | wheelchair cannot see CLI logins; the default `session list` shows it, and Collin logs in per CLI | review-round-2 |
| `--add-dir` makes the per-session plugin dir part of an Antigravity agent's workspace, so the agent could edit its own `mcp_config.json` | The agent already has a shell and can launch any program; the dir is its own and removed when it ends | review-round-1 |

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | OAuth tools give a false card that never clears | upheld | §5 `login`, §8; Decision 14 |
| intent | major | "Which tools connected" not visible; compact `session list` drops it | upheld | §8 card "Working:" line, wc.js allowlist; Decision 15 |
| intent | minor | Other `${}` forms on Codex neither fixed nor listed as non-goal | upheld | Non-goals |
| intent | minor | Changing reasons stack new cards | upheld | §8 identity by tool names |
| intent | minor | Hanging tool slows every later start | upheld | §6 background check; Decision 12 |
| intent | minor | `--add-dir` makes plugin dir agent-editable | accepted-risk | Accepted Risks |
| mechanics | blocking | Deleting `.mcp.json` leaves stale lines | upheld | §7 `reset`, §8 |
| mechanics | blocking | Cache can report another checkout's result | upheld | §6 thread worktree only, key by (worktree, hash); Decision 13 |
| mechanics | blocking | Replayed `fresh` result overwrites newer | upheld | §6 `seq` event, §8 older ignored |
| mechanics | blocking | HTTP handshake incomplete; stdio accepts any result | upheld | §5 handshake |
| mechanics | blocking | SSE check ignores headers; any 200 passes | upheld | §5 sse |
| mechanics | blocking | Literal auth headers stored in `session.command`; exceptions leak values | upheld | §3 redaction, §5 fixed reasons; Decision 11 |
| mechanics | blocking | Antigravity fallback drops env aliases | upheld | §2 same-key rule, §4 |
| mechanics | major | Registration ordering vs probe results on retry | upheld | §7 computed before registration; check moved to event |
| mechanics | major | Check and CLI launch same server at once | accepted-risk (minor) | Accepted Risks: multiple agents already run copies concurrently |
| mechanics | major | Check runs entries a CLI skips; labeling unclear | downgraded (minor) | The same entries run under Claude agents anyway; §5 now states scope and labeling |
| mechanics | major | Duplicate Authorization header case | upheld | §3/§4 skip duplicate headers |
| mechanics | major | Agy plugin cleanup only on stop; unsafe on failed kill | upheld | §4 `sweepAgyTools` |
| mechanics | minor | wc.js compact allowlist | upheld | §8 (merged with intent 2) |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** §2 same-key env rule; §3 duplicate headers, `session.command` redaction; §4 variable rules, `sweepAgyTools` cleanup; §5 scope, full MCP handshake, SSE endpoint check, fixed reasons, `login` flag; §6 thread-worktree only, background check, `seq` event; §7 computed before registration, `reset`; §8 reset, `seq` ordering, card identity by tool names, "Working" and login lines, `session list` default output; Non-goals; Accepted Risks; Decisions 11-15.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Non-goals contradict §4's agy branch | upheld | §4 fixed by research; Non-goals; Decision 16 |
| intent | major | agy drops `${NAME}` token headers; env inheritance unverified | user-decision | Inheritance verified; Collin chose to write tokens into the private per-agent file (Decision 18) |
| intent | minor | Worker-checkout reset clears the thread's check | upheld | §6/§7 reset only from thread worktree |
| intent | minor | `login`-only tools never shown on a card | accepted-risk | Accepted Risks |
| intent | minor | "Working" contradicts per-CLI skip lines | upheld | §8 "Connects: … (not on Codex)" |
| mechanics | blocking | Older check can overwrite newer; `seq` race | upheld | §6 generation + serial queue; Decision 17 |
| mechanics | blocking | Worker reset erases thread results | upheld | §6/§7 (same as intent 3) |
| mechanics | blocking | Restart between cache and spool strands card | upheld | §6 `published` flag, republish |
| mechanics | blocking | Agents could spoof the check event | upheld | §6 forwarder drops it; §8 |
| mechanics | major | agy positive branch contradicts non-goals | upheld | §4 fixed by research |
| mechanics | major | `ping` and response id matching | upheld | §5 |
| mechanics | major | Legacy SSE reports success on endpoint only | upheld | §5 full handshake over endpoint |
| mechanics | major | Cleanup misses natural exits and handoff kills | upheld | §4 timer sweep, `finally` |
| mechanics | major | Same-identity card body goes stale | upheld | §8 update in place |
| mechanics | minor | `checked_at` undefined | upheld | §8, §6 `at` |

### Round 3 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** §4 Antigravity variable rules (fixed by research) and header token expansion into the private file (Decision 18), timer and `finally` cleanup; §5 id matching, `ping`, legacy SSE full handshake; §6 rewritten (generation, per-thread serial queue, `published` flag and republish, forwarder drops agent-sent check events, reset only from the thread worktree); §7 reset scope; §8 `check.at`, body updated in place, "Connects … (not on <CLI>)", `session list` `skipped`; Non-goals; Accepted Risks (login-only tools); Decisions 16-18; IDEA.md Constraints exception.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | §2 and Non-goals contradict Decision 18 | upheld | §2 exception; Non-goals narrowed to Codex |
| intent | major | agy http entries miss `type` | upheld | §4 `type: "http"` |
| intent | major | No validation of the secret file exception | upheld | Validation, Antigravity |
| intent | minor | agy env aliases still skipped though the file is private | upheld | §4 expands everywhere; Decision 19 |
| intent | minor | agy unset-variable line outlives the fix | accepted-risk | Accepted Risks |
| mechanics | blocking | agy http `type` missing | upheld | §4 (same as intent 2) |
| mechanics | blocking | Publisher event blocked by hook route / missing session | upheld | Event removed; hub pull (Decision 20) |
| mechanics | blocking | Hook spool trust boundary | upheld | Event removed; hub-only route (Decision 20) |
| mechanics | blocking | SSE endpoint origin and redirects | upheld | §5 same-origin, no redirects |
| mechanics | major | Restart replay under wrong sequence | upheld | Event removed; `running` cleared at startup |
| mechanics | major | Overlapping starts for same hash | upheld | §6 join running check |
| mechanics | major | Thread-worktree identity | upheld | §6 by path |
| mechanics | major | Worker checkout clears thread lines | upheld | §7/§8 only thread worktree counts |
| mechanics | major | Failed read has no check transition | upheld | §6 failed read changes nothing |
| mechanics | minor | §2 exception and auth fixture | upheld | §2, Validation |

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
