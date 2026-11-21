---
slug: auto-merge
date: 2026-11-21
implemented-by: "T1 light (claude-haiku-5-5); T2 standard (gpt-6.1-terra, attempt 2 at effort xhigh); T3 standard (claude-sonnet-5-5); sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: claude / claude-opus-5-5
    checks: T1 claude light, T2 gpt standard, T3 claude standard (FAIL)
  - round: 1
    lane: gpt / gpt-6.2-sol
    checks: T1 claude light, T2 gpt standard, T3 claude standard (FAIL)
  - round: 2
    lane: claude / claude-opus-5-5
    checks: build plus R1-a gpt light, R1-b claude light (PASS)
  - round: 2
    lane: gpt / gpt-6.2-sol
    checks: build plus R1-a gpt light, R1-b claude light (FAIL)
  - round: 3
    lane: claude / claude-opus-5-5
    checks: build plus R2-a gpt light (PASS)
  - round: 3
    lane: gpt / gpt-6.2-sol
    checks: build plus R2-a gpt light (PASS)
---

# Completion Report — Auto-merge finished pull requests

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

All items are `this run`; the plan's Prior Work was empty.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 `auto_merge` default `'off'` | this run | `viewer/app/settings.js:38` | `viewer/test/app-settings.test.js:41` |
| §1 normalization (anything but `'on'` → `'off'`) | this run | `viewer/app/settings.js:230` | app-settings.test.js:41-46 (round trip) |
| §1 preferences response (`describe`) | this run | `viewer/app/settings.js:308` | app-settings.test.js:46 (GET `/settings`) |
| §1 PUT validation, 400 `auto_merge must be off or on`, response field | this run | `viewer/app/routes.js:314-316`, `:347` | app-settings.test.js:42-45 |
| §1 Settings page control, label and help text | this run | `viewer/pages/settings.js:542` (hint), `:592-594` (row, `modeGroup`) | app-settings.spec.js (page still renders, fits at 390px); no test clicks the new row |
| §1 nothing written into agents' instructions | this run | no change to `roleLayers`/`fullPrompt` (`git diff` of `viewer/app/settings.js` touches only lines 38, 230, 308) | inspection |
| §2 `done` `verified` boolean validation | this run | `viewer/app/card.js:141` | `viewer/test/app-auto-merge.test.js:31` |
| §2 result delivery carries `commit` | this run | `viewer/app/cards.js:177` | app-auto-merge.test.js:91 |
| §2 lead's `verified` rule | this run | `protocol/app/lead.md:653-666` (full rule), pointers at `:139`, `:467`, `:510` | inspection (no protocol test suite) |
| §3 trigger after a check card is saved, not delaying the response | this run | `viewer/app/cards.js:196` → `viewer/app/auto-merge.js` `afterCheck` (`:98-101`) | app-auto-merge.test.js:105 |
| §3 gates 1–4 (setting, head, attempt, broken) stop silently | this run | `viewer/app/auto-merge.js:24-30` | app-auto-merge.test.js:32 (`off`, `head`, `attempt`, `broken`: no `gh` call, no card) |
| §3 gates 5–7 (imported, every done verified, a matched step) → `held` record and card, no `gh` | this run | `viewer/app/auto-merge.js:33-41` | app-auto-merge.test.js:32 (`imported`, `unverified`, `unmatched`) |
| §3 `started` record saved before leaving the lock; one attempt per head | this run | `viewer/app/auto-merge.js:29`, `:42-45` | app-auto-merge.test.js:51 (second run adds no calls), :32 (`attempt`) |
| §3 step 8 readiness: MERGED/CLOSED no card; retry "still working out"/unreachable every `retryMs` up to `waitMs`; other refusals `not-ready`; judgePr ok but not CLEAN/HAS_HOOKS → `not-ready` review reason | this run | `viewer/app/auto-merge.js:50-75` | app-auto-merge.test.js:51 (UNKNOWN retried then not-ready; MERGED; CLOSED; BLOCKED no merge call) |
| §3 step 9 setting re-read | this run | `viewer/app/auto-merge.js:77` | app-auto-merge.test.js:116 (`switched-off`, no merge call, no card) |
| §3 step 10 REST merge, exact argv, 60 s timeout, merged/failed/unknown | this run | `viewer/app/auto-merge.js:79-87` | app-auto-merge.test.js:51 (argv, success, failure message), :130 (timeout → `unknown`) |
| §3 Finishing: reload under lock, outcome + card in one save, skip card if `merged` for this PR or done at another head; card text | this run | `viewer/app/auto-merge.js:13-16` (card), `:89-95` | app-auto-merge.test.js:139 (merged / newer done / unrelated writer kept), :130 (unknown wording), :51 (failure body) |
| §3 card `auto_merge: true`, Dismiss button, user dismiss allowed, lead resolve refused | this run | `viewer/app/card.js:245`, `viewer/pages/thread.js:1022-1030` | app-auto-merge.test.js:69, :186; no browser test of the button |
| §3 card closes on `merged` card ("Merged") and on a done at a different head ("Replaced by a newer version"), not the same head | this run | `viewer/app/threads.js:473`, `viewer/app/cards.js:160-162` | app-auto-merge.test.js:161, :172 |
| §3 restart leaves `started` as is | this run | no resume code; `auto_merge_attempts[head]` blocks gate 3 (`viewer/app/auto-merge.js:29`) | app-auto-merge.test.js:32 (`attempt` with `started`) |
| §4 "Never merge: the app merges…" | this run | `protocol/app/lead.md:463-464` | grep |
| §4 `verified` rule at each done site, repost on older hub | this run | `protocol/app/lead.md:653-666`, pointers `:139`, `:467`, `:510` | grep |
| §4 one line on `dismissed`; app's own card, not resolved | this run | `protocol/app/lead.md:594-595` | grep |
| §4 check `update` wording holds either way | this run | `protocol/app/lead.md:541-542` | grep |
| §4 `cards-lead.md` done table `verified` row | this run | `protocol/app/cards-lead.md:134` | grep |
| §5 not changed: done gate, `pr-wait.py`, pr-gate | this run | `git diff main -- viewer/app/pr-gate.js viewer/app/pr-wait.py` is empty | full suite (app-done-gate.test.js unchanged and passing) |

