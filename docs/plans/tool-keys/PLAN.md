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
- A key is **set** when the store has that name with a non-empty value.

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
- **Missing key.** At discovery, a keyed tool with any declared key not set is not offered.
  The session's tool problems name it: `tool <name> needs key <KEY>, not set on this
  machine` (for a shared tool, `shared tool <name> …`), naming every missing key. If a key
  is removed mid-session, a bridge call returns that same text as an MCP error and runs
  nothing, and a server that is already running keeps the keys it started with. A key
  added mid-session takes effect in the next session.

### K4. Hiding key values in output
One streaming redactor, `machine/lib/key-redact.js`, takes the tool's key values and
replaces every exact occurrence of each value with `[key <NAME>]`. It also catches the
value's JSON-escaped form (`JSON.stringify(value).slice(1,-1)`) when that differs. It works
on bytes as they arrive. It holds back the last (longest pattern length − 1) bytes until
more arrives or the stream ends. When a capture limit stops reading, the held-back bytes
are dropped, never sent.
- **Script tools** (`machine/lib/tool-run.js`): stdout and stderr each pass through the
  redactor before the 2 MiB capture limit, the 1 MiB result cut and the 4 KiB stderr tail.
  So no cut can leave part of a key showing, and the launch-error text is redacted too.
- **Server tools**: the launcher pipes the server's stdout and stderr through the redactor
  before passing them on (stderr is no longer inherited raw). What the agent sends to the
  server is not filtered.
- A tool with no keys gets no redaction and no hold-back, so its output timing is
  unchanged.
- Values shorter than 4 characters are still redacted. The guide says to use real-length
  keys, because short ones mangle output.

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
  on a keyed tool asks the machine service (a new agent route, authenticated by the session
  token), which runs it as the bridge would (K3, K4) from the session's worktree and pinned
  shared copy and returns the redacted result. The route refuses any session whose provider
  is not Kimi or Pi, with the reason. Keyless tools on Kimi and Pi run as today.
- Reviewers get no project tools, as today.

### K6. `wc.js tool` commands
- `list`: adds each keyed tool's key names, set or not set, from the machine service.
  Names only, never values (a new names-only agent route). For sandboxed Codex it shows the
  K5 status.
- `check`: never uses keys, as now. When the tool declares keys, its output says it ran
  without them, and for a server tool that a failure may come from that.
- `run` on Claude, Antigravity and Codex: runs in the caller's process without keys and
  says so for a keyed tool. Keyed tools are tried for real through MCP, in this session's
  next call (script tools) or the next session (server tools). On Kimi and Pi: as in K5.
- `new`: the script template is unchanged. The guide shows how to add `keys`.

### K7. What you see
- **Tools page** (`viewer/pages/project-tools.js`, `machine/lib/project-tools.js`): for the
  selected machine, a keyed tool with any key not set shows `needs key <KEY>, not set on
  this machine`, as in the mockup. A project tool is checked against the project's keys; a
  shared tool against that machine's shared keys. A keyed tool that is otherwise working
  adds one line: `uses keys: not available to sandboxed Codex`. Key values never reach the
  page.
- **Settings, Shared tools** (`viewer/pages/settings.js`): a Shared keys part under the
  shared tools picker, as in the mockup, for a chosen machine. It lists every key name that
  usable shared tools declare (set or not set), plus any other names stored. You can set a
  value (a password field), replace it, or remove a name. Values are write-only: the page
  only ever gets names and whether they are set. Saving uses the store's `revision`, so a
  change made elsewhere in the meantime is refused with "changed elsewhere, reload". The
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
  1 MiB cut; JSON-escaped form; server stdout and stderr; no hold-back without keys):
  `node --test machine/test/key-redact.test.js machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js` (key-redact new).
- K5 (per-AI availability, sandboxed Codex problems text, Kimi/Pi route and its refusal
  for other providers): `node --test machine/test/project-mcp-codex.test.js machine/test/project-tools-service.test.js machine/test/kimi.test.js`.
- K6: `node --test viewer/test/wc-tool.test.js`.
- K7: `node --test viewer/test/app-project-tools.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js machine/test/project-tools.test.js`, `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js`.
- K8: `grep -n "keys" protocol/tools.md` shows the new section; no line says keys are unsupported.


### Mockups

| File | Screen / state | Size |
|------|----------------|------|
| graphs/mockup-shared-chosen-phone.html | Settings, Shared tools, project chosen, Shared keys (two keys, one missing) | 390x844 |
| graphs/mockup-tools-mixed-phone.html | Tools page, mixed statuses incl. "needs key X, not set on this machine" | 390x844 |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| An agent that reads the key store files on disk can find key values | Same OS account; IDEA.md Not doing | planning |

## Review Rounds

### Round 1 — 2026-11-25

**Lanes:** pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
