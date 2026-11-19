---
slug: cheap-chat-refresh
date: 2026-11-19
implemented-by: "standard gpt-6.1-terra (T1 machine, T2 hub); sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: verifier claude-opus-5-5
    checks: standard gpt-6.1-terra
---

# Completion Report — Cheaper chat refresh on the thread page

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 early return, non-Kimi (same path and inode, size equal to offset, kept path set, not unsaved) | this run | `machine/service.js:1209` | `machine/test/service.test.js:1738` (kept-file `readFile` throws, persist counted) |
| S1 Kimi early return after handle checks | this run | `machine/service.js:1211` | `machine/test/kimi-turns.test.js:340` (source handle `read` and persist throw) |
| S1 no kept-file read or hash when no complete line | this run | `machine/service.js:1220` (whole read/hash/append block runs only when `lines.length`) | `machine/test/service.test.js:1738` (unfinished `{"two":` tail) |
| S1 skip persist when unchanged; `transcript_unsaved` set on failure, cleared on success, never on disk | this run | `machine/service.js:1228-1234`, `machine/service.js:488` (JSON replacer drops the flag) | `machine/test/service.test.js:1738` (failed save, registry file checked, retry clears flag, write count 2) |
| S1 partial-last-line cut before append | this run | `machine/service.js:1223` | `machine/test/service.test.js:1757` |
| S1 hooks get the same short cuts | this run | all hook copies go through `copyTranscript` → `copyTranscriptNow` (`machine/service.js:1195-1204`) | covered by the copier tests above |
| S2 `known` parameter, read inside the per-session copy queue | this run | `machine/service.js:1195-1203` (follow-up in the same chain), `machine/service.js:1250-1261`, route `machine/service.js:1944` | `machine/test/service.test.js:1766` |
| S2 one handle, fstat, `gen`/`end`, unchanged with no bytes read, else exactly `end` bytes | this run | `machine/service.js:1237-1248` | `machine/test/service.test.js:1766` (kept `readFile` and handle `read` both throw during the match) |
| S2 missing kept file, malformed `known`, forgotten archived session | this run | `machine/service.js:1238-1240`, `:1244`, `:1252-1257` | `machine/test/service.test.js:1766` (`bad`, wrong end, stale gen, replaced file gets new gen, archived match) |
| S2 `machine/API.md` row | this run | `machine/API.md:20` | read |
| S3 store `hub.transcripts`, keyed `<machine>/<session>`, `known` only with a gen | this run | `viewer/app/chat.js:278-286` | `viewer/test/app-chat.test.js:374` |
| S3 unchanged reuse; unchanged without entry re-reads once | this run | `viewer/app/chat.js:287-290` | `viewer/test/app-chat.test.js:394` |
| S3 store non-empty data, keep parsed when text identical | this run | `viewer/app/chat.js:292-297` | `viewer/test/app-chat.test.js:394` (old machine without gen sends no `known`) |
| S3 failure/empty fallback to held text, then local path, then `''`; never store empty | this run | `viewer/app/chat.js:300-304` | `viewer/test/app-chat.test.js:362`, `:394` |
| S3 report reads untouched | this run | `viewer/app/chat.js:281` (no store without `keepLast`), `viewer/app/sessions.js:434` unchanged | `viewer/test/app-chat.test.js:362` |
| S3 pending count shared by chat and aside creation; 60 s unref'd prune of entries unread > 10 min | this run | `viewer/app/hub.js:132-141`, `viewer/app/hub.js:268`, `viewer/app/routes.js:482`, timer `viewer/app/hub.js:95-96` | `viewer/test/app-chat.test.js:412` (injected clock) |
| S4 parsed reuse keyed by CLI and parser-read thread fields | this run | `viewer/app/chat.js:344-353` | `viewer/test/app-chat.test.js:374` (parser spy; `parent_title` change re-parses) |
| S5 lock held through assembly; same JSON; two tabs share one entry | this run (kept) | `viewer/app/hub.js:268` runs assembly inside the lock helper | `viewer/test/app-handoff.test.js:373-381` and the existing chat route tests, unchanged except the matcher |
| S6 matcher updates | this run | `viewer/test/app-handoff.test.js:377`, `viewer/test/app-asides.test.js:133`; none under `machine/test` | suites pass |

## Deviations from plan

None in behaviour. Small extras, logged as choices in PLAN.md: the Kimi early return also checks path and inode; a kept file that shrinks mid-read throws instead of returning short data; `Hub` takes an injectable `now`; parsing goes through `module.exports.transcriptItems` so a test can spy on it.

## Routers

None. This change moved no ownership, and no router row's description of a touched file became wrong.

## Validation evidence

Merged tip `32e5efec`:

`bash machine/test/run.sh`
```
# tests 349
# pass 349
# fail 0
```

`node --test viewer/test/*.test.js`
```
# tests 697
# pass 696
# fail 1
not ok 381 - 6 message clears debt
```
That one failure is `viewer/test/app-quiet.test.js:38`, an existing timing race (a 50 ms grace between a turn end and a message card) that this change does not touch. It also fails on the unchanged feature branch before T2: `node --test viewer/test/app-quiet.test.js` run 3 times there gave pass, fail ("not ok 6 - 6 message clears debt"), pass. On T2's branch alone the same 3 runs all passed.

`npm --prefix viewer run test:browser`
```
  ✘   872 [firefox] › test/app-threads.spec.js:538:5 › phone › approval: Start building enabled when Ready and presses; offer press (30.1s)
  ✘   958 [firefox] › test/app-threads.spec.js:538:5 › desktop › approval: Start building enabled when Ready and presses; offer press (30.8s)
  2 failed
  34 skipped
  1038 passed (15.6m)
```
Both failures are a 30 s timeout waiting for a card press request (`app-threads.spec.js:550`); card presses do not touch the transcript path. Run alone on the same tip: `npx playwright test test/app-threads.spec.js:538 --project firefox --repeat-each 3` gave `6 passed (16.9s)`. In T2's own full run, two different Chromium specs failed (`app-handoff.spec.js:227`, `app-threads.spec.js:401`). Both passed 3/3 alone on T2's branch and on the feature branch before T2 (`--repeat-each 3`, `9 passed` each). The full browser suite has load flakes, and which tests fail changes from run to run.

## Known gaps / residual risks

- `app-quiet.test.js` test 6 and some browser specs are flaky under load, as above. They are pre-existing and not part of this change.
- The hub tests call `pruneTranscripts` directly and do not exercise the 60 s timer or the aside POST pending path end to end.
- A kept file with a partial last line and no new source lines is served with the fragment until the next append cuts it. It only happens after a crash mid-append, and then the source offset was not persisted, so the next copy re-reads those lines and cuts the fragment.

## Remediation rounds
