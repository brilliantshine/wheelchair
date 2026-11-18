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
| 15 | Supersedes the `refs/wheelchair/kept/` part of 11: pins are `refs/wheelchair/<return|backup>/...`. Supersedes 10's location rule: the panel shows on every thread page for the folder, including archived threads; Try needs the thread's branch, Switch back does not | Round 3 intent findings | review-round-3 |
| 16 | Backups are byte-exact (no filters, modes and symlinks kept) and include the index; they are recorded before anything is cleared; outcomes also need a status scan; folder identity checked; Switch back returns to the branch's current tip; first Try state lives in `pending` until success | Round 3 mechanics findings | review-round-3 |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

### Behaviour

Terms:
- **The folder** is `thread.project` on `thread.machine` (`viewer/app/threads.js:20-25`).
- **Identity**: the folder's real path plus the real path of `git rev-parse
  --git-common-dir`, saved in the record at the first Try and checked before every write;
  a mismatch is the unexpected state ("This folder is no longer the copy that was
  switched") and nothing is changed.
- **HEAD identity** is `{branch: full refname or null if detached, sha}`. Comparisons
  compare both parts.
- **Status scan**: `git --no-optional-locks status --porcelain=v2 -z
  --untracked-files=all --ignore-submodules=none`. Every git read on the status path uses
  `--no-optional-locks`.
- **Protected paths**: at the first Try, `git ls-files -z --others --ignored
  --exclude-standard --directory` (directories collapsed), saved in the record: files
  git ignored before trying. Protection applies only to **untracked** (`?`) scan entries:
  such an entry equal to or under a protected path is never backed up, cleared or
  reported. Tracked entries are never protected.
- **Clean**: the status scan has no entries after protected untracked entries are
  removed.
- **Switches** always run as `git -c submodule.recurse=false switch --no-guess
  --no-overwrite-ignore --no-recurse-submodules <short branch name>` or the same with
  `--detach <sha>`. Git refuses rather than overwrite an ignored file.
- **Outcome of a switch** is judged afterwards by HEAD identity plus a status scan, never
  by the exit code:
  - HEAD at the target and clean: success. A nonzero exit (for example a failing
    post-checkout hook) becomes a warning with git's last line.
  - HEAD at the target but not clean: success with a warning listing the files; they are
    treated as leftovers (backed up on the next move).
  - HEAD at the source and clean: nothing moved.
  - Anything else: the **unexpected state**; `pending` is kept and nothing is cleared
    automatically.
- **Pins**: `git update-ref refs/wheelchair/<return|backup>/<folder hash>/<nonce> <sha>`
  (nonce: 8 random hex chars). The full ref name is saved in the record before anything
  relies on it. Wheelchair never uses the stash list.
- **Back up the leftovers** (only while trying, i.e. never on Collin's own pre-trial work,
  which Try refuses). Makes a byte-exact private copy of every changed path and of the
  index, records it, then clears exactly those paths:
  1. Scan; drop protected untracked entries. Refuse (nothing changed, paths listed, "These
     changes can't be backed up safely") if the index has unmerged entries, or any
     listed path is now a directory where git expects a file, or any parent of a listed
     path is not a directory.
  2. Index copy: `git write-tree` (reads the real index, writes only objects), then
     `git commit-tree <tree> -p HEAD -m index` gives I.
  3. Working copy: with a temporary index (`GIT_INDEX_FILE=<tmp>`, `git read-tree HEAD`),
     for each listed path: missing on disk → `git update-index --force-remove`; symlink
     → blob of its link text (`git hash-object -w --no-filters --stdin`), mode 120000;
     regular file → `git hash-object -w --no-filters <path>`, mode 100755 if executable
     else 100644; added with `git update-index --add --cacheinfo <mode>,<sha>,<path>`.
     No filters run, so bytes (including Git LFS files and line endings) are kept
     exactly. `git write-tree`, then `git commit-tree <tree> -p HEAD -p I -m
     "wheelchair backup: changes while trying thread <id>"` gives B.
  4. Verify: recompute each path's type, mode and blob as in 3 and compare with B, and
     re-run `git write-tree` on the real index and compare with I. On a mismatch
     (something is still writing), retry from 1, at most three times, then stop with
     "Your copy keeps changing; close the app using it and try again". Nothing is pinned
     or cleared until verify passes.
  5. Pin B as `backup`, append `{ref, label, thread_id, files, at}` to `backups`, and
     write the record, all before clearing.
  6. Clear, path by path, only paths whose type, mode and blob still match B: tracked
     paths with `git restore --source=HEAD --staged --worktree -- ":(literal)<path>"`;
     untracked paths by unlinking that one file or link. Any path that no longer
     matches is left alone and reported.
  7. Scan. Not clean: stop and list the remaining files; HEAD unchanged; the backup stays
     listed.
  The window between a path's last check in 6 and its clear is an Accepted Risk.

**The record**, one per folder: `<stateDir>/tries/<sha256 of real folder path>.json`,
written atomically (temp file then rename):

```
{ folder, common_dir, version,          // version: random id, changes on every write
  active: null | { thread_id, commit, return_point: {branch, sha}, return_ref,
                   protected: [path] },
  pending: null | { op: "try"|"back", first: bool, thread_id,
                    from: HEADid, to: HEADid,
                    return_point?, return_ref?, protected? },   // first Try only
  backups: [ { ref, label, thread_id, files: [path], at } ] }
