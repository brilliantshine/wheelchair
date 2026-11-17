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

## Spec

Terms: the **source** thread is the one exported; the **file** is the export; the
**importing app** is the hub the file is imported into (it may be the same hub). The hub
runs `viewer/app/*`; the machine service runs `machine/service.js`. A **claim** is an empty
commit pushed to the thread's branch on GitHub to show who holds the work (see Claims).

### Export points

A thread can be exported at exactly three points. At each, the thread must also be
**quiet**:

- not archived, not handed off;
- no session other than the lead is `live`; the lead is live with `turn_ended === true`
  (`viewer/app/sessions.js:515-543`) and no message is queued for it;
- no aside is open or has a turn running (`thread.asides`, `viewer/app/asides.js`);
- no `sudo` card is in state `waiting`;
- the worktree has no uncommitted changes (`git status --porcelain` empty, untracked
  files included).

The stage is read from the **committed** files at the worktree's `HEAD`
(`git show HEAD:docs/plans/<slug>/IDEA.md` and `PLAN.md`), never from the working files.

| Point (`stage` in the file) | Holds when | Import resumes at |
|---|---|---|
| `idea-confirmed` | IDEA.md `status: confirmed`; PLAN.md absent or `status: planning`; no answered `question` card whose `doc` is `PLAN.md` | Planning (lead step 4): the lead reads IDEA, MAP and any PLAN.md on the branch and asks the open questions again |
| `approved` | PLAN.md `status: approved`; no `approval` card was answered with Start building | Approval (lead step 6): the lead posts a fresh approval card with a fresh Ready check |
| `done` | PLAN.md `status: done`; a non-replaced `done` card with `pr_url` exists; no `merged` card exists | After done (lead step 9) |

The `idea-confirmed` test relies on planning question cards carrying `doc: "PLAN.md"`;
lead.md is updated to require it (see Protocol). A retracted approval card does not
block the `approved` point.

When the thread is not at an export point, the export control is shown disabled with one
line saying why. The hub computes it; first match wins:

| Reason | Shown |
|---|---|
| archived | "Archived threads can't be exported" |
| handed off | "Already handed off" |
| `merged` card exists | "The pull request is merged; nothing left to hand off" |
| origin not on GitHub | "This project's origin isn't on GitHub" |
| another live session or an aside running | "Agents are still working" |
| lead mid-turn or message queued | "The lead is busy" |
| sudo waiting | "A root command is waiting" |
| dirty worktree | "Some changes aren't committed yet" |
| no point holds | "Not at a stopping point: export after the idea is confirmed, once the plan is approved, or when it's done" |

### The file

One JSON object, UTF-8, at most **10 MB** as bytes on the wire, downloaded as
`<title-kebab>.wheelchair.json` (title lower-cased, non-alphanumerics collapsed to `-`,
cut to 60 characters, fallback `thread`). All fields required unless noted; an unknown
top-level field is refused on import:

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
| `cards` | the source thread's non-replaced cards, as stored |
| `pinned` | the source thread's `pinned` object |
| `recent_messages` | last 20 sent messages from `collin` or `card`, as restart builds them (`viewer/app/threads.js:127-133`) |

Not in the file: the machine, project path, CLI, provider, sessions, transcripts, uploads,
asides, queues. Uploaded attachments do not travel; `[attached: ...]` lines in carried
messages may point at files that do not exist on the importing machine.

### Claims

A claim is an empty commit on `wc/<id>` made **without a worktree**:
`git commit-tree <parent>^{tree} -p <parent> -m "<message>"` in the project repository,
then `git push origin <new-sha>:refs/heads/wc/<id>` (never forced). The push succeeds only
if the remote tip is still `<parent>`, so a claim is atomic: exactly one of two racing
claims wins. A rejected push changes nothing, locally or remotely. Messages:
`handoff: picked up <ISO time>` (import) and `handoff: taken back <ISO time>` (undo).

Wheelchair claims on every import that creates or advances a thread, and on undo. Someone
taking the branch by hand, without wheelchair, is asked (README) to push such a commit too;
wheelchair cannot enforce that.

### Export

`POST /threads/:id/export` (hub route, beside restart and archive in `viewer/app/routes.js`).

