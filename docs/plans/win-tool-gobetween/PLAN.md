---
slug: win-tool-gobetween
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Windows tools that start before their copy is ready

**Idea:** `IDEA.md` — read it first. Mode: two-part. Map: `MAP.md` and
`docs/maps/windows-stdio-gobetween.md`.

Origin: split from `docs/plans/windows-bridge-solid/PLAN.md` (branch merged in PR #149). Its
last full design for this part is Spec item 3 in `5950541c^:docs/plans/windows-bridge-solid/PLAN.md`
(lines 166-296), with decisions D8, D14, D16-D19, D21 there. This plan carries that design
forward; the parent's launch record (`win-sessions.json`) and copy-wide shutdown gate were
never built (MAP.md).

## Open Questions

### Q1: Share one way of swapping tool entries with the "Windows localhost tools from WSL" thread?
- **Context:** that thread (plan `docs/plans/windows-localhost-tools/PLAN.md` on
  `wc/a1a1b7d6016d`, in review, not built) also replaces `.mcp.json` entries per session in
  the Claude, Codex and Antigravity adapters, and for Claude uses the same
  "disable in `disabledMcpjsonServers` + same-name entry in a per-session `--mcp-config`"
  route this plan needs (its lead verified live that Claude uses the `--mcp-config` entry).
  Its lead suggests one generic per-session map `context.replaceEntries = {name: entry}`
  applied by all three adapters, filled by both features, with one `--mcp-config` file.
- **Options:** (a) shared map, whichever thread builds first adds it and the other reuses
  it; (b) each thread builds its own replacement path.
- **Recommendation:** (a).

### Q2: How do Codex agents get Windows tools that appear late?
- **Context:** live test (W1): Claude Code 2.1.330 re-lists tools on
  `notifications/tools/list_changed`; codex-cli 0.171.0 does not (one `tools/list` at start,
  nothing after the notification; tool never callable). So the stand-in's empty list stays
  empty for a Codex session. Antigravity is not installed here; untested.
- **Options:** (a) remember each tool's last tool list (stored by the go-between when the
  real tool runs) and advertise it from the stand-in; a call before the copy is ready waits
  for it (bounded under Codex's tool-call timeout) and then goes to the real tool; first ever
  use of a tool gets no tools until the next session; (b) hold the handshake up to ~8 s for
  Codex, then empty list: helps only fast copies; (c) accept that Codex gets these tools only
  in sessions started after the copy is ready (changes IDEA.md "What good looks like").
- **Recommendation:** (a), with `list_changed` still sent for CLIs that use it.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | Design depends on CLIs re-listing tools on `notifications/tools/list_changed` (parent C4, never checked) | Live test of installed `claude` and `codex` | yes | Claude re-lists; Codex does not → Q2 |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode two-part | User's choice; the parent's review stalled on rare cleanup cases | user |
| D2 | Carry forward the parent's go-between design (parent D18/D19): the real Windows tool is never started before the copy is ready; the go-between answers the handshake, lists no tools, then starts the tool and sends `tools/list_changed` | Reviewed over eleven rounds in the parent; holding `initialize` outlasts Codex's ~10 s start deadline | adopted |
| D3 | The MCP for Unity entry (args include `mcp-for-unity`) is not wrapped (parent D16) | It never reads the copy, and a late start would drop the agent's Editor selection | adopted |

## Spec

(Draft; settled after the open questions.)

Background: `docs/maps/windows-stdio-gobetween.md`. Nothing here changes behaviour off WSL.

### 1. Which tools are wrapped
On a WSL machine, for tool roles, every loaded stdio entry whose command `isWindowsProgram`,
except the MCP for Unity entry (D3), is launched through `machine/lib/win-tool-proxy.js` as
`<process.execPath> <proxy> --ready-file <path> --tools-dir <dir> -- <command> <args...>`.
HTTP/SSE entries are never wrapped. Each adapter's build returns
`loaded: [{name, windows, wrapped}]`; `windows` is from the original `.mcp.json` command.

### 2. Per CLI
- Codex and Antigravity: translated entries get the wrapped command and args; Codex keeps its
  `WHEELCHAIR_WINDOWS_PROJECT`/`WSLENV` passthrough.
- Claude: wrapped names go into `disabledMcpjsonServers` and are given, wrapped and under the
  same names, in a per-session `--mcp-config` file (mode 0600). (Shape depends on Q1.)
- Pi and Kimi: unchanged (no project tools).

### 3. Ready file
`<stateDir>/win-ready/<session name>`, mode 0600, written atomically, JSON
`{"state": "ready"|"waiting"|"failed", "reason"?, "at"}`. `waiting` before launch and while
readying runs (also past the 45 s wait); `ready` only after a reconcile of that session's copy
finishes successfully after the session's start began (its own or a shared readying task, or a
later successful `win sync`/`run`/`start` sync of that copy; an existing `.git` never counts);
`failed` when readying fails, replaced by `ready` on a later success. Removed when the session
stops. The go-between branches on `state` only.

### 4. Go-between behaviour
As parent Spec item 3 "Go-between behaviour (D18)" steps 1-5, unchanged: ready at start →
start and pipe; not ready → stand-in answers `initialize` (client's `protocolVersion`,
`{tools:{listChanged:true}}`, `instructions` naming the state), swallows notifications,
empty `tools/list`, `ping` ok, other requests error `-32000`; on `ready`, 3a (no
`initialize` yet: start and pipe) or 3b (handoff: queue, replay `initialize` to the real tool,
one `notifications/initialized`, flush queue, send `list_changed`, pipe); exits and stdin
close as in step 5. Poll the ready file every 2 s.

### 5. Process tree
The go-between starts the real tool inside a Windows Job Object with kill-on-close, as
`machine/lib/win-apps.js` does for apps, with stdio passed through. Stopping the tool closes
the job and waits up to 5 s for its pipes to close.

### 6. Normal stop waits for the session's own tools
While its real tool runs, a go-between keeps `<stateDir>/win-tools/<session name>/<pid>`
(created when it starts the tool, removed after the job closes and pipes shut).
`WinBridge.onStop` waits, before its final stop reconcile, until that session's directory is
empty (poll up to 15 s; entries with dead pids are removed; timeout logs and reconciles
anyway).

### 7. Marking the copy used
For a session with loaded Windows tools, right after tmux starts, the machine marks its copy
used (`markKey`), and again when a readying task for that copy finishes after launch.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | After a machine service restart, keep tracking sessions with Windows tools and re-ready wrapped sessions whose ready file is not `ready` (parent's `win-sessions.json` launch record) | Needs a service restart during a live session; today's restart recovery already reconstructs from live sessions and copies (`machine/lib/win.js:339-358`) | planning | Parent Spec item 3 "Launch record" and "Recovery after a service restart" |
| 2 | Stop, the periodic sweep and archive wait for every session sharing a copy, including sessions that ended without a normal stop (CLI crash, handoff kill) | Normal stop of the session itself is covered by Spec 6; the rest needs a sibling or crashed session with a tool still writing | planning | Parent Spec item 3 "Stop waits for wrapped tools" (copy-wide gate, sweep, `archiveCheck` pending) |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A go-between that crashes while its Windows tool keeps writing lets the stop wait pass early | Rare path: needs the go-between itself to crash mid-session (parent review-round-8) | adopted |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
