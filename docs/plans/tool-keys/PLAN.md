---
slug: tool-keys
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-25
---

# Keys for folder tools

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md` and `docs/maps/folder-tool-keys.md`.
**Starting point:** the earlier key design in `docs/plans/easy-tools/PLAN.md` at commit
`a8211e9e` (S4, S9, S10) and that plan's Review Rounds 1-3 key findings, all of which this
plan carries forward unless a decision below changes them.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | Collin picked it | user |
| 2 | No designer: the Shared keys section and "needs key" status were already drawn and agreed in easy-tools (its Decision 19); copied here as `graphs/mockup-shared-chosen-phone.html` and `graphs/mockup-tools-mixed-phone.html` | The visible part is small and already agreed | defaulted |
| 3 | Carry forward the earlier design: `keys` list in `tool.json`; bridge and server launcher read the key store themselves at spawn; keys never in agent env, generated MCP configs or instructions; project tools use project keys, shared tools a machine-local shared key set with the same private file modes | Settled in easy-tools rounds 1-3 | defaulted |
| 4 | Script output redaction as easy-tools round 3 left it: streaming redaction with hold-back before every cut and capture limit; `[key <NAME>]` replacement | Secret leaks are always fixed | defaulted |
| 5 | Server tools' stdout (newline-delimited MCP JSON) is redacted line by line in the launcher, matching both the raw and JSON-escaped key value | Closes the server-output leak the earlier design left to authors; cheap since the launcher already pipes it | defaulted |
| 6 | `check`/`run` as in easy-tools round 3: `check` never has keys and says a keyed server's failure may be that; keyless `run` in the caller's process on Claude, Codex and Antigravity, saying it ran without keys | Never crosses a sandbox; settled earlier | defaulted |
| 7 | A tool whose key is not set does not run and shows "needs key X, not set on this machine" on the Tools page, as in the mockup | Agreed mockup | defaulted |
| 8 | `.mcp.json` project-key injection into the agent's environment (Claude, Codex) stays as it is. Folder tools never add a key to the agent; a key also used by a `.mcp.json` server stays visible to the agent through that path, and the guide says so (moving that server to a folder tool removes it) | Collin: leave it; avoids breaking working setups | user |
| 9 | Keyed tools are not available to sandboxed Codex sessions (the default for Codex, and always for Codex project leads); this is shown plainly on the Tools page, in `wc.js tool list` and in the session's tool problems. Unrestricted Codex gets keyed tools through MCP like Claude, with no added prompt or step | Collin: not for now, but transparent, and no friction for unrestricted Codex | user |
| 10 | Supersedes 5: server stdout is redacted one complete line at a time, passed on at each newline; JSON lines are decoded, string values redacted except top-level `jsonrpc`, `id`, `method`, then re-encoded; stderr redacted line by line | Byte hold-back stalls request/response servers; raw matching corrupts framing and misses escaped spellings | review-round-1 |
| 11 | A key value under 8 characters counts as not set | Short values would mangle output when hidden; real keys are long | review-round-1 |
| 12 | Shared keys get a machine chooser (same control as the Tools page), not drawn in the mockup | Shared keys are per machine; the mockup had no chooser | review-round-1 |
| 13 | Supersedes 10 for server stdout: lines with no key pass byte for byte; raw replacement when the result checks clean; otherwise a reply is withheld with an error keeping its id, a notification dropped | JSON round-trips changed numbers and ids; property-name and escaped keys can't always be rewritten safely | review-round-2 |
| 14 | Usable key value: at least 8 characters and no NUL; Shared keys refuses others; project editor marks them for folder tools | Env-safe values, one rule in both places | review-round-2 |

## Spec

Builds on the merged easy-tools work (`docs/plans/easy-tools/PLAN.md`, PR #196); everything
there stays as it is except where an item below changes it. Current code is mapped in
`docs/maps/folder-tool-keys.md`.

### K1. Declaring keys
`tool.json` gains an optional `keys`: an array of 1 to 20 unique key names. Each name must
match `KEY_NAME` and must not be reserved (`isReserved`), both in `machine/lib/project-keys.js`.
Anything else makes the tool invalid, and the reason names `keys`. The validated tool
(`validateToolJson`, `machine/lib/folder-tools.js`) carries `keys` (an empty array when
absent), so discovery, the bridge's changed-tool check and the launcher all see it. A tool
with no `keys` behaves exactly as today.

### K2. Where a tool's keys come from
- A **project tool** (from the session's worktree) uses the project's key store, the one
  edited on the project's Tools page (`readKeyStore` with `projectIdentity` of the worktree).
- A **shared tool** (from the pinned shared copy) uses the machine's **shared key store**:
  `<stateDir>/shared-keys/keys.json`. It is created and written the same way as a project
  store (directory 0700, file 0600, atomic temporary file and rename, a `revision` counter)
  and has the same name rules. It is never committed and never leaves the machine except
  as key names. In the shared tools project's own threads (no shared copy, easy-tools S3),
  the tools there are its project tools, but they use the shared key store, so a shared
  tool can be tried before merge.
- A key is **set** for folder tools when the store has that name with a value that is
  **usable**: at least 8 characters, with no NUL character (an environment variable can't hold
  one). Any other stored value counts as not set, and the status gives the reason: `value too
  short (under 8 characters)` or `value can't be used as an environment variable`. Real API
  keys are long, and short ones would mangle output when hidden (K4).
