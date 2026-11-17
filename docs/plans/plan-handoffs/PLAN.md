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

## Spec

Terms: the **source** thread is the one exported; the **file** is the export; the
**importing app** is the hub the file is imported into (it may be the same hub). The hub
runs `viewer/app/*`; the machine service runs `machine/service.js`.

### Export points

A thread can be exported at exactly three points. At each, the thread must also be
**quiet**: not archived, not handed off, no session other than the lead is `live`, the lead
is live with `turn_ended === true` (`viewer/app/sessions.js:515-543`), no message is queued
for the lead, and no `sudo` card is in state `waiting`.

| Point (`stage` in the file) | Holds when | Import resumes at |
|---|---|---|
| `idea-confirmed` | IDEA.md `status: confirmed`; PLAN.md absent or `status: planning`; no answered `question` card whose `doc` is `PLAN.md` | Planning (lead step 4): the lead reads IDEA, MAP and any PLAN.md on the branch and asks the open questions again |
| `approved` | PLAN.md `status: approved`; an `approval` card is pinned and not answered or retracted | Approval (lead step 6): the lead posts a fresh approval card with a fresh Ready check |
| `done` | PLAN.md `status: done`; a non-replaced `done` card with `pr_url` exists | After done (lead step 9) |

Statuses are read from the worktree files the way `readStatus` does (`viewer/app/views.js:110`);
IDEA.md's `status:` is read the same way. The `idea-confirmed` test relies on planning
question cards carrying `doc: "PLAN.md"`; lead.md is updated to require it (see Protocol).

When the thread is not at an export point, the export control is shown disabled with one
line saying why, in Collin's terms. The hub computes it; reasons, first match wins:
"archived", "already handed off", "agents are still working" (another live session),
"the lead is busy" (mid-turn or queued message), "a root command is waiting",
"not at a stopping point: export after the idea is confirmed, once the plan is approved,
or when it's done".

### The file

One JSON object, UTF-8, at most 2 MB, downloaded as `<title-kebab>.wheelchair.json`
(title lower-cased, non-alphanumerics collapsed to `-`, cut to 60 characters, fallback
`thread`). Fields, all required unless noted; an unknown top-level field is refused on
import:

