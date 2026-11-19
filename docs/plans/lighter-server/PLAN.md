---
slug: lighter-server
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# A lighter server when many agents run

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. Current code is mapped in `MAP.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin's pick | user |
| 2 | Thread reads go through an in-memory cache keyed per file by `(mtimeMs, size, ino)`, checked with `fs.stat` on every `allThreads`/`thread` call; a changed or new file is re-read, a vanished one dropped. Callers get their own copy (no shared mutable objects) | A stat is far cheaper than read+parse of 18.5 MB; stat-based checks also catch writes from tests and outside the hub's queues (MAP: Thread reads) | defaulted |
| 3 | Archived threads stay in every listing (served from cache) rather than being filtered out of timers | Some timers need archived records (pending cancellations, parents of waiting stubs; MAP: Hub timers). With a cache they cost a stat, not a parse | defaulted |
| 4 | Locked "fresh read before acting" paths keep reading from disk, never the cache | They exist to avoid acting on stale data (pollDead, queues, quiet, merged, cancellation; MAP) | defaulted |
| 5 | `GET /threads` stops locking and re-reading every thread; it uses cached snapshots and locks only to persist a discovered slug/status, like `/features` | Same pattern `/features` already uses safely (`viewer/app/views.js:30`) | defaulted |
| 6 | Chat reads transcripts incrementally: the hub remembers each session's bytes and asks the machine for only what was appended (existing `?offset=` API), re-parsing only when new bytes arrived; the hub's transcript memory is capped and evicts sessions not read recently | Removes whole-file transfer and parse every 2s per open thread, and the unbounded `transcriptCache` (`viewer/app/chat.js:225`) | defaulted |
| 7 | The machine stops reading and hashing the whole kept transcript on each read: it serves offset reads from the file directly and keeps dedupe state in memory per session | `machine/service.js:900-943` reads and hashes the entire file per call | defaulted |
| 8 | Machine service polling (readiness, trust, Codex steps, tmux listing) uses non-blocking subprocess calls; a tmux failure still stays distinct from an empty list | `spawnSync` blocks the service's event loop (`machine/service.js:79`); MAP warns failure ≠ empty | defaulted |
| 9 | Keep polling with the same intervals; no switch to server push | Push would be a larger rewrite; the goal is cheap polls, not faster ones | defaulted |
| 10 | Pages pause their polling while the browser tab is hidden and refresh at once when shown again | A hidden tab shows nothing; refreshing on return keeps what Collin sees as fresh as today | defaulted |
| 11 | Browser test runs are capped at 2 workers each (`workers: 2` in `viewer/playwright.config.js`); no machine-wide queue | Collin's pick: predictable load, runs never wait on each other | user |
| 12 | Hub's transcript memory evicts a session not read for 10 minutes | Long enough that switching between a few threads stays instant; short enough that memory stays flat | defaulted |
| 13 | Chat re-parses a session's whole accumulated transcript only when new bytes arrived, rather than parsing incrementally | Parser state depends on earlier rows (MAP: Transcripts); parse-on-change removes the steady cost without that complexity | defaulted |
| 14 | `node --test` concurrency is left at its default | Unit tests spawn light processes; the browser runs are what saturate the machine | defaulted |
| 15 | No CPU benchmark is added to the repo; the before/after measurement is done on the live machine after install (Check it yourself) | A synthetic benchmark would not reflect real load; read-count tests guard the mechanism | defaulted |
| 16 | `/threads/:id/chat` gets no ETag/304 | With parse-on-change, an unchanged poll is already cheap | defaulted |
| 17 | Supersedes the "own copy" part of #2: `allThreads` returns shared, deep-frozen cached snapshots (copying 18.5 MB per call would cost about what parsing does). Every caller is audited; one that mutates clones that single record first. `thread(id)` and locked paths keep returning fresh, mutable objects from disk | Keeps the saving while making any missed mutation throw instead of corrupting the cache | defaulted |
| 18 | Machine and viewer test helpers must leave no process behind after a run ends normally or is killed; the cause of the leaked `/tmp/wheelchair-machine-test-*` session is found and fixed | IDEA "Why": leftover test processes ran for days | defaulted |

## Spec

Current code is described in `MAP.md` (file:line). Decision numbers refer to the Decision Log.

### S1. Thread snapshot cache (`viewer/app/state.js`)

- `allThreads()` keeps a per-file cache: `path -> { mtimeMs, size, ino, record }`. Each call lists the directory, `fs.stat`s every `*.json`, re-reads and parses only files whose `(mtimeMs, size, ino)` differ from the entry or that are new, and drops entries whose file is gone. Result order and filtering are unchanged (non-null records, sorted by `updated_at` desc).
- Cached records are deep-frozen. `allThreads` returns the cached objects (no copy).
- A file that fails to parse (partial write by an outside writer) is treated as today (`readJson` fallback `null`) and is not cached, so the next call retries.
- `thread(id)`, `updateThread`, `save` and every read inside `withThread` keep reading from disk and returning fresh mutable objects (#4). After the hub's own `save`/`updateThread`, the cache entry for that file is dropped (the next `allThreads` re-reads it).
- Handoff's direct unlink (`viewer/app/handoff-ops.js:45`) and any other delete is caught by the directory listing.
- Audit every `allThreads` caller listed in MAP.md ("All allThreads call sites"), plus `threadBySession`, balancer, usage, usage-poll, settings, agents, views, handoff, hub startup, cards `sudo_index`. A caller that mutates a returned record (including sorting a nested array in place) must `structuredClone` that one record first. Record the audit result (caller, mutates yes/no, fix) in this plan's Log.
- No archived filtering is added (#3).

### S2. Routes and timers use the cache

- `GET /threads` (both views): build the response from `allThreads()` snapshots. Lock and re-read a thread only when slug/status discovery finds something to persist, exactly as `/features` does (`viewer/app/views.js:30-54`). Any in-memory normalization `hub.thread()` applies on read (provider migration, `viewer/app/hub.js:111`) is applied to the response copy without saving; the save still happens on the next locked read as today.
- Timers keep their current intervals and their locked fresh re-read before acting. Their initial listing now comes from the cache, so an idle tick costs one stat per thread file.
- The aside timer skips calling `pump`/`sweepCancels` when no thread qualifies (it already filters; with the cache, the listing itself is cheap).

### S3. Incremental chat transcripts (hub, `viewer/app/chat.js`, `viewer/app/sessions.js`)

- Hub keeps `transcripts: key(machine/session) -> { text, offset, parsed, parsedAt, lastRead }` replacing the unbounded `hub.transcriptCache`.
- A chat read calls the machine with `?offset=<entry.offset>`. The machine replies `{ offset, data }` where `data` is complete lines from that byte offset and `offset` is the kept file's size. If the reply's `offset` is smaller than the stored one (file replaced) the hub refetches from 0 and replaces the entry.
- Chat parses `text` with the existing parser only when new bytes arrived since the last parse (#13); otherwise it reuses the parsed result. Chat output is byte-for-byte the same as parsing the whole transcript today.
- On a failed or timed-out machine call, chat (`keepLast`) uses the stored entry as today; a report reader (`viewer/app/sessions.js:373`) never uses a stale entry: it may use the entry only after a successful incremental fetch in the same call, else it behaves as today on failure.
- Eviction (#12): an entry not read for 10 minutes is dropped. Check on access and in an existing hub timer (the 60s wait timer).
- Also prune never-cleared per-thread maps in the hub (`handoffStatus`, `handoffStatusAt`, `handoffInspect`, `viewer/app/hub.js:43-45`) for threads that are archived or gone, in the same 60s timer; and `state.watched` in `viewer/server.js:1494` for paths no longer present.

### S4. Machine transcript reads (`machine/service.js`)

- `transcript(name, offset)`: read only from `offset` to end of the kept file (`fs.open` + positioned read, or a read stream), never the whole file. Return `{ offset: <kept file size>, data }`. `offset` greater than the size returns `{ offset: size, data: '' }`. Archived (forgotten-session) path behaves the same way.
- `copyTranscriptNow`: the dedupe hash set for a session is built once from the kept file (first copy after service start or after the session is forgotten) and kept in memory, then updated with each addition. It no longer re-reads and re-hashes the kept file per call. Sets are dropped when a session is forgotten.
- `persistSessions()` is called from `copyTranscriptNow` only when `transcript_source` or `transcript_path` actually changed.
- Existing behaviors stay: source replacement, shrink and inode reset; incomplete tails wait for their newline; concurrent copies serialize.

### S5. Non-blocking machine polling (`machine/service.js`)

- Add an async `commandAsync` (execFile with the same timeout, env and output handling as `command`) and async `tmuxAsync`/`liveTmuxAsync`. `pollReadiness` (2s), `pollTrust` (500ms), `pollCodexSteps` (2s), `/v1/sessions` and `status()` use them. `liveTmux`'s distinction between "no server" and "unknown failure" is preserved exactly.
- Each poll skips its tick if its previous run has not finished (no overlap).
- `readCodexSteps` persists the session registry at most once per poll tick, not once per advancing session.
- One-off command paths (start, stop, worktree operations) may keep the synchronous `command`.

### S6. Hidden tabs (`viewer/pages/*.js`)

- Every polling page (threads, agents, features, nav, thread chat, term-view, settings usage and sign-in) stops its timers when `document.visibilityState` becomes `hidden` and, when it becomes `visible`, polls once immediately and restarts its timers at the same intervals. Implement once as a shared helper used by all pages.

### S7. Browser tests and leftover processes

- `viewer/playwright.config.js` sets `workers: 2` (#11). `--workers` on the command line still overrides.
- Find why a machine-test Claude session under `/tmp/wheelchair-machine-test-*` outlived its run, and fix it so a machine or viewer test run that ends normally, fails, or is killed with SIGINT/SIGTERM leaves no process behind (use `test-support/run-dir.js` tracking or a process group kill). Record the cause in the Log.

### Non-goals

Agent CLIs' own usage; poll intervals; server push; ETags; moving or deleting archived threads or transcripts; changes to what any page shows.

### Validation

New tests (in the existing suites):
- `viewer/test`: with N unchanged thread files, a second `allThreads()` parses no file (spy on the read/parse path); an atomic outside replace, an in-place outside write with a new size, a new file and a deleted file are each reflected on the next call; mutating a returned record throws; `save` then `allThreads` returns the saved content.
- `viewer/test`: `GET /threads?view=list` makes no per-thread locked re-read when nothing needs persisting, and its JSON equals the pre-change output for the fixture set.
- `viewer/test`: chat second poll requests `?offset=` equal to the first reply's offset; the chat result equals a whole-file parse; a smaller reply offset triggers a refetch from 0; an entry unread for 10 minutes (fake clock) is evicted; a report read after a failed fetch never returns a stale entry.
- `machine/test`: an offset read returns only bytes after the offset and does not read the whole file (spy on `fsp.readFile` for the kept path); offset past the end returns empty; repeated copies with no new source bytes do not re-read the kept file and do not call `persistSessions`.
- `machine/test`: with a fake tmux that sleeps 1s, an HTTP request to the service during `pollReadiness` answers in under 200ms; a tmux failure still differs from an empty list.
- Browser test (`viewer/test/*.spec.js`): a page stops polling when hidden and polls immediately when shown.
- Leftovers: after `bash machine/test/run.sh` and after killing it mid-run with SIGTERM, `pgrep -f wheelchair-machine-test` finds no process started by that run.

Commands (all must pass):
```bash
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
bash machine/test/run.sh
node --test test-support/test/*.test.js
bash install/test/run.sh
```

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: other family; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
