---
slug: new-thread-screen
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# A New thread screen, with projects found from a folder

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Removing the top-bar button leaves no way to start a thread from inside a thread on a phone (list column hidden under 900px, `app.css:161`) | Collin chose this knowing it | yes (reply after the button question) | Accepted Risk (Collin's choice, Decision 1) |

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
| 9 | The default project folder and the path check work on every machine: a new machine-service route lists a folder's projects and checks a path. Settings holds one folder path, read on whichever machine the thread targets, so the dropdown follows the chosen machine | Collin picked "Every machine, one folder" | user |
| 10 | A found project is an immediate subdirectory of the default folder that holds a `.git` entry (directory or file); hidden names (leading `.`) are skipped. The path check requires an existing directory holding `.git` | Thread start runs `git fetch` + `git worktree add` in the path (`machine/service.js:229-255`); anything else fails there | defaulted |
| 11 | `~` and `~/...` in the default folder or a saved path expand on the target machine (its `$HOME`); other paths must be absolute | Paths differ per machine; relative paths resolved on the hub are today's bug (`threads.js:24`) | defaulted |
| 12 | Supersedes 7: known projects for behavior-template scope are `projects.json` plus saved-directory paths. Found folders join `projects.json` when a thread starts in them, as today | Listing a machine's folder from a Settings write would make template saves depend on a machine being up | defaulted |
| 13 | Saving a directory checks its path on the machine currently selected on the screen | The only machine the screen has in hand; a path can be valid on one machine and not another | defaulted |

## Spec

### What changes, from Collin's side

- "+ New thread" above the thread list (Threads page and thread page) is a link to a new
  **New thread screen** at `/wheelchair/app/new`. The sidebar form is gone from both pages.
  The New thread button in the top bar (`viewer/pages/nav.js:80-94`) is gone.
- Settings has a **Default project folder** text field.
- The New thread screen has: **Machine** (dropdown), **Project** (dropdown), **Lead runs as**
  (claude/codex), **First message** (optional), **Start**. Below them, **Saved directories**:
  the saved list with a Remove button on each, and an Add row (name + path + Save).

### Machine service: one new route

`GET /v1/projects?folder=<path>&check=<path>` (hub secret, like `/v1/status`), in
`machine/service.js` beside the other `/v1/*` routes, documented in `machine/API.md`.

- `folder` (optional): expand `~` / `~/` against the service's `$HOME`; must then be
  absolute, else `400`. Returns `found`: the immediate subdirectories (symlinks to
  directories followed) whose name does not start with `.` and which contain a `.git`
  entry (directory or file), as `[{name, path}]` sorted by name. A folder that does not
  exist or is not a directory gives `found: []` and `folder_error: "<plain reason>"`.
- `check` (optional): expand the same way. Returns `checked: {path, ok, reason?}` where
  `path` is the expanded absolute path, and `ok` is true only for an existing directory
  containing `.git`. `reason` is one of "does not exist", "is not a directory",
  "is not a git repository", "must be an absolute path".
- Neither given: `400`. Reads only; writes nothing.

### Hub

**State.** `settings.json` gains two fields, with defaults in `defaults()` and lines in
`normalize` (`viewer/app/settings.js:22-24, 150-162`):
- `default_project_folder`: string, default `""` (unset).
- `saved_dirs`: array of `{name, path}`, default `[]`. `name` non-empty after trim, at most
  60 characters, unique; `path` non-empty, absolute or starting with `~`.

**Routes** (`viewer/app/routes.js`, documented in `viewer/app/API.md`):
- `PUT /settings/preferences` accepts `default_project_folder` (string; trimmed; `""`
  clears; otherwise must be absolute or start with `~`, else `400`). It is not checked
  against a machine. The response and `GET /settings` include it.
- `GET /new-thread?machine=<name>` (default `hub`) returns
  `{machines, machine, default_folder, saved, found, found_error?, previous}`:
  - `machines`: names from `machines.json`, with `hub` first. A new `GET /machines` is not
    added; this route carries the list.
  - `found`: from the machine's `/v1/projects?folder=` when a folder is set, else `[]`.
    A machine that does not answer, or answers 404 (an older service), gives `found: []`
    and `found_error` in plain words ("<machine> is not reachable", "<machine> needs
    updating"); the route still returns 200.
  - `saved`: `saved_dirs`. `previous`: `projects.json`.
- `POST /settings/saved-dirs` `{name, path, machine}`: validates the fields, checks `path`
  on `machine` through `/v1/projects?check=`, stores the expanded path. Refusals: `400`
  with the field error or the check's reason; `409` when the name exists; `502` when the
  machine does not answer. Returns `{saved}`.
- `DELETE /settings/saved-dirs/:name` returns `{saved}`; `404` for an unknown name.
  Removing one changes no thread.
- Template scope (`routes.js:104,127`) accepts a path in `projects.json` or in
  `saved_dirs`. `describe()`'s `projects` and `scope_missing` use the same union.

**Starting a thread** (`createThread`, `viewer/app/threads.js:42-64`): after the existing
field checks and **before** `hub.save`, call the thread's machine with
`/v1/projects?check=<project>`. Not `ok`: `400 "<path> <reason> on <machine>"`. Unknown
machine: `404` as today from `state.machine`. No answer: `502 "<machine> is not reachable"`.
On success the thread's `project` is the **expanded path the machine returned**, not
`path.resolve` on the hub. Nothing is saved and nothing is added to `projects.json` on any
refusal. The `POST /threads` body is unchanged.

### The New thread screen

- `viewer/pages/new.html`, `new.js`, `new.css`; `new` added to `APP_PAGES`
  (`viewer/server.js:1830`). Includes `app.css` and `nav.js`, header without a
  `data-current` match (or `threads`).
- On load and whenever Machine changes, fetch `GET /new-thread?machine=`. Project dropdown,
  in this order, without duplicates by path: **Saved** (by name), **In <default folder>**
  (found, by name; hidden when a saved entry has the same name), **Used before**
  (`previous` not already listed, by last path segment, with the full path where two share
  one). Use `<optgroup>` labels. The option's value is the path; the full path shows under
  the dropdown for the selected one.
- `found_error` shows as one line under the dropdown. No default folder set: one line
  "Set a default project folder in Settings" linking to Settings.
- An empty list (nothing saved, found or used before) disables Start and says to save a
  directory below.
- Start posts `{project, cli, machine, message?}` to `POST /threads` and goes to
  `/wheelchair/app/thread?id=<id>`, as `threads.js:183-188` does today. A refusal shows on
  the screen and keeps the fields.
- Saved directories: Add posts `{name, path, machine}`; on success the list and dropdown
  refresh and the new entry is selected. Remove asks no confirmation and refreshes. Errors
  show beside the row.
- Phone (under 900px): one column, full-width controls, no horizontal scroll.

### Removals

- `viewer/pages/threads.html`: the `col-side` aside (the form) goes; `#new-toggle` becomes
  `<a id="new-toggle" href="/wheelchair/app/new">+ New thread</a>`.
- `viewer/pages/thread.html:45-59`: the form goes; the rest of `col-side` (files) stays;
  `#new-toggle` (`:14`) becomes the same link.
- `viewer/pages/threads.js`: form code (toggle, datalists, submit, `?new=1` opening)
  removed; `?new=1` on the Threads page now replaces the location with `/wheelchair/app/new`.
  The thread list code stays.
- `viewer/pages/nav.js`: the New thread button and its `#new-form` handling removed;
  `app.css` rules for the nav button, `#new-form` (`:139-144`, `:159`, `:166-175`) removed.

### Not doing

- No change to thread lifecycle after start, the thread list, or the Features page.
- No per-machine folder setting; no editing a saved entry in place (remove and re-add).
- Existing threads keep their stored `project`; `projects.json` is not migrated.

### Tests and validation

- `machine/test/service.test.js`: the new route (found filtering, `~` expansion, hidden and
  non-git directories skipped, missing folder, each `check` reason, `400` with neither).
- `viewer/test/*.test.js`: `GET /new-thread` (with a fake machine: found, unreachable,
  404), saved-dir add/duplicate/remove/check refusal, `default_project_folder` validation,
  `createThread` refusing a bad path with no thread and no `projects.json` entry, template
  scope accepting a saved path, `new` page served.
- Browser specs that used the form (`viewer/test/app-ui.spec.js:50-76`,
  `app-threads.spec.js:102-107`, `app-views.spec.js:102-104`) move to the new screen; add
  one for the screen at phone width.
- Commands:
  ```bash
  bash machine/test/run.sh
  node --test viewer/test/*.test.js
  npm --prefix viewer run test:browser
  ```

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| On a phone, inside a thread, there is no button to start a new thread (the list column is hidden under 900px); go back to Threads first | Collin chose to keep the list button over the top-bar one | planning |

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
