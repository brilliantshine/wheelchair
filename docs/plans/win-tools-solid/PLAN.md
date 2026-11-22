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
| D2 | (launch-record timing superseded by D10) Restart recovery follows the parent design: a durable per-session launch record (wrapped, copy key) in `win-sessions.json` written before tmux starts; on service start, every live wrapped session whose ready file is not `ready` gets a fresh attempt token and readying | Already reviewed in windows-bridge-solid (`5950541c^:docs/plans/windows-bridge-solid/PLAN.md:194-211`); no user-visible choice in it | defaulted |
| D3 | (superseded by D11) Every new wait is bounded: a stop, sweep or archive waits at most 15 s for Windows tools, then logs and goes ahead | IDEA constraint; matches the last reviewed design's 15 s `onStop` wait | defaulted |
| D4 | The go-between notices a closed reader by a zero-length `fs.writeSync(1, Buffer.alloc(0))` probe every 2 s while idle; `EPIPE` starts its normal shutdown | Lead's local check on Node 26/Linux: the probe throws `EPIPE` within one interval after the reader closes, while stdout itself emits nothing; a zero-length write adds no bytes to the stream | defaulted |
| D5 | A stop ends every Windows program a tool started: the go-between starts the tool through a launcher that puts it in a named Windows Job Object (option A) | User's choice over "wait for quiet" and "tool only" | user |
| D6 | The copy-wide gate waits for go-betweens of sessions that ended without a normal stop, and ends the job of any whose go-between died | A dying CLI closes the go-between's stdin and tmux kill sends SIGHUP, both of which start its shutdown (`machine/lib/win-tool-proxy.js:63-66`); only a go-between killed outright (SIGKILL, OOM) leaves its job behind, and its registry file names that job | defaulted |
| D7 | When a wait runs out, remaining jobs are ended (`terminateScript`) before the reconcile goes ahead | IDEA constraint "every wait is bounded"; ending them is the only way the reconcile is not racing a writer | defaulted |
| D8 | Launch flags are kept on the session record in `sessions.json` (`windows_tools`, `wrapped_tools`), not a new `win-sessions.json` | The service already persists every session there before and after launch (`machine/service.js:567`); one file, one source of truth | defaulted |
| D9 | Idle reader detection uses a zero-length write probe on sockets, a check of the parent's read end in `/proc` on OS pipes, and a parent-gone check; supersedes D4 | Round 1: a zero-length `write()` on a Linux pipe never raises `EPIPE` (reviewer's and lead's checks), and Codex gives tools OS pipes. Lead's check: a Node child with stdout on an `os.pipe()` sees its parent drop the read end within one 300 ms poll | review-round-1 |
| D10 | Launch flags ride on the session record saved after tmux starts, as today; no pre-tmux write | Round 1: a pre-tmux insert needs rollback and save ordering; a restart between tmux start and that save is a sub-second window (rare path) | review-round-1 |
| D11 | The gate has one 20 s deadline covering polling and termination; termination must be confirmed, otherwise the copy is not synced or removed (kept, retried by the next sweep or kept by archive) | Round 1: PowerShell calls could exceed the 15 s bound, and an unconfirmed termination would let the reconcile race a writer | review-round-1 |
| D12 | The gate runs inside `sync` and `remove`, not at each caller | Round 1: launch readying, `wc.js win` and `onWorktreeRemoved` also reconcile or delete copies | review-round-1 |

## Spec

Scope: WSL machines with wrapped Windows stdio tools (`win-tool-gobetween`'s go-between,
`machine/lib/win-tool-proxy.js`). Nothing changes on other machines, for unwrapped
entries, or for `mcp-for-unity`. Background maps: `docs/maps/windows-stdio-gobetween.md`,
`docs/maps/windows-bridge-runtime.md`.

### 1. Restart recovery (IDEA item 1)

1. **Launch flags.** `startIn` (`machine/service.js:830-860`) puts `windows_tools` and
   `wrapped_tools` (booleans from `loaded`) on the session record it already inserts and
   persists after tmux starts (`machine/service.js:926-942`); no new write, no change to
   when the record is saved (D10).
