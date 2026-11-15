---
slug: agents-screen
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Agents screen with named leads

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: When a lead dies and is restarted, does the new lead keep the old one's name?
- **Context:** A restart creates a new session (`lead-2`) and keeps the old one's record
  and children (`viewer/app/threads.js:118-153`). Children's `started_by` stays the dead
  lead.
- **Options:** (a) The name belongs to the thread: the replacement is still Alpha, and the
  dead lead's children show under it. (b) Each lead session gets its own name: the
  replacement is Beta, and Alpha shows as ended with its children.
- **Recommendation:** (a). Collin thinks of "the lead of this thread"; a restart is a
  repair, not a new person, and the Threads link must land on whoever is in charge now.

### Q2: Where does the names list live?
- **Context:** Hub settings are `settings.json` in the hub state directory, editable on
  the Settings page; unknown fields are dropped (`viewer/app/settings.js:171-196`).
  Model pins already live in a separate plain file, `~/.wheelchair/models`.
- **Options:** (a) A field in the hub settings, editable as a text box on the Settings
  page. (b) A plain file, one name per line, e.g. `~/.wheelchair/lead-names`, edited by
  hand.
- **Recommendation:** (a). It is editable from a phone and uses the existing validated
  settings path.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Names are given to leads only; a stub thread has no name until its lead starts. | Collin's words. | user |
| 2 | Name choice: the first name in the list (Greek alphabet by default, Alpha…Omega) not held by any thread with a live lead. When every name is held, add a number (`Alpha 2`). Names are reused once a thread's lead has ended. | Keeps names short and distinct among what is running now; history does not exhaust the list. | defaulted |
| 3 | "Waiting on a subagent" is derived, not reported: an agent whose turn has ended and that has live children it started which have not yet sent their `result` shows "Waiting on: <child role(s)>". | No field records it today (MAP.md); the result routing already knows parent and child, so derivation needs no change to agents' protocol. | defaulted |
| 4 | The hub records the model it resolved on each session record, next to effort, so cards can show it. | The machine stores effort but not model (`machine/service.js:301-308`); the page already tries to show `session.model`. | defaulted |
| 5 | The Sessions page is removed; its nav entry becomes Agents, and `sessions` page URLs redirect to Agents. The terminal page's back link goes to Agents. | IDEA.md: Agents replaces Sessions. | defaulted |
| 6 | The Agents screen shows live agents. Ended agents are hidden, except a lead's family keeps its ended lead row dimmed while any of its children are live. A Threads row whose lead has ended still shows the name, without a link. | Matches what the Sessions page shows today; avoids a growing list of dead sessions. | defaulted |

## Spec

(Grows as decisions land.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
