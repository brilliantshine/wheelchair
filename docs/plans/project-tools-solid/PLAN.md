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

## Spec

Builds on local-projects (PR #112, `docs/plans/local-projects/PLAN.md`). Everything there stays unless changed here. Reader: `machine/lib/project-mcp.js`; adapters: `machine/adapters/{claude,codex,agy}.js`; start path: `machine/service.js` `startIn` (~606-634); hub start: `viewer/app/sessions.js` `startSession` (~213-350) and `resumeUnanswered` (~185-210).

### 1. Reader (`machine/lib/project-mcp.js`)

- Accept `type: "sse"` (with a non-empty string `url`) as valid. Claude reads `.mcp.json` itself and handles sse; Codex and Antigravity skip it (sections 3, 4).
- `http` and `sse` entries: `headers`, when present, must be an object of string values; otherwise the entry is invalid (existing "not a valid ..." line, text updated to "not a valid stdio, http or sse entry").
- Return also `hash`: SHA-256 hex of the file's bytes (null when there is no file). Unchanged otherwise.

### 2. `${...}` rule (shared by Codex and Antigravity)

- An **env** value passes through when it is exactly `${NAME}` and its key is `NAME` (`[A-Za-z_][A-Za-z0-9_]*`). An env alias (`CHILD: ${PARENT}`) does not pass through.
- A **header** value passes through when it is exactly `${NAME}` (any header name).
- wheelchair never expands a variable into anything it stores or returns: argv, `session.command`, files under the state dir, logs, card text, check results. Only the connection check (section 5) expands, in memory.

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
- Translation: name kept (agy namespaces it `wheelchair-project_<name>`); stdio → `command`, `args`, `env`; http → `url`, `headers`.
- Variables: first, the worker checks whether agy 1.5.11 expands `${NAME}` in `mcp_config.json` (a scratch HOME with the copied login token and a mock server that echoes an env var through a tool, as in the research of 2026-11-18). Record the answer in the Log.
  - If agy expands: copy values unchanged, except skip any value whose `${...}` is not `${NAME}` or `${NAME:-default}`.
  - If not: an env value that passes through (same key, section 2) is omitted, so the server inherits it from agy's environment. Any other `${...}` in command, args, env, url or headers skips the server: "uses ${...} that Antigravity cannot pass through".
- Skips: `type: "sse"` ("uses sse, which Antigravity does not support here"); names not matching `[A-Za-z0-9_-]+` (same text as Codex); the same header twice ignoring case.
- If every server is skipped: no plugin dir and no `--add-dir`.
- Remove the old "aren't supported on Antigravity yet" warning.
- Non-tool roles (reviewer, mapper, asides, probes) never get `--add-dir` for this dir.
- Cleanup, by `sweepAgyTools()` in `machine/service.js`: removes `<stateDir>/agy-tools/<name>` for every `<name>` that is neither a live tmux session (`liveTmux()`) nor currently starting (`startingNames`). If `liveTmux()` returns null (unknown), removes nothing. Called after `stop(name)`, after a start that fails or is cancelled, and wherever the service already reconciles live sessions at startup. The removal path is built only from directory entries of `<stateDir>/agy-tools` matching the session-name pattern, never from input.

### 5. Connection check (new `machine/lib/project-tools-check.js`)

`checkProjectTools({ worktree, mcp, env, timeoutMs = 10000 })` → `[{ name, ok, reason, login }]`.
- Checks every valid server in the file, whatever each CLI later does with it; a server Codex or Antigravity skips is still checked, and its skip line says why that CLI won't have it. It runs as the machine user with cwd `worktree`, as an agent's CLI would.
- Environment: parse `tmux show-environment -g` (`NAME=value`; a line `-NAME` removes it); on failure use `process.env`. Never logged or returned.
- All servers in parallel, each bounded by `timeoutMs`. `${NAME}` and `${NAME:-default}` in command, args, env, url and headers are expanded in memory from that environment; any other `${...}` form → reason `uses a variable form wheelchair can't check`, not launched.
- Handshake (MCP 2025-06-18), same for stdio and http:
  1. `initialize` with `protocolVersion: "2025-06-18"`, `capabilities: {}`, `clientInfo: {name: "wheelchair-check", version: "1"}`. Valid answer: a `result` with string `protocolVersion` and object `capabilities`.
  2. `notifications/initialized`.
  3. `tools/list`. Valid answer: a `result` whose `tools` is an array. ok, with `tools` count.
  - A request from the server gets a JSON-RPC error `-32601`. A notification is ignored.
- stdio: spawn in its own process group, stdin/stdout piped, stderr ignored, newline-delimited JSON. Kill the group (SIGTERM, SIGKILL after 1 s) when done.
- http: each message is a POST to `url` with the configured headers (expanded), `Content-Type: application/json`, `Accept: application/json, text/event-stream`. After `initialize`, send `MCP-Session-Id` if the answer had one and `MCP-Protocol-Version: <negotiated version>` on every later request. Bodies are JSON or SSE (`data:` lines holding the JSON-RPC answer). `notifications/initialized` expects 202 or 200. A session id is closed with a DELETE afterwards, errors ignored.
- sse: GET `url` with the configured headers and `Accept: text/event-stream`. ok when the answer is 200 with content type `text/event-stream` and an `endpoint` event arrives within the timeout. No full handshake.
- Reasons (fixed text; never variable values, header values, server output or exception messages):
  `program not found` (ENOENT), `program could not start`, `exited before answering`, `did not answer within 10 seconds`, `needs login` (HTTP 401/403), `server error <status>`, `could not connect`, `uses a variable that isn't set: NAME`, `answered, but not as an MCP server`.
- `login: true` on a `needs login` result when the server's config has no `Authorization` header and no header with `${...}` in it: the tool expects a login that a CLI keeps itself (OAuth). Such a result is information, not a problem (section 8).
- Exceptions inside the check are logged with fixed text plus the server name only.

### 6. When the check runs (`machine/service.js`)

- Only for tools-getting starts in the thread's own worktree (the one on branch `wc/<thread_id>`): lead, sub-lead, and verifiers or workers only if their worktree is that one. Starts in other worktrees get CLI lines but no check.
- Cache: `<stateDir>/project-tools/<thread_id>.json` = `{ worktree, hash, results, seq, at }`, atomic write.
- Run when there is no cache, the cache's `worktree` or `hash` differs, or a result is a problem (not ok and not `login`).
- The check never delays the start: it starts after the session is registered and runs in the background. One running check per (thread, worktree, hash); a start that finds one running joins it rather than starting another.
- When it finishes: `seq` = cache `seq` + 1, write the cache, then `emitEvent({ type: "project-tools-check", thread_id, session: <starting session name>, seq, results, delivery_id: "project-tools-<thread_id>-<seq>" })` through the existing spool, so it survives a hub outage.
- A check that throws is logged and leaves the cache unchanged.

### 7. What the start answer carries

Computed before the session is registered (`this.sessions[name] = session`), so a retried start that returns the registered session carries it too:
```
session.project_tools = { cli: "codex", reset: false, file: [lines], cli_lines: [lines] }
```
- `file`: reader lines (could not be read, invalid entries). `cli_lines`: this adapter's skip lines. Plain sentences, e.g. `github: skipped on Codex: uses ${...} Codex cannot pass through`.
- `reset: true` when the reader confirmed there are no tools: no `.mcp.json`, or a valid file whose `mcpServers` is empty. A read failure or invalid file is never a reset.
- Present only for tools-getting roles. Machine log lines stay as today.

### 8. Hub (`viewer/app/sessions.js`)

- Thread record gains `project_tools = { file: [], clis: { claude: [], codex: [], agy: [] }, check: { seq: 0, results: [] }, card: null, card_names: [] }`.
- `applyProjectTools(thread, started)` after a successful machine answer in `startSession` (covers queued promotion via `retryWaiting`) and in `resumeUnanswered`, before `hub.save`: when `started.project_tools` exists, `reset: true` clears `file`, every CLI's lines and `check.results` (keeps `seq`); otherwise replace `file` and `clis[cli]`. Delete `project_tools` from the object merged into the session record. Then reconcile the card.
- Event `project-tools-check` (in `event`, by `thread_id`, needs no live target session; delivery ids already dedupe): apply only if `seq` > stored `check.seq`; then store `seq` and `results`, and reconcile the card.
- Card reconcile:
  - Problem lines = `file` lines + each CLI's lines + `<name>: <reason>` for each check result that is not ok and not `login`, deduplicated, in that order.
  - Card identity is the sorted set of server names (plus `file` for reader lines) in the problem lines, not the reason text.
  - Lines present and identity differs from `card_names` (or no open card): mark the open card answered, add a system `needs` card `{ title: "Project tools problem", body }`, store its id and names. Body: "Some project tools won't work for agents in this thread:" then `• line` per line (first 20, then "and N more"), then, when any check result is ok, "Working: a, b, c", and, when any is `login`, "Needs a login inside the agent's CLI (not checked): x".
  - Same identity: leave the card.
  - No lines: mark the open card answered.
- `session list`: the hub adds `project_tools: { checked_at, results: [{name, ok, reason}] }` (from `thread.project_tools.check`) to the thread's lead session entry, and `viewer/app/wc.js`'s compact field allowlist keeps `project_tools`, so the default `wc.js session list` shows it.

### Edge cases

- `.mcp.json` deleted or emptied: the next tools-getting start in any worktree sends `reset: true`; the card closes.
- A token exported to tmux after a failure: the next start in the thread's worktree reruns the check in the background; the card closes when its event arrives.
- A tool fine on Claude but skipped on Codex: the Codex line stays until a Codex start has no skip lines or a reset.
- A replayed or late check event with an older `seq` is ignored.
- A retried start returns the registered session with the same `project_tools`; applying it again changes nothing.
- The check launches each stdio program once outside any agent; a program with side effects runs one extra time per check.
- Lines and results never contain variable values, header values or server output.

### Non-goals

- Live watching of `.mcp.json`; checks between starts; checks in worker-only worktrees.
- Codex or Antigravity support for `${...}` forms beyond section 2 (`${NAME:-default}`, aliases, `${}` in args or url): Codex has no way to take them without wheelchair storing the expanded value. They stay skipped, with a line on the card.
- Fixing tools; editing `.mcp.json`; a settings screen.
- OAuth flows for tools that need login.
- Health checks of the account's own (non-project) tools.

### Validation

- `bash machine/test/run.sh`, new tests:
  - Codex: bearer, env header, literal header (real in argv, `<redacted>` in `session.command`), mixed `${}` header skip, duplicate header skip, sse skip, non-ASCII budget (under 64 Ki UTF-16 units, over 64 KiB bytes → dropped).
  - Antigravity: plugin files and `--add-dir` for tool roles, none for reviewer; skip rules incl. env alias; sweep removes dirs of sessions not live, keeps live and starting ones, removes nothing when tmux state is unknown; no old warning.
  - Check: fake stdio servers (ok with tools array; ENOENT; exit early; hang → timeout; result without `tools` array → not MCP; server request answered `-32601`; unset variable); fake HTTP server (ok with session id and protocol header asserted on later requests; 401 → needs login, `login: true` only without auth headers); fake SSE server (endpoint event → ok; HTML 200 → not ok); no variable value in any result or log line.
  - Service: check runs after registration and does not delay the start answer; cache reuse on same worktree and hash; rerun after a problem; no rerun for `login`-only results; rerun on hash or worktree change; one check per (thread, worktree, hash); no check in other worktrees or for non-tool roles; event emitted with increasing `seq`; `project_tools` present on a repeated start.
- `node --test viewer/test/*.test.js`, new tests: card opens; same names with different reasons keep the card; different names replace it; reset closes it; per-CLI lines kept apart; older `seq` ignored; `login` results not problems; applied in `startSession`, a queued promotion and `resumeUnanswered`; `project_tools` not left on the session record; default `wc.js session list` shows `project_tools`.
- `node --test test-support/test/*.test.js` still passes.
- Manual (hearth only, one model turn): an Antigravity worker in a project with a stdio tool can call it; an Antigravity reviewer in the same thread cannot.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|
| The check and an agent's CLI can run the same stdio server at once; a server holding an exclusive resource (fixed port) may fail in one of them | Several agents in one thread already run their own copies at once; such a server is broken for wheelchair regardless of the check | review-round-1 |
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
