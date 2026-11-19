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
| 28 | Supersedes #4 and refines #23: only `retryQueues`, `checkQuiet`, `pollWaiting`, `pollMerged`, `retryWaiting` and `releaseLimits` get a snapshot prefilter. `pollDead`, `pollIdle` and the aside timer keep their current logic and only take their listing from the cache. Every action still re-reads under its lock before acting | pollDead has two reasons to lock (missing session, CLI id to copy) and pollIdle decides per account, not per thread; prefiltering them adds risk for little gain | review-round-2 |
| 29 | Supersedes #24: transcript continuity uses a generation id of the kept file (inode plus birth time) instead of a tail hash. The machine owns the kept file and only appends whole lines, so a new generation means a new file; replies end at the last complete line | A tail hash missed edits earlier in the file; the generation id is simpler and exact for a machine-owned append-only file | review-round-2 |
| 30 | The live before/after and day-long memory check is done after install through Check it yourself, against the Log baseline; the Spec's acceptance is the benchmark, which now includes chat polling over many growing transcripts and a 5-minute memory check | A pre-merge verifier cannot observe a day on the live server; the benchmark exercises the same growth paths | review-round-2 |
| 31 | The chat route reads its thread and parent from the cache; it locks and re-reads only to persist a discovered slug | Every open chat page otherwise parses the thread (and parent) file every 2s | review-round-2 |
| 32 | Supersedes #6, the offset-read part of #7, #24 and #29: no byte-offset deltas between hub and machine. The hub sends what it already holds (`known=<gen>:<end>`); the machine answers `unchanged` (a stat, no data) or the whole transcript. The hub re-parses only on a whole reply | Deltas kept producing splice, bootstrap and concurrency hazards; most polls happen while the lead is idle, where `unchanged` gives nearly all the saving, and a whole reply is always a coherent snapshot | review-round-3 |
| 33 | Supersedes the locking part of #31: chat keeps holding the thread lock through assembly, as today; inside the lock it reads the thread and parent as stat-checked cached snapshots and takes a fresh mutable read only to persist a slug | A handoff mutation must not interleave with chat assembly (`viewer/test/app-handoff.test.js:372`); a stat-checked snapshot under the lock is as fresh as a disk read for the hub's atomic writes | review-round-3 |
| 34 | Parsed chat output is kept only for the 8 most recently read entries; the 64 MB budget counts raw text | Bounds the parsed objects too without estimating object sizes | review-round-3 |

## Spec

Current code is described in `MAP.md` (file:line). Decision numbers refer to the Decision Log.

### S1. Thread snapshot cache (`viewer/app/state.js`)