| Field | Value |
|---|---|
| `format` | `"wheelchair-handoff"` |
| `version` | `1` |
| `exported_at` | ISO time |
| `thread` | `{id, title, slug}`; `id` matches `^[0-9a-f]{12}$` (the hub's thread id form); `slug` matches `^[a-z0-9][a-z0-9-]*$` |
| `repository` | the project's `origin` URL normalized to `github.com/<owner>/<repo>` (lower-case, no scheme, no `.git`, ssh and https forms both map here) |
| `branch` | `wc/<id>` |
| `head` | full commit sha the push left on `origin/wc/<id>` |
| `stage` | `idea-confirmed`, `approved` or `done` |
| `pr_url` | string; required when `stage` is `done`, absent otherwise |
| `cards` | the source thread's non-replaced cards, as stored |
| `pinned` | the source thread's `pinned` object |
| `recent_messages` | last 20 sent messages from `collin` or `card`, as restart builds them (`viewer/app/threads.js:127-133`) |

Not in the file: the machine, project path, CLI, provider, sessions, transcripts, uploads,
asides, queues. Uploaded attachments do not travel; `[attached: ...]` lines in carried
messages may point at files that do not exist on the importing machine.

### Export

`POST /threads/:id/export` (hub route, beside restart and archive in `viewer/app/routes.js`).

1. Re-check the export point and quiet test; on failure 409 with the reason sentence.
2. Ask the machine to push `wc/<id>` from the thread's worktree to `origin` and report the
   pushed head and the normalized `origin` URL (new hub-only machine endpoint, below). On
   failure 409 "couldn't push the branch to GitHub: <git's last line>"; nothing changes.
3. Build the file. Mark the thread handed off: `handed_off: {at, head, stage}` on the
   record. Stop the lead session (as `session stop` does). Save.
4. Respond 200 with the file as `application/json` and
   `Content-Disposition: attachment; filename="<name>"`.

Steps 3 and 4 happen only after the push succeeded. If saving fails, respond 500 and do
not stop the lead.

Thread page: an **Export** button in the head beside Archive (`viewer/pages/thread.js:147-166`).
Enabled only at an export point, otherwise disabled with the reason as a line under it
(the thread view payload carries `export: {ok, reason}`). Pressing it asks "Export and hand
off? This thread stops taking work here." with Confirm / Cancel; Confirm downloads the file.

### The original thread after export

- A handed-off thread is readable but takes no new work: composer, attach and card buttons
  disabled; `POST /threads/:id/messages`, uploads, card presses and `restart` return 409
  "handed off". The "Restart lead" panel (`viewer/pages/thread.js:268-278`) is not shown.
- The page shows a banner: "Handed off <date>. Import a newer file to continue here, or
  undo." with an **Undo hand-off** button: `POST /threads/:id/undo-handoff` clears
  `handed_off` and runs the restart path (`restartLead`, `viewer/app/threads.js:122-159`).
- The threads list shows a "handed off" label on such threads. Archive works as for any
  thread.

### Import

New-thread screen (`viewer/pages/new.js`): a second action **Import a handoff** beside
Start. It uses the same machine and project pickers and a file chooser (`.json`). The
page reads the file and sends `POST /threads/import` with `{machine, project, file}` (the
parsed JSON). The project path is validated as in `createThread`
(`viewer/app/threads.js:43-64`); the machine and project come from the picker, never the file.

The hub then:

1. **Validates** the file: shape and patterns above, size, `format`, `version`, `stage`,
   `branch === "wc/" + thread.id`, `pr_url` presence rule, `cards` an array of objects.
   Failure: 422 "this isn't a handoff file wheelchair can read: <what>".
2. **Matches the repository**: asks the machine for the project's normalized `origin` URL.
   Mismatch: 422 "this file is for <file repo>, but that project is <project repo>".
3. **Checks the branch**: machine fetches `origin`; `origin/wc/<id>` must exist and
   contain `head` (`head` is an ancestor of or equal to its tip). Otherwise 409 "the branch
   on GitHub doesn't have the exported work".
4. **Looks for the thread id** in this hub, archived or not, and branches (the table
   below). Only for Create and Advance, the branch tip must also **equal** `head`: a tip
   past `head` means someone already picked the work up (see Pick-up commit), and import
   is refused with 409 "this was already picked up elsewhere on <date of the first commit
   after head>; export again from wherever it is now".

| Case | Outcome |
|---|---|
| No such thread | **Create** (below). Response `{outcome: "created", id}` |
| Exists; its head equals `head`, or `head` is an ancestor of its head | **Open**: change nothing. `{outcome: "opened", id, note}`; note "You already have this thread here" or "This file is older than the thread here" |
| Exists; its head is a strict ancestor of `head` | **Advance** (below). `{outcome: "advanced", id}` |
| Exists; neither is an ancestor of the other | **Open**, change nothing; note "This thread and the file have each moved on separately, so nothing was changed. Bring the branches together yourself, then import again." |

   "Its head" is the local `wc/<id>` tip in the existing thread's worktree, or the local
   branch ref in the project when the thread is archived and has no worktree. Ancestry
   uses `git merge-base --is-ancestor` on the machine.
   If the existing thread is on another machine or project than the picker chose, the
   outcome is Open with note "This thread lives on <machine>, <project>".

The page navigates to the thread for `created` and `advanced`. For `opened` it shows the
note and an "Open the thread" link.

**Create.** Save a thread record with the file's `id`, `title`, `slug`, the picked
machine and project, `branch: wc/<id>`, and `imported: {at, stage, exported_at}`. Cards:
the file's cards, in order; any that are not answered are marked answered as retracted with
note "Carried over from the export" (`retracted_at`, `retracted_by: "import"`), so nothing
stale can be pressed. Pins: keep `idea` and `progress`; drop `offer` and `approval`. Start
a lead whose worktree is built from the existing remote branch (machine change below).
Queue to it `[wc:context import] Thread state:\n<json>` where the JSON is
`{slug, stage, exported_at, cards, pinned, recent_messages}` from the file.

**Advance.** Refused with 409 "the thread here is busy" unless the existing thread has no
live session other than the lead and the lead is idle or not live. Then: stop the lead if
live; if archived, rebuild its worktree from `origin/wc/<id>` and set `archived: false`;
otherwise fast-forward its worktree to `head` (`git merge --ff-only`), refused with 409
"the thread here has uncommitted changes" if the worktree is dirty. Append the file's cards
whose ids are not already present (open ones retracted as in Create), replace `pinned` as in
Create, clear `handed_off`, set `imported`, and start a lead in that worktree with the same
`[wc:context import]` message.

### Pick-up commit

Whoever takes the work pushes a small commit to the branch on GitHub before working, so
everyone can see from the branch that it was picked up.

- On Create and Advance, after the worktree is at `head` and before the lead starts, the
  machine makes an empty commit on `wc/<id>` (`git commit --allow-empty`) with message
  `handoff: picked up <ISO time>` and pushes it. If the push is rejected (the branch moved
  meanwhile), the import fails with the "already picked up elsewhere" 409, and a created
  thread record and worktree are removed again (the record is deleted; the worktree is
  removed with `git worktree remove`, its local branch kept).
- **Undo hand-off** first fetches and compares `origin/wc/<id>` with `handed_off.head`. If
  the tip has moved, undo is refused with 409 "this was picked up elsewhere on <date>;
  import a newer file to continue here", and the banner says the same.
- Advance's ancestry check still holds after a pick-up: the source's head is the exported
  head, which the pick-up commit and later work build on, so a file exported back from
  the other copy is strictly ahead.
- Someone picking the branch up by hand, without wheelchair, is asked (README) to push such
  a commit too; wheelchair cannot enforce that.

### Machine service changes (`machine/service.js`)

- `createWorktree` (`machine/service.js:425-478`) gains `input.from_remote_branch: true`:
  after the fetch, if a local `wc/<id>` does not exist, run
  `git worktree add -b <branch> <dest> origin/<branch>` then
  `git -C <dest> branch --set-upstream-to=origin/<branch>`; if it exists and is an ancestor
  of `origin/<branch>`, `git worktree add <dest> <branch>` then
  `git -C <dest> merge --ff-only origin/<branch>`; otherwise fail with "a local branch
  <branch> already exists and differs". The default path (`-b` from the default branch)
  is unchanged.
- New hub-only endpoint `POST /v1/handoff`, authorized like `/v1/archive`
  (`machine/service.js:1234`), with `action`:
  - `push` `{worktree, branch}` → `git push origin <branch>`; returns `{head, repository}`.
  - `inspect` `{project, branch, head, worktree?}` → fetch; returns `{repository,
    remote_has_branch, remote_contains_head, local_head, relation}` where `relation` is
    `same`, `behind` (file older), `ahead` (file strictly ahead), `diverged` or `none`.
  - `fast-forward` `{worktree, head}` → refuses on a dirty worktree, else
    `git merge --ff-only <head>`.
  - `pick-up` `{worktree, branch, head}` → refuses unless the worktree's HEAD is `head`;
    empty commit as in Pick-up commit, `git push origin <branch>` (no force); returns the
    new head or 409 on rejection.
  - `inspect` also returns `remote_tip` and, when the tip is past `head`, the committer
    date of the first commit after `head` (`git rev-list --reverse head..tip | head -1`).
  - Branch names must match `^wc/[0-9a-f]{12}$` and shas `^[0-9a-f]{40}$`; anything else 422.
- Repository normalization is one function used by both actions:
  `git@github.com:o/r.git`, `https://github.com/o/r(.git)`, `ssh://git@github.com/o/r` →
  `github.com/o/r`. A non-GitHub origin is used as-is minus scheme and `.git`.

### Protocol

- `protocol/app/lead.md`: new subsection under "Restarting what died": "Imported
  threads". On `[wc:context import]`, reply (shown) with a line saying the thread was
  imported and where it stands, run `session list`, then resume at the step the `stage`
  names (table above). Carried cards are history; post fresh cards for anything still
  needed. In step 4, planning question cards carry `doc: "PLAN.md"`.
- `protocol/app/cards.md` marker table: add `[wc:context import]` (hidden; reply shown,
  with "Imported from a handoff" in its place). Mirror wherever the app replaces the
  restart marker's bubble.
- README: one short section on export and import.

### Non-goals

- No code, uncommitted files, uploads or transcripts in the file.
- No export or resume mid-step; no export of archived threads.
- No merging of diverged copies.
- No cross-repository import (a fork with another remote is a different repository).
- No encryption or signing of the file.

### Validation

New tests, then the suites:

- `viewer/test/app-handoff.test.js` (hub, with the existing fake machine): export refused
  with each reason; export at each of the three points returns the file with correct
  fields, marks handed off, stops the lead; push failure changes nothing; handed-off
  thread refuses messages, presses, restart; undo restarts the lead; import validation
  failures (bad JSON shape, bad id, wrong version, repo mismatch, missing branch); import
  create (cards carried, open ones retracted, pins filtered, `[wc:context import]` queued);
  pick-up commit pushed on create and advance; import refused when the tip moved past
  `head`, and the created record and worktree rolled back when the pick-up push is
  rejected; undo refused when the branch moved; opened-same, opened-older, opened-diverged, opened-other-machine, advanced (live and
  archived), advance refused when busy or dirty.
- `machine/test/service.test.js`: worktree from remote branch (new local, existing
  ancestor, existing diverged); `/v1/handoff` push/inspect/fast-forward/pick-up with each
  relation; name and sha validation; URL normalization table.
- Browser (`viewer/test/*.spec.js`): Export button disabled with reason, confirm and
  download; handed-off banner and Undo; new-thread Import flow for created and opened.

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

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
