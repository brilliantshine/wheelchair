---
slug: stub-dedupe
date: 2026-11-22
implemented-by: "T1 standard (gpt-6.1-terra), T2 standard (claude-sonnet-5-5), T3 standard (gpt-6.1-terra); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — No duplicate stubs

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

The plan has no Prior Work, so every row was built in this run.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Terms: candidate (stub, same project and machine, not archived, not frozen, no current `done`, no `merged` card) | this run | `viewer/app/peers.js:12` (`candidateStub`); machine and project are checked by the callers at `viewer/app/peers.js:45-46` and `viewer/app/cards.js:174` | `viewer/test/app-lead-list.test.js:34` (stubs d, e, f, 1 and 2 are absent) |
| Terms: unopened = no sessions | this run | `viewer/app/peers.js:50`, `:63`; `viewer/app/cards.js:176` | `app-lead-list.test.js:34` (b against c); `app-hub.test.js:2237` (the "started" refusal) |
| 1. `listLeads` lists unopened candidates in the caller's project with `lead: null` | this run | `viewer/app/peers.js:50` | `app-lead-list.test.js:34` (stub b) |
| 1. Candidate entries gain `stub`, `summary`, `takes_additions`, `waits_on_parent` | this run | `viewer/app/peers.js:63` | `app-lead-list.test.js:34` (b: true/true; c: false/false because it is ready) |
| 1. Non-candidate stubs, non-stubs and cross-project entries unchanged | this run | `viewer/app/peers.js:63` (only `sameProject && candidateStub`) | `app-lead-list.test.js:34` (entries 3 and 4 have no `stub` field); existing test `app-lead-list.test.js:10` unchanged and passing |
| 2. `stub.adds_to` (12 lowercase hex) and `duplicate` (boolean, only with `adds_to`) | this run | `viewer/app/card.js:175-176`, `:216` | `app-hub.test.js:2237` (direct `validate` checks, plus 422 through the hub) |
| 2. `adds_to` with `depends_on_parent: true` or `commits` is refused with the exact message | this run | `viewer/app/card.js:217` | `app-hub.test.js:2237` |
| 2. Under the target's lock, three refusals in order, 422, nothing stored | this run | `viewer/app/cards.js:168-176` | `app-hub.test.js:2237` (each refusal also checks the target context and the parent card count are unchanged) |
| 2. Append the exact paragraph (`Added from` / `Also came up in`), save target, store card with `adds_to`, `thread_id`, `target_title`; no child created | this run | `viewer/app/cards.js:177-180`, `:208` | `app-hub.test.js:2237` (exact context string; thread count unchanged) |
| 3. Parent stub card for an addition: heading, `target_title`, summary, "Go to it" to `thread_id`; unchanged without `adds_to` | this run | `viewer/pages/thread.js:1221-1229` | `viewer/test/app-threads.spec.js:614` |
| 3. Unopened page context keeps line breaks (`pre-line`) | this run | `viewer/pages/thread.js:529-530` | `app-threads.spec.js:614` (computed `white-space`) |
| 4. lead.md Stubs: "Before posting a stub" rule (all bullets, precedence, any step, refusals, exemptions) | this run | `protocol/app/lead.md:813-822` | review by scout against Spec 4 (Log, T3 accepted) |
| 4. lead.md "Other leads": new fields, `lead: null`, the `takes_additions` line | this run | `protocol/app/lead.md:742`, `:745` | `protocol-rules.test.js` passes; scout review |
| 4. lead.md "Overlap questions" `takes_additions` line | this run | `protocol/app/lead.md:756` | scout review |
| 4. cards-lead.md `stub`: `adds_to`, `duplicate`, refusals, appended text, parent card look; "same CLI" claim dropped | this run | `protocol/app/cards-lead.md:248-256` | scout review; `protocol-rules.test.js` |
| 4. cards.md id-field exception gains `stub.adds_to` | this run | `protocol/app/cards.md:26` | scout review |

## Deviations from plan

