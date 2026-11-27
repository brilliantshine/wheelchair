---
slug: settings-solid
date: 2026-11-26
implemented-by: "T1 light (gpt-6-luna), T2 standard (gpt-6.1-terra; asked for claude, the hub sent it to gpt), T3 light (gpt-6-luna)"
verified-by:
  - round: 1
    lane: verifier / claude-opus-5-5 (comparison commit 672764ae)
    checks: gpt (gpt-6-luna, gpt-6.1-terra)
---

# Completion Report — Make the Settings page solid

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 `build-up` option label is `Plain words first, build up if needed`; values unchanged | this run (T2) | `viewer/pages/settings.js:1235` | `viewer/test/app-settings-hold.spec.js:158` |
| S1 Technical terms row hint is `How the lead handles technical terms` | this run (T2) | `viewer/pages/settings.js:1338` | `viewer/test/app-settings-hold.spec.js:158` |
| S1 390px: label text width ≤ select content-box width − 24px | this run (T2) | (label length, `viewer/pages/settings.js:1235`) | `viewer/test/app-settings-hold.spec.js:158` (canvas `measureText` in the select's computed font) |
| S1 `renderStyle` `build-up` sentence is the new exact sentence; `freely`/`avoid` unchanged | this run (T1) | `viewer/app/settings.js:144` | `viewer/test/app-settings.test.js:21` |
| S1 `DEFAULT_STYLE.text` is the one-line default | this run (T1) | `viewer/app/settings.js:36` | `viewer/test/app-settings.test.js:21` |
| S1 done-card note about saved text keeping the old line | lead's done card | — (not code; for the lead's done card) | — |
| S2 card is `waiting` from attach until signed in, failed (incl. failed start) or expired | this run (T2) | `viewer/pages/settings.js:1514` (set), `:1520` (`fail()`, which expiry also calls), `:1532` (signed in), `:1572` (start request failed) | `viewer/test/app-settings-hold.spec.js:110`, `:127`, `:147` |
| S2 `refreshUsage` skips Accounts while a waiting card is inside Accounts; Usage still repaints; `accountsBusy()` and other callers unchanged | this run (T2) | `viewer/pages/settings.js:1437` | `viewer/test/app-settings-hold.spec.js:110` (press on Send code, focus off the field), `:127` (focused field and 30-second timer; Close shows newer usage), `:209` (harness toggle still updates Accounts) |
| S2 after the card stops waiting, the next usage answer repaints Accounts | this run (T2) | `viewer/pages/settings.js:1437` with `:1520` | `viewer/test/app-settings-hold.spec.js:147` |
| S3 pointer tracking: pressed until pointerup/cancel; mouse-only position, forgotten on pointerleave | this run (T2) | `viewer/pages/settings.js:2486-2491` | `viewer/test/app-settings-hold.spec.js:168` (press, hover, focus) |
| S3 `holdPlace` anchor order pressed → focused → hovered → sign-in card → next sibling; must be outside host, after it, on screen; scroll by the change in top | this run (T2) | `viewer/pages/settings.js:2493-2512` | `viewer/test/app-settings-hold.spec.js:168`; existing `viewer/test/app-settings.spec.js:1022`, `:1046` unchanged and passing |
| Validation: new spec on `firefox-specs.js` | this run (T2) | `viewer/test/firefox-specs.js:4` | Firefox project ran it (output below) |

## Deviations from plan

- The expired case of S2 is not tested on its own. Expiry goes through the same `fail()` (`viewer/pages/settings.js:1542` calls `fail()`), which clears `waiting`, and `:147` tests the failed path.
- No other deviations.

## Routers

None. This change moved no ownership, and no router names a file it touched in a way that became false.

## Validation evidence

On the feature tip `e7804923`:

```text
$ node --test viewer/test/app-settings.test.js
# pass 18
# fail 0
$ node --test machine/test/name-guard.test.js
# tests 2
# pass 2
# fail 0
$ npm --prefix viewer run test:browser -- app-settings-hold.spec.js app-settings.spec.js app-accounts.spec.js app-harnesses.spec.js
  ✓  194 [firefox] › test/app-settings-hold.spec.js:209:1 › turning on another harness updates Accounts with a waiting card (2.2s)
  1 skipped
  193 passed (2.3m)
```

Each worker's break check (in `reports/T1.md` and `reports/T2.md`): T1's test failed with the old sentence. With the S2 or S3 change reverted, the matching hold-spec tests failed, and they passed again once the change was restored.

### Verification attempt 1

Verifier (claude-opus-5-5, comparison and picker base `672764ae` = origin/main): **PASS**, no gaps, on `cd66f313`. Its break check (S2/S3 reverted in a scratch clone) failed the Send code test and all three Lead order tests. An earlier verifier briefed with the stale local `main` (`c8fb7e5e`) also reported PASS. I replaced it only because of that base.

### Full run on cd66f313 (the run used for the gate: no other thread's full run was going)

```text
commit cd66f313afeef6f401b7c8e1a0e548e232699e0d
suite viewer-browser exit 0 seconds 382
suite viewer-node exit 0 seconds 95
suite machine exit 0 seconds 130
suite test-support exit 0 seconds 24
suite sensitivity exit 0 seconds 4
suite codex exit 0 seconds 11
suite install exit 1 seconds 39
suite sudo-helper exit 0 seconds 9
```

The `install` failure is already on main:

```text
comparison commit 672764aeaa4a1170c7cd6d15af0cfb9673ced4e2 (origin/main)
install: FAIL real wheelchair directory is byte-identical after suite (RESULT 212 passed, 1 failed), same test and error as on cd66f313
```

Earlier full runs on the same commit failed while another thread's full runs were going at the same time. Each run failed different tests, none in files this change touches: `browser.spec.js:2157`, `app-agents-decks.spec.js:247` (firefox), `app-views.spec.js:111`, `app-threads.spec.js:573` (firefox), `switch-http.test.js:112/136`, `folder-tools-run.test.js:26` (twice), `full-run.test.js` TERM/HUP, and viewer-node "6 message clears debt". Each passed when run alone on `cd66f313`. `machine/test/run.sh` run alone passed on both `cd66f313` and `672764ae` (869 pass, 0 fail). `folder-tools-run.test.js:26` (stdout cut short of 1,000,000 bytes under load) looks like an intermittent drain bug in main's tool launcher (PR #200). It is not part of this change.

## Known gaps / residual risks

- Accepted Risk (review round 1): a saved style near the 12,000-character cap can go over it with the longer sentence.
- Saved style text on existing installs still holds the old "Build up to technical terms…" line, which now sits beside the new sentence. The done card should tell Collin it can be deleted in Settings > You (S1).
- Phone row heights were left as they are (Decision 6).

## Remediation rounds
