---
slug: shell-tool-keys
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-27
---

# Keyed folder tools for Kimi and Pi

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | Collin picked it | user |
| 2 | Sandboxed Codex keeps its "set Codex to unrestricted" line; only Kimi and Pi get machine runs | Running tools on the machine for a sandboxed agent would get around its sandbox (IDEA.md Not doing) | user |
| 3 | No designer: the only visible change is that a problems line disappears and `list` shows key status, both in existing text formats | Nothing new to draw | defaulted |
| 4 | Which sessions may use machine runs is a new optional connector machine function `keyedToolsByMachine(session)` (true on Kimi and Pi), plus the same role eligibility launch discovery uses; no provider names outside `connectors/` | Old review round 1 and 2 findings; repo's connector rule | defaulted |
| 5 | The CLI sends its own environment (PATH included); the machine runs the tool with that environment, minus the session token, plus the keys. Discovery for the run uses that same PATH | A machine run then sees exactly what a local run or the MCP bridge (started by the agent) would; `list` and `run` agree on program lookup (old round 2 finding) | defaulted |
| 6 | Keys are bound to agent start, as for MCP: only keyed tools whose keys were all set at launch run, and only while their declared key names are unchanged; values are read on each run | Same rule the guide already states for MCP, so one rule for every AI | defaulted |
| 7 | The CLI reads the whole response as bytes and decodes once; any connection loss or unreadable body after the request was sent prints "the tool may already have run" and no partial result; a refused connection says the tool did not run | Old round 6 finding; refused connections can't have run anything | defaulted |
| 8 | Each machine run gets its own cancel handle; a closed connection kills only that run's process group; service shutdown kills every live tool group through the runner's existing exit handlers | Old round 1 and 10 findings; MAP: global `killAll` is unsafe per request | defaulted |
| 9 | Keyless tools on Kimi and Pi keep running locally, and Claude, Antigravity and Codex are unchanged | IDEA.md What good looks like | defaulted |

## Spec

Terms: a **keyed tool** is a folder script tool whose `tool.json` declares `keys`
(`protocol/tools.md`, Keys). A **machine run** is the machine service running a keyed tool
for a session, with its keys, and returning the redacted result. The MCP bridge path
(`machine/lib/tool-bridge.js`) and every keyless tool behave exactly as today.

### S1. Connector capability

- Add `keyedToolsByMachine` to `OPTIONAL.machine` in `connectors/contract.js` and to the
  optional-function table in `connectors/README.md`: `keyedToolsByMachine(session)` returns
  `true` when keyed tools in a shell-only session run through the machine.
- Kimi (`connectors/kimi/machine.js`) and Pi (`connectors/pi/machine.js`) define
  `keyedToolsByMachine() { return true; }` and drop `keyedToolsReason` (so it is absent,
  meaning no reason). Codex is unchanged.
- **Eligible session** (used in S2, S3 and S4): the session's role is in `TOOL_ROLES`
  (`machine/lib/project-mcp.js:9`), it is not an assistant or project lead, its connector's
  `shellToolsOnly(session)` is true, and its connector's `keyedToolsByMachine(session)` is
  true. One helper in `machine/service.js` (or `machine/lib/`) computes this; launch, the
  tools route and the run route all call it. No provider or CLI name is compared outside
  `connectors/`.
- Run `node connectors/export.js` if the change affects the exported registry, and commit
  its output.

### S2. Launch

In `prepareLaunch` (`machine/service.js`, folder tools part), for an eligible session:

- Keyed script tools are **not** filtered out of the problems and get **no**
  "needs keys, which …" line. They go through the same missing-key check MCP sessions get:
  a tool with any key not set gets the existing `tool <name> needs key(s) …, not set on
  this machine` line (`shared tool …` for shared tools).
- Each keyed tool that passes is recorded on the session record as
  `machine_keyed_tools: [{ name, source, keys }]` (key **names** only, never values), and
  persisted with the session like other launch fields. A resume or account switch
  re-runs launch and replaces the list. A non-eligible session has no such field (or an
  empty one).
- Keyed tools never go into the MCP bridge entry for these sessions (as today).
- The starting-instructions line for shell-only sessions adds the clause "Tools that need
  keys aren't available in this session (…)" **only** when `keyedToolsReason(session)`
  returns text; on Kimi and Pi it is left out. For eligible sessions with a keyed tool,
  the line instead adds: "`wc.js tool run` runs tools that need keys on the machine with
  their keys; their key values never appear in the result."
