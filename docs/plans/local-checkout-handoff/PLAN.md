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

### Q5: Keep automatic set-aside of his own changes?
- **Context:** Round 2 showed `git stash` can delete files (ignored files, files an engine writes mid-stash) and races on the shared stash list; making it safe is a large, fragile build.
- **Options:** (a) keep it, with a much bigger build and "close your engine first"; (b) refuse whenever his copy has changes, both ways; (c) refuse on Try if his copy has changes, and on Switch back save the trial's leftovers to a private backup then clear only those files.
- **Recommendation:** (c).

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
| 11 | Every git change is journalled in the record first; switches never overwrite ignored files or guess names; set-aside changes are pinned under `refs/wheelchair/kept/`; outcomes are judged by where HEAD actually is, not git's exit code; Switch back carries the record version | Mechanics findings 1-11, round 1 | review-round-1 |
| 12 | Refuse folders that run wheelchair itself, agents' copies, and folders with submodule changes | Intent finding 1 and mechanics findings 10-11, round 1 | review-round-1 |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

### Behaviour

Terms:
- **The folder** is `thread.project` on `thread.machine` (`viewer/app/threads.js:20-25`).
- **The record** is the folder's try record (see Where it lives). It is written before
  any git change and updated after each step (**phase**), so an interrupted operation can
  be finished or undone.
- **The return point** is the exact local branch (`refs/heads/<name>`), or the commit if
  the folder was already detached, that HEAD was on before the first Try.
- **Trying** means a record exists in phase `trying`, HEAD is detached, and HEAD equals
  the record's `commit`.
- **A kept set** is a stash entry wheelchair makes. It always has a unique label
  `wheelchair <nonce>: <words>` (nonce: 8 random hex chars) and is pinned with
  `git update-ref refs/wheelchair/kept/<sha> <sha>` right after it is made, so it stays
  reachable whatever happens to the shared stash list. Restoring is always by sha
  (`git stash apply --index <sha>`), never by `stash@{n}`.
- **Dropping a kept set** (only after a successful restore): find its current index by
  sha in `git stash list --format='%H'`; if absent, just delete the pin. Otherwise run
  `git stash drop stash@{n}` and read the sha git prints ("Dropped ... (<sha>)"). If that
  sha is not ours, put the dropped entry straight back with
  `git stash store -m "<its subject>" <dropped sha>` and leave ours in the list. Then
  delete our pin. Agents never stash through the machine (`machine/service.js:1044`).
- **Clean check**: `git status --porcelain=v1 --untracked-files=all
  --ignore-submodules=none`, empty means clean.
- **Switches** always use `git switch --no-guess --no-overwrite-ignore <branch>` or
  `git switch --detach --no-overwrite-ignore <commit>`, so an ignored file is never
  overwritten (git refuses instead) and a name is never guessed or read as a path.
- **Kept-ignored list**: at the first Try, `git ls-files --others --ignored
  --exclude-standard --directory` (directories collapsed) is saved in the record. Any
  stash made while trying excludes those paths (`:(exclude,top)<path>` pathspecs), so an
  ignored file that a thread's changed ignore rules make look untracked stays in place.

Refusals (checked before any git change; nothing changes; the reason is shown):
- not a git working tree top level (`git rev-parse --show-toplevel` must equal the real
  path of the folder) or a bare repository;
- not the repository's main working tree (`git rev-parse --git-dir` must equal
  `--git-common-dir`), or the folder lies under `<stateDir>/worktrees`: agents' copies
  are never switched;
- the folder's real path equals or contains the real path of the running service's own
  source root (`ROOT`, `machine/service.js:29`; the hub makes the same check with its own
  root when `thread.machine` is the hub's machine): "This folder runs wheelchair itself;
  switching it would swap the running app for untested code.";
- a merge, rebase, cherry-pick, revert or bisect is in progress;
- a submodule has changes (`git submodule status` shows `+`/`-`/`U`, or the clean check
  shows a submodule path): "Changes inside a submodule can't be set aside safely.";
- for Try: `refs/heads/wc/<thread-id>` does not exist;
- for Switch back: the return branch no longer exists, or is checked out in another
  worktree (`git worktree list --porcelain`). The folder stays on the thread's work and
  the record is kept.

1. **Try it in my copy.** After a confirmation naming the folder and machine, and saying
   it brings in the thread's merged work so far (work agents have not yet merged into the
   thread is not included), the machine, holding `inRepoQueue(folder)`
   (`machine/service.js:547`), first reconciles any interrupted operation (5), runs the
   refusals, then:
   1. If no record: writes one in phase `starting` with the return point and the
      kept-ignored list.
   2. If not clean: makes a kept set (`git stash push --include-untracked -m <label>`,
      with the kept-ignored exclusions when already trying), labelled "my changes before
      trying thread <id>" (first Try; saved as `before_stash`) or "changes while trying
      thread <prev id>" (added to `kept`). Records it. Runs the clean check again; if
      still not clean, restores what was just kept, sets the record back, and refuses
      ("Some changes couldn't be set aside").
   3. Records the target commit (sha of `wc/<thread-id>`) in phase `switching`, then
      switches detached to it.
   4. Whatever git's exit code, reads HEAD. If HEAD is the target: success (a nonzero
      exit, for example a failing post-checkout hook, is reported as a warning with git's
      last line). If HEAD did not move: restores what step 2 kept (and drops it), puts the
      record back as it was before the press (deleting it if this was the first Try), and
      reports git's last line. If HEAD is anywhere else: keeps the record and the kept
      sets and reports that the copy is in an unexpected state.
   5. On success: phase `trying`, `thread_id`, `commit`, new `version` (random id).
   Pressing Try for the thread already in place moves to its newest commit the same way.
