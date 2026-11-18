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
| 25 | Create, Advance and Undo are operations of skip-if-done steps under one saved operation record; any interruption is finished by one Retry button (or by importing the file again). Supersedes the step-by-step recovery of 22 | Collin picked one Retry button: one rule covers every crash point | user |
| 26 | No lead runs during an operation; the lead starts afterwards through the ordinary restart path, whose context always carries the import block | Removes every lead-related recovery case from the operation | review-round-4 |
| 27 | Importing on a machine that already holds the thread for another wheelchair app is refused | Two hubs sharing one machine would share sessions, worktrees and archive state by thread id; rare, and a refusal is clear | review-round-5 |
| 28 | Restart (for every thread) queues its context before starting the session | A crash after start can no longer leave a lead without its context | review-round-5 |

## Spec

Terms: the **source** thread is the one exported; the **file** is the export; the
**importing app** is the hub the file is imported into (it may be the same hub). The hub
runs `viewer/app/*`; the machine service runs `machine/service.js`. A **claim** is an empty
commit pushed to the thread's branch on GitHub to show who holds the work (see Claims).

Every handoff operation below (export, and the Create, Advance and Undo operations, including a Retry)
runs inside the hub's per-thread lock, `hub.withThread(id, ...)`
(`viewer/app/hub.js:90-100`), from its eligibility checks to its last save, so a message,
press or second import for the same thread id waits for it.

### Export points

A thread can be exported at exactly three points. At each, the thread must also be
**quiet**:

- not archived, not handed off, no unfinished operation (see Operations and Retry);
- no session other than the lead is `live`; the lead is either not live, or live with
  `turn_ended === true` (`viewer/app/sessions.js:515-543`); no message is queued for any
  session of the thread;
- no aside is open or has a turn running (`thread.asides`, `viewer/app/asides.js`);
- no `sudo` card is in state `waiting` or `running`;
- no upload to the thread is in flight (the hub counts uploads per thread from admission
  to completion, both under `hub.withThread`; `viewer/app/routes.js:69-90`);
- the worktree has no uncommitted changes (`git status --porcelain` empty, untracked
  files included), and it is on branch `wc/<id>` (`git symbolic-ref --short HEAD`), not
  detached.

The stage is read from the **committed** files at the worktree's `HEAD`
(`git show HEAD:docs/plans/<slug>/IDEA.md` and `PLAN.md`), never from the working files.

| Point (`stage` in the file) | Holds when | Import resumes at |
|---|---|---|
| `idea-confirmed` | IDEA.md `status: confirmed`; PLAN.md absent or `status: planning`; no `question` card **answered by Collin** (a press, a typed answer, or a lead `resolve`; a retraction does not count) after the anchor: the last such answered question card whose `doc` is `IDEA.md`, or, when there is none and the thread was imported, `imported.at` | Planning (lead step 4): the lead reads IDEA, MAP and any PLAN.md on the branch and asks the open questions again |
| `approved` | PLAN.md `status: approved`; no `approval` card was answered with Start building | Approval (lead step 6): the lead posts a fresh approval card with a fresh Ready check |
| `done` | PLAN.md `status: done`; the thread's pull request is known: the `pr_url` of its latest non-replaced `done` card, else `imported.pr_url`; no `merged` card exists; the pull request's current state, read at export time with `gh pr view <pr_url> --json state` on the machine, is `OPEN`; and the worktree `HEAD` equals `origin/wc/<id>` after a fetch, so no after-done fix is waiting on its check or on Collin | After done (lead step 9) |

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
| unfinished operation | "An import or undo didn't finish" |
| `merged` card exists, or the PR is not open at export | "The pull request is merged or closed; nothing left to hand off" |
| origin not on GitHub | "This project's origin isn't on GitHub" |
| another live session or an aside running | "Agents are still working" |
| lead mid-turn or anything queued | "The lead is busy" |
| sudo waiting or running | "A root command is waiting" |
| upload in flight | "A file is still uploading" |
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
| `thread` | `{id, title, slug}`; `id` matches `^[0-9a-f]{12}$`; `slug` matches `^[a-z0-9][a-z0-9-]*$`; `title` a string of at most 120 characters (card titles are cut to 80 plus an ellipsis, `viewer/app/card.js:49-54`) |
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
- each sent message from `collin` or `card` in `thread.sent` (for an imported thread,
  only those after `imported.at`) (`who` `collin`, `kind`
  `message` or `press`, `text` the message text);