1. Re-check the export point and quiet test; on failure 409 with the reason sentence.
2. Ask the machine to push `wc/<id>` from the thread's worktree to `origin`
   (`/v1/handoff` `push`). It returns the pushed head and the normalized repository. On
   failure 409 "Couldn't push the branch to GitHub: <git's last line>"; nothing changes.
3. Build the file. If it is over 10 MB, 409 "This thread is too large to export"; the
   push already happened, which is harmless, and nothing else changes.
4. Save `handed_off: {at, head, stage}` on the record and cancel asides as archive does
   (`viewer/app/threads.js:163-167`). If the save fails, 500 and nothing else changes
   (the lead keeps running).
5. Stop the lead as `session stop` does. If the stop fails, carry on: the thread is
   already handed off, so nothing reaches that lead (see below).
6. Respond 200 with the file as `application/json` and
   `Content-Disposition: attachment; filename="<name>"`.

Thread page: an **Export** button in the head beside Archive (`viewer/pages/thread.js:147-166`).
Enabled only at an export point, otherwise disabled with the reason as a line under it
(the thread view payload carries `export: {ok, reason}`). Pressing it asks "Export and hand
off? This thread stops taking work here." with Confirm / Cancel; Confirm downloads the file.

### The original thread after export

- A handed-off thread is readable but takes no new work. The hub returns 409 "handed off"
  for: messages, uploads, card presses, card posts from any session of the thread,
  session starts, aside creation and aside messages, and `restart`. The composer, attach
  and card buttons are disabled, and the "Restart lead" panel
  (`viewer/pages/thread.js:268-278`) is not shown.
- The page shows a banner: "Handed off <date>. Import a newer file to continue here, or
  undo." with an **Undo hand-off** button, shown only when the thread is not archived.
- `POST /threads/:id/undo-handoff`: claim on top of `handed_off.head` ("taken back"). If
  the claim is rejected, 409 "This was picked up elsewhere on <committer date of the first
  commit after handed_off.head>; import a newer file to continue here", and the banner
  says the same from then on. On success: fast-forward the worktree to the claim, clear
  `handed_off`, and run the restart path (`restartLead`, `viewer/app/threads.js:122-159`).
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

The hub then:

1. **Validates** the file: JSON, the shape and patterns above, `format`, `version`,
   `stage`, `branch === "wc/" + thread.id`, the `pr_url` presence rule. Each card must
   have a string `id`, a known `kind`, and pass `validate(kind, card)` from
   `viewer/app/card.js:146` on its card fields; the stored fields `answered` (boolean),
   `answer`, `replaced`, `retracted_*`, `resolved_*`, timestamps and session name must be
   of the type `viewer/app/cards.js` writes. `pinned` must only name ids present in
   `cards`. `recent_messages` entries must have `source` `collin` or `card` and a string
   `text`. Failure: 422 "This isn't a handoff file wheelchair can read: <what>".
2. **Matches the repository**: the machine reports the project's normalized origin.
   Mismatch: 422 "This file is for <file repo>, but that project is <project repo>".
3. **Inspects the branch** (`/v1/handoff` `inspect`): fetch; `origin/wc/<id>` must exist and
   contain `head`, otherwise 409 "The branch on GitHub doesn't have the exported work".
   At `head`, the committed IDEA.md and PLAN.md must satisfy the `stage`'s status
   conditions from the Export points table, and for `done` a card of kind `done` with the
   file's `pr_url` must be in `cards`. Otherwise 422 "The file says <stage>, but the
   branch doesn't".
4. **Looks for the thread id** in this hub, archived or not:

| Case | Outcome |
|---|---|
| No such thread, or only a `pending` import record for it (see Create) | **Create** |
| Exists on another machine or project than the picker chose | **Open**, note "This thread lives on <machine>, <project>" |
| Exists; its head equals `head`, or `head` is an ancestor of its head | **Open**, change nothing. Note: "You already have this thread here", plus " It's handed off: press Undo on it to carry on here." when it is handed off and not archived; or "This file is older than the thread here" |
| Exists; its head is a strict ancestor of `head` | **Advance** |
| Exists; neither is an ancestor of the other | **Open**, change nothing; note "This thread and the file have each moved on separately, so nothing was changed. Bring the branches together yourself, then import again." |

   "Its head" is the local `wc/<id>` tip in the existing thread's worktree, or the local
   branch ref in the project when it has no worktree. Ancestry uses
   `git merge-base --is-ancestor`.

   For Create and Advance, the remote tip must also **equal** `head`. A tip past `head`
   means someone already picked the work up: 409 "This was already picked up elsewhere on
   <committer date of the first commit after head>; export again from wherever it is now".

