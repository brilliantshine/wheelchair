---
slug: win-tools-solid
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-22
---

# Make Windows tools solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

_None open._

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | Idle read-end closure (IDEA item 4) | Which mechanism Node on Linux can use to see a closed reader on an idle stdout pipe | no | Settled by the lead: D4 |
| W2 | Crashed or handoff-killed sessions (IDEA item 2) | Whether their go-betweens and tools actually exit when the CLI dies (stdin end) or are orphaned | no | Settled by the lead: D6 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode is thorough | User's choice; this thread is the follow-up for win-tool-gobetween's Deferred items | user |
| D2 | Restart recovery follows the parent design: a durable per-session launch record (wrapped, copy key) in `win-sessions.json` written before tmux starts; on service start, every live wrapped session whose ready file is not `ready` gets a fresh attempt token and readying | Already reviewed in windows-bridge-solid (`5950541c^:docs/plans/windows-bridge-solid/PLAN.md:194-211`); no user-visible choice in it | defaulted |
| D4 | The go-between notices a closed reader by a zero-length `fs.writeSync(1, Buffer.alloc(0))` probe every 2 s while idle; `EPIPE` starts its normal shutdown | Lead's local check on Node 26/Linux: the probe throws `EPIPE` within one interval after the reader closes, while stdout itself emits nothing; a zero-length write adds no bytes to the stream | defaulted |
| D5 | A stop ends every Windows program a tool started: the go-between starts the tool through a launcher that puts it in a named Windows Job Object (option A) | User's choice over "wait for quiet" and "tool only" | user |
| D6 | The copy-wide gate waits for go-betweens of sessions that ended without a normal stop, and ends the job of any whose go-between died | A dying CLI closes the go-between's stdin and tmux kill sends SIGHUP, both of which start its shutdown (`machine/lib/win-tool-proxy.js:63-66`); only a go-between killed outright (SIGKILL, OOM) leaves its job behind, and its registry file names that job | defaulted |
| D7 | When a wait runs out, remaining jobs are ended (`terminateScript`) before the reconcile goes ahead | IDEA constraint "every wait is bounded"; ending them is the only way the reconcile is not racing a writer | defaulted |
| D8 | Launch flags are kept on the session record in `sessions.json` (`windows_tools`, `wrapped_tools`), not a new `win-sessions.json` | The service already persists every session there before and after launch (`machine/service.js:567`); one file, one source of truth | defaulted |
| D3 | Every new wait is bounded: a stop, sweep or archive waits at most 15 s for Windows tools, then logs and goes ahead | IDEA constraint; matches the last reviewed design's 15 s `onStop` wait | defaulted |

## Spec

Scope: WSL machines with wrapped Windows stdio tools (`win-tool-gobetween`'s go-between,
`machine/lib/win-tool-proxy.js`). Nothing changes on other machines, for unwrapped
entries, or for `mcp-for-unity`. Background maps: `docs/maps/windows-stdio-gobetween.md`,
`docs/maps/windows-bridge-runtime.md`.

### 1. Restart recovery (IDEA item 1)

1. **Launch flags.** `startIn` (`machine/service.js:830-860`) stores `windows_tools` and
   `wrapped_tools` (booleans from `loaded`) on the session record before tmux starts, so
   they are in `sessions.json` (D8). Older records without them are treated as `false`.
2. **On service start**, `WinBridge.startup` (`machine/lib/win.js:397-417`), for every
   live tool-role session (same filter as today) with `windows_tools` true: add it to
   `toolSessions` and register/mark its copy as today, **even if the copy does not exist yet**.
3. For each of those with `wrapped_tools` true whose ready file
   (`<stateDir>/win-ready/<name>`) is absent or not `{"state":"ready"}`: run the same
   readying a launch does (`beginReady` for a fresh token, then `prepareLaunch` with that
   token), in the background, not awaited by startup. Its outcome publishes `ready` or
   `failed` exactly as at launch. A `ready` file is left alone (its go-between has already
   started the tool).
4. These recovery tasks are in `readying` like launch ones, so stop, sweep and archive
   wait on them as today.

### 2. Launching a tool in a Windows job (D5)

The go-between no longer spawns the tool directly. It starts a launcher with
`createWinEnv(...).spawnPs(launcherScript(...))` (`machine/lib/win-env.js:57`), added to
`machine/lib/win-apps.js` beside `wrapperScript`, reusing its quoting and job code, with
these differences from `wrapperScript`:

- **Job name.** The go-between picks `id = "tool-" + <uuid>`; the job is `wheelchair-<id>`,
  so `terminateScript(id)` (`win-apps.js:94`) ends it. Pass `id`, never the full name.
- **Program, args, directory.** Program: the entry's command through `winEnv.toWindows`.
  Args unchanged. Working directory: the go-between's own cwd via `winEnv.toWindows`
  (what interop gives an unwrapped tool today).
- **Environment.** The variables interop would pass today: the go-between's `WSLENV`
  list, with `WHEELCHAIR_WINDOWS_PROJECT` added and `WHEELCHAIR_SESSION_TOKEN` never passed.
- **Stdio.** The tool's stdin/stdout/stderr are the launcher's own (no log file). The
  launcher writes nothing to stdout itself. Once the job exists and the tool has started it
  writes the line `wc-tool-started` to stderr; the go-between removes that line from the
  stderr it passes on and treats it as the start acknowledgment.
