---
slug: new-thread-screen
date: 2026-11-15
implemented-by: "claude standard (claude-sonnet-5-5) for T1, T2, T3; sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — A New thread screen, with projects found from a folder

Written for a hostile reviewer: every claim checkable, no claim without evidence.

Commit under verification: the head of `wc/1a4f2c3d8d4c` after this file's commit (code head
`4b914fe`, the T3 merge). Prior Work in PLAN.md is empty, so every row's origin is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Machine route `GET /v1/projects`, hub secret | this run | `machine/service.js:784` (route), `:741` (`projects`) | `machine/test/service.test.js:705` (incl. 401 without secret) |
| `folder`: `~`/`~/` expansion against `$HOME`, must be absolute else 400 | this run | `machine/service.js:745-752` | `service.test.js:705` (`~/code`, `~`, `relative/dir`, `~root` → 400) |
| `found`: immediate subdirs, symlinks followed, no leading `.`, name rule without `..`, holds `.git` (dir or file), sorted by name | this run | `machine/service.js:749-764` | `service.test.js:705` (alpha, filegit, linked listed; .hidden, plain, `bad name`, `a..b`, afile skipped) |
| Missing / not-a-directory folder → `found: []` + `folder_error` | this run | `machine/service.js:749-764` | `service.test.js:705` |
| `check`: `checked {path, ok, reason?}`, the five reasons | this run | `machine/service.js:765-776` | `service.test.js:705` (each reason; `~root/x` not expanded) |
| Neither param → 400; reads only | this run | `machine/service.js:743` | `service.test.js:705` |
| Route documented | this run | `machine/API.md:19` | read |
| `settings.json` `default_project_folder` (default `""`) and `saved_dirs` (default `[]`), in `defaults()` and `normalize` | this run | `viewer/app/settings.js:23`, `:161-162` | `viewer/test/app-new-thread.test.js:164`, `:125` |
| `saved_dirs` entry rules: name non-empty trimmed, ≤60, unique per machine; path is the machine's expanded path; machine name | this run | `viewer/app/routes.js:91-106` | `app-new-thread.test.js:125`, `:146` |
| `PUT /settings/preferences` accepts `default_project_folder` (trim, `""` clears, absolute / `~` / `~/`, `~user` → 400, not machine-checked); in response and `GET /settings` | this run | `viewer/app/routes.js:83-89`, `:151-158`; `settings.js:216` | `app-new-thread.test.js:164` |
| `GET /new-thread?machine=` returns `{machines, machine, default_folder, saved, found, found_error?, previous}` | this run | `viewer/app/routes.js:45`, `:54-81` | `app-new-thread.test.js:28`, `:46` |
| `machines`: `hub` first, hub's hostname entry folded | this run | `viewer/app/routes.js:56-59` | `app-new-thread.test.js:78` |
| `found` from the machine; `folder_error` → `found_error`; unreachable / 404 → `found: []` + plain `found_error`, still 200 | this run | `viewer/app/routes.js:63-71` | `app-new-thread.test.js:28`, `:55` |
| `saved` filtered by machine | this run | `viewer/app/routes.js:62` | `app-new-thread.test.js:92` |
| `previous`: distinct projects of threads on that machine incl. archived and the hostname alias, newest first | this run | `viewer/app/routes.js:72-79` | `app-new-thread.test.js:105` |
| `POST /settings/saved-dirs`: validate, check on machine, store expanded path; 400 / 409 / 502; returns `{saved}` | this run | `viewer/app/routes.js:91-106`, `:162-164` | `app-new-thread.test.js:125`, `:146` |
| `DELETE /settings/saved-dirs/:name?machine=`: `{saved}`, 404 unknown, no thread changed | this run | `viewer/app/routes.js:165-174` | `app-new-thread.test.js:125` |
| Template scope accepts `projects.json` ∪ saved paths; `describe()` `projects` and `scope_missing` use the union | this run | `viewer/app/settings.js:168-170`, `:213-216`; `routes.js:179`, `:200` | `app-new-thread.test.js:212` |
| Routes documented in `viewer/app/API.md` | this run | `viewer/app/API.md:11`, `:28-35` | read |
| `createThread` checks the path on the thread's machine before `hub.save`; 400 `"<path> <reason> on <machine>"`, 404 unknown machine, 502 not reachable; nothing saved, no `projects.json` entry on refusal | this run | `viewer/app/threads.js:43-55`, `:64-67` | `app-new-thread.test.js:184`; `viewer/test/app-machines.test.js:80` |
| Stored `project` is the machine's expanded path, not `path.resolve` | this run | `viewer/app/threads.js:23`, `:67` | `app-new-thread.test.js:202` |
| `POST /threads` body unchanged | this run | `viewer/pages/new.js:140-154` posts `{project, cli, machine, message?}` | `viewer/test/app-new-thread.spec.js:40` |
| `new` page: `new.html/js/css`, `APP_PAGES`, includes `app.css` and `nav.js`, header `data-current="threads"` | this run | `viewer/pages/new.html:1-9`; `viewer/server.js:1830` | `viewer/test/app-pages.test.js:48-49` |
| Fetch `/new-thread` on load and on Machine change | this run | `viewer/pages/new.js:95-108`, `:119` | `app-new-thread.spec.js:29-97` |
| Project dropdown: Saved / In <folder> / Used before optgroups, dedup by path, never hidden by name, Used-before labels by last segment with full path on clash, value = path, full path under the dropdown | this run | `viewer/pages/new.js:37-56`, `:58-67` | `app-new-thread.spec.js:40`, `:66` |
| Git-only note when a folder is set; `found_error` line; no-folder line linking to Settings | this run | `viewer/pages/new.js:65-67`; `new.html:18-21` | `app-new-thread.spec.js:97` |
| Empty list disables Start and says to save a directory | this run | `viewer/pages/new.js:58-63`; `new.html:22` | `app-new-thread.spec.js:90` |
| Start posts and opens `/wheelchair/app/thread?id=`; refusal shown, fields kept | this run | `viewer/pages/new.js:140-154` | `app-new-thread.spec.js:40`, `:51` |
| Saved directories: Add (entry selected after), Remove (no confirm), errors shown | this run | `viewer/pages/new.js:110-117`, `:122-138`; `new.html:28-41` | `app-new-thread.spec.js:66` (see Deviations for where errors show) |
| Phone (<900px): one column, full width, no horizontal scroll | this run | `viewer/pages/new.css:22-26` | `app-new-thread.spec.js:29` |
| Settings: Default project folder input + Save + hint in "Threads"; 400 under the input keeping the typed value; "Saved"; empty clears | this run | `viewer/pages/settings.js:216-241`, `:316` | `viewer/test/app-settings.spec.js:258` |
| Threads page: form aside removed, `.shell.no-side` two-column rule also overriding 900-1099px; `#new-toggle` a link to `/wheelchair/app/new` | this run | `viewer/pages/threads.html:9-11`; `viewer/pages/app.css:110`, `:168` | `viewer/test/app-ui.spec.js:50-59` |
| Thread page: form removed, files aside kept, `#new-toggle` link | this run | `viewer/pages/thread.html:14`, `:45-47` | `app-ui.spec.js:77-79` |
| `threads.js`: form code removed; `?new=1` replaces location with `/wheelchair/app/new`; list code kept | this run | `viewer/pages/threads.js:104` | `viewer/test/app-threads.spec.js` (moved form case) |
| `nav.js` New thread button and `#new-form` handling removed; `app.css` nav-button and `#new-form` rules removed | this run | `viewer/pages/nav.js` (no `new-thread`, `new-form` or `nt-project` remains); `app.css` diff | `app-settings.spec.js:236` (phone fit incl. `/app/new`) |
| Browser specs moved from the form (`app-ui`, `app-threads`, `app-views`), `app-settings` nav check changed; `app-machines.test.js` case changed and unreachable case added | this run | `viewer/test/app-ui.spec.js:50-79`; `app-threads.spec.js`; `app-views.spec.js`; `app-settings.spec.js:236`; `app-machines.test.js:67`, `:80` | full suites below |
| Not doing: lifecycle, thread list, Features page untouched; no per-machine folder; no in-place edit; no migration | this run | diff `main...HEAD` touches none of `viewer/pages/features.*`, `viewer/app/sessions.js`, `machine/service.js` start path | read |