- each non-replaced card shown to Collin (for an imported thread, only those created
  after `imported.at`; `who` `lead` or `app`), with `text` rendered by
  one function, `historyText(card)`, defined per kind: question → question, the options'
  labels, and the answer or "withdrawn"; idea → the bullets; approval → objections and
  outcome; done → title, can_do, left_as_is, pr_url; needs → title and body; offer →
  summary and answer; stub → title; diagram/image → title; sudo → command and outcome;
  progress cards are skipped. Never-shown kinds are skipped.

An entry whose text is over 20,000 characters is cut to 19,990 and ends with "… (cut)".
When the entries exceed 2000 or the file 10 MB, the oldest entries are dropped and one
entry `{at: <the first kept entry's at>, who: "app", kind: "message", text: "<n> earlier
entries were left out"}` is put first. Export validates the file it built with the
importer's validator before pushing (Export step 2).

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

The claim sha is saved on the operation record before the push, so a retry can tell an
own landed claim (remote tip equals it) from someone else's (see Operations and Retry).

Someone taking the branch by hand, without wheelchair, is asked (README) to push such a
commit too; wheelchair cannot enforce that.

### Export

`POST /threads/:id/export` (hub route, beside restart and archive in `viewer/app/routes.js`).

1. Re-check the export point and quiet test, including the machine `status` call; on
   failure 409 with the reason sentence.
2. Build the file with `head: <checked sha>`, trimming history as below, and validate it
   with the importer's validator; a failure is a 500 and nothing changes.
3. Ask the machine to push the exact commit the check read, `<checked sha>`, as
   `git push origin <checked sha>:refs/heads/wc/<id>` (`/v1/handoff` `push`, non-forced). It returns the pushed head and the
   normalized repository. On failure 409 "Couldn't push the branch to GitHub: <git's last
   line>"; nothing changes.
4. Write the file to `handoffs/<id>.json.new` in the hub state directory, then save
   `handed_off: {at, head, stage}` on the record and cancel asides as archive does
   (`viewer/app/threads.js:163-167`), then rename the file to `handoffs/<id>.json`
   (replacing any earlier one). If the write or the save fails: delete the `.new` file and
   respond 500 "The branch was pushed, but the export didn't finish; try again". The push
   is harmless: the thread is unchanged and can be exported again.
5. Stop every live session of the thread as `session stop` does. If a stop fails, carry
   on: the thread is already frozen, so nothing reaches that session.
6. Respond 200 with the file as `application/json` and
   `Content-Disposition: attachment; filename="<name>"`.

Thread page: an **Export** button in the head beside Archive (`viewer/pages/thread.js:147-166`).
Enabled only at an export point, otherwise disabled with the reason as a line under it
(the thread view payload carries `export: {ok, reason}`). Pressing it asks "Export and hand
off? This thread stops taking work here." with Confirm / Cancel; Confirm downloads the file.

### Frozen threads

A thread is **frozen** while it is handed off or has an unfinished operation (see
Operations and Retry). One hub-side check, `frozen(thread)`, guards every entry point; the
refusal is 409 with "handed off" or "Retry the unfinished import first":

- messages, uploads, card presses and dismissals, card posts from any session of the
  thread, session starts (including `restart`), aside creation and aside messages,
  terminal keys (`POST /sessions/:name/keys`, `viewer/app/routes.js:520`);
- `enqueue` (`viewer/app/sessions.js:408`) drops any message for a session of a frozen
  thread, whoever produces it (turn-failed notices, dead-session polls, starters), except
  the operations' own restart context, so nothing made during the freeze reaches a later
  lead;
- queue delivery: `canDeliver` (`viewer/app/sessions.js:428`) delivers nothing to a
  session of a frozen thread;
- nothing enqueues `Continue.` for one, from the rate-limit release
  (`viewer/app/sessions.js:761`) or the limit event itself (`viewer/app/sessions.js:517-523`);
- archive, only while an operation is unfinished (a handed-off thread can be archived).

The operations themselves bypass the check.

### The original thread after export

- A handed-off thread is **frozen** (see Frozen threads): readable, but it takes no new
  work. The composer, attach and card buttons are disabled, and the "Restart lead" panel
  (`viewer/pages/thread.js:268-278`) is not shown.
- The page shows a banner. When the page loads, it asks the hub
  `GET /threads/:id/handoff`, which runs `inspect` (cached for 60 seconds) and reports
  whether the remote tip is still `handed_off.head`:
  - unchanged: "Handed off <date>. Import a newer file to continue here, or undo." with an
    **Undo hand-off** button;
  - moved: "Picked up elsewhere on <date>. Import a newer file to continue here." and no
    Undo;
  - inspect failed: the first text, and Undo stays available (undo checks again).