- The Shared keys editor refuses an unusable value, with that same wording. The project key
  editor still accepts any non-empty value (`.mcp.json` servers may use short ones). It
  refuses a NUL character, and it marks a stored value that folder tools can't use with
  `too short for folder tools` (or the environment reason) beside its name. The key-names
  routes return, per name, `set` and `folder_usable` (with the reason), never the value. A
  name whose value is unusable still shows its Remove control.
- **Which store a tool uses** (the execution rule) is decided only by K2, and every place
  that shows key status (K6, K7) uses the same rule.

### K3. What reaches the tool, and what never reaches the agent
- The bridge (`machine/lib/tool-bridge.js`) reads the right store itself on **each call**.
  The server launcher (`machine/lib/tool-launch.js`) reads it **when it starts** the
  server. Each adds exactly the tool's declared keys to the environment it builds with
  `toolEnv`. The generated MCP entry (`bridgeEntry`, `serverEntry`) passes only what it
  takes to find the store: `--state-dir`, and `--key-store project|shared` per tool.
  It never carries a key value.
- No key value is written into any generated MCP config, any connector config file, the
  agent's environment or its starting instructions. Folder tools never use the
  `.mcp.json` env injection (`injectProjectKeys`, `machine/lib/env-launch.js`), which is
  unchanged (Decision 8). The guide says a key also used by a `.mcp.json` server still
  reaches the agent that way.
- Keys already in the inherited environment stay there, as in easy-tools Decision 22. A
  declared key overrides an inherited variable of the same name.
