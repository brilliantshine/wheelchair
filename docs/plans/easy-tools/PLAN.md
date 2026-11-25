---
slug: easy-tools
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-25
---

# Easy, standard tools for agents

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode: two-part | Settle how tools are written and connected first; hardening follows | user |
| 2 | Cover both per-project tools and tools shared across all projects, with one way of writing a tool | Some tools fit one project, others everywhere | user |
| 3 | Either Collin or agents make tools, following one standard; asking an agent should be easy | Agents follow a tight standard reliably; the same rules guide a person | user |
| 4 | A tool is a folder holding a short description (what it does, its inputs) plus a script in any language. Wheelchair runs one built-in MCP server per agent session that offers every tool and runs the script when called. No hand-written server | No server to write, any language, simplest for agents; each AI's MCP quirks handled once in the bridge | user |
| 5 | Tools connect automatically: any valid tool in the project's tools folder or the shared tools folder is offered at session start; invalid ones go on the thread's problems card | "Connecting" should be a non-step; explicit lists recreate the .mcp.json chore | defaulted |
| 6 | Shared tools live in their own git repository, added to wheelchair as an ordinary project. Threads in that project make and fix shared tools through the usual pull request; each machine offers the merged version | History, review and the normal thread flow; works across machines | user |
| 7 | Settings names which project holds the shared tools (one per hub, or none). At session start the machine fetches that project's default branch and reads the tools from it, falling back to the last fetched copy if the fetch fails | Agents get the merged version without anyone pulling by hand; a network drop does not lose tools | defaulted |
| 8 | When a project tool and a shared tool have the same name, the project tool wins and the problems card notes the shared one was hidden | The project knows its own needs best; the clash is visible | defaulted |
| 9 | Supersedes 4 in part: a tool folder holds either a script tool (as in 4) or a server tool, a real MCP server made from a wheelchair template. Wheelchair starts and connects both kinds automatically; no hand-editing .mcp.json | Servers keep state, answer fast and use all of MCP; template + automatic connection removes the setup-and-connect chore that prompted this idea | user |
| 10 | Keys: a tool's description lists the key names it needs; wheelchair passes only those to the tool's script or server process at start, never to the agent. Project tools read the project's keys; shared tools read a machine-wide set of shared keys typed once per machine in Settings | Keys out of the agent's reach; a shared tool's key typed once | user |
| 11 | Tools are requested by asking in any thread; no new button. Every lead gets the tool guide. Shared tools are made in a thread of the shared tools project (the assistant can start one) | Reuses how Collin already asks for changes | user |
| 12 | The Tools page lists every folder tool read-only: name, script or server, project or shared, and working or the reason not. Settings also gains the shared tools project picker and shared keys | Seeing what exists and what is broken, from a phone; read-only keeps it small (changes go through a thread) | user |
| 13 | Folder layout `.wheelchair/tools/<name>/tool.json` (+ the tool's files), in a project repo and in the shared tools repo alike; `<name>` is letters, digits, `_`, `-`, at most 40 characters and must equal `name` in tool.json | One layout for both homes; a hidden folder avoids clashing with a project's own `tools/` | defaulted |
| 14 | Script tool protocol: wheelchair runs the tool's `run` command in its folder with the inputs as JSON on stdin; stdout is the result text; a non-zero exit returns an error carrying stderr; default time limit 120 s, a tool may set up to 600 s | Works in any language with no library | defaulted |
| 15 | Folder tools reach agents through the existing project-tools path: the machine adds synthetic stdio entries (one `wheelchair-tools` bridge for script tools, one entry per server tool) to the servers it already passes to connectors, so each AI's existing translation and limits apply unchanged | Reuses tested per-AI wiring instead of a second one | defaulted |
| 16 | `wc.js tool new|list|check|run` commands; `run` also lets Kimi and Pi agents use script tools from the shell | A scaffold and a test command make "follow the standard" concrete for agents; shell access comes almost free | defaulted |
| 17 | The tool guide lives at `protocol/tools.md` (canonical, per CONTRIBUTING.md); role rules for lead, sub-lead and worker point to it; the README gets a short section pointing to it | protocol/ holds canonical rules | defaulted |
| 18 | One server template, Node.js, using a small zero-dependency MCP stdio helper shipped with wheelchair; other languages can still write a server by hand | One well-tested template beats several thin ones; Node is already required | defaulted |
| 19 | Mockups agreed: mockup-tools-mixed-phone, mockup-tools-empty-phone, mockup-tools-mixed-desktop, mockup-shared-none-phone, mockup-shared-chosen-phone (designer's single version, commit 2e82b6fe) | Collin agreed them | user |
| 20 | Windows-side folder tools and server templates in other languages go to Deferred (follow-up thread) | Hardening and reach, not needed for the feature to work | defaulted |
| 21 | Supersedes 10: key handling for folder tools (tool-only keys, shared keys, keeping keys out of agent-visible output, the Shared keys section) is split into its own follow-up thread. This plan passes no keys to folder tools | Three review rounds kept finding problems only there; the rest had settled | user |

## Spec

A plan with visible work lists its agreed mockups under “Mockups” (path, screen/state, size) instead of describing the look in prose.

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

### S1. What a tool is
A tool is a folder with a description file and one of two kinds of body:
- **Script tool:** the description gives the name, a one-line purpose and named inputs with
  types and descriptions, plus a script in any language. When an agent calls the tool,
  wheelchair runs the script with the inputs and returns its output. Each call is a fresh run.
- **Server tool:** a real stdio MCP server, for tools that keep state between calls, are
  called often, or use MCP features beyond tools. It is either written from the wheelchair
  template, or an existing server ("connect this one"): its `start` command may launch any
  stdio MCP server, such as `npx -y some-mcp-server`. Wheelchair starts it for the session
  and connects it. HTTP MCP servers stay in `.mcp.json` (Deferred).
No author edits `.mcp.json` for either kind. Kimi and Pi load no MCP servers, so server
tools are unavailable there (the problems card says so). File names and formats: S7.

### S2. Connecting
No connect step. At each agent session start, wheelchair finds every tool in the project's
tools folder (from the thread's own worktree) and in the shared tools folder, and offers the
valid ones: script tools through one built-in MCP server for that session, server tools
each as their own MCP server. A broken tool is named, with
the reason, on the thread's existing "Project tools problem" card. Existing `.mcp.json`
servers keep working unchanged.

### S3. Shared tools
Shared tools live in their own git repository that Collin adds to wheelchair as an ordinary
project. Settings (one choice for the whole hub) names the shared tools project (or none),
stored as its GitHub repository (`owner/repo`, as `machine/lib/project-tools.js` `repoName`
reads it), not as a path. On each machine, the shared tools come from the first of the hub's
saved projects (in their saved order) whose path is a git repository on that machine with
that origin. If the machine has no such project, it offers
no shared tools and the problems card says "the shared tools project isn't added on this
machine". Threads in
that project make and change shared tools like any other work, ending in a pull request.
At each agent session start the machine fetches that project's default branch and updates
a machine-owned copy of that commit under the machine state directory
(`<state dir>/shared-tools/<project identity>/<commit>/`, made from the project's local
clone's object store and never touching Collin's own working copy). A session reads and
runs shared tools from the commit copy it started with, for its whole life: the commit is
recorded in the session's saved record, and a resume or account switch of the same session
reuses it. A newer commit gets a new copy. A copy is deleted only when it is not the newest
and no session record that has not ended (including ones found after a machine service
restart, and starts in progress) names it. If the fetch fails the newest existing copy is used; if there is none, no shared
tools are offered and the problems card says "shared tools couldn't be fetched: <reason>". A project tool
with the same name as a shared tool hides the shared one, and the problems card says so.
Inside the shared tools project's own threads, its tools come from the thread's worktree
(as project tools), so a tool being built can be tried before merge; the shared copy is not read for those sessions. The fetch is limited to 20 seconds; past that it counts as failed.

### S4. Keys: not in this plan
Key handling for folder tools was split into its own follow-up thread (Decision 21).
Here wheelchair passes no keys to folder tools: `tool.json` has no `keys` field, the bridge and server tools get the agent's session environment minus every
key name the session's `.mcp.json` referenced at launch, and minus `WHEELCHAIR_SESSION_TOKEN`
(the agent's wheelchair credential, as the screen launcher already strips it). At launch the
machine puts those key names, never values, in the agent's environment as
`WHEELCHAIR_TOOL_STRIP` (comma-separated); the bridge, the server launcher and
`wc.js tool run`/`check` all remove every listed name, `WHEELCHAIR_TOOL_STRIP` itself and
`WHEELCHAIR_SESSION_TOKEN` before spawning a tool program. Nothing reads the key store for them. The guide also says a key must never be written into `tool.json` or any file in the tool folder
(they are committed); a tool that needs a token waits for key support, or is listed in
`.mcp.json` with project keys as today.

### S5. Asking agents for a tool
There is no new button. Every thread lead (and the sub-leads and workers it briefs) can read one
tool guide that says how to make, connect and test both kinds of tool. A request like
"make me a tool that does X" in a project's thread is handled like any other change there
and ends in a pull request. A lead asked for a shared tool from another project's thread
says it belongs in the shared tools project and names that project; the tool is made in
a thread there, which Collin opens (or asks the assistant to open, using what the
assistant can already do; no assistant change in this plan).

### S6. What you see
The Tools page in Settings (`viewer/pages/project-tools.js`) gains a read-only list of
folder tools for the chosen project, including shared tools: each with its name, script
or server, project or shared, and whether it can be used or the reason it cannot (the same
reasons the problems card gives). "Can be used" means these launch-time checks pass: valid
`tool.json`; its `run`/`start` program found (in the tool folder or on the session's PATH);
not hidden. A server tool that passes these shows "server tools don't
work on Kimi or Pi" as its status, as in the mockup (a fixed fact about the kind). The page lists tools from the project's default branch
(as the page reads `.mcp.json` today; for a project without a GitHub origin the list says
"folder tools can only be listed for GitHub projects" for its own tools, and launch still works) plus the newest shared copy (listed for every project, GitHub or not; for a non-GitHub project its rows add "not checked against this project's own tools", since a project tool of the same name would hide it) (not added when the
page's project is the shared tools project itself), and checks programs
against the selected machine's PATH as the machine service sees it, so it can differ from a
thread that changed a tool. Per-AI limits and Codex's budget are reported only on the
thread's problems card, for the AI that session runs on. Whether a server actually answers is only checked by `wc.js tool check`. A
script tool that fails when called returns its error to the agent (S9); a server tool whose
launcher cannot start its program logs the reason to the machine log and exits non-zero,
so the AI reports the server as failed. Settings gains a picker for the shared tools project (or
none). The shared keys section and key statuses shown in the mockups are not built here
(S4). Existing
`.mcp.json` editing is unchanged. Look: see Mockups. In the invalid-description example, the reason names the field actually missing (`start` for a server tool), per S7.

### S7. The description file and folder
Every tool is `.wheelchair/tools/<name>/` holding `tool.json` and the tool's own files, in a
project repository or in the shared tools repository. `<name>` matches `^[A-Za-z0-9_-]{1,40}$`
and equals `tool.json`'s `name`. The name `wheelchair-tools` is reserved for the bridge
(S8) and refused. `tool.json` fields:
- `name` (string), `description` (one line, shown to agents), `kind` (`script` or `server`).

- Script only: `inputs`, an object of input name to `{type, description, required}` with
  `type` one of `string`, `number`, `boolean`, `object`, `array`; `run`, an argv array whose
  first element is a program on PATH or a path relative to the tool folder; `timeout_seconds`
  (optional, 1 to 600, default 120).
- Server only: `start`, an argv array as `run` above, launching a stdio MCP server.
A file that fails these rules makes that tool unusable with a reason on the problems card
and the Tools page; other tools are unaffected. Unknown fields are ignored.

### S8. How tools reach an agent
At session start, for the roles that get project tools today (lead, sub-lead, worker,
verifier; not reviewers, mappers, assistants or project leads), the machine reads folder
tools from the thread's worktree and from the shared tools copy (S3), applies S3's name
rule, and passes stdio entries to connectors as a new "extra servers" input alongside
the `.mcp.json` servers (`machine/service.js` `prepareLaunch`). This works when the
project has no `.mcp.json` at all. Each connector that loads project tools today
(Claude, Codex, Antigravity) gains support for that input in its own existing format:
Claude through its `--mcp-config` file, Codex as `project_<name>` overrides, Antigravity
in its per-session plugin. The entries are:
- one `wheelchair-tools` entry running a wheelchair bridge that offers every usable script
  tool as an MCP tool (name, description, input schema from `inputs`) and runs it per S9;
- one entry per usable server tool, running a wheelchair launcher that starts the tool's
  `start` command in its folder.
Each connector applies its existing per-AI limits to these entries (Kimi and Pi load no
servers and say so).  Folder entries never displace
`.mcp.json` entries: where a connector has a size budget (Codex's argument budget,
`connectors/codex/machine.js` `codexOverrides`), `.mcp.json` entries are measured first, then
folder entries are added one at a time (bridge first, then server tools by name) while they
fit; any that do not fit are left out and named on the problems card. A `.mcp.json` server with the same
name as one of these entries wins and the folder tool is reported hidden. Tools are read
once per session start; a tool changed mid-session reaches the next session.

### S9. Running a script tool
The bridge runs `run` with the tool folder as working directory, the inputs as one JSON
object on stdin, and the environment S4 describes. Script files are run live from the
worktree, so edits can be tried at once; only the offered description is fixed for the
session (see the `tool.json` check below). stdout (cut at 1 MiB, saying so)
is the result; a non-zero exit, a timeout or a launch failure returns an MCP error with the
exit code and the last 4 KiB of stderr. Both streams are drained to the end; stdout keeps its first 2 MiB and stderr a rolling
last 4 KiB.
The script runs in its own process group; on timeout, or when the bridge exits, the whole
group gets SIGTERM, then SIGKILL after 5 seconds. The bridge and the server launcher record each process group they start in a per-session file under
the machine state directory and remove the entry when it ends; when the machine service
sees the end of a session (including a session it recovered after its own restart), it sends
the same TERM-then-KILL to every group still recorded for it. A machine service stop or
restart kills nothing, since sessions outlive it. So a crashed bridge leaves nothing running.
`wc.js tool run`/`check` write no record (they run inside the caller's sandbox, which cannot
write machine state); they send the same TERM-then-KILL to their child's group on timeout,
on exit and on SIGINT, SIGTERM or SIGHUP, in or out of a session. Before each call the bridge re-reads the
tool's `tool.json`; if it differs from what was offered at session start, the call returns
an error saying the tool changed and to try it with `wc.js tool run` now or through MCP in
the next session. Calls may run in parallel; the bridge never runs the
same call twice.

### S10. The `wc.js tool` commands
`node <root>/viewer/app/wc.js tool <command>`. Tools are read from the session's current worktree files plus
the shared copy the session is pinned to (S3), so a tool just made with `new` can be
checked straight away.
- `new <name> --kind script|server`: writes a working example tool from the template into
  `.wheelchair/tools/<name>/` of the current worktree (in the shared tools project, that
  makes a shared tool). If that folder already exists it is refused and nothing is written.
  The script template is a short shell script; the server template is Node.js.
- `list`: the tools found, kind, source and status (S6's checks).
- `check [<name>]`: validates description files; for a server tool, starts it and confirms
  it answers the MCP handshake and lists at least one tool, with a 30-second deadline for
  the whole check; the server and its child processes are killed on success, failure,
  deadline or when `wc.js` exits.
- `run <name> --input '<json>'`: runs a script tool as the bridge would (S9) and prints the
  result. Kimi and Pi agents call script tools this way; on any AI it also tries a tool
  just made.
All four commands run inside the caller's own process (so inside its sandbox, if any); the machine service runs
nothing for them. They learn the session's pinned shared copy (S3) from the machine service,
authenticated by the session token; outside a session they read only the current folder. Only `new` writes
files, and the agent commits them as usual.

### S11. The guide
`protocol/tools.md` is the one guide for people and agents: what a tool is, both kinds,
`tool.json` fields with a full example of each, that keys are not supported yet (S4), project versus shared, the
`wc.js tool` commands, how to test before asking for review, and per-AI limits. The lead,
sub-lead and worker role rules gain one line pointing to it for any request to make or
change a tool. Agents on Kimi or Pi with at least one usable script tool get one added
line in their starting instructions naming those tools and the `wc.js tool run` command.
README.md's project tools section gains a short paragraph pointing to it.

### Not doing (this plan)
- No change to how `.mcp.json` servers are read, edited or launched.
- Folder tools run where sessions run: Linux, WSL's Linux side and macOS. Windows-side
  folder tools: Deferred.
- No editing tools from the app; the Tools page list is read-only.

### Mockups
All under `docs/plans/easy-tools/graphs/`:
| File | Screen / state | Size |
|---|---|---|
| mockup-tools-mixed-phone.html | Tools page, folder tools with mixed statuses (the "needs key" status is not built here, S4) | 390x844 |
| mockup-tools-empty-phone.html | Tools page, no folder tools yet | 390x844 |
| mockup-tools-mixed-desktop.html | Tools page, mixed statuses, wide screen (same layout, wider frame) | 1280x900 |
| mockup-shared-none-phone.html | Settings, Shared tools, none chosen | 390x844 |
| mockup-shared-chosen-phone.html | Settings, Shared tools, project chosen (its Shared keys part is not built here, S4) | 390x844 |

### Validation
Each item ships with tests; verifiers run, for the commits checked, the commands
`node test-support/pick-tests.js --base <comparison commit>` prints, plus:
- S1, S7 (description rules, both kinds, invalid files): `node --test machine/test/folder-tools.test.js` (new).
- S2, S3, S8 (discovery from worktree and shared copy, name rules, fetch fallback, entries handed to connectors, `.mcp.json` precedence, roles): `node --test machine/test/folder-tools-launch.test.js` (new; must cover a repo with folder tools and no `.mcp.json` on each of Claude, Codex and Antigravity, every folder tool invalid with no `.mcp.json` (card shows them, then clears after a clean start), Codex budget leaving `.mcp.json` entries in place, per-commit shared copies kept for a live session and reused on resume or account switch, the shared project's own threads skipping the shared copy, and the 20 s fetch limit), `node --test machine/test/project-mcp.test.js machine/test/project-mcp-codex.test.js machine/test/project-mcp-agy.test.js machine/test/project-tools-service.test.js`.
- S9 (stdin/stdout, errors, timeout killing the whole process group, cleanup after a killed bridge, stripped `.mcp.json` key names and session token, a changed `tool.json` mid-session, output cap): `node --test machine/test/folder-tools-run.test.js` (new).
- S10 (`wc.js tool new|list|check|run`, including `check` on the server template answering the MCP handshake, `check` killing a stalled server at the deadline and when `wc.js` gets SIGTERM, `run`/`check` stripping `WHEELCHAIR_TOOL_STRIP` names and the session token, `new` refusing an existing folder): `node --test viewer/test/wc-tool.test.js` (new).
- S6, Mockups (list and Shared tools project picker): `node --test viewer/test/app-project-tools.test.js viewer/test/app-settings.test.js`, `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js`.
- S5, S11 (guide and role-rule pointers): no suite (protocol documents); verifiers read `protocol/tools.md` against S1-S10 and confirm the pointers in `protocol/app/lead.md`, `sub-lead.md`, `worker.md` and README.md.
- Routers: `machine/AGENTS.md` and `viewer/AGENTS.md` (and any other router whose file-to-role list changes) are updated in the same change.

## Deferred

Optional; present only in the lighter modes.

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | Windows-side folder tools (a script or server tool that runs on Windows from WSL) | The feature works on the Linux side; Windows needs the go-between and readiness wiring from MAP.md | planning | Reuse `machine/lib/win-tool-wrap.js` and the readiness file; see MAP.md "Windows wiring" |
| 2 | Server templates in languages other than Node.js (for example Python) | One template is enough to follow the standard; others are convenience | planning | Keep `wc.js tool new --kind server` the entry point, add a `--lang` option |
| 3 | Folder tools that are HTTP MCP servers (a `url` instead of `start`) | Existing HTTP servers keep working in `.mcp.json`; stdio covers making and wrapping servers | review-round-1 | Needs header keys; depends on the key-handling thread (Decision 21) |

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|
| A process-group id recorded by a crashed bridge or launcher is reused by an unrelated process before the session ends, and cleanup signals it | Rare path: needs a crash, the child exiting and id reuse together | review-round-5 |
| `wc.js tool run`/`check` killed with SIGKILL leaves its tool child running | Rare path: normal stops send TERM or HUP, which it handles | review-round-5 |

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-25

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Reusing the project-tools path would put keys in the agent's environment (env-launch) | upheld | S4: bridge/launcher read the key store themselves; no injectProjectKeys, no keys in MCP configs |
| intent | major | Claude loads only `.mcp.json` names; no-`.mcp.json` repos would get no folder tools | upheld | S8: new "extra servers" connector input, per connector, works without `.mcp.json` |
| intent | major | Where the shared tools' last fetched files live is unstated | upheld | S3: machine-owned per-commit copies under the state dir |
| intent | major | "Connect this one" has no route | upheld | S1: `start` may launch any existing stdio MCP server; HTTP to Deferred row 3 |
| intent | minor | S1 "to be settled" contradicts S7/S10 | upheld | S1 points to S7 |
| intent | minor | `--shared` flag adds nothing | upheld | Removed |
| intent | minor | "only read and run" vs `new` writing | upheld | Reworded |
| intent | minor | Kimi/Pi agents can't discover script tools | upheld | S11: one line in their starting instructions |
| intent | minor | Assistant role in Decision 11 not in Spec | upheld | S5: Collin or the existing assistant opens the thread; no assistant change |
| mechanics | blocking | Claude registration of extra entries | upheld | Same fix as intent finding 2; launch test added to Validation |
| mechanics | blocking | Codex budget could drop `.mcp.json` entries | upheld | S8: `.mcp.json` measured first, folder entries added while they fit, rest named on card |
| mechanics | blocking | Key boundary overstated; shared keys with `.mcp.json` | downgraded (minor) | Wording only: same-account file access is the same as project keys today (realism: tampering by a local agent is a rare path). S4 now states the exact boundary |
| mechanics | blocking | Tool output/stderr can leak keys | downgraded (major) | Not wrong-build; S4/S9: exact key values redacted from script output; guide warns server authors |
| mechanics | major | Shared project identity on a second machine | upheld | S3: hub-wide choice stored as GitHub repo; each machine matches its own project; card message when absent |
| mechanics | major | In-place refresh breaks running sessions | upheld | S3: per-commit copies pinned per session, cleaned when unused |
| mechanics | major | `check`/`run` unscoped by role | upheld | S10: through the machine service, refused for roles without project tools |
| mechanics | major | `new` could overwrite existing work | upheld | S10: refuses an existing folder |
| mechanics | major | What "can be used" verifies is undefined | upheld | S6: launch-time checks listed; runtime failures path defined |
| mechanics | minor | Problem card with no `.mcp.json` | upheld | Validation: test it shows and clears |
| mechanics | minor | Platforms unclear | upheld | Not doing: Linux, WSL Linux side, macOS |

### Round 2 — 2026-11-25

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** S1 (existing servers as server tools; HTTP deferred), S3 (hub-wide choice by GitHub repo; per-commit machine copies), S4 (key boundary, redaction, no agent-env injection), S6 (what "can be used" checks), S8 (extra-servers connector input; Codex budget order), S10 (role gate, `new` refuses existing folder, no `--shared`), S11 (Kimi/Pi line), S5 (assistant), Not doing (platforms), Validation, Deferred row 3.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Tools page source and PATH unstated | upheld | S6: default branch plus newest shared copy, machine's PATH; per-AI limits only on the card |
| intent | minor | Shared tools project's threads would show "hidden" for every tool | upheld | S3: shared copy not read there |
| intent | minor | Fetch has no time limit | upheld | S3: 20 s limit |
| intent | minor | "Supported by at least one AI" always true | upheld | Removed from S6; per-AI on the card (S8) |
| intent | minor | Project leads have no guide pointer | upheld | S5 scoped to thread leads |
| mechanics | blocking | `run`/`check` through the service escape Codex's sandbox | upheld | S10: `new`/`list`/`check` run in the caller's process without keys; `run` only on Kimi/Pi (no MCP, no sandbox) |
| mechanics | blocking | `wheelchair-tools` folder name clashes with the bridge | upheld | S7: name reserved |
| mechanics | major | Redaction after clipping lets key fragments through | upheld | S9: redact whole capture before cutting |
| mechanics | major | Account switch or restart could change or delete the pinned shared copy | upheld | S3: commit recorded on the session; cleanup honours unended records |
| mechanics | major | Tool source for `list`/`check`/`run` unclear | upheld | S10: current worktree plus pinned shared copy |
| mechanics | major | `check` has no deadline | upheld | S10: 30 s, children killed |
| mechanics | minor | Which local project matches the shared repo | upheld | S3: first saved project with that origin |
| mechanics | minor | Keys for shared tools tested before merge | upheld | S3: shared keys in the shared project's threads |
| mechanics | minor | Settings page source revision | upheld | Same fix as intent round-2 finding 1 (S6) |

### Round 3 — 2026-11-25

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** S3 (20 s fetch limit; shared project's own threads skip the shared copy and use shared keys; pin recorded on the session and kept across resume, switch and restart; matching local project), S5 (thread leads), S6 (page source and PATH; per-AI limits only on the card), S7 (`wheelchair-tools` reserved), S9 (redact before cutting), S10 (rewritten: where each command runs, `run` only on Kimi/Pi, `check` deadline), Validation.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | A key split at the 2 MiB capture limit escapes redaction | upheld | S9: streaming redaction with hold-back; always fixed (secret leak) |
| mechanics | major | `check` on keyed servers | upheld | Same fix as intent round-3 finding 2; guide: confirm through MCP next session |
| mechanics | major | Bridge offers old schema while running edited script | upheld | S9: re-read `tool.json` per call; changed tool returns an error |
| mechanics | major | Timed-out script's children keep running | upheld | S9: own process group, TERM then KILL |
| mechanics | minor | Page in the shared project shows tools twice | upheld | Same fix as intent round-3 finding 4 |
| mechanics | minor | Mockup server status vs S6 | upheld | S6: server tools show the Kimi/Pi note, as in the mockup |
| intent | minor | No way to try a script tool just made on Claude/Codex/Antigravity | upheld | S10: keyless `run` in the caller's process on those AIs |
| intent | minor | `check` without keys gives misleading failures for keyed servers | upheld | S10: output says it ran without keys |
| intent | minor | `list` key status vs never receiving values | upheld | S10: names-only lookup |
| intent | minor | Page shows shared project's tools twice | upheld | S6: shared copy not added for the shared project itself |

### Round 4 — 2026-11-25

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** Key handling split into its own thread (Decision 21): S4 replaced, `keys` removed from S7, S6 (no key status, no Shared keys section), S9 (no redaction; bridge environment), S10 (all commands in the caller's process; no role refusal; pinned commit lookup), S3 (no shared keys), S11, Mockups notes, Validation. Round 3 fixes also landed in S6, S9 and S10.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Folder tools inherit `.mcp.json` keys on Claude/Codex | upheld | Superseded by mechanics finding 1's fix: those names are removed from the tool environment |
| mechanics | blocking | Folder tools inherit project keys from the agent's environment | upheld | S4: key names referenced by `.mcp.json` removed before spawning (names only passed) |
| mechanics | major | Script edits run live while description is fixed | downgraded (minor) | Intended; S9 now says scripts run live, description fixed |
| mechanics | major | Children survive a crashed bridge or killed `wc.js` | upheld | S9: per-session process-group record, cleaned by the machine service at session end |
| mechanics | major | Page cannot read non-GitHub projects | downgraded (minor) | One message line; S6 states it |
| mechanics | minor | stderr tail lost after the cap | upheld | S9: drain both; rolling stderr tail |
| intent | minor | Agents may commit tokens in the tool folder | upheld | S4: guide forbids it, points to `.mcp.json` |
| intent | minor | Deferred row 3 points to removed S4 | upheld | Row now points to Decision 21 |

### Round 5 — 2026-11-25

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol (restarted after the lead restart); cross-family: yes.

**Changed since Round 4:** S4 (tool environment strips `.mcp.json` key names; guide forbids committing tokens), S6 (non-GitHub projects), S9 (scripts run live, description fixed; both streams drained; process-group record and cleanup at session end), Deferred row 3 note, Validation.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Cleanup on machine service stop would kill live sessions' tools | upheld | S9: cleanup only at session end, including recovered sessions; service stop kills nothing |
| intent | minor | Shared tools listing unclear for non-GitHub projects | upheld | S6: shared copy listed for every project |
| mechanics | blocking | `wc.js tool run`/`check` don't strip launch-time key names | upheld | S4: names passed as `WHEELCHAIR_TOOL_STRIP`, stripped by bridge, launcher and CLI |
| mechanics | blocking | CLI process-group records can't be written from a Codex sandbox | upheld | S9: CLI writes no record; kills its child's group itself |
| mechanics | major | Standalone `wc.js` killed leaves child running | upheld | S9: CLI cleans up on exit and signals; SIGKILL case accepted (rare path) |
| mechanics | major | Session token passed to tool programs | upheld | S4: `WHEELCHAIR_SESSION_TOKEN` stripped from tool environments |
| mechanics | major | Rare path: reused process-group id killed at cleanup | accepted-risk | Rare path: needs a crashed launcher, an exited child and id reuse before session end |
| mechanics | minor | Non-GitHub page can't check shared-name collisions | upheld | S6: rows say not checked against the project's own tools |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
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
|           | pre-existing / partial | | high / low |

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