- Sandboxed Codex launch text and lines are unchanged.

### S3. `POST /v1/agent/tools`

Adds `keyed_run`: `"machine"` for an eligible session, `"local"` otherwise.
`keyed_unavailable` stays as today (now `null` on Kimi and Pi). `machine/API.md` documents
both fields (its row currently lists only `worktree` and `shared_copy`).

### S4. `POST /v1/agent/tools/run`

New agent route, authenticated with the session token like the other `/v1/agent/*` routes.
Body: `{ name, input, env }` — `name` a tool name, `input` a JSON object, `env` an object
of string values (the caller's environment).

Checks, in order, before anything runs; each refusal is `{ error }` with the status shown
and runs nothing:

1. Session not eligible (S1): 403 `this session can't run keyed tools through the machine`.
2. Body invalid (`name` not a string, `input` not a plain object, `env` not an object of
   strings, or `env.PATH` missing): 400 naming the field.
3. Discover with `folderTools.discover({ worktree: session.worktree, shared:
   session.shared_tools?.copy, path: env.PATH })`, the machine's own record of the
   worktree and pinned shared copy, never caller-supplied paths. No visible row with that
   name: 404 `unknown tool: <name>`. Row not ok: 422 `<name>: <reason>`. Not a script:
   422 `server tools must be used through MCP or check`. No `keys`: 422 `<name> has no
   keys; run it with wc.js tool run in your own shell` (the CLI never sends these, S5).
4. Not in `machine_keyed_tools` with the same source and the same key names (order
   ignored): 409 with the bridge's changed-tool text, `The tool changed. Its keys are used
   from the next agent start (a new session, a resume or an account switch).` (A tool
   added, or whose keys were missing, after launch is the same case.)
5. Read the store (`folderTools.toolKeyStore(row, !!session.shared_tools?.own)`, then
   `readSharedKeys` or `readKeyStore` as the bridge does). Store read error: 500 with its
   message. Any declared key not set or not usable: 422 with the bridge's missing-key text
   `tool <name> needs key(s) <K…>, not set on this machine`.

Run: `env` is `toolEnv(callerEnv, session.worktree)` (strips `WHEELCHAIR_SESSION_TOKEN`,
sets `WHEELCHAIR_PROJECT_DIR`) with each declared key set to its stored value, overriding
any same-named caller variable. Call `runScript({ dir: row.dir, tool: row.tool, input,
env, keys: values, signal })` (S6). Respond 200 with
`{ ok, text, stderr, code, signal, timed_out, truncated }` from its result; a `refused`
result (Node child-process debug on) is 422 with that text. Key values appear nowhere in
the response except as already redacted by `runScript`, nowhere in logs, and nowhere in
the session record.

- **Disconnect:** if the client connection closes before the response is written, abort
  the run's signal so its process group is killed (S6), and write nothing.
- **Service shutdown:** before the first machine run, the service calls the runner's
  `installExitHandlers()` (`machine/lib/tool-run.js`), so a stop or restart (SIGTERM,
  SIGINT, SIGHUP, or normal exit) kills every live tool group, as the bridge does today.

### S5. `wc.js tool` CLI (`viewer/app/tool-cli.js`, `viewer/app/wc.js`)

- `roots` also returns `keyed_run` (missing means `"local"`, for an older machine).
- `run` on a keyed tool when `keyed_run` is `"machine"`: the CLI still does its own local
  discovery and checks as today (unknown, not ok, server), then posts `{ name, input,
  env: process.env }` to `/v1/agent/tools/run` instead of running locally, and prints no
  "Ran without folder-tool keys" line.
  - 200 and `ok`: write `text` to stdout, exit 0.
  - 200 and not `ok`: fail with the same message a local run gives (`tool failed (exit
    code …, signal …[, timed out])[: stderr]`).
  - Any other status with a readable `{ error }` body: fail with that error.
  - The connection was refused or the machine could not be reached before the request was
    sent: fail with `couldn't reach the machine service; the tool did not run`.
  - The connection broke after the request was sent, the response ended early, or the
    body is not valid JSON of the expected shape: fail with `lost the connection to the
    machine before the tool's result arrived; the tool may already have run, so check
    before running it again`, printing no partial result.
- The response is collected as bytes (`Buffer` chunks) and decoded as UTF-8 once at the
  end, so a character split across chunks is never damaged. This uses its own request
  function (or an option on the shared one) that also listens for `aborted`/`error` on
  the response; other `wc.js` commands are unchanged.
- The CLI sets no timeout of its own; if it is killed or exits, its connection closes and
  the machine kills the tool (S4).
- `run` on a keyless tool, and `run` everywhere `keyed_run` is `"local"`, behave exactly
  as today, including the "Ran without folder-tool keys" line for keyed tools.
- `list` on Kimi and Pi shows keyed tools' key status from `/v1/agent/tool-keys` as on
  Claude (it does already once `keyed_unavailable` is `null`); no change needed beyond
  confirming it with a test.

### S6. Runner cancel handle (`machine/lib/tool-run.js`)

`runScript` accepts an optional `signal` (an `AbortSignal`). When it aborts while the
child runs, the runner kills that child's process group (`killGroup`), marks open streams
as cut (as for a timeout), and resolves as it does after a kill. An already-aborted signal
runs nothing and resolves `{ ok: false, … }`. No other run is affected; `killAll` is
unchanged. The bridge and the local CLI path pass no signal and behave as today.

### S7. Guide and docs

- `protocol/tools.md` Keys: replace "sandboxed Codex, Kimi and Pi can't use them yet" with:
  Kimi and Pi run keyed tools through `wc.js tool run`, which asks the machine to run them
  with their keys and returns redacted output; sandboxed Codex can't use them (set Codex
  to unrestricted in Settings). The commands paragraph's `run` sentence says the same for
  Kimi and Pi, and that a lost connection means the tool may already have run.
