---
slug: mergeable-before-done
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Pull requests are mergeable before work is called done

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. Code map: `MAP.md` and `docs/maps/pr-finishing.md`.

## Open Questions

### Q2: When the gate refuses because GitHub is down or a check is flaky, can Collin override?
- **Context:** The `done` card is a notice carrying the PR link; the PR exists and Collin can
  merge it whatever the card says. An override needs the hub to verify Collin really pressed
  something (a new card-reference field), which is new mechanism.
- **Options:** (a) no override: the lead keeps the thread open, tells Collin with a `needs`
  card, and retries; (b) a question card "mark done anyway" whose press lets one `done`
  card through, labelled as overridden.
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | A `done` card spooled during a hub outage is acked to the agent, then a later 4xx goes to rejected storage (`machine/service.js:883-888,911-923`) | How a gate refusal reaches the lead in that case | no | Settled: Decision 7 |
| 2 | After-done fix on an already-merged PR still posts `done` (`protocol/app/lead.md:354-357`) | Gate must not refuse that case | no | Settled: Decision 8 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | In a feature build, the sub-lead fetches and merges `origin/<default branch>` into the thread branch, resolving conflicts, before its final verification, so the verifier checks the merged result | The builder knows the code best; conflicts surface before verification instead of after | defaulted |
| 2 | After pushing, the lead waits for the PR's checks. A conflict or failing check found then is fixed by the lead like an after-done fix: commit, fresh verifier, two attempts, then a `question` card to Collin (push as is, or drop) | Reuses the existing after-done fix loop (`protocol/app/lead.md:333-359`) rather than inventing a new one | defaulted |
| 3 | A PR with no checks configured counts as passing checks | Repos without CI must still be able to finish | defaulted |
| 4 | If checks have not finished after 30 minutes (the workflow's job timeout, `.github/workflows/macos.yml`), the lead posts a `needs` card instead of waiting silently | IDEA constraint: GitHub slow or down must not leave a thread silently stuck | defaulted |
| 5 | Main moving on after `done` is not chased; mergeability is checked at the moment of `done` | Otherwise a thread never ends; the merged notice and after-done flow already cover later work | defaulted |
| 6 | The app enforces it: the hub refuses a `done` card unless GitHub reports the PR free of conflicts with passing checks; the protocol rule stays as well | Collin: agents must do this "to be able to mark its work done"; only the app can guarantee it | user |
| 7 | Whenever the hub refuses a `done` card on the gate, it also sends the posting lead a `[wc:from app]` message with the reason, so a card refused after sitting in the machine spool is not lost silently | A spooled card is acked 202 and a later refusal only moves it to rejected storage (`machine/service.js:883-888,911-923`) | defaulted |
| 8 | A PR whose state is `MERGED` passes the gate | The after-done flow posts `done` for a fix that landed in a merge race (`protocol/app/lead.md:354-357`); conflicts and checks no longer matter once merged | defaulted |
| 9 | The gate also checks the `pr_url` is this thread's PR (head branch `wc/<thread-id>`), and that `mergeable` is known: GitHub's `UNKNOWN` (still computing) refuses with "try again in a minute" | Prevents a done card pointing at someone else's green PR; `UNKNOWN` is transient | defaulted |

## Spec

### Behaviour

- **Protocol (lead.md, sub-lead.md):** before its final verification the sub-lead fetches and
  merges `origin/<default branch>` into the thread branch and resolves conflicts (D1). After
  pushing and opening the PR, the lead waits for the PR's checks (up to 30 minutes, D4) and
  confirms no conflicts; a failure is fixed by the lead's after-done fix loop (D2). Applies
  to small fixes (step 1), feature done (step 8) and after-done fixes (step 9).
- **App gate (D6):** the hub accepts a `done` card only when GitHub reports, for `pr_url`:
  state `MERGED` (D8); or state `OPEN`, head branch `wc/<thread-id>` (D9), `mergeable`
  `MERGEABLE`, and every check on the head commit finished and passing, or no checks at all
  (D3). Anything else is refused with a plain reason the lead can act on (which check failed,
  "conflicts with main", "GitHub is still computing, try again in a minute", "couldn't reach
  GitHub"). A refusal also reaches the lead as a `[wc:from app]` message (D7).

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
