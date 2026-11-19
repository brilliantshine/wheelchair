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
| 21 | Supersedes 20 where they differ: the machine owns one ordered state per thread (lines and check); the hub pulls it by `seq`; start answers carry none. Any tools-getting start in the thread sets its CLI's lines and may run the check; only thread-worktree starts set `file` or reset | Workers are where Codex and Antigravity run; pulling an ordered state removes snapshot-ordering and hub-restart gaps | review-round-4 |
| 22 | The check is keyed by the file's hash only; any checkout with the same file reuses it | Honours Decision 2 ("once per change"); avoids rerunning tools on every worker start | review-round-5 |
| 23 | A server that rejects the 2025-06-18 handshake is "not checked", not a problem | Antigravity's newer client may reach servers the check cannot; avoid false cards | review-round-5 |
| 24 | Supersedes 12, 17, 20, 21 where they differ: the check runs during the agent start (bounded ~11 s, only after a change or while a tool has a problem) and its result returns with the start answer as a whole-state snapshot ordered by `seq`. No background check, no hub pulling, no new route | Collin's pick after three review rounds kept finding race and recovery problems in the background design | user |
| 25 | The check runs before the tmux launch, not alongside it; starts queued behind a check that began after they arrived reuse its result even with problems | Nothing to roll back on cancel, restart or write failure; a burst of starts never runs a hanging check more than once | review-round-6 |
| 26 | Supersedes 25's reuse rule: a result with problems is reused for 2 minutes after it finished | The hub sends a thread's starts one at a time, so arrival-time reuse never fires | review-round-7 |
| 27 | Rare timing cases around the connection check (a start, cancel, handoff or service restart landing mid-check; two near-simultaneous starts) are accepted as known limits when their worst effect is a stale problem card or result until the next tools-getting start. Still fixed: anything that would build the wrong thing, leave a tool or card wrong permanently, leak a secret, or leave processes or files behind | Collin's pick "Accept as known limits" after rounds 6-8 | user |
| 28 | Supersedes 22: a check result is reused only when both the file's hash and the in-memory environment digest match (§6) | Round 9: a removed or changed token must rerun the check | review-round-10 |
| 29 | Clutter left by a machine service restart during a connection test (an empty checkout, an unused branch, a stray test program) is a known limit; the cleanup already in §6 stays as best effort. Token-bearing files (Antigravity plugin dirs) must still always be cleaned up | Collin's pick "Accept the clutter" after rounds 9-11 | user |
| 30 | Final review round with a strict filter: only findings that would build the wrong thing, leak a token or secret, or leave a tool missing for good are fixed; everything else is recorded as an accepted risk. A clean result goes to approval | Collin's pick "Final round, then approve" after 14 rounds | user |
| 31 | The check and Antigravity's file use the environment captured from a throwaway tmux session started exactly like the agent, read through a FIFO; supersedes the rule-built environment (tmux globals, `update-environment`, `PATH`, `PWD` rules) | Collin's pick "Ask tmux directly": removes the class of environment-mismatch findings from rounds 13-17 | user |
| 32 | Supersedes 31's FIFO: the throwaway tmux pane runs a small Node probe that sends its environment over a Unix socket the service listens on | A shell redirect can create a file and a FIFO open cannot be cancelled; connecting to a socket does neither | review-round-20 |
| 33 | Scope cut: the connection test and reading the agent's environment move to a follow-up thread, with Antigravity tools that need a value from a variable. Supersedes 2, 5, 9, 12-15, 17, 19-28, 31, 32 and the expansion part of 18. "Program exists" stays as a file check against the tmux global PATH (§5). Without long checks, starts are as fast as today, so the queue, check caching, digest and the cancel/restart checkout cleanup are dropped | Collin's pick "Move the test and Antigravity tokens out" after 20 rounds, nearly all findings in those parts | user |
| 34 | IDEA.md What, Why, What good looks like and Not doing updated for Decision 33 | Collin agreed to the cut on the scope card | idea-change |

## Spec

