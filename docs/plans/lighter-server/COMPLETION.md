---
slug: lighter-server
date: 2026-11-19
implemented-by: "T1 standard / gpt-6.1-terra; T2 standard / claude-sonnet-5-5 (sub-lead: claude-opus-5-5)"
verified-by: []
---

# Completion Report — A lighter server when many agents run

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by: []
```

## Spec coverage

All rows are `this run`; Prior Work was empty.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 per-file cache in `allThreads()` keyed `(mtimeMs, ctimeMs, size, ino)`; re-read only changed/new files, drop vanished entries; order and filtering unchanged | this run | `viewer/app/state.js:137` (`cachedThread`), `viewer/app/state.js:167` (`allThreads`, vanished-entry drop at :171) | `viewer/test/app-snapshot.test.js:27` (second call reads 0 files; outside atomic replace, in-place new-size write, equal-length write with restored mtime asserting `mtimeMs`/`size`/`ino` equal, new file, deleted file) |
| S1 cached records deep-frozen, returned without copy | this run | `viewer/app/state.js:144-151` | `viewer/test/app-snapshot.test.js:33` (mutation throws `TypeError`) |
| S1 `threadSnapshot(id)`; missing file or JSON `null` throws 404 like `thread(id)` | this run | `viewer/app/state.js:161` | `viewer/test/app-snapshot.test.js:47` |
| S1 malformed JSON never cached, listing throws; `ENOENT` skipped | this run | `viewer/app/state.js:153-157` | `viewer/test/app-snapshot.test.js:48` (throws twice, so not cached) |
| S1 `thread(id)`/`updateThread`/`save` stay fresh and mutable; hub's own save drops the cache entry | this run | `viewer/app/state.js:119`, `viewer/app/state.js:132` | `viewer/test/app-snapshot.test.js:46` (`save` then `allThreads` returns saved content) |
| S1 handoff unlink / other deletes caught by the listing | this run | `viewer/app/state.js:169-171` | `viewer/test/app-snapshot.test.js:45` |
| S1 caller audit; mutating callers clone the one record | this run | `viewer/app/hub.js:59`, `viewer/app/hub.js:79`, `viewer/app/views.js:40`, `viewer/app/threads.js:88`, `viewer/app/routes.js:443-449` (new overlay object). Audit table in PLAN.md Log 2026-11-19 | Full `node --test viewer/test/*.test.js` (693 pass); independent scout read of every caller agreed with the audit |
| S1 no archived filtering | this run | `viewer/app/state.js:167` (no filter added) | code read |
| S2 `discoverSlug` read-only split; `findSlug` built on it | this run | `viewer/app/views.js:100`, `viewer/app/views.js:107` | `viewer/test/app-snapshot.test.js:59`, `:100` (frozen record, no save) |
| S2 `GET /threads`: listing from cache, all locks joined at once, `threadSnapshot` inside the lock, `hub.thread()` only for provider migration or slug save, rows `{ ...listed, ...fresh }`, no status discovery | this run | `viewer/app/routes.js:439-449`; migration check `viewer/app/hub.js:140` (`readSnapshot`) | `viewer/test/app-snapshot.test.js:52` (JSON equals fixture captured from pre-change code, 0 file reads, no `hub.thread()` call), `:64` (legacy provider migration saved), `:89` (held lock on one thread; deleted key stays; other thread read meanwhile), `:100` (discovered slug saved, new `updated_at` in same response), `:119` (save finishing during listing shows) |
| S2 chat keeps its lock; thread and parent from snapshots; migration via `hub.thread()`; slug via `discoverSlug` then fresh record | this run | `viewer/app/chat.js:319-323`, `viewer/app/chat.js:337`, `viewer/app/hub.js:252-254` | `viewer/test/app-snapshot.test.js:77` (second chat reads 0 thread files, output equal), `:64` (legacy chat saves `provider`); existing `viewer/test/app-handoff.test.js` lock test and `viewer/test/app-chat.test.js` pass |
| S2 timers unchanged except listing from cache | this run | no timer code changed; they call `hub.allThreads()` | existing timer suites (`app-hub`, `app-quiet`, `app-merged`, `app-usage`) pass unchanged |
| S3, S4, S5 | moved / dropped | not implemented by design (#27, #36, #60) | n/a |
| S6 shared `poller(fn, ms)` with `stop()`: ticks only while visible, on show calls once and restarts interval, stopped poller never called | this run | `viewer/pages/nav.js:6` (`window.wcPoller`) | `viewer/test/app-hidden-tabs.spec.js:37` (pause, on-show poll, next tick a full interval later) |
| S6 used by Threads, Agents, Features, nav, chat, aside, terminal, Settings usage | this run | `viewer/pages/threads.js:149`, `viewer/pages/agents.js:250`, `viewer/pages/features.js:198`, `viewer/pages/nav.js:166-167`, `viewer/pages/thread.js:1229`, `viewer/pages/aside.js:30` (and `closePanel` stop), `viewer/pages/term-view.js:177`/`:181`, `viewer/pages/settings.js:995` | `viewer/test/app-hidden-tabs.spec.js:37`, `:59` (chat), `:78` (aside, closed aside not polled), `:121`, `:135` (terminal, disposed not polled) |
| S6 not paused: sign-in polling, `/usage/alert` | this run (kept) | `viewer/pages/settings.js` `card.poll` unchanged; `viewer/pages/nav.js:165` plain interval | `viewer/test/app-hidden-tabs.spec.js:145` (sign-in polls while hidden), `:37` (alert still fires while hidden) |
| S7 `workers: 2` in Playwright config | this run | `viewer/playwright.config.js:12` | two concurrent runs check (below) |
| S7 live CPU before/after | lead, after install | not a build item (brief: lead's job after done) | n/a |

## Deviations from plan

None in behaviour. Implementation choices the Spec left open are logged in PLAN.md (2026-11-19 Choice lines): a `hub.readSnapshot` helper shared by `/threads` and chat; `threadBySession` clones its match; poller placement in `nav.js` before the nav-bar guard; a hide event is a no-op for the poller.

## Routers

`viewer/AGENTS.md` updated: the `app/state.js` row states that `allThreads()`/`threadSnapshot()` return shared frozen cached records and mutating code reads with `thread(id)` or clones; the `pages/` row names `window.wcPoller` in `nav.js`; the `playwright.config.js` row names `workers: 2`.

## Validation evidence

Run by the sub-lead on the feature branch after both merges:

`node --test viewer/test/*.test.js`
```text
# tests 693
# suites 0
# pass 693
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`bash install/test/run.sh`
```text
PASS Darwin removal commands omit sudo
PASS missing sudo helper prints install hint and no test password
RESULT 192 passed, 0 failed
```

`npm --prefix viewer run test:browser`
```text
  34 skipped
  1040 passed (10.5m)
(exit 0)
```

New spec alone on the T2 branch (`npx playwright test app-hidden-tabs.spec.js`): `12 passed (14.1s)`.

Two browser runs at once (T2 worker, `docs/plans/lighter-server/reports/T2.md`): two concurrent `npm --prefix viewer run test:browser -- --output=<dir> --trace=on`, sampling each runner's descendants every second for Playwright browser main processes:
```text
{"A": {"max_browsers": 2, "exit": 0, "traces": 1074}, "B": {"max_browsers": 2, "exit": 0, "traces": 1074}}
both logs end: 1040 passed (14.5m)
```

## Known gaps / residual risks

- Live CPU saving is not measured here; the lead measures it after install against a fresh baseline (S7).
- A caller added later that mutates an `allThreads()` record will throw (strict mode) rather than corrupt the cache; that is the intended failure mode (#17).
- Accepted Risks in PLAN.md stand: timers' locked re-reads remain; memory growth from transcripts until the chat follow-up.

## Remediation rounds

### Remediation 1 (verification attempt 1)

Gap (REMEDIATION-1.md): a same-size in-place rewrite within one filesystem timestamp tick of the previous write left `(mtimeMs, ctimeMs, size, ino)` identical, so the cache served the old record. Reproduced: 198 of 200 back-to-back same-size rewrites on ext4 left the stat identical.

Fix (R1-T1, light / gpt-6-luna): `viewer/app/state.js:141` takes `checkedAt` before the stat; `viewer/app/state.js:144-146` reuses a cached record only when the key matches and `max(mtimeMs, ctimeMs) < checkedAt - SETTLE_MS` (2000 ms, `viewer/app/state.js:11`). Test: `viewer/test/app-snapshot.test.js:53` (immediate same-size rewrite after a cached read is seen; a settled file is parsed once). Existing zero-read tests wait `SETTLE_MS + 200` ms after writing fixtures; no assertion weakened.

`node --test viewer/test/*.test.js`:
```text
# tests 694
# pass 694
# fail 0
```
