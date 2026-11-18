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

## Spec

### Goal in one line

A `done` card is accepted only for this thread's pull request at the commit the lead pushed,
when GitHub reports it merged, or open and ready to merge with its checks passed (GitHub's own
judgement, not ours). Agents are told to get it there themselves.

### The one signal: GitHub's merge state (D20)

GitHub computes, for an open PR, `mergeStateStatus` (via
`gh pr view <url> --json mergeStateStatus`). It already accounts for conflicts, the test merge
commit, re-runs, required checks and branch rules, so neither the app nor the lead
re-implements check logic. Values and what they mean here:

| `mergeStateStatus` | Meaning here |
|---|---|
| `CLEAN`, `HAS_HOOKS` | Ready to merge, checks passing |
| `DIRTY` | Conflicts with the base branch: fix |
| `UNSTABLE` | Mergeable, but some check is pending or failed: wait, or fix a failure |
| `BEHIND` | Base moved and the repo requires up-to-date branches: merge base in (as a conflict fix) |
| `BLOCKED` | A branch rule blocks it (e.g. unresolved review conversations, a required check pending) |
| `UNKNOWN`, `DRAFT`, missing | Not ready: wait (`DRAFT` never happens; agents open non-draft PRs) |

`CLEAN` with **no checks at all** can also mean CI has not registered yet; see the gate's
empty-checks rule (D14, revised by D21).

### Part A: the hub gate (code)

Files: `viewer/app/hub.js` (`acceptCard`, line 143), `viewer/app/cards.js`,
`viewer/app/card.js` (schema), `machine/service.js` (relay timeout, merge commit), and a new
`viewer/app/pr-gate.js` exporting `async function checkPr(thread, card)` →
`{ ok: true }` or `{ ok: false, reason }`, plus the pure `judgePr(view, thread, card,
workflowCount)` for tests.

**New `done` field (D22).** `head`: required string, the full 40-hex commit the lead pushed
and wants accepted (`/^[0-9a-f]{40}$/`). Add it to `card.js`'s `done` schema
(`viewer/app/card.js:116-122`) and to `cards-lead.md`.

**Where it runs (D19, revised by D23).** For `payload.kind === 'done'` only, `hub.acceptCard`
runs the gate before taking `withThread`:
1. Read a snapshot with `hub.state.thread(payload.thread_id)` (`viewer/app/state.js:107`, pure
   read; never `hub.thread()`, which may save). Never save the snapshot. If
   `payload.delivery_id` is already in its `delivered_ids`, skip the gate.
2. `checkPr(snapshot, payload)`.
3. Ok: continue with the existing `withThread(… cards.acceptCard …)`, unchanged.
4. Refused: inside `withThread`, read the thread with `hub.state.thread`. If
   `payload.delivery_id` is now in `delivered_ids` (a concurrent delivery of the same card was
   accepted), return the existing duplicate answer `{ ok: true, duplicate: true }` and queue
   nothing. Otherwise, if the thread is not archived and the posting session exists, call
   `hub.enqueue(thread, payload.session, "[wc:from app] your done card was refused: <reason>", 'app')`
   (D7). Then throw `appError(422, reason)`.

**Deadlines (D23).** Each gh call has an 8-second timeout; at most two calls run (below), so
the gate spends ≤16 s on GitHub. The machine's `cards` relay — the direct relay
(`machine/service.js:1289`) and the spool drain (`:913`) — passes a 45-second timeout to
`requestJson` (default 5 s, `machine/service.js:183`). Other relays keep 5 s.

**GitHub errors.** Spawn error, timeout, non-zero exit or unparsable output → refuse
"couldn't reach GitHub to check the pull request; try again in a minute: <first stderr line>".
Stderr matching
`/authentication|gh auth login|HTTP 401|HTTP 403|HTTP 404|Could not resolve to/i` → refuse
"the app's GitHub login can't read this pull request or repository: <first stderr line>".

**The decision**, in order:
1. `pr_url` must match `^https://github\.com/([^/\s]+)/([^/\s]+)/pull/\d+$`; else refuse "the
   pull request link is not a GitHub pull request" (no gh call).
