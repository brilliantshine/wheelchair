---
slug: plan-handoffs
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Plan handoffs: export and import a thread

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Importing into an app that already has the thread points back to it, or advances it when the import is a later stage; never a duplicate | Collin's rule, folded into IDEA.md | idea-change |
| 2 | The export is one JSON file (`<title>.wheelchair.json`), not a zip | Code and plan documents travel on the branch, so what remains is small structured data | defaulted |
| 3 | Export pushes the thread's branch first; if the push fails, no file is produced | IDEA's constraint says work must be on GitHub; doing it for him removes a step he would otherwise forget | defaulted |
| 4 | The file carries thread identity (id, title), repository (GitHub remote URL), branch and head commit, plan slug, stage, the cards and the last messages (the same set a lead restart uses), and an export time. Not agent transcripts, not uploads | Mirrors the existing restart context (`viewer/app/threads.js:122-157`), which already lets a fresh lead carry on; plan documents are on the branch | defaulted |
| 5 | Import starts from the new-thread screen: pick machine and project, choose the file. The project's GitHub remote must match the file's repository, or import is refused with the reason | A file from another repository cannot resume against this code | defaulted |
| 6 | An imported thread's lead starts with a new `[wc:context import]` message, built like the restart context, and its reply is shown | Reuses the restart path the lead protocol already handles | defaulted |
| 7 | The file is validated (schema, size limit, known stage) before anything is created; its text is shown and used as data, never run | The file may come from elsewhere | defaulted |
| 8 | Export points are three: idea confirmed, plan approved, done | Collin picked the three major points over any quiet moment | user |
| 9 | The imported thread is the same thread: it keeps the original thread id, branch `wc/<id>` and pull request | Collin chose same thread; one piece of work stays one branch and one pull request, and duplicate detection is by id | user |
| 10 | After export the original thread is marked handed off: readable, takes no new work, undoable; a newer re-import revives it | Collin's pick; keeps two copies from moving on at once without discarding the original | user |
| 11 | Re-import advances the existing thread only when the file is strictly ahead; when the copies drifted apart it opens the existing thread and explains, changing nothing | Collin's pick; never loses work silently | user |
| 12 | Strictly ahead is decided by git ancestry of the heads alone, not by comparing stage names | Stage moves only with committed PLAN.md changes, so the heads already order it; one rule instead of two | defaulted |
| 13 | Archived threads cannot be exported; an archived thread found on import counts as existing and can be advanced | No worktree to push from; reviving fits the no-duplicates rule | defaulted |
| 14 | Carried cards that were still open are stored withdrawn; the new lead posts fresh ones | Avoids pressing a card whose asker no longer exists | defaulted |
| 15 | Whoever picks the work up pushes an empty "picked up" commit to the branch first; import refuses when the branch moved past the export, and undo hand-off refuses when the branch moved | Collin's proposal: makes a pick-up visible on GitHub so a second import or an undo can't start a second copy. Empty commit chosen so nothing lands in the files | user |
| 16 | Undo hand-off also claims the branch ("taken back") and is refused if the claim loses | Closes the undo-then-import race that decision 15 meant to prevent | review-round-1 |
| 17 | Claims are made without a worktree (`commit-tree` + non-forced push) before any local change | Atomic; a lost race changes nothing | review-round-1 |
| 18 | Export needs a clean worktree, reads stage from committed HEAD, and is blocked once the pull request is merged or the origin isn't GitHub | Only commits travel; a merged thread has nothing to hand off | review-round-1 |
| 19 | Carried cards replace the importing thread's cards, all open ones withdrawn; carried messages join the thread's sent history; the import context is stored for recovery | No stale presses; later restarts and exports keep the history; a failed lead start can recover | review-round-1 |
| 20 | File limit 10 MB on both sides, sent as raw bytes | Export and import check the same size | review-round-1 |
| 21 | The file carries a plain-text history instead of live cards and pins; supersedes the card parts of 14 and 19 | Carried cards could be pressed and needed a round-trip schema for every stored field; decisions already travel in PLAN.md | review-round-2 |
| 22 | Claims use `--force-with-lease` on the exact parent, a nonce, and a claim record saved before the push; an unfinished import has a Finish import button | Atomic, recognisable as ours after a crash, and always recoverable | review-round-2 |
| 23 | Done is exportable only while the pull request is open (checked live) and nothing is waiting to be pushed | Keeps an unverified after-done fix or a merged branch out of a handoff | review-round-2 |
| 24 | Leads commit IDEA/PLAN before ending a planning turn (lead.md step 4) | Makes every planning pause a committed state the export gate can see | review-round-2 |

