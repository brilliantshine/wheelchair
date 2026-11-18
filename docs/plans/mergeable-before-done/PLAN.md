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
| 20 | Gate and lead judge readiness by GitHub's `mergeStateStatus`, not by re-implementing check rules; supersedes D9's `mergeable` use and D15 | Round 2: test-merge-commit checks, re-run de-dup and same-name collisions are GitHub's to resolve; the lead's rules stay short | review-round-2 |
| 21 | Supersedes D14: empty checks pass only on positive evidence of zero active workflows (`actions/workflows`); any error refuses | A 404 can mean no access, not absence | review-round-2 |
| 22 | `done` carries a required `head` (pushed commit); the gate refuses when the PR's head differs, merged or not | Closes the merge race where a different head was merged | review-round-2 |
| 23 | Supersedes D19's details: snapshot via `hub.state.thread`; refusal rechecks `delivered_ids` under the lock; gh 8 s per call, card relay 45 s | `hub.thread` can save; concurrent spool drain; two gh calls | review-round-2 |
| 24 | Supersedes D17: the lead waits with one foreground poll command (≤10 min each) on `state`/`mergeStateStatus`/failed checks, and posts `done`; the gate is the only judge; transient refusals stay in the window | Intent round 2: the lead can't mirror the gate's rules | review-round-2 |
| 25 | A repair's verifier is briefed with Collin's request (small fix) or the plan's Spec, plus what the repair changed | Small fixes have no plan | review-round-2 |
| 26 | Supersedes D12: two failed repair attempts (verifier fail or still red/conflicting after push), an ended 30-minute window, or a credentials refusal → `needs` card; Keep going resets | Every path ends in a card, never silent | review-round-2 |
| 27 | Supersedes D18's restart signal: waiting = pushed branch tip differs from the latest accepted `done` card's `head` | Works for small fixes and after-done pushes | review-round-2 |
| 28 | `BLOCKED` with every check passed is accepted; with any check not passed, refused | IDEA asks for no conflicts and passing checks; a required review is Collin's to clear | review-round-3 |
| 29 | One gate evaluation per `delivery_id` at a time; a concurrent duplicate awaits it | Both orderings of a direct relay racing a spool drain | review-round-3 |
| 30 | Spool drain marks `from_spool`; an accepted spooled `done` sends the lead an "accepted" message; `card.js` prints the response body | The lead must tell accepted from pending | review-round-3 |
| 31 | Workflow listing uses `--paginate` | Active workflow on a later page | review-round-3 |
| 32 | `head` is the remote branch tip read after a successful push, never local `HEAD` | A restart after an unpushed commit must not submit it | review-round-3 |
| 33 | The lead decides a check failed only from `gh pr checks --json name,bucket` showing `fail`/`cancel`; gh errors and empty lists never start a repair | `gh pr checks` exit 1 also means no checks or an API error | review-round-3 |
| 34 | Closed while waiting → step 9's CLOSED rule; head changed while open → step 9's updated-branch merge, re-verify, new window | Every exit of the wait has a next step | review-round-3 |
| 35 | Supersedes D27: restart checks local unpushed commits first, then PR state; CLOSED, missed-merge with an existing stub, and legacy `done` without `head` are not waiting | Avoid re-posting `done` or duplicate stubs | review-round-3 |
| 36 | Lighter enforcement: the app asks GitHub once whether this thread's PR at the pushed commit is merged or ready to merge; rare cases become accepted risks | Collin picked "Lighter enforcement" after four review rounds of gate edge cases | user |
| 37 | `done` cards are never spooled: the machine relays directly (30 s) and answers 503 "try again" when the hub is unreachable or other cards are queued. Supersedes D7, D19's relay part, D23's message part, D29, D30 | Removes delivery tracking; the lead retries inside its window | user (via D36) |
| 38 | Supersedes D24/D33/D34: the lead's section as written in the Spec (poll `gh pr view` incl. `statusCheckRollup`; no `gh pr checks --json`, absent in gh 2.46.0) | Simpler; works with the installed gh | user (via D36) |
| 39 | Supersedes D14/D21: no workflow probe; the lead waits 5 minutes after a push before treating "no checks" as ready | Keeps the gate to one call | user (via D36) |
| 40 | Someone else's push to the branch is merged, re-verified and pushed without counting toward the budget or resetting the window | Bounded by the window | review-round-4 |
| 41 | Supersedes D35: restart resumes the wait when finishing and no `done` card names the PR head; unaccounted local commits go to Collin as a question, an unfinished merge is aborted | Simple, never pushes unknown work | user (via D36) |