2. Call 1: `gh pr view <url> --json state,mergeStateStatus,headRefName,baseRefName,headRefOid,statusCheckRollup`.
3. Identity (D13): `thread.branch` set and `headRefName !== thread.branch` → refuse "that pull
   request is not this thread's (its branch is <headRefName>)". `thread.default_branch` set and
   `baseRefName !== thread.default_branch` → refuse "that pull request targets <baseRefName>, not
   <default_branch>". `headRefOid !== card.head` → refuse "the pull request's latest commit is
   <short headRefOid>, not <short head>; it changed or the push did not land" (D22). Identity
   comes before the merged check, so a merge of a different head is refused.
4. `state === 'MERGED'` → ok (D8). `state !== 'OPEN'` → refuse "the pull request is closed".
5. `mergeStateStatus`:
   - `DIRTY` → refuse "the pull request conflicts with <base>; merge it in and resolve the conflicts".
   - `BEHIND` → refuse "<base> moved on and must be merged in first".
   - `UNSTABLE` → refuse "checks are not all passing: <summary>", where summary lists rollup
     entries whose state is failed or pending (CheckRun: `name` with `conclusion`, or "running"
     when `status !== 'COMPLETED'`; StatusContext: `context` with `state`), at most five, then
     "and N more". The summary is for reading only; the decision is GitHub's.
   - `BLOCKED` → refuse "GitHub says a branch rule blocks merging (for example a required check
     still running or unresolved review comments)" plus the same summary if any entry is
     failed or pending.
   - `UNKNOWN`, `DRAFT`, missing, or anything not listed → refuse "GitHub is still working out
     whether it can merge; try again in a minute".
   - `CLEAN` or `HAS_HOOKS` → step 6.
6. Empty checks (D21): if `statusCheckRollup` is non-empty → ok. If empty, call 2:
   `gh api repos/<owner>/<repo>/actions/workflows --jq '[.workflows[] | select(.state=="active")] | length'`
   (positive evidence; any error is mapped as above, so a 404 refuses, never passes).
   Result `0` → ok. Greater than `0` → refuse "no checks have started yet on the latest commit;
   try again in a minute". Unparsable → the "couldn't reach GitHub" refusal.

No caching: every `done` post asks GitHub again.

**Finishing a conflicted merge (machine, D16).** `wc.js git commit` runs `git commit -m <msg>
-- <paths>` (`machine/service.js:993`), which git refuses during a merge. Change: if
`git rev-parse -q --verify MERGE_HEAD` succeeds in the worktree, run `git add -- <paths>` as
now, then `git commit -m <msg>` without a pathspec. Git still refuses while unmerged paths
remain; that refusal is returned as today. Outside a merge, behaviour is unchanged.

### Part B: the protocol (text)

- `protocol/app/sub-lead.md`, `protocol/app/verifier.md`: no change (D11).
- `protocol/app/cards-lead.md`, `done`: add `head` to the field table; one paragraph: the app
  refuses the card unless GitHub reports this thread's PR, at `head`, merged, or open and ready
  to merge with checks passing; the reason comes back from `card.js` and also as a
  `[wc:from app] your done card was refused: …` message.