- **Exit.** The launcher exits when the tool and every process in the job have ended, with
  the tool's exit code as its own. The go-between treats its exit as the tool's exit
  (today's `close` handling).
- **Start time.** The compiled job helper is cached: the launcher loads a DLL from the
  Windows run root keyed by a hash of its C# source, compiling it with `Add-Type
  -OutputAssembly` only when missing. The app wrapper is unchanged.

### 3. Stopping a tool (go-between)

`stopTool` gets one total budget of 12 s from the moment stopping starts:
1. Close the launcher's stdin.
2. If the acknowledgment has not arrived, wait for it or for the launcher to exit; if the
   launcher exits first, done.
3. Wait up to 2 s for the launcher to exit by itself.
4. Run `terminateScript(id)` through `winEnv.ps` with `timeoutMs` = what is left minus 2 s.
5. Wait for the launcher to exit, within what is left. If the budget runs out, write that
   to stderr and exit anyway.

`--stop-ms` is replaced by `--stop-budget-ms` (default 12000) for tests. Every path that
ends the go-between (stdin end, stdout lost, signals, `failure`, handoff failure) goes
through `stopTool`.

### 4. Tool registry

While a launcher runs, the go-between keeps the file
`<stateDir>/win-tools/<session name>/<go-between pid>` holding JSON
`{"job":"tool-<uuid>","key":"<worktree key>","pid":<pid>,"start":"<field 22 of /proc/<pid>/stat>"}`.
It writes it (atomically, mode 0600) **before** spawning the launcher and removes it after
the launcher has exited and its pipes closed. The go-between learns `stateDir`, session
name and worktree key from new options `--tools-dir` and `--copy-key`, added by
`wrapEntries` (`machine/lib/win-tool-wrap.js`).

An entry is **live** when `/proc/<pid>/stat` exists with the same start field; otherwise
it is **orphaned**. `WinBridge` gets `toolsFor(key)` (entries across all session
directories whose `key` matches) and `endOrphan(entry)` (`terminateScript(entry.job)`,
then remove the file).

### 5. The copy-wide gate (IDEA items 2 and 3)

`WinBridge.gate(key, { session })`, awaited before any reconcile or removal of a copy:
- Entries considered: those of `session` (when given) and of every **ended** session on the
  copy: one whose tmux session is not live, or whose status is `stopped`, or that is not in
  `service.sessions` at all. Entries of live sibling sessions are never touched. If
  `liveTmux()` returns `null`, the gate considers only `session`'s entries.
- Orphaned entries: `endOrphan` straight away.
- Live entries: poll every 250 ms until they are gone, up to **15 s** (longer than the
  go-between's 12 s budget, D3). On timeout, log it and `endOrphan` every remaining entry
  (D7), then return.
- Empty session directories are removed afterwards.

Used by:
- **`onStop`** (`win.js:279-294`): after `killSession` and the readying wait, before the
  verifier removal or the lead/sub-lead final sync. The role rules are unchanged.
- **`sweep`** (`win.js:361-370`): a copy with an `onStop` task in progress for a session on
  it is skipped this round. Otherwise, before its final sync, and also for any copy whose
  `toolsFor` has entries from ended sessions even when it needs no sync, it runs `gate`
  (without a session). One copy's gate does not block the sweep of others beyond its own wait.
- **`archiveCheck`** (`win.js:319-334`): a copy with entries from ended sessions is
  `pending` and its gate is started (once per copy per archive, like `archiveAttempted`);
  the final sync starts after the gate. `archiveFinish` runs `gate` again before `remove`.
- **Handoff kill** (`machine/service.js:2020-2033`) is unchanged: its leftovers are caught by
  the sweep or archive through the gate.

### 6. Idle reader closed (IDEA item 4, D4)

While stdout has no write in flight, the go-between calls `fs.writeSync(1, Buffer.alloc(0))`
every 2 s (`--probe-ms`, default 2000, for tests). `EPIPE` (or any error) calls
`stdoutLost()`. The probe never runs while a write is pending, so it cannot interleave.

### 7. Non-goals

No change to the handshake, held calls, list cache, `list_changed`, which entries are
wrapped, app tracking (`AppTracker`), or role rules for when a copy is synced or removed.

### Validation

Tests use fake Windows (`spawnPs`/`ps` stubs, fake launcher scripts), as the existing win
tests do:
- restart: a live wrapped session with a `waiting` ready file is readied after `startup`;
  a `ready` file is untouched; a record without flags is ignored.
- go-between: registry file written before launch and removed after exit; acknowledgment
  line stripped; stop sends `terminateScript` with the right id within the budget; idle
  reader closed is noticed within two probe intervals and the tool is stopped.
- gate: onStop waits for its own entries; an ended sibling's live entry delays sweep and
  archive; an orphan's job is ended; a timeout ends remaining jobs; a live sibling is untouched.
- launcher script: the generated PowerShell contains the cached-DLL load, the
  `wheelchair-tool-` job name and `wc-tool-started`.

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
```


## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|
| C1 | On this WSL machine, a wrapped tool launched through the job launcher answers the CLI's `initialize` within Codex's ~10 s start deadline (carried from win-tool-gobetween C3) | planning |
| C2 | Antigravity re-lists tools on `notifications/tools/list_changed` (carried from win-tool-gobetween C1) | planning |

## Review Rounds

### Round 1 — 2026-11-22

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

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