## Deviations from plan

- **Saved-directory errors (Spec: "Errors show beside the row").** Add and Remove errors show
  in one line, `#saved-error`, directly above the Add row (`viewer/pages/new.html:35`), not
  beside each saved entry's row. An Add error sits next to the row it came from; a Remove error
  is in the same line, naming the entry ("Could not remove <name>: …", `new.js:116`).
- **Status codes the Spec left open** (T2 choices, in PLAN.md's Log): `POST /settings/saved-dirs`
  answers `201`; `GET /new-thread` with an unknown machine is `404`; an older machine (404 on
  the check) at thread start or on save is `502 "<machine> needs updating"`.

## Routers

highways not installed; routers not maintained. `viewer/AGENTS.md:26` lists the app's pages
without the new `new` page.

## Validation evidence

Run by the sub-lead on `wc/1a4f2c3d8d4c` at `4b914fe`, after `npm --prefix viewer ci` in this
worktree (`viewer/node_modules` was absent; the font route test needs it).

```
$ bash machine/test/run.sh
# tests 66
# pass 66
# fail 0

$ node --test viewer/test/*.test.js
not ok 171 - a starter that loses the freed port registers through the new holder
# tests 277
# pass 276
# fail 1

$ npm --prefix viewer run test:browser
  ✘  305 [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  ✘  451 [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 failed
  2 skipped
  464 passed (1.5m)
```

Both remaining failures are recorded in `docs/known-issues.md` (":6" the freed-port test,
":53" the committed-graph arrow test) and fail on the feature branch before T2 and T3 landed:
the freed-port test failed in the sub-lead's node run after only T1 (machine-only) was merged;
the arrow test failed on the branch before T3, and this branch adds no `docs/plans/*/graphs/`
files (`git diff --stat main...HEAD -- 'docs/plans/*/graphs'` is empty).

Worker-branch re-runs by the sub-lead before each merge: T1 `bash machine/test/run.sh` 66/66;
T2 node suite 275 pass, 1 fail (freed-port); T3 browser suite 463 passed, 3 failed (the arrow
test twice, and `app-threads.spec.js:339` Firefox phone approval timing out at 30 s), with
`app-threads.spec.js --repeat-each 3` then 324 passed, 0 failed.

## Known gaps / residual risks

- The machine route is checked against the real service only in `machine/test`; every hub
  test and browser spec uses the fake machine in `viewer/test/helpers/app-machine.js`, whose
  `/v1/projects` imitates the contract (`~` → `/home/fake`).
- A machine service that predates this change answers 404: the screen says "<machine> needs
  updating" and starting a thread on it is refused with 502 until the service is updated.
- `DELETE /settings/saved-dirs/:name` with a malformed percent-escape in the name is not
  caught (`decodeURIComponent` throws), which gives an error status other than 404.
- T2 was built amid a collision (two workers in one worktree, PLAN.md Log); the merged code was
  read in full for leftover duplicates and holds one definition of each function.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-15

Verification attempt 1 (Codex `gpt-6.1-sol`, on `26d926a`) failed with four gaps, listed
verbatim in `REMEDIATION-1.md`. Fixed by R1 (Claude standard, `claude-sonnet-5-5`, `d6068fc`)
and R1e (Claude light, `claude-haiku-5-5`, `3803075`; a fifth case of the first gap, found
by the sub-lead reviewing R1).

| Gap | Fix at (file:line) | Validated by |
|-----|--------------------|--------------|
| Machine switch kept the old project selectable and Start enabled; Start posted it with the new machine | `viewer/pages/new.js:133` (switch empties and disables Project and Start, sets `state.machine = null`); `:166` (Start refuses unless `state.machine` matches, and posts `state.machine`) | `viewer/test/app-new-thread.spec.js` delayed machine-switch test |
| Saved list stayed clickable during a switch; Remove went to the new machine (R1e) | `viewer/pages/new.js:133` (saved list emptied); `:112` (Remove refuses when stale, deletes on `state.machine`) | `app-new-thread.spec.js` saved list empty until the delayed answer lands |
| Duplicate paths within a group | `viewer/pages/new.js:37` (`group()` checks and marks `seen` per item) | `app-new-thread.spec.js` two saved names, one path, one option |
| Name `..` saved but not removable | `viewer/app/routes.js:94` (`.` and `..` refused, 400); DELETE turns a malformed escape into 404; `viewer/app/API.md` POST row | `viewer/test/app-new-thread.test.js` (`..`, `.` → 400; `%E0%A4%A` → 404) |
| Remove errors not beside the row | `viewer/pages/new.js:112` (error line inside that entry's `<li>`); `viewer/pages/new.html:40` (`#add-error` directly under the Add row); shared banner removed | `app-new-thread.spec.js` failed Remove shows in its row; Add refusal under the Add row |

The first two Deviations above (saved-directory errors in one shared line) no longer hold: errors
now sit beside their row. The residual risk "malformed percent-escape in DELETE" is closed.

Validation on `wc/1a4f2c3d8d4c` at `77c12c1`, run by the sub-lead:

```
$ bash machine/test/run.sh
# tests 66
# pass 66
# fail 0

$ node --test viewer/test/*.test.js
# tests 278
# pass 278
# fail 0

$ npm --prefix viewer run test:browser
  ✘  [chromium] › test/app-new-thread.spec.js:29:1 › one column, full-width controls, no sideways scroll
     (setup: "server exited before ready (1): Refused to use a port held by a process it cannot identify")
  ✘  [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  ✘  [firefox] › test/app-threads.spec.js:250:5 › phone › cards: every kind renders and presses call the press route (30.1s timeout)
  ✘  [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  4 failed, 2 skipped, 470 passed

$ npm --prefix viewer run test:browser -- app-new-thread.spec.js app-threads.spec.js --repeat-each 2
  256 passed
```

The arrow test is the recorded known issue (`docs/known-issues.md:53`). The other two failed on
test-server startup (a port race in the helper) and a 30 s timeout under load, and pass on repeat.
The freed-port node test passed this run.