## Deviations from plan

- `protocol/app/lead.md:659`: rule (b) reads "lists only files under `docs/plans/`, or nothing". The Spec says "lists only files under `docs/plans/`". An empty diff (a small fix whose done head is the verified commit) passes either reading; the sub-lead made that explicit so a literal lead doesn't leave out `verified`.
- Spec §2 opens with "only when both hold" and then lists three conditions. The lead protocol requires all three.

## Routers

`viewer/AGENTS.md`: added a row for the new `app/auto-merge.js`. No ownership moved between directories.

## Validation evidence

On the feature branch after all merges (`5eb82aa6`):

```
$ cd viewer && npm test
# tests 792
# pass 792
# fail 0

$ cd viewer && node --test test/app-auto-merge.test.js   (on the T2 branch before merge)
# tests 12
# pass 12
# fail 0

$ grep -n "auto_merge" viewer/app/settings.js viewer/app/routes.js viewer/pages/settings.js
viewer/app/routes.js:314:      if (body.auto_merge !== undefined) {
viewer/app/routes.js:315:        if (!['off', 'on'].includes(body.auto_merge)) throw appError(400, 'auto_merge must be off or on');
viewer/app/routes.js:316:        value.auto_merge = body.auto_merge;
viewer/app/routes.js:347:    return send(response, 200, { ... auto_merge: value.auto_merge, ... });
viewer/app/settings.js:38:  return { ... auto_merge: 'off', ... };
viewer/app/settings.js:230:    auto_merge: saved.auto_merge === 'on' ? 'on' : 'off',
viewer/app/settings.js:308:  return { ... auto_merge: settings.auto_merge, ... };
viewer/pages/settings.js:594:            modeGroup('auto_merge', 'Merge pull requests when done', [['off', 'Off'], ['on', 'On']])),

$ cd viewer && npx playwright test test/app-settings.spec.js test/app-needs.spec.js test/app-check-card.spec.js test/app-merged.spec.js --reporter=line
  104 passed (1.4m)
```

