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
