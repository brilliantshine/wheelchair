---
slug: overlap-questions-solid
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Make overlap questions solid

## What we're building

A follow-up to the overlap questions built in PR #148 (plan: `docs/plans/overlap-questions/PLAN.md`, Deferred D1–D5). When two threads touch the same work, the lead already asks Collin with a card, but only in some situations. This closes five gaps so the lead asks when it should, does not ask what was already answered, and does not lose an answer.

## Why — the problem

- An overlap with a thread in **another project** only gets a one-line mention, never a card, so Collin's decision is not asked for or recorded.
- Something Collin **already said in chat** before the plan existed is asked again later as a card.
- If Collin answers an overlap card **by typing in chat** and the lead restarts before recording it, the new lead can miss the answer.
- A waiting overlap card is posted even when the **other thread has already finished**, asking about something no longer live.
- Once an overlap answer has been acted on, **later news** that changes what that answer means is only mentioned, never re-asked.

## What good looks like

- An overlap with a thread in another project, found while planning or before a small fix's edits, gets the same overlap card a same-project overlap gets.
- A clear decision Collin typed before the plan existed shows up in the plan's Decision Log and he is not asked it again.
- After a lead restart, a chat answer to an overlap card that was not yet recorded is picked up and acted on, and the card shows as answered.
- A waiting overlap card about a thread that has since finished is not posted; Collin sees a one-line mention instead.
- When news after an acted-on answer would change what that answer does, Collin gets one new card for it; news beside a still-open card never re-asks.

## Not doing

- Changing how overlaps are first found, or how leads message each other.
- Re-asking on small fixes.
- Any new screen or button in the app.

## Constraints

- Lead rules live in `protocol/app/lead.md`; existing overlap Decisions, Done markers and cards from PR #148 must keep working.
- Triage strictly: a worst case of one extra card or a repeated line is minor and never blocks a review round.