```

`active` is only ever written by a successful switch. A first Try keeps everything it
needs in `pending` until then.

**Trying** means `active` is set and HEAD is detached at `active.commit`. **Moved** means
`active` is set and HEAD is detached elsewhere (he committed while trying). **Stale**
means `active` is set and HEAD is attached to a branch (he switched by hand).

**Refusals** (nothing changes; the reason is shown). Folder checks first:
- not a git working tree top level (`git rev-parse --show-toplevel` must equal the
  folder's real path) or a bare repository;
- the folder lies under `<stateDir>/worktrees` (agents' copies, `machine/service.js:488-490`);
- the folder's real path equals or contains the real path of the running service's own
  source root (`ROOT`, `machine/service.js:29`; the hub makes the same check with its own
  root when `thread.machine` is the hub's machine): "This folder runs wheelchair itself;
  switching it would swap the running app for untested code.";
- a merge, rebase, `git am`, cherry-pick, revert or bisect is in progress (`MERGE_HEAD`,
  `rebase-merge`, `rebase-apply`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `BISECT_LOG` under
  `git rev-parse --git-dir`), or the index has unmerged entries;
- the record's identity does not match.
Then reconcile (5), then action checks:
- a submodule has changes, or the source and target trees differ in any gitlink
  (`git diff --raw --ignore-submodules=none <source> <target>` with mode 160000 on either
  side): "This thread changes a submodule, which isn't supported.";
- Try when `active` is null and the copy is not clean: lists the changed files, "Commit
  or put these aside, then press again.";
- Try or Switch back when Stale: "You switched your copy by hand. Dismiss first.";
- Try when `refs/heads/wc/<thread-id>` does not exist;
- Switch back when the return point is a branch that no longer exists or is checked out
  in another worktree (`git worktree list --porcelain`); the copy stays as it is;
- Switch back or Dismiss whose `version` differs from the record's: "Your copy changed
  since this page loaded", and the page re-reads status.
All of this, and every write, runs inside `inRepoQueue(path.resolve(thread.project))`
(`machine/service.js:547`), the same key the worktree and handoff calls use for this
project (`machine/service.js:496,1286`).

1. **Try it in my copy.** Confirmation names the folder and machine and says it brings in
   the thread's merged work so far (work agents have not yet merged into the thread is
   not included); when already trying with leftovers, it also says they will be backed up
   first.
   1. Target is the sha of `wc/<thread-id>`. If Trying this same thread at this sha:
      "Already showing the newest", no change. (Another thread at the same sha goes
      through the steps below.)
   2. If `active` is null: write `pending {op: "try", first: true, thread_id, from: HEAD,
      to: {branch: null, sha: target}, return_point: HEAD, return_ref, protected}`, then
      pin the return point.
   3. Otherwise: if Moved, pin HEAD as a backup ("commits made while trying thread
      <id>") and list it; if not clean, back up the leftovers. Then write `pending {op:
      "try", first: false, ...}`.
   4. Switch detached to the target and judge the outcome. Success: `active` set (from
      `pending` on a first Try, else thread and commit updated), `pending` cleared.
      Nothing moved: `pending` cleared; on a first Try also delete the return pin; git's
      line reported. Unexpected: `pending` kept.
   5. Reports what was backed up, if anything, and any success warning.
2. **Switch back.** Carries the shown `version`. Confirmation says anything changed while
   trying is backed up first, and suggests closing the app using the folder. Available
   from every thread page whose project is this folder, including archived threads and
   threads whose branch is gone.
   1. Resolve the return target now: a branch's current tip (it may have moved on, which
      is fine), or the saved sha. If Moved, pin HEAD as a backup. If not clean, back up
      the leftovers.
   2. Write `pending {op: "back", from: HEAD, to: <resolved return target>}`, switch,
      judge the outcome. Success: `active` and `pending` cleared, return pin deleted.
      Nothing moved: `pending` cleared, git's line reported, still trying. Unexpected:
      `pending` kept.
   3. Scan again; any new unprotected entries (files the trial's ignore rules hid) are
      listed in the result as "These files appeared after switching back", left in
      place.
   4. Reports what was backed up, if anything.
3. **Status** (GET, read-only, never fetches or writes, `--no-optional-locks`, under the
   same queue). Returns `version`, `active_thread_id`, `target_available` (whether
   `wc/<this thread>` exists) and one of: nothing; "Your copy is showing this thread's
   merged work as of <short sha>" (plus "Get newest" when `wc/<id>` moved on); "Your copy
   is showing another thread: <title>" with Switch back; "Your copy moved since you tried
   <thread>" with Switch back; Stale: "You switched your copy by hand" with Dismiss;
   `pending` set: "An earlier switch was interrupted; the next press finishes or undoes
   it"; unexpected state: "Your copy is in an unexpected state" with git's view of HEAD
   and Dismiss. Plus every backup: label, date, ref and file names, each with "Delete
   backup". The Try button shows only when `target_available` and the thread is not
   archived; the panel itself shows on every thread page for this folder.
4. **Dismiss** (version-checked): with Stale or unexpected state, clears `active` and
   `pending` and deletes the return pin. With a backup named, after a confirmation,
   deletes that backup's pin and list entry. Nothing else deletes a backup.
5. **Reconcile** (start of every write, after the folder checks): if `pending` is set,
   judge HEAD and a scan against `pending.to` (finish as success) and `pending.from`
   (clean: undo as "nothing moved", including clearing a first Try's return pin).
   Anything else is the unexpected state: writes other than Dismiss are refused until it
   is resolved. Backups are never touched by reconcile.
6. **Errors** reach Collin as one plain sentence under the control: machine
   unreachable, a refusal, or git's last line. After any write error or timeout, the page
   re-reads status rather than assuming the outcome.

### Where it lives

- **Machine** (`machine/service.js`): new hub-secret-only endpoint `POST /v1/try`,
  authorised like `/v1/handoff` (`machine/service.js:403-420,1602-1604`). Body
  `{action: "status"|"try"|"back"|"dismiss", thread_id, project, version?, backup?}`.
  `thread_id` matches `^[0-9a-f]{12}$`; `project` validated with `projects({check})`
  (`machine/service.js:1198-1232`); `version` required for `back` and `dismiss`;
  `backup` (a ref from the record) only for `dismiss`. Agents can never call it.
- **Hub** (`viewer/app/routes.js`, `viewer/app/machine-client.js:53-108`):
  `GET /api/threads/<id>/try` and `POST /api/threads/<id>/try` with body
  `{action: "try"|"back"|"dismiss", version?, backup?}`, under browser write auth
  (`viewer/server.js:1292-1298`), allowed for archived threads; `thread.machine` and
  `thread.project` always come from the thread record, never the request. The hub
  forwards `version` and `backup` as given and returns the machine's status fields plus
  the active thread's title.
- **Thread page** (`viewer/pages/thread.js`): a small "Your copy" panel near the top with
  the status line, buttons, confirmations, backups list and error line, shown also on
  archived threads (unlike the other actions gated on `t.archived`,
  `viewer/pages/thread.js:157,176`). Not a card; nothing reaches the lead.

### Non-goals

Merging, pushing or touching the pull request; launching any app; other machines or a
configurable folder; including uncommitted agent edits; changing agent git rules;
setting aside Collin's own changes (Try refuses instead); restoring a backup from the
app (status shows its ref and files); submodule changes.

### Validation

- `bash machine/test/run.sh`: new tests in `machine/test/service.test.js` against a temp
  repo with a linked worktree on `wc/<id>`:
  - try from a clean branch and back; from a detached start and back; try A, then B
    (including B at the same sha as A), then back to the original branch; back after the
    return branch advanced;
  - try refused when dirty (tracked, untracked; with `status.showUntrackedFiles=no`);
  - back with leftovers: tracked edit, untracked file, staged-then-reverted file (index
    copy kept), executable bit, symlink, a file with a clean filter (bytes kept); backed
    up, cleared, listed with ref and files;
  - a tracked file replaced by a directory (refused, directory and its ignored files
    intact);
  - a file changing between snapshot and verify (retried, then refused, nothing pinned
    or cleared);
  - a tracked path colliding with an ignored file both ways (refused, file intact);
  - a thread that removes an ignore rule (the file stays, not backed up, back succeeds);
    a thread that adds a tracked file under an originally ignored directory (its edits
    are backed up);
  - a gitlink change with `diff.ignoreSubmodules=all` set (refused);
  - folder under the worktrees dir, the service root, `git am` in progress (refused);
  - failing post-checkout hook (success with warning); a checkout that leaves files
    dirty (success with warning, leftovers); interruption with `pending` set before and
    after the switch, and after a backup is listed but before clearing (reconcile);
  - commit made while trying (pinned and listed); return branch deleted or checked out
    elsewhere (refused); stale record (Try and Back refused; Dismiss clears, backups
    kept); folder replaced by another repository (identity refused); stale `version`
    on back and dismiss (refused).
- `node --test viewer/test/*.test.js`: routes resolve machine and project from the
  record; `version` and `backup` forwarded; archived threads allowed;
  unauthenticated writes refused.
- `npm --prefix viewer run test:browser`: the panel shows status, confirmations,
  backups, Switch back from another thread's page and from an archived thread, and an
  error line.

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
| intent | major | Switch back unreachable once the tried thread is archived or its branch gone | upheld (`viewer/pages/thread.js:157,176`) | Panel on every thread page of the folder, archived included (2, 3) |
| intent | major | Interrupted first Try looks Stale | upheld | First Try state kept in `pending`; reconcile undoes it (1.2, 5) |
| intent | minor | Try's backup of leftovers is silent | upheld | Confirmation and report (1, 1.5) |
| intent | minor | Backup list lacks ref and file names | upheld | Status lists both (3) |
| intent | minor | Files hidden by the trial's ignore rules appear after Back | upheld | Listed after Back (2.3) |
| intent | minor | Decision 11 still names `kept/` refs | upheld | Decision 15 |
| mechanics | blocking | Backup can drop staged content | downgraded to major: needs staging during a trial | Index copy I as second parent (Back up 2, 4) |
| mechanics | blocking | `git add` filters change bytes; symlinks followed | upheld (LFS is common in game projects) | `hash-object --no-filters`, modes, link text (Back up 3) |
| mechanics | blocking | Restoring a file replaced by a directory removes the directory | downgraded to major: rare | Refused in Back up 1 |
| mechanics | blocking | HEAD alone cannot certify a checkout | downgraded to major | Outcome also needs a status scan |
| mechanics | blocking | Folder path not bound to the repository | downgraded to major: needs the folder replaced mid-trial | Identity check |
| mechanics | blocking | Pre-trial edit made during the first switch rides into the trial | downgraded to minor: it is backed up on return, not lost | Success-with-warning lists it |
| mechanics | major | Return branch advanced: two targets | upheld | Back resolves the current tip (2.1) |
| mechanics | major | Journal gaps for first Try and return ref | upheld | `pending` carries first-Try state and `return_ref`; backup listed before clearing |
| mechanics | major | Collapsed protected directory masks tracked files | upheld | Protection only for untracked entries |
| mechanics | major | Submodule check honours `diff.ignoreSubmodules` | upheld | `--ignore-submodules=none`, both modes |
| mechanics | major | Same-sha other thread reported as no-op | upheld | No-op only for the same thread (1.1) |
| mechanics | major | Queue key can differ from the existing calls' key | downgraded to minor: existing calls key on `path.resolve(project)` too | Same key specified |
| mechanics | major | `git am` and unmerged index not refused | upheld | Added to folder checks |
| mechanics | minor | Status lacks target availability | upheld | `target_available`, `active_thread_id` |
| mechanics | minor | Status scan can write the index | upheld | `--no-optional-locks` |

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