## Spec

### Goal in one line

A `done` card is accepted only for this thread's pull request, at the commit the lead pushed,
when GitHub says it is merged or ready to merge. Agents are told to get it there themselves.
This is the lighter enforcement Collin chose (D36): one question to GitHub, no queuing of
`done` cards, rare cases written down as accepted risks rather than handled in code.

### GitHub's merge state

`gh pr view <url> --json mergeStateStatus` (works in the installed gh 2.46.0) gives GitHub's own
judgement for an open PR:

| `mergeStateStatus` | Meaning here |
|---|---|
| `CLEAN`, `HAS_HOOKS` | Ready: no conflicts, checks passing |
| `DIRTY` | Conflicts with the base branch: repair |
| `BEHIND` | Base moved and the repo requires up-to-date branches: merge base in (a repair) |
| `UNSTABLE` | Some check pending or failed: wait, or repair a failure |
| `BLOCKED` | A branch rule blocks it. Ready if no check is pending or failed (the block is then a rule only Collin clears, such as a required review) |
| `UNKNOWN`, `DRAFT`, other | Not ready yet: wait |

A **check** is an entry of `statusCheckRollup`. It is *failed* when it is a CheckRun with
`status === 'COMPLETED'` and `conclusion` not in `SUCCESS`, `NEUTRAL`, `SKIPPED`, or a
StatusContext with `state` `FAILURE` or `ERROR`; *pending* when a CheckRun's `status` is not
`COMPLETED` or a StatusContext's `state` is `PENDING` or `EXPECTED`; otherwise *passed*.

### Part A: code

**1. `done` card field (D22).** `head`: required, the full commit id the lead pushed
(`/^[0-9a-f]{40}$/`). Add to `card.js`'s `done` schema (`viewer/app/card.js:116-122`).

**2. `done` cards are never queued (D37).** In the machine's card handler
(`machine/service.js:1272-1305`), for `input.kind === 'done'` only:
- If other cards are waiting in the spool, try `drainSpool('cards')` first (as now). If any
  remain, answer 503 `{ error: "the app is unreachable; the done card was not recorded; try again in a minute" }`.
- Relay directly without writing a spool file, with a 30-second timeout (`requestJson`'s 5th
  argument; default is 5 s, `machine/service.js:183`). 2xx and 4xx pass through as today. A 5xx,
  timeout or connection error answers 503 with the same message. No `hub_url` configured: same 503.
- Other card kinds are unchanged.
`card.js` already turns a non-2xx into a non-zero exit with the body (`viewer/app/card.js:267-269`),
so the lead sees the refusal directly. No `[wc:from app]` messages are sent (supersedes D7).

**3. The gate (hub).** New `viewer/app/pr-gate.js` exporting `async function checkPr(thread, card)`
→ `{ ok: true }` or `{ ok: false, reason }`, and a pure `judgePr(view, thread, card)` for tests.
In `hub.acceptCard` (`viewer/app/hub.js:143`), for `payload.kind === 'done'` only, run the gate
**before** `withThread`, on a snapshot from `hub.state.thread(payload.thread_id)` (a pure read,
`viewer/app/state.js:107`; never `hub.thread()`, which may save). Never save the snapshot. On ok,
continue with the existing `withThread(… cards.acceptCard …)`. On refusal, throw
`appError(422, reason)`; nothing else changes.

The decision, in order:
1. `pr_url` must match `^https://github\.com/[^/\s]+/[^/\s]+/pull/\d+$`; else refuse "the pull
   request link is not a GitHub pull request" (no gh call).
2. One call: `gh pr view <url> --json state,mergeStateStatus,headRefName,baseRefName,headRefOid,statusCheckRollup`,
   `execFile`, 15-second timeout, the hub's own environment (as `pollMerged`,
   `viewer/app/threads.js:372`). Stderr matching
   `/authentication|gh auth login|HTTP 401|HTTP 403|HTTP 404|Could not resolve to/i` → refuse
   "the app's GitHub login can't read this pull request: <first stderr line>". Any other error,
   timeout or unparsable output → refuse "couldn't reach GitHub to check the pull request; try
   again in a minute".
3. Identity (D13, D22): `thread.branch` set and `headRefName !== thread.branch` → refuse "that
   pull request is not this thread's (its branch is <headRefName>)"; `thread.default_branch` set
   and `baseRefName !== thread.default_branch` → refuse "that pull request targets <baseRefName>";
   `headRefOid !== card.head` → refuse "the pull request is at <first 7 of headRefOid>, not
   <first 7 of head>".
