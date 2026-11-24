---
slug: mockup-polish
date: 2026-11-23
implemented-by: "claude standard (claude-sonnet-5-5) x3 workers; sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Mockups that behave well in a thread

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by:
```

## Spec coverage

All rows are `this run` (the plan has no Prior Work). Line numbers are on the feature branch at the commit this report is committed in.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 `renderChat()` reconciles: keyed entries with signatures, unchanged nodes kept, iframe entries never moved/removed, new inserted, changed replaced, gone removed | this run | `viewer/pages/thread.js:675` (`reconcile`), entries built in `renderChat` (~`thread.js:700-830`) | `viewer/test/app-chat-stability.spec.js:27` |
| S1 card signature covers its fields + outside state (pinned, archived, slug, worktree, card errors, open/folded) | this run | `viewer/pages/thread.js:664` (`cardSig`) | `app-chat-stability.spec.js:27`; full browser suite |
| S1 kept card handlers look up the current card by id | this run | `viewer/pages/thread.js:1017` (`live`), used in every press/dismiss/sudo handler | full browser suite (app-threads, app-sudo, app-needs…) |
| S1 placeIds, asides, pending matching, import cutoff still work; full rebuild only when the cutoff moves | this run | `thread.js` `renderChat` cutoff key (`seenCutoffKey`); `render()` ~`thread.js:1586-1620` | app-asides, app-handoff, app-send-now, app-threads specs (full suite) |
| S1 scroll: follow at bottom (80px); otherwise record every visible entry's key+offset before anything above the chat changes, restore first survivor; none → leave | this run | `thread.js:135` (`chatPlace`), `thread.js:146` (`restorePlace`), captured `thread.js:1586`, restored `thread.js:1616` | `app-chat-stability.spec.js:27`, `:69` |
| S1 the same capture/restore wraps a banner-only poll change | this run | `thread.js:127-131` (`showError` wraps it, covering the poll path) | code read; `app-try.spec.js` poll-error tests (full suite) |
| S1 mockup box reserves final height via `aspect-ratio` | this run | `viewer/pages/diagram.js:75`; `fit()` sets only the transform | `app-chat-stability.spec.js:82` |
| S2 Comment on a spot button beside Open full size (diagram mockup cards, image Mockup half, picture page) | this run | `thread.js:166` (`spotButton`); `diagram.js:101` (`spot`); `picture.js:79` (`offerSpotComment`) | `app-spot-comment.spec.js:39`, `:170`, `:202` |
| S2 shown only while `canSend`; else `visibility: hidden`; outside card signatures, toggled in place | this run | `thread.js:212` (`canSendNow`), `thread.js:1619` | `app-spot-comment.spec.js:80` |
| S2 drafts kept outside card DOM keyed by card id + mockup file; redrawn on node replacement; cleared only by acceptance/Cancel | this run | `diagram.js:95-97` (`drafts` Map), `diagram.js:148`, `:155` | `app-spot-comment.spec.js:138`, `:156` |
| S2 picture page iframe `scrolling="no"` | this run | `viewer/pages/picture.js:119` | code read |
| S2 transparent layer, pin, text box with Send/Cancel; tap moves pin; iframe stays `sandbox=""` | this run | `diagram.js:101-160` | `app-spot-comment.spec.js:39`, `:156` |
| S2 tap → mockup pixels: divide by scale, round, clamp | this run | `diagram.js:138-145` | `app-spot-comment.spec.js:39`, `:63`, `:202` (absolute offsets) |
| S2 Send shares the composer path (`POST <thread>/messages` + pending push); `sendNow` not involved | this run | `thread.js:160` (`sendAsUser`, used by composer and spot) | `app-spot-comment.spec.js:39`; app-send-now spec |
| S2 pending disables box, Send, Cancel; failure shows "Comment not sent: <reason>", keeps all | this run | `diagram.js:127-129`, `:157` | `app-spot-comment.spec.js:99`, `:122` |
| S2 picture page eligibility at load and on Send (re-reads `<thread>/chat`), names the failed condition; "Sent to the thread" with link back | this run | `picture.js:74-97` | `app-spot-comment.spec.js:202`, `:218`, `:240` |
| S2 message text format exactly as Spec; empty comment cannot be sent | this run | `diagram.js:91` (`spotText`), `diagram.js:151` | `app-spot-comment.spec.js:39`, `:202` |
| S2 protocol sentences | this run | `protocol/app/lead.md:845`; `protocol/app/designer.md:42` | read |
| S3 Download makes PNG via `offerPng`/`WCPictureExport.save`; Download HTML link kept | this run | `picture.js:124`, `picture.js:123` (`#download-html`), `picture.html` | `app-mockup-png.spec.js` (size/foreground test), `:82` |
| S3 rasterizer: fetch, parse, strip scripts, `:root`→`html`, foreignObject w x h root box with canvas background moved, `data:` URL, `scaleFor` canvas filled white | this run | `viewer/pages/picture-export.js:112-160` (`mockupCanvas`; scripts `:116`, `:root` `:120`, white `:142`, scale `:138`), background read `picture-export.js:82-107` | `app-mockup-png.spec.js:56`, `:64`, `:70` |
| S3 refusal note "This browser could not make a PNG of this mockup. Download HTML instead." | this run | `picture.js:35` (`offerPng` failText), `picture.js:124` | `app-mockup-png.spec.js:91` |
| S4 picture page `view=image`: natural size, scrolls, Download link, archive removal text | this run | `picture.js:62-65` (`showImage`), `picture.js:103-105`; `picture.css` (`img.picture-shot`) | `app-screenshot-view.spec.js:32`, `:46` |
| S4 Built's Open full size and every image tap open that view | this run | `thread.js:477` (`imageHref`), used in the image card drawing | `app-chat-stability.spec.js:97`; `app-mockups.spec.js` |