- `machine/API.md`: the new route and the S3 fields.
- `connectors/README.md`: the S1 row.
- Routers (`AGENTS.md` files) only if a file-to-role entry becomes false.

### Not doing

Sandboxed Codex machine runs; server tools on Kimi and Pi; changes to key storage, entry
or redaction; folder tools for reviewers, assistants or project leads; a CLI-side timeout.

### Validation

Targeted tests to add (each names its file):

- `machine/test/folder-tools-run.test.js`: S6 — an aborted signal kills only that run's
  group (a second concurrent run completes); an already-aborted signal runs nothing.
- `machine/test/project-tools-service.test.js` (or a new
  `machine/test/tool-machine-run.test.js`): S4 — each refusal 1–5 with its status and
  text and nothing run; a Kimi-like session runs a keyed tool and gets its output with the
  key value replaced; the caller's `PATH` decides program lookup (a program only on the
  caller's PATH runs); caller env reaches the tool, the session token does not; a key
  overrides a same-named caller variable; closing the request mid-run kills the tool's
  group (a marker child is gone shortly after); a reviewer, assistant, project lead and
  sandboxed Codex session are refused.
- `machine/test/folder-tools-launch.test.js`: S2 — on Kimi and Pi, no "needs keys, which"
  line; a missing key gives the not-set line; `machine_keyed_tools` lists only fully keyed
  tools with names, no values; the instructions line has the machine-run clause and not
  the "aren't available" clause; sandboxed Codex unchanged.
- `viewer/test/wc-tool.test.js`: S5 — machine path success, tool failure, `{error}`
  refusal, refused connection ("did not run"), response cut mid-body and invalid JSON
  ("may already have run", no partial output), a multi-byte character split across two
  chunks decodes intact; `keyed_run: "local"` or missing keeps the local path and its line.
- `machine/test/connectors-contract.test.js`: Kimi and Pi define `keyedToolsByMachine`
  and no `keyedToolsReason`; the contract accepts the new optional member.

Commands:

```bash
node --test machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js machine/test/project-tools-service.test.js machine/test/key-redact.test.js machine/test/connectors-contract.test.js machine/test/name-guard.test.js
node --test viewer/test/wc-tool.test.js viewer/test/app-project-tools-card.test.js
node connectors/export.js --check
```

Plus any new test file named above, run with `node --test <file>`.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| An agent can edit a keyed tool's script in its worktree to print a key in a form redaction doesn't catch | Same as MCP today (parent plan, Decisions 20 and 23); the guide forbids it | planning |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
