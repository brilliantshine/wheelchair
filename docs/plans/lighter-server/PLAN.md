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
| 19 | Supersedes #15: add a repeatable synthetic measurement, `test-support/bench/hub-idle.js`, and record its pre-change numbers in the Log before code changes; the live-machine baseline is also recorded in the Log | Reviewers: success criteria in IDEA could not be checked as written, and the "before" would be lost after install | review-round-1 |
| 20 | Settings sign-in polling is excluded from hidden-tab pausing | Its GET drives the login forward (answers prompts, ends the login pane), and Collin signs in from another tab (`machine/service.js:1139-1157`) | review-round-1 |
| 21 | Malformed thread JSON keeps today's behaviour (the listing throws); a malformed file is never cached | Only `ENOENT` falls back today (`viewer/app/state.js:32-38`) | review-round-1 |
| 22 | `GET /threads` keeps discovering and persisting only the slug, as now; status discovery stays in `/features` | Spec had wrongly added status persistence to `/threads` (`viewer/app/routes.js:425-441`) | review-round-1 |
| 23 | Timers apply each action's own eligibility check to cached snapshots first, and lock and re-read only threads that match, re-checking before acting | Otherwise retry, quiet, waiting and limits still re-read every thread under lock each tick | review-round-1 |
| 24 | Transcript replies prove continuity: the hub sends a hash of the last bytes before its offset; on mismatch the machine returns the whole file flagged as a reset | A same-size or larger replacement would otherwise splice old and new text | review-round-1 |
| 25 | Hub transcript memory: 10-minute idle eviction plus a total budget of 64 MB, least-recently-read evicted first | A time limit alone does not bound memory for frequently read large transcripts | review-round-1 |
| 26 | Codex step registry writes are left as they are | Batching writes adds failure-ordering risk for a small saving | review-round-1 |
| 27 | Supersedes #8: the machine service's tmux and CLI checks stay synchronous; no machine polling changes in this plan | Collin's pick: the machine service is already light (128 MB, ~3% of a core), and non-blocking checks need extra coordination to avoid races | user |

## Spec

Current code is described in `MAP.md` (file:line). Decision numbers refer to the Decision Log.

### S1. Thread snapshot cache (`viewer/app/state.js`)

