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
| 11 | Every git change is journalled in the record first; switches never overwrite ignored files or guess names; set-aside changes are pinned under `refs/wheelchair/kept/`; outcomes are judged by where HEAD actually is, not git's exit code; Switch back carries the record version | Mechanics findings 1-11, round 1 | review-round-1 |
| 12 | Refuse folders that run wheelchair itself, agents' copies, and folders with submodule changes | Intent finding 1 and mechanics findings 10-11, round 1 | review-round-1 |
| 13 | Supersedes 3, 4 (restore part) and 5: Try refuses when his copy has changes; nothing of his is ever set aside. Switch back (and moving to another thread) backs up anything changed while trying to a private pinned commit, then clears only those files. The stash list is never used | Round 2 showed stash can delete files and races on the shared stash list | user |
| 14 | Records split into `active`, `pending` and `backups`; outcomes judged by full HEAD identity; return point and moved commits pinned; stale records need Dismiss; submodule pointer changes refused; hub and machine contracts carry `dismiss`, `version`, `backup`; linked-worktree refusal dropped (agents' copies are refused by location) | Round 2 findings | review-round-2 |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

### Behaviour

Terms:
- **The folder** is `thread.project` on `thread.machine` (`viewer/app/threads.js:20-25`).
- **HEAD identity** is the pair `{branch: refname or null if detached, sha}`. Every
  comparison below compares both parts.
- **Clean check**: `git status --porcelain=v1 -z --untracked-files=all
  --ignore-submodules=none`, with the protected paths removed by literal match. Empty
  means clean.
- **Protected paths**: at the first Try, `git ls-files -z --others --ignored
  --exclude-standard --directory` (directories collapsed), saved in the record. These are
  files git ignored before trying; wheelchair never backs them up, clears or reports
  them, even if a thread's changed ignore rules make them look untracked. A path is
  protected if it equals a saved entry or lies under a saved directory entry.
- **Switches** always run as `git -c submodule.recurse=false switch --no-guess
  --no-overwrite-ignore --no-recurse-submodules <branch>` or the same with
  `--detach <sha>`. Git refuses rather than overwrite an ignored file.
- **Outcome of a switch** is judged by the HEAD identity read afterwards, never by the
  exit code: equal to the target is success (a nonzero exit, such as a failing
  post-checkout hook, becomes a warning with git's last line); equal to the source means
  nothing moved; anything else is the **unexpected state**.
- **Pin**: `git update-ref refs/wheelchair/<kind>/<folder hash>/<nonce> <sha>`, where
  nonce is 8 random hex chars. Wheelchair never uses the stash list.
- **Back up the leftovers** (only while trying): makes a private copy of every changed
  file, then clears exactly those files, so nothing changed while trying is lost and his
  own work was never involved (Try refuses a copy that is not clean):
  1. Read the clean check's list of changed paths (tracked modified, added, deleted,
     renamed; untracked).
  2. Snapshot without touching the working tree: with a temporary index
     (`GIT_INDEX_FILE=<tmp>`), `git read-tree HEAD`, then `git add -A` with those paths
     given literally (`GIT_LITERAL_PATHSPECS=1`, `--pathspec-from-file`
     `--pathspec-file-nul`), `git write-tree`, `git commit-tree <tree> -p HEAD -m
     "wheelchair backup: changes while trying thread <id>"`, then pin it as `backup`.
  3. Verify: for each listed path, the file on disk (`git hash-object`, or absence for a
     deletion) matches the snapshot. On a mismatch (something is still writing) retry
     from 1, at most three times, then stop with "Your copy keeps changing; close the
     app using it and try again". Nothing has been cleared at this point.
  4. Clear, path by path, only paths whose disk content still matches the snapshot:
     tracked paths with `git restore --source=HEAD --staged --worktree` (literal
     pathspec); untracked files by deleting that one file. A path that no longer matches
     is left alone and reported.
  5. Run the clean check. Not clean: stop and list the remaining files; HEAD unchanged.
  The window between a path's last check in 4 and its clear is an Accepted Risk.

**The record**, one per folder: `<stateDir>/tries/<sha256 of real folder path>.json`,
written atomically (temp file then rename):

```
{ folder, version,            // version: random id, changes on every write
  active: null | { thread_id, commit, return_point: {branch, sha}, protected: [path] },
  pending: null | { op: "try"|"back", from: HEADid, to: HEADid, thread_id, step },
  backups: [ { ref, label, thread_id, files: [path], at } ] }
```

The return point's sha is pinned as `return` at the first Try and the pin deleted after
a successful Switch back or a Dismiss of `active`.

**Trying** means `active` is set and HEAD is detached at `active.commit`. **Moved** means
`active` is set and HEAD is detached elsewhere (he committed while trying). **Stale**
means `active` is set and HEAD is attached to a branch (he switched by hand).

**Refusals** (checked before any change; nothing changes; the reason is shown):
- not a git working tree top level (`git rev-parse --show-toplevel` must equal the
  folder's real path) or a bare repository;
- the folder lies under `<stateDir>/worktrees` (agents' copies, `machine/service.js:488-490`);
- the folder's real path equals or contains the real path of the running service's own
  source root (`ROOT`, `machine/service.js:29`; the hub makes the same check with its own
  root when `thread.machine` is the hub's machine): "This folder runs wheelchair itself;
  switching it would swap the running app for untested code.";
- a merge, rebase, cherry-pick, revert or bisect is in progress;
- a submodule has changes, or the target commit's submodule entries differ from HEAD's
  (`git diff --raw HEAD <target>` shows mode 160000): "This thread changes a submodule,
  which isn't supported.";
- Try when `active` is null and the copy is not clean: lists the changed files, "Commit
  or put these aside, then press again.";
- Try or Switch back when Stale: "You switched your copy by hand. Dismiss first.";
- Try when `refs/heads/wc/<thread-id>` does not exist;
- Switch back when the return point is a branch that no longer exists or is checked out
  in another worktree (`git worktree list --porcelain`); the copy stays as it is;
- Switch back or Dismiss whose `version` differs from the record's: "Your copy changed
  since this page loaded", and the page re-reads status.

All writes hold `inRepoQueue(folder)` (`machine/service.js:547`), check the first four
refusals (the folder itself and git operations in progress), then reconcile (5), then
check the rest, then act.

1. **Try it in my copy.** After a confirmation naming the folder and machine, saying it
   brings in the thread's merged work so far (work agents have not yet merged into the
   thread is not included):
   1. Target is the sha of `wc/<thread-id>`. If Trying at that same sha: "Already
      showing the newest", no change.
   2. If `active` is null: record the return point (current HEAD identity), pin it, save
      protected paths, all in `active` with `commit: null` before any change.
   3. If Moved: pin HEAD as a backup ("commits made while trying thread <id>") and list
      it in `backups`. If not clean: back up the leftovers.
   4. Write `pending {op: "try", from: HEAD, to: {branch: null, sha: target}}`, switch
      detached to the target, judge the outcome. Success: `active.thread_id` and
      `commit` set to the target, `pending` cleared. Nothing moved: `pending` cleared;
      if this was the first Try, `active` cleared and the return pin deleted; git's line
      reported. Unexpected state: `pending` kept, reported.
   Pressing Try for the thread already in place, or another thread, uses the same steps.
2. **Switch back.** Carries the shown `version`. Confirmation says anything changed while
   trying is backed up first, and suggests closing the app using the folder.
   1. If Moved: pin HEAD as a backup, as in 1.3. If not clean: back up the leftovers.
   2. Write `pending {op: "back", from: HEAD, to: return_point}`, switch to the return
      point (by branch name, or detached at its sha), judge the outcome. Success: `active`
      and `pending` cleared, return pin deleted. Nothing moved: `pending` cleared, git's
      line reported, still trying. Unexpected: `pending` kept, reported.
   3. Reports what was backed up (file count and label), if anything.
3. **Status** (GET, read-only, under the same queue, never fetches or writes). Returns
   `version` and one of: nothing; "Your copy is showing this thread's merged work as of
   <short sha>" (plus "Get newest" when `wc/<id>` moved on); "Your copy is showing
   another thread: <title>"; "Your copy moved since you tried <thread>" with Switch back;
   Stale: "You switched your copy by hand" with Dismiss; `pending` set: "An earlier
   switch was interrupted; the next press finishes or undoes it"; unexpected state:
   "Your copy is in an unexpected state" with git's view of HEAD. Plus the list of
   backups (label, date, file count), each with "Delete backup".
4. **Dismiss** (version-checked): with Stale, clears `active` and deletes the return pin.
   With a backup named, after a confirmation, deletes that backup's pin and list entry.
   Nothing else deletes a backup.
5. **Reconcile** (start of every write, after refusals): if `pending` is set, compare
   HEAD identity with `pending.to` (finish as success) and `pending.from` (clear
   `pending`; any backup already made stays listed). Anything else: leave it, report the
   unexpected state; writes other than Dismiss are refused until HEAD matches one of
   them or he Dismisses (which clears `pending` and `active` but never backups).
6. **Errors** reach Collin as one plain sentence under the control: machine
   unreachable, a refusal, or git's last line. After any write error or timeout, the page
   re-reads status rather than assuming the outcome.

### Where it lives

- **Machine** (`machine/service.js`): new hub-secret-only endpoint `POST /v1/try`,
  authorised like `/v1/handoff` (`machine/service.js:403-420,1602-1604`). Body
  `{action: "status"|"try"|"back"|"dismiss", thread_id, project, version?, backup?}`.
  `thread_id` matches `^[0-9a-f]{12}$`; `project` validated with `projects({check})`
  (`machine/service.js:1198-1232`); `version` required for `back` and `dismiss`;
  `backup` (a ref from the record) only for `dismiss`. Agents can never call it (no
  agent-token route).
- **Hub** (`viewer/app/routes.js`, `viewer/app/machine-client.js:53-108`):
  `GET /api/threads/<id>/try` and `POST /api/threads/<id>/try` with body
  `{action: "try"|"back"|"dismiss", version?, backup?}`, under browser write auth
  (`viewer/server.js:1292-1298`); `thread.machine` and `thread.project` always come from
  the thread record, never the request. The hub forwards `version` and `backup` as given.
- **Thread page** (`viewer/pages/thread.js`): a small "Your copy" panel near the top with
  the status line, buttons, confirmations, backups list and error line. Not a card;
  nothing reaches the lead.

### Non-goals

Merging, pushing or touching the pull request; launching any app; other machines or a
configurable folder; including uncommitted agent edits; changing agent git rules;
setting aside Collin's own changes (Try refuses instead); restoring a backup from the
app (status names the backup's ref); submodule changes.

### Validation

- `bash machine/test/run.sh`: new tests in `machine/test/service.test.js` against a temp
  repo with a linked worktree on `wc/<id>`: try from a clean branch and back; try
  refused when dirty (tracked, untracked; and with `status.showUntrackedFiles=no` set);
  try from a detached start and back; try A, then B, then back to the original branch;
  back with tracked and untracked leftovers (backed up, cleared, listed); a file changing
  between snapshot and verify (retried, then refused with nothing cleared); a tracked
  path colliding with an ignored file both ways (refused, file intact); a thread that
  removes an ignore rule (the file stays, is not backed up, not reported, back succeeds);
  submodule pointer change in the target (refused); folder under the worktrees dir and
  the service root (refused); failing post-checkout hook (success with warning);
  interruption with `pending` set at each step (reconcile finishes or clears); commit
  made while trying (pinned and listed); return branch deleted or checked out elsewhere
  (refused); stale record (Try and Back refused; Dismiss clears, backups kept); stale
  `version` on back and dismiss (refused).
- `node --test viewer/test/*.test.js`: routes resolve machine and project from the
  record; `version` and `backup` forwarded; unauthenticated writes refused.
- `npm --prefix viewer run test:browser`: the panel shows status, confirmations,
  backups and an error line.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|
| A file rewritten by an open app in the instant between its last check and its clear (Back up the leftovers, step 4) loses that last write | Only trial leftovers are cleared, each re-checked just before; the confirmation suggests closing the app; closing the window fully needs file locking git does not offer | 2 |

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
| intent | blocking | Stale `trying` record reused by the next Try | upheld | Stale needs Dismiss (Refusals, 4) |
| intent | major | Commits made while trying lost when Try moves away | upheld | Fixed in the Q5 redesign |
| intent | major | Hub/machine contracts omit `dismiss` and `version` | upheld | Fixed in the Q5 redesign |
| intent | minor | After a clash the only pointer to his changes is one error line | upheld | Fixed in the Q5 redesign |
| intent | minor | Kept sets pile up unseen | upheld | Fixed in the Q5 redesign |
| intent | minor | Main-working-tree refusal blocks his own linked worktree | upheld (agents' copies are all under `<stateDir>/worktrees`, `machine/service.js:488-490`) | Fixed in the Q5 redesign |
| mechanics | blocking | Stash's internal reset can delete an ignored file before the switch | user-decision | Collin chose (c): no stash; Decision 13 |
| mechanics | blocking | Stash's broad clean can delete a file an engine writes mid-stash | user-decision | Collin chose (c): no stash; Decision 13 |
| mechanics | blocking | Clean check treats protected ignored paths as dirt | user-decision | Collin chose (c): no stash; Decision 13 |
| mechanics | blocking | Journal cannot tell which operation to recover | upheld | Fixed in the Q5 redesign |
| mechanics | blocking | Back applies the stash when HEAD moved somewhere else | upheld | Fixed in the Q5 redesign |
| mechanics | blocking | `stash drop` printed sha cannot verify what was deleted | user-decision | Collin chose (c): no stash; Decision 13 |
| mechanics | major | Submodule pointer changes strand a trial | upheld | Fixed in the Q5 redesign |
| mechanics | major | Detached return commit and refresh commits unpinned | upheld | Fixed in the Q5 redesign |
| mechanics | major | Stale record has no defined Try behaviour | upheld (dup of intent 1) | Fixed in the Q5 redesign |
| mechanics | major | Browser POST omits `dismiss` and `version` | upheld (dup of intent 3) | Fixed in the Q5 redesign |

### Round 3 — 2026-11-18

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 2:** Collin chose (Decision 13) to drop setting aside his own
changes: Try now refuses a copy with changes, and leftovers from trying are backed up to
private pinned commits and cleared path by path ("Back up the leftovers"). The whole
Behaviour, record shape (`active`/`pending`/`backups`), refusals, reconcile, Dismiss,
hub and machine contracts, non-goals and validation list were rewritten; one Accepted
Risk added.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

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
