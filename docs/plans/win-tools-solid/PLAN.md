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
| D2 | (`win-sessions.json` superseded by D8; launch-record timing by D10) Restart recovery follows the parent design: a durable per-session launch record (wrapped, copy key) in `win-sessions.json` written before tmux starts; on service start, every live wrapped session whose ready file is not `ready` gets a fresh attempt token and readying | Already reviewed in windows-bridge-solid (`5950541c^:docs/plans/windows-bridge-solid/PLAN.md:194-211`); no user-visible choice in it | defaulted |
| D3 | (superseded by D11) Every new wait is bounded: a stop, sweep or archive waits at most 15 s for Windows tools, then logs and goes ahead | IDEA constraint; matches the last reviewed design's 15 s `onStop` wait | defaulted |
| D4 | The go-between notices a closed reader by a zero-length `fs.writeSync(1, Buffer.alloc(0))` probe every 2 s while idle; `EPIPE` starts its normal shutdown | Lead's local check on Node 26/Linux: the probe throws `EPIPE` within one interval after the reader closes, while stdout itself emits nothing; a zero-length write adds no bytes to the stream | defaulted |
| D5 | A stop ends every Windows program a tool started: the go-between starts the tool through a launcher that puts it in a named Windows Job Object (option A) | User's choice over "wait for quiet" and "tool only" | user |
| D6 | The copy-wide gate waits for go-betweens of sessions that ended without a normal stop, and ends the job of any whose go-between died | A dying CLI closes the go-between's stdin and tmux kill sends SIGHUP, both of which start its shutdown (`machine/lib/win-tool-proxy.js:63-66`); only a go-between killed outright (SIGKILL, OOM) leaves its job behind, and its registry file names that job | defaulted |
| D7 | (`terminateScript` superseded by Spec 4's `toolTerminateScript`; timing by D11) When a wait runs out, remaining jobs are ended (`terminateScript`) before the reconcile goes ahead | IDEA constraint "every wait is bounded"; ending them is the only way the reconcile is not racing a writer | defaulted |
| D8 | Launch flags are kept on the session record in `sessions.json` (`windows_tools`, `wrapped_tools`), not a new `win-sessions.json` | The service already persists every session there before and after launch (`machine/service.js:567`); one file, one source of truth | defaulted |
| D9 | Idle reader detection uses a zero-length write probe on sockets, a check of the parent's read end in `/proc` on OS pipes, and a parent-gone check; supersedes D4 | Round 1: a zero-length `write()` on a Linux pipe never raises `EPIPE` (reviewer's and lead's checks), and Codex gives tools OS pipes. Lead's check: a Node child with stdout on an `os.pipe()` sees its parent drop the read end within one 300 ms poll | review-round-1 |
| D10 | Launch flags ride on the session record saved after tmux starts, as today; no pre-tmux write | Round 1: a pre-tmux insert needs rollback and save ordering; a restart between tmux start and that save is a sub-second window (rare path) | review-round-1 |
| D11 | The gate has one 20 s deadline covering polling and termination; termination must be confirmed, otherwise the copy is not synced or removed (kept, retried by the next sweep or kept by archive) | Round 1: PowerShell calls could exceed the 15 s bound, and an unconfirmed termination would let the reconcile race a writer | review-round-1 |
| D12 | The gate runs inside `sync` and `remove`, not at each caller | Round 1: launch readying, `wc.js win` and `onWorktreeRemoved` also reconcile or delete copies | review-round-1 |
| D13 | The launcher start deadline is the go-between's existing start allowance (`--init-ms`, 60 s), not 10 s; a stop during a slower start leaves the entry for the gate. The start acknowledgment line is dropped | Round 3: a fixed 10 s would kill slow cold starts with no stop happening; the acknowledgment no longer controlled anything | review-round-3 |
| D14 | Split off: stop, sweep and archive waiting for Windows tools and the programs they start (D5-D7, D11-D13, Spec 2-5 at `65bdcd4f`) move to their own thread; IDEA's two matching "What good looks like" bullets move to Not doing. D5-D7 and D11-D13 no longer apply here | User's choice after three review rounds in which that part drew blocking or major findings each round and the rest settled | idea-change |
| D15 | Stranded sessions are found by their ready file, not by new `windows_tools`/`wrapped_tools` fields on the session record; supersedes D8 and D10, and the Accepted Risk about the record-save window is gone with them | Round 4: the ready file is written before tmux and removed on stop, so it already marks exactly the sessions to recover; flags added nothing for recovery and touched unwrapped sessions | review-round-4 |

## Spec

Scope: WSL machines with wrapped Windows stdio tools (`win-tool-gobetween`'s go-between,
`machine/lib/win-tool-proxy.js`). Nothing changes on other machines, for unwrapped
entries, or for `mcp-for-unity`. Background maps: `docs/maps/windows-stdio-gobetween.md`,
`docs/maps/windows-bridge-runtime.md`.

Split off (D14): making stop, sweep and archive wait for Windows tools and what they start
(the job launcher, stop budget, tool registry and copy-wide gate) is its own thread; its
last design is Spec 2-5 of this plan at commit `65bdcd4f`. MAP.md's writer gate, registry
and Job Object material describes that work, not this plan.

### 1. Restart recovery (IDEA item 1)

1. **Which sessions are stranded.** Every wrapped session gets its ready file
   (`<stateDir>/win-ready/<name>`) before tmux starts (`beginReady` in `beforeLaunch`,
   `machine/lib/win.js:183-185`), and stop removes it (`win.js:280`). So on service start a
   live tool-role session whose ready file exists and is not `{"state":"ready"}` is a
   wrapped session whose tools are still waiting. No new session-record fields (D15).
2. **On service start**, `WinBridge.startup` (`machine/lib/win.js:397-417`) keeps today's
   loop unchanged, and additionally, for each live tool-role session (same filter) with
   such a ready file: adds it to `toolSessions` and registers and marks its copy **even if
   the copy does not exist yet** (the copy key and paths come from `context(session)`). Sessions without a ready file are handled exactly as today.
3. For each of those: run the same readying a launch does (`beginReady` for a fresh token,
   then `prepareLaunch(session, { windowsTools: true, wrappedTools: true, token })`), in the background, not awaited by startup. Its
   outcome publishes `ready` or `failed` exactly as at launch. A `ready` file is left alone
   (its go-between has already started the tool).
4. **Recovery is visible at once.** For each such session, `startup`, before its first
   `await` for that session, computes `key = worktreeKey(session.worktree)` (synchronous)
   and puts the whole recovery sequence's promise (`beginReady` through `prepareLaunch`
   settling) into a new `this.recovering` Map under `key` (chained after any recovery
   already there for that key), deleted when it settles. A helper `pendingReady(key)`
   returns a promise for both `recovering.get(key)` and `readying.get(key)` settling;
   every place that waits on or checks `readying` today (`win.js:200,288,301,323,435,462`)
   uses it instead, so stop, `onWorktreeRemoved`, archive, `info` and `wc.js win` calls
   wait for a recovery from the moment startup begins it. `prepareLaunch` itself keeps
   joining `readying` only (no self-wait). `sweep()` (`win.js:361-370`) also skips, for this round, a copy whose key
   has a pending readying or recovery (today it checks only `running`), so a final reconcile never runs
   while a copy is still being created.
