---
slug: overlap-questions-solid
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Make overlap questions solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

Follow-up to `docs/plans/overlap-questions/PLAN.md` (PR #148, merged), rows D1–D5 of its
Deferred table. Map: `MAP.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Chosen on the mode card | user |
| 2 | Keep all five deferred cases (D1–D5) | IDEA.md confirmed with all five | user |
| 3 | D1: overlap cards apply to threads in any project; how cross-project threads are found does not change (linked threads in the default list, a peer lead's message, or a thread the user names) | IDEA.md "Not doing": discovery unchanged | defaulted |
| 4 | D1: a listed thread with no `stage` (unlinked cross-project entry) counts as not finished | Listing cannot prove it finished; worst case is one extra card | defaulted |
| 5 | D2: at the first look after PLAN.md, a clear decision the user typed earlier about a thread now identified is logged as that thread's overlap Decision (source `user`, no card suffix) instead of asked; "clear" uses "Settling an answer" | Reuses the existing test of a clear answer | defaulted |
| 6 | D3: on restart, an open overlap card with a later user chat message in `recent_messages` that answers it is resolved with a note of that answer and acted on by "Settling an answer" | Same handling as a live chat answer | defaulted |
| 7 | D4: before posting a waiting overlap card, run `session leads`; if the thread is listed and finished (per "Overlap"), do not post: remove its Open Question with a `defaulted` overlap Decision (moot) and give a one-line mention. A thread not listed, or with no stage, gets its card. A follow-up card for a vague answer is always posted | Skips only provable cases; an extra card is minor | defaulted |
| 8 | Messages older than the restart context's last 20 are not recovered (D2, D3) | Needs a restart plus 20 later messages | defaulted |
| 9 | D5: re-ask an answered overlap only when that thread now takes on, or drops, the shared work the answer was about; other news gets a one-line mention | Picked on the re-ask question | user |

## Spec

All changes are to `protocol/app/lead.md`, sections
"Other leads on this machine" (line ~740), "Overlap questions" (~753) and "Restarting what
died" (~816), plus protocol tests in `viewer/test/protocol-rules.test.js`. No app code
changes: the hub already stores `about_thread` for any 12-hex thread id without a project
check (`viewer/app/cards.js:69`, `:168`).

1. **Any project (D1).** Replace "This project only" so overlap cards and `Overlap with`
   Open Questions apply to a thread in any project. Discovery rules ("Another project":
   `--all-projects` only when the user names a thread or project; messaging an unlinked
   project's lead needs a `reach` card first) are unchanged. A listed entry without
   `stage` counts as not finished.
2. **Earlier chat decision (D2).** At the first look after PLAN.md is created, for each
   overlap thread found, if a user message before PLAN.md clearly settles it (by "Settling
   an answer"), log it as that thread's overlap Decision, source `user`, no card suffix,
   and ask nothing. The "Before PLAN.md" rule keeps forbidding asking or recording before
   PLAN.md exists.
3. **Restart chat answer (D3).** In the restart overlap bullets: an open overlap card with
   no actionable answer, where a user message in `recent_messages` after the card's post
   answers it, is resolved with a one-line note of that answer, then handled by "Settling
   an answer" (Done marker etc.).
4. **Finished before posting (D4).** In "One question at a time": before posting a waiting
   overlap card (original, not a follow-up), run `session leads` (with `--all-projects` if
   the thread was found that way). Listed and finished per "Overlap": post nothing; log a
   `defaulted` overlap Decision ("moot: finished") in the commit that removes its Open
   Question, and mention it in one line of the next visible reply. Otherwise post it.
5. **Re-ask (D5).** Replace "Re-asks are not done" with: a thread that already has an
   overlap Decision (with or without a card suffix) is asked again only when news (a peer
   lead's message, or its `session leads` title or idea) shows that thread now takes on,
   or no longer does, the shared work that Decision was about. Inside the card window
   (feature only, status `planning`) this re-opens an `Overlap with` Open Question and posts
   a new overlap card with the same `about_thread`, waiting its turn like any overlap card;
   its answer is a new overlap Decision with its own Done marker, and the latest Decision
   wins. Outside the window it is a late-overlap line. Never re-ask from news while an
   overlap card for that thread is open ("New information while a card is open" stands),
   never on a small fix, and never for other news (one-line mention, as today).
6. **Non-goals.** No change to how overlaps are first found, how leads message each
   other, or any app screen or code. Existing overlap Decisions, Done markers and cards
   keep their meaning.
7. **Tests.** Extend `viewer/test/protocol-rules.test.js` with checks that "Overlap
   questions" no longer contains "This project only" and contains a stable phrase for each
   of items 1–5 (chosen by the implementer and asserted by the test). Validation: `node --test viewer/test/protocol-rules.test.js` and
   `npm test` from `viewer/` pass.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A pre-PLAN chat decision or unrecorded chat answer older than the restart context's last 20 messages is lost; the user is asked again | Needs a restart plus 20 later messages; worst case one extra card | planning |

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
