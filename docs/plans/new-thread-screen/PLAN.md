---
slug: new-thread-screen
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# A New thread screen, with projects found from a folder

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: Which machines does the default project folder (and the path check) cover?
- **Context:** A thread runs on one machine (`hub` by default). The hub can read its own
  disk, but the machine service has no route to list or check a directory
  (`machine/service.js:745-750`, MAP.md "Machines and listing directories").
- **Options:**
  - A. Hub only: the folder is read on the hub. Other machines use saved directories, and their paths are not checked before start.
  - B. Every machine: add one machine-service route that lists a folder's directories and checks a path. Settings holds one folder path, read on whichever machine the thread targets.
  - C. Every machine, each with its own folder in Settings.
- **Recommendation:** B.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Removing the top-bar button leaves no way to start a thread from inside a thread on a phone (list column hidden under 900px, `app.css:161`) | Collin chose this knowing it | yes (reply after the button question) | Accepted by Collin's choice; see Decision 1 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | The "+ New thread" button above the thread list stays and opens the new screen; the top-bar (nav) New thread button is removed | Collin picked "Keep the list one" | user |
| 2 | The screen keeps today's fields: project, lead CLI (claude/codex), machine, optional first message; on start it goes to the thread page as today | IDEA: starting works as today | defaulted |
| 3 | The machine field becomes a dropdown of registered machines (a new `GET /machines` from `machines.json`), default `hub` | Free text invites typos; the list exists | defaulted |
| 4 | Saved directories are `{name, path}` entries kept by the hub; the screen can add and remove them. A saved name that equals a discovered folder's name wins | "Save directories and link them to project names" | defaulted |
| 5 | The project dropdown is: saved directories, then folders found in the default folder, then any earlier project from `projects.json` not already listed. No free-text path field; a new path is added by saving it | One place to pick from, no typing to start | defaulted |
| 6 | The project path is checked (exists, is a directory) before the thread is saved or added to `projects.json`; a refusal shows on the screen | IDEA: bad path refused before a thread exists | defaulted |
| 7 | Folders found in the default folder count as known projects for behavior-template scope, alongside `projects.json` | Otherwise a discovered project can't scope a template (`routes.js:104,127`) | defaulted |
| 8 | The sidebar form is removed from both the Threads page and the thread page, with the `?new=1` path and its tests updated | IDEA | defaulted |

## Spec

(Grows as decisions land.)

- New page `/wheelchair/app/new` (add to `APP_PAGES`, `viewer/server.js:1830`): project dropdown, CLI, machine dropdown, first message, Start. Saved-directory manager (add name + path, remove) on the same screen.
- "+ New thread" (`#new-toggle`) on the Threads and thread pages becomes a link to that page. Nav button (`nav.js:80-94`) removed.
- Settings: "Default project folder" (text path). Saved directories stored by the hub.
- `createThread` validates the path before saving anything.

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