2. **Switch back.** The request carries the record `version` it was shown; a different
   version is refused ("Your copy changed since this page loaded") and the page reloads
   status. Under the same queue, after reconcile and refusals:
   1. If HEAD (still detached) differs from `commit` (he committed while trying), pins
      HEAD as `refs/wheelchair/kept/<sha>` and reports it, so the commits stay reachable.
   2. If not clean: makes a kept set "changes while trying thread <id>" (excluding the
      kept-ignored list) and reports its label. Phase `returning`.
   3. Switches to the return point. If HEAD did not move: restores step 2's set, keeps
      the record in `trying`, reports git's line.
   4. Restores `before_stash` by sha. On success drops it. On a clash: runs no cleanup
      command, leaves the set and whatever apply wrote, reports "Your earlier changes are
      kept in stash `<label>`; restoring them clashed in <files>".
   5. Deletes the record.
3. **Status** (read-only, GET): taken under the folder's queue so it never sees a half
   step. Shows one of: nothing; "Your copy is showing this thread's merged work as of
   <short commit>" (plus "Get newest" if `wc/<id>` moved on); "Your copy is showing
   another thread: <title>"; "Your copy moved since you tried <thread>" (detached, other
   commit) with Switch back; or, for a stale record (4), "Your earlier changes are kept in
   stash `<label>`" with a Dismiss button. Returns the record `version`. Never fetches,
   never writes.
4. **Stale.** If HEAD is attached to a branch while the record is `trying` (he switched
   himself), the record is stale: Switch back is hidden; if it has `before_stash` or
   `kept`, status names them; Dismiss (a write, version-checked) deletes the record. Kept
   sets and pins stay.
5. **Reconcile** (start of every write): a record in `starting` with HEAD unchanged →
   restore any kept set made and delete the record; `switching` with HEAD at the target →
   finish as success; `switching` with HEAD unmoved → undo as 1.4; `returning` with HEAD
   at the return point → continue from 2.4; `returning` with HEAD unmoved → back to
   `trying`. Anything else is left alone and reported as an unexpected state.
6. **Errors** reach Collin as one plain sentence under the control: machine
   unreachable, a refusal, or git's last line. After any write error or timeout, the page
   re-reads status rather than assuming the outcome.

### Where it lives

- **Machine** (`machine/service.js`): new hub-secret-only endpoint `POST /v1/try` with
  actions `status`, `try`, `back`, authorised like `/v1/handoff`
  (`machine/service.js:403-420,1602-1604`), input `{action, thread_id, project}`;
  `project` validated with `projects({check})` (`machine/service.js:1198-1232`).
  `thread_id` must match `^[0-9a-f]{12}$`. Try records live in
  `<stateDir>/tries/<sha256 of real folder path>.json`, written atomically (temp file
  then rename): `{folder, version, phase: "starting"|"switching"|"trying"|"returning",
  return_point: {kind: "branch"|"commit", value}, kept_ignored: [path], before_stash:
  {sha, label}|null, kept: [{sha, label}], thread_id, commit}`. Actions `try` and `back`
  and `dismiss`; `back` and `dismiss` require `version`. Agents can never call it (no agent-token route).
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
  in a labelled, pinned stash); a tracked path colliding with an ignored file in each
  direction (refused, file intact); a thread commit that removes an ignore rule (the
  ignored file stays in place on back); `status.showUntrackedFiles=no` set; a dirty
  submodule (refused); a project folder that is a linked worktree or under the
  worktrees dir (refused); the service root (refused); a failing post-checkout hook
  (success with warning); interruption after each phase (reconcile); a commit made while
  trying (pinned); return branch deleted or checked out elsewhere (refused, record kept);
  a foreign stash pushed between list and drop (foreign entry restored); a stale
  `version` on back (refused); stash-apply clash leaves the stash entry and pin.
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

