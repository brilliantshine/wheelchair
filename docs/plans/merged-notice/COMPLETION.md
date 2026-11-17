---
slug: merged-notice
date: 2026-11-16
implemented-by: "gpt standard (gpt-6.1-terra) for T1 and T2; sub-lead claude-opus-5-5"
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty.
---

# Completion Report — Merged notice with archive button

Written for a hostile reviewer: every claim checkable, no claim without evidence.
Line numbers are at commit `a4beed3` on `wc/d0ae8d2e2356`, or the commit that adds this file.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| 1. `pollMerged(hub)` in threads.js, exposed as `hub.pollMerged()` | this run | `viewer/app/threads.js:349`, export `:411`; `viewer/app/hub.js:154-158` | `viewer/test/app-merged.test.js:40` |
| 1. Run from the 60 s `waitTimer` beside `pollWaiting` | this run | `viewer/app/hub.js:65` | code read (timer not exercised by tests) |
| 1. Started once in `init()` without awaiting | this run | `viewer/app/hub.js:72` | `app-merged.test.js:85` (init resolves while slow gh runs) |
| 1. No overlapping sweeps (in-flight promise) | this run | `viewer/app/hub.js:155-157` | `app-merged.test.js:56` |
| 1. Eligibility picked without locks: not archived, newest unreplaced `done` with non-empty `pr_url`, GitHub PR URL regex, `merge_noticed_url` differs | this run | `viewer/app/threads.js:344-352` (`mergedPr`, filter) | `app-merged.test.js:109` (archived and non-GitHub URL never call gh; newest URL used) |
| 1. `gh pr view <url> --json state` via promisified `execFile`, no shell, no cwd, timeout 15000, at most 4 at a time, no thread lock held | this run | `viewer/app/threads.js:353-371`; `execFileAsync` at `:14` | `app-merged.test.js:56`, `:70` |
| 1. On MERGED: re-check under `withThread` (archived, URL changed, already noticed), set `merge_noticed_url`/`merge_noticed_at`, `addCard(..., {system:true})`, save | this run | `viewer/app/threads.js:359-366` | `app-merged.test.js:40`, `:70` (archived mid-call gets no card) |
| 1. Other states and any error change nothing and throw nothing; one failure never stops others | this run | `viewer/app/threads.js:367-369` (per-thread try/catch) | `app-merged.test.js:99` |
| 1. One card per PR; marker never cleared | this run | `viewer/app/threads.js:352`, `:361` | `app-merged.test.js:40` (second poll posts nothing) |
| 2. `merged` app-only: not in `card.js` agent kinds; `resolvable()` refuses it | this run (by leaving `viewer/app/card.js` and `resolvable` unchanged) | `viewer/app/card.js` unchanged | `app-merged.test.js:154` (card.js refuses, "unknown card kind"); `:123` (`resolvable(...).ok === false`) |
| 2. Fields `kind`, `title`, `pr_url` plus `addCard`'s | this run | `viewer/app/threads.js:364` | `app-merged.test.js:40` |
| 2. Unanswered `merged` counts under Needs you | this run | `viewer/app/views.js:124` | `app-merged.test.js:123` |
| 3. `case 'merged'` in `renderCard`: title, "Review pull request" link, Archive and Keep it while unanswered and not archived | this run | `viewer/pages/thread.js:656-679` | `viewer/test/app-merged.spec.js:11` (Chromium, Firefox) |
| 3. Two-step Archive: Confirm archive, Cancel, warning note; Confirm reuses `doArchive` (POST archive, repoll); Cancel restores; confirm state per card, page-only, survives polls | this run | `viewer/pages/thread.js:31` (`mergedArchiveAsk`), `:663-674`; `doArchive` at `:214` | `app-merged.spec.js:11` (includes a poll-driven re-render while confirming, and archive route called once) |
| 3. Keep it presses `keep`; answered card dims with "Kept"/"Archived" from `resolved_note`, no buttons | this run | `viewer/pages/thread.js:674`, `:449`, `:787`; `viewer/pages/thread.css:135` | `app-merged.spec.js:35` |
| 3. Not pinned; time order | this run | not in `addCard`'s singleton kinds (`viewer/app/cards.js:9-28`, unchanged) | code read |
| 4. Keep it in `press`, before the live-lead check: `keep` only (400), answered → 422, `resolveCard(..., 'Kept')`, save, `{queued:false}`, nothing sent to lead | this run | `viewer/app/threads.js:273-279` | `app-merged.test.js:123` (no live lead in fixture) |
| 4. Archive resolves open `merged` cards only when archive succeeds | this run | `viewer/app/threads.js:193-196` (after `thread.archived = true`) | `app-merged.test.js:140` |
| 4. Header archive uses same path | this run | same `threads.archive` | follows from the above |
| 5. `protocol/app/cards.md`: kinds table row, `### merged` section | this run | `protocol/app/cards.md:44`, `:207-211` | `viewer/test/protocol-rules.test.js` passes (it does not enumerate card kinds, so not extended) |
| 5. `viewer/app/API.md`: `keep` action; `merge_noticed_url`/`merge_noticed_at` | this run | `viewer/app/API.md:22`, `:55` | doc read |
| 5. `viewer/AGENTS.md` only if made false | this run (no change needed) | `viewer/AGENTS.md:22` still accurate ("thread lifecycle") | doc read |

## Deviations from plan

None in behaviour. Two small notes:
- The browser spec is a new file, `viewer/test/app-merged.spec.js`, not an addition to `app-needs.spec.js` (the Spec said "for example").
- The press route returns HTTP 202 for every press, including `keep` (`viewer/app/routes.js:465`); the Spec named only the body `{queued:false}`.

## Routers

None. This change moved no ownership, and no router names a file in a way it made false (`viewer/AGENTS.md:22` describes `threads.js` as thread lifecycle, still true).

## Validation evidence

On the merged feature branch (`a4beed3`):

`node --test viewer/test/*.test.js`
```
not ok 20 - placement ranks accounts and respects provider policy
not ok 337 - a starter that loses the freed port registers through the new holder
not ok 380 - an app page carries font-src self and the font route serves only the allowlist
# tests 469
# pass 465
# fail 4
```
All three failures (four counting a nested subtest) also fail on the base before this build (`03ab0ce`, run by the sub-lead: same three `not ok`, `# pass 456`, `# fail 4`). The freed-port one is recorded in `docs/known-issues.md:6`. None touches code this change edited. Across worker runs two other tests failed once each under full-suite load and passed alone and in later runs (`app-hub.test.js` boot commit, `server.test.js:544` graph write lock); neither file nor the code it tests was changed here.

`node --test viewer/test/app-merged.test.js` (worker T1 branch, re-run by sub-lead together with app-hub.test.js, twice): `# pass 116`, `# fail 0`.

`npm --prefix viewer run test:browser` (merged branch, after `npm ci --prefix viewer`):
```
  2 skipped
  638 passed (2.8m)
```
exit 0. The merged spec alone (`-- app-merged`): 4 passed (Chromium and Firefox, both tests).

`bash test-support/smoke/run.sh`: not run (not a gate per the Spec).

## Known gaps / residual risks

- Accepted risk (plan): if the hub's `gh` is missing or logged out, merges are never noticed and nothing says why.
- The 60-second timer wiring is checked by code read only; tests call `pollMerged()` and `init()` directly.
- Pre-existing node suite failures above remain; they are not this change's.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