- `POST /threads/:id/undo-handoff` runs the Undo operation (see Operations and Retry):
  claim on top of `handed_off.head`, stop any live session, fast-forward the worktree to
  the claim (or rebuild it when missing), clear `handed_off` and `archived`, then start a
  lead with the restart context. Undo is offered on archived handed-off threads too. If the claim step
  abandons, 409 "This was picked up elsewhere on <date>; import a newer file to continue
  here".
- While handed off, the page offers **Download the file again**
  (`GET /threads/:id/handoff-file`, the saved `handoffs/<id>.json`), so a lost download
  never needs a second export. If only `handoffs/<id>.json.new` exists (a crash between the
  save and the rename), Download again renames it first; the hub does the same for every
  handed-off thread when it starts. The saved file is deleted when the hand-off is undone or the
  thread is advanced by an import (Done step), not when it is archived.
- A handed-off thread can be archived like any thread; its Undo stays available.
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
   Then, if a thread with the file's id exists here with a saved `handoff_op`, the hub runs
   that operation again (the "Finish" row) and stops; steps 2 and 3 are skipped, since the
   saved operation uses its own saved file.
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
| No such thread, and the machine holds no session, worktree, archive record or local `wc/<id>` branch in the picked project for this id | **Create** |
| No such thread, but the machine holds sessions, a worktree or an archive record for this id (another wheelchair app on the same machine has or had it) | Refused 409 "This machine already has this thread from another wheelchair app; import it on another machine" |
| Exists with a saved `handoff_op` | **Finish**: run that operation again (see Operations and Retry), ignoring this file; outcome as that operation's, with note "Finished the earlier import or undo; import this file again if it's newer" |
| Exists on another machine or project than the picker chose | **Open**, note "This thread lives on <machine>, <project>", plus " It's handed off: press Undo on it to carry on." when it is handed off |
| Exists; its head equals `head`, or `head` is an ancestor of its head | **Open**, change nothing. Note: "You already have this thread here", plus " It's handed off: press Undo on it to carry on here." when it is handed off and the tip is unchanged; or "This file is older than the thread here" |
| Exists; its head is a strict ancestor of `head` | **Advance** |
| Exists; neither is an ancestor of the other | **Open**, change nothing; note "This thread and the file have each moved on separately, so nothing was changed. Bring the branches together yourself, then import again." |

   "Its head" is, in order: the `HEAD` of the thread's worktree if that directory exists
   and is a git worktree; else the local `wc/<id>` ref in the project (the Checkout step
   keeps it at the claim when there is no worktree); else `handed_off.head`. Ancestry uses `git merge-base --is-ancestor`.

   For Create and Advance, the remote tip must also **equal** `head`. A tip past `head`
   means someone already picked the work up: 409 "This was already picked up elsewhere on
   <committer date of the first commit after head>; export again from wherever it is now".

**Create** saves a new record (the file's `id`, `title`, `slug`, the picked machine and
project, `branch: wc/<id>`, no sessions) together with its `handoff_op`, then runs the
operation. **Advance** first refuses 409 "The thread here is busy" unless the existing
thread has no live session other than the lead, no aside open or running, the lead is idle
or not live, nothing is queued, no sudo card is waiting or running, and no upload is in
flight; 409 "The thread here isn't on its branch" if its worktree exists and is not on
`wc/<id>`; and 409 "The thread here has uncommitted changes" if
its worktree exists and is dirty. Then it saves `handoff_op` and runs the operation.

Responses: `{outcome: "created"|"advanced"|"opened", id, note?}`. The page navigates to
the thread for `created` and `advanced`; for `opened` it shows the note and an "Open the
thread" link.

**Carried state**, applied by Create and Advance: `imported: {at, stage, exported_at,
history, pr_url}` from the file. On Advance the file's history replaces the old
`imported.history`, since the file's already contains everything before it. Wherever the
hub reads a thread's pull request from its `done` cards (`mergedPr`,
`viewer/app/threads.js:353-356`; `prOf`, `viewer/app/chat.js:256`; the `done` export point),
an imported thread considers only `done` cards created after `imported.at` and otherwise
uses `imported.pr_url`, so the merge watcher and the PR link work for an imported thread. The
thread page renders `imported.history` as a collapsed, read-only "Before the handoff"
section above the thread's own conversation: one line per entry (`at`, `who`, `text`), as
plain text, no buttons; the thread's own conversation is shown only from `imported.at`
on. On Advance, the thread's existing cards are all marked answered as retracted
(`retracted_by: "import"`, note "Replaced by an import") and every pin is cleared, so
nothing from before can be pressed; the lead posts fresh cards.


### Operations and Retry