Builds on local-projects (PR #112, `docs/plans/local-projects/PLAN.md`). Everything there stays unless changed here. Reader: `machine/lib/project-mcp.js`; adapters: `machine/adapters/{claude,codex,agy}.js`; start path: `machine/service.js` `startIn` (~606-634); hub start: `viewer/app/sessions.js` `startSession` (~213-350) and `resumeUnanswered` (~185-210).

Scope (Decision 33): no connection test and no reading of the agent's environment. wheelchair never expands a variable anywhere. Those move to a follow-up thread.

### 1. Reader (`machine/lib/project-mcp.js`)

- Accept `type: "sse"` (with a non-empty string `url`) as valid. Claude reads `.mcp.json` itself and handles sse; Codex and Antigravity skip it (sections 3, 4).
- `http` and `sse` entries: `headers`, when present, must be an object of string values; otherwise the entry is invalid (existing "not a valid ..." line, text updated to "not a valid stdio, http or sse entry").
- Return also `hash`: SHA-256 hex of the file's bytes (null when there is no file). Unchanged otherwise.

### 2. `${...}` rule (shared by Codex and Antigravity)

- An **env** value passes through when it is exactly `${NAME}` and its key is `NAME` (`[A-Za-z_][A-Za-z0-9_]*`). An env alias (`CHILD: ${PARENT}`) does not pass through.
- A **header** value passes through (Codex only) when it is exactly `${NAME}` (any header name).
- wheelchair never expands a variable into anything: argv, `session.command`, files, logs, card text.

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
- `startIn` passes `--description=wheelchair <session name>` to `systemd-run` (`machine/service.js:623`) so the journal never logs the command line (which may hold literal header or env values).
- `command` returns, besides `argv`, `redactions`: the argv indexes of every project override (`mcp_servers.project_<name>.<key>=…`). `startIn` stores `session.command` as argv with each such element replaced by `mcp_servers.project_<name>.<key>=<redacted>` (command, args, url, env, headers alike); tmux gets the real argv.
- Budget: `quotedLength` measures `Buffer.byteLength(..., 'utf8')`; budget stays 64 KiB, still dropped as a whole with the same line, which names every server whose overrides were dropped.
- Every skip line an adapter returns is `{ names: [server names], text }` (section 7); the machine log prints `text`.

### 4. Antigravity (`machine/adapters/agy.js` `command`)

For a tools-getting session with servers:
- Plugin dir: `<stateDir>/agy-tools/<encodeURIComponent(session name)>/.agents/plugins/wheelchair-project/`, directories mode 0700, holding `plugin.json` = `{"name":"wheelchair-project","version":"1"}` and `mcp_config.json` = `{"mcpServers":{...}}`, files mode 0600, written atomically. argv gains `--add-dir <stateDir>/agy-tools/<encodeURIComponent(session name)>`. The sweep maps each directory entry back with `decodeURIComponent` before comparing it with `startingNames` and `liveTmux()`; entries that do not decode to a valid session name are removed only if older than 60 s.
- `command` returns the files to write (like `settingsPath`/`settings`); `startIn` writes them before tmux starts. No writes inside `command`.
- Translation: name kept (agy namespaces it `wheelchair-project_<name>`); stdio → `{command, args, env}`; http → `{type: "http", url, headers}` (`type` is required: verified format).
- Variables (verified 2026-11-18 on agy 1.5.11: plugin `mcp_config.json` expands nothing — not env, args, url or headers; stdio servers inherit agy's whole environment):
  - A stdio `env` entry that passes through (same key, section 2) is left out of the file: the server inherits it from agy's environment.
  - Any other `${` anywhere in command, args, env, url or headers skips the server: "uses ${...} that Antigravity cannot pass through". (A tool whose token comes from a variable is in the follow-up.)
  - Literal values are copied as is. A literal header may be a credential, which is why the file is private (0600, in 0700 dirs) and deleted when the session ends (IDEA constraint). Literal values never reach `session.command`, logs, lines or the card.
- Skips: `type: "sse"` ("uses sse, which Antigravity does not support here"); names not matching `[A-Za-z0-9_-]+` (same text as Codex); the same header twice ignoring case.
- If every server is skipped: no plugin dir and no `--add-dir`.
- Remove the old "aren't supported on Antigravity yet" warning.
- Non-tool roles (reviewer, mapper, asides, probes) never get `--add-dir` for this dir.
- Cleanup, by `sweepAgyTools()` in `machine/service.js`: removes `<stateDir>/agy-tools/<name>` for every `<name>` that is not in `startingNames` (read first) and not in `liveTmux()` (read second; a start that finishes in between has already launched its pane). Registered status is not consulted: a pane that exited on its own still has its record at `ready`. The sweep is fully synchronous (`liveTmux()` is synchronous; use `readdirSync` and `rmSync`) with no `await` from reading `startingNames` to the last removal, so no start can begin in between. If `liveTmux()` returns null (unknown), removes nothing. Called after `stop(name)`, from `start()`'s `finally` after the name leaves `startingNames` (covers failed and cancelled starts), and every 60 seconds on a timer like the others at `machine/service.js:366-372` (covers panes that exit on their own and handoff kills). Whoever calls it, the sweep never removes a dir modified in the last 60 s, so a start that just wrote its files is safe. The removal path is built only from directory entries of `<stateDir>/agy-tools` matching the session-name pattern, never from input.

### 5. Program check (new `machine/lib/project-programs.js`)

`missingPrograms({ worktree, mcp, path })` → lines (section 7). Synchronous file checks only; never launches anything.
- For each valid stdio server whose `command` contains no `${`:
  - A candidate counts only when `fs.statSync` (following symlinks) says it is a regular file and `fs.accessSync(..., X_OK)` succeeds; a directory never counts.
  - `command` containing `/`: resolved against `worktree` (absolute stays absolute); not a counting candidate → line.
  - Otherwise searched in each directory of `path` in order; empty and relative entries are resolved against `worktree` (the agent's working directory), as a shell would; no counting candidate in any → line.
  - Line: `{ names: [name], text: "<name>: its program can't be found" }`. The command itself is not printed.
- A `command` containing `${` is not checked.
- `path`: the start reads the tmux server's global `PATH` (`tmux show-environment -g PATH`, async, 2 s bound; `NAME=value` output used, `-NAME` or failure falls back to the service's own `process.env.PATH`), because an agent's pane gets the tmux global environment. Read once per tools-getting start whose reader returned servers, before section 6's update.

### 6. Machine project-tools state (`machine/service.js`)

- **Thread worktree:** a start is in the thread's worktree when `realpath(worktree)` equals `realpath(<stateDir>/worktrees/<project>/wc/<thread_id>)` (the path `createWorktree` gives the thread branch; `machine/service.js:490-492`). If either `realpath` fails (for example the thread directory does not exist), the start is not in the thread's worktree; the failure never aborts the start.
- State per thread, in memory and in `<stateDir>/project-tools/<thread_id>.json`:
  ```
  { seq, file: [{names, text}], programs: [{names, text}],
    clis: { <cli>: { hash, thread: bool, lines: [{names, text}] } } }
  ```
  Loaded from disk on first use after a service start (a missing or unreadable file means empty state with `seq` 0).
- Ticket: each tools-getting start takes `ticket = ++tickets[thread_id]` synchronously before it reads `.mcp.json` (in memory only; starts at 0 per service process). The state remembers `applied`, the highest ticket applied. A start whose ticket is lower than `applied` when it reaches the block below (a later start read the file after it and already published) changes no state and carries the current snapshot unchanged, so an older read never overwrites a newer one. (The hub already sends a thread's starts one at a time, `viewer/app/hub.js:153-155`; this covers starts it does not serialize.)
- At every tools-getting start of the thread (any worktree), after the reader, the PATH read and the adapter ran and before the tmux launch, the service updates the state in one synchronous block (no `await` between checking the ticket and replacing the in-memory state, so concurrent starts cannot interleave), then sets `applied = ticket`:
  1. Reader failure (`mcp: null`, not a reset): if in the thread's worktree, `file` = reader lines. Nothing else changes.
  2. Reset (reader confirmed no tools: no `.mcp.json`, or a valid file whose `mcpServers` is empty), in the thread's worktree only: `file` = [], `programs` = [], `clis` = {}. In another worktree a reset changes nothing.
  3. Otherwise:
     a. `clis[cli] = { hash: <this start's file hash>, thread: <in the thread's worktree>, lines: <this start's adapter skip lines> }`; in the thread's worktree also `file` = reader lines.
     b. In the thread's worktree only: `programs` = this start's `missingPrograms` lines. Other checkouts never change `programs` (a program git ignores, such as `.venv/bin/python`, may be missing from a fresh worker checkout, and a relative program may exist in one checkout and not another; the thread's own checkout is the one the card describes). Workers still log their own missing-program lines.
     c. Recompute other CLIs' lines: for every other CLI X with lines, if `clis[X].hash` equals this start's hash, or this start and `clis[X]` are both in the thread's worktree, call X's adapter `command()` with this start's file and worktree and a stand-in tools-getting session, keep only its skip lines (no files written, nothing launched) and store them with this start's `hash` and `thread`. Adapters read no environment values (section 2), so the result is X's real lines for that file. Lines from another checkout with a different file stay until that CLI starts again.
  4. `seq` += 1; set `session.project_tools = { boot, seq, file, programs, clis }` (a copy of the whole state), where `boot` is a random id chosen once per machine-service process start; then queue a save.
- Saves go through one per-thread write chain, each write taking the latest in-memory state, so an older write never lands after a newer one. A save writes `<file>.tmp` then renames it over `<file>`; a failed write removes `<file>.tmp` and is logged, and the start goes on. At startup, leftover `*.tmp` files in `<stateDir>/project-tools/` are removed.
- A start cancelled before the tmux launch may already have updated the state; that is harmless (the lines describe the file, not the session).
- A retried start that returns the registered session (or joins the starting one via `startingNames`) carries the same `project_tools`; it changes no state.
- No new route, no event: the start answer is the only way the state leaves the machine. `project_tools` is stored on the machine session (so a retried start returns it) but omitted from the machine's session-list and status responses (`machine/service.js:1149-1165`, `:1476`, `:1511-1512`).

### 7. Skip lines

- A line is `{ names, text }`: `names` the server names it is about (empty only for whole-file reader lines, which the card keys as `file`); `text` a plain sentence, e.g. `github: skipped on Codex: a header uses ${...} that Codex cannot pass through`.
- The reader's lines go to `file`; each adapter's to `clis[cli]`; the program check's to `programs`.
- Machine log lines stay as today (`text`).

### 8. Hub (`viewer/app/sessions.js`)

- Thread record gains `project_tools = { boot: null, seq: 0, created_at: null, state: null, card: null, card_names: [] }`.
- `applyProjectTools(thread, started)` after a successful machine answer in `startSession` (covers queued promotion via `retryWaiting`) and in `resumeUnanswered`, before `hub.save`, inside the lock those already hold: when `started.project_tools` exists and either its `seq` > stored `seq` with the same `boot`, or its `boot` differs from the stored `boot` (the machine service restarted; its counter may have gone back) and its session's `created_at` is not older than the stored `created_at` (a retried start of an older session must not win), store `boot`, `seq`, `created_at` and `state` (`{file, programs, clis}`) and reconcile the card. Anything else changes nothing. Delete `project_tools` from the object merged into the session record.
- Card reconcile:
  - Problem lines = `file` lines + `programs` lines + each `clis[*].lines`, deduplicated by text, in that order.
  - Card identity is the sorted set of names in the problem lines (`file` for whole-file lines), not the text.
  - Lines present and identity differs from `card_names` (or no open card): mark the open card answered, add a system `needs` card `{ title: "Project tools problem", body }`, store its id and names. Body: "Some project tools won't work for agents in this thread:" then `• text` per line (first 20, then "and N more").
  - Same identity: keep the card and its id; update its body in place if it changed.
  - No lines: mark the open card answered.
- `session list`: the hub adds `project_tools: { problems: [text] }` (the current problem lines; `[]` when none or never started) to the thread's lead session entry, and `viewer/app/wc.js`'s compact field allowlist keeps `project_tools`, so the default `wc.js session list` shows it.

### Edge cases

- `.mcp.json` deleted or emptied: the next tools-getting start in the thread's worktree resets; the card closes. Worker checkouts never reset or change `file`.
- `.mcp.json` unreadable or invalid in the thread's worktree: its line shows; CLI and program lines stay until the file is fixed.
- A program installed after a failure: the next tools-getting start in the thread's worktree clears its line and the card.
- A reader failure or invalid entry seen only in a worker checkout is logged, not shown: workers check out the thread branch, so the same file in the thread's worktree shows it (Decision 21's ownership rule).
- A worker on Codex or Antigravity: its skip lines replace that CLI's lines and show on the card.
- A hub restart between the machine starting a session and the hub saving its answer loses that snapshot; the next tools-getting start brings the whole state again.
- Lines never contain variable values, header values or commands.

### Non-goals

- Checking that tools connect (handshake, login, protocol); reading the agent's environment; Antigravity tools that need a value from a variable other than same-key env pass-through. All in the follow-up thread (Decision 33).
- Live watching of `.mcp.json`; checks between starts.
- On Codex, `${...}` forms beyond section 2 (`${NAME:-default}`, env aliases, `${}` in command, args or url): skipped, with a line on the card.
- Fixing tools; editing `.mcp.json`; a settings screen.
- OAuth flows for tools that need login.

### Validation

- `bash machine/test/run.sh`, new tests:
  - Codex: bearer, env header, every project override (real in argv, `<redacted>` in `session.command`, including args and url query strings), mixed `${}` header skip, duplicate header skip, sse skip, non-ASCII budget (under 64 Ki UTF-16 units, over 64 KiB bytes → dropped; line names every dropped server); `systemd-run` gets `--description`.
  - Antigravity: plugin files and `--add-dir` for tool roles, none for reviewer; http entry written with `type: "http"`; same-key env left out of the file; any other `${` skips the server with its line; literal header copied into the file and absent from `session.command` and logs; files 0600 and dirs 0700; sweep removes dirs of sessions not live, keeps live and starting ones and any dir younger than 60 s, removes nothing when tmux state is unknown, has no await between its checks and removals; dir removed by the timer after its pane exits even with the record at `ready`; a session name containing `/` maps to one encoded directory; no old warning.
  - Program check: absolute, worktree-relative and PATH programs found; missing or non-executable reported without printing the command; `${` command not checked; PATH from `tmux set-environment -g PATH` is used; fallback to the service PATH when tmux has none.
  - State: a start whose ticket is older than the applied one changes nothing and returns the current snapshot; `realpath` of a missing thread directory does not abort a worker start; `programs` changes only from the thread's worktree;
  - Program check: a directory named like the program does not count; a relative PATH entry is searched under the worktree.
  - State (cont.): `seq` increases per start; `boot` changes per service start; worker start replaces its CLI's lines and `programs` but never `file` or resets; reset only from the thread's worktree (by path; a verifier checkout on the same branch does not qualify); reader failure keeps other lines; a fixed or removed server loses its skip lines on every CLI whose lines came from the same file hash or the thread's checkout (a worker checkout's line with another file survives a thread start); repeated start returns the same `project_tools`; two concurrent starts both land and their `seq` values differ; writes land in order; `.tmp` leftovers swept at startup; a failed state write still starts the agent; `project_tools` absent from machine session-list and status responses; no state change for non-tool roles.
- `node --test viewer/test/*.test.js`, new tests: card opens; same names with different text keep the card and update its body; different names replace it; reset closes it; per-CLI lines kept apart; program lines shown; an older `seq` snapshot ignored; a new `boot` with a lower `seq` applied, but not from an older session; applied in `startSession`, a queued promotion and `resumeUnanswered` without re-taking the thread lock; `project_tools` not left on the session record; default `wc.js session list` shows `project_tools`.
- `node --test test-support/test/*.test.js` still passes.
- `README.md` "Project MCP tools" section rewritten for the new behaviour: Codex header forms and what is skipped, Antigravity support and its `${...}` limit, the "Project tools problem" card and `session list`'s `project_tools`.
- Manual (hearth only, one model turn each): an Antigravity worker in a project with a stdio tool can call it, and one with an http tool carrying a literal header can call that; an Antigravity reviewer in the same thread cannot; a Codex worker can call an http tool whose token comes through `bearer_token_env_var`.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|
| A program found on the tmux global PATH may still be missing for the agent (or the reverse) when tmux's `update-environment` or the session's own setup changes PATH | The agent pane starts from the tmux global environment; a mismatch is rare and shows only as an extra or missing line | user (Decision 33) |
| A tmux server started with verbose logging (`-v`) writes the full launch command, including literal `.mcp.json` values, to its own log | An opt-in debugging mode Collin would turn on himself | review-round-17 |
| A skip line recomputed at a worker start on the same file loses its thread-checkout origin, so after the thread's file changes it can stay until that CLI starts again | Needs a specific sequence of CLIs and checkouts; the line clears at that CLI's next start | review-round-17 |
| Literal header or env values in `.mcp.json` are visible to other local users in Codex's process arguments | Needs a second local user account on the machine (home is `drwx------`, so only `/proc` exposes them); literal secrets in a committed `.mcp.json` are already unusual, since `${VAR}` is the documented way; literal env values have been passed this way since PR #112. `${...}` values never reach argv | review-round-15 |
| With tmux `remain-on-exit` on, an ended Antigravity agent's private plugin file stays until its tmux session is stopped | The file stays private (0600) and is removed when the session is stopped or archived | review-round-15 |
| A launch left pending by a previous machine service process for more than 60 s can create an Antigravity pane after the sweep removed its plugin files | Needs a service restart mid-launch and a launcher stuck for a minute | review-round-14 |
| A tool that needs an OAuth login is not detected; a Codex or Antigravity agent without that CLI's login silently lacks it | wheelchair cannot see CLI logins; connection checking is in the follow-up | review-round-2 |
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

### Round 4 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** §2 private-file exception; §4 http `type`, expansion of all `${NAME}`/`${NAME:-default}` into the private file; §5 no redirects, SSE endpoint same-origin; §6 rewritten: no event, thread worktree by path, generation and join rules, hub-only `GET /v1/project-tools/<thread_id>`; §7 only thread-worktree starts carry `project_tools`, `check_generation`; §8 hub pull on the 60 s timer and 15 s after a start, `pending`; Edge cases; Non-goals; Validation; Accepted Risks; Decisions 19-20.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Worker skip lines never reach the thread | upheld | §6 any tools-getting start sets its CLI's lines; Decision 21 |
| intent | major | Card can't clear: reruns only from thread worktree starts | upheld | §6 any tools-getting start may rerun |
| intent | minor | Same-key env written to the private file needlessly | upheld | §4 left out |
| mechanics | blocking | `check_generation` decided after registration | upheld | §6 state changes before registration; start answer no longer carries it |
| mechanics | blocking | Interrupted check for new hash reuses old clean result | upheld | §6 step 2 requires a current-generation result |
| mechanics | blocking | Retried start snapshot replays stale lines | upheld | §6/§8 machine-owned state ordered by `seq` |
| mechanics | major | Hub restart gap strands result | upheld | §8 timer pulls threads with live tools-getting sessions |
| mechanics | major | Probe processes survive service restart | upheld | §6 `probes` reclaimed at startup |
| mechanics | major | Budget-drop line has no names | upheld | §3/§7 lines carry names |

### Round 5 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 4:** §3/§7 skip lines carry server names (budget drop names every dropped server); §4 same-key env left out of the private file; §6 rewritten: machine owns one `seq`-ordered state per thread (lines + check), changed in a serial queue before session registration; any tools-getting start sets its CLI's lines and may rerun the check; only thread-worktree starts set `file` or reset; reuse requires a current-generation result; probe process reclaim at startup; §7 now only defines lines; §8 hub pulls the whole state (after start, 15 s later, 60 s timer), applies by `seq`; Edge cases; Validation; Accepted Risks; Decision 21.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Check reruns on every checkout change | upheld | §6 keyed by hash; Decision 22 |
| mechanics | blocking | Immediate pull deadlocks inside held thread lock | upheld | §8 lock rules |
| mechanics | blocking | Reset leaves `running: true` | upheld | §6 reset sets `running: false` |
| mechanics | blocking | Newer-protocol servers give false problems | downgraded (major) | Real but not "build the wrong thing"; §5 `unsupported`; Decision 23 |
| mechanics | major | Restart gap if pane ends before first pull | upheld | §8 timer covers starts in the last 15 min |
| mechanics | major | Crash between spawn and recording pid | upheld | §6 marker recorded before spawn, reuse aside-turns `createProc` |
| mechanics | major | Failed read vs CLI line replacement conflict | upheld | §6 steps 1 and 3 |
| mechanics | minor | Non-goals contradict any-worktree checks | upheld | Non-goals |

### Round 6 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: started with no provider flag (intent start was waiting); cross-family: unknown.

**Changed since Round 5:** Collin chose to run the check during agent start (Decision 24). §6 rewritten (check in a per-thread queue during the start, whole-state snapshot with `seq` on the start answer, probe markers); §8 hub applies snapshots by `seq`, no pulling; §5 `unsupported` (Decision 23); check keyed by hash (Decision 22); Edge cases; Validation; Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Queued starts each rerun a failing check (K×11 s) | upheld | §6 `arrived`/`started` reuse rule; Decision 25 |
| intent | minor | `cli_lines` leftover in Validation | upheld | Validation |
| mechanics | blocking | Service restart between tmux launch and check end | upheld | §6 check before launch |
| mechanics | blocking | Handoff cancel during the check registers a killed pane | upheld | §6 check before the existing cancel check and launch |
| mechanics | major | State write failure with a live pane | upheld | §6 write failure logged, start continues |
| mechanics | blocking | Queue and retry break the start bound | upheld | §6 (same as intent major) |
| mechanics | blocking | `initialize` error classification | upheld | §5 version rejection needs `data.supported` |
| mechanics | major | Legacy SSE version negotiation | upheld | §5 accepted versions; Validation fixture |
| mechanics | minor | Snapshot exposed via machine session list/status | upheld | §6 omitted there |

### Round 7 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 6:** §5 protocol versions and version-rejection rule; §6 check runs before the tmux launch, `arrived`/`started` reuse rule, write-failure handling, snapshot hidden from machine list/status; Validation; Accepted Risks; Decision 25.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Arrival rule never fires: the hub serializes starts | upheld | §6 reuse a problem result for 2 minutes |
| intent | minor | Risk row omits the held thread lock | upheld | Accepted Risks |
| mechanics | blocking | Queue wait unbounded across hashes or throws | upheld | §6 no check after 10 s in the queue |
| mechanics | blocking | Lost save rolls `seq` back | upheld | §6 `seq` = max(seq+1, now) |
| mechanics | major | Handoff during a check | upheld | §6 abort on cancel; `kill` waits up to 5 s |
| mechanics | major | Probe launched without a saved marker | upheld | §6 spawn only after the save |
| mechanics | major | `data.supported` naming a supported version | upheld | §5 retry with it |

### Round 8 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 7:** §5 `data.supported` retry; §6 2-minute reuse of a problem result (Decision 26), 10 s queue cap, `seq` = max(seq+1, now), abort on cancel and handoff `kill` wait, probe only after its marker is saved; Validation; Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | 2-minute reuse keeps the card open after a token fix | upheld | §6 reuse also needs an unchanged in-memory environment digest |
| intent | minor | Marker-save failure shown as "newer protocol" and never rerun | upheld | §6 now a problem |
| intent | minor | Start-wait bound stated inconsistently | upheld | §6 and Accepted Risks: ~21 s, handoff +5 s |
| mechanics | blocking | 10 s cutoff doesn't cap the queue wait | upheld | §6 queue wait races a 10 s timer |
| mechanics | major | Cancelled queued start stays in the queue | upheld | §6 abort leaves the queue |
| mechanics | blocking | Parallel probe marker writes can land out of order | upheld | §6 per-thread write chain |
| mechanics | blocking | Marker-save failure suppresses checks | upheld | Already fixed this round (intent minor): now a problem |
| mechanics | major | Retried `initialize` needs id 3 | upheld | §5 |
| mechanics | major | Clock-based `seq` can fall below the hub's | upheld | §6/§8 `boot` id per service start |
| mechanics | minor | Token-fix edge case vs 2-minute reuse | upheld | Edge cases (digest) |

### Round 9 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 8:** §5 retried `initialize` id 3; §6 environment digest for reuse, 10 s queue-wait race, abort leaves the queue, per-thread ordered state writes, `boot` id, marker-save failure is a problem; §8 `boot` handling; Edge cases; Validation; Accepted Risks; Decision 27 (rare timing cases accepted as known limits).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Marker-save failure blames the tool; reason missing from §5 | upheld | §5/§6 reason names wheelchair's own fault |
| intent | minor | Digest misses PATH and inherited tokens | upheld | §6 digest over the whole check environment |
| intent | minor | Per-thread queue could be replaced by "skip if a check runs" | declined | The queue also serializes every state change and write for the thread (§6), which is needed regardless; the 10 s race is a few lines |
| mechanics | blocking | Cached success survives token removal | upheld | §6 digest required for every reuse |
| mechanics | blocking | 401 with a literal custom key header read as OAuth | upheld | §5 `login` only with no headers |
| mechanics | blocking | Probe that clears its environment escapes recovery | upheld | §6 child-written pidfile wrapper |
| mechanics | blocking | Cancelled start strands its new checkout | upheld | §6 cancel cleanup |
| mechanics | blocking | Atomic writer leaves temp files | downgraded (minor) | Leftover files only; §6 fixed temp name and startup sweep |
| mechanics | major | State-folder failure cached in the reuse window | upheld | §6 bypasses reuse |

### Round 10 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 9:** §5 `login` only for servers with no headers; state-folder failure reason; §6 digest over the whole check environment and required for every reuse, child-written probe pidfiles, cancel cleanup of a created checkout, fixed temp name and startup sweep; Validation.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Wrapper execs even if pidfile write fails | upheld | Pidfiles removed (§6) |
| mechanics | blocking | Start time vs mtime comparison undefined | upheld | Pidfiles removed (§6) |
| mechanics | blocking | Group with exited leader skipped | downgraded (minor) → accepted-risk | Crash recovery now relies on stdin EOF; Accepted Risks |
| mechanics | blocking | Wrapper hides `ENOENT` | upheld | §6 direct spawn |
| mechanics | blocking | Kept branch collides with next worker | upheld | §6 skip existing git branches |
| mechanics | blocking | Restart mid-check strands checkout | upheld | §6 retries clear or skip leftovers |
| mechanics | blocking | Agy sweep race deletes a live dir | upheld | §4 read order and registered-session guard |
| mechanics | major | `headers: {}` ambiguous for `login` | upheld | §5 no header entries |
| intent | major | Wrapper hides missing program | upheld | Wrapper removed (§6) |
| intent | major | Cancel cleanup could remove a lead's checkout | upheld | §6 only worker/verifier checkouts this start added |
| intent | minor | Later cancel points still strand checkouts | upheld | §6 cleanup on any unregistered end |
| intent | minor | State-folder failure blames the tools | upheld | That result no longer exists (§6) |
| intent | minor | OAuth tool with a harmless header shows a problem | upheld | §5 `resource_metadata=` rule |
| intent | minor | Decision 22 contradicts §6 | upheld | Decision 28 |

### Round 11 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 10:** §4 sweep read order and registered-session guard; §5 `login` via `resource_metadata=`; §6 probes spawned directly (pidfiles removed; stdin-EOF crash behaviour), cleanup of checkouts a worker/verifier start added, worker branch numbering skips existing branches, verifier stranded-path cleanup; Accepted Risks (stdin-ignoring server after crash); Decision 28.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Two answers for a 401 with a custom header plus OAuth | upheld | §5 `login` needs no configured headers; Validation aligned |
| intent | major | Worker checkout stranded by a restart | upheld | §6 restart journal |
| intent | minor | Cancelled worker keeps an empty branch | upheld | §6 delete it |
| mechanics | blocking | Agy sweep keeps token files for dead panes recorded `ready` | upheld | §4 guard uses only starting names and tmux |
| mechanics | blocking | First lead's checkout stranded by a restart | upheld | §6 thread-branch start reuses an existing checkout |
| mechanics | blocking | Worker checkout left after restart | upheld | §6 restart journal (same as intent major) |
| mechanics | blocking | Verifier cleanup could remove a live pane's checkout | upheld | §6 needs confirmed tmux absence |
| mechanics | major | Conflicting OAuth rule | upheld | §5 (same as intent major) |

### Round 12 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 11:** §4 sweep guard (starting names, then tmux); §5 `login` needs `resource_metadata=` and no configured headers; §6 cancel/failure cleanup deletes a worker's new branch, restart journal, tmux-confirmed cleanup, thread-branch checkout reuse; Validation; Decision 29 (restart clutter accepted).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | OAuth tool with a harmless header shows a problem | accepted-risk | Accepted Risks |
| mechanics | blocking | Agy sweep can delete a retry's new files | upheld | §4 sweep synchronous |
| mechanics | blocking | Cancel cleanup can remove a live pane's checkout | upheld | §6 needs confirmed tmux absence |
| mechanics | blocking | `resource_metadata=` substring match | upheld | §5 parse the auth-param |
| mechanics | blocking | Removed server's skip line on another CLI never clears | upheld | §6 step 3 retires lines for removed names |

### Round 13 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 12:** §4 sweep synchronous; §5 `resource_metadata` parsed as a Bearer auth-param; §6 cleanup needs confirmed tmux absence, step 3 retires skip lines of removed servers; Validation; Accepted Risks (OAuth tool with extra headers).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Cleanup skipped when no tmux server runs | upheld | §6 uses `liveTmux()` |
| intent | minor | Other CLIs' lines go stale after a fix | upheld | §6 recompute other CLIs' lines; Accepted Risk row removed |
| intent | minor | Budget line dropped whole on one removal | upheld | Same recompute |
| mechanics | blocking | Budget line erased by one removal | upheld | Fixed this round by recomputing other CLIs' lines |
| mechanics | blocking | Startup sweep vs a launch surviving the old service | upheld | §4 no sweep in the first 60 s |
| mechanics | blocking | Cleanup skipped with no tmux server | upheld | Fixed this round (`liveTmux()`) |
| mechanics | blocking | Empty `resource_metadata` hides a problem | upheld | §5 needs an absolute URL |
| mechanics | blocking | Multi-line tmux values truncated | upheld | §5 parse `show-environment -s` |

### Round 14 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 13:** §4 no sweep in the first 60 s after service start; §5 `resource_metadata` must be an absolute URL, environment parsed from `show-environment -g -s`; §6 cleanup uses `liveTmux()`, other CLIs' lines recomputed at thread-worktree starts; Accepted Risks (unset-variable row removed); Validation.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Recompute only at thread-worktree starts | upheld | §6 also at any start with the same file hash |
| intent | minor | 60 s hold-off misses other sweep callers | upheld | §4 never remove a dir younger than 60 s |
| mechanics | blocking | Literal values reach the journal via the systemd-run description | upheld | §3 `--description` |
| mechanics | blocking | Launcher surviving a restart beats the sweep/journal | downgraded (minor) → accepted-risk | Restart mid-launch plus a stuck launcher; Accepted Risks |
| mechanics | blocking | Check sees variables tmux clears from the pane | upheld | §5 apply `update-environment` |
| mechanics | blocking | Recompute from a different checkout erases a valid warning | upheld | §6 recompute only for an equal hash |

### Round 15 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: started with no provider flag (intent start was waiting); cross-family: unknown.

**Changed since Round 14:** §3 `systemd-run --description`; §4 sweep never removes a dir younger than 60 s; §5 check environment applies tmux `update-environment`; §6 other CLIs' lines recomputed only for an equal file hash; Accepted Risks; Decision 30 (final round, strict filter).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Recompute compares the hash before a changed file is checked | upheld | §6 recompute runs after the check decision |
| mechanics | blocking | Literal header credentials visible in Codex argv to local users | downgraded (minor) → accepted-risk | Only another local account could read `/proc`; literal secrets in `.mcp.json` are unusual; Accepted Risks. Shown on the approval card |
| mechanics | blocking | `${PWD}` expands to the wrong directory | upheld | §5 set `PWD` to the worktree |
| mechanics | blocking | `update-environment` entries are patterns | upheld | §5 fnmatch |
| mechanics | blocking | `remain-on-exit` keeps token files | downgraded (minor) → accepted-risk | File stays private and is removed at stop; Accepted Risks |
| mechanics | minor | Validation text on first-start clearing | upheld | Validation |

### Round 16 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: started with no provider flag (intent start was waiting); cross-family: unknown.

**Changed since Round 15:** §5 check environment applies `update-environment` as fnmatch patterns and sets `PWD` to the worktree; §6 other-CLI recompute runs after the check decision; Validation; Accepted Risks. Decision 30's strict filter still applies.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | `PWD` in the digest breaks cross-checkout reuse | downgraded (minor) | Under Decision 30 the cost is extra checks only, nothing wrong is built; one-line fix applied anyway: `PWD` left out of the digest |
| intent | minor | Wheelchair's own command variables missing from the check environment | accepted-risk | Accepted Risks |
| mechanics | blocking | `update-environment` rule removes globals the pane keeps | upheld | §5 follows tmux's `environ_update` exactly |
| mechanics | blocking | Recompute guard always passes after a check | upheld | §6 step 3 rewritten: per-CLI line origin (hash, thread checkout) |
| mechanics | blocking | Literal stdio env stored in session records | upheld | §3 redaction covers `env` overrides |
| mechanics | minor | `PWD` in the digest | upheld | Already fixed this round |

### Round 17 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: started with no provider flag; cross-family: unknown.

**Changed since Round 16:** §3 redaction also covers literal stdio `env` overrides; §5 `update-environment` follows tmux's `environ_update`; `PWD` out of the digest; §6 state `clis` entries carry `hash` and `thread`, step 3 rewritten as ordered substeps (queue wait, lines, recompute by origin, check decision); Validation; Accepted Risks. Decision 30's strict filter still applies.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | tmux overlays the client's `PATH` | upheld | §5 `PATH` from the service |
| mechanics | blocking | `PWD` lost on the `process.env` fallback | upheld | §5 `PWD` set last in every case |
| mechanics | blocking | Literal tokens in args or URL stored | upheld | §3 redact every project override |
| mechanics | blocking | tmux verbose log | downgraded (minor) → accepted-risk | Opt-in debug mode; Accepted Risks |
| mechanics | minor | Recompute relabels origin | accepted-risk | Accepted Risks |

### Round 18 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 17:** §5 environment captured from a throwaway tmux session through a FIFO (`captureEnv`, Decision 31), replacing the rule-built environment; §4 expansion uses it; §6 digest ignores `PWD` and `WHEELCHAIR_*`; §3 redaction of every project override; Validation; Accepted Risks. Decision 30's strict filter still applies.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Digest includes per-pane `TMUX`/`TMUX_PANE` | upheld | §6 3d excludes per-pane names |
| intent | major | Capture only "when a check runs" contradicts the digest | upheld | §5 capture at every tools-getting start with servers |
| intent | minor | Where capture runs | upheld | §5 before the adapter, outside the queue; up to 10 s staleness stated |
| mechanics | blocking | Capture scheduled after the reuse decision | upheld | Fixed this round (§5 capture before the adapter) |
| mechanics | blocking | Captured `TMUX`/`TMUX_PANE` | upheld | §5 dropped from the capture; §6 digest excludes them |
| mechanics | blocking | Late shell can recreate the FIFO path as a file | upheld | §5 unlink only after the session is confirmed gone |
| mechanics | blocking | Session names with `/` break the agy dir mapping | upheld | §4 encoded directory names |
| mechanics | minor | Capture outside the stated bounds and cancel path | upheld | §5/§6 bounds and cancel |

### Round 19 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 18:** §5 capture timing (every tools-getting start with servers, before the adapter), drops `TMUX`/`TMUX_PANE`, FIFO removed only after the session is confirmed gone, cancel kills the capture; §6 digest exclusions and bounds (~26 s); §4 encoded plugin directory names; Validation; Accepted Risks. Decision 30's strict filter still applies.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Login variables in the digest force reruns across CLIs and accounts | upheld | §6 3d excludes `loginEnv` names |
| intent | minor | Accepted Risks row stale after capture moved | upheld | Row rewritten |
| intent | minor | Two different longest waits | upheld | §6 ~26 s throughout |
| mechanics | blocking | Restart cleanup could let the probe write a regular file | upheld | §5 probe writes only into an existing FIFO; startup removal needs no `wcenv-*` left |
| mechanics | blocking | Excluded variable used by a tool hides a change | upheld | §6 referenced names always in the digest |
| mechanics | blocking | Recompute with another CLI's login variables | upheld | §6 3c skipped when the file references them |
| mechanics | minor | No deadline on launch and cleanup | upheld | §5 whole capture bounded at 5 s; cleanup in background |

### Round 20 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: started with no provider flag; cross-family: unknown.

**Changed since Round 19:** §5 probe writes only into an existing FIFO, startup cleanup waits for no `wcenv-*` sessions, whole capture bounded at 5 s with background cleanup; §6 digest excludes `loginEnv` names unless the file references them, 3c recompute skipped when the file references login or `WHEELCHAIR_*` variables, ~26 s bound; Accepted Risks row on start waits rewritten; Validation. Decision 30's strict filter still applies.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Startup sweep refers to a nonexistent cleanup | upheld | §5 wording |
| intent | minor | 3c skip broader than needed | accepted-risk | Accepted Risks |
| intent | minor | Referenced per-session variables force reruns | accepted-risk | Accepted Risks |
| mechanics | blocking | FIFO writer can still create a regular file | upheld | §5 Unix socket: connecting never creates a file |
| mechanics | blocking | Pending FIFO open can't be cancelled | upheld | §5 socket server closed on timeout |
| mechanics | minor | Validation promise vs recompute skip | upheld | Validation qualified |

### Round 21 — 2026-11-19

**Changed since Round 20:** Decision 33 cut scope: the connection test (old §5), environment capture, check caching and digest, the per-thread queue, and checkout cancel/restart cleanup are removed. New §5 program check (file check against the tmux global PATH). §4 Antigravity no longer expands variables: any `${` other than same-key env skips the server. §6 rewritten as a synchronous state update. §8 card without connection results; `session list` shows problem lines. Edge cases, Non-goals, Validation and Accepted Risks rewritten. Because so much changed, review the whole Spec in depth. Earlier rounds' findings about removed parts no longer apply.

**Lanes:** intent: claude / claude-opus-5-5; mechanics: started with no provider flag; cross-family: unknown.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | `programs` overwritten by every checkout flaps the card | upheld | §6 3b: only the thread's worktree sets `programs` |
| intent | minor | Move state to the hub, drop the machine store | declined | Cross-CLI recompute (§6 3c) needs the adapters on the machine; the store is small and its ordering rules are already specified |
| intent | minor | No manual check of Codex token or Antigravity http | upheld | Validation manual checks |
| mechanics | blocking | Reader errors in a worker checkout never shown | declined | Decision 21: only the thread's worktree owns `file`; workers check out the thread branch, so the same error shows from there; Edge cases note added |
| mechanics | blocking | Another checkout clears a missing-program line | downgraded (minor) | Wrong only until the next thread start; fixed with the intent finding above |
| mechanics | blocking | Concurrent starts publish an older read under a higher `seq` | downgraded (minor) | The hub serializes a thread's starts (`viewer/app/hub.js:153-155`); fixed anyway with a per-start ticket (§6) |
| mechanics | blocking | `realpath` of a missing thread directory aborts the start | upheld | §6: failure means not the thread's worktree |
| mechanics | blocking | Directory passes `X_OK`; relative PATH entries undefined | downgraded (minor) | A false "found" only misses a warning; §5 requires a regular file and resolves relative entries against the worktree |
| mechanics | minor | README still describes the old behaviour | upheld | Validation: README section rewritten |

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