## Spec

Terms: the **source** thread is the one exported; the **file** is the export; the
**importing app** is the hub the file is imported into (it may be the same hub). The hub
runs `viewer/app/*`; the machine service runs `machine/service.js`. A **claim** is an empty
commit pushed to the thread's branch on GitHub to show who holds the work (see Claims).

Every handoff operation below (export, undo, import's create and advance, finish-import)
runs inside the hub's per-thread lock, `hub.withThread(id, ...)`
(`viewer/app/hub.js:90-100`), from its eligibility checks to its last save, so a message,
press or second import for the same thread id waits for it.

### Export points

A thread can be exported at exactly three points. At each, the thread must also be
**quiet**:

- not archived, not handed off, not an unfinished import (see Recovery);
- no session other than the lead is `live`; the lead is either not live, or live with
  `turn_ended === true` (`viewer/app/sessions.js:515-543`); no message is queued for any
  session of the thread;
- no aside is open or has a turn running (`thread.asides`, `viewer/app/asides.js`);
- no `sudo` card is in state `waiting`;
- the worktree has no uncommitted changes (`git status --porcelain` empty, untracked
  files included).

The stage is read from the **committed** files at the worktree's `HEAD`
(`git show HEAD:docs/plans/<slug>/IDEA.md` and `PLAN.md`), never from the working files.

| Point (`stage` in the file) | Holds when | Import resumes at |
|---|---|---|
| `idea-confirmed` | IDEA.md `status: confirmed`; PLAN.md absent or `status: planning`; no `question` card answered after the last answered question card whose `doc` is `IDEA.md` (so no planning question has been answered yet) | Planning (lead step 4): the lead reads IDEA, MAP and any PLAN.md on the branch and asks the open questions again |
| `approved` | PLAN.md `status: approved`; no `approval` card was answered with Start building | Approval (lead step 6): the lead posts a fresh approval card with a fresh Ready check |
| `done` | PLAN.md `status: done`; a non-replaced `done` card with `pr_url` exists; no `merged` card exists; the pull request's current state, read at export time with `gh pr view <pr_url> --json state` on the machine, is `OPEN`; and the worktree `HEAD` equals `origin/wc/<id>` after a fetch, so no after-done fix is waiting on its check or on Collin | After done (lead step 9) |

A retracted approval card does not block the `approved` point. The `idea-confirmed`
rule needs no new card field: the lead already gives IDEA confirmation cards
`doc: "IDEA.md"` (`protocol/app/lead.md:167-170`), and any later answered question is a
planning answer, in old threads too.

When the thread is not at an export point, the export control is shown disabled with one
line saying why. The hub computes it; first match wins:

| Reason | Shown |
|---|---|
| archived | "Archived threads can't be exported" |
| handed off | "Already handed off" |
| unfinished import | "Finish the import first" |
| `merged` card exists, or the PR is not open at export | "The pull request is merged or closed; nothing left to hand off" |
| origin not on GitHub | "This project's origin isn't on GitHub" |
| another live session or an aside running | "Agents are still working" |
| lead mid-turn or anything queued | "The lead is busy" |
| sudo waiting | "A root command is waiting" |
| dirty worktree | "Some changes aren't committed yet" |
| `done` with HEAD not equal to the remote tip | "A fix is still being checked" |
| no point holds | "Not at a stopping point: export after the idea is confirmed, once the plan is approved, or when it's done" |

The disabled reason shown on the page is computed from hub state and the last `status`
read; the PR-state and remote-tip checks run only when Export is pressed.

### The file

One JSON object, UTF-8, at most **10 MB** as bytes on the wire, downloaded as
`<title-kebab>.wheelchair.json` (title lower-cased, non-alphanumerics collapsed to `-`,
cut to 60 characters, fallback `thread`). All fields required unless noted; an unknown
field at any level is refused on import:

| Field | Value |
|---|---|
| `format` | `"wheelchair-handoff"` |
| `version` | `1` |
| `exported_at` | ISO time |
| `thread` | `{id, title, slug}`; `id` matches `^[0-9a-f]{12}$`; `slug` matches `^[a-z0-9][a-z0-9-]*$`; `title` a string of at most 80 characters |
| `repository` | `github.com/<owner>/<repo>` (see Normalization) |
| `branch` | `wc/<id>` |
| `head` | 40-hex sha the export push left on `origin/wc/<id>` |
| `stage` | `idea-confirmed`, `approved` or `done` |
| `pr_url` | string; required when `stage` is `done`, absent otherwise |
| `history` | array of history entries, oldest first, at most 2000 |

A **history entry** is `{at, who, kind, text}`, all strings: `at` an ISO time; `who` one of
`collin`, `lead`, `app`; `kind` one of `message`, `press`, or a card kind from
`protocol/app/cards.md`; `text` at most 20,000 characters. It is a plain-text record of
what happened, never a live card. Export builds it from, in time order:

- the thread's own `imported.history`, if it was itself imported (so history accumulates
  across handoffs);
