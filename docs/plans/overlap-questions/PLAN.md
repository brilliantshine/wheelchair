---
slug: overlap-questions
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-20
---

# Asking about overlapping threads

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Background: split from lead-chat (`docs/plans/lead-chat/PLAN.md` on main, Decisions 19-24,
Review Rounds 4-6). Map: `MAP.md`, `docs/maps/overlap-decision-flow.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | User's pick | user |
| 2 | Every new overlap becomes a `question` card; the one-line mention in a reply is no longer the way to raise it | IDEA.md "What good looks like" bullet 1 | defaulted |
| 3 | An overlap learned before IDEA.md is confirmed is held and asked as the first question after confirmation; a restarted lead finds it again by looking at other leads once on restart | IDEA.md bullet 2; no plan file exists yet to hold it | defaulted |
| 4 | A change answered during a running review is logged at once as `Pending change: <card id>`, applied after triage, marked `Applied change: <card id>`, and listed in the next round's "Changed since"; a round with a pending change is not clean and counts it as one found item | Mirrors the existing `Pending pull-back:` rule; gives a zero-finding round a `fixing` state | defaulted |
| 5 | During a build, the answer acts at once without writing to the worktree (a follow-up `stub` card, or nothing); the running build never changes | The sub-lead owns the worktree; a stub card is itself durable, so nothing is pending | defaulted |
| 6 | The machine's delivery id becomes the card's id, so `card.js` can print the id even when the card is queued while the app is offline | The machine already gives every card a random UUID delivery id before queuing (`machine/service.js:1323`, `:2055`); no second round trip | defaulted |
| 7 | `card.js` prints `{"id","kind"}` (plus `"queued":true` when queued) for kinds that make a stored card, and `{"ok":true}` for `title`, `resolve`, `retract`; never card text | Settled in lead-chat round 4-5 | defaulted |
| 8 | During a build the overlap card offers no way to stop it: "Let it finish" or "Let it finish, then start a follow-up thread"; to stop, the user archives the thread | User's pick (card 84bc0114); archiving already stops every session with a confirmation | user |

## Spec

### Terms

- **Overlap:** another thread (from `wc.js session leads`, a peer lead's message, or the user)
  whose work touches the same files or behaviour as this thread's.
- **New overlap:** one this lead has not yet put to its user as an overlap `question` card,
  and not recorded in this thread's Decision Log or Log.
- **Overlap card:** a `question` card whose `question` starts with the other thread's title and
  "is also working on". Its answer is stored on the card (`answered_value`, `viewer/app/threads.js:419`).

### 1. Asking (protocol/app/lead.md, "Other leads on this machine")

Replace the "Leads inform; your user decides" bullet's last two sentences and the "When to
look" (b) clause's question wording with these rules. The other bullets stay as they are.

- A new overlap always becomes an overlap card; never only a line in a reply. Options depend on
  the stage (below). It obeys the one-question-at-a-time rule: it waits behind any open
  `question` card of yours, and is asked next.
- The card's `fits` names the other thread; `consequence` says what each answer does to this
  thread in plain words.
- **Small fix, before edits:** the look before the edits that finds a new overlap posts the
  card and makes no edit until it is answered. Options: "Go ahead with the fix" and "Leave it
  to <other thread>" (no edits; the lead says so and the thread stays open for the user).
  Learned after edits but before `done`: options "Carry on" and "Drop the fix" (the fix's
  commits are reverted with `wc.js git revert`; nothing is pushed).
- **Feature, before IDEA.md is confirmed:** hold it; ask it as the first question after
  confirmation, before any design question.
- **Planning (status `planning`):** as today's (b): an Open Question in PLAN.md, asked as an
  overlap card; status stays `planning` until settled. This now applies to every new overlap in
  planning, not only one found at (b).
- **Review running (status `ready-for-review`):** post the card at once. Options: "Keep the plan
  as it is" and "Change it: <what>" (one option per sensible change, up to four). An answer that
  keeps the plan is logged in the Decision Log (source `user`, naming the card id). An answer
  that changes the plan: commit `Pending change: <card id> <one line>` to the Log at once,
  finish triage against the briefed plan, then fold the change into the Spec with a Decision
  Log entry (source `user`, card id), commit `Applied change: <card id>` with it, and add it to
  the next round's "Changed since" list. A round with an unapplied pending change, or an
  unanswered overlap card, is not clean. Progress: a pending change counts as one found item
  (so a round with no counted findings posts `phase: fixing`, `found: 1`), and as fixed once
  applied. While the card waits, `choice_waiting: true`.
- **Approved, not yet building:** an answer that changes the plan retracts the approval card
  (its id is the one `card.js` printed, or in the restart context), sets `status:
  ready-for-review`, and returns to step 5 with the change in the next round's list. If the
  retract is refused because Start building was accepted, handle the answer as during a build.
  An open overlap card does not block Start building; once building starts it is answered
  under the build rules.
- **Building (Start building accepted until `done`):** the running build never changes and the
  lead writes nothing to the worktree. Options: "Let it finish" and "Let it finish, then start a
  follow-up thread" (the lead posts a `stub` card at once with `depends_on_parent: true`,
  naming the other thread and what to reconcile). No stop option: to stop a build, the user archives the thread (Decision 8).
- **Done (step 9):** options "Leave it" and "Start a thread about it" (a `stub` card).
- A peer's message that only reports information still gets no reply (Replies bullet
  unchanged).

### 2. Restart (protocol/app/lead.md, "Restarting what died")

- On `[wc:context restart]`, before acting on anything else in a planned thread: apply every
  `Pending change: <card id>` Log line with no matching `Applied change: <card id>` line. If
  reviewers are running, stop them, apply, and restart the round under the same number (as for
  pending pull-backs); otherwise apply before approval or the next round.
- An answered overlap card in the context whose card id is in neither the Decision Log nor a
  `Pending change:` line: act on its `answered_value` as if the press had just arrived.
  During a build, act on it only if no `stub` card created after the answer names that thread.
- An open overlap card stays open; it is not re-asked.
- Run `wc.js session leads` once; treat any overlap not covered by an overlap card or a
  Decision Log entry as new.

### 3. Card ids (machine, hub, card.js)

- `machine/service.js` card post: unchanged spooling. Every card payload already carries a
  `delivery_id` UUID. The 202 spooled response becomes `{ ok: true, spooled: true, id:
  <delivery_id> }` for kinds that create a stored card.
- `viewer/app/cards.js` `addCard`: when the payload's `delivery_id` is a UUID not already used
  as a card id in this thread, use it as the card's `id`; otherwise `crypto.randomUUID()` as
  today. A duplicate delivery receipt includes `id` (the delivery id).
- `viewer/app/card.js` on success prints exactly one JSON line: `{"id":"<id>","kind":"<kind>"}`
  for kinds that create a stored card, with `"queued":true` added when the machine spooled it;
  `{"ok":true}` for `title`, `resolve`, `retract`. Never any other field of the card.
- A retract of a card still queued is queued behind it (the spool keeps order), so it works.
- `protocol/app/cards.md` ("Posting a card") documents the output; `cards-lead.md` `retract`
  says the id comes from `card.js`'s output or the restart context.

### Non-goals

No change to how leads list or message each other; no lead-to-lead negotiation; no automatic
merging of branches; no sub-lead or worker rule changes.

### Validation

- `node --test viewer/test/*.test.js` passes, with new tests: delivery id becomes the card id;
  a reused or non-UUID delivery id falls back to a random id; `card.js` prints `{id,kind}`,
  `{id,kind,queued}` and `{ok}`, and never a text field.
- `bash machine/test/run.sh` passes, with a test that the spooled response carries `id` equal to
  the delivery id, and that the drained card's hub id equals it.
- `grep -n "Pending change:" protocol/app/lead.md` shows the review and restart rules.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-20

**Lanes:** pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
