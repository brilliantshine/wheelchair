---
slug: chat-transcripts
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Chat: less memory, cheap unchanged transcripts

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Background: `MAP.md` (this folder), `docs/maps/chat-transcripts.md`, and the parent plan
`docs/plans/lighter-server/PLAN.md` (section "Moved to the chat follow-up"; Decisions #24,
#29, #32, #36, #50–#60).

## Open Questions

None. Every design point had a defensible default (Decision Log, source `defaulted` or
`adopted`).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode two-part: build what makes memory flat and unchanged transcripts cheap; rare-corner hardening goes to `## Deferred` | Collin's pick | user |
| 2 | No byte-offset deltas. The hub tells the machine which version it holds (`known=<gen>:<end>`); the machine answers `unchanged` (no data), `full` (the whole transcript) or `unavailable` | Parent #32: deltas caused splice, bootstrap and two-tab hazards; a whole reply is always coherent and most polls happen while the lead is idle | adopted |
| 3 | `gen` is the kept file's inode and birth time; `end` is its size; both from one `fstat` of one open handle, and a `full` reply's data is read from that same handle up to `end` | The machine owns the kept file and only appends to it, so same gen + same size means same content; one handle avoids mixing two versions | adopted |
| 4 | The machine replies in the new form only when the request carries a `known` parameter (`known=-` when the hub holds nothing). Without it, the reply is exactly today's `{offset, data}` | An older hub never sends `known` and keeps working unchanged; report readers keep using the legacy form | defaulted |
| 5 | A reply with no `status` (an older machine) is treated as `full`; empty `data` in any reply is treated as `unavailable` | Older machines ignore `known` (MAP.md); parent #59: an empty reply means fall back, never "empty chat" | adopted |
| 6 | The hub keeps per lead session only the parsed chat, the `gen`/`end` it came from, a hash of the text for older machines, the parse key and `lastRead`. It no longer keeps the raw text | Parsed chat is enough for both reuse and fallback; dropping the raw text roughly halves what each entry holds. A parse-key change asks for a `full` reply, so the text is never needed again | defaulted |
| 7 | Parent #50, #52, #53, #58: an entry is dropped only after 10 minutes unread, no size cap; `lastRead` is set for all of a thread's lead entries when `hub.chat` is called (before the lock) and when an entry is used; never dropped while a chat request for that thread is pending | Collin's earlier pick in the parent thread; an open chat re-reads every 2 s so it is never dropped | adopted |
| 8 | Report readers (`viewer/app/sessions.js`) never send `known`, never read and never fill the hub's entries; they fall through to the local `transcript_path` as today | A stale copy could hand them an earlier message as the report (parent S3) | adopted |
| 9 | On the machine, a copy that finds no new complete line in the source does not read the kept file and does not save the session registry (unless the bound source path, inode or offset changed) | This is the work every unchanged poll does today (`machine/service.js:1217-1225`) | defaulted |
| 10 | On the machine, the dedupe hashes of the kept file live in memory per session: built from the kept file the first time a copy has new lines, updated only after a successful append, dropped after 10 minutes with no copy for that session and when the session is stopped or archived | Avoids rehashing the whole file on every new line without an unbounded set; committing after the append means a failed append cannot hide lines from the next try | defaulted |
| 11 | The `known`/`full`/`unchanged` answer is computed inside the per-session copy queue (`copyTranscript`), after that read's copy | A hook-triggered copy appending at the same moment cannot leave a half-written tail in a reply | defaulted |
| 12 | Kept as the parent split it: the thread lock, the 2-second poll, the page and the parsers do not change | IDEA "Not doing" and Constraints | adopted |

## Spec

### S0. Words used here

- **Kept file**: the machine's copy of a session's transcript,
  `<stateDir>/transcripts/<thread_id>/<session>.jsonl`, appended to only by
  `copyTranscriptNow` (`machine/service.js:1203`).
- **Entry**: what the hub holds for one lead session, keyed `${thread.machine}/${session.name}`
  as today (`viewer/app/chat.js:272`).
- **Parse key**: `session.cli`, `session.name` and `thread.parent_title` (the only thread
  field `renderTurn` reads today, `viewer/app/chat.js:125-130`), joined into one string.
  The worker confirms no other thread field reaches the parsers and adds any it finds.

### S1. Machine: the transcript route

`GET /v1/sessions/:name/transcript` (`machine/service.js:1929`, `transcript()` at ~1227).

1. **No `known` parameter**: behaviour and reply are byte-for-byte today's
   (`{offset, data}`, honouring `offset`). This is what an older hub and the hub's report
   readers send.
2. **With `known`** (value `-`, or `<gen>:<end>` where `gen` is `<ino>-<birthtimeMs>` and
   `end` a non-negative integer; anything else is `400`):
   - The session lookup, source binding and copy happen as today (`transcript()` lines
     ~1236-1241), including the archived-thread path that reads a kept file of a
     forgotten session.
   - Then, still inside that session's copy queue (Decision #11; for the archived path,
     no queue is needed since nothing appends), open the kept file once, `fstat` the
     handle: `gen = ${ino}-${birthtimeMs}`, `end = size`.
   - Kept file missing, or `end` is 0 → `{ status: 'unavailable' }`.
   - `known` equals `${gen}:${end}` → `{ status: 'unchanged', gen, end }`, no data, and
     nothing else read from the kept file.
   - Otherwise → `{ status: 'full', gen, end, data }`, `data` read from that handle,
     bytes `0..end`, as UTF-8.
   - An unknown session with no kept file fails as today (error status).