## Deviations from plan

None from the Spec. Choices the Spec left open are logged in PLAN.md's Log (`Choice:` lines). Two worth naming:

- The PNG failure note shows for any failure while making the PNG (fetch, load, taint), not only a browser refusal (`picture.js:35`, `:124`).
- The picture bar wraps on a phone (`picture.css`) so the added Comment button does not push Download off screen.

## Routers

None. This change moved no ownership, and no router names a file it touched in a way that changed.

## Validation evidence

Run by the sub-lead on the feature branch after all three merges (tip `0ac89563`, the commit before this report).

`node --test viewer/test/*.test.js`:
```
# tests 935
# pass 934
# fail 1
not ok 251 - switching a harness off cancels its install on every known machine, without waiting
```
That test (`viewer/test/app-harnesses.test.js`, a `< 1000ms` timing assertion) is flaky under load and fails on `main` too. Interleaved runs of `node --test viewer/test/app-harnesses.test.js`:
```
main # fail 0
feat # fail 1
main # fail 1
feat # fail 0
main # fail 0
feat # fail 1
```
This branch changes nothing under `viewer/app/` or `machine/` (`git diff --stat main...HEAD` lists only `viewer/pages/*`, `viewer/test/*.spec.js`, two protocol files and plan docs).

`npm --prefix viewer run test:browser`, run as three shards so each fits a 10-minute call:
```
--shard=1/3   exit 0   3 skipped   567 passed (7.1m)
--shard=2/3   exit 0  17 skipped   434 passed (7.2m)
--shard=3/3   exit 0  14 skipped   469 passed (6.4m)
```
Total: 1470 passed, 34 skipped, 0 failed.

Targeted re-runs at acceptance (sub-lead): T1 specs + app-threads subset 42 passed; T2 specs 26 passed; T3 specs with the T1/T2 specs 82 passed. Each worker broke its behaviour once to show its tests fail (reports `docs/plans/mockup-polish/reports/T1.md`, `T2.md`, `T3.md`).

## Known gaps / residual risks

- Taps are tested with Playwright clicks at 390x844, not on a real phone.
- The "a script in the mockup does not run" PNG test cannot fail. A script can't run in an SVG image anyway, and the stripping happens at `picture-export.js:116`.
- Untested: the "being handed off" reason on both pages, the picture page's pending state, and taps being ignored while pending. The code paths are at `picture.js:76` and `diagram.js:138`.
- The spot-coordinate thread test computes its expectation with the same scale formula as the code. The picture-page test uses absolute offsets.
- Accepted Risks in PLAN.md still stand. The mockup PNG is untested in WebKit (iPhone); the fallback note and HTML link cover it.
- The flash was diagnosed from source. `app-chat-stability.spec.js:27` (same iframe element, no second `load`, top entry within 2px) is the proof.

## Remediation rounds

### Remediation 1 — 2026-11-23

Verification attempt 1 (gpt-6.2-sol, commit `b44a6aac`) reported 4 gaps. One was judged a rare path and recorded in PLAN.md Accepted Risks (lead name or worktree change not redrawing the chat). The lead answered fix for the other three. Task R1 (claude standard / claude-sonnet-5-5), see `REMEDIATION-1.md`:

