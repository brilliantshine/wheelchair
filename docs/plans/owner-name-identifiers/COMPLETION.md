---
slug: owner-name-identifiers
date: 2026-11-19
implemented-by: "standard (gpt-6.1-terra); sub-lead claude-opus-5-5 for two wording fixes"
verified-by: []
---

# Completion Report — Finish removing the owner name

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by: []
```

## Spec coverage

All rows are `this run` (the plan has no Prior Work). Line numbers are at feature tip `bbdf0fe5`.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 `user_at` written | this run | `viewer/app/sessions.js:477`, `viewer/app/threads.js:325`, `:421` | `viewer/test/app-hub.test.js`, `app-threads.spec.js` |
| S1 `source: 'user'` written | this run | `viewer/app/threads.js:79`, `viewer/app/routes.js:534`, `viewer/app/asides.js:62`; `enqueue` default still `'app'` (`viewer/app/sessions.js`, `enqueue`) | `app-hub.test.js`, `app-asides.test.js`, `app-chat.test.js` |
| S1 `resolved_by: 'user'` written | this run | `viewer/app/threads.js:244`, `:329`, `:402`, `:420` | `app-hub.test.js`, `app-merged.spec.js` |
| S1 readers switched | this run | send-now `viewer/app/sessions.js:542`; `viewer/app/agents.js:63`; `viewer/pages/threads.js:38`, `:74`; `viewer/pages/agents.js:139`; `viewer/pages/thread.js:231` (You), `:436`, `:504` (pending), `:580` (Dismissed); restart filter `viewer/app/threads.js:145` | `app-send-now.spec.js`, `app-threads.spec.js`, `app-merged.spec.js`, `app-handoff-restart.test.js:70` |
| S1 `asUser` relabel removed, context output unchanged | this run | `viewer/app/threads.js` (restart context, around :138–150) | `viewer/test/app-handoff-restart.test.js:70` |
| S2 `normalizeThread` (all containers, keep-later, idempotent, skips non-arrays) | this run | `viewer/app/state.js:43`, exported `:275` | `viewer/test/app-owner-normalize.test.js:6` |
| S2 called on every read | this run | `State.thread()` `viewer/app/state.js:134`; `updateThread()` `:152`; `cachedThread()` before freeze `:170`. No other direct thread-file parse in `viewer/` (scout grep) | same + `app-handoff-restart.test.js:70` (saved state converted) |
| S2 `sent.jsonl` untouched | this run | no change to the spill writer | grep / diff |
| S3 export v2, `who: 'user'` | this run | `viewer/app/handoff.js:72` | `viewer/test/app-handoff.test.js:384`, `app-handoff-import.test.js:303` |
| S3 validate v1/v2, v1 `collin`→`user`, other versions refused | this run | `viewer/app/handoff.js:19`, `:29`, `:31` | `viewer/test/app-handoff.test.js:384` (v1 user, v2 collin, v3 refused with existing messages) |
| S4 API.md | this run | `viewer/app/API.md:21–23`, `:62`, handoff note | read |
| S4 state map | this run | `docs/maps/owner-name-state.md:9`, `:12–18` | read |
| S5 comments reworded | this run | `viewer/app/sessions.js`, `viewer/app/chat.js:148`, `viewer/app/threads.js`, `viewer/pages/thread.js` (incl. `:797`), `viewer/server.js:499`, `viewer/index.html:318`, `:330`, `viewer/playwright.config.js:3`, `test-support/smoke/live.js:44` | second Validation grep |
| S5 tests/helpers neutral | this run | `viewer/test/app-hub.test.js`, `app-chat.test.js`, `app-asides.test.js`, `browser.spec.js`, `helpers/app-views-setup.js:53`, others in diff | second Validation grep: remaining hits are compatibility tests only |
| S5 fixtures untouched | this run | no change under `machine/test/fixtures/` | `git diff --stat` |
| S6 normaliser test | this run | `viewer/test/app-owner-normalize.test.js:6` | node suite |
| S6 old thread on disk: listing order | this run | `viewer/test/app-threads.spec.js:109` (thread seeded with `collin_at`, no `user_at`) | browser suite |
| S6 old queued message pending + send now | this run | `viewer/test/app-send-now.spec.js:77` | browser suite |
| S6 old resolved card shows Dismissed | this run | `viewer/test/app-merged.spec.js:54` | browser suite |
| S6 restart context only `'user'` | this run | `viewer/test/app-handoff-restart.test.js:70` | node suite |
| S6 handoff v1/v2 import, refusals, re-export v2 | this run | `viewer/test/app-handoff.test.js:384`, `viewer/test/app-handoff-import.test.js:303` | node suite |
| S6 interrupted v1 import retried then exported | this run | `viewer/test/app-handoff-import.test.js:315–324` (saved `create` handoff_op with `collin`, re-import resumes it via `viewer/app/handoff-import.js:26`) | node suite |

## Deviations from plan

- `normalizeThread` is also applied in `updateThread()` (`viewer/app/state.js:152`), a thread-file reader the Spec didn't list by name. S2's "any other place that parses a thread file" rule covers it.
- The interrupted-import test resumes the operation by importing the file again (`handoff-import.js:26`), not through the Retry route. Both paths run the same `handoff-ops.js` resume code.
- S6's refusal cases (v2 with `collin`, v1 with `user`, version 3) are checked at `validateHandoffFile`. Version 3 is also checked through the import path. The route still maps a failed validation to its existing 422.

## Routers

None. This change moved no ownership, and no router names a file whose role changed.

## Validation evidence

The suites ran on worker tip `8fe00486`. Since then the feature tip `bbdf0fe5` has changed only a comment (`viewer/pages/thread.js:797`) and `docs/maps/owner-name-state.md`:

```
$ git diff 8fe00486 HEAD --stat -- . ':(exclude)docs/plans'
 docs/maps/owner-name-state.md | 4 ++--
 viewer/pages/thread.js        | 2 +-
