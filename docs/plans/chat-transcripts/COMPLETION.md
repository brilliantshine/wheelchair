---
slug: chat-transcripts
date: 2026-11-19
implemented-by: "standard, gpt-6.1-terra (T1, T2, T3); sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Chat: less memory, cheap unchanged transcripts

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by: []
```

Mode: two-part. Deferred D1-D3 were not built. No Prior Work section; every row is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1.1 No `known` → today's `{offset, data}` | this run | `machine/service.js:1267-1271` (route passes `known` at `:1971`) | `machine/test/service.test.js:1787` (legacy reply has exactly `offset`,`data`, byte offset with multibyte text), `:1738` |
| S1.2 `known` validation, 400 otherwise | this run | `machine/service.js:1256` | `machine/test/service.test.js:1801` (six malformed values) |
| S1.2 copy then answer inside the session's copy queue; archived path waits on the queue | this run | `machine/service.js:1260-1266` (`queueTranscript` `:1205`) | `machine/test/service.test.js:1867` (archived read stays pending until a held append is released and includes its lines) |
| S1.2 one handle + one fstat, `gen=<ino>-<birthtimeMs>` (inode alone when 0), `end=size`; full data from that handle `0..end` | this run | `machine/service.js:1274-1285` | `machine/test/service.test.js:1787` (gen/end equal `statSync` of the kept file) |
| S1.2 missing kept file or `end` 0 → `unavailable` | this run | `machine/service.js:1276`, `:1281` | `machine/test/service.test.js:1738` |
| S1.2 `unchanged` reads nothing else | this run | `machine/service.js:1282` | `machine/test/service.test.js:1738` (spies on `readFile`, handle `read`, `persistSessions`, `sessions.json` mtime) |
| S1.2 unknown session with no kept file fails as today | this run | `machine/service.js:1269`, `:1276` | existing archive/transcript tests |
| S1.3 API.md documents both forms | this run | `machine/API.md:126` | read |
| S2.1 no new line: no kept-file read/hash/append; registry saved only on a real change | this run | `machine/service.js:1229` (gate), `:1249-1252` | `machine/test/service.test.js:1738` (no read, no `persistSessions`) |
| S2.2 in-memory dedupe set, non-empty lines, per-copy only on a kept file with no trailing newline, added after append, dropped on failed append | this run | `machine/service.js:1229-1247` | `machine/test/service.test.js:1773` (failed append), `:1812` (blank lines across batches), `:1822` (half-written tail) |
| S2.3 idle drop after 10 min by an unref'd 60 s timer, stopped on close; dropped on stop and archive | this run | `machine/service.js:401-402`, `:1202-1203`, `:2045`, `:856`, `:1077`, `:1169` | `machine/test/service.test.js:1852` (kept at 599 999 ms, dropped at 600 000 ms, rebuilt and dedupes), `:1836` (stop and archive) |
| S2.4 dedupe results identical to today's | this run | as S2.2 | existing tests at `machine/test/service.test.js:259`, `:412`, `:421` pass |
| S3 report readers: no `known`, no entries, data else local path | this run | `viewer/app/chat.js:272-283`; caller `viewer/app/sessions.js:434` | `viewer/test/app-chat.test.js:362` |
| S3.1 `known=<gen>:<end>` only with a matching parse key, else `-` | this run | `viewer/app/chat.js:288-290` | `viewer/test/app-chat.test.js:362` (second poll sends `1-2:10`; `parent_title` change sends `-`) |
| S3.2 reply order: unchanged → full/older-machine → fallback (entry parsed, else local, unknown-CLI notice) | this run | `viewer/app/chat.js:291-306` | `viewer/test/app-chat.test.js:362` (unchanged reuse is the same array; mismatched unchanged and no-entry unchanged fall back; full re-parses; no-status reply; unavailable/empty/thrown/unknown status; unknown CLI notice; parser errors still propagate) |
| S3.3 same items; cached arrays never mutated | this run | `viewer/app/chat.js:346` (spread into a new array; later code filters a new array) | worker report T2, scout read of `chat()` and `asides.js:37` consumers |
| S4.1 entries hold `{parsed, gen, end, parseKey, threadId, lastRead}`, no raw text | this run | `viewer/app/chat.js:301` | `viewer/test/app-chat.test.js:362` |
| S4.2 sweep: drop after 10 min unless `hub.threadLocks` has the thread; unref'd 60 s timer | this run | `viewer/app/hub.js:17-21`, `:91-92` | `viewer/test/app-chat.test.js:407` (queued aside at the cutoff; fails with the lock check removed, per T2 report; timer drop with no chat calls), `:429` (a queued `hub.chat` keeps its entry) |
| S4.3 no size cap | this run | `viewer/app/hub.js:17-21` | read |
| S4b last-seen: memory always, file at most once a minute per name, synchronous reservation | this run | `viewer/app/hub.js:118-126` | `viewer/test/app-chat.test.js:448`; `viewer/test/app-hub.test.js:898` updated |
| S5 test route matchers accept a query | this run | `viewer/test/app-handoff.test.js:377`, `viewer/test/app-asides.test.js:133` | node suite |
| S5 fake machine new-form option | this run | `viewer/test/helpers/app-machine.js:129` (`versionedTranscripts`) | `viewer/test/app-chat.test.js:458` |
| S6 validation | this run | — | below |

## Deviations from plan

- S4.2 "the timer is stopped when the hub stops": the hub has no shutdown path (none of its other timers are cleared either, `viewer/app/hub.js:91-106`), so the sweep timer is only `unref`'d and never cleared. The lead agreed no shutdown hook is needed. The machine's timer is cleared on close (`machine/service.js:2045`).
- Legacy (no `known`) machine reads now also wait in the session's copy queue (`machine/service.js:1260`). The reply is unchanged; it just cannot interleave with a hook-triggered copy.
- With `known`, `offset` is ignored (not stated in the Spec; the new form is always whole).

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

On the feature branch at `f05c3cbb` (all three tasks merged):

`bash machine/test/run.sh`:
```
# tests 354
# suites 0
# pass 354
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 34606.585908
```

`node --test viewer/test/*.test.js`:
```
# tests 698
# suites 0
# pass 698
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 52506.637565
```

`npm --prefix viewer run test:browser` (exit 0):
```
  34 skipped
  1040 passed (11.6m)
```

Live hub RSS / CPU measurement (S6, informational): not done; it needs an install from the canonical clone after merge.

## Known gaps / residual risks

- Node suite flake: on the T2 branch one run of `node --test viewer/test/*.test.js` had 2 failures that did not recur in three further runs; the T2 worker separately saw an address-in-use failure in an unrelated handoff test. Not attributed to this change.
- A failed `machines.json` write keeps its 60 s reservation (`viewer/app/hub.js:123`), so the disk value can lag up to a minute longer after a write error; the in-memory value is unaffected.
- A copy already running when its session is stopped or archived can leave a correct dedupe set behind until the idle sweep drops it (`machine/service.js:1247`). Memory only.
- The half-written-tail test (`machine/test/service.test.js:1822`) pins today's fused-line result; fixing it is Deferred D1.
- Accepted Risks in PLAN.md stand as written.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
