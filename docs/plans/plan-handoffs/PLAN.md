---
slug: plan-handoffs
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Plan handoffs: export and import a thread

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q4: Re-import when both copies moved on
- **Options:** (a) refuse and point to the existing thread, explaining why; (b) the import wins and overwrites the local thread; (c) the newer stage wins.
- **Recommendation:** (a): advance only when the import is strictly ahead (its branch contains the local branch's head and its stage is the same or later).

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

## Spec

### Export points

A thread can be exported at exactly three points. At each, the thread must also be quiet:
no session other than the lead is live, the lead is not mid-turn, and no sudo card is waiting.

| Point | Holds when | Import resumes at |
|---|---|---|
| Idea confirmed | IDEA.md `status: confirmed`, PLAN.md absent or `status: planning`, and no Decision Log row with source `user` yet | Planning: the lead reads IDEA, MAP and any PLAN.md on the branch and asks the open question cards again |
| Plan approved | PLAN.md `status: approved` and Start building not yet pressed | Approval: the lead posts a fresh approval card with a fresh Ready check |
| Done | PLAN.md `status: done` and the pull request exists | After done (lead step 9) |

Anywhere else, the export control is shown disabled with a one-line reason in Collin's
terms (for example "agents are still working", "planning has moved past the idea; export
again once the plan is approved").

### Thread identity

- The export file carries the thread id. An imported thread is created with that id, not a
  fresh one, and its branch is `wc/<id>`.
- The machine builds the worktree from `origin/wc/<id>` (after a fetch), checking out the
  existing remote branch as the local `wc/<id>`, not cutting a new branch from the default
  branch. The base-ref support in `machine/service.js:441-470` is extended for this; the
  `-b` path must not be used when the branch already exists on the remote.
- Pushes from the imported thread go to the same remote branch, so an open pull request
  updates in place. At the done point the file carries the pull request URL and the thread
  records it.
- If this app already has a thread with that id, import never creates a second one (see
  Re-import).

### The original thread after export

- A successful export marks the thread **handed off** in the hub record (time of export and
  the exported head commit). The app stops the lead session; transcripts stay.
- A handed-off thread is readable (messages, cards, documents) but takes no new work: the
  composer and card buttons are disabled, and the thread page shows a banner "Handed off
  <date>. Import a newer file to continue here, or undo."
- **Undo hand-off** clears the mark and starts a lead with the existing restart context
  (`viewer/app/threads.js:122-157`). The file already exported stays valid; re-importing it
  later is handled by Re-import.
- The threads list shows handed-off threads with a "handed off" label. They can be archived
  like any thread.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
