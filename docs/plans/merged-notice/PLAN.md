---
slug: merged-notice
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-16
---

# Merged notice with archive button

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: Does the merged card ask for Collin's attention, or sit quietly in the thread?
- **Context:** cards that wait on Collin (question, needs, approval) count under "Needs you" and badge the thread in the Threads list (`viewer/app/views.js:122-130`). A merged card that counts there needs a way to clear it without archiving.
- **Options:** (a) counts under "Needs you" until archived or dismissed with a "Keep it" button; (b) quiet card, no badge.
- **Recommendation:** (a): the point is that he hears about the merge without opening every thread.

### Q2: Does the card's Archive button archive at once, or ask to confirm?
- **Context:** the page's Archive expands to Confirm archive / Cancel with "Stops its sessions and removes the worktree." (`viewer/pages/thread.js:159-164`).
- **Options:** (a) same two-step confirm; (b) one press.
- **Recommendation:** (a): archive stops sessions and removes the worktree, and the card sits in the chat where a stray tap is easy.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | The hub checks GitHub itself, every minute, beside the existing waiting-stub poll (`viewer/app/hub.js:40-74`), by running `gh pr view <pr_url> --json state` on the hub. | A full PR URL needs no project folder, so it works whatever machine the thread ran on; the hub already depends on its own `gh` for stubs (`viewer/app/threads.js:334-355`). | defaulted |
| 2 | Checked threads: not archived, with a `done` card carrying a `pr_url`, and not yet marked merged. The newest `done` card's URL is the thread's PR (same rule as `viewer/app/chat.js:256`). Small fixes, features and stubs alike. | Every thread that ends in a PR should get the notice. | defaulted |
| 3 | One card per thread: the thread records that its merge was noticed; later `done` cards for the same PR never post a second one. | IDEA: "each merge produces one card". | defaulted |
| 4 | A failed `gh` call (missing, logged out, offline) leaves the thread unchecked until the next minute; no card and no error card. | Same behavior as the stub poll; an error card every minute would be noise. Recorded as an accepted risk. | defaulted |
| 5 | The lead is not told about the merge. | The lead already checks `gh pr view` itself before acting after done (`protocol/app/lead.md` step 9). | defaulted |

## Spec

(Grows as decisions land.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| If the hub's `gh` is missing or logged out, merges are never noticed and nothing says why. | Matches the existing stub poll; the hub's `gh` is already assumed. | planning |

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