Responses: `{outcome: "created"|"advanced"|"opened", id, note?}`. The page navigates to
the thread for `created` and `advanced`; for `opened` it shows the note and an "Open the
thread" link.

**Carried state**, used by both Create and Advance:
- `cards` replace the thread's card list wholesale, in the file's order. Every card that
  is not answered is marked answered as retracted (`retracted_at` now, `retracted_by:
  "import"`, note "Carried over from the export"). Nothing carried can be pressed.
- `pinned`: keep the `idea` and `progress` pins; drop `offer` and `approval`.
- `recent_messages` are appended to `thread.sent` (each with `imported: true`), skipping
  any already present with the same source, text and time, so a later restart or export
  carries them on.
- `import_context: {slug, stage, exported_at, cards, pinned, recent_messages}` is saved
  on the record with `import_context_delivered: false`.

**Create**, in this order:
1. Save a record with the file's `id`, `title`, `slug`, the picked machine and project,
   `branch: wc/<id>`, `imported: {at, stage, exported_at, pending: true}` and the carried
   state. No session yet.
2. Claim on top of `head` ("picked up"). Rejected: delete the record, 409 "already picked
   up elsewhere" as above.
3. Clear `imported.pending`; save.
4. Start a lead with `from_remote_branch: true` (machine change below), so its worktree is
   `wc/<id>` at the claim commit.
5. Queue `[wc:context import] Thread state:\n<import_context JSON>` to it.

**Advance**, in this order:
1. Refuse 409 "The thread here is busy" unless the existing thread has no live session
   other than the lead, no aside running, and the lead is idle or not live. Refuse 409
   "The thread here has uncommitted changes" if its worktree is dirty.
2. Claim on top of `head`. Rejected: 409 "already picked up elsewhere"; nothing changed.
3. Stop the lead if live.
4. If the thread has a worktree, fast-forward it to the claim (`/v1/handoff`
   `fast-forward`). If archived or without a worktree, set `archived: false` and clear
   `worktree`, so step 6 builds a new one from the remote branch.
5. Apply the carried state; clear `handed_off`; set `imported`; save.
6. Start a lead (in the existing worktree, as restart does, or with
   `from_remote_branch: true`) and queue the `[wc:context import]` message.

**Recovery.** If the lead fails to start or dies before `import_context_delivered` is set,
the thread shows the normal dead-lead panel. Its Restart (`restartLead`) sends
`[wc:context import]` built from the saved `import_context` instead of
`[wc:context restart]` while `import_context_delivered` is false. The hub sets
`import_context_delivered: true` when the lead's first turn after delivery ends. A retry
of the same import lands on Open, as the local head is then the claim.

### Machine service changes (`machine/service.js`)

- `createWorktree` (`machine/service.js:425-478`) gains `input.from_remote_branch: true`:
  after the fetch, if a local `wc/<id>` does not exist, run
  `git worktree add -b <branch> <dest> origin/<branch>`; if it exists and is an ancestor of
  `origin/<branch>`, `git worktree add <dest> <branch>` then
  `git -C <dest> merge --ff-only origin/<branch>`; otherwise fail with "a local branch
  <branch> already exists and differs". The worktree counts as created by this start for
  archive ownership, as the default path does (`machine/service.js:531-540`). The default
  path is unchanged.