4. `state === 'MERGED'` → ok (D8). `state !== 'OPEN'` → refuse "the pull request is closed".
5. `CLEAN` or `HAS_HOOKS` → ok. `BLOCKED` with no failed or pending check → ok (D28).
6. Otherwise refuse with: `DIRTY` "the pull request conflicts with <base>"; `BEHIND` "<base> moved
   on and must be merged in"; `UNSTABLE` or `BLOCKED` "checks not passed yet: <up to five
   'name: failed|running' items>"; anything else "GitHub is still working out whether it can
   merge; try again in a minute".

No caching. No workflow probe (supersedes D14/D21; see Accepted Risks).

**4. Finishing a conflicted merge (D16).** `wc.js git commit` runs `git commit -m <msg> --
<paths>` (`machine/service.js:993`), which git refuses during a merge. Change: if
`git rev-parse -q --verify MERGE_HEAD` succeeds in the worktree, run `git add -- <paths>` as now,
then `git commit -m <msg>` with no pathspec. Git still refuses while unmerged paths remain;
outside a merge, unchanged.

### Part B: protocol text

- `protocol/app/sub-lead.md`, `protocol/app/verifier.md`: no change (D11).
- `protocol/app/cards-lead.md`, `done`: add `head` to the table, and one paragraph: the app
  accepts the card only when GitHub says this thread's PR, at `head`, is merged or ready to
  merge; otherwise `card.js` fails with the reason; a `done` card is never queued, so "the app
  is unreachable" means try again.