- **Missing key.** At discovery, a keyed tool with any declared key not set is not offered
  through MCP. The session's tool problems name it: `tool <name> needs key <KEY>, not set
  on this machine` (for a shared tool, `shared tool <name> …`), naming every missing key.
- **Changes mid-session.** Every run reads the store when it starts: each bridge call and
  each machine-route run (K5). Replacing a value takes effect on the next run. Removing a key
  makes the next run return the missing-key text as an error and run nothing. A server that
  is already running keeps the keys it started with. Adding a key that was missing at
  session start makes the tool usable on Kimi and Pi at once (their `wc.js tool list` and
  `run` read live), and through MCP from the next session, because the MCP tool list is
  fixed at start.

### K4. Hiding key values in output
Redaction lives in `machine/lib/key-redact.js`. It works on the tool's own key values (all
at least 8 characters, K2) and replaces every exact occurrence with `[key <NAME>]`. A tool
with no keys gets no redaction, and its output is passed through exactly as today.
- **Script tools** (`machine/lib/tool-run.js`): stdout and stderr each go through a
  streaming redactor before the 2 MiB capture limit, the 1 MiB result cut and the 4 KiB
  stderr tail. It holds back the last (longest value − 1) bytes until more arrives or the
  stream ends. Where a capture limit stops reading, the held-back bytes are dropped, never
  sent. No cut can leave part of a key showing. The launch-error text is redacted too.
  This hold-back is fine because a script's result is only returned once it exits.
- **Server tools** (the launcher): stdout is handled **one line at a time** (MCP stdio
  messages are newline-terminated). Each line is passed on as soon as its newline arrives,
  so nothing waits for the server's next output. For each line:
  1. **No key anywhere:** no key value occurs in the raw line text, nor, if it parses as
     JSON, in any decoded string value or property name. The line passes on **byte for byte
     unchanged**. It is never re-encoded, so numbers and ids are untouched.
  2. **Raw replacement works:** otherwise every raw occurrence is replaced with `[key <NAME>]`.
     If the line was JSON, the result is checked again. It passes on when it still parses,
     no key remains in any decoded string or property name, and its top-level `jsonrpc`,
     `id` and `method` are unchanged. A line that was not JSON passes on after the raw
     replacement.
  3. **Otherwise the message is withheld.** For example the key is only present escaped
     (such as `\u00e9`), or replacing it would break the message. A message with an `id`
     is replaced by `{"jsonrpc":"2.0","id":<its id>,"error":{"code":-32603,"message":"wheelchair
     withheld this reply: it contained a key value"}}`. A message without an `id` (a
     notification) is dropped. Either way, the launcher writes one line to stderr naming the
     tool and that a message was withheld.

  A final partial line at stream end is handled the same way. stderr is piped (no longer
  inherited raw) and redacted line by line as raw text. What the agent sends to the server
  is not filtered.
- **Launch errors** for a keyed tool (spawn failing in the bridge, the launcher or the K5
  route) report only `cannot start <program>: <error code>`, never the error's own message,
  which can echo environment values.
### K5. Which agents can use keyed tools
- **Claude, Antigravity (Gemini), unrestricted Codex:** through MCP, with keys, as in K3.
  No added prompt, setting or step (Decision 9).
- **Sandboxed Codex** (the default for Codex sessions, and always for Codex project leads):
  keyed tools are not available. The session's tool problems say `tool <name> needs keys,
  which sandboxed Codex can't use; set Codex to unrestricted in Settings to use it`.
  `wc.js tool list` shows the same status. `wc.js tool run` on a keyed tool runs it without
  keys in the caller's process, as for any other tool there, and its output starts by saying
  so.
- **Kimi and Pi (OpenRouter)** run without a sandbox and have no MCP. There `wc.js tool run`
  on a keyed tool asks the machine service to run it, through a new agent route
  (`POST /v1/agent/tools/run`, authenticated by the session token). The machine runs it as
  the bridge would (K3, K4), from the session's worktree and pinned shared copy, and returns
  the redacted result.
  - **Environment and program lookup:** the CLI sends its own `PATH` with the request. The
    machine runs the tool with `toolEnv` of the machine's environment, with `PATH` set to
    the caller's and the tool's keys added. `list`'s program check for keyed tools on these
    AIs uses that same caller `PATH`, so `list` and `run` agree.
  - **Who may use the route:** the machine checks it before running anything, refusing with
    the reason otherwise. The session must be one that gets project tools at launch (the
    same eligibility discovery uses: not a reviewer, assistant or project lead), and its
    connector must declare the new manifest capability `keyedToolsByMachine: true` (set on
    Kimi and Pi only). The connector rule forbids checking provider names outside
    `connectors/`; `connectors/contract.js` and `connectors/README.md` list the new field.
  - **How the CLI picks:** `/v1/agent/tools` adds `keyed_run: "machine" | "local"` from
    that same eligibility.
  - **Lifetime:** the route kills the tool's process group if the request's connection
    closes before the tool ends (the CLI exiting or being killed), as the CLI's own exit
    handlers do for a local run.
  - Keyless tools on Kimi and Pi run locally, as today.
- Reviewers get no project tools, as today.

### K6. `wc.js tool` commands
- `list`: in a session, adds each keyed tool's key names, set or not set, read live through a
  new names-only agent route (never values). For sandboxed Codex it shows the K5 status.
  Without a session token (a scratch checkout), it lists the names with `key status
  unknown outside a session`.
- `check`: never uses keys, as now. When the tool declares keys, its output says it ran
  without them; for a server tool, it adds that a failure may come from that.
- `run`: when `keyed_run` is `machine`, a keyed tool goes through the K5 route. Otherwise
  (Claude, Antigravity, Codex, or no session token) it runs in the caller's process without
  keys, and for a keyed tool its output starts by saying so. On those AIs keyed tools are
  tried for real through MCP: script tools on the next call in a session that offered them,
  server tools from the next session.
- `new`: the script template is unchanged. The guide shows how to add `keys`.

### K7. What you see
- **Tools page** (`viewer/pages/project-tools.js`, `machine/lib/project-tools.js`): for the
  selected machine, a keyed tool with any key not set shows `needs key <KEY>, not set on
  this machine`, as in the mockup. Each row is checked against the store K2 says it uses,
  including the shared tools project's own Tools page, where its tools use the shared keys.
  There, a missing-key line adds `set it in Settings, Shared tools, Shared keys`.
- The project's **Keys on this machine** editor also lists every key name that the
  project's folder tools declare (set or not set), and its usage and remove texts name those
  tools beside any `.mcp.json` servers. A keyed tool that is otherwise working
  adds one line: `uses keys: not available to sandboxed Codex`. Key values never reach the
  page.
- **Settings, Shared tools** (`viewer/pages/settings.js`): a Shared keys part under the
  shared tools picker, as in the mockup. Above it sits a machine chooser, the same control
  the project Tools page uses for its keys (not drawn in the mockup). Every read and write
  goes to the machine shown, and switching machine reloads the list. It lists every key name that
  usable shared tools declare (set or not set), plus any other names stored. You can set a
  value (a password field), replace it, or remove a name. Values are write-only: the page
  only ever gets names and whether they are set. Saving uses the store's `revision`, so a
  change made elsewhere in the meantime is refused with "changed elsewhere, reload". The
  machine serializes shared-key saves and removals around that check and the write, as
  `machine/service.js` does for project keys with `projectToolsLocks`. The
  name rules are those of project keys, with the same refusal wording.
- Hub routes pass shared-key reads and writes to the chosen machine's service, like the
  project keys routes (`viewer/app/routes.js`).

### K8. The guide and instructions
`protocol/tools.md` replaces "keys are not supported yet" with: the `keys` field and an
example, where each kind of tool's keys come from (K2), what reaches the agent and what
doesn't (K3, including the `.mcp.json` caveat and the same-account limit in IDEA.md), output
redaction, never writing a key into a tool's files, which agents can use keyed tools (K5),
and how to try one (K6). The starting-instructions line for Kimi, Pi and sandboxed Codex
(easy-tools S11) is unchanged, except on sandboxed Codex, where it adds that keyed tools
are unavailable there.

### Not doing (this plan)
- No change to `.mcp.json` key injection (Decision 8).
- No keyed tools in sandboxed Codex (Decision 9).
- No HTTP folder tools (easy-tools Deferred 3) and no Windows-side folder tools.

### Validation
- K1, K2, K3 (declaring keys, store choice, keys only in the tool process and never in
  generated entries or the agent's environment, missing-key problems, mid-session removal):
  `node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js machine/test/project-keys.test.js machine/test/shared-keys.test.js` (shared-keys new).
- K4 (redaction including a key split across chunks, at the 2 MiB capture limit and at the
  1 MiB cut; short and NUL values counted as not set; server lines passed on at their
  newline, with a client that waits for each reply before sending more; a keyless line with
  id `9007199254740993` and a `1.0` passed byte for byte; raw replacement keeping `jsonrpc`,
  `id`, `method`; a `\u`-escaped key and a key as a property name each handled with the
  result checked against decoded content; withheld reply keeping its id; launch errors
  without values; non-JSON lines and stderr; output unchanged without keys):
  `node --test machine/test/key-redact.test.js machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js` (key-redact new).
- K5 (per-AI availability, sandboxed Codex problems text, Kimi/Pi route and its refusal
  for other providers):
  `node --test machine/test/project-mcp-codex.test.js machine/test/project-tools-service.test.js machine/test/kimi.test.js machine/test/pi.test.js machine/test/name-guard.test.js machine/test/connectors-contract.test.js`, after regenerating `connectors/registry.json` with `node connectors/export.js` (committed). The route tests cover refusals for a reviewer, an assistant, a project lead and a non-Kimi/Pi session, and killing the process group when the connection closes.
- K6 (including no session token): `node --test viewer/test/wc-tool.test.js`.
- K7 (including the shared tools project's own Tools page, switching machine in Shared keys,
  two saves on the same revision, short-value marking and refusals, folder-tool names in the
  project key editor): `node --test viewer/test/app-project-tools.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js machine/test/project-tools.test.js`, `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js`.
- K8: `grep -n '"keys"' protocol/tools.md` finds the example, and `grep -n -i "keys yet\|key support\|not supported yet" protocol/tools.md` finds nothing. Then read the rendered guide (CONTRIBUTING.md: protocol documents are reviewed as rendered).

### Mockups

| File | Screen / state | Size |
|------|----------------|------|
| graphs/mockup-shared-chosen-phone.html | Settings, Shared tools, project chosen, Shared keys (two keys, one missing) | 390x844 |
| graphs/mockup-tools-mixed-phone.html | Tools page, mixed statuses incl. "needs key X, not set on this machine" | 390x844 |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A keyed server's own request to the client that contains a key value and is withheld may leave the server waiting or misroute the error | Rare path: needs a server-originated request carrying its key | review-round-3 |
| An agent that reads the key store files on disk can find key values | Same OS account; IDEA.md Not doing | planning |

## Review Rounds

### Round 1 — 2026-11-25

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Byte hold-back stalls keyed servers; drifts from Decision 5 | upheld | K4: server stdout per line, flushed at newline (Decision 10) |
| intent | minor | Tools page store vs shared tools project's own threads | upheld | K2 execution rule; K7 uses it |
| mechanics | blocking | Hold-back stalls servers at initialization | upheld | Same fix as intent 1; test with a waiting client |
| mechanics | blocking | Byte replacement can corrupt JSON-RPC framing and ids | upheld | K4: decode JSON, redact string values except `jsonrpc`/`id`/`method`; 8-character minimum (Decisions 10, 11) |
| mechanics | major | `\u`-escaped key slips past raw/escaped matching | upheld | K4: match decoded strings; test against decoded content |
| mechanics | major | Machine run route lacks role/conversation gate | upheld | K5: same eligibility as discovery plus connector capability |
| mechanics | major | Remote run lifetime when CLI exits | upheld | K5: kill group on connection close |
| mechanics | major | Mid-session key add vs live Kimi/Pi runs | upheld | K3: every run reads the store; MCP list fixed at start |
| mechanics | major | Tools page store for shared project's own tools | downgraded (minor) | Worst case Collin sets the key in the wrong place and sees it still missing; same fix as intent 2 |
| mechanics | major | Shared-key save race on revision | downgraded (minor) | Needs two saves in one round-trip; fixed anyway: K7 serializes like `projectToolsLocks` |
| mechanics | minor | CLI dispatch signal; connector name guard | upheld | K5: `keyedToolsByMachine` capability, `keyed_run` field; name-guard test |
| mechanics | minor | Tokenless CLI path for keyed tools | upheld | K6: list says unknown; run local without keys |
| mechanics | minor | Mockup lacks machine chooser | upheld | K7 + Decision 12 |
| mechanics | minor | K8 grep passes today; rendered review | upheld | K8 validation: negative grep plus rendered read |

### Round 2 — 2026-11-25

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** K2 (8-character minimum; execution rule), K3 (mid-session changes, live reads), K4 (rewritten: script hold-back; server per-line JSON redaction), K5 (machine route gate, capability, `keyed_run`, lifetime), K6 (tokenless, dispatch), K7 (store rule on the shared project's page; machine chooser; serialized saves), Validation, Decisions 10–12.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Project key editor doesn't list folder-tool key names | upheld | K7: editor lists declared names; usage/remove texts name tools |
| intent | minor | Shared project's own page offers the wrong editor | upheld | K7: missing-key line points to Settings, Shared keys |
| intent | minor | Editors accept short values that tools reject | upheld | K2: Shared keys refuses; project editor marks (Decision 14) |
| intent | minor | JSON re-encoding changes numbers | upheld | K4: keyless lines byte for byte (Decision 13) |
| intent | minor | Pi and contract tests missing from K5 validation | upheld | Added |
| mechanics | blocking | JSON round trip rewrites large integer ids | upheld | Same fix as intent 4; test with `9007199254740993` |
| mechanics | blocking | Key in property names or envelope can't be safely rewritten | upheld | K4: withhold message (Decision 13) |
| mechanics | blocking | NUL-containing value makes spawn echo it | upheld | K2 usable values; K4 launch errors carry only the code |
| mechanics | major | Machine-run env and PATH unspecified | upheld | K5: caller's PATH sent; list uses the same |
| mechanics | minor | Names response can't show short value; Remove hidden | upheld | K2: `folder_usable` with reason; Remove stays |
| mechanics | minor | Registry regeneration missing | upheld | K5 validation: `node connectors/export.js` |
| mechanics | minor | K8 negative grep still passes | upheld | Pattern now matches the current wording |

### Round 3 — 2026-11-25

**Lanes:** intent: gpt / gpt-6.2-sol (claude unavailable); mechanics: gpt / gpt-6.2-sol; cross-family: no.

**Changed since Round 2:** K2 (usable values: 8 characters, no NUL; editors and names routes), K4 (server lines: unchanged, raw replacement, or withheld; launch errors), K5 (environment and PATH; registry), K7 (project editor lists folder-tool names; shared project's page points to Shared keys), Validation, Decisions 13–14.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Withheld reply copies a key-bearing `id` back | upheld | Pending split question |
| intent | blocking | Script output leaks JSON-escaped keys (quotes, backslashes) | upheld | Pending: restrict usable key characters |
| intent | blocking | Multiline keys pass line-by-line server stderr | upheld | Pending split question |
| intent | minor | Project key editor lists shared project's tools under the project store | upheld | Pending: editor uses K2's store rule |
| mechanics | blocking | Same as intent 1 (key in `id`) | upheld | Pending split question |
| mechanics | blocking | Withheld reply may round a large `id` | upheld | Pending split question |
| mechanics | blocking | Multiline keys across server line boundaries | upheld | Same as intent 3 |
| mechanics | blocking | Withholding a server-originated request misroutes the error | accepted-risk | Rare path: a server request that itself carries the key |
| mechanics | minor | Same as intent 4 | upheld | Pending: editor uses K2's store rule |
| mechanics | minor | Tools page folder status stale after a key save | upheld | Pending: re-read status after save |
| mechanics | minor | Kimi/Pi hint missing when only a key blocks a script | upheld | Pending: keep the hint |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
