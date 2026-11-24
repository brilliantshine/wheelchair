---
slug: fix-others-prs
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-23
---

# Fix other people's pull requests

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.


## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode two-part | Collin's pick on the mode card | user |
| 2 | Collin's OK is given once per pull request per thread, through a dedicated card the app records (target PR link, head branch, head repo), not a plain question card | The done gate and auto-merge must know the target PR; a recorded card is what the app can read | defaulted |
| 3 | Pushes to another person's PR are plain (non-force) pushes; on rejection: fetch, merge, re-verify, push again | Never overwrites the author's work (IDEA) | defaulted |
| 4 | The thread never opens its own PR when it is fixing someone else's; its done card points at the target PR | IDEA: no replacement PR | defaulted |
| 5 | The thread does not post reviews or comments on GitHub; review findings stay in the thread | Keeps scope to fixing; can be added later | defaulted |
| 6 | A thread takes on someone else's PR when Collin names it in chat ("fix PR #173"); no new start screen. A picker is deferred | Collin's pick; matches how Junjie's thread worked | user |
| 7 | The app never auto-merges a PR the thread did not open; the done card says it is fixed and ready, and Collin or the author merges | Collin's pick: it is the author's PR and they may still be working | user |
| 8 | Only a thread on the small-fix path, with no plan or commits of its own yet, may take on someone else's PR | A plan's documents and unrelated commits would otherwise be pushed into the author's PR | defaulted |
| 9 | No mockup designer: the only visible part is one card shaped like the existing reach card | Trivial visible change | defaulted |
| 10 | The OK card is a new `permit` kind, refused for closed PRs, forks, this thread's own branch and any branch of another thread record on this hub | The hub can check these itself; the lead checks `session leads` too | defaulted |

## Spec

### What changes, in one paragraph