- `protocol/app/lead.md`: steps 1, 8 (item 2) and 9 (item 4) send the lead to a new section,
  "Making the pull request mergeable", before posting `done`. Its content (D38):
  1. **The pushed commit** is `git rev-parse origin/wc/<thread-id>` read right after a
     successful `wc.js git push`; it is the `head` of the `done` card.
  2. **Wait.** Run one foreground shell command that polls
     `gh pr view <url> --json state,mergeStateStatus,headRefOid,statusCheckRollup` every 60
     seconds and stops on any of: `state` not `OPEN`; `headRefOid` not the pushed commit;
     `mergeStateStatus` `CLEAN`, `HAS_HOOKS`, `DIRTY` or `BEHIND`; a failed check; `BLOCKED` with no
     failed or pending check; 10 minutes. (Failed and pending as defined in the Spec table;
     include the definitions in lead.md.) A gh error inside the loop is ignored. Repeat while the
     30-minute window from the push lasts (D4).
  3. **Ready:** if there are no checks at all and less than 5 minutes have passed since the push,
     keep waiting (CI may not have started; D39). Then post `done` with `head`. If `card.js` fails
     with a "try again" reason, wait 2 minutes and go back to 2 within the same window; with
     another reason, act on it below.
  4. **Merged:** at the pushed commit → post `done`. At another commit → step 9's "the fix
     missed" rule (a `stub` with the fix's own commits); no `done`.
  5. **Closed:** step 9's `CLOSED` rule: say so, change nothing.
  6. **Head changed while open** (someone pushed to the branch): `wc.js git fetch`,
     `wc.js git merge origin/wc/<thread-id>`, re-verify as in 7, push, back to 2 in the same
     window. It does not count toward the budget (D40).
  7. **Repair.** Conflicts or behind: `wc.js git fetch`, `wc.js git merge origin/<default
     branch>`, edit the conflicted files, `wc.js git commit --paths <resolved files>` (completes the
     merge). A failed check: `gh run view <run id> --log-failed`, fix the cause, `wc.js git commit`.
     Then a fresh verifier on the new commit by step 9's provider rule, briefed with Collin's
     request (small fix: no plan) or the plan's Spec, plus what the repair changed (D25). On a
     pass, push and go back to 2 with a new window.
  8. **Budget (D26).** A repair that fails its verifier, or whose push still ends in a failed
     check or a conflict, is one failed attempt. After two, or when a window ends without "ready",
     or on a "GitHub login can't read" refusal, post a `needs` card saying what blocks `done` and
     that he can merge the PR himself regardless. "Keep going" resets the budget with a new window.
     Resolve the `needs` card once `done` is accepted.
  9. **After a restart** (D41, supersedes D27/D35): if the thread is finishing (a PR exists for
     the branch, and the plan's `status` is `done` or there is no plan) and no `done` card names
     the PR's current head: look at `git status`; abort an unfinished merge
     (`wc.js git merge --abort`); do not push local commits you cannot account for, ask Collin with
     a `question` card instead. Then resume at 2 with a new window. A latest `done` card with no
     `head` (from before this change) means not waiting.
- Step 8 still commits `status: done` before the push, so the PR carries it.

### Edge cases

- Repo without CI: no checks; `CLEAN` → accepted after the lead's 5-minute wait (D39).
- Repo requiring a review: `BLOCKED` with checks passed → accepted (D28).
- Main moves after `done`: not re-checked (D5).
- Collin merges while the lead waits: accepted if merged at the pushed commit (D8, D22).
- Hub down when `done` is posted: `card.js` fails with "try again"; the window and the `needs`
  card bound the wait.

### Non-goals

- Agents never merge the pull request. No new CI checks. No override (D10).
- No re-checking after `done`; `pollMerged` unchanged.
- No queuing, delivery tracking or acceptance messages for `done` cards.

### Validation

- New `viewer/test/app-done-gate.test.js`, stubbing `gh` on `PATH` as
  `viewer/test/app-merged.test.js:17-27`. Cases: merged at `head` → accepted; merged at another
  commit → refused; `CLEAN` → accepted; `HAS_HOOKS` → accepted; `BLOCKED` all passed → accepted;
  `BLOCKED` with a pending check → refused; `DIRTY`, `BEHIND`, `UNSTABLE` (reason names the failed
  check), `UNKNOWN` → refused with their reasons; wrong branch, wrong base, closed → refused;
  non-GitHub URL → refused without calling gh; gh non-zero exit → "couldn't reach GitHub"; auth
  stderr → login reason; a slow gh stub (3 s) does not block another card on the same thread; a
  refused card leaves the thread file unchanged.
- Card schema test: `done` without `head`, or with a non-40-hex `head`, is refused.
- `machine/test/service.test.js`: a `done` card with the hub down returns 503 "try again" and
  leaves no spool file; a `done` card while other cards are spooled and the hub stays down → 503;
  a `done` whose hub answers 422 after 6 seconds returns 422; other kinds still spool. `wc.js git
  commit` during a conflicted merge, after resolving, completes the merge; with unmerged paths
  left, refused.
- Existing tests that post `done` cards keep passing (add `head` and a gh stub as needed).
- `viewer/test/protocol-rules.test.js`: lead.md has "Making the pull request mergeable" and steps
  1, 8 and 9 refer to it; cards-lead.md's `done` lists `head`.
- Commands: `node --test viewer/test/*.test.js`, `bash machine/test/run.sh`.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| `done` accepted before CI has registered any check (`CLEAN`, empty rollup) | The lead waits 5 minutes after a push first; lighter enforcement (D36) | 4 |
| `BLOCKED` with a required check that has not reported yet can be accepted | Rare; lighter enforcement | 4 |
| A `done` accepted whose response was lost, then re-posted, appears twice | Harmless notice duplicate | 4 |
| A thread with a `done` card from before this change, given an after-done fix, isn't recognised as waiting after a restart | Transitional | 3 |
| CI that reports only on GitHub's test merge commit is invisible to the rollup | GitHub Actions reports on the head commit | 3 |
| A repo whose workflows never pass on PRs can never reach `done` | `needs` card covers it; Collin can merge regardless | 1 |
| The feature list shows Done while the lead waits for checks | `status: done` is committed before the push so the PR carries it | 1 |

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
| intent | major | Lead can't mirror the gate's rules; simpler: gate is sole judge | upheld | D20, D24 |
| intent | minor | Protocol test wording refers to dropped merge-in step | upheld | Validation reworded |
| intent | minor | No cap on retries after gate refusals | upheld | D24, D26 |
| intent | minor | How the lead waits between polls unspecified | upheld | D24 (foreground poll command) |
| mechanics | blocking | `hub.thread()` may save the snapshot | upheld | D23; confirmed `viewer/app/hub.js:87` |
| mechanics | blocking | Concurrent delivery can produce a false refusal | upheld | D23 |
| mechanics | major | Two gh calls exceed 30 s relay | upheld | D23 |
| mechanics | blocking | Workflow 404 may be no-access, passing the gate | upheld | D21 |
| mechanics | blocking | Rollup misses test-merge-commit and expected checks | upheld | D20 |
| mechanics | blocking | De-dup key hides failures | upheld | D20 removes de-dup |
| mechanics | blocking | `needs` procedure and attempt counting missing | upheld | D26 |
| mechanics | blocking | Hub accepts a merge of a different head | upheld | D22 |
| mechanics | major | Restart can't identify a pending watch | upheld | D27 |
| mechanics | major | Repair verifier brief assumes a plan | upheld | D25 |

### Round 3 — 2026-11-17

**Lanes:** intent lens (provider per start); mechanics lens (other family); cross-family: yes.

**Changed since the last round:**
- One signal (D20): gate and lead use GitHub's `mergeStateStatus`; rollup de-dup and the 100 limit are gone.
- Empty checks (D21): positive evidence of zero active workflows.
- `done` gets a required `head` (D22); identity (branch, base, head) checked before merged.
- Gate mechanics (D23): pure snapshot read, duplicate recheck under lock, 8 s gh calls, 45 s card relay.
- Lead section rewritten (D24-D27): foreground poll, gate as sole judge, repair verifier brief, attempt budget and `needs` card, restart signal.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | `BLOCKED` covers rules only Collin can clear (reviews, conversations); stricter than IDEA | upheld | D28 |
| intent | major | Restart signal treats merged-missed, closed and legacy-done threads as waiting | upheld | D35 |
| intent | minor | PR closed while waiting has no next step | upheld | D34 |
| mechanics | blocking | Checks only on test merge commit invisible to rollup | downgraded → minor | Actions `pull_request` runs report on the head commit; only third-party CI posting to the merge commit hits this |
| mechanics | blocking | Workflow listing reads only the first page | downgraded → minor | Needs >30 workflows; fixed anyway (D31) |
| mechanics | blocking | Spooled `done` returns 202; lead can't tell accepted from pending | upheld | D30 |
| mechanics | blocking | Concurrent deliveries: refusal-first ordering still double-handles | upheld | D29 |
| mechanics | blocking | `gh pr checks` exit 1 also means no checks / API error | upheld | D33 |
| mechanics | blocking | Restart may submit an unpushed local repair as `head` | upheld | D32 |
| mechanics | major | Legacy `done` cards without `head` look pending on restart | upheld | D35 |
| mechanics | major | PR head changes or closes during the wait: no next step | upheld | D34 |

**Budget:** three triaged rounds without a clean one; stopped for Collin (needs card). Collin: "Keep going" — budget reset.

### Round 4 — 2026-11-17

**Lanes:** intent lens (provider per start); mechanics lens (other family); cross-family: yes.

**Changed since the last round:**
- D28: `BLOCKED` accepted when all checks passed.
- D29: one gate evaluation per delivery id; D30: spooled `done` gets an accepted message, `card.js` prints the body, drain marks `from_spool`.
- D31: paginated workflow listing.
- Lead section rewritten (items 1-8): pushed commit from the remote tip (D32); failed-check detection via `gh pr checks --json bucket` (D33); closed / head-changed exits (D34); restart rules (D35).
- Three new Accepted Risks (round 3).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Machine could refuse to spool `done` instead of D29/D30 machinery | user-decision | Part of the simplification fork put to Collin |
| intent | minor | No re-post interval after "try again" refusals | upheld | moot under D36-D41 |
| intent | minor | Collin's own pushes re-verified without budget | upheld | moot under D36-D41 |
| mechanics | blocking | Installed gh 2.46.0 has no `gh pr checks --json` | upheld | confirmed locally; pending fork |
| mechanics | blocking | `BLOCKED` may hide a required check with no rollup entry | upheld | moot under D36-D41 |
| mechanics | blocking | Review-required repo with no checks: gate accepts, lead never posts | upheld | moot under D36-D41 |
| mechanics | blocking | Lost direct-relay response → drain sees duplicate, no accepted message | upheld | moot under D36-D41 |
| mechanics | blocking | Spooled wait can't both receive messages and keep its deadline | upheld | moot under D36-D41 |
| mechanics | blocking | Restart may push unfinished local commits | upheld | moot under D36-D41 |
| mechanics | blocking | Restart may post `done` for someone else's merged commit unverified | upheld | moot under D36-D41 |
| mechanics | major | Ready → pending race between poll and gate | upheld | moot under D36-D41 |
| mechanics | major | Restart doesn't recover an uncommitted merge | upheld | moot under D36-D41 |

**Fork for Collin (user-decision):** answered "Lighter enforcement" (D36); the round 4 findings are moot or settled by the rewritten Spec.

Prior note: the full gate keeps producing blocking edge cases (spool delivery, restart recovery, check evidence). Put to Collin: lighter enforcement, keep hardening, or rule only.

### Round 5 — 2026-11-17

**Lanes:** intent lens (provider per start); mechanics lens (other family); cross-family: yes.

**Changed since the last round:** the Spec was rewritten to the lighter enforcement (D36-D41): one gh call gate, no workflow probe, `done` never spooled (503 "try again"), no app messages, lead section simplified, restart rule simplified, Accepted Risks rewritten. Review the whole Spec in depth.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
