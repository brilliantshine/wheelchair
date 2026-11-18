---
slug: mergeable-before-done
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Pull requests are mergeable before work is called done

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. Code map: `MAP.md` and `docs/maps/pr-finishing.md`.

## Open Questions

(none)

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
| 10 | No override: a refused `done` card leaves the thread open; the lead tells Collin with a `needs` card and retries | Collin picked "No override"; `done` is only a notice and the PR can be merged regardless | user |

## Spec

### Goal in one line

A `done` card is accepted only for a pull request that GitHub reports as merged, or as open,
free of conflicts and with every check passed. Agents are told to get it there themselves.

### Part A: the hub gate (code)

Where: `viewer/app/cards.js` `acceptCard`, plus a new helper module
`viewer/app/pr-gate.js` (one exported `async function checkDone(thread, prUrl)` returning
`{ ok: true }` or `{ ok: false, reason }`).

- Runs only for `kind === 'done'`, from both the direct relay and a spooled delivery (both
  arrive at `acceptCard` via `/api/machine/cards`).
- Runs **before** `hub.updateThread` so the thread lock is never held across a GitHub call.
  It reads the thread with `hub.thread(payload.thread_id)`. If `payload.delivery_id` is already
  in `thread.delivered_ids`, skip the gate (the existing duplicate path answers). Role and schema
  checks stay where they are; the gate may run first, since a non-lead `done` is refused anyway.
- `pr_url` must match `^https://github\.com/[^/\s]+/[^/\s]+/pull/\d+$` (same pattern as
  `pollMerged`, `viewer/app/threads.js:363`); otherwise refuse "the pull request link is not a
  GitHub pull request".
- Run `gh pr view <url> --json state,mergeable,headRefName,statusCheckRollup` with
  `execFile`, timeout 15000 ms, inheriting the hub environment as `pollMerged` does. Any spawn
  error, timeout, non-zero exit or unparsable output refuses "couldn't reach GitHub to check the
  pull request; try again in a minute" (append gh's first stderr line when present).
- Decision, in order:
  1. `state === 'MERGED'` → ok (D8). No other check.
  2. `state !== 'OPEN'` (e.g. `CLOSED`) → refuse "the pull request is closed".
  3. `thread.branch` set and `headRefName !== thread.branch` → refuse "that pull request is not
     this thread's branch (<headRefName>)". If `thread.branch` is unset, skip this check.
  4. `mergeable === 'CONFLICTING'` → refuse "the pull request conflicts with the default branch;
     merge it in and resolve the conflicts". `mergeable === 'UNKNOWN'` or missing → refuse
     "GitHub is still working out whether it can merge; try again in a minute".
  5. Checks from `statusCheckRollup` (empty or missing → passing, D3). A CheckRun entry
     (`__typename: 'CheckRun'`, fields `name`, `status`, `conclusion`) is pending while
     `status !== 'COMPLETED'`, passing when `conclusion` is `SUCCESS`, `NEUTRAL` or `SKIPPED`,
     failed otherwise. A StatusContext entry (`context`, `state`) is pending for `PENDING` or
     `EXPECTED`, passing for `SUCCESS`, failed otherwise. Any failed → refuse "checks failed:
     <names, comma-separated>". Else any pending → refuse "checks still running: <names>".
  6. Otherwise ok.
- On refusal: enqueue to the posting session (`payload.session`) the text
  `[wc:from app] your done card was refused: <reason>` with source `app`, via `hub.enqueue`
  (`viewer/app/hub.js:122`), then throw `appError(422, reason)`. The machine passes the 422 back
  to `card.js` on a direct relay, and moves a spooled card to rejected storage
  (`machine/service.js:911-923`); the queued message is how the lead learns in the spooled case
  (D7). If the session is unknown or the thread archived, skip the message and just throw.
- No caching: every `done` post re-asks GitHub.

### Part B: the protocol (text)

- `protocol/app/sub-lead.md`, "Finishing and verifying": a new step before writing COMPLETION.md:
  `wc.js git fetch`, then `wc.js git merge origin/<default branch>`; resolve conflicts (by
  itself or by a worker it starts), commit the resolution, and rerun the full validation. The
  verifier then checks the merged result (D1).
- `protocol/app/lead.md`:
  - A new short section "Making the pull request mergeable", used by steps 1, 8 and 9 after
    push/PR and before the `done` card: run `gh pr checks <url> --watch` (or poll
    `gh pr view --json mergeable,statusCheckRollup`) for up to 30 minutes (D4).
    - Green and mergeable: post `done`. If the app still refuses it, act on the reason.
    - Conflicts, or a failed check: fix it as an after-done fix (commit with `wc.js git commit`,
      a fresh verifier per step 9's provider rule, two attempts, then a `question` card: push as
      is, or drop), push, and watch again (D2). Conflicts are resolved with `wc.js git fetch` and
      `wc.js git merge origin/<default branch>`.
    - Still pending after 30 minutes, or GitHub unreachable: post a `needs` card saying what is
      waiting; keep trying and resolve the card when it clears (D4, D10).
    - "Push as is" on a failing check means the `done` card will be refused; say so in the
      question's consequence, and leave the thread open with the `needs` card (D10).
  - Step 1, step 8 item 2 and step 9 item 4 point to that section before posting `done`.
  - The `done` card is never posted to "try" the gate before checks finish.
- `protocol/app/cards-lead.md`, `done`: one paragraph saying the app refuses it unless GitHub
  reports the PR merged, or open with no conflicts and all checks passed, and that the refusal
  reason also arrives as a `[wc:from app]` message.
- `protocol/app/verifier.md`: no change.

### Edge cases

- Repo with no CI: empty rollup → passes.
- Main moves after `done`: not re-checked (D5).
- After-done fix that lands just as Collin merges: state `MERGED` → accepted (D8).
- Two `done` posts racing: each is gated independently; the existing pin/replace logic is unchanged.
- A check that GitHub retries (re-run) shows its latest run in the rollup; no special handling.

### Non-goals

- Agents never merge the pull request.
- No new CI checks; no change to `.github/workflows/`.
- No override for Collin (D10).
- No re-checking after `done`; `pollMerged` is unchanged.

### Validation

- New `viewer/test/app-done-gate.test.js`, stubbing `gh` on `PATH` as
  `viewer/test/app-merged.test.js:17-27` does. Cases: merged → accepted; open + mergeable +
  all passing → accepted; open + no checks → accepted; conflicting → 422 with conflict reason;
  unknown → 422 "still working out"; failed CheckRun → 422 naming it; failed StatusContext →
  422; pending → 422 "still running"; wrong head branch → 422; closed → 422; non-GitHub URL →
  422 without calling gh; gh exits non-zero → 422 "couldn't reach GitHub"; every refusal queues
  `[wc:from app] your done card was refused: ...` for the posting session; a duplicate
  `delivery_id` does not call gh.
- Existing tests that post `done` cards keep passing (give them a gh stub or a merged reply
  as needed).
- `viewer/test/protocol-rules.test.js`: assert lead.md, sub-lead.md and cards-lead.md mention
  the merge-in step and the gate.
- Commands: `node --test viewer/test/*.test.js`, `bash machine/test/run.sh`.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| On a direct relay the lead sees a refusal twice (card.js error and the app message) | Needed for the spooled case; harmless duplicate | planning |

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