| Gap | Fix (file:line) | Test |
|-----|-----------------|------|
| S1: the scroll anchor could be a row under the sticky header, so a card inserted out of order moved the visible mockup by 193px | `viewer/pages/thread.js:138-145` (`chatPlace` records only rows below the lowest bottom of `#head`, `#dead` and `#pinned`) | `app-chat-stability.spec.js` (the new out-of-order card test) |
| S2: a hand-off starting reloaded every mockup, because `frozen()` was in every card signature | `thread.js:670` (`cardSig`: no `frozen()` for `diagram`/`image`); `thread.js:1463` (those cards skip the frozen disabling loop, so a draft's Cancel stays usable) | `app-spot-comment.spec.js:248` |
| S3: the PNG background was read in an 800x600 helper, so media queries exported the wrong colour | `viewer/pages/picture-export.js:84-88` (helper sized to the mockup's w x h) | `app-mockup-png.spec.js` (the new responsive-background test) |

The R1 worker says each new test failed against the old code. The sub-lead re-ran chat-stability, spot-comment, mockup-png and handoff: 82 passed.

Full validation on the merged tip (sub-lead):
```
npm --prefix viewer run test:browser -- --shard=1/3   exit 0   3 skipped  570 passed (7.6m)
npm --prefix viewer run test:browser -- --shard=2/3   exit 0  17 skipped  435 passed (7.0m)
npm --prefix viewer run test:browser -- --shard=3/3   exit 1  14 skipped  470 passed, 1 failed (7.3m)
  failed: [firefox] test/run.spec.js:225 clicking a needs-you node shows its full needs text (run graph page, untouched by this build)
  re-run alone: npm --prefix viewer run test:browser -- run.spec.js  ->  26 passed
node --test viewer/test/*.test.js   # tests 935  # pass 933  # fail 2
  not ok 251 - switching a harness off cancels its install... (known load flake, also fails on main)
  not ok 527 - 6 message clears debt (viewer/test/app-quiet.test.js, untouched)
  re-run alone: node --test viewer/test/app-quiet.test.js  ->  # pass 27 # fail 0
```

### Remediation 2 — 2026-11-23

Verification attempt 2 (gpt-6.2-sol, commit `699c1a26`) reported 3 gaps. The lead answered: fix 1 and 3, defer 2 (PLAN.md Deferred D3: Firefox PNG of a mockup that uses media queries). Task R2 (claude light / claude-haiku-5-5), see `REMEDIATION-2.md`:

| Gap | Fix (file:line) | Test |
|-----|-----------------|------|
| S1: the Done card's "Start a thread about it" handler passed the card captured at draw time | `viewer/pages/thread.js:93` (`press(live(card), 'start-thread', text)`) | code read; app-threads spec |
| S1/S2 validation: the hand-off test counted iframe loads before the first load finished (flaky in Firefox) | `viewer/test/app-spot-comment.spec.js:252-253` and `viewer/test/app-chat-stability.spec.js:38-41` wait for `waitForLoadState('load')` before counting | the worker ran them with `--repeat-each=3` (102 passed); the sub-lead ran them with `--repeat-each=2` (68 passed) |

Full validation on the merged tip (sub-lead, 21:00 PST):
```
npm --prefix viewer run test:browser -- --shard=N/6
  1/6 exit 0   3 skipped 267 passed
  2/6 exit 0             303 passed
  3/6 exit 1  14 skipped 217 passed, 3 failed
  4/6 exit 0   3 skipped 215 passed
  5/6 exit 0             303 passed
  6/6 exit 0  14 skipped 168 passed
  total 1473 passed, 34 skipped, 3 failed
  failed: [firefox] app-accounts.spec.js:576, :584, :591 "lead waiting line" (expects "Waiting for room, about <digit>"; got "about Tue 12:01 AM": the +3h time crosses midnight)
  same three fail on main (canonical clone 25f34a45) at the same hour: npm --prefix viewer run test:browser -- app-accounts.spec.js -g "lead waiting line" -> 3 failed, 4 passed
node --test viewer/test/*.test.js   # tests 935  # pass 934  # fail 1  (the known harness timing flake)
```

### Remediation 3 — 2026-11-23

Verification attempt 3 (gpt-6.2-sol, commit `192b501e`) reported 3 gaps. One was judged a rare path and recorded in PLAN.md Accepted Risks (`background-blend-mode` lost in the PNG). The lead answered: fix 1, defer 2 (PLAN.md Deferred D4: Firefox PNG of a mockup that uses vh units). Task R3 (gpt light / gpt-6-luna; Claude had no room, so the hub routed it to GPT), see `REMEDIATION-3.md`:

| Gap | Fix (file:line) | Test |
|-----|-----------------|------|
| S2: a spot comment stayed locked after the hub accepted it until the chat refresh finished | `viewer/pages/thread.js:176-178` (`spotButton` send: after the POST, `sigs.chat = null; render();` then `poll()` without awaiting) | `app-spot-comment.spec.js` "clears as soon as the hub accepts it" holds the chat GET. It failed on the old handler in both browsers (pasted in `reports/R3.md`) |

Full validation on the merged tip (sub-lead):
```
node --test viewer/test/*.test.js   # tests 935  # pass 934  # fail 1  (the known harness timing flake, also on main)
npm --prefix viewer run test:browser   (one unsharded run, 23.8m)
  EXIT 1   1438 passed, 10 failed, 34 skipped, 30 did not run
  failed, all reproduced as pre-existing or load-only:
    app-accounts.spec.js:576, :584, :591, :599 "lead waiting line" x chromium+firefox (8): the +3h time crosses midnight; the same tests fail on main at this hour
    app-handoff.spec.js:206 [chromium]: re-run alone with --repeat-each=4 -> 8 passed, and 8 passed on main
    app-settings.spec.js:99 [firefox]: its serial group's failure withheld the 30 "did not run"; re-run of the whole file alone -> 72 passed (verifier 3 also reproduced this failure on main)
app-send-now.spec.js:59 "a regular composer send already shown by a poll…" fails about 1 in 72 here and on main (--repeat-each=6: 71 passed 1 failed on both)
```

### Remediation 4 — 2026-11-23

Verification attempt 4 (commit `b060a327`): the Claude verifier (claude-opus-5-5) passed; the GPT verifier (gpt-6.2-sol) reported one gap. The lead answered fix. Task R4 (gpt light / gpt-6-luna; Claude had no room, so the hub routed it to GPT), see `REMEDIATION-4.md`:

| Gap | Fix (file:line) | Test |
|-----|-----------------|------|
| S3: `rem` sizes exported at the wrong scale when the mockup sets a root font size (inside the SVG, `rem` resolved against 16px) | `viewer/pages/picture-export.js:83-96` (`readMockupPage` also reads `html`'s computed font size); `:136` (set on the `<svg>` root when it is a px value) | `app-mockup-png.spec.js:108-113` "rem sizes follow the mockup's root font size". It failed on the old exporter in both browsers (pasted in `reports/R4.md`) |

Full validation on the merged tip (sub-lead):
```
node --test viewer/test/*.test.js   # tests 935  # pass 932  # fail 3
  harness timing (known, also on main); app-quiet "6 message clears debt" -> alone 27/27; app-uploads-archive "stalled upload" -> alone 3/3
npm --prefix viewer run test:browser   (one unsharded run, 26.5m)
  EXIT 1   1471 passed, 9 failed, 34 skipped
  app-accounts.spec.js:576/584/591/599 "lead waiting line" x2 browsers (8): midnight crossing, fails on main too
  app-send-now.spec.js:84 [chromium] (30s timeout under load): --repeat-each=10 -> 20 passed here, 20 passed on main
```

### Remediation 5 — 2026-11-24

Verification attempt 5 (commit `41512f55`): both verifiers (claude-opus-5-5 and gpt-6.2-sol) reported the same gap, a regression from R4. A percentage root font size was applied twice, so `em` sizes and inherited text came out at 62.5%. The lead answered fix. This is the second fix attempt on the root-font-size gap. Task R5 (gpt light / gpt-6-luna; Claude had no room, so the hub routed it to GPT), see `REMEDIATION-5.md`:

| Gap | Fix (file:line) | Test |
|-----|-----------------|------|
| S3: `em` and inherited text scaled twice by a percentage root font size | `viewer/pages/picture-export.js:125` (`rootPx` computed once), `:128` (the wrapped `html` gets `font-size:<px> !important`), `:137` (the `<svg>` root as before) | `app-mockup-png.spec.js:117` "em sizes and inherited text follow the mockup's root font size" (fixture `:27`). The R5 worker reports it failed before the fix in both browsers. The rem test at `:109` is kept |

Full validation on the merged tip (sub-lead):
```
node --test viewer/test/*.test.js   # tests 935  # pass 933  # fail 2
  harness timing (known, also on main); app-quiet "6 message clears debt" (load flake, alone 27/27 earlier)
npm --prefix viewer run test:browser   (one unsharded run, 29.1m; the clock is now past midnight, so the "lead waiting" tests passed)
  EXIT 1   1479 passed, 3 failed, 34 skipped
  app-handoff.spec.js:228 [chromium]    re-run --repeat-each=5 -> 10 passed
  app-threads.spec.js:414 [chromium]    re-run --repeat-each=5 -> 20 passed
  browser.spec.js:875 [chromium]        re-run --repeat-each=5 -> 10 passed  (checks the live default cache root, which other sessions on this machine share)
```

### Remediation 6 — 2026-11-24

Verification attempt 6 (commit `ee575590`): the Claude verifier (claude-opus-5-5) passed; the GPT verifier (gpt-6.2-sol) reported 2 gaps. The lead answered fix both. Tasks R6 and R6b (gpt light / gpt-6-luna; Claude had no room, so the hub routed both to GPT), see `REMEDIATION-6.md`:

| Gap | Fix (file:line) | Test |
|-----|-----------------|------|
| S3: a mockup's `div` rule styled the PNG export's root box | `viewer/pages/picture-export.js:122-123` (root box is `<wc-export-root>` with an inline display/margin/padding/border reset) | `app-mockup-png.spec.js` "a mockup's div rule does not move the picture". R6b moved its fixture into normal flow. The sub-lead proved it: with the pre-R6 exporter (`af78151f~1`) it fails in both browsers (a pixel off by 255); with the current file, 2 passed |
| S2: on the picture page, a tap on the right of a wide mockup scrolled the pane back to the left, hiding the pin | `viewer/pages/diagram.js:145-154` (saves and restores `window.scrollX` and every ancestor's `scrollLeft` around `scrollIntoView`) | `app-spot-comment.spec.js` wide-mockup test (1000x600 at 390x844). The R6 worker reports it failed on the old code |

Full validation on the merged tip (sub-lead):
```
npm --prefix viewer run test:browser   (one unsharded run, 21.4m)
  EXIT 1   1485 passed, 1 failed, 34 skipped
  failed: [firefox] app-threads.spec.js:555 "approval: Start building enabled when Ready and presses; offer press": a waitForRequest timeout on the pinned offer button right after the approval press. Isolated runs: 18/20, then 40/40, then 100/100 on this branch, and 40/40 on main. The pinned area's drawing (renderPinned) is unchanged by this build. Treated as a timing flake.
node --test viewer/test/*.test.js   (run after the browser suite; run alongside it, it hung past 10 minutes)
  # tests 935  # pass 932  # fail 3: harness timing (known, on main), app-quiet "6 message clears debt" and app-uploads-archive "stalled upload" (load flakes that passed alone earlier: 27/27, 3/3)
```

### Remediation 7 — 2026-11-24

Verification attempt 7 (commit `b3e1f8f4`): both verifiers (claude-opus-5-5 and gpt-6.2-sol) reported that on a wide mockup the comment box was off screen while the pin stayed visible. GPT also reported a positioned-gradient PNG gap, judged rare (Accepted Risks, verification-7). The lead answered fix. This is the second fix attempt on the wide-mockup gap. Task R7 (gpt standard / gpt-6.1-terra; Claude had no room, so the hub routed it to GPT), see `REMEDIATION-7.md`:

| Gap | Fix (file:line) | Test |
|-----|-----------------|------|
| S2: on the picture page, after a tap on the right of a wide mockup, the comment box sat off screen to the left | `viewer/pages/picture.js:121-122` (the mockup wrap goes inside a `.picture-mockup-content` box as wide as the scrolled content); `viewer/pages/picture.css:20-22` (the comment box is `position: sticky; left: 0; width: 100cqw`, under thread.css's 480px cap) | `app-spot-comment.spec.js` wide-mockup test now also checks that `.spot-text`, Send and Cancel are inside the pane after the tap and after scrolling 200px further left. Pre-fix failure (box at x=-628) is pasted in `reports/R7.md`. Screenshot: `/tmp/wc-r7-11/picture.png` |

Full validation on the merged tip (sub-lead):
```
npm --prefix viewer run test:browser   (one unsharded run, 16.9m)   EXIT 0   1486 passed, 34 skipped
node --test viewer/test/*.test.js   # tests 935  # pass 934  # fail 1  (the known harness timing flake, also on main)
```