- `allThreads()` keeps a per-file cache: `path -> { mtimeMs, size, ino, record }`. Each call lists the directory, `fs.stat`s every `*.json`, re-reads and parses only files whose `(mtimeMs, size, ino)` differ from the entry or that are new, and drops entries whose file is gone. Result order and filtering are unchanged (non-null records, sorted by `updated_at` desc).
- Cached records are deep-frozen. `allThreads` returns the cached objects (no copy).
- A file that fails to parse is never cached, and `allThreads` throws as it does today (#21); only a file that vanished between listing and reading is skipped, as now (`ENOENT`).
- `thread(id)`, `updateThread`, `save` and every read inside `withThread` keep reading from disk and returning fresh mutable objects (#4). After the hub's own `save`/`updateThread`, the cache entry for that file is dropped (the next `allThreads` re-reads it).
- Handoff's direct unlink (`viewer/app/handoff-ops.js:45`) and any other delete is caught by the directory listing.
- Audit every `allThreads` caller listed in MAP.md ("All allThreads call sites"), plus `threadBySession`, balancer, usage, usage-poll, settings, agents, views, handoff, hub startup, cards `sudo_index`. A caller that mutates a returned record (including sorting a nested array in place) must `structuredClone` that one record first. Record the audit result (caller, mutates yes/no, fix) in this plan's Log.
- No archived filtering is added (#3).

### S2. Routes and timers use the cache

- `GET /threads` (both views): build the response from `allThreads()` snapshots. Run `findSlug` on the snapshot; only when it finds a slug to persist, lock, re-read that thread with `hub.thread()`, run `findSlug` on the fresh record and save, as today (#22). No status discovery is added. Any normalization `hub.thread()` applies on read (provider migration, `viewer/app/hub.js:111`) is applied to the response copy without saving. For the same thread files, the JSON returned equals today's.
- Timers keep their intervals. Each timer's action (aside pump and cancel sweep, `pollDead`, `retryQueues`, `checkQuiet`, `pollWaiting`, `pollMerged`, `retryWaiting`, `releaseLimits`, `pollIdle`) first applies its own existing eligibility check to the cached snapshot. Only matching threads are locked and re-read from disk, and the same check is applied again to the fresh record before anything is sent, saved or changed (#23, #4). A snapshot that does not match is skipped this tick; because a changed file is re-read on the next listing, a thread that becomes eligible is picked up on the next tick, as today. Where a timer needs related records (a waiting stub's parent), it reads them from the snapshot list for eligibility and from disk under the lock before acting.
- Result: an idle tick (nothing eligible) costs one directory listing and one `stat` per thread file, and no JSON parse.

### S3. Incremental chat transcripts (hub, `viewer/app/chat.js`, `viewer/app/sessions.js`)

- Hub keeps `transcripts: key(machine/session) -> { text, offset, tail, parsed, parsedKey, lastRead, bytes }`, replacing the unbounded `hub.transcriptCache`.
- A read calls the machine with `?offset=<entry.offset>&tail=<entry.tail>`, where `tail` is the hex sha256 of the last up to 256 bytes before `offset` (empty when `offset` is 0). The machine replies `{ offset, data, reset, tail }` (see S4). With `reset: false` the hub appends `data`; with `reset: true` it replaces `text` with `data`. `offset` and `tail` are stored from the reply (#24).
- Parsed output is cached with `parsedKey` = the transcript offset plus every thread field the parser reads (today `thread.parent_title`, `viewer/app/chat.js:130`; the worker lists all of them in the Log). Chat re-parses only when `parsedKey` changes (#13). Chat output equals parsing the whole transcript today.
- On a failed or timed-out machine call, chat (`keepLast`) uses the stored entry as today. A report reader (`viewer/app/sessions.js:373`) uses the entry only after a successful fetch in the same call; on failure it behaves as today.
- Memory (#25): an entry not read for 10 minutes is dropped; when the total `text` bytes across entries exceed 64 MB, least-recently-read entries are dropped until under. Checks run on every read and in the 60s wait timer. After eviction a read behaves exactly as today's first read of a session (including today's fallback to the local `transcript_path`, `viewer/app/chat.js:232`).
- Also prune never-cleared per-thread maps in the hub (`handoffStatus`, `handoffStatusAt`, `handoffInspect`, `viewer/app/hub.js:43-45`) for threads that are archived or gone, in the 60s timer; and entries in `state.watched` (`viewer/server.js:1494`) whose path no longer exists.

### S4. Machine transcript reads (`machine/service.js`)

- `transcript(name, offset, tail)`: if `offset > 0` and `offset <= size`, hash the up to 256 bytes before `offset` in the kept file; if it equals `tail`, return `{ offset: size, data: <bytes offset..size as UTF-8>, reset: false, tail: <hash of last up to 256 bytes before size> }`, reading only those byte ranges (positioned reads, never the whole file). Otherwise (no tail, mismatch, offset past the end) return the whole file with `reset: true`. `offset = 0` returns the whole file with `reset: true`. The kept file only ever gains complete newline-terminated lines, so `offset` is always at a line boundary. The archived (forgotten-session) path behaves the same way. Callers that pass only `offset` (older hubs) get today's reply shape plus the new fields.
- `copyTranscriptNow`: the dedupe hash set for a session is built from the kept file on first use after service start (or when missing) and kept in memory. New lines' hashes are added to the set only after `appendFile` succeeds; if the append throws, the set for that session is discarded so the next call rebuilds it from the file. Sets are dropped when a session is forgotten.
- `persistSessions()` is called from `copyTranscriptNow` only when `transcript_source` or `transcript_path` actually changed.
- Existing behaviours stay: source replacement, shrink and inode reset; incomplete tails wait for their newline; concurrent copies serialize.

### S5. Non-blocking machine polling

Dropped (#27). The machine service's tmux, readiness, trust, Codex step and `status()` code is not changed by this plan, except the transcript code in S4. Codex step registry writes are unchanged (#26).

### S6. Hidden tabs (`viewer/pages/*.js`)

- Add one shared helper, for example `poller(fn, ms)` returning `{ stop() }`. It runs `fn` every `ms` while `document.visibilityState` is `visible`, pauses while hidden, and on becoming visible calls `fn` once immediately and resumes. `stop()` removes it for good, so a stopped poller is never restarted by a later visibility change.
- Use it for: Threads, Agents, Features and nav polls, the thread chat poll, the aside panel poll (`viewer/pages/aside.js:30`), the terminal pane poll (`viewer/pages/term-view.js:177`) and the Settings usage poll. Where a page today clears or replaces a timer (closing, retargeting or finishing an aside, closing a terminal), it calls `stop()` and creates a new poller as needed.
- Not paused: Settings sign-in polling (#20), and the `/usage/alert` 5-minute check.

### S7. Browser tests, leftover processes and measurement

- `viewer/playwright.config.js` sets `workers: 2` (#11). `--workers` on the command line still overrides.
- Find why a machine-test Claude session under `/tmp/wheelchair-machine-test-*` outlived its run, record the cause in the Log, and fix it. Both runners (`bash machine/test/run.sh` and `npm --prefix viewer run test:browser`) export a unique `WHEELCHAIR_TEST_RUN=<id>` that every descendant inherits. When a run ends normally, fails, or receives SIGINT or SIGTERM, no process whose `/proc/<pid>/environ` carries that id remains 10 seconds later.
- Add `test-support/bench/hub-idle.js` (#19): generate 120 thread files totalling about 19 MB in a temp folder (8 non-archived with sessions and queued-free state, the rest archived), start an isolated viewer server on them with `--port` and `--cache-root` as in `viewer/test/helpers/server.js:72` and no reachable machine, poll `/threads?view=list`, `/features` and `/agents` every 5s as two open tabs would for 60s, and print the server's CPU seconds and peak RSS. Run it on unchanged code first and record the numbers in the Log.

### Non-goals

Agent CLIs' own usage; machine-service polling and subprocess calls (#27); poll intervals; server push; ETags; moving or deleting archived threads or transcripts; changes to what any page shows.

### Validation

New tests (in the existing suites):
- `viewer/test`: with N unchanged thread files, a second `allThreads()` parses no file (spy on the read/parse path); an atomic outside replace, an in-place outside write with a new size, a new file and a deleted file are each reflected on the next call; mutating a returned record throws; `save` then `allThreads` returns the saved content.
- `viewer/test`: `GET /threads?view=list` makes no per-thread locked re-read when nothing needs persisting, and its JSON equals the pre-change output for the fixture set.
- `viewer/test`: chat second poll requests `?offset=` equal to the first reply's offset and the matching `tail`; a change in `parent_title` alone re-renders; the chat result equals a whole-file parse; a smaller reply offset triggers a refetch from 0; an entry unread for 10 minutes (fake clock) is evicted; a report read after a failed fetch never returns a stale entry.
- `machine/test`: an offset read returns only bytes after the offset and does not read the whole file (spy on `fsp.readFile` for the kept path); offset past the end returns empty; repeated copies with no new source bytes do not re-read the kept file and do not call `persistSessions`.
- Browser test (`viewer/test/*.spec.js`): a page stops polling when hidden and polls immediately when shown; a stopped aside or terminal poller does not restart on show; sign-in keeps polling while hidden.
- Leftovers: for each runner, a normal run, and runs killed after 20s with SIGINT and with SIGTERM, leave no process carrying that run's `WHEELCHAIR_TEST_RUN` 10 seconds later (scan `/proc/*/environ`).
- `viewer/test`: a slow fetch does not let an evicted chat return stale text to a report read; the transcript budget evicts least-recently-read entries over 64 MB.
- `machine/test`: a same-size and a larger replacement of the kept file with a stale `tail` return `reset: true` with the whole new file; a failed append leaves the lines to be copied on the next call.
- `node test-support/bench/hub-idle.js` after the change reports at most a quarter of the CPU seconds recorded before the change, and peak RSS no higher than before.

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
| Live thread files are large (one is 2.7 MB, mostly per-session briefs) and rewritten on every event, so busy threads are still re-parsed often | The cache still removes all idle and archived re-reads (most of the bytes); shrinking stored session records changes what is kept and is a separate piece of work | 1 |

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Sign-in poll drives the login; pausing it when hidden stalls sign-in | upheld | #20, S6 |
| intent | major | No step records the before numbers or checks memory over a day | upheld | #19, S7, Log baseline |
| intent | minor | Live thread files are large and rewritten often, so they re-parse often | accepted-risk | Accepted Risks |
| intent | minor | Aside panel poll missing from S6 list | upheld | S6 |
| mechanics | blocking | Smaller offset is not proof of continuity; same-size or larger replacement splices | upheld | #24, S3, S4 |
| mechanics | blocking | Async checkReady callers can race on trust prompt and stopped sessions | user-decision | #27: dropped S5 |
| mechanics | blocking | Sign-in GET answers prompts; pausing stalls it | upheld | #20, S6 |
| mechanics | major | Malformed JSON throws today, not null | upheld | #21, S1 |
| mechanics | major | /threads discovers slug only; Spec added status | upheld | #22, S2 |
| mechanics | major | Retry, quiet, waiting, limits still re-read every thread under lock | upheld | #23, S2 |
| mechanics | major | Parsed cache ignores parent_title | upheld | S3 parsedKey |
| mechanics | major | No byte budget; outage after eviction undefined | upheld | #25, S3 |
| mechanics | major | Dedupe set commit point on failed append | upheld | S4 |
| mechanics | major | status() CLI checks stay synchronous | user-decision | #27: dropped S5 |
| mechanics | major | Codex batch persistence failure behaviour undefined | upheld | #26, dropped |
| mechanics | major | Aside poll missing; helper must not restart disposed pollers | upheld | S6 |
| mechanics | major | Leftover check misses descendants, viewer runner, SIGINT | upheld | S7, Validation |
| mechanics | major | No repeatable acceptance check for CPU/RAM | upheld | #19, S7 bench |

### Round 2 — 2026-11-18

**Lanes:** pending.

**Changed since Round 1:** S1 malformed-file behaviour (#21); S2 rewritten: `/threads` slug-only, timers check eligibility on snapshots before locking (#22, #23); S3 continuity tail hash, parsedKey with thread fields, 64 MB budget, eviction behaviour (#24, #25); S4 tail check and reset, dedupe set committed after append; S5 dropped (#26, #27); S6 shared poller with stop(), aside poll added, sign-in excluded (#20); S7 run-marker leftover check and `hub-idle.js` benchmark (#19); Validation updated; Accepted Risk on large live thread files; Log baseline.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-18 live baseline (before any change): hub `viewer/server.js --service` up 47 min, RSS 1.7 GB (730 MB at 10 min), 30.8 CPU-seconds per 60 s (51% of a core); machine service RSS 128 MB, 77 CPU-seconds over 48 min; 21 agent CLIs live; 117 thread files, 19 MB.