- each sent message from `collin` or `card` in `thread.sent` (`who` `collin`, `kind`
  `message` or `press`, `text` the message text);
- each non-replaced card shown to Collin (`who` `lead` or `app`), with `text` rendered by
  one function, `historyText(card)`, defined per kind: question → question, the options'
  labels, and the answer or "withdrawn"; idea → the bullets; approval → objections and
  outcome; done → title, can_do, left_as_is, pr_url; needs → title and body; offer →
  summary and answer; stub → title; diagram/image → title; sudo → command and outcome;
  progress cards are skipped. Never-shown kinds are skipped.

When the entries exceed 2000 or the file 10 MB, the oldest entries are dropped and one
entry `{who: "app", kind: "message", text: "<n> earlier entries were left out"}` is put
first.

Not in the file: cards as objects, pins, the machine, project path, CLI, provider,
sessions, transcripts, uploads, asides, queues. Plan decisions travel in PLAN.md's
Decision Log on the branch; the history is for reading.

### Claims

A claim is an empty commit on `wc/<id>` whose parent is an expected commit, pushed so it
lands only if the remote tip is **exactly** that parent:

1. `git commit-tree <parent>^{tree} -p <parent> -m "<message>"` in the project repository,
   where `<message>` is `handoff: picked up <ISO time> <nonce>` (import) or
   `handoff: taken back <ISO time> <nonce>` (undo), and `<nonce>` is 8 random hex
   characters, so no two claims are the same commit.
2. `git push --force-with-lease=refs/heads/wc/<id>:<parent> origin <claim>:refs/heads/wc/<id>`.
   The lease makes the push fail if the remote branch is missing, rewound, or anywhere
   other than `<parent>`; the update is a fast-forward because the claim's parent is
   `<parent>`.

The hub saves `claim: {sha, parent, purpose: "import"|"undo", at}` on the thread record
**before** step 2, after the machine returns the sha from step 1. A claim is then
**ours** when the remote tip equals `claim.sha`. Every handoff operation that finds a
saved claim first asks the machine for the remote tip: tip == `claim.sha` means the claim
landed, so the operation continues from after the claim; tip == `claim.parent` means it did
not land, so it pushes again; anything else means someone else moved the branch, so the
operation refuses with "picked up elsewhere" and clears `claim`. A completed operation
clears `claim`.

Someone taking the branch by hand, without wheelchair, is asked (README) to push such a
commit too; wheelchair cannot enforce that.

### Export

`POST /threads/:id/export` (hub route, beside restart and archive in `viewer/app/routes.js`).

1. Re-check the export point and quiet test, including the machine `status` call; on
   failure 409 with the reason sentence.
2. Ask the machine to push `wc/<id>` from the thread's worktree to `origin`
   (`/v1/handoff` `push`, a plain non-forced push). It returns the pushed head and the
   normalized repository. On failure 409 "Couldn't push the branch to GitHub: <git's last
   line>"; nothing changes.
3. Build the file, trimming history as above.
4. Save `handed_off: {at, head, stage}` on the record and cancel asides as archive does
   (`viewer/app/threads.js:163-167`). If the save fails, 500 and nothing else changes.
5. Stop every live session of the thread as `session stop` does. If a stop fails, carry
   on: the thread is already handed off, so nothing reaches that session (below).
6. Respond 200 with the file as `application/json` and
   `Content-Disposition: attachment; filename="<name>"`.