3. `machine/API.md` documents both forms.

### S2. Machine: cheap copies

In `copyTranscriptNow` (`machine/service.js:1203`), keeping today's binding, reset,
Kimi and incomplete-line rules exactly:

1. When the source yields no new complete line (`lines` empty): do not read the kept file,
   do not hash, do not append. Save the session registry only if `transcript_path` or
   `transcript_source` (`path`, `offset`, `ino`) actually changed.
2. When there are new lines: get the session's dedupe set from memory, building it from
   the kept file (as today's hashing) if absent. Filter the new lines as today, append,
   and add the new hashes to the set only after the append succeeds. If the append
   throws, the set is left as it was before this copy.
3. Dedupe sets are dropped when a session has had no copy for 10 minutes (checked at
   least once a minute, or on each copy; either is fine), and when the session is stopped
   or its thread archived. A dropped set is rebuilt on the next copy with new lines.
4. Duplicate filtering results are identical to today's for every sequence of source
   contents (existing tests `machine/test/service.test.js:259`, `:412`, `:421` keep
   passing).

### S3. Hub: chat reads

`sessionTranscript` (`viewer/app/chat.js:271`) is split so chat and report readers no
longer share a cache.

**Report readers** (`keepLast` false, used by `viewer/app/sessions.js:428`): request
without `known`, use `data` when non-empty, else the local `session.transcript_path`, as
today. They never read, write or refresh entries.

**Chat** (`chat()`, `viewer/app/chat.js:318`), per lead session, in today's order and
under today's thread lock:

1. Entry present and its parse key matches → request with `known=<entry.gen>:<entry.end>`
   (or `known=-` if the entry came from an older machine and has no `gen`). Otherwise →
   request with `known=-`.
2. Reply handling:
   - `unchanged` → use `entry.parsed`. Update `lastRead`.
   - `full` with non-empty `data`, or a reply with no `status` and non-empty `data` (older
     machine): if an entry exists with the same parse key and the same text hash, reuse
     its `parsed`; else parse with `transcriptItems`. Store `{parsed, gen, end, hash,
     parseKey, lastRead: now}` (`gen`/`end` absent for an older machine).
   - `unavailable`, empty `data`, a thrown error or timeout → fallback: if an entry exists,
     use its `parsed` (whatever its parse key) and update `lastRead`; else read the local
     `session.transcript_path` as today and parse it without storing it; if that is empty
     too, the session contributes nothing, as today (`chat.js:325`).
3. The items chat returns are the same, in the same order, as today's for the same
   transcript text. Reused `parsed` arrays are never mutated by later code: the worker
   checks every consumer of `items` in `chat()` and either confirms none mutates or
   copies at the point of mutation.
4. The hash is any fast stable hash of the text (for example SHA-1); it is computed only
   for older-machine replies and `full` replies.

### S4. Hub: dropping idle entries

1. `hub.chat` (`viewer/app/hub.js:250`), when called and before waiting for the thread
   lock: increments a per-thread pending count, and sets `lastRead = now` on every entry
   held for that thread's lead sessions. It decrements the count when it returns or
   throws.
2. A sweep (at most once a minute, run from `hub.chat` or a timer; a timer must be
   `unref`'d and stopped with the hub) drops entries whose `lastRead` is more than 10
   minutes ago, unless their thread's pending count is above zero.
3. No size cap.

### S5. Tests

Update test route matchers that match a literal `/transcript` suffix so they match the
path with or without a query (`viewer/test/app-handoff.test.js:377`,
`viewer/test/app-asides.test.js:133`, and any other found by
`grep -rn "transcript'" viewer/test machine/test`). `viewer/test/app-handoff.test.js:373`
(a mutation waits for chat's transcript request) keeps passing. The fake machine
(`viewer/test/helpers/app-machine.js:125`) gains an option to answer in the new form.

New tests, at least:

- Machine (`machine/test/service.test.js`): no `known` → today's exact reply; `known=-` →
  `full` with `gen`/`end`; repeat with those → `unchanged`, and the kept file was not
  read (spy on `fsp.readFile`/handle reads) and `sessions.json` was not rewritten (mtime
  and a spy on `persistSessions`); a new source line → `full` with the larger `end`;
  missing copy → `unavailable`; malformed `known` → 400; archived thread with `known`
  works; a failed append leaves the dedupe set unchanged so the next copy appends the
  lines; a dedupe set is dropped after 10 idle minutes (fake clock) and rebuilt correctly.
- Hub (`viewer/test/app-chat.test.js`): second poll on an unchanged transcript sends
  `known` and does not call the parser; `full` re-parses; an older-machine reply (no
  `status`) works and identical text is not re-parsed; `unavailable`, empty and thrown
  replies fall back to the held parsed chat, else the local path; a `parent_title` change
  re-requests with `known=-` and re-parses; an entry unread for 10 minutes is dropped
  (fake clock) but not while a chat request for its thread is pending; report readers
  never send `known` and neither use nor fill entries (extend `app-chat.test.js:362`).

### S6. Validation

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

All pass. Informational, no pass bar: after install, Collin's live hub RSS over an hour
and CPU-seconds per minute with a thread page open, recorded in the Log against the
parent's baseline (Log of `docs/plans/lighter-server/PLAN.md`).

### Non-goals

Everything in IDEA.md "Not doing". Also: no change to the Ready check, to transcript
discovery (`findTranscript`), to the parsers, or to the hub's other per-thread maps.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Cut a half-written last line off the kept file before the next append | Only happens if an append fails partway (disk full, crash); today's code has the same behaviour | planning | Parent review note: "truncate a partial line before rebuilding". In `copyTranscriptNow`, before appending, if the kept file does not end in `\n`, truncate to after its last newline |
| D2 | Retry a failed session-registry save | After S2.1 a failed save is retried only when the next new line arrives; the worst case is a restart re-reading source lines that dedupe then drops | planning | Mark the registry dirty on a failed `persistSessions` and save again on the next copy |
| D3 | Measure and, if needed, cache transcript discovery for sessions with no bound source | Lead sessions are bound by a hook or rollout soon after start; unbound polls call `findTranscript` each time | planning | `machine/service.js` `transcript()` ~1236; measure first |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| If the filesystem reports no birth time (`birthtimeMs` 0), `gen` falls back to the inode alone, so a kept file deleted and recreated with the same inode and same size would read as `unchanged` | The machine never deletes and recreates a kept file of a live session; only archive cleanup removes them | planning |

## Review Rounds

### Round 1 — 2026-11-19

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