5. **Every session sharing a readying task gets its outcome.** Several sessions on one copy
   join the same `readying` task (`win.js:225-249`), and `publishReady` writes only tokens
   already attached when it runs (`win.js:149-153`). So the shared task resolves to an
   outcome, `{ ok: true, copy: ctx.copy.windows }` or `{ ok: false, reason }` (it still
   never rejects), and every `prepareLaunch` caller that has a token attaches, right after
   getting or creating the task and before its own 45 s race, a handler on the task that
   writes its own session's ready file with its own token from that outcome (`ready` with
   `copy`, or `failed` with `reason`). The handler runs when the task settles, whether or
   not the caller's wait already timed out; `writeReady` drops it if the token is no longer
   current, and a second write of the same state is harmless. This applies to launch and
   recovery alike.
6. **A copy left half-created by a restart.** `ensureCopy` (`machine/lib/win-sync.js:71-120`)
   treats an existing `.git` as a finished copy, so a restart during creation (after `git
   init`, before config or seeding finish) would leave a partial copy marked ready. Change:
   `ensureCopy` writes the file `.git/wheelchair-copy-complete` as its last step. A copy
   whose `.git` exists but has no marker counts as finished only if the copy's state has
   `last_ok` (a copy made before this change; the marker is then written); otherwise the
   copy folder is deleted and created from scratch.

### 2. Idle reader closed (IDEA item 4, D4 superseded by D9)

Every 2 s (`--probe-ms`, default 2000, for tests), while stdout has no write in flight, the
go-between runs both checks; either failing calls `stdoutLost()`, which shuts the tool down as today (`machine/lib/win-tool-proxy.js:40,63`):
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

### 3. Non-goals