Thread page: an **Export** button in the head beside Archive (`viewer/pages/thread.js:147-166`).
Enabled only at an export point, otherwise disabled with the reason as a line under it
(the thread view payload carries `export: {ok, reason}`). Pressing it asks "Export and hand
off? This thread stops taking work here." with Confirm / Cancel; Confirm downloads the file.

### The original thread after export

- A handed-off thread is readable but takes no new work. The hub refuses with 409 "handed
  off": messages, uploads, card presses and dismissals, card posts from any session of the
  thread, session starts, aside creation and aside messages, `restart`, and terminal keys
  (`POST /sessions/:name/keys`, `viewer/app/routes.js:520`). Queue delivery
  (`canDeliver`, `viewer/app/sessions.js:428`) delivers nothing to a session of a
  handed-off thread, and the rate-limit release (`viewer/app/sessions.js:761`) enqueues
  nothing for one. The composer, attach and card buttons are disabled, and the "Restart
  lead" panel (`viewer/pages/thread.js:268-278`) is not shown.
- The page shows a banner. When the page loads, it asks the hub
  `GET /threads/:id/handoff`, which runs `inspect` (cached for 60 seconds) and reports
  whether the remote tip is still `handed_off.head`:
  - unchanged: "Handed off <date>. Import a newer file to continue here, or undo." with an
    **Undo hand-off** button (only when not archived);
  - moved: "Picked up elsewhere on <date>. Import a newer file to continue here." and no
    Undo;
  - inspect failed: the first text, and Undo stays available (undo checks again).
- `POST /threads/:id/undo-handoff`: claim on top of `handed_off.head` (purpose `undo`).
  If the claim is refused, 409 "This was picked up elsewhere on <date>; import a newer file
  to continue here". On success: stop any session of the thread still live, fast-forward
  the worktree to the claim (`/v1/handoff` `fast-forward`), clear `handed_off` and
  `claim`, save, and run the restart path (`restartLead`, `viewer/app/threads.js:122-159`).
- A handed-off thread can be archived like any thread. An archived handed-off thread shows
  no Undo; only an import can bring it back.
- The threads list shows a "handed off" label on such threads.

### Import

New-thread screen (`viewer/pages/new.js`): a second action **Import a handoff** beside
Start. It uses the same machine and project pickers and a file chooser (`.json`). The
page sends `POST /threads/import?machine=<m>&project=<p>` with the file's raw bytes as the
body. The hub refuses a body over 10 MB (413) before parsing. The project path is validated
as in `createThread` (`viewer/app/threads.js:43-64`); the machine and project come from the
picker, never the file.

The hub then, inside `withThread(<file thread id>)`:

1. **Validates** the file: JSON, the fields and patterns above, `format`, `version`,
   `stage`, `branch === "wc/" + thread.id`, the `pr_url` presence rule, and each history
   entry's fields, types and limits. Failure: 422 "This isn't a handoff file wheelchair
   can read: <what>".
2. **Matches the repository**: the machine reports the project's normalized origin.
   Mismatch: 422 "This file is for <file repo>, but that project is <project repo>".
3. **Inspects the branch** (`/v1/handoff` `inspect`): fetch; `origin/wc/<id>` must exist and
   contain `head`, otherwise 409 "The branch on GitHub doesn't have the exported work".
   At `head`, the committed IDEA.md and PLAN.md must satisfy the `stage`'s status
   conditions from the Export points table. Otherwise 422 "The file says <stage>, but the
   branch doesn't".
4. **Looks for the thread id** in this hub, archived or not, and picks the first row that
   matches:

| Case | Outcome |
|---|---|
| No such thread | **Create** |
| Exists with `imported.pending` or a saved `claim` | **Finish** that operation (see Recovery), ignoring this file; outcome as that operation's |
| Exists on another machine or project than the picker chose | **Open**, note "This thread lives on <machine>, <project>" |
| Exists; its head equals `head`, or `head` is an ancestor of its head | **Open**, change nothing. Note: "You already have this thread here", plus " It's handed off: press Undo on it to carry on here." when it is handed off, not archived and the tip is unchanged; or "This file is older than the thread here" |
| Exists; its head is a strict ancestor of `head` | **Advance** |
| Exists; neither is an ancestor of the other | **Open**, change nothing; note "This thread and the file have each moved on separately, so nothing was changed. Bring the branches together yourself, then import again." |

   "Its head" is, in order: the `HEAD` of the thread's worktree if that directory exists
   and is a git worktree; else the local `wc/<id>` ref in the project; else
   `handed_off.head`. Ancestry uses `git merge-base --is-ancestor`.

   For Create and Advance, the remote tip must also **equal** `head`. A tip past `head`
   means someone already picked the work up: 409 "This was already picked up elsewhere on
   <committer date of the first commit after head>; export again from wherever it is now".