```

`node --test viewer/test/*.test.js` (run alone):
```
# tests 698
# pass 698
# fail 0
# cancelled 0
```
The worker's two failures (`app-quiet.test.js`, `app-uploads-archive.test.js`) happened while it ran the browser and machine suites at the same time. Run alone, the suite passes.

`npm --prefix viewer run test:browser`:
```
  34 skipped
  1044 passed (11.7m)
browser exit 0
```

`bash machine/test/run.sh`: `machine exit 0`.

`node --test test-support/test/*.test.js`: `# pass 9`, `# fail 0`.

First grep at `bbdf0fe5` (the expected hits only):
```
viewer/app/handoff.js:29  (v1 who list)
viewer/app/handoff.js:31  (v1 collin → user)
viewer/app/state.js:45-47 (collin_at → user_at)
viewer/app/state.js:51    (collin → user)
```

Second grep at `bbdf0fe5`, hit counts per file. Every hit is either a compatibility spot or a backward-compatibility test:
```
2 viewer/app/handoff.js
4 viewer/app/state.js
2 viewer/test/app-handoff-import.test.js
4 viewer/test/app-handoff-restart.test.js
2 viewer/test/app-handoff.test.js
1 viewer/test/app-merged.spec.js
4 viewer/test/app-owner-normalize.test.js
1 viewer/test/app-send-now.spec.js
1 viewer/test/app-threads.spec.js
```

## Residual risks

- The two Node-suite failures under concurrent load (`app-quiet`, `app-uploads-archive`) are timing flakes, not caused by this change. Their cause was not investigated.
- The Accepted Risks in PLAN.md stand: tabs left open across the update, and rollback.

## Lanes

| Task | Lane | Model |
|------|------|-------|
| T1 | standard | gpt-6.1-terra |
| Post-merge wording fixes | sub-lead | claude-opus-5-5 |

## Remediation 1

Verification attempt 1 (claude-opus-5-5, commit `1877e9f6`) passed every suite and grep but found one gap. The comment at `test-support/smoke/live.js:44-46` (S5) still used "his" and "His" for the user, and a sentence started in lowercase. See `REMEDIATION-1.md`.

- R1-1 (light, gpt-6-luna) replaced the three lines: "The user's choice …", "… even when the user's accounts …" and "The user's real Settings …". No other file changed.
- Evidence: `node --check test-support/smoke/live.js` passes, and the scout confirmed the diff matches the brief character for character.
- The sub-lead found no other owner pronouns in comments under `viewer/` or `test-support/`.
- The suites were not re-run: the change touches only a comment in a smoke script that no suite loads.