- New hub-only endpoint `POST /v1/handoff`, authorized like `/v1/archive`
  (`machine/service.js:1234`), with `action`:
  - `push` `{worktree, branch}` → `git push origin <branch>`; returns `{head, repository}`.
  - `inspect` `{project, branch, head, worktree?, slug}` → fetch; returns `{repository,
    remote_tip, remote_has_branch, remote_contains_head, picked_up_at, local_head,
    relation, idea_status, plan_status}`. `relation` is `same`, `behind` (file older),
    `ahead` (file strictly ahead), `diverged` or `none`; `picked_up_at` is the committer
    date of the first commit after `head` when the tip is past it; the statuses are read
    with `git show <head>:docs/plans/<slug>/IDEA.md` and `PLAN.md` (null when absent).
  - `claim` `{project, branch, parent, message}` → the Claims recipe; returns
    `{head}` or 409 `{picked_up_at}` on rejection.
  - `fast-forward` `{worktree, head}` → refuses on a dirty worktree, else
    `git merge --ff-only <head>`.
  - `status` `{worktree, slug}` → `{dirty, head, idea_status, plan_status}` from
    `git status --porcelain` and `git show HEAD:...`; used by the export check.
  - Branch names must match `^wc/[0-9a-f]{12}$`, shas `^[0-9a-f]{40}$`, slugs the file's
    pattern, and `worktree`/`project` must be paths the machine already knows; anything
    else 422.

### Normalization

One function, in the machine: `git@github.com:o/r.git`, `https://github.com/o/r`,
`https://github.com/o/r.git`, `ssh://git@github.com/o/r(.git)` → `github.com/o/r`,
lower-cased. Any other origin returns `null`, which blocks export ("origin isn't on
GitHub") and import (422 "That project's origin isn't on GitHub").

### Protocol

- `protocol/app/lead.md`: new subsection under "Restarting what died": "Imported
  threads". On `[wc:context import]`, reply (shown) with a line saying the thread was
  imported and where it stands, run `session list`, then resume at the step the `stage`
  names (table above). Carried cards are history; post fresh cards for anything still
  needed. In step 4, planning question cards carry `doc: "PLAN.md"`.
- `protocol/app/cards.md` marker table: add `[wc:context import]` (hidden; reply shown,
  with "Imported from a handoff" in its place). Mirror it wherever the app replaces the
  restart marker's bubble.
- README: one short section on export, import and claims.

### Non-goals

- No code, uncommitted files, uploads or transcripts in the file.
- No export or resume mid-step; no export of archived or merged threads.
- No merging of diverged copies.
- No cross-repository import, and no non-GitHub origins.
- No encryption or signing of the file.

### Validation

New tests, then the suites:

- `viewer/test/app-handoff.test.js` (hub, with the existing fake machine):
  - export refused with each reason in the table; export at each point returns a file with
    the right fields, marks handed off, cancels asides, stops the lead; push failure,
    oversize file and save failure change nothing; a failed lead stop still hands off;
  - handed-off thread refuses each listed route; undo claims and restarts; undo refused
    when the claim is rejected; no Undo on an archived handed-off thread;
  - import validation failures (bad JSON, bad id, wrong version, malformed card fields,
    pin naming a missing card, stage not supported by the branch, done without the done
    card, repo mismatch, non-GitHub origin, missing branch, body over 10 MB);
  - create: claim, cards replaced with open ones retracted, pins filtered, messages
    carried into `sent`, `[wc:context import]` queued; claim rejected deletes the record;
  - recovery: lead start failure, then Restart sends `[wc:context import]`; after the first
    turn, Restart sends `[wc:context restart]`;
  - open (same, older, handed-off note, diverged, other machine); advance (live and
    archived); advance refused when busy, dirty, or the tip moved past `head`.
- `machine/test/service.test.js`: worktree from remote branch (new local, existing
  ancestor, existing diverged) and its archive ownership; `/v1/handoff` push, inspect
  (each relation, statuses at head, picked_up_at), claim (wins, loses a race), fast-forward,
  status; input validation; normalization table.
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

**Lanes:** intent and mechanics, see start; cross-family: yes.

**Changed since Round 1:**
- New Claims section: empty commit via `commit-tree` + non-forced push; used by import and undo.
- Quiet test adds asides and a clean worktree; stage read from committed HEAD; reasons table; `merged` and non-GitHub blocks.
- Export order: push, size check, save, stop lead.
- Handed-off thread refuses all input routes, card posts, session starts and asides; undo claims; no Undo when archived.
- Import: raw-body 10 MB limit; deep card validation; stage checked at `head`; carried state replaces cards and joins `sent`; Create and Advance step orders; Recovery via stored `import_context`.
- Machine: `from_remote_branch` archive ownership; `/v1/handoff` gains `claim` and `status`; Normalization section.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