Responses: `{outcome: "created"|"advanced"|"opened", id, note?}`. The page navigates to
the thread for `created` and `advanced`; for `opened` it shows the note and an "Open the
thread" link.

**Carried state**, used by Create and Advance: save `imported: {at, stage, exported_at,
history, pending, claim_sha, context_delivered: false}` where `history` is the file's
history. The thread page renders `imported.history` above the thread's own conversation as
a collapsed, read-only "Before the handoff" section: one line per entry (`at`, `who`,
`text`), as plain text, no buttons. On Advance, the thread's existing cards are all marked
answered as retracted (`retracted_by: "import"`, note "Replaced by an import") and every
pin is cleared, so nothing from before can be pressed; the lead posts fresh cards.

The lead's context message is
`[wc:context import] Thread state:\n<JSON {slug, stage, exported_at, history}>`.

**Create**, in this order:
1. Save a record with the file's `id`, `title`, `slug`, the picked machine and project,
   `branch: wc/<id>`, and `imported` with `pending: true`. No session.
2. Claim on top of `head` (purpose `import`), saving `claim` first. Refused: delete the
   record, 409 "already picked up elsewhere".
3. Set `imported.claim_sha`, clear `claim`, save.
4. Start a lead with `from_remote_branch: {sha: imported.claim_sha}` (machine change
   below), so its worktree is `wc/<id>` at the claim commit exactly.
5. Queue the `[wc:context import]` message to it, clear `imported.pending`, save.

**Advance**, in this order:
1. Refuse 409 "The thread here is busy" unless the existing thread has no live session
   other than the lead, no aside open or running, the lead is idle or not live, and no
   session of the thread has anything queued. Refuse 409 "The thread here has uncommitted
   changes" if its worktree exists and is dirty.
2. Save `imported` with `pending: true`. Claim on top of `head`, saving `claim` first.
   Refused: clear `imported.pending`, 409 "already picked up elsewhere"; nothing else
   changed.
3. Set `imported.claim_sha`, clear `claim`, save. Stop every live session of the thread.
4. If the worktree directory exists and is a git worktree on `wc/<id>`, fast-forward it to
   the claim (`/v1/handoff` `fast-forward`). Otherwise clear `worktree` on the record, so
   step 6 builds one; set `archived: false`.
5. Retract every card and clear pins (Carried state); clear `handed_off`; save.
6. Start a lead (in the existing worktree as restart does, or with
   `from_remote_branch: {sha: imported.claim_sha}`), queue the `[wc:context import]`
   message, clear `imported.pending`, save.

### Recovery

An import is **unfinished** while `imported.pending` is true or a `claim` is saved. An
unfinished import blocks export and refuses messages and presses with 409 "Finish the
import first".

- The thread page shows, instead of the composer, a panel "The import didn't finish." with
  a **Finish import** button. It is shown whenever the import is unfinished and no lead of
  the thread is live, whether or not any session was ever recorded.
- `POST /threads/:id/finish-import` re-runs Create or Advance from the first step not yet
  done, which the saved fields tell: a saved `claim` resolves as in Claims; no
  `imported.claim_sha` means the claim never landed; a `claim_sha` with no live lead means
  start the lead. A worktree is reused if its directory exists and its `HEAD` is the claim
  or an ancestor of it (then fast-forwarded); else built with `from_remote_branch`.
- After `imported.pending` clears: if the lead dies before `context_delivered` is set,
  `restartLead` sends `[wc:context import]` instead of `[wc:context restart]`. The hub sets
  `context_delivered: true` when the lead's first turn after delivery ends.
- Restart for any thread includes `imported.history` (when present) in its context JSON as
  `history_before_import`.

### Machine service changes (`machine/service.js`)

