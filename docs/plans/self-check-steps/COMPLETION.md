---
slug: self-check-steps
date: 2026-11-18
implemented-by: "T1 standard gpt-6.1-terra; T2 standard claude-sonnet-5-5; T3 standard claude-sonnet-5-5 (sub-lead: claude-opus-5-5)"
verified-by: []
---

# Completion Report — Check-it-yourself steps after Done

Written for a hostile reviewer: every claim checkable, no claim without evidence.

The plan's section "## Check steps for this thread" is not part of the Spec and is not
covered here.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `check` kind: lead-only, shown, not pinned | this run | `viewer/app/card.js:19` (shown), `:35` (roles), `:135-146` (fields); not in `SINGLETONS` (`viewer/app/cards.js`) | `viewer/test/app-check-card.test.js` "check schema…" |
| Field rules: head 40 lowercase hex; update ≤300; 1–6 steps; `where`, `do`/`see` ≤300, `command` only with machine ≤1000 multi-line, `agent` matched/not-tried/broken, `note` one line ≤300 required unless matched and forbidden with it; unknown fields refused | this run | `viewer/app/card.js:135-146`; card-level unknown fields via the generic check at `viewer/app/card.js:187` | `app-check-card.test.js` "check schema…" (each refusal incl. `differed`, 0/7 steps, over-length, non-lead) |
| Hub: current done card (latest, not retracted, after `imported.at`) | this run | `viewer/app/cards.js:51` `currentDone` | `app-check-card.test.js` "hub accepts only…" |
| Hub refusals: `post the done card first`, `check head must match the latest done card`, `this done card already has a check card`, under the thread lock, spooled path | this run | `viewer/app/cards.js:120-125` (inside `acceptCard`'s `updateThread`); `machine/service.js` unchanged (generic spool path, confirmed by T1 and the scout) | `app-check-card.test.js` "hub accepts only…" (no done, retracted done, pre-cutoff done, wrong head, match, duplicate, second done) |
| Press: only `fix`/`leave`; 400 no buttons; 400 nothing to fix; 422 newer version; 422 already answered; marks answered and enqueues `[card <id>] fix what the check found` / `leave it`; refused presses change nothing; other kinds unchanged | this run | `viewer/app/threads.js:322-335`, placed before the generic path; no other line of `press` changed | `app-check-card.test.js` "press checks…"; full node suite |
| Rendering: heading, update, ordered steps, "In the app"/"On the machine", `do`, command block with Copy (hidden without clipboard, "Copied" ~2 s, posts nothing), "You should see:", not-tried muted line, broken warning line, text never HTML | this run | `viewer/pages/thread.js:837-879`; styles `viewer/pages/thread.css:340-352` | `viewer/test/app-check-card.spec.js` tests 1, 2 |
| Fix it now / Leave it only with a broken step, hidden after a press or when the head is no longer current; no other buttons | this run | `viewer/pages/thread.js:869-876` | `app-check-card.spec.js` tests 1, 2, 3 |
| Phone width 390px, no horizontal page scroll; long command scrolls in its block | this run | `viewer/pages/thread.css:341-347` | `app-check-card.spec.js` test 4 (900-char command) |
| Handoff: `check` in `KINDS`; `historyText` format | this run | `viewer/app/handoff.js:5`, `:42` | `app-check-card.test.js` "handoff preserves…" (largest card, untruncated, validates) |
| `cards.md`: kinds row; two press forms | this run | `protocol/app/cards.md:45`, `:161` | `protocol-rules.test.js` |
| `cards-lead.md`: `### \`check\`` section (fields, rendering, refusals, presses) | this run | `protocol/app/cards-lead.md:139-168` | `protocol-rules.test.js` (`leadKinds` includes `check`, `viewer/test/protocol-rules.test.js`) |
| Where the steps are done (Decisions 2, 11) | this run | `protocol/app/lead.md:455-464` | grep below |
| Lead: Writing | this run | `protocol/app/lead.md:465-473` | grep below |
| Lead: Trying (ff-only, HEAD confirm, not-tried fallback, steps-only verifier, `--not-provider` when `both`, path map, COMMIT mismatch) | this run | `protocol/app/lead.md:474-487` | grep below |
| Lead: STEP lines into the card (incl. reworded re-try, less-favourable order, missing line) | this run | `protocol/app/lead.md:489-500` | grep below |
| Lead: failed tries, same `--attempt` re-run, two-try fallback, 30-minute rule | this run | `protocol/app/lead.md:503-510` | grep below |
| Lead: Posting, one per head, duplicate = posted, Fix it now (current-head re-check, step 9) / Leave it, stub not waiting | this run | `protocol/app/lead.md:512-521` | grep below |
| Lead: newer done supersedes a running steps verifier | this run | `protocol/app/lead.md:523-524` | grep below |
| Lead: Restart rules | this run | `protocol/app/lead.md:526-535`; pointer `:700-701` | grep below |
| Lead: Imported threads | this run | `protocol/app/lead.md:537`; pointer `:740` | grep below |
| Lead: First release `needs` stand-in | this run | `protocol/app/lead.md:539-550` | grep below |
| Pointers from all three done paths | this run | small fix `protocol/app/lead.md:122`; planned build `:401`; after-done fix `:442` | grep below |
| Verifier steps-only section (remit, isolation incl. `--state-dir` and 390×844, COULD NOT TRY, path-map swap, stand-in, staging, `update` not run, report format) | this run | `protocol/app/verifier.md:52-91` | grep below; `protocol-rules.test.js` |
| No change to sub-lead or worker protocols | this run | — | `git diff origin/main -- protocol/app/sub-lead.md protocol/app/worker.md` empty |

## Deviations from plan

None in behaviour. Wording/placement choices are logged in PLAN.md's Log (T1, T2, T3
choices). One sub-lead edit after T2: `verifier.md`'s steps-only lead-in now says it replaces
"How to check" above and the verdict forms in "The report" below, and a BLOCKED verdict keeps
its `REASON:` line (the worker's text said "The report below it" for both and dropped
`REASON:`).