- A `duplicate` without `adds_to` is refused with the reason `duplicate requires adds_to`. The Spec requires the refusal but names no text.
- A successful duplicate note returns HTTP 200, not 202. `viewer/app/routes.js:461` picks the status from the returned card's `duplicate` field, which is also its replay marker. Nothing in the app or `card.js` reads the status, so the printed receipt is unchanged.
- The planning graph `docs/plans/stub-dedupe/graphs/stub-check.json` was committed without box positions, so `browser.spec.js:2157` failed on it. It still showed the opened-stub "agent is told" path that Decision 17 removed. The sub-lead rewrote it through the graph server, which laid out the boxes, to match the Spec's Flow (commit f018409f).

## Routers

None. This change moved no ownership, and no router names a file it touched.

## Validation evidence

Full unit suite on the merged feature branch (`cd viewer && npm test`):

```
not ok 468 - 6 message clears debt
# tests 835
# pass 834
# fail 1
```

The one failure is `viewer/test/app-quiet.test.js:38`. It also failed on T3's branch, which changed only protocol markdown and had none of T1's code. Run alone three times on this branch, it passes each time (`# fail 0` ×3). It is a timing flake under full-suite load, outside this change.

Feature tests (T1's re-run on its branch, unchanged after merge):

```
node --test test/app-lead-list.test.js test/app-hub.test.js
# tests 119
# pass 119
# fail 0
```

Full browser suite on the merged branch (`cd viewer && npm run test:browser`):

```
  3 failed
  34 skipped
  1277 passed (16.3m)
  ✘   639 [chromium] › test/browser.spec.js:2157:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  ✘  1166 [firefox] › test/app-threads.spec.js:557:5 › desktop › approval: Start building enabled when Ready and presses; offer press (30.1s)
  ✘  1307 [firefox] › test/browser.spec.js:2157:1 › no drawn arrow's line passes through either box it connects, over every committed graph
```

- The `browser.spec.js:2157` failures were `edge(s) crossing a box in docs/plans/stub-dedupe/graphs/stub-check.json`. After the graph rewrite: `npx playwright test "test/browser.spec.js:2157"` → `2 passed (10.1s)`.
- `app-threads.spec.js:557` (firefox) was a 30 s timeout, in an approval test this change does not touch. Run alone, `npx playwright test test/app-threads.spec.js:557 --project=firefox` → `2 passed (3.1s)`.
- The whole `app-threads.spec.js` on T2's branch: `170 passed (2.6m)`.

## Known gaps / residual risks

- The plan's Accepted Risks stand: an addition queued while the hub is down, merged-before-done stubs, self-targeted `adds_to`, and replay after a crash inside the write.
- `app-threads.spec.js:614` checks headings by substring, and its "Go to it" link check would also pass on the old card. The heading, duplicate heading and `pre-line` checks do fail on the old code.
- The shared `duplicate` field name means a successful duplicate note gets the replay status code (200). It is harmless today. A future change that reads that status would need to know this.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-22

Verification attempt 1 (a808c9af): the Claude verifier passed. The GPT verifier found one gap: a new duplicate note returned HTTP 200, the replay status, instead of 202 (`viewer/app/API.md:40`), because `routes.js` read the card's own `duplicate` field. The lead chose to fix it. See `REMEDIATION-1.md`.

Fix (R1-1, standard, gpt-6.1-terra): `viewer/app/cards.js:9` defines a `REPLAY` symbol, exported at `cards.js:295`. The replay branch at `cards.js:64` returns `{ replay: {...} }`, and `cards.js:223` marks it non-enumerably after `updateThread` returns. `viewer/app/routes.js:462` picks 200 or 202 from that symbol, and response bodies are unchanged. Test: `viewer/test/app-hub.test.js:2253-2262` checks 202 for a new addition and a new duplicate note, then 200 with the exact replay body, with the paragraph appended once. Before the fix it failed with `200 !== 202`.

Evidence:

```
node --test test/app-hub.test.js test/app-quiet.test.js test/app-questions.test.js test/card-receipt.test.js test/app-project-tools-card.test.js test/app-harnesses.test.js
# pass 178
# fail 0
```

On the worker's branch, the retry of `npm test` gave `# tests 835 / # pass 835 / # fail 0` (`reports/R1-1.md:379-382`). On the merged branch, the sub-lead's full run stalled in `app-usage.test.js` and `server.test.js` while other threads' suites were loading the machine. Run alone, those two files gave `# pass 83 / # fail 0`.