2. **On service start**, `WinBridge.startup` (`machine/lib/win.js:397-417`) keeps today's
   loop for live tool-role sessions. A session counts as having Windows tools when
   `windows_tools` is true, or, for a record without the flag (saved before this change),
   when its copy exists (today's rule). Such a session is added to `toolSessions` and its
   copy registered and marked as today; with `windows_tools` true this happens **even if the
   copy does not exist yet**. A session counts as wrapped when `wrapped_tools` is true, or,
   without the flag, when `<stateDir>/win-ready/<name>` exists.
3. For each wrapped one whose ready file
   (`<stateDir>/win-ready/<name>`) is absent or not `{"state":"ready"}`: run the same
   readying a launch does (`beginReady` for a fresh token, then `prepareLaunch` with that
   token), in the background, not awaited by startup. Its outcome publishes `ready` or
   `failed` exactly as at launch. A `ready` file is left alone (its go-between has already
   started the tool).
4. These recovery tasks are in `readying` like launch ones, so stop, sweep and archive
   wait on them as today.
5. `startup` starts its `sweep()` without awaiting it (today it awaits, `win.js:416`), so a
   sweep gating copies never holds the service's start; errors are logged.

### 2. Launching a tool in a Windows job (D5)

The go-between no longer spawns the tool directly. It starts a launcher with
`createWinEnv(...).spawnPs(launcherScript(...))` (`machine/lib/win-env.js:57`), added to
`machine/lib/win-apps.js` beside `wrapperScript`, reusing its quoting and job code, with
these differences from `wrapperScript`:

- **Job name.** The go-between picks `id = "tool-" + <uuid>`; the job is `wheelchair-<id>`,
  so `toolTerminateScript(id)` (Spec 4) ends it. Pass `id`, never the full name.
- **Program, args, directory.** Program: the entry's command through `winEnv.toWindows`.
  Args unchanged. Working directory: the go-between's own cwd via `winEnv.toWindows`
  (what interop gives an unwrapped tool today).
- **Environment.** The variables interop would pass today: the go-between's `WSLENV`
  list, with `WHEELCHAIR_WINDOWS_PROJECT` added and `WHEELCHAIR_SESSION_TOKEN` never passed.
- **Stdio.** The tool's stdin/stdout/stderr are the launcher's own (no log file). The
  launcher writes nothing to stdout itself. Once the job exists and the tool has started it
  writes the line `wc-tool-started` to stderr; the go-between removes that line from the
  stderr it passes on and treats it as the start acknowledgment.
- **Start deadline.** The go-between passes `notAfter` (Unix ms, its spawn time + 10 s;
  WSL and Windows share the clock) and writes it into the registry entry. The launcher
  checks it after creating the job and immediately before starting the tool; if past, it
  exits with code 125 without starting the tool. So once `notAfter` has passed, a launcher
  that has not started the tool never will.
- **Exit.** The launcher exits when the tool and every process in the job have ended, with
  the tool's exit code as its own. The go-between treats its exit as the tool's exit
  (today's `close` handling).
- **Start time.** The launcher compiles its helper with `Add-Type` each start, as the app
  wrapper does. If C1 shows this misses Codex's deadline, the fix is to cache the compiled
  helper as a DLL under the Windows run root, keyed by a hash of its source.

### 3. Stopping a tool (go-between)

`stopTool` gets one total budget of 12 s (`--stop-budget-ms`, default 12000, replacing
`--stop-ms`) from the moment stopping starts, with the last 4 s always kept for forced
termination:
1. Close the launcher's stdin. If the launcher has exited, done.
2. Until 8 s into the budget: wait for the launcher to exit by itself (the tool and
   everything it started get this time to finish writing after their stdin closes).
3. If still running: run `toolTerminateScript(id)` through `winEnv.ps` with `timeoutMs` =
   what is left minus 1 s (this also covers a launcher that never acknowledged: a job that
   does not exist yet is simply not found).
4. Wait for the launcher to exit within what is left. If the budget runs out, write that to
   stderr and exit **without** removing the registry file, so the gate treats the entry as
   orphaned and ends the job (Spec 4).

Every path that ends the go-between (stdin end, stdout lost, signals, `failure`, handoff
failure) goes through `stopTool`. After `stopTool` returns, `finish` waits at most 1 s for
pending stdout writes, then exits anyway.

**Sessions started before this change** keep their old go-betweens (no registry, no job)
until they end; the gate sees no entries for them, so they get today's behaviour. No
migration.

### 4. Tool registry

While a launcher runs, the go-between keeps the file
`<stateDir>/win-tools/<session name>/<go-between pid>` holding JSON
`{"job":"tool-<uuid>","key":"<worktree key>","pid":<pid>,"start":"<field 22 of /proc/<pid>/stat>","notAfter":<ms>}`.
It writes it (atomically, mode 0600) **before** spawning the launcher and removes it after
the launcher has exited and its pipes closed. The go-between learns `stateDir`, session
name and worktree key from new options `--tools-dir` and `--copy-key`, added by
`wrapEntries` (`machine/lib/win-tool-wrap.js`).

An entry is **live** when `/proc/<pid>/stat` exists with the same start field; otherwise
it is **orphaned**. `WinBridge` gets `toolsFor(key)` (entries across all session
directories whose `key` matches) and `endJob(entry, timeoutMs)`.

**Confirmed termination.** A new `toolTerminateScript(id)` in `win-apps.js`, beside
`terminateScript` (`win-apps.js:94-106`, unchanged, so `AppTracker` is untouched), opens
the same `wheelchair-<id>` job and prints `gone` when `OpenJobObject` fails with error 2
(no such job: with kill-on-close, a job whose last handle closed has already ended every
process in it) and `ended` after a successful `TerminateJobObject`; any other failure
throws (non-zero exit). The go-between's stop (Spec 3) and `endJob` both use it. `endJob` runs it with the given timeout and removes the registry
file only on exit code 0 with `ended`, or with `gone` when the entry's `notAfter` has
passed (before that, `gone` may mean the launcher has not created the job yet: the entry
stays and the gate keeps polling). Anything else (non-zero exit, timeout,
PowerShell not starting) is **unconfirmed**: the file stays.

### 5. The copy-wide gate (IDEA items 2 and 3)

`WinBridge.gate(key, { session })` returns `{ ok: true }` or `{ ok: false, reason }`.
- Entries considered: those of `session` (when given) and of every **ended** session on the
  copy: one whose tmux session is not live, or whose status is `stopped`, or that is not in
  `service.sessions` at all. Entries of live sibling sessions are never touched. If
  `liveTmux()` returns `null`, liveness is unknown: the gate handles `session`'s entries as
  usual and, if any entry of another session remains, returns `ok: false` ("could not check
  which sessions are running") without touching them.
- **One deadline of 20 s** for the whole gate (D3 superseded by D11). Orphaned entries:
  `endJob` straight away. Live entries: poll every 250 ms until gone, until 15 s. Then
  `endJob` every remaining entry with `timeoutMs` = what is left of the 20 s minus 1 s.
  At the deadline the gate returns regardless of anything still running.
- `ok: true` when no considered entry remains; otherwise `ok: false` with a reason naming
  the count ("a Windows tool from an ended session could not be stopped").
- Empty session directories are removed afterwards.
- Concurrent calls for the same key share one in-flight gate task (`this.gates`, a Map
  from key to task, deleted when it settles); a call with a `session` not covered by the
  running task waits for it and then runs its own.

**Where it runs.** Inside the two choke points every copy write and delete already goes
through, so no caller can skip it:
- `WinBridge.sync(ctx, { session })` (`win.js:155-178`) awaits `gate(ctx.key, { session })`
  inside its per-copy queue, before `reconcile`. On `ok: false` it throws with the reason
  and does not reconcile; the caller's existing error handling applies (launch readying
  publishes `failed` with that reason; `wc.js win sync` returns the error; the sweep logs
  it and retries next round).
- `WinBridge.remove(ctx, save, { session })` (`win.js:257-271`) first refuses, logging
  `keeping Windows copy <path>: <reason>`, when the key is in `this.gateFailed` (an archive
  decided to keep it; this covers `onWorktreeRemoved`, which archive calls before
  `archiveFinish`, `machine/service.js:1310-1313`). Otherwise it awaits the gate; on
  `ok: false` it logs the same line and does not delete.
- `onStop` passes its own `session` to `sync`/`remove`, so its own entries are waited for
  even when its status is not yet `stopped` (fatal stop). Every other caller (launch
  readying, `wc.js win` operations, sweep, `onWorktreeRemoved`, archive) passes none.

**Sweep** (`win.js:361-370`): a copy with an `onStop` task in progress for a session on it
is skipped this round. A copy whose `toolsFor` has entries from ended sessions gets
`gate(key)` even when it needs no sync, so leftovers of handoff kills and crashes are
ended within one sweep. Copies are gated one after another. `sweep()` keeps its own
in-flight promise: a call while one is running returns that promise instead of starting a
second (the timer at `machine/service.js:452` fires regardless).

**Archive.** `archiveCheck` (`win.js:319-334`) treats a copy with entries from ended
sessions, or a running `this.gates` task for its key, as `pending`, and starts
`gate(key)` if none is running. While pending it is re-checked like the existing stop,
readying and sync tasks. When the gate settles `ok: false`, the copy is recorded in
`this.gateFailed` (a Set of keys) and is no longer pending; `archiveFinish` keeps a copy
in `gateFailed` (logged, like a failed reconcile) instead of removing it, and clears the
mark at its end. Its final sync is not started for such a copy.

**Handoff kill** (`machine/service.js:2020-2033`) is unchanged: its leftovers are caught by
the sweep, by `onWorktreeRemoved`, or by archive, all through the gate.

### 6. Idle reader closed (IDEA item 4, D4 superseded by D9)

Every 2 s (`--probe-ms`, default 2000, for tests), while stdout has no write in flight, the
go-between runs both checks; either one failing calls `stdoutLost()`:
- **Socket probe** (stdout is a socket, `/proc/self/fd/1` reads `socket:[...]`, as when a
  Node CLI spawns it): `fs.writeSync(1, Buffer.alloc(0))`; `EPIPE` or any error fails.
- **Pipe reader check** (stdout is a pipe, `pipe:[N]`, as when Codex spawns it): the check
  fails when the parent (`process.ppid` read at start) no longer has any fd in
  `/proc/<ppid>/fd` linking to the same `pipe:[N]` whose `/proc/<ppid>/fdinfo/<fd>` flags
  are not write-only (`(flags & 3) !== 1`). At start, if the parent holds no such read end
  (stdout's reader is some other process) or `/proc/<ppid>` is unreadable, this check is
  turned off for the go-between's life.
- **Parent gone**: `process.ppid` differs from the value read at start (the CLI died while
  something else keeps the pipes open). This calls `shutdown()`.

The probe never runs while a write is pending, so it cannot interleave with output.

### 7. Non-goals

No change to the handshake, held calls, list cache, `list_changed`, which entries are
wrapped, app tracking (`AppTracker`), or role rules for when a copy is synced or removed.

### Validation

Tests use fake Windows (`spawnPs`/`ps` stubs, fake launcher scripts), as the existing win
tests do:
- restart: a live wrapped session with a `waiting` ready file is readied after `startup`;
  a `ready` file is untouched; a record without flags, with an existing copy and a
  `waiting` ready file, is tracked and readied; one without flags, copy or ready file is
  not tracked.
- go-between: registry file written before launch and removed after exit; acknowledgment
  line stripped; stop sends `toolTerminateScript` with the right id within the budget; idle
  reader closed is noticed within two probe intervals and the tool is stopped, both with
  stdout as a socketpair (Node `spawn`) and as an OS pipe (spawn the proxy with stdout from
  `os.pipe()`, e.g. through `python3 -c`, then close the read end); parent gone is noticed.
- gate: onStop waits for its own entries; an ended sibling's live entry delays sweep,
  archive, launch readying and `onWorktreeRemoved`; an orphan's job is ended; a timeout ends
  remaining jobs; an unconfirmed `toolTerminateScript` (non-zero exit, timeout) keeps the entry,
  skips the reconcile or removal and the whole gate returns by 20 s; archive keeps such a
  copy; a live sibling is untouched.
- stop budget: a launcher that never acknowledges, and one that acknowledges at 7 s, are
  both terminated and the go-between exits within 12 s, also with stdout backpressured
  (the reader holds the fd but stops reading); a fake launcher that would create its job
  after the stop exits 125 past `notAfter`; the gate keeps an entry whose `gone` comes
  before `notAfter` and clears it after.
- sweep: a second call while one runs returns the same promise; `liveTmux()` `null` with
  another session's entry gives `ok: false`; archive with a gate failure keeps the copy
  through `onWorktreeRemoved` and `archiveFinish`.
- restart: `startup` resolves while its sweep is still gating a copy.
- launcher script: the generated PowerShell contains the
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
| A service restart between tmux starting a session and its record being saved loses the session's launch flags; it then falls back to today's restart rule | Sub-second window together with a restart: rare path (D10) | review-round-1 |

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|
| C1 | On this WSL machine, a wrapped tool launched through the job launcher starts well inside its 10 s `notAfter` and answers the CLI's `initialize` within Codex's ~10 s start deadline (carried from win-tool-gobetween C3) | planning |
| C2 | Antigravity re-lists tools on `notifications/tools/list_changed` (carried from win-tool-gobetween C1) | planning |

## Review Rounds

### Round 1 — 2026-11-22

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Zero-length write probe never sees a closed reader on an OS pipe (Codex) | upheld (lead reproduced with a shell pipe) | Spec 6 rewritten: socket probe + parent read-end check in /proc + parent gone; OS-pipe test (D9) |
| intent | minor | Cached DLL is new state the idea does not need | upheld | Spec 2: compile each start; DLL cache only as C1's fix |
| mechanics | blocking | `endOrphan` removes the entry without confirming the job ended | upheld | Spec 4 confirmed termination; unconfirmed keeps entry (D11) |
| mechanics | blocking | 15 s covers polling only; PowerShell can take 60 s | upheld | Spec 5: one 20 s deadline (D11) |
| mechanics | blocking | Launch readying, `wc.js win`, `onWorktreeRemoved` reconcile/remove outside the gate | upheld | Gate inside `sync` and `remove` (D12) |
| mechanics | blocking | Idle probe misses OS pipes | upheld (same as intent finding) | Spec 6 (D9) |
| mechanics | major | Pre-tmux persistence needs rollback and save ordering | upheld | Flags on the after-tmux record (D10) |
| mechanics | major | Missing flags drop today's restart tracking | upheld | Spec 1.2 fallback to today's rule |
| mechanics | major | Stop budget leaves no time for forced termination | upheld | Spec 3: last 4 s reserved; never-acknowledged path |
| mechanics | major | Archive needs an in-flight gate task per copy | upheld | Spec 5: `gates` map, `gateFailed` |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.


### Round 2 — 2026-11-22

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 1:** Spec 1.1-1.2 (flags on the after-tmux record; fallback for old
records); Spec 2 Start time (no DLL cache); Spec 3 (stop budget with 4 s reserved);
Spec 4 (confirmed termination via `terminateScript` output, `endJob`); Spec 5 rewritten
(20 s deadline, gate inside `sync`/`remove`, `gates`/`gateFailed`, sweep and archive);
Spec 6 rewritten (socket probe, parent read-end check, parent gone); Validation; D9-D12.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Archive's `onWorktreeRemoved` can delete a copy archive decided to keep | upheld (`machine/service.js:1310-1313` runs it before `archiveFinish`) | `remove` honours `gateFailed` |
| mechanics | blocking | `liveTmux()` null lets the gate succeed with others' entries | upheld | `ok: false` when liveness unknown |
| mechanics | blocking | Launcher slow to create its job outlives the stop; `gone` clears the entry too early | upheld | `notAfter` start deadline in launcher and entry |
| mechanics | blocking | Go-betweens started before the update have no registry | downgraded to minor: they get exactly today's behaviour until they end, no regression | Spec 3: one sentence, no migration |
| mechanics | major | Sweeps can overlap | upheld (`setInterval` at `machine/service.js:452`) | `sweep()` in-flight promise |
| mechanics | major | Exit can wait forever on a pending stdout write | downgraded to minor: needs a reader holding the fd without reading | `finish` waits at most 1 s; test with backpressure |
| mechanics | minor | Restart fixture wording contradicts the fallback | upheld | Validation reworded |
| intent | major | Validation still says a record without flags is ignored | upheld | Fixed with the mechanics minor above; duplicate bullet replaced |
| intent | minor | 2 s grace after acknowledgment cuts off programs still writing | upheld | Spec 3 step 2: full 8 s |
| intent | minor | Changing shared `terminateScript` changes app stop behaviour | upheld | New `toolTerminateScript`; apps untouched |
| intent | minor | Startup awaits a sweep that may gate copies, holding the service offline | upheld | Spec 1.5: startup's sweep not awaited |
| intent | minor | D10's rare path missing from Accepted Risks | upheld | Row added |


### Round 3 — 2026-11-22

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 2:** Spec 1.5 (startup sweep not awaited); Spec 2 Start deadline
(`notAfter`); Spec 3 (full 8 s grace, `toolTerminateScript`, 1 s stdout drain cap,
sessions started before the change); Spec 4 (`toolTerminateScript`, `gone` only after
`notAfter`); Spec 5 (unknown tmux gives `ok: false`, `remove` honours `gateFailed`,
single in-flight sweep); Validation; Accepted Risks row.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

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