Create, Advance and Undo are each an **operation**: a fixed list of steps where every step
first checks whether it is already done and skips it if so. An operation that stops
partway (crash, lost response, failed step) is finished by running it again from the top;
that is the only recovery mechanism. An operation touches only GitHub, git on the machine
and the hub record; **no lead runs during an operation**. The lead is started after the
operation is complete, by the ordinary restart path, so lead start-up never needs its own
recovery.

**The operation record.** Before its first step, an operation saves
`thread.handoff_op: {kind: "create"|"advance"|"undo", file, parent, claim_sha,
last_error, claim_landed, applied, started_at}`; `started_at` is set once and becomes `imported.at` in Apply, so
a Retry never moves that cutoff on the thread record (for Create, in the same save that first
creates the record). `file` is the path of a copy of the imported file the hub writes to
`handoffs/incoming-<id>.json` before that save (null for undo); `parent` is the commit the
claim goes on (`head` for imports, `handed_off.head` for undo). The thread's existing
fields (`imported`, `handed_off`, cards, pins, `archived`) are not changed until the Apply
step, so a refused or abandoned operation leaves them as they were. A step that fails
saves its sentence in `last_error` and the operation stops there.

**Abandoning.** When the Claim step finds someone else moved the branch, the operation is
abandoned: Create deletes the thread record; Advance and Undo clear `handoff_op`. Then the
incoming copy is deleted. The response is "picked up elsewhere" 409; when the operation
was reached through a re-import (the Finish row), its text ends "import that file again"
instead of "export again from wherever it is now".

**Steps**, in order (Undo has no carried state):

1. **Claim.** Skipped when `claim_landed` is true. If `claim_sha` is null: `claim-commit` on `parent`, save `claim_sha`, then
   `claim-push`. If `claim_sha` is set: `claim-push` again. `claim-push` decides its
   result only from the remote tip it reads after its push attempt, never from the push's
   exit code: tip `claim_sha` → `landed`: save `claim_landed: true`, go on; tip `parent` → `unknown`; any other tip →
   `moved`, abandon; tip unreadable → `unknown`. `unknown` fails the step with "Couldn't
   update the branch on GitHub", keeping `claim_sha`, so Retry tries again.
2. **Stop.** Stop every live session of the thread (Advance and Undo). Then ask the
   machine (`/v1/handoff` `running`) which tmux sessions named `wc-<id>-*` still exist,
   kill each by name (`/v1/handoff` `kill`), and ask again. Any left fails the step with
   "Couldn't stop the agent working here".
3. **Checkout.** If the thread's worktree directory exists and is a git worktree:
   `/v1/handoff` `fast-forward` to `claim_sha`. Otherwise clear `worktree` on the record and
   move the project's local `wc/<id>` ref to `claim_sha` (`/v1/handoff` `set-branch`); the
   lead start builds the worktree (step 6).
4. **Apply.** Skipped (with 2 and 3) when `applied` is true. First, if the thread is archived, call `/v1/handoff` `reopen` (idempotent);
   if it fails, the step fails before anything is saved. Then set the carried state
   (Create, Advance), retract cards and clear pins (Advance), clear `handed_off` and
   `archived`, set `checkout_sha: claim_sha` and `handoff_op.applied: true`, and save, all in
   one save. Every assignment is the same on a
   re-run.
5. **Done.** Clear `handoff_op` and save. Then delete `handoffs/incoming-<id>.json` and
   `handoffs/<id>.json`. A crash between the save and the deletes leaves only stray files;
   the hub deletes `handoffs/*.json` files that belong to no handed-off thread and no
   saved operation when it starts.
6. **Start the lead**, outside the operation: the restart path (`restartLead`,
   `viewer/app/threads.js:122-159`). When the thread has no recorded worktree, restart starts
   the lead with `from_remote_branch: {sha: checkout_sha}`. If the start fails, or the hub
   stops before it, the thread shows the dead-lead panel with Restart: the panel's
   condition (`viewer/pages/thread.js:270-277`) becomes "not archived, not frozen, no live
   lead, and either a lead was ever started or the thread was imported".

**Restart order.** `restartLead` is changed for every thread: it first asks the machine
(`running`) for tmux sessions of the thread's lead names that the hub does not count as
live, kills them (`kill`) and moves any queued context from those names to the new one;
then it picks the new lead's name
(`newSessionName`), puts the context message in that name's queue and saves, **then**
starts the session. A crash after the start still leaves the context queued for the lead;
a crash before it leaves a thread with no live lead, which shows Restart.