## Routers

None — this change moved no ownership and no router named a file it touched in a way that
became untrue (new test files follow the existing `viewer/test/` pattern).

## Validation evidence

Feature tip `70e7bc688689ee8af2f064fe4f296a095228a422` (code identical at the commit this report is committed in).

`cd viewer && npm test` (clean run):

```
npm test exit 0
# tests 636
# pass 636
# fail 0
# duration_ms 42334.876651
```

Earlier runs on the same tree each had one unrelated flaky failure: `routes.test.js:284`
("server exited before ready: Refused to use a port held by a process it cannot identify"),
and `server.test.js` "the global write lock serializes concurrent writes…" (T1 saw it too).
The latter passed 5 of 5 isolated runs; neither file's code is touched by this change. One
run hung in `app-sudo.test.js` for 10 minutes and was stopped; the file then passed alone
(22/22).

`npx playwright test --reporter=list app-check-card.spec.js` on the feature tip:

```
  ✓  16 [firefox] › test/app-check-card.spec.js:115:5 › desktop › a very long command scrolls inside its block (659ms)

  16 passed (11.8s)
```

Full browser suite `npm --prefix viewer run test:browser`, run by me on T3's branch
(`ac8b393`, whose code is the feature tip's; only PLAN.md differs):

```
exit 0
  28 skipped
  782 passed (3.3m)
```

The browser spec starts its server through `startWorld` → `viewer/test/helpers/app.js:24`
with a temporary `stateDir`, and stubs `navigator.clipboard.writeText` with
`page.addInitScript` (Chromium and Firefox).

`grep -n -i "check" protocol/app/cards.md protocol/app/cards-lead.md protocol/app/lead.md protocol/app/verifier.md`:
91 lines, including `cards.md:45` (kind row), `cards.md:161` (press forms),
`cards-lead.md:139` (`### \`check\``), `lead.md:448` (`### 10. Check it yourself`),
`lead.md:401`, `:442`, `:700`, `:740` (pointers), `verifier.md:52` (`## Steps only`),
`verifier.md:85` (STEP report format).

`git diff --stat origin/main -- protocol/app/sub-lead.md protocol/app/worker.md`: prints
nothing.

## Known gaps / residual risks

- A check card that goes through the machine spool with a backlog gets `202 spooled` before
  the hub judges it; a later 422 (including the duplicate refusal) lands in `spool/rejected`
  instead of reaching the lead (`machine/service.js:973-985`, generic for every spooled kind).
  The Spec's "duplicate refusal = posted" therefore only shows to the lead on the direct path.
- The thread list's waiting count (`viewer/app/views.js:135`) and the aside's `waiting()`
  (`viewer/pages/aside.js:16`) do not count a check card with Fix it now / Leave it as
  waiting. The Spec does not ask for it.
- Flaky unrelated tests noted above.

## Remediation rounds

### Remediation 1 (after verification attempt 1 on `2344766`)

Gaps (gpt verifier; claude verifier passed) and fixes, see `REMEDIATION-1.md`:

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| Long path/code in `update` widens the page at 390px | update block gets `check-update`; wraps anywhere, inline code too | `viewer/pages/thread.js:839`, `viewer/pages/thread.css:343-344` | `app-check-card.spec.js` "a long path and code span in the update wrap…" |
| Page shows Fix it now / Leave it when the done card is at the import cutoff | page uses the hub's rule: not retracted and strictly after `imported.at` | `viewer/pages/thread.js:869-872` | `app-check-card.spec.js` "no buttons when the done card sits at the import cutoff…" |
| `note` accepts U+2028/U+2029 | one-line rule also refuses U+2028, U+2029, U+0085 | `viewer/app/card.js:145` | `app-check-card.test.js` "check schema…" (two new refused cases) |
| lead.md's session rules did not allow the steps-only verifier after a planned build | verifier bullet adds "or a steps-only one after any `done`, step 10" | `protocol/app/lead.md:68-69` | `protocol-rules.test.js`; grep |

Lanes: R1 standard claude-sonnet-5-5; R2 light gpt-6-luna; R3 light claude-haiku-5-5.

Validation on `786c0fa`:

```
npm test exit 0
# tests 636
# pass 636
# fail 0
```

```
npm --prefix viewer run test:browser: exit 0
  28 skipped
  790 passed (3.3m)
```