No change to the handshake, held calls, list cache, `list_changed`, which entries are
wrapped, how the go-between starts or stops its tool, app tracking (`AppTracker`), or
when a copy is synced or removed, beyond the sweep skipping a copy being readied (1.4).

### Validation

Tests use fake Windows and fake ready files, as the existing win tests do:
- restart: a live session with a `waiting` (or `failed`) ready file is tracked and
  readied after `startup`, with and without an existing copy; a `ready` file is untouched;
  a live session with a copy and no ready file is tracked exactly as today; one with
  neither is not tracked; two sessions on one copy whose second token attaches after the shared task has
  published both end with the task's outcome in their ready files, also when that second
  caller's 45 s wait expired first (short `readyTimeoutMs`) and for both `ready` and
  `failed` outcomes; a sweep during a recovery skips that copy; a stop called while
  startup's recovery for that session is still in `beginReady` waits for the recovery
  before its final step; a copy with `.git` but no completion marker and no `last_ok` is
  recreated, one with `last_ok` and no marker is kept and marked, one with the marker is
  kept.
- go-between: with stdin kept open and the parent alive, idle reader closed is noticed
  within two probe intervals and the tool is stopped, both with stdout as a socketpair (Node `spawn`) and as an OS pipe (spawn the
  proxy with stdout from `os.pipe()`, e.g. through `python3 -c`, then close the read end);
  a parent that holds no read end at start turns the pipe check off; parent gone is
  noticed while an independent process keeps both pipe ends open (so stdin never ends);
  the probe does not run while a write is pending.

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
| mechanics | blocking | Stop's single termination attempt can say `gone` before a still-starting launcher creates its job | upheld | Spec 3 step 3: retry after `notAfter` |
| mechanics | blocking | `TerminateJobObject` returning is not proof processes exited | upheld (Microsoft docs: termination is asynchronous) | Spec 4: `ended` only after the job's process count reaches 0 |
| mechanics | blocking | A gate refusal inside archive's own final sync leaves `archiveAttempted` set and the copy removable | upheld | Spec 5: refusal during an archive adds to `gateFailed` |
| mechanics | major | 12 s exit assertion vs 1 s drain after the budget | downgraded to minor: a number mismatch, not a design gap | Spec 3 and Validation: 13 s |
| intent | major | Fixed 10 s `notAfter` kills slow cold starts with no stop happening | upheld | `notAfter` = spawn + `--init-ms` (D13) |
| intent | minor | `wc-tool-started` acknowledgment no longer controls anything | upheld | Dropped (D13) |
| intent | minor | D7 and D2 not marked superseded | upheld | Marked |


### Round 4 — 2026-11-22

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 3:** the split (D14): Spec now holds only restart recovery (1) and
idle reader (2); old Spec 2-5, Spec 1.5, C1 and their Validation removed; Non-goals and
Validation rewritten; IDEA.md What, Why, What good looks like, Not doing and Constraints
narrowed to match.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Pre-upgrade session with a `waiting` ready file but no copy is not recovered | upheld (as major: wording gap) | Spec 1.2: wrapped implies Windows tools |
| mechanics | blocking | Session joining a shared readying task after publish never gets its outcome | upheld | Spec 1.5: each caller writes its own outcome |
| mechanics | major | Sweep does not wait for `readying` as Spec 1.4 claimed | upheld (`win.js:361-370` checks only `running`) | Sweep skips copies being readied |
| mechanics | minor | Idle tests could pass through stdin EOF | upheld | Validation: stdin held open, independent holder |
| intent | minor | Ready file already marks stranded sessions; launch flags unneeded | upheld | Spec 1.1-1.2 rewritten (D15) |
| intent | minor | Flags changed behaviour for unwrapped sessions with no copy | upheld | Gone with D15 |
| intent | minor | MAP.md still describes split-off work | upheld | Spec scope note says so (MAP.md is the mapper's file) |


### Round 5 — 2026-11-22

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 4:** Spec 1.1-1.3 rewritten (stranded sessions found by ready file;
no session-record flags, D15); Spec 1.4 sweep skips copies being readied; Spec 1.5 each
caller writes its own outcome; Validation; Accepted Risks row removed; scope note on MAP.md.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | A caller whose 45 s wait expired before the shared task settles is still left at `waiting` | upheld | Spec 1.5: outcome handler on the task, independent of the caller's wait |
| mechanics | major | Gap between startup returning and recovery appearing in `readying` | upheld | Spec 1.4: `recovering` map set synchronously, `pendingReady` helper |
| mechanics | major | Restart mid copy creation leaves a partial copy that recovery marks ready | upheld (`win-sync.js:73` treats `.git` as done) | Spec 1.6: completion marker |

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
