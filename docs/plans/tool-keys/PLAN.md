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
| 15 | Keys for server tools split into their own thread; here only script tools get keys, and a server tool with `keys` is not connected and says so | Collin: split it off, after three review rounds of leak findings in server output | idea-change |
| 16 | Usable key values: 8–4096 characters of letters, digits and `. _ ~ + / = -`; redaction also matches `/` written as `\/` (supersedes 14's value rule) | Removes escaped and multiline leaks in script output | review-round-3 |
| 17 | Redaction matches every spelling where each key character is itself, `\uXXXX`, a backslash escape or `%XX` (supersedes 16's `\/` rule) | One rule instead of a growing list of encoders | review-round-4 |
| 18 | Server tools with `keys` are refused by `validateToolJson`, so the launcher never starts them | The launcher re-validates; one gate covers every path | review-round-4 |
| 19 | Supersedes 17: plain keys are replaced; if a key survives in any decoding (up to three rounds of JSON/backslash unescaping and percent-decoding), the stream is withheld; other transforms (base64, hashing, splitting) are the stated limit | One rule that ends the chase; pending Collin's answer on the limit | review-round-5 |

## Spec

Builds on the merged easy-tools work (`docs/plans/easy-tools/PLAN.md`, PR #196); everything
there stays as it is except where an item below changes it. Current code is mapped in
`docs/maps/folder-tool-keys.md`.

### K1. Declaring keys
`tool.json` gains an optional `keys`: an array of 1 to 20 unique key names. Each name must
match `KEY_NAME` and must not be reserved (`isReserved`), both in `machine/lib/project-keys.js`.
Anything else makes the tool invalid, and the reason names `keys`. The validated tool
(`validateToolJson`, `machine/lib/folder-tools.js`) carries `keys` (an empty array when
absent), so discovery and the bridge's changed-tool check see it. A tool with no `keys`
behaves exactly as today.
- **Script tools only.** Keys for server tools are split into their own thread (Decision 15).
  `validateToolJson` refuses a server tool with a non-empty `keys`, with the reason `keys for
  server tools aren't supported yet`. Since discovery, the launcher
  (`machine/lib/tool-launch.js`, which re-validates before every start) and `wc.js tool` all
  use that validator, such a tool is never started or connected, even if `keys` is added
  mid-session. Its status everywhere (session tool problems, `wc.js tool list`, the Tools
  page) is that reason, except that a shared tool hidden by a same-named project tool shows
  `hidden` as today. It is still never started.

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
  **usable**: 8 to 4096 characters, each an ASCII letter, an ASCII digit or one of `. _ ~ + / = -` (what
  real API keys use). Any other stored value counts as not set, and the status gives the
  reason: `value too short (under 8 characters)`, `value too long` or `value has characters
  folder tools can't use (letters, digits and . _ ~ + / = - only)`. With these characters a
  key can't span lines, and K4 can catch every way common encoders spell it.
- The Shared keys editor refuses an unusable value, with that same wording. The project key
  editor still accepts any non-empty value (`.mcp.json` servers may use short ones). It
  marks a stored value that folder tools can't use with `can't be used by folder tools:
  <reason>` beside its name. The key-names
  routes return, per name, `set` and `folder_usable` (with the reason), never the value. A
  name whose value is unusable still shows its Remove control.
- **Which store a tool uses** (the execution rule) is decided only by K2, and every place
  that shows key status (K6, K7) uses the same rule.

### K3. What reaches the tool, and what never reaches the agent
- The bridge (`machine/lib/tool-bridge.js`) reads the right store itself on **each call**
  and adds exactly the tool's declared keys to the environment it builds with `toolEnv`.
  The generated bridge entry (`bridgeEntry`) passes only what it takes to find the store:
  `--state-dir`, and `project` or `shared` per tool. It never carries a key value.
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
  makes the next run return the missing-key text as an error and run nothing. Adding a key that was missing at
  session start makes the tool usable on Kimi and Pi at once (their `wc.js tool list` and
  `run` read live), and through MCP from the next agent start (a new session, a resume or
  an account switch, which rediscover tools), because the MCP tool list is
  fixed at start.

### K4. Hiding key values in output
Redaction lives in `machine/lib/key-redact.js` and works on the tool's own key values (K2).
A tool with no keys gets no redaction, and its output is passed through exactly as today.
- **Script tools** (`machine/lib/tool-run.js`): the runner keeps raw bytes: stdout up to the
  2 MiB capture limit, and the last 64 KiB of stderr. Nothing is returned until the process
  has ended, whether it exits, times out or its pipes are closed by force. Then each capture
  is processed in this order:
  1. **Cut edges.** Where a capture was cut (stdout at its limit, a stderr window that
     starts mid-stream, or a pipe closed by force), the bytes within (longest key − 1) of
     that cut are dropped, so no key fragment survives.
  2. **Plain keys.** Every occurrence of a key value is replaced with `[key <NAME>]`.
  3. **Disguised keys.** The text is decoded up to three times, in every order, with two
     decoders: JSON/backslash unescaping (`\uXXXX`, `\/` and the like) and percent-decoding
     (`%XX`). If any decoded version contains a key value, that stream's whole text becomes
     `[output withheld: it contained a key value]`. This catches .NET's `\u002B`, PHP's
     `\/`, URL encoding, a URL inside a URL, and escaped text logged again as JSON.
  4. **Cuts for the agent.** Only then come the 1 MiB result cut and the 4 KiB stderr tail.
- **The limit.** Redaction catches a key as written and under up to three layers of those
  standard escapes. Other transforms are not caught: base64 (for example an HTTP Basic auth
  header), hashing, or splitting the key up. The guide tells authors never to print or log a
  key in any form (Decision 19).
- **Launch errors** for a keyed tool (spawn failing in the bridge or the K5 route) report
  only `cannot start <program>: <error code>`, never the error's own message, which can echo
  environment values.

### K5. Which agents can use keyed tools
- **Claude, Antigravity (Gemini), unrestricted Codex:** keyed script tools through MCP, with
  keys, as in K3.
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
  - **Reading the result:** the CLI collects the whole response body as bytes and decodes
    it as UTF-8 once, so a character split across chunks is never damaged.
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
- `check`: never uses keys, as now. For a script tool that declares keys, its output says
  the tool was validated without using keys. A server tool with `keys` gets the K1 status.
- `run`: when `keyed_run` is `machine`, a keyed tool goes through the K5 route. Otherwise
  (Claude, Antigravity, Codex, or no session token) it runs in the caller's process without
  keys, and for a keyed tool its output starts by saying so. On those AIs keyed tools are
  tried for real through MCP, on the next call in a session that offered them.
- `new`: the script template is unchanged. The guide shows how to add `keys`.

### K7. What you see
- **Tools page** (`viewer/pages/project-tools.js`, `machine/lib/project-tools.js`): for the
  selected machine, a keyed tool with any key not set shows `needs key <KEY>, not set on
  this machine`, as in the mockup. Each row is checked against the store K2 says it uses,
  including the shared tools project's own Tools page, where its tools use the shared keys.
  There, a missing-key line adds `set it in Settings, Shared tools, Shared keys`. A keyed
  tool that is otherwise working adds one line: `uses keys: not available to sandboxed
  Codex`. Key values never reach the page.
- The project's **Keys on this machine** editor also lists every key name declared by the
  folder tools that use the project store (K2), set or not set. Its usage and remove texts
  name those tools beside any `.mcp.json` servers. On the shared tools project's own page,
  its folder tools use the shared store, so the editor lists only its `.mcp.json` names.
- After a **key-only** save or removal on the Tools page, only the key names and folder tool
  statuses are read again, so a `needs key` line clears without a reload. Unsaved
  `.mcp.json` tool edits, Windows settings and other pending key values stay as they are.
  This also applies when a key-only save is refused because the keys changed elsewhere: the
  page says so, refreshes the key names and statuses, and keeps the drafts. A save that also
  opens a `.mcp.json` pull request reloads the page as today.
- **Settings, Shared tools** (`viewer/pages/settings.js`): a Shared keys part under the
  shared tools picker, as in the mockup. Above it sits a machine chooser, the same control
  the project Tools page uses for its keys (not drawn in the mockup). Every read and write
  goes to the machine shown, and switching machine reloads the list. It lists every key name that
  usable shared tools declare (set or not set), plus any other names stored. The
  declarations come from that machine's newest shared copy. If it has none yet, the machine
  fetches one as a session start would (easy-tools S3, 20-second limit). If that fails, the
  part shows the stored names and `couldn't read the shared tools: <reason>`. You can set a
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
and how to try one (K6), and that server tools can't have keys yet. The starting-instructions
line for Kimi, Pi and sandboxed Codex (easy-tools S11) is unchanged, except that on
sandboxed Codex it adds that keyed tools are unavailable there. It is also given on Kimi
and Pi when the only thing stopping a script tool is a missing key, since adding the key
makes it usable mid-session (K3).

### Not doing (this plan)
- No change to `.mcp.json` key injection (Decision 8).
- No keyed tools in sandboxed Codex (Decision 9).
- No keys for server tools: their own thread (Decision 15).
- No HTTP folder tools (easy-tools Deferred 3) and no Windows-side folder tools.

### Validation
- K1, K2, K3 (declaring keys, store choice, keys only in the tool process and never in
  generated entries or the agent's environment, missing-key problems, mid-session removal,
  server tools with keys refused by the validator, so not in generated entries and not
  started by the launcher, while keyless servers still connect):
  `node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js machine/test/project-keys.test.js machine/test/shared-keys.test.js` (shared-keys new).
- K4 (redaction including a key split across chunks, at the 2 MiB capture limit and at the
  1 MiB cut and in a forced-close or timed-out stream; plain keys replaced; withheld for
  `\u002B`, `\/`, `%2B`, `%252B` (a URL inside a URL) and a `JSON.stringify` of
  already-escaped text; a base64 form is not caught (the stated limit); non-ASCII values
  counted as not set; launch errors
  without values; output unchanged without keys):
  `node --test machine/test/key-redact.test.js machine/test/folder-tools-run.test.js` (key-redact new).
- K5 (per-AI availability, sandboxed Codex problems text, Kimi/Pi route and its refusal
  for other providers):
  `node --test machine/test/project-mcp-codex.test.js machine/test/project-tools-service.test.js machine/test/kimi.test.js machine/test/pi.test.js machine/test/name-guard.test.js machine/test/connectors-contract.test.js`, after regenerating `connectors/registry.json` with `node connectors/export.js` (committed). The route tests cover refusals for a reviewer, an assistant, a project lead and a non-Kimi/Pi session, and killing the process group when the connection closes.
- K6 (including no session token, and a machine-run result with a multibyte character split
  across chunks): `node --test viewer/test/wc-tool.test.js`.
- K8 hint on Kimi/Pi when only a key is missing: `node --test machine/test/project-tools-service.test.js`.
- K7 (including the shared tools project's own Tools page, switching machine in Shared keys,
  two saves on the same revision, unusable-value marking and refusals, folder-tool names in
  the project key editor (not on the shared project's page), status refresh after a save
  with a `.mcp.json` edit pending, a key-only save refused by a change in another tab keeping
  drafts, a combined save still reloading, Shared keys on a machine with no shared copy yet): `node --test viewer/test/app-project-tools.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js machine/test/project-tools.test.js`, `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js`.
- K8: `grep -n '"keys"' protocol/tools.md` finds the example, and `grep -n -i "do not support keys yet\|must wait for key support" protocol/tools.md` finds nothing. Then read the rendered guide (CONTRIBUTING.md: protocol documents are reviewed as rendered).

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
| intent | blocking | Withheld reply copies a key-bearing `id` back | upheld | Moved to the server-tools thread (Decision 15) |
| intent | blocking | Script output leaks JSON-escaped keys (quotes, backslashes) | upheld | K2 character rule, K4 `\/` form (Decision 16) |
| intent | blocking | Multiline keys pass line-by-line server stderr | upheld | Moved to the server-tools thread (Decision 15) |
| intent | minor | Project key editor lists shared project's tools under the project store | upheld | K7: editor uses K2's store rule |
| mechanics | blocking | Same as intent 1 (key in `id`) | upheld | Moved to the server-tools thread (Decision 15) |
| mechanics | blocking | Withheld reply may round a large `id` | upheld | Moved to the server-tools thread (Decision 15) |
| mechanics | blocking | Multiline keys across server line boundaries | upheld | Moved to the server-tools thread (Decision 15) |
| mechanics | blocking | Withholding a server-originated request misroutes the error | accepted-risk | Rare path: a server request that itself carries the key |
| mechanics | minor | Same as intent 4 | upheld | K7: editor uses K2's store rule |
| mechanics | minor | Tools page folder status stale after a key save | upheld | K7: statuses re-read after a save |
| mechanics | minor | Kimi/Pi hint missing when only a key blocks a script | upheld | K8: hint kept when only a key is missing |

### Round 4 — 2026-11-25

**Lanes:** intent: gpt / gpt-6.2-sol (claude unavailable); mechanics: gpt / gpt-6.2-sol; cross-family: no.

**Changed since Round 3:** Server-tool keys split off (Decision 15, IDEA.md Not doing): K1 (server tools with keys not connected), K3 (bridge only), K4 (script redaction only; `\/` form), K6, K8 (no server keys; Kimi/Pi hint when only a key is missing). K2 usable-value character rule (Decision 16). K7 (project editor uses K2's store rule; statuses refresh after a save). Validation.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Percent-encoded key in a request URL escapes redaction | upheld | K4: any-spelling matcher (Decision 17) |
| intent | minor | Script `check` would claim it "ran" | upheld | K6: "validated without using keys" |
| mechanics | blocking | .NET `\u002B` escape escapes redaction | upheld | Same fix as intent 1 |
| mechanics | blocking | Launcher could start a server that gains `keys` mid-session | upheld | K1: validator refuses (Decision 18) |
| mechanics | major | Status refresh would wipe unsaved `.mcp.json` edits | upheld | K7: only folder statuses re-read |
| mechanics | minor | Shared keys declarations with no shared copy | upheld | K7: fetch as a session start; failure text |
| mechanics | minor | K8 grep rejects valid wording | upheld | Grep scoped to current wording |
| mechanics | minor | Launch test suite missing | upheld | Added to K1–K3 validation |

### Round 5 — 2026-11-25

**Lanes:** intent: gpt / gpt-6.2-sol (claude unavailable); mechanics: gpt / gpt-6.2-sol; cross-family: no.

**Changed since Round 4:** K4 any-spelling matcher (Decision 17), K1 validator refusal for keyed servers (Decision 18), K6 `check` wording, K7 (refresh keeps unsaved edits; Shared keys with no shared copy), K2 wording, Validation.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Key in a URL inside a URL (`%252B`) escapes | upheld | K4: decode up to three rounds, then withhold (Decision 19) |
| intent | minor | Combined save and PR must still reload | upheld | K7: refresh rule scoped to key-only saves |
| intent | minor | "Next session" where resume also rediscovers | upheld | K3: "next agent start" |
| mechanics | blocking | Escaped text re-escaped by `JSON.stringify` escapes | upheld | Same fix as intent 1 |
| mechanics | blocking | Held bytes flushed on timeout or forced pipe close | upheld | K4: nothing returned until the end; cut edges dropped |
| mechanics | major | Key-only conflict reload wipes drafts | upheld | K7: conflict keeps drafts |
| mechanics | major | Machine-run result decoded per chunk | upheld | K5: decode whole body once |
| mechanics | minor | Hidden vs refused status precedence | upheld | K1: `hidden` wins for display |
| mechanics | minor | "Letter/digit" must be ASCII | upheld | K2: ASCII |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
