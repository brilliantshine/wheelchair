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
| 11 | Supersedes D1: the sub-lead does not merge main before verification; conflicts are found after the push and fixed by the lead's loop (D2), with a fresh verifier on the merge result | IDEA "Not doing" excludes changing how work is built before the push; D2 already meets "checked again before done" | review-round-1 |
| 12 | Supersedes D2's final step: before `done`, a fix that fails its check twice goes straight to a `needs` card, not the push-as-is/drop question | Neither answer lets `done` through the gate | review-round-1 |
| 13 | The gate checks identity (head branch `wc/<thread-id>`, base = thread's default branch) before the MERGED exception | A merged unrelated PR must not pass; the random thread id makes the branch name a sufficient binding | review-round-1 |
| 14 | Empty rollup passes only when the repo has no workflow files at the PR head; otherwise "no checks have started yet" | Empty can mean CI has not registered yet | review-round-1 |
| 15 | Checks are de-duplicated by workflow+name (or status context), latest run wins; 100+ entries refuse | Re-runs; gh reads only the first 100 | review-round-1 |
| 16 | `wc.js git commit` completes a merge in progress: add the paths, then commit without a pathspec | Git refuses a path-limited commit during a merge (`machine/service.js:993`) | review-round-1 |
| 17 | The lead watches with `gh pr view` every minute using the gate's rules, handling MERGED-while-watching by step 9's head comparison | `gh pr checks --watch` lacks mergeability and fails on no checks | review-round-1 |
| 18 | `status: done` stays committed before the push; a restarted lead resumes the watch when no `done` card was accepted | PR must carry the status; avoids a second push and CI run | review-round-1 |
| 19 | Gate runs outside the thread lock; a refusal re-reads under the lock before enqueueing; the machine's card relay waits 30 s | `hub.acceptCard` holds `withThread` (`viewer/app/hub.js:143`); machine relay times out at 5 s (`machine/service.js:183`) | review-round-1 |

## Spec

### Goal in one line

A `done` card is accepted only for a pull request that GitHub reports as merged, or as open,
free of conflicts and with every check passed. Agents are told to get it there themselves.

### Part A: the hub gate (code)

Where: `viewer/app/hub.js` `acceptCard` (line 143), `viewer/app/cards.js`, and a new module
`viewer/app/pr-gate.js` exporting `async function checkPr(thread, prUrl)` that returns
`{ ok: true }` or `{ ok: false, reason }`. The same decision function (`judgePr(view, thread)`,
pure, exported for tests) is what the lead's watch in Part B mirrors.

**Where it runs (locks).** `hub.acceptCard` today wraps `cards.acceptCard` in
`hub.withThread` (`viewer/app/hub.js:143`). For `payload.kind === 'done'` only, `hub.acceptCard`
first runs the gate **outside** `withThread`:
1. Read a snapshot with `hub.thread(payload.thread_id)` (read-only; never saved). If
   `payload.delivery_id` is in `delivered_ids`, skip the gate and go straight to the existing
   path (duplicate answer).
2. Run `checkPr(snapshot, payload.pr_url)`.
3. On ok: continue with the existing `withThread(… cards.acceptCard …)`, unchanged.
4. On refusal: inside `withThread`, re-read the thread with `hub.thread`; if it is not archived
   and the posting session exists in it, `hub.enqueue(thread, payload.session, text, 'app')`
   with `text = "[wc:from app] your done card was refused: <reason>"` (D7). Then throw
   `appError(422, reason)` (outside the lock is fine). Never save the pre-gate snapshot.

**Machine relay deadline.** The machine relays cards with `requestJson`'s 5-second default
(`machine/service.js:183,913,1289`). For the `cards` relay — both the direct relay at
`machine/service.js:1289` and the spool drain at `:913` — pass a 30-second timeout, so a gate
answer (gh timeout 15 s, below) arrives as the real 2xx/422, not a spooled 202. Other relays keep
5 s.

**The GitHub call.** `pr_url` must match `^https://github\.com/[^/\s]+/[^/\s]+/pull/\d+$` (as
`viewer/app/threads.js:363`); otherwise refuse "the pull request link is not a GitHub pull
request" without calling gh. Run
`gh pr view <url> --json state,mergeable,headRefName,baseRefName,headRefOid,statusCheckRollup`
with `execFile`, timeout 15000 ms, inheriting the hub's environment as `pollMerged` does.
- Spawn error, timeout, non-zero exit or unparsable output → refuse "couldn't reach GitHub to
  check the pull request; try again in a minute: <first stderr line>".
- Exception: stderr matching
  `/authentication|gh auth login|HTTP 401|HTTP 403|Could not resolve to a PullRequest|Could not resolve to a Repository/i`
  → refuse "the app's GitHub login can't read this pull request: <first stderr line>", so the
  lead tells Collin it is a credentials problem, not a wait.

**The decision (`judgePr`)**, in order:
1. Identity, before anything else (D13): if `thread.branch` is set and `headRefName !==
   thread.branch` → refuse "that pull request is not this thread's (its branch is
   <headRefName>)". If `thread.default_branch` is set and `baseRefName !== thread.default_branch`
   → refuse "that pull request targets <baseRefName>, not <default_branch>". Unset fields skip
   their check. The thread id in `wc/<thread-id>` is random, so the branch name binds the PR to
   this thread without comparing repositories.