The full `npm run test:browser` suite was not run, only the four specs that touch the changed pages.

## Known gaps / residual risks

- No browser test clicks the new Settings row or the Dismiss button. Both reuse existing patterns (`modeGroup`, card `post` + `poll`), and the server routes they call are covered by Node tests.
- Real GitHub was never contacted. All `gh` behaviour is stubbed, including the REST merge response shape (`merged`, `message`) and `gh api`'s exit code and stdout on an HTTP error.
- This thread's own PR will not auto-merge: the installed hub doesn't have the feature until this PR is merged.
- The first T2 attempt's worktree (`wc-91de6c1c2eb1-w3`) is left in place. Its commit was cherry-picked rather than merged, so the service refuses to remove it.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 (after verification attempt 1 at `768b036e`)

Gaps and judgment are in `REMEDIATION-1.md`. One rare path (a ready response just past the wait deadline) went to Accepted Risks as `verification-1`.

| Gap | Fix | Evidence |
|-----|-----|----------|
| A held outcome added the notice even with a `merged` card for the PR (R1-a, gpt light / gpt-6-luna) | `viewer/app/auto-merge.js:39-40`: the held branch adds the card only when no `merged` card for `done.pr_url` exists | `viewer/test/app-auto-merge.test.js:51` ("held gate does not add notice when pull request already has a merged card") |
| The switch's save note said "Saved, applies to new sessions" (R1-b, claude light / claude-haiku-5-5) | `viewer/pages/settings.js:495,507` `modeGroup` takes an optional saved note; `:594` passes `'Saved'` | `viewer/test/app-settings.spec.js:258` (clicks On, note is exactly `Saved`, On survives a reload) |

Validation after both merges (feature branch):

```
$ cd viewer && node --test test/*.test.js        (run twice, same result both times)
not ok 436 - 6 message clears debt
# tests 793
# pass 792
# fail 1

$ cd viewer && node --test test/app-quiet.test.js    (three runs)
# pass 18 # fail 0
# pass 18 # fail 0
# pass 18 # fail 0

$ cd viewer && npx playwright test test/app-settings.spec.js --reporter=line   (R1-b branch)
  70 passed (34.3s)
```

The one failure is a timing test (`viewer/test/app-quiet.test.js:38`: wait 220 ms, then expect no reminder). It covers the quiet-session path, which this build does not change (`git diff main -- viewer/app/quiet.js viewer/test/app-quiet.test.js` is empty). It fails only under full parallel-suite load. The verifier at attempt 1 also saw quiet-session timing failures on its first run, and its retry passed 792/792. R1-a's branch passed 793/793. Treated as a pre-existing flaky test, not a regression; residual risk noted here.

### Remediation 2 (after verification attempt 2 at `96068dd6`)

Gap and judgment in `REMEDIATION-2.md`.

| Gap | Fix | Evidence |
|-----|-----|----------|
| The step 8 retry test's 20 ms budget could run out after one `gh` call under full-suite load (R2-a, gpt light / gpt-6-luna) | `viewer/test/app-auto-merge.test.js:16` defaults `retryMs 20 / waitMs 20 / mergeTimeoutMs 5000`; the UNKNOWN row uses `retryMs 50 / waitMs 1500` (`:71`, restored at `:80`); the timeout test uses `mergeTimeoutMs 300` with a 5 s stub (`:145-151`). Test-only. | below |

```
$ cd viewer && node --test test/app-auto-merge.test.js   (3 runs)
# pass 13 # fail 0
# pass 13 # fail 0
# pass 13 # fail 0

$ cd viewer && node --test test/*.test.js
not ok 436 - 6 message clears debt
# tests 793
# pass 792
# fail 1
```

The remaining full-suite failure is the quiet-session timing test described under Remediation 1. It is outside this build's files and passes when run alone.

### Verification attempt 3 at `381fbb4c`: PASS (both verifiers)

The GPT verifier's `npm test` passed 793/793. The Claude verifier's first run had the quiet-session timing failure and its third run passed 793/793. At the merge base `249d3a8b`, in a separate clone, it passed 780/780. Browser specs for the touched pages passed 106/106 in Chromium and Firefox, and the Dismiss button passed a phone-width check in both.