- `createWorktree` (`machine/service.js:425-478`) gains `input.from_remote_branch: {sha}`:
  after the fetch, `sha` must be an ancestor of or equal to `origin/<branch>`. If no
  local `wc/<id>` exists: `git worktree add -b <branch> <dest> <sha>` then
  `git -C <dest> branch --set-upstream-to=origin/<branch>`. If it exists and is an ancestor
  of `sha`: `git worktree add <dest> <branch>` then `git -C <dest> merge --ff-only <sha>`.
  Otherwise fail with "a local branch <branch> already exists and differs". The worktree
  counts as created by this start for archive ownership, as the default path does
  (`machine/service.js:531-540`). The default path is unchanged.
- New hub-only endpoint `POST /v1/handoff`, authorized like `/v1/archive`
  (`machine/service.js:1234`), with `action`:
  - `status` `{worktree, slug, pr_url?}` → fetch; `{dirty, head, remote_tip,
    idea_status, plan_status, repository, pr_state}` from `git status --porcelain`,
    `git show HEAD:...`, the origin, and `gh pr view <pr_url> --json state` when `pr_url`
    is given (`pr_state: null` and `pr_error` when gh fails, which blocks a `done` export
    with "Couldn't check the pull request").
  - `push` `{worktree, branch}` → `git push origin <branch>`; returns `{head, repository}`.
  - `inspect` `{project, branch, head, worktree?, slug}` → fetch; returns `{repository,
    remote_tip, remote_has_branch, remote_contains_head, picked_up_at, local_head,
    worktree_exists, relation, idea_status, plan_status}`. `local_head` follows the "its
    head" order above (the hub supplies `handed_off.head` as a fallback field).
    `relation` is `same`, `behind` (file older), `ahead` (file strictly ahead) or
    `diverged`. `picked_up_at` is the committer date of the first commit after `head` when
    the tip is past it. Statuses are read with `git show <head>:docs/plans/<slug>/...`
    (null when absent).
  - `claim-commit` `{project, parent, message}` → step 1 of Claims; returns `{sha}`.
  - `claim-push` `{project, branch, parent, sha}` → step 2; returns `{landed: true}` or
    409 `{remote_tip, picked_up_at}`.
  - `fast-forward` `{worktree, head}` → refuses on a dirty worktree, else
    `git merge --ff-only <head>`.
  - Branch names must match `^wc/[0-9a-f]{12}$`, shas `^[0-9a-f]{40}$`, slugs the file's
    pattern, and `worktree`/`project` must be paths the machine already knows; anything
    else 422.

### Normalization