2. `state === 'MERGED'` → ok (D8).
3. `state !== 'OPEN'` → refuse "the pull request is closed".
4. `mergeable === 'CONFLICTING'` → refuse "the pull request conflicts with <base>; merge it in
   and resolve the conflicts". `UNKNOWN`, missing or anything else not `MERGEABLE` → refuse
   "GitHub is still working out whether it can merge; try again in a minute".
5. Checks (D14, D15). Let `entries = statusCheckRollup || []`.
   - If `entries.length >= 100` → refuse "too many checks to read reliably (100 or more)"
     (gh fetches only the first 100).
   - De-duplicate: a CheckRun's key is `workflowName + '/' + name` (`name` alone when
     `workflowName` is empty); a StatusContext's key is `context`. Per key keep the entry with
     the latest `startedAt` (CheckRun) or `startedAt`/`createdAt` (StatusContext), so a failed run
     followed by a successful re-run counts as the re-run.
   - CheckRun: pending while `status !== 'COMPLETED'`; passing when `conclusion` is `SUCCESS`,
     `NEUTRAL` or `SKIPPED`; failed otherwise. StatusContext: pending for `PENDING`/`EXPECTED`;
     passing for `SUCCESS`; failed otherwise.
   - Any failed → refuse "checks failed: <keys, comma-separated>". Else any pending → refuse
     "checks still running: <keys>".
   - **No entries** (D14): passes only when the repository has no GitHub Actions workflows.
     The gate asks `gh api repos/<owner>/<repo>/contents/.github/workflows?ref=<headRefOid>`
     (same timeout and error mapping as above; HTTP 404 means none). Any `.yml`/`.yaml` file there
     → refuse "no checks have started yet on the latest commit; try again in a minute". None → ok.
6. Otherwise ok.

No caching: every `done` post asks GitHub again.

**Finishing a conflicted merge (machine, D16).** `wc.js git commit` cannot complete a merge
today: the machine runs `git commit -m <msg> -- <paths>` (`machine/service.js:993`), and git
refuses a path-limited commit during a merge. Change: when `<worktree>/.git`'s `MERGE_HEAD`
exists (resolve with `git rev-parse --git-path MERGE_HEAD`, since a worktree's `.git` is a
file), run `git add -- <paths>` as now, then `git commit -m <msg>` **without** a pathspec, so the
merge's own staged changes and the resolved paths are committed together. Git still refuses
while unmerged paths remain; that refusal is returned as today. Outside a merge, behaviour is
unchanged.

### Part B: the protocol (text)

- `protocol/app/sub-lead.md`: no change (D11). Conflicts are found and resolved after the push.
- `protocol/app/lead.md`:
  - A new short section "Making the pull request mergeable", used by steps 1, 8 and 9 after
    push/PR and before the `done` card (D17):
    - Every minute, for up to 30 minutes (D4), run
      `gh pr view <url> --json state,mergeable,headRefName,baseRefName,headRefOid,statusCheckRollup`
      and read it by the same rules as the app's gate (Part A, "The decision"). Do not use
      `gh pr checks --watch` (it reports no mergeability and fails on no checks).
    - All rules pass: post `done`. If the app still refuses it, act on the reason.
    - `MERGED` while watching: Collin merged it. If `headRefOid` equals the commit you pushed,
      post `done`; otherwise follow step 9's "the fix missed" rule (a `stub` with the fix's commits).
    - Conflicts, or a failed check: fix it as an after-done fix (commit with `wc.js git commit`,
      a fresh verifier per step 9's provider rule), push, and watch again (D2). Conflicts are
      resolved with `wc.js git fetch`, `wc.js git merge origin/<default branch>`, editing the
      conflicted files, and `wc.js git commit --paths <resolved files>` (which now completes the
      merge, D16); the merge commit goes to the verifier like any fix. If a fix fails its check
      twice, post the `needs` card below (D12).
  - Step 1, step 8 item 2 and step 9 item 4 point to that section before posting `done`.
  - The `done` card is never posted to "try" the gate before checks finish.
- `protocol/app/cards-lead.md`, `done`: one paragraph saying the app refuses it unless GitHub
  reports the PR merged, or open with no conflicts and all checks passed, and that the refusal
  reason also arrives as a `[wc:from app]` message.
- Status while waiting (D18): step 8 still commits `status: done` before the push, so the
  feature list shows the thread as Done while the lead waits; the open `needs` card (when there
  is one) puts it under "Needs you". A restarted lead that finds `status: done` and no accepted
  `done` card for the current PR resumes this section's watch.
- `protocol/app/verifier.md`: no change.
- The verifier briefed after a conflict merge gets the merged commit and the plan's Spec, as
  step 9 already does.

### Edge cases

- Repo with no CI: empty rollup and no workflow files → passes (D14).
- Repo with workflows that never run on pull requests: empty rollup forever → refused; accepted
  risk (see Accepted Risks).
- Main moves after `done`: not re-checked (D5).
- After-done fix that lands just as Collin merges: state `MERGED` → accepted (D8).
- Two `done` posts racing: each is gated independently; the existing pin/replace logic is unchanged.
- A re-run check: de-duplicated by key, latest run wins (D15).

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
  `delivery_id` does not call gh. Also: merged PR with another thread's branch → refused (identity
  first); wrong base → refused; empty rollup with a workflow file → refused "no checks have
  started"; empty rollup, workflows 404 → accepted; failed CheckRun followed by a later
  successful run of the same key → accepted; 100 entries → refused; auth stderr → credentials
  reason; the gate holds no thread lock while gh runs (a slow gh stub does not block another
  card on the same thread).