- Add `threadSnapshot(id)`: the same stat-checked cache for one file, returning the frozen record (used by chat, S2).
- `allThreads()` keeps a per-file cache: `path -> { mtimeMs, size, ino, record }`. Each call lists the directory, `fs.stat`s every `*.json`, re-reads and parses only files whose `(mtimeMs, size, ino)` differ from the entry or that are new, and drops entries whose file is gone. Result order and filtering are unchanged (non-null records, sorted by `updated_at` desc).
- Cached records are deep-frozen. `allThreads` returns the cached objects (no copy).
- A file that fails to parse is never cached, and `allThreads` throws as it does today (#21); only a file that vanished between listing and reading is skipped, as now (`ENOENT`).
- `thread(id)`, `updateThread`, `save` and every read inside `withThread` keep reading from disk and returning fresh mutable objects (#4). After the hub's own `save`/`updateThread`, the cache entry for that file is dropped (the next `allThreads` re-reads it).
- Handoff's direct unlink (`viewer/app/handoff-ops.js:45`) and any other delete is caught by the directory listing.
- Audit every `allThreads` caller listed in MAP.md ("All allThreads call sites"), plus `threadBySession`, balancer, usage, usage-poll, settings, agents, views, handoff, hub startup, cards `sudo_index`. A caller that mutates a returned record (including sorting a nested array in place) must `structuredClone` that one record first. Record the audit result (caller, mutates yes/no, fix) in this plan's Log.
- No archived filtering is added (#3).

### S2. Routes and timers use the cache

- Split `findSlug` (`viewer/app/views.js:99`) into a read-only `discoverSlug(thread)` that returns the slug or `null` without mutating or saving, and the persisting step. `GET /threads` (both views) calls `discoverSlug` on the snapshot; only when it returns a slug does it lock, re-read with `hub.thread()`, run `discoverSlug` again on the fresh record, and if it still returns a slug set it, save and register the plan, as `findSlug` does today. `findSlug`'s other callers keep its current behaviour (implemented on top of `discoverSlug`). No status discovery is added to `/threads` (#22).
- `GET /threads` builds its response from snapshots. A snapshot that needs `hub.thread()`'s provider migration (`viewer/app/hub.js:111`: no `provider`, has `cli` and sessions) is instead read through `hub.thread()` under the lock, as today, so the migration is saved and its `updated_at` shows in the response. For the same thread files, the JSON returned equals today's.
- Chat (`hub.chat`, `viewer/app/hub.js:244`) keeps its lock through assembly (#33). Inside it, `chat.chat` and `hub.chat` read the thread and its parent with `threadSnapshot`, use `discoverSlug`, and only when a slug is found take `hub.thread()`, set the slug, save and register as above. Response objects built from snapshots are new objects; snapshots are never mutated.
- Timers keep their intervals and take their listing from the cache. These six apply their own existing eligibility check to each snapshot first and lock and re-read only matching threads, re-applying the check to the fresh record before sending, saving or changing anything (#23, #28): `retryQueues`, `checkQuiet`, `pollWaiting` (a stub's parent is read from the snapshot list for eligibility and from disk under the lock before acting), `pollMerged`, `retryWaiting`, `releaseLimits`. `pollDead`, `pollIdle` and the aside timer keep their logic unchanged apart from the cached listing (#28).
- A snapshot that does not match is skipped this tick; a changed file is re-read on the next listing, so a thread that becomes eligible is picked up on the next tick, as today.

### S3. Chat transcripts fetched only when changed (hub, `viewer/app/chat.js`, `viewer/app/sessions.js`)

- Hub keeps `transcripts: key(machine/session) -> { text, known, parsed, parsedKey, lastRead, incremental }`, replacing the unbounded `hub.transcriptCache`. Fetches for one key are serialized (one in flight; others wait for it and use its result).
- A read calls `/v1/sessions/<name>/transcript?known=<entry.known or empty>` (#32). The reply (S4):
  - `mode: 'unchanged'`: keep `text`; update `lastRead`.
  - `mode: 'full'`: replace `text` with `data`, set `known` to `<gen>:<end>`, drop `parsed`.
  - `mode: 'unavailable'`: treated exactly like a failed call (below); the entry is not changed.
  - no `mode` (an older machine, which ignores `known` and returns `{ offset, data }` for offset 0): use `data` as the whole transcript, as today; store it as the entry's `text` with `known` empty, so the next read is again a whole read, and so chat can fall back to it.
- Parsed output is cached with `parsedKey` = `known` plus every thread field the parser reads (today `thread.parent_title`, `viewer/app/chat.js:130`; the worker lists all of them in the Log). Chat re-parses only when `parsedKey` changes or after a `full` or older-machine reply (#13). Chat output equals parsing the whole transcript today.
- On a failed or timed-out call or an `unavailable` reply, chat (`keepLast`) uses the entry's `text`, or today's fallback when there is none. A report reader (`viewer/app/sessions.js:373`) uses the entry only after an `unchanged`, `full` or older-machine reply in the same call; otherwise it behaves as today on failure.
- Memory (#25, #34): an entry not read for 10 minutes is dropped; when the total `text` bytes exceed 64 MB, least-recently-read entries are dropped until under; `parsed` is kept only for the 8 most recently read entries. Checks run on every read and in the 60s wait timer. After eviction a read behaves exactly as a first read.
- Also prune never-cleared per-thread maps in the hub (`handoffStatus`, `handoffStatusAt`, `handoffInspect`, `viewer/app/hub.js:43-45`) for threads that are archived or gone, in the 60s timer; and entries in `state.watched` (`viewer/server.js:1494`) whose path no longer exists.

### S4. Machine transcript reads (`machine/service.js`)

- A request without a `known` parameter (older hub) takes today's code path unchanged, including its `offset` handling, its empty reply for a managed session with no copy, and its 404 for an unknown session with no archived copy (`machine/test/service.test.js:549-558, 593-601`).
- A request with `known` (possibly empty):
  - unknown session with no archived copy: 404, as today.
  - managed session with no kept copy yet, or a kept copy that cannot be opened: `{ mode: 'unavailable' }`.
  - otherwise open the kept file once and use that one handle for everything: `fstat` gives `gen` = `"<ino>-<birthtimeMs>"` (`birthtimeMs` 0 where unsupported) and `size`; `end` is the byte position just after the last `\n`, found by reading backwards from `size` through the handle. If `known` equals `"<gen>:<end>"` reply `{ mode: 'unchanged', gen, end }` without reading the rest; else reply `{ mode: 'full', gen, end, data: <bytes 0..end as UTF-8> }` read through the same handle.
  - The live-session copy (`copyTranscript`) still runs before the read, as today. The archived (forgotten-session) path follows the same rules.
- `copyTranscriptNow`: the dedupe hash set for a session is built from the kept file's complete lines on first use after service start (or when discarded) and kept in memory. Before building it, if the kept file does not end in `\n`, truncate it to `end` (the machine owns this file). New lines' hashes are added only after `appendFile` succeeds; if it throws, the set is discarded so the next call truncates any fragment and rebuilds. Sets are dropped when a session is forgotten.
- `persistSessions()` is called from `copyTranscriptNow` only when `transcript_source` or `transcript_path` actually changed.
- Existing behaviours stay: source replacement, shrink and inode reset; incomplete source tails wait for their newline; concurrent copies serialize.

### S5. Non-blocking machine polling

Dropped (#27). The machine service's tmux, readiness, trust, Codex step and `status()` code is not changed by this plan, except the transcript code in S4. Codex step registry writes are unchanged (#26).

### S6. Hidden tabs (`viewer/pages/*.js`)

- Add one shared helper, for example `poller(fn, ms)` returning `{ stop() }`. It runs `fn` every `ms` while `document.visibilityState` is `visible`, pauses while hidden, and on becoming visible calls `fn` once immediately and resumes. Each page's poll function returns its in-flight promise when called while busy (shared by the helper and by direct calls, such as chat actions calling `poll()`); if a request is in flight when the tab becomes visible, exactly one more call runs right after that promise settles. `stop()` removes it for good, so a stopped poller is never restarted by a later visibility change.
- Use it for: Threads, Agents, Features and nav polls, the thread chat poll, the aside panel poll (`viewer/pages/aside.js:30`), the terminal pane poll (`viewer/pages/term-view.js:177`) and the Settings usage poll. Where a page today clears or replaces a timer (closing, retargeting or finishing an aside, closing a terminal), it calls `stop()` and creates a new poller as needed.
- Not paused: Settings sign-in polling (#20), and the `/usage/alert` 5-minute check.

### S7. Browser tests, leftover processes and measurement

- `viewer/playwright.config.js` sets `workers: 2` (#11). `--workers` on the command line still overrides.
- Find why a machine-test Claude session under `/tmp/wheelchair-machine-test-*` outlived its run, record the cause in the Log, and fix it. Both runners (`bash machine/test/run.sh` and `npm --prefix viewer run test:browser`) export a unique `WHEELCHAIR_TEST_RUN=<id>` that every descendant inherits. When a run ends normally, fails, or receives SIGINT or SIGTERM, no process whose `/proc/<pid>/environ` carries that id remains 10 seconds later.
- Add `test-support/bench/hub-idle.js` (#19, #30). It creates a temp state directory and passes it with `--state-dir`, plus `--port` and `--cache-root` as in `viewer/test/helpers/server.js:66-74`, so the real hub state is never opened. Fixture: 120 thread files totalling about 19 MB; 8 non-archived threads with 5 lead sessions each (40 sessions), the rest archived. The script runs a fake machine: an HTTP server answering `/v1/sessions` and `/v1/sessions/<name>/transcript` in both the old and the new form (S4) for the 40 sessions, with 3 MB transcripts each growing by a few lines every 2s. Every 3s it rewrites 3 non-archived thread files (atomic replace, new `updated_at`). Workload: two "tabs" poll `/threads?view=list`, `/features` and `/agents` every 5s, and chat for one non-archived thread every 2s, moving to the next thread every 30s. Before measuring it checks that the API returns the fixture thread ids, that chat replies succeed with items from the fake transcripts, and that a revisited thread's chat shows more items than on the previous visit; it aborts otherwise. It runs 12 minutes by default (`--seconds`), and prints CPU seconds per minute, RSS at 6 minutes (after a full pass over all 8 threads, twice) and at the end, and peak RSS. Run it on unchanged code first and record the numbers in the Log, with a heap snapshot summary of what holds memory at the end.

### Non-goals

Agent CLIs' own usage; machine-service polling and subprocess calls (#27); poll intervals; server push; ETags; moving or deleting archived threads or transcripts; changes to what any page shows.

### Validation

New tests (in the existing suites):
- `viewer/test`: with N unchanged thread files, a second `allThreads()` parses no file (spy on the read/parse path); an atomic outside replace, an in-place outside write with a new size, a new file and a deleted file are each reflected on the next call; mutating a returned record throws; `save` then `allThreads` returns the saved content.
- `viewer/test`: `discoverSlug` never mutates or saves; a `/threads` fixture includes a record without `provider`, and its migration is saved with the same response as today; `GET /threads?view=list` makes no per-thread locked re-read when nothing needs persisting, and its JSON equals the pre-change output for the fixture set.
- `viewer/test`: chat's second poll sends `known` from the first reply; `unchanged` re-uses the parsed result without parsing; a `full` reply replaces the text and re-renders even at the same size; a reply without `mode` is used as the whole transcript and a later timeout still shows it; `unavailable` keeps the last chat; two concurrent reads of one session make one machine call; a change in `parent_title` alone re-renders; the chat route parses no thread file when nothing changed; the handoff lock test (`viewer/test/app-handoff.test.js:372`) still passes with its route match updated for the query string; the chat result equals a whole-file parse; an entry unread for 10 minutes (fake clock) is evicted; a report read after a failed fetch never returns a stale entry.
- `machine/test`: an `unchanged` reply does not read the kept file's contents (spy on reads of the kept path beyond the backward newline search); repeated copies with no new source bytes do not re-read the kept file and do not call `persistSessions`.
- Browser test (`viewer/test/*.spec.js`): a page stops polling when hidden and polls immediately when shown; a stopped aside or terminal poller does not restart on show; becoming visible while a chat poll (started by the timer or by a chat action) is in flight produces one fresh poll after it settles; sign-in keeps polling while hidden.
- Leftovers: for each runner, a normal run, and runs killed after 20s with SIGINT and with SIGTERM, leave no process carrying that run's `WHEELCHAIR_TEST_RUN` 10 seconds later (scan `/proc/*/environ`).
- `viewer/test`: a slow fetch does not let an evicted chat return stale text to a report read; the transcript budget evicts least-recently-read entries over 64 MB.
- `machine/test`: a request with `known` equal to the current `gen:end` gets `unchanged` with no data; a replaced kept file (same size, larger, smaller) answers the old `known` with `full` and the new file; an empty `known` gets `full`; a request without `known` gets today's reply, including the empty reply for a session with no copy and the 404 for an unknown session; with `known`, a session with no copy gets `unavailable`; an append that writes part of a line then throws leaves, after the next copy, a kept file of whole lines with every source line exactly once.
- `node test-support/bench/hub-idle.js` after the change: CPU seconds at most a quarter of the pre-change run; RSS at the end at most 110% of RSS at 6 minutes; peak RSS below the pre-change peak. If the pre-change heap summary shows a large holder not covered by S1–S4, the implementer reports it to the lead before building.

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

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** S1 malformed-file behaviour (#21); S2 rewritten: `/threads` slug-only, timers check eligibility on snapshots before locking (#22, #23); S3 continuity tail hash, parsedKey with thread fields, 64 MB budget, eviction behaviour (#24, #25); S4 tail check and reset, dedupe set committed after append; S5 dropped (#26, #27); S6 shared poller with stop(), aside poll added, sign-in excluded (#20); S7 run-marker leftover check and `hub-idle.js` benchmark (#19); Validation updated; Accepted Risk on large live thread files; Log baseline.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Benchmark skips chat and transcripts; no live after-reading | upheld | #30, S7 bench |
| intent | minor | Chat poll still parses thread and parent from disk every 2s | upheld | #31, S2 |
| intent | minor | #4 contradicts #23 | upheld | #28 |
| mechanics | blocking | Tail hash misses changes earlier in the file | upheld | #29, S4 gen |
| mechanics | blocking | Same-size reset keeps stale parsed output | upheld | S3 full drops parsed; parsedKey has gen |
| mechanics | blocking | Offset past end handled three ways | upheld | S4 one rule; Validation aligned |
| mechanics | blocking | No fallback for an older machine's reply | upheld | S3 no-mode rule, S4 legacy form |
| mechanics | blocking | Partial append leaves a fragment counted as a line | upheld | S4 truncate to last newline |
| mechanics | blocking | findSlug mutates and saves; can't run on frozen snapshot | upheld | S2 discoverSlug split |
| mechanics | major | pollDead eligibility has two reasons | upheld | #28: pollDead unchanged |
| mechanics | major | pollIdle is per account | upheld | #28: pollIdle unchanged |
| mechanics | major | Empty reply vs unavailable copy | upheld | S3/S4 `unavailable` |
| mechanics | major | Visibility refresh while a poll is in flight | upheld | S6 follow-up call |
| mechanics | major | Benchmark lacks `--state-dir`, could read real state | upheld | S7 |
| mechanics | major | RE-RAISE: day-long memory unchecked | upheld | #30 |

### Round 3 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** S2 rewritten (`discoverSlug` split, chat route uses snapshots, prefilter only for six timers; pollDead, pollIdle, aside unchanged; #28, #31); S3 rewritten (generation id, `append`/`full`/`unavailable`/no-mode handling, parsed cache keyed by gen; #29); S4 rewritten (gen, last-newline `end`, legacy reply, truncate-to-newline recovery); S6 in-flight follow-up; S7 benchmark with `--state-dir`, fake machine, chat over 40 growing transcripts, 5 minutes, heap summary (#30); Validation updated to match.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Memory check at 1 minute fails a correct build; budget not yet full | upheld | S7: measure from 6 min, 12-min run |
| intent | minor | Benchmark never rewrites thread files | upheld | S7: rewrite 3 files every 3s |
| intent | minor | Budget ignores parsed output | upheld | #34 |
| mechanics | blocking | New hub can never bootstrap incremental reads | upheld | #32: `known` param always sent |
| mechanics | blocking | Concurrent deltas corrupt the cached transcript | upheld | #32 whole replies; S3 per-key serialization |
| mechanics | blocking | Older-machine fallback drops last good copy | upheld | S3 keeps it as text |
| mechanics | major | Legacy request vs missing copy rules overlap | upheld | S4 legacy path unchanged |
| mechanics | major | gen, end and bytes must come from one handle | upheld | S4 one handle |
| mechanics | blocking | Unlocked chat breaks the handoff lock guarantee and test | upheld | #33 chat keeps lock |
| mechanics | major | Provider migration changes `updated_at` | upheld | S2 migration via locked read |
| mechanics | major | Poller can't see page-owned in-flight requests | upheld | S6 shared promise |
| mechanics | major | Benchmark may not exercise transcript growth | upheld | S7 checks before measuring |

### Round 4 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** S3 and S4 redesigned: no byte-offset deltas; `known=<gen>:<end>` with `unchanged`/`full`/`unavailable` replies, legacy paths, one file handle, per-key serialized fetches, parsed output for 8 entries (#32, #34); S1 `threadSnapshot`; S2 chat keeps its lock and uses snapshots inside it, provider migration via locked read (#33); S6 shared in-flight promise; S7 benchmark: 40 sessions over 8 threads, thread rewrites, pre-measure checks, 12 minutes, RSS from 6 minutes; Validation updated.

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