One function, in the machine: `git@github.com:o/r.git`, `https://github.com/o/r`,
`https://github.com/o/r.git`, `ssh://git@github.com/o/r(.git)` → `github.com/o/r`,
lower-cased. Any other origin returns `null`, which blocks export ("origin isn't on
GitHub") and import (422 "That project's origin isn't on GitHub").

### Protocol

- `protocol/app/lead.md`:
  - new subsection under "Restarting what died": "Imported threads". On
    `[wc:context import]`, reply (shown) with a line saying the thread was imported and
    where it stands, run `session list`, then resume at the step the `stage` names (table
    above), reading the plan documents on the branch. The history is for context; post
    fresh cards for anything still needed.
  - step 4: commit IDEA.md and PLAN.md (`wc.js git commit`) before ending any turn that
    changed them, so a planning pause is always a committed, exportable state.
- `protocol/app/cards.md` marker table: add `[wc:context import]` (hidden; reply shown,
  with "Imported from a handoff" in its place). Mirror it wherever the app replaces the
  restart marker's bubble.
- README: one short section on export, import and claims.

### Non-goals

- No code, uncommitted files, uploads, transcripts or live cards in the file.
- No export or resume mid-step; no export of archived, merged or closed threads.
- No merging of diverged copies.
- No cross-repository import, and no non-GitHub origins.
- No encryption or signing of the file.

### Validation

New tests, then the suites:

- `viewer/test/app-handoff.test.js` (hub, with the existing fake machine):
  - export refused with each reason in the table, including a dead lead that is
    otherwise quiet being **allowed**; export at each point returns a valid file, marks
    handed off, cancels asides, stops sessions; push failure and save failure change
    nothing; a failed stop still hands off; history built and trimmed;
  - handed-off thread refuses each listed route, delivers nothing from its queue, and the
    rate-limit release enqueues nothing; banner states (unchanged, moved, inspect failed);
    undo claims and restarts; undo refused when the claim is refused; no Undo when archived;
  - import validation failures (bad JSON, bad id, wrong version, unknown field, bad
    history entry, stage not supported by the branch, repo mismatch, non-GitHub origin,
    missing branch, body over 10 MB);
  - create: claim saved before push, record and history saved, `[wc:context import]`
    queued; claim refused deletes the record; two concurrent imports of one id serialize;
  - recovery: crash after claim push before save (tip == claim.sha) finishes; lead start
    failure shows Finish import and finishing starts the lead at the claim sha; Restart
    sends `[wc:context import]` until the first turn ends, then `[wc:context restart]`;
  - open (same, older, handed-off note, diverged, other machine, archived with retained
    worktree); advance (live, archived without worktree, archived with retained worktree;
    old cards retracted and pins cleared); advance refused when busy, queued, dirty, or
    the tip moved past `head`.
- `machine/test/service.test.js`: worktree from remote branch at a sha (new local,
  existing ancestor, existing diverged, sha not on the remote) and its archive ownership;
  `/v1/handoff` status (dirty, statuses at HEAD, pr_state and gh failure), push, inspect
  (each relation, statuses at head, picked_up_at, missing worktree), claim-commit
  (distinct shas), claim-push (lands, refused on moved tip, refused on deleted branch,
  refused on rewound branch), fast-forward; input validation; normalization table.
- Browser (`viewer/test/*.spec.js`): Export button disabled with reason, confirm and
  download; handed-off banner and Undo; Finish import panel; "Before the handoff" section;
  new-thread Import flow for created and opened.

```bash
node --test viewer/test/*.test.js
bash machine/test/run.sh
npm --prefix viewer run test:browser
```

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Undo doesn't claim the branch, so a later import of the same file starts a second copy | upheld | Undo now claims ("taken back"); refused if the claim loses |
| intent | major | Export reads working files and ignores uncommitted changes | upheld | Quiet test requires a clean worktree; stage read from committed HEAD |
| intent | minor | Export at done recreates a merged branch | upheld | `merged` card blocks export |
| intent | minor | Re-import into the source hub opens a locked thread without saying so | upheld | Open note mentions handed off and Undo |
| intent | minor | Retracted approval blocks the approved point | upheld | Approved point no longer needs a pinned card |
| mechanics | blocking | Undo checks but never claims; race with import | upheld | Same fix as the intent finding; claim is an atomic non-forced push |
| mechanics | blocking | Failed pick-up in Advance leaves a stopped lead and moved branch | upheld | Claims made without a worktree (`commit-tree` + push) before any local change |
| mechanics | blocking | Claim succeeds then lead start or save fails: no recovery | upheld | Record saved before the claim; `import_context` stored; Restart sends import context until delivered |
| mechanics | blocking | Dirty worktree lets the file claim a stage the branch lacks | upheld | Clean-worktree test; statuses from HEAD; import checks statuses at `head` |
| mechanics | blocking | Export stop/save order contradictory; failed stop leaves live lead | upheld | Save before stop; handed-off threads refuse every input route and card post |
| mechanics | blocking | Advance keeps stale cards; old approval still pressable | upheld | Carried cards replace the list; every open card retracted |
| mechanics | major | Pre-creating a worktree before claim breaks archive ownership | upheld | No pre-creation; worktree built by the lead start with `from_remote_branch`, owned as usual |
| mechanics | major | Archived handed-off thread's Undo restarts into a removed worktree | upheld | No Undo on archived threads; import revives them |
| mechanics | major | Asides unspecified in quiet test and handed-off state | upheld | Quiet test excludes running asides; export cancels asides; handed-off refuses aside routes |
| mechanics | major | Card validation too shallow | upheld | Each card checked with `validate()` plus stored-field types; pins must name carried cards |
| mechanics | major | Stage not checked against the branch on import | upheld | `inspect` reads statuses at `head`; done needs the matching done card |
| mechanics | major | Size limit lost through parsed JSON; export has no oversize path | upheld | Raw body, 10 MB on both sides; export refuses oversize |
| mechanics | major | Carried messages lost on the next restart or export | upheld | Appended to `thread.sent` |
| mechanics | major | Non-GitHub origins unspecified | upheld | Normalization returns null; export and import refuse |

### Round 2 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:**
- New Claims section: empty commit via `commit-tree` + non-forced push; used by import and undo.
- Quiet test adds asides and a clean worktree; stage read from committed HEAD; reasons table; `merged` and non-GitHub blocks.
- Export order: push, size check, save, stop lead.
- Handed-off thread refuses all input routes, card posts, session starts and asides; undo claims; no Undo when archived.
- Import: raw-body 10 MB limit; deep card validation; stage checked at `head`; carried state replaces cards and joins `sent`; Create and Advance step orders; Recovery via stored `import_context`.
- Machine: `from_remote_branch` archive ownership; `/v1/handoff` gains `claim` and `status`; Normalization section.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | A thread whose lead died at a clean point can't be exported, with no fitting reason | upheld | Quiet test accepts a lead that is not live |
| intent | major | Retry after a claim with no local branch has no defined relation | upheld | Saved `claim` and `imported.pending` route a retry to Finish; "its head" falls back to `handed_off.head` |
| intent | minor | Banner keeps offering Undo after a pick-up elsewhere | upheld | Page asks `GET /threads/:id/handoff`; banner and Undo follow the remote tip |
| intent | minor | `doc: PLAN.md` tagging misses older threads | upheld | Idea point uses "no question answered after the last IDEA.md card"; no new tag needed |
| mechanics | blocking | Claim push doesn't enforce the exact remote tip; identical claims collide | upheld | `--force-with-lease=<ref>:<parent>` and a nonce in the message |
| mechanics | blocking | A landed claim can be stranded by a lost response or failed save | upheld | Claim sha saved before the push; tip == sha recognised as ours on retry |
| mechanics | blocking | Restart can't recover an import whose lead never started | upheld | Finish import panel and route, idempotent from saved fields |
| mechanics | blocking | Worktree follows the latest remote tip, not the claim | upheld | `from_remote_branch: {sha}` checks out the claim sha exactly |
| mechanics | blocking | No per-thread lock around handoff operations | upheld | All handoff operations run inside `hub.withThread` |
| mechanics | blocking | Advance ignores queued messages | upheld | Anything queued counts as busy |
| mechanics | blocking | Normal confirmation flow may not leave a committed pause | upheld | lead.md step 4 commits IDEA/PLAN before ending a turn that changed them |
| mechanics | blocking | Done point can export an unverified after-done fix | upheld | Done needs HEAD == remote tip after fetch |
| mechanics | blocking | Carried cards stay pressable (done card buttons) | upheld | Cards no longer carried; plain-text history instead; Advance retracts local cards and clears pins |
| mechanics | major | Other paths can still feed a handed-off lead | upheld | Guards on dismiss, terminal keys, queue delivery and rate-limit release; undo stops live sessions |
| mechanics | major | No round-trip contract for stored card shapes | upheld | Removed with card carrying; history entries have a fixed small schema |
| mechanics | major | Archived doesn't mean the worktree is gone | upheld | Inspect reports worktree existence; Advance reuses a retained worktree |
| mechanics | major | Merged gate is a cached signal | upheld | `gh pr view` state checked at export |

### Round 3 — 2026-11-17

**Lanes:** intent and mechanics; cross-family: yes.

**Changed since Round 2:**
- The file: `history` (plain-text entries, `historyText`) replaces `cards`, `pinned`, `recent_messages`; unknown fields refused at any level.
- Claims: `--force-with-lease` on the exact parent, nonce, claim record saved before the push, ours-detection on retry; machine `claim-commit` and `claim-push`.
- Per-thread lock for every handoff operation.
- Quiet test: dead lead allowed, any queue busy; idea point rule by last IDEA.md card; done point needs open PR (live `gh pr view`) and HEAD == remote tip; reasons table rows.
- Handed-off guards: dismiss, terminal keys, queue delivery, rate-limit release; banner from `GET /threads/:id/handoff`; undo stops live sessions.
- Import: "Finish" row; "its head" order; Create/Advance steps with `pending`, `claim_sha`; Advance retracts cards and clears pins; retained worktrees.
- New Recovery section (Finish import panel and route; restart sends import context until delivered; restart carries history).
- Machine: `from_remote_branch: {sha}`; `status` gains remote tip and PR state; `inspect` gains worktree existence.
- Protocol: lead.md step 4 commits before ending a turn.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