### Round 1 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Trying a thread could switch the folder wheelchair itself runs from | upheld (install.sh:384,397 run from `$ROOT`) | Refusal added to 1.1 |
| intent | minor | Status overstates: unmerged worker branches are not included | upheld | Confirmation and status say "merged work as of <commit>" |
| intent | minor | Drift silently drops the pointer to his set-aside changes | upheld | One-time status line naming the stash (Behaviour 4) |
| intent | minor | Shared stash list can lose the entry | upheld | Pinned under `refs/wheelchair/kept/` (1.3, 1.5, 2.3) |
| mechanics | blocking | Checkout overwrites ignored files by default | upheld (git-checkout(1): `--overwrite-ignore` is default) | `--no-overwrite-ignore` on every switch |
| mechanics | blocking | Thread removing an ignore rule moves an ignored file into the trial stash | downgraded to major: file is stashed, not lost | Kept-ignored list excluded from trial stashes |
| mechanics | blocking | No journal; crash leaves detached copy without Switch back | downgraded to major: changes stay in the stash | Record phases written first; reconcile (5) |
| mechanics | blocking | Failing post-checkout hook misread as no switch | downgraded to major: same, and hooks are rare | Outcome judged by actual HEAD (1.4) |
| mechanics | blocking | `stash@{n}` races across linked worktrees | downgraded to major: agents cannot stash via the machine (`machine/service.js:1044`) | Restore by sha; drop verifies printed sha and re-stores a foreign entry |
| mechanics | major | Switch back has no preflight; plain checkout guesses names | upheld | Refusals for missing/elsewhere branch; `git switch --no-guess` |
| mechanics | major | SHA-only drift detection | upheld | Trying needs detached HEAD; moved-detached pins HEAD on back |
| mechanics | major | Status GET writes and is unlocked | upheld | GET read-only under queue; Dismiss is a write |
| mechanics | major | Stale tab can undo a newer trial | upheld | `version` on back/dismiss; re-read status after errors |
| mechanics | major | Untracked hidden by config; submodule changes not stashed | upheld | `--untracked-files=all`; submodule refusal; clean re-check |
| mechanics | major | A managed agent worktree passes project validation | upheld | Main-working-tree and worktrees-dir refusals |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-18

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 1:** Behaviour rewritten: terms (record phases, kept sets pinned
under `refs/wheelchair/kept/`, drop-by-verified-sha, clean check flags, `git switch
--no-guess --no-overwrite-ignore`, kept-ignored list); refusals list (service root,
agents' copies, submodule changes, return-branch preflight); Try judged by actual HEAD;
Switch back with version check and pinning commits made while trying; status read-only
under the queue with Dismiss; reconcile of interrupted operations. Record shape and
validation list updated. Decisions 11-12.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Stale `trying` record reused by the next Try | upheld | Pending Q5 (reworks stale handling) |
| intent | major | Commits made while trying lost when Try moves away | upheld | Pending Q5 |
| intent | major | Hub/machine contracts omit `dismiss` and `version` | upheld | Pending Q5 |
| intent | minor | After a clash the only pointer to his changes is one error line | upheld | Pending Q5 |
| intent | minor | Kept sets pile up unseen | upheld | Pending Q5 |
| intent | minor | Main-working-tree refusal blocks his own linked worktree | upheld (agents' copies are all under `<stateDir>/worktrees`, `machine/service.js:488-490`) | Pending Q5 |
| mechanics | blocking | Stash's internal reset can delete an ignored file before the switch | user-decision | Q5: stash-based set-aside is the root cause |
| mechanics | blocking | Stash's broad clean can delete a file an engine writes mid-stash | user-decision | Q5 |
| mechanics | blocking | Clean check treats protected ignored paths as dirt | user-decision | Q5 |
| mechanics | blocking | Journal cannot tell which operation to recover | upheld | Pending Q5 |
| mechanics | blocking | Back applies the stash when HEAD moved somewhere else | upheld | Pending Q5 |
| mechanics | blocking | `stash drop` printed sha cannot verify what was deleted | user-decision | Q5 |
| mechanics | major | Submodule pointer changes strand a trial | upheld | Pending Q5 |
| mechanics | major | Detached return commit and refresh commits unpinned | upheld | Pending Q5 |
| mechanics | major | Stale record has no defined Try behaviour | upheld (dup of intent 1) | Pending Q5 |
| mechanics | major | Browser POST omits `dismiss` and `version` | upheld (dup of intent 3) | Pending Q5 |

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
