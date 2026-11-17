---
slug: retract-cards
date: 2026-11-17
implemented-by: "standard / gpt-6.1-terra (T1, T2, T3); sub-lead claude-opus-5-5 (small test and doc additions)"
verified-by: []
---

# Completion Report — Retract cards that no longer apply

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
numbers are at commit c91824f on `wc/1416046edf72`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 `retract` kind: fields `card`, `note`; lead only; not shown | this run | viewer/app/card.js:38, :133 | app-hub.test.js:2021 (validate refuses worker role and a two-line note); :2081 (a sub-lead's retract refused at the hub) |
| §1 `retractable` with refusals in order: no such card (missing/replaced), wrong kind, system needs, already answered (sudo exempt) | this run | viewer/app/card.js:207-216 | app-hub.test.js:2021 (each reason, plus another thread's card → 422) |
| §2 retract branch in `acceptCard` under the thread lock; 422 on refusal; `delivery_id` recorded; nothing queued | this run | viewer/app/cards.js:78-94 | app-hub.test.js:2021 (no lead submits after four retractions) |
| §2 `retractCard` sets `answered`, `retracted_by`, `retracted_note`, `retracted_at` | this run | viewer/app/cards.js:43-48 | app-hub.test.js:2021; app-sudo.test.js:365 |
| §2 pinned target unpinned on retraction | this run | viewer/app/cards.js:91 | app-hub.test.js:2021 (offer, approval absent from `pinned`); :2056 |
| §2 sudo: only while waiting; cancel through `hub.client.sudoCancel`; throw/invalid → 422 couldn't reach; declined → state + retract in-transaction with no save/enqueue/applySudoState; running/ran/etc → 422 already <state>, card untouched | this run | viewer/app/cards.js:82-89 | app-sudo.test.js:365 (resolves under a 3 s timeout, cancel called once, no lead message); :377 (running, ran, 503, invalid status → 422 and card still waiting) |
| §2 later `declined` outcome on a retracted card is a no-op; later outcome after a refused retraction applies with the normal lead message | this run (existing `applySudoState` ranking) | viewer/app/cards.js `applySudoState` (unchanged) | app-sudo.test.js:365 (`changed: false`, nothing heard); :377 (`ran` → lead hears "sudo ran: exit 0") |
| §2 offer limit: second offer allowed after a retracted first; third refused | this run | viewer/app/cards.js:104 | app-hub.test.js:2021 (second 202, third 422); :2081 |
| §3 any press on a retracted card → 422 `this card was withdrawn`, before every per-kind branch | this run | viewer/app/threads.js:273 | app-hub.test.js:2021 (picked, answered, keep-going, talk, recheck, start-building on question, offer, approval, needs); app-sudo.test.js:365 (decline, talk) |
| §4 approval pinned on post; older open approval marked `replaced`; answered/retracted ones left alone | this run | viewer/app/cards.js:27-31 | app-hub.test.js:2056 |
| §4 pin removed on accepted Start building; kept on Re-check, Talk and a refused start | this run | viewer/app/threads.js:333 | app-hub.test.js:2056 |
| §4 `addNeeds` skips `replaced` cards | this run | viewer/app/views.js:124 | app-hub.test.js:2056 (superseded approval absent from Needs you, before and after the newer one is answered) |
| §4 retracted cards never marked `replaced` by a new offer or approval | this run | viewer/app/cards.js:23, :28 | app-hub.test.js:2056 (approval), :2081 (offer stays in the chat payload, not replaced) |
| §5 retracted card is off, dimmed (0.6) and tagged "Withdrawn · <note>", ahead of every other answered label | this run | viewer/pages/thread.js:460-464, :517-519; viewer/pages/thread.css:136 | app-threads.spec.js:610 (question, offer, approval: tag, opacity 0.6, no enabled controls) |
| §5 approval Start building, Re-check and Talk disabled when retracted | this run | viewer/pages/thread.js:606, :612, :615 | app-threads.spec.js:610 (Re-check, Talk); :638 (Start building on a ready approval) |
| §5 sudo retracted: no Open to run, Decline or Talk; Withdrawn instead of Declined | this run | viewer/pages/thread.js:772-773 | app-sudo.spec.js:32 |
| §5 conversation filtered by current pin id, not kind; chat and pinned sync keys follow and include `retracted_at` | this run | viewer/pages/thread.js:281-284, :295, :933, :937 | app-threads.spec.js:610 (retracted offer and approval appear in #chat after leaving the pin) |
| §5 pinned strip includes approval (offer, idea, approval, progress); label "Plan approved: needs you" | this run | viewer/pages/thread.js:8, :831, renderPinned | app-threads.spec.js:610 (approval in #pinned with that label, gone after retraction) |
| §5 `aside.js` needs no change (lists filter on `!answered`) | this run (confirmed, no edit) | viewer/pages/aside.js:16, :98 | read by T2 and by the scout; retracted cards carry `answered: true` |
| §6 cards.md: `retract` in kinds table, its section (fields, refusals, sudo, vs resolve), approval pinned and when it unpins, offer note | this run | protocol/app/cards.md:314 (section); kinds table, `approval` and `offer` sections | read |
| §6 lead.md: retract guidance in "How you talk to Collin" incl. restart; step 6 talk-instead-of-building; sudo retraction | this run | protocol/app/lead.md:46-49, :276-278, sudo section | read |
| §6 API.md and viewer/AGENTS.md updated | this run | viewer/app/API.md:22, :60-66, :74; viewer/AGENTS.md:17 | read |

## Deviations from plan

- The lead.md retract bullet (protocol/app/lead.md:46-49) leaves out "he talks instead of
  pressing" from the Spec's trigger, so it reads slightly broader. The meaning is
  unchanged: the card applies when the conversation has moved on. Logged as a T3 choice.
- A `retract` note with a line break is refused by `card.js` validation (viewer/app/card.js:133),
  enforcing the Spec's "one line". Logged as a T1 choice.
- Otherwise none. Every worker choice is in PLAN.md's Log.

## Routers

- `viewer/AGENTS.md`: the `app/cards.js`, `card.js` row now says it handles hidden
  `resolve` and `retract` cards.
- `viewer/app/API.md`: the press route documents the `this card was withdrawn` refusal, a
  paragraph describes `retract` and the approval pin, and the sudo paragraph notes that a
  retraction bypasses `applySudoState`.
- No ownership moved, and no other router names a file this change touched.

## Validation evidence

Run on the merged feature branch at c91824f, from the worktree root, with `viewer/node_modules`
installed by `npm --prefix viewer ci` (worktrees have none).

`npm --prefix viewer run test:browser` (Chromium and Firefox):

```text
  ✓  556 [firefox] › test/app-accounts.spec.js:549:3 › lead waiting line › hidden when the lead is fine or the limit has passed (2.1s)
  2 skipped
  658 passed (2.9m)
```

`node --test viewer/test/*.test.js` (unquoted glob):

```text
not ok 346 - a starter that loses the freed port registers through the new holder
# tests 479
# pass 478
# fail 1
```

The one failure is pre-existing. The same test fails identically on a clean `git archive`
of `main` (30c53a6), and neither `viewer/server.js` nor `viewer/test/lifecycle.test.js`
changed on this branch.

`bash machine/test/run.sh`:

```text
# tests 114
# pass 114
# fail 0
```

## Known gaps / residual risks

- The helper's own run page shows a retracted sudo request as "Declined", not "Withdrawn".
  This is an Accepted Risk in PLAN.md; the root-owned helper is unchanged.
- A refused retraction that was spooled while the hub was down does not reach the lead.
  This is an existing limit shared with `resolve`, and a Spec non-goal.
- `lifecycle.test.js` "a starter that loses the freed port registers through the new
  holder" fails on `main` too. It is out of scope here.
- `viewer/test/run.spec.js:225` (the graph viewer) failed once in one full browser run and
  passed on two isolated re-runs and the next full run. It is flaky and outside this feature.
- Browser tests set retracted state directly in the thread data rather than through a posted
  `retract` card, because the page and hub were built in parallel. The hub path is covered
  end to end by the node tests.

## Remediation rounds

_None yet._