- `machine/test/service.test.js`: a card relay whose hub answers 422 after 6 seconds returns
  422 to the agent (not a spooled 202); a spooled card drained against a slow refusing hub is
  moved to rejected storage. `wc.js git commit` during a conflicted merge, after resolving,
  completes the merge commit; with unmerged paths left, it is refused.
- Existing tests that post `done` cards keep passing (give them a gh stub or a merged reply
  as needed).
- `viewer/test/protocol-rules.test.js`: assert lead.md and cards-lead.md mention
  the merge-in step and the gate.
- Commands: `node --test viewer/test/*.test.js`, `bash machine/test/run.sh`.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| On a direct relay the lead sees a refusal twice (card.js error and the app message) | Needed for the spooled case; harmless duplicate | planning |
| A repo whose workflows never run on pull requests can never pass the gate (empty rollup, workflow files present) | Rare; the lead's `needs` card tells Collin, who can merge the PR regardless | 1 |
| The feature list shows Done while the lead waits for checks | `status: done` must be committed before the push so the PR carries it; a needs card covers the stuck case | 1 |

## Review Rounds

### Round 1 — 2026-11-17

**Lanes:** intent lens (provider per start); mechanics lens (other family); cross-family: yes.

**Changed since the last round:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Sub-lead merge-in (D1) breaks IDEA non-goal | upheld | D11: dropped; lead's loop handles conflicts |
| intent | minor | Hub gh credentials may not read the repo; no override makes it permanent | upheld | Distinct credentials refusal reason in Part A |
| intent | minor | Push-as-is/drop question useless before done | upheld | D12: straight to needs card |
| intent | minor | Head-branch check (D9) beyond IDEA | declined | Without it a done card could point at any green PR and pass the gate; one comparison, already-read field |
| mechanics | blocking | Empty rollup may mean CI not registered yet | upheld | D14 |
| mechanics | blocking | GitHub call still inside `withThread`; refusal enqueue on stale snapshot | upheld | D19, Part A "Where it runs" |
| mechanics | blocking | Machine relay 5 s timeout turns slow gate into spooled 202 | upheld | D19, 30 s card relay |
| mechanics | blocking | `wc.js git commit` cannot finish a conflicted merge | upheld | D16; confirmed `machine/service.js:993` |
| mechanics | blocking | MERGED accepted before identity; base not bound | upheld | D13; repository binding not added: `wc/<thread-id>` is random per thread |
| mechanics | blocking | Rollup limited to 100 contexts | downgraded → minor | One check in this repo; fixed anyway with a 100+ refusal (D15) |
| mechanics | major | Lead's watch commands can't drive the decisions; MERGED while waiting | upheld | D17 |
| mechanics | major | Re-runs may appear as duplicates | upheld | D15 |
| mechanics | major | `status: done` shows Done while gate pending | downgraded → minor | Display only; needs card covers stuck case; restart signal defined (D18); accepted risk |
| mechanics | major | "Drop" procedure wrong for already-pushed commits | declined | D12 removed the push-as-is/drop question before done; fixes are verified before push, as in step 9 |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

### Round 2 — 2026-11-17

**Lanes:** intent lens (provider per start); mechanics lens (other family); cross-family: yes.

**Changed since the last round:**
- D1 dropped (D11): no sub-lead change; conflicts handled after push by the lead.
- D12: two failed fixes before done go to a `needs` card, no push-as-is/drop question.
- Part A rewritten: gate outside the thread lock, refusal re-read under lock (D19); machine card relay 30 s (D19); identity before MERGED, base check (D13); empty-rollup rule via workflow files (D14); de-dup and 100-entry limit (D15); credentials reason.
- D16: `wc.js git commit` completes a merge in progress (machine change).
- Part B: lead watch via `gh pr view` every minute with MERGED-while-watching handling (D17); status while waiting and restart signal (D18).
- Validation list extended (gate cases, machine relay timing, merge commit).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
