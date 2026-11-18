---
slug: local-checkout-handoff
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Try a thread's work in my own checkout

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

None.

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
| 1 | Switch Collin's folder to the thread's work in place; his own branch is left untouched | Same folder keeps engine caches; easy to undo | user |
| 2 | The switch puts his folder on the thread's latest committed work as a detached commit (no new branch name); uncommitted agent edits are not included | The thread branch is already checked out in the agent's copy, so git will not check it out twice; a detached commit needs no extra branch to clean up | defaulted |
| 3 | Uncommitted changes in his folder are set aside automatically (stash, including untracked files) before the switch and restored on switching back | He is usually on a phone with no way to commit | user |
| 4 | A "Switch back" button returns the folder to the branch it was on and restores the set-aside changes; switching from one thread to another keeps the original return point | Follows from 1 and 3; IDEA requires getting back as easily | defaulted |
| 5 | Changes made while trying (for example files an engine rewrites) are never discarded: on switching back they are set aside under a label naming the thread, and the app says so | IDEA: nothing of his is lost | defaulted |
| 6 | The folder switched is the thread's own project folder (`thread.project`) on the thread's machine (`thread.machine`); no per-project setting, no other machine | Agents' copies are made from that folder, so it is usually his copy; nothing to set up | user |
| 7 | The thread's work is the local ref `wc/<thread-id>` in that folder's repository (shared with the agent's linked worktree), so no fetch or push is needed | The thread's worktree is linked to this repository, so its branch ref is already there | defaulted |
| 8 | Pressing "Try it in my copy" asks for one confirmation naming the folder and machine | A mis-tap on a phone rewrites his working folder | defaulted |
| 9 | Pressing "Try it" again for the thread already in place moves to its newest commit | Agents keep committing; he needs a way to refresh | defaulted |
| 10 | The control lives on the thread page for any thread whose branch exists in the folder, at any stage, and shows which thread (if any) the folder is currently showing | He may want to try work before it is done; one place to look | defaulted |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

### Behaviour

Terms: **the folder** is `thread.project` on `thread.machine` (`viewer/app/threads.js:20-25`).
**Trying** means the folder's HEAD is detached at a thread's commit and a try record
exists for the folder. **The return point** is the branch (or commit, if the folder was
already detached) HEAD was on before the first try.

1. **Try it in my copy** (thread page). After a confirmation naming the folder and
   machine, the machine, holding `inRepoQueue(folder)` (`machine/service.js:547`):
   1. Refuses, changing nothing, if: the folder is not the top level of a non-bare
      working tree (`git rev-parse --show-toplevel` must equal the resolved folder, and
      `--is-bare-repository` false); a merge, rebase, cherry-pick, revert or bisect is in
      progress; `refs/heads/wc/<thread-id>` does not exist.
   2. If not already trying: records the return point (`git symbolic-ref -q HEAD`, else
      `git rev-parse HEAD`).
   3. If the working tree has tracked or untracked changes (`git status --porcelain`,
      ignored files excluded): `git stash push --include-untracked -m <label>` and records
      the stash commit's sha. Label: `wheelchair: my changes before trying thread <id>`
      when not yet trying, otherwise `wheelchair: changes while trying thread <prev id>`.
   4. `git checkout --detach <sha of wc/<thread-id>>`.
   5. If checkout fails: restores what step 3 stashed (`git stash apply --index <sha>`,
      then drop that entry by finding the sha in `git stash list --format=%H`), leaves
      the try record as it was before the press, and reports git's last error line.
   6. Writes the try record and reports: thread id, commit, and whether changes were set
      aside.
   Ignored files are never touched by wheelchair (git itself refuses a checkout that would
   overwrite one, and step 5 handles that).
2. **Switch back.** Shown while the folder is trying any thread, on every thread page of
   that folder. Under the same queue:
   1. If the working tree has changes, stash them as `wheelchair: changes while trying
      thread <id>` (kept, not restored) and report the label.
   2. `git checkout <return point>` (branch name, or `--detach <sha>`).
   3. Apply the "before trying" stash, if any, with `git stash apply --index <sha>`. On
      success drop that entry (by sha). On conflict or failure: run no cleanup command
      (no `checkout --`, no `reset`); leave the stash entry and whatever apply wrote in
      place, and report "your earlier changes are kept in stash `<label>`; restoring
      them hit a clash in <files>".
   4. Deletes the try record.
3. **Status.** The thread page shows, for its folder: nothing (not trying), "Your copy is
   showing this thread" (with a "Get newest" if `wc/<id>` moved past the tried commit),
   or "Your copy is showing another thread: <title>". Read-only: `git rev-parse HEAD`,
   the try record, `git rev-parse wc/<id>`; never fetches.
4. **Drift.** If the folder's HEAD no longer equals the recorded tried commit (Collin
   switched branches himself), the try record is stale: status shows nothing, Switch back
   is hidden, the record is deleted on the next status read, and any "before trying"
   stash stays in his stash list untouched.
5. **Errors** reach Collin as one plain sentence under the control: machine unreachable,
   refusal reason from 1.1, or git's last error line.

### Where it lives

- **Machine** (`machine/service.js`): new hub-secret-only endpoint `POST /v1/try` with
  actions `status`, `try`, `back`, authorised like `/v1/handoff`
  (`machine/service.js:403-420,1602-1604`), input `{action, thread_id, project}`;
  `project` validated with `projects({check})` (`machine/service.js:1198-1232`).
  `thread_id` must match `^[0-9a-f]{12}$`. Try records live in
  `<stateDir>/tries/<sha256 of resolved folder path>.json`:
  `{folder, return_point: {kind: "branch"|"commit", value}, before_stash: sha|null,
  thread_id, commit}`. Agents can never call it (no agent-token route).
- **Hub** (`viewer/app/routes.js`, `viewer/app/machine-client.js:53-108`): browser routes
  `GET /api/threads/<id>/try` and `POST /api/threads/<id>/try` (`{action:"try"|"back"}`),
  under the normal browser write auth (`viewer/server.js:1292-1298`), resolving
  `thread.machine` and `thread.project` from the thread record; never from the request.
- **Thread page** (`viewer/pages/thread.js`): a small "Your copy" panel near the top,
  with the status line, the button(s), the confirmation and the error line. Not a card;
  nothing reaches the lead.

### Non-goals

Merging, pushing or touching the pull request; launching any app; other machines or a
configurable folder; including uncommitted agent edits; changing agent git rules.

### Validation

- `bash machine/test/run.sh`: new tests in `machine/test/service.test.js` against a temp
  repo with a linked worktree on `wc/<id>`: try from clean branch; try with tracked,
  untracked and ignored files (ignored untouched, others restored on back); try A then B
  then back (original return point and stash); back with changes made while trying (kept
  in a labelled stash); checkout failure restores the stash; refusal during a merge;
  drift; stash-apply clash leaves the stash entry.
- `node --test viewer/test/*.test.js`: route tests that thread id resolves machine and
  project from the record and that unauthenticated writes are refused.
- `npm --prefix viewer run test:browser`: the panel shows status, confirmation, and an
  error line.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — <date>

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
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