A thread can take on an existing open pull request that someone else opened (a "target
PR") when Collin names it in chat. The lead works on it as a small fix in its own
worktree. Before the first push it posts a new `permit` card. Once Collin presses Allow,
the hub records the target on the thread. The lead then pushes with a plain (never
forced) push to the target PR's head branch, opens no PR of its own, and finishes with a
`done` card pointing at the target PR. The done gate accepts that PR. Auto-merge never
merges it and never deletes its branch.

### 1. The `permit` card (new, lead-only, shown)

Fields (all required): `pr_url` (a `https://github.com/<owner>/<repo>/pull/<n>` link) and
`why` (one line, the user's terms). Nothing else is accepted (`viewer/app/card.js`
`fields`, `roles`, `shown`; retractable while open, like `reach`, `card.js:277`).

On post, the hub (`viewer/app/cards.js`, beside the `reach` checks at :163) runs
`gh pr view <pr_url> --json number,title,state,author,headRefName,baseRefName,isCrossRepository`
and refuses (422) in this order:
1. `the pull request link is not a GitHub pull request` (same regex as `viewer/app/pr-gate.js:32`).
2. `couldn't reach GitHub to check the pull request; try again in a minute`, or `the app's GitHub login can't read this pull request: <first stderr line>` (same split as `pr-gate.js:36-42`).
3. `that pull request is closed` (state not `OPEN`).
4. `that pull request comes from a fork; pushing to forks isn't supported yet` (`isCrossRepository` true).
5. `that is this thread's own branch` (`headRefName` equals `thread.branch`).
6. `that branch belongs to the thread "<title>" on this hub` (`headRefName` equals the `branch` of any other thread record that is not archived).
7. `this thread already works on <target pr_url>` (`thread.target_pr` is set and its url differs).
8. `a permit request is already open` (an unanswered, unretracted `permit` card exists).

A permit for the same url as an existing `thread.target_pr` is accepted (it just asks again).
The hub copies onto the stored card: `pr_number`, `pr_title`, `pr_author` (login), `head_branch`, `base_branch`.

Shown (`viewer/pages/thread.js`, modelled on the reach card at :981-998): "Let this thread push its fix to **<pr_author>**'s pull request #<pr_number>: <pr_title>?", the `why`, the head branch in small text, and two buttons **Allow** and **Don't allow**. One answer only, like `reach` (:796). An open permit card counts in "Needs you" (`viewer/app/views.js:142`).

Press handling (`viewer/app/threads.js`, beside reach at :330): on `allow`, re-run check 6 against current thread records; if it now fails, mark `allow_failed` and send `[card <id>] allow failed: <reason>`. Otherwise set `thread.target_pr = { url, number, head_branch, base_branch, title, author, card, allowed_at }`, save, and send `[card <id>] picked: allow`. On `don't allow` send `[card <id>] picked: don't allow` and change nothing else. Messages go to the latest live lead exactly as reach does.

Document the kind in `protocol/app/cards-lead.md` (`### permit`, fields, refusals, presses) and add it to the kinds table in `protocol/app/cards.md`.

### 2. Done gate (`viewer/app/pr-gate.js` `judgePr`)

When `thread.target_pr` is set and the done card's `pr_url` equals `thread.target_pr.url`
(compare exactly after trimming a trailing `/`), check `view.headRefName` against
`target_pr.head_branch` and `view.baseRefName` against `target_pr.base_branch` instead of
`thread.branch` and `thread.default_branch`. Every other rule is unchanged. A done card
pointing at any other PR is judged exactly as today.

### 3. Auto-merge (`viewer/app/auto-merge.js`)

When the current done card's `pr_url` equals `thread.target_pr.url`, `afterCheck` does
nothing: no merge, no "Not merged automatically" notice, no branch deletion. The
`merged` card from `pollMerged` (`threads.js:466-495`) still appears when someone merges it.

### 4. Lead protocol (`protocol/app/lead.md`)

Add a section "Fixing someone else's pull request" and change the line at :515 to:
"No thread pushes to another thread's branch, except a target PR's branch as in 'Fixing
someone else's pull request'." The section says:

- **When:** Collin names an open PR (number or link) that this thread did not open and
  asks for it to be reviewed or fixed. Only on the small-fix path: before the thread has
  a plan directory or commits of its own. If the work would need a plan, say so and
  offer a stub instead. If the thread already has commits or a plan, say it must be a new
  thread and offer a stub naming the PR.
- **Look first:** `gh pr view <n> --json state,headRefName,baseRefName,isCrossRepository,author,title`.
  Closed, a fork, or a branch belonging to a thread in `session leads` (any `branch`
  match): say so plainly and offer the old way (a replacement PR from this thread's own
  branch, as a normal small fix). Make no permit card.
- **Bring it in:** `wc.js git fetch origin <head branch>` then `wc.js git merge origin/<head branch>`.
  The thread's own branch now contains the PR. Review and fix as a small fix: commits,
  progress line and verifier exactly as step 1, the verifier briefed with the PR's
  purpose (its title and description) and Collin's request.
- **Ask:** post the `permit` card before the first push (it may be posted as soon as the
  PR is chosen). On `don't allow` or `allow failed`, offer the replacement PR in a
  `question` card. Once allowed, the target holds for the life of the thread; after a
  restart the allowed `permit` card in the context names it.
- **Push:** `wc.js git push origin HEAD:<head branch>`. Never `--force`, `--force-with-lease`
  or `+` refspecs, and never `wc.js git pr`. A rejected push (the author pushed): `wc.js
  git fetch origin <head branch>`, merge `origin/<head branch>`, re-verify unless it was a
  fast-forward, push again.
- **Finish:** follow "Making the pull request mergeable" with the target: `<head branch>`
  in place of `wc/<thread-id>` everywhere (pushes, `origin/...` reads, fetches), the target
  PR's URL as the PR. The `done` card's `pr_url` is the target PR; its `note` says it
  is ready for Collin or the author to merge and will not merge itself. `verified` follows
  the usual rule.
- **After done (step 9):** fixes go to the same head branch the same way. Stubs from such
  a thread name the target PR and its branch in the summary.

### Not changed

A thread's own PR, the push to `wc/<thread-id>`, `wc.js` and the machine service
(they already pass push arguments through), new-thread creation, fork PRs, GitHub
comments or reviews.

### Validation

```bash
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

New or extended tests must cover:
- `viewer/test/app-permit.test.js` (new): each refusal 1-8 with a stubbed `gh`; accepted card stores the copied fields; Allow sets `thread.target_pr`; Allow after a conflicting thread appears gives `allow failed`; Don't allow leaves `target_pr` unset; retract while open; second press refused.
- `viewer/test/app-done-gate.test.js`: a done card for the target PR passes with the target's head and base; a done card for another PR with a non-thread head is still refused.
- `viewer/test/app-auto-merge.test.js`: a target-PR done card with a passing check triggers no merge, no notice and no branch deletion.
- `viewer/test/app-permit.spec.js` (new, Playwright): the card renders the author, number, title and both buttons, and pressing Allow shows it answered.
- `viewer/test/protocol-rules.test.js` passes with the new `### permit` section.

## Deferred

Optional; present only in the lighter modes.

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Fixing pull requests that come from a fork | Collaborators push branches to this repo (PR #173 did); forks need the author's "allow edits by maintainers" and pushing to their repo | planning | Query `maintainerCanModify` and `headRepository`; push to the fork URL; until then the thread says it can't push and offers a replacement PR |
| D3 | A "Start from a pull request" picker on the new-thread screen | Naming the PR in chat works for normal use | planning | `viewer/pages/new.js:229-241`, `machine/service.js:668-713` create threads from main today |
| D2 | The machine itself refusing pushes to branches the thread has no OK for | Today's own-branch rule is also only a protocol rule; the recorded OK makes this possible later | planning | `machine/service.js:1588-1613` passes push args through; check refspec against own branch or recorded target |

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-23

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
|           | pre-existing / partial | | high / low |

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