- `protocol/app/lead.md`: a new section "Making the pull request mergeable" (D24), which steps
  1, 8 and 9 use after push and PR, instead of posting `done` straight away. Its content:
  1. **Wait.** Run one foreground shell command that every 60 seconds runs
     `gh pr view <url> --json state,mergeStateStatus,headRefOid` and exits when `state` is not
     `OPEN`, or `mergeStateStatus` is `CLEAN`, `HAS_HOOKS`, `DIRTY` or `BEHIND`, or any check
     shows failed in `gh pr checks <url>` (exit code 1), or after 10 minutes. Repeat the command
     while the window lasts. The window is 30 minutes from the push (D4).
  2. **Ready** (`CLEAN`/`HAS_HOOKS`): post `done` with `head` = the pushed commit
     (`git rev-parse HEAD`). If the app refuses it with a "try again" reason, keep waiting
     within the same window; with any other reason, act on it as below.
  3. **Merged while waiting:** post `done` with `head` = the pushed commit. If the app refuses it
     because the head differs, follow step 9's "the fix missed" rule (a `stub` with the fix's
     own commits).
  4. **Conflicts or behind** (`DIRTY`/`BEHIND`): `wc.js git fetch`, `wc.js git merge
     origin/<default branch>`, edit the conflicted files, `wc.js git commit --paths <resolved
     files> --message …` (this completes the merge, D16). **A failed check:** read its log
     (`gh run view <id> --log-failed`) and fix the cause, committing with `wc.js git commit`.
     Either way, start a fresh verifier on the new commit by step 9's provider rule, briefed
     with what Collin asked for (a small fix has no plan; give his request) or the plan's Spec,
     plus what this repair changed (D25). On a pass, push and go back to 1 with a new 30-minute
     window.
  5. **Budget (D12, revised by D26).** Count repairs in this finishing: each repair that fails
     its verifier, or whose push still ends in a failed check or a conflict, is one failed
     attempt. After two failed attempts, or when a window ends without "ready", or on a
     credentials refusal, stop and post a `needs` card: what blocks `done`, in plain words, and
     that he can merge the pull request himself regardless. "Keep going" resets the budget and
     starts a new window. A "talk about it" press gets the explanation and, when there is a
     real choice, a `question` card. Resolve the `needs` card once `done` is accepted.
  6. **After a restart** (D18, revised by D27): the lead is waiting whenever the branch's
     pushed tip (`git rev-parse origin/wc/<thread-id>`) is not the `head` of the latest
     accepted `done` card in the thread (or there is none) and a PR exists
     (`gh pr view --json url`). Resume at 1 with a new window. This works for small fixes,
     features and after-done fixes alike.
- Step 8 still commits `status: done` before the push, so the PR carries it; the feature list
  shows Done while the lead waits (accepted risk). Step 1, step 8 item 2 and step 9 item 4 each
  send the lead to the new section before posting `done`.

### Edge cases

- Repo with no active workflows and no checks: accepted (D21).
- Repo with active workflows that never run on pull requests: refused forever; the lead's
  `needs` card covers it (accepted risk).
- Main moves after `done`: not re-checked (D5).
- After-done fix that Collin merges while the lead waits: accepted when the merged head is the
  lead's `head`; refused otherwise, and the lead stubs it (D22).
- The same card delivered twice at once (direct relay and spool drain): one accepted, the other
  answers duplicate; no false refusal message (D23).

### Non-goals

- Agents never merge the pull request.
- No new CI checks; no change to `.github/workflows/`.
- No override for Collin (D10).
- No re-checking after `done`; `pollMerged` is unchanged.

### Validation

- New `viewer/test/app-done-gate.test.js`, stubbing `gh` on `PATH` as
  `viewer/test/app-merged.test.js:17-27` does. Cases: merged at `head` → accepted; merged at
  another head → refused; open `CLEAN` with checks → accepted; `HAS_HOOKS` → accepted; `CLEAN`
  with no checks and 0 active workflows → accepted; `CLEAN` no checks and 1 active workflow →
  refused "no checks have started"; workflows call fails with HTTP 404 → refused credentials;
  `DIRTY`, `BEHIND`, `UNSTABLE` (summary names the failed check), `BLOCKED`, `UNKNOWN` →
  refused with their reasons; wrong head branch, wrong base, closed → refused; non-GitHub URL →
  refused without calling gh; gh non-zero exit → "couldn't reach GitHub"; auth stderr →
  credentials reason; every refusal queues `[wc:from app] your done card was refused: ...` for
  the posting session; a duplicate `delivery_id` does not call gh; a refusal whose delivery id
  was accepted meanwhile returns duplicate and queues nothing; a slow gh stub (3 s) does not
  block another card on the same thread; the snapshot is never written (thread file unchanged
  by a refused card except the queued message).
- `viewer/test/app-cards.test.js` (or the existing card schema test): `done` without `head`, or
  with a non-40-hex `head`, is refused.
- `machine/test/service.test.js`: a card relay whose hub answers 422 after 6 seconds returns
  422 to the agent, not a spooled 202; a spooled card drained against a slow refusing hub moves
  to rejected storage. `wc.js git commit` during a conflicted merge, after resolving, completes
  the merge commit; with unmerged paths left, it is refused.
- Existing tests that post `done` cards keep passing (add `head` and a gh stub as needed).
- `viewer/test/protocol-rules.test.js`: assert lead.md has the "Making the pull request
  mergeable" section and that steps 1, 8 and 9 refer to it; cards-lead.md's `done` lists `head`.
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