**What the lead is told.** Restart's context JSON gains, for a thread with `imported`, an
`import: {stage, exported_at, pr_url, history}` block (history: last 50 entries), every
time. The marker is `[wc:context import]` when no lead session of the thread started after
`imported.at`, otherwise `[wc:context restart]`; the JSON is the same. The lead reads the
plan documents on the branch either way.

All of an operation runs inside `hub.withThread(id)`. The hub keeps an in-memory set of
operations currently running; an operation is **unfinished** when `handoff_op` is saved
and its thread id is not in that set.

**Retry.** An unfinished operation:
- freezes the thread (Frozen threads), which also refuses archive, and blocks export
  ("An import or undo didn't finish");
- shows, instead of the composer, a panel "The import didn't finish." (or "The undo didn't
  finish."), the saved `last_error` when there is one, and a **Retry** button:
  `POST /threads/:id/retry-handoff` runs the saved operation again, reading the file from
  `handoff_op.file`. If that copy is gone, the operation is abandoned with "The saved file
  is missing; import it again";
- offers **Cancel** next to Retry when the claim has not landed (the hub reads the remote
  tip; it is `parent`, or `claim_sha` is null). Cancel abandons the operation as above,
  without the 409: Create deletes its record, Advance and Undo clear `handoff_op`;
- is also reached by importing a file for that thread id (the "Finish" row), which runs
  the saved operation and ignores the new file;
- for an Undo, makes the handed-off banner show "The undo didn't finish" with Retry,
  never "picked up elsewhere", while the remote tip equals `handoff_op.claim_sha`.

### Machine service changes (`machine/service.js`)

- `createWorktree` (`machine/service.js:425-478`) gains `input.from_remote_branch: {sha}`:
  after the fetch, `sha` must be an ancestor of or equal to `origin/<branch>`. If no
  local `wc/<id>` exists: `git worktree add -b <branch> <dest> <sha>`. If it exists and is
  an ancestor of `sha`: `git worktree add <dest> <branch>` then
  `git -C <dest> merge --ff-only <sha>`. Both paths then run
  `git -C <dest> branch --set-upstream-to=origin/<branch>`, so a plain push works.
  Otherwise fail with "a local branch <branch> already exists and differs". Before
  either, if the destination directory (`stateDir/worktrees/<project>/<branch>`) already
  exists and is a git worktree on `<branch>` whose `HEAD` is `sha` or an ancestor of it,
  adopt it: fast-forward to `sha` and use it. A destination that exists in any other state
  fails with "the checkout folder for <branch> is in an unexpected state". The worktree
  counts as created by this start for archive ownership, as the default path does
  (`machine/service.js:531-540`). The default path is unchanged.
- New hub-only endpoint `POST /v1/handoff`, authorized like `/v1/archive`
  (`machine/service.js:1234`), with `action`:
  - `status` `{worktree, slug, pr_url?}` → fetch; `{dirty, branch, head, remote_tip,
    idea_status, plan_status, repository, pr_state}` from `git status --porcelain`,
    `git show HEAD:...`, the origin, and `gh pr view <pr_url> --json state` when `pr_url`
    is given (`pr_state: null` and `pr_error` when gh fails, which blocks a `done` export
    with "Couldn't check the pull request").
  - `push` `{worktree, branch, sha}` → `git push origin <sha>:refs/heads/<branch>` (non-
    forced); returns `{head, repository}`.
  - `inspect` `{project, branch, head, worktree?, slug}` → fetch; returns `{repository,
    remote_tip, remote_has_branch, remote_contains_head, picked_up_at, local_head,
    worktree_exists, relation, idea_status, plan_status}`. `local_head` follows the "its
    head" order above (the hub supplies `handed_off.head` as a fallback field).
    `relation` is `same`, `behind` (file older), `ahead` (file strictly ahead) or
    `diverged`. `picked_up_at` is the committer date of the first commit after `head` when
    the tip is past it. Statuses are read with `git show <head>:docs/plans/<slug>/...`
    (null when absent).
  - `claim-commit` `{project, parent, message}` → step 1 of Claims; returns `{sha}`.
  - `claim-push` `{project, branch, parent, sha}` → reads the remote tip
    (`git ls-remote`); tip == `sha`: `{result: "landed"}`; tip == `parent`: run step 2 of
    Claims and read the tip again. The result comes only from the tip read last, never from
    the push's exit code: tip `sha` → `landed`; tip `parent` → `unknown`; any other tip →
    `{result: "moved", remote_tip, picked_up_at}`; tip unreadable → `unknown`.
  - Every `/v1/handoff` outcome, including refusals, is a 200 with a JSON body (except 422
    for invalid input), so the hub's machine client (`viewer/app/machine-client.js:64-76`)
    never drops the body.
  - `reopen` `{thread_id}` → removes the id from the machine's `archivedThreads`
    (`machine/service.js:263-271`, `:783-790`), so uploads work again; Advance calls it
    when it revives an archived thread.
  - `fast-forward` `{worktree, branch, head}` → result `failed` with a sentence when the
    worktree is dirty, not on `branch`, or its `HEAD` is not `head` or an ancestor of it;
    else `git merge --ff-only <head>`, then verifies `HEAD` is exactly `head`.
  - `set-branch` `{project, branch, sha}` → when `branch` is absent or an ancestor of `sha`,
    `git branch -f <branch> <sha>`; else `failed` "a local branch <branch> already exists
    and differs".
  - `running` `{thread_id}` → the names of tmux sessions `wc-<thread_id>-*` that exist
    (`tmux has-session`).
  - `known` `{thread_id, project}` → whether the machine holds any session record,
    worktree or archive record for the id, or the project has a local `wc/<id>` branch
    (the one durable signal; used by Create's refusal row).
  - `kill` `{names}` → `tmux kill-session -t <name>` for each name matching
    `^wc-[0-9a-f]{12}-`; returns the names still running.
  - Calls run in the machine's per-repository queue (the one `createWorktree` uses,
    `machine/service.js:461`), and the hub calls `/v1/handoff` with a 120-second timeout
    instead of the machine client's default (`viewer/app/machine-client.js:42`). A timeout
    fails the step with "The machine didn't answer in time"; every action is safe to run
    again.
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
    handed off, cancels asides, stops sessions; push failure changes nothing; a save
    failure after the push leaves the thread unchanged, removes the `.new` file and can be
    exported again; a failed stop still hands off; history built and trimmed;
  - handed-off thread refuses each listed route, delivers nothing from its queue, and the
    rate-limit release enqueues nothing; banner states (unchanged, moved, inspect failed);
    undo claims and restarts; undo refused when the claim is refused;
  - import validation failures (bad JSON, bad id, wrong version, unknown field, bad
    history entry, stage not supported by the branch, repo mismatch, non-GitHub origin,
    missing branch, body over 10 MB);
  - create: claim sha saved before push, record and history saved, `[wc:context import]`
    queued; claim refused deletes the record; two concurrent imports of one id serialize;
  - operations: for Create, Advance and Undo, stop the operation after each step in turn
    (fake failures), then Retry: the end state equals an uninterrupted run, with exactly one
    claim commit; claim landed but response lost continues; `unknown` claim-push keeps
    `claim_sha` and saves `last_error`; abandon when the tip moved (re-import wording
    differs); crash between Done's save and the file deletes leaves files the start-up
    sweep removes; Advance refused leaves `imported`, cards and pins unchanged; Retry with
    the incoming copy missing abandons; archive refused while unfinished; the Retry panel
    shows `last_error`; unfinished undo banner shows Retry, not "picked up elsewhere";
    re-import with an unfinished operation runs it without inspecting the new file;
  - lead start after an operation: no lead runs during it; restart context includes
    `import`, with marker `[wc:context import]` only for the first lead after `imported.at`;
    a failed start shows the ordinary Restart; restart enqueues the context before starting; an imported thread with no
    sessions shows Restart; a lead with no recorded worktree starts from `checkout_sha`;
  - frozen: every entry point in Frozen threads refused while handed off and while an
    operation is unfinished; Stop fails when a tmux session survives; Checkout refuses a
    HEAD past the claim; Apply's `reopen` failure saves nothing; `imported.at` unchanged by
    Retry; Cancel before the claim lands; claim-push outcome by remote tip only; Create
    refused when the machine knows the id; an imported thread ignores pre-import `done`
    cards for its PR;
  - export builds and validates before pushing (a 120-character title passes); sudo
    running and upload in flight block export and Advance; undo on an archived handed-off
    thread rebuilds the worktree;
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
  download; handed-off banner and Undo; Retry panel; "Before the handoff" section;
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

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

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
| intent | major | Imported thread can't be exported again at done; no PR known | upheld | `imported.pr_url` saved, used by the done point, merge watcher and PR link; idea anchor falls back to `imported.at` |
| intent | major | Advance duplicates history on every round trip | upheld | File history replaces `imported.history`; export and page use only own entries after `imported.at` |
| intent | minor | Import and restart context carry unbounded history | upheld | Last 50 entries in lead context |
| mechanics | blocking | Crash between saving the live lead and queuing the import context can't be finished | user-decision | Decision 25: Operations and Retry |
| mechanics | blocking | Crash before the claim is saved loses `head`; refused Advance leaves the refused stage saved | user-decision | Decision 25: Operations and Retry |
| mechanics | blocking | A landed undo claim with a lost response looks like an outside pick-up | user-decision | Decision 25: Operations and Retry |
| mechanics | blocking | Failed lead start can leave an unrecorded checkout | user-decision | Decision 25: Operations and Retry |
| mechanics | blocking | Imported done thread has no PR identity | upheld | Same fix as the intent finding |
| mechanics | blocking | Export reads HEAD but pushes the branch name; detached checkout mismatch | upheld | Requires branch `wc/<id>`; pushes the checked sha |
| mechanics | major | Revived archived thread still refuses uploads on the machine | upheld | `/v1/handoff` `reopen` |
| mechanics | major | "First turn ended" can't identify the import-context turn | user-decision | Decision 25: restarts always include the import context; no delivery tracking |
| mechanics | major | Limit event path still enqueues `Continue.` | upheld | Guard both paths |
| mechanics | major | Withdrawn questions count as answered in the idea rule | upheld | Only Collin's answers count |
| mechanics | major | Export can build history its importer rejects | upheld | Omission entry has `at`; long entries cut; export self-validates |
| mechanics | major | Lost export response leaves no file | upheld | Saved file, Download again while handed off |

### Round 4 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:**
- New "Operations and Retry" section replaces Create/Advance step lists and Recovery: one operation record (`handoff_op`), skip-if-done steps, abandon rule, Retry panel and route, finish via re-import.
- Undo is an operation; banner shows Retry while an undo is unfinished.
- Claims: claim sha lives on the operation record.
- Carried state: `imported.pr_url`, history replaced on Advance, own conversation shown from `imported.at`; PR fallback in `mergedPr`/`prOf`.
- Restarts of imported threads always include `import` context (no delivery tracking).
- Export: branch must be `wc/<id>`, pushes the checked sha; saved file and Download again; history entry cut and omission entry `at`; export self-validates.
- Idea point: only Collin's answers count; anchor falls back to `imported.at`.
- Guards: limit event path; machine `reopen`; `from_remote_branch` adopts an existing checkout.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Archived handed-off thread has no way back on its own hub | upheld | Undo allowed on archived handed-off threads; saved file kept on archive |
| intent | minor | Retry panel never says why the last run failed | upheld | `last_error` saved and shown |
| intent | minor | Abandon message after re-import says to export again | upheld | Wording says import that file again |
| mechanics | blocking | Done deletes the file before clearing the operation | upheld | Clear and save first, then delete; start-up sweep |
| mechanics | blocking | Lead step can adopt a phantom lead or start two | upheld | No lead during an operation; lead started afterwards by the ordinary restart path |
| mechanics | blocking | Another hub's stopped session name is reused | upheld | `reserved_names` from the machine; `newSessionName` skips them |
| mechanics | blocking | Context reaches the lead before Done; lead commit looks like outside pickup | upheld | Lead starts only after Done |
| mechanics | blocking | Lead dies after context saved, before Done | upheld | Removed with the context step; restart always carries `import` |
| mechanics | blocking | Archive allowed during an unfinished operation | upheld | Archive refused until Retry |
| mechanics | blocking | Re-import inspects before finding the saved operation | upheld | Saved-operation lookup right after validation |
| mechanics | blocking | Push endpoint pushes the branch name, not the checked sha | upheld | `push` takes `sha` |
| mechanics | blocking | Export pushes before validating; 81-character titles | upheld | Build and validate before push; title limit 120 |
| mechanics | blocking | Advance allows outstanding sudo requests | upheld | Sudo waiting or running counts as busy, for export too |
| mechanics | major | Claim-push can't report an ambiguous failure; client drops bodies | upheld | `landed`/`moved`/`unknown` results, all 200 |
| mechanics | major | Uploads not covered by the lock | upheld | In-flight upload counter under the lock; blocks export and Advance |

### Round 5 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 4:**
- Operations: no lead during an operation; steps are Claim, Stop, Checkout, Apply, Done, then the lead starts via restart; `last_error`; abandon wording; Done order and start-up sweep; archive refused while unfinished; `reserved_names`.
- Restart context `import` block and marker rule; `checkout_sha` for a missing worktree.
- Claim-push results `landed`/`moved`/`unknown`; all `/v1/handoff` outcomes are 200 bodies; `push` takes `sha`.
- Export builds and validates before pushing; title limit 120.
- Quiet test and Advance: sudo running, uploads in flight.
- Undo allowed on archived handed-off threads; saved file kept on archive.
- Import: saved-operation lookup before repository and branch checks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Restart not blocked during an unfinished operation | upheld | One `frozen()` guard covers restart and session starts |
| intent | major | Created thread with a failed lead start has no Restart | upheld | Panel condition includes imported threads |
| intent | major | Validation still says no Undo when archived | upheld | Removed |
| intent | minor | Unclaimed Create stuck forever | upheld | Cancel while the claim hasn't landed |
| intent | minor | Finish row silently ignores a newer file | upheld | Note says import it again if newer |
| mechanics | blocking | Unfinished-operation guard misses keys, card posts, starts, delivery | upheld | Frozen threads section, one guard list |
| mechanics | blocking | Stop doesn't verify the session is gone | upheld | `running` check; step fails if any survive |
| mechanics | blocking | Two hubs on one machine share thread-id-scoped archive and sessions | upheld | Create refused when the machine already knows the id |
| mechanics | blocking | Restart can strand an imported thread (context not queued; panel hidden) | upheld | Restart enqueues before starting; panel shows for imported threads |
| mechanics | blocking | Deferred checkout loses the head for later imports | upheld | Checkout moves the local ref to the claim (`set-branch`) |
| mechanics | blocking | Fast-forward can land past the claim | upheld | Expected branch and exact HEAD verified |
| mechanics | major | Apply order around `reopen`; `imported.at` moves on Retry | upheld | `reopen` first, nothing saved on failure; `imported.at` = `started_at` |
| mechanics | major | Claim-push outcome ambiguous | upheld | Result decided from the reread tip only |
| mechanics | major | Machine client 5-second timeout | upheld | 120-second timeout; per-repo queue; timeouts fail the step |
| mechanics | major | Retracted pre-import done card still sets the PR | upheld | Imported threads read only done cards after `imported.at` |
| mechanics | major | Export save-failure contract contradicts its order | upheld | `.new` file, save, rename; 500 says pushed but not finished |
| mechanics | minor | Validation contradiction on archived Undo | upheld | Same fix as intent |

### Round 6 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 5:**
- New Frozen threads section: one guard for handed-off and unfinished threads, used by every entry point.
- Export step 4: `.new` file, save, rename; save failure after push.
- Import: Create refused when the machine knows the id; Finish row note; "its head" via local ref.
- Operations: `started_at` fixed as `imported.at`; claim-push decided by the reread tip; Stop verifies with `running`; Checkout via exact `fast-forward` or `set-branch`; Apply calls `reopen` first; dead-lead panel condition; Cancel; Session names removed.
- Restart order: context queued before start (all threads).
- PR identity for imported threads ignores pre-import done cards.
- Machine: `fast-forward` contract, `set-branch`, `running`, `known`; 120-second timeout and per-repo queue.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Other-machine Open note lacks the Undo hint | upheld | Note adds it when handed off |
| intent | minor | `known` forgets archived ids after a machine restart | upheld | `known` also counts a local `wc/<id>` branch |
| mechanics | blocking | Crash before rename leaves only `.json.new` | upheld | Download again and hub start rename it |
| mechanics | blocking | Stop detects survivors but never kills them | upheld | `kill` by name, then recheck |
| mechanics | blocking | Detached checkout passes Advance's checks, then fails every Retry | upheld | Advance refuses a worktree not on `wc/<id>` before claiming |
| mechanics | blocking | Ambiguous restart start can launch a second lead | upheld | Restart kills orphan lead tmux sessions and moves their queued context first |
| mechanics | blocking | Retry after Apply treats a later tip as someone else's pickup | upheld | `claim_landed` and `applied` flags skip finished steps |
| mechanics | major | Machine and hub claim outcomes conflict | upheld | Machine contract now matches: result from the last tip read |
| mechanics | major | Create refusal not durable across machine restarts | upheld | Same fix as intent |
| mechanics | major | `set-branch` skips upstream setup | upheld | Both checkout paths set upstream |
| mechanics | major | System producers can queue work while frozen | upheld | `enqueue` drops messages for frozen threads |

### Round 7 — 2026-11-17

**Lanes:** intent and mechanics; cross-family: yes.

**Changed since Round 6:**
- Export: `.json.new` recovered by Download again and at hub start.
- Frozen threads: `enqueue` drops messages for frozen threads.
- Operations: `claim_landed` and `applied` flags; Stop kills surviving tmux sessions by name; Advance refuses a worktree not on its branch.
- Restart order: orphan lead sessions killed and their queued context moved first.
- Import: `known` includes a local `wc/<id>` branch; other-machine note.
- Machine: claim-push result from last tip read; `kill`; upstream set on both checkout paths.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
