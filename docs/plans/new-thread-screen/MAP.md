# Map: starting a thread, the project list and Settings (for the New thread screen)

Checked against: `c8ebeadbf0b733414c0c1682c027aa7c09b04d2a` (origin/main)
Built from `docs/maps/app-thread-page.md`, `docs/maps/app-sessions.md`, `docs/maps/viewer-serving.md`
(all re-checked this run) plus what no map covered: the New thread form, the project list,
Settings storage and how a page is added.

## How a thread is started today

1. The **sidebar form** is in the HTML of two pages: the Threads page (`viewer/pages/threads.html:23-38`)
   and the thread page (`viewer/pages/thread.html:45-59`, inside `col-side` above the thread's files).
   Both load the same script, `viewer/pages/threads.js`, which also draws the thread list.
2. Fields: Project (free-text input with a `<datalist>`), Lead runs as (claude|codex), On node
   (free text, default `hub`, also a datalist), First message (optional)
   (`threads.html:27-34`; `threads.js:173-179`). The datalist is filled from `GET /projects`
   plus every `thread.project` already in the list (`threads.js:125-133`, `141-142`). The node
   datalist is only `hub` plus machines named on existing threads, not the machine list.
3. Submit posts `{project, cli, machine, message?}` to `POST /wheelchair/api/threads`, then
   goes to `/wheelchair/app/thread?id=<id>` (`threads.js:183-188`). A failure shows in
   `#form-error` and keeps the form open (`threads.js:189-195`).
4. The route calls `hub.createThread` (`viewer/app/routes.js:180-182`) -> `createThread`
   (`viewer/app/threads.js:42-64`). **The only checks are: `project` is a non-empty string and
   `cli` is claude or codex** (`threads.js:43-48`); the message "project and cli are required"
   is used for both. `project` becomes `path.resolve(project)` (`threads.js:24`), so a relative
   path is resolved against the **hub's** working directory. Nothing checks the path exists, is
   a directory, is a git repo, or exists on the chosen machine. `machine` is not validated
   either (`threads.js:26`).
5. The thread is saved, **then the project path is added to `projects.json`**
   (`threads.js:54-55`), **then** the lead is started (`threads.js:56-61`). So a bad path
   leaves a saved thread and a permanent entry in the project list before anything fails.
6. `startSession` calls the machine named on the thread, `POST /v1/sessions` with
   `project_dir: thread.project` and `project: basename(thread.project)`
   (`viewer/app/sessions.js:114-137`, see `app-sessions.md`). The machine service's
   `createWorktree` runs `git -C <project_dir> fetch origin`, finds the default branch, then
   `git worktree add --no-track -b wc/<thread-id> <stateDir>/worktrees/<project>/<branch>`
   (`machine/service.js:229-255`). **This is where a non-repo or missing path first fails**: the
   service dies with git's message, `startSession` marks the session `failed` and rethrows
   (`sessions.js:137-142`), and the page shows "Could not start the thread: <message>". The
   thread record and the `projects.json` entry remain.
7. `thread.project` is also the key for behavior-template scope
   (`settings.roleLayers(settings, role, thread.project)`, `sessions.js:89`; `templateFor`
   matches `template.scope === project`, `viewer/app/settings.js:116-119`).

```
New thread form -> POST /threads {project,cli,machine,message}
   -> createThread: only "project non-empty, cli valid"
   -> save thread -> projects.json += path -> startSession (hub)
   -> machine POST /v1/sessions -> git fetch + worktree add in <project>
                                        | fail: session 'failed', thread + project entry stay
                                    error text back to the form
```

## Where the "New thread" buttons are

- **Nav button** (every app page): `viewer/pages/nav.js:80-94`. An `<a>` to
  `/wheelchair/app/threads?new=1`. If the page has `#new-form` it instead opens that form and
  focuses the project field (`nav.js:85-93`). **It sits after a flex spacer, so it is at the
  right end of the header, not the left** (`nav.js:70`, `viewer/pages/app.css:56-60`). On phones
  it shrinks to a `+` (`app.css:166-175`).
- **Sidebar button** `#new-toggle` ("+ New thread"), top of the thread list column, on both
  the Threads page and the thread page (`threads.html:11`, `thread.html:14`), styled at
  `app.css:115-117`. Its handler toggles the form (`threads.js:164-169`). This is the
  duplicate the idea removes. The list column is the left side of the page, so it is probably
  what "top-left" means. See the open point below.
- `?new=1` is read only by `threads.js:170` (opens the form). Nothing else uses it.
- Under 900px the form is hidden until opened (`app.css:159`); on the thread page the whole
  `col-list` and `col-side` are hidden (`app.css:161`), so on a phone the nav button is the
  only way in there.
- Other things that reference the form and will break when it goes:
  `viewer/test/app-ui.spec.js:50-76`, `app-threads.spec.js:102-107`, `app-views.spec.js:102-104`
  (all select `#new-toggle`, `#nt-*`, `#new-form`); the CSS `#new-form` rules
  (`app.css:139-144`, `159`); the `.col-side` aside on `threads.html` (the Threads page's whole
  third column holds only the form).

## The project list today

- File: `projects.json` in the hub's state dir, a JSON array of path strings
  (`viewer/app/state.js:46`, `projects()` at `:171-174`). Created empty at startup
  (`state.js:79-81`).
- **Only writer: `addProject`, called from `createThread`** (`state.js:196-203`,
  `threads.js:55`). Appends, never removes, never edits. There is no route to add or remove one.
- Read by `GET /projects` -> `{projects:[path]}` (`routes.js:41-43`, `API.md:25`), the Features
  page sidebar (`viewer/pages/features.js:54`, `180`), the New thread datalist, and Settings
  (`describe` returns `projects`, `settings.js:201-207`).
- **Behavior-template scope is checked against this list**: creating or moving a template to a
  project scope fails with 400 unless the path is in `projects.json`
  (`routes.js:104`, `127`). A folder recognized by a "default project folder" would
  not be in that list until a thread is created in it, unless the new feature also adds it.
- Names: the UI shows a project as the last path segment (`threads.js:66`, `77`,
  `settings.js:296-301`); two projects with the same last segment are told apart by the full
  path only in Settings (`settings.js:298-300`). The Threads list groups by that last segment,
  so two same-named projects in different places merge into one group (`threads.js:112-118`).

## Settings: how a setting is stored and added

- One file, `settings.json` in the hub state dir (`state.js:47`). `settings.js` normalizes on
  every read: `normalize(saved)` rebuilds the object field by field and **drops anything it
  does not name** (`viewer/app/settings.js:150-162`), so a new setting needs a default in
  `defaults()` (`:22-24`), a line in `normalize`, and a validator.
- Writes go through `update(hub, change)`, one read-modify-write queue per file, with
  `assertFits` run on the result (`settings.js:172-179`, `state.js:187-195`).
- The routes: `GET /settings` returns `describe()` (`handleSettings`, `routes.js:49-50`;
  `describe`, `settings.js:199-208`), and small settings go through **`PUT /settings/preferences`**,
  a body of optional keys each validated inline in the route (the `preferences` branch,
  `routes.js:78-97`). Adding a key means: the validation block in that
  route, the key in its response, the `normalize` and `describe` lines, a row in
  `viewer/app/API.md:28,31`, and a control in the page.
- The page: `viewer/pages/settings.js` renders `GET /settings` into three sections, Models and
  preferences, Behavior templates, Writing style (`:8`). Simple choices use `modeGroup`
  (segmented button, saves on click via `PUT /settings/preferences`, `:231-250`); the "Threads"
  section holds only Tool steps (`:282-285`). There is **no text-input setting yet**: a folder
  path field would be the first, and its save-on-change pattern would be new
  (`modelPicker` saves on `change` and shows the refusal under the control, `:95-112`, is the
  closest model).
- A project folder path is a different kind of setting from the others: it names a place on one
  machine, and the other settings are machine-independent.

## Machines and listing directories

- A thread has one `machine` (name; default `hub`). Machines live in `machines.json`
  (`state.js:45`, `machines()` `:146-150`), registered by the installer, not through the app.
  The hub calls a machine's service over HTTP with a shared secret (`machine-client.js:64-78`).
- **The machine service has no route to list directories or check a path.** Its hub-facing
  routes are `/v1/sessions` (start, list, submit, keys, pane, transcript, DELETE), `/v1/archive`,
  `/v1/status`, `/v1/preflight`, `/v1/preview` (`machine/service.js:745-750`; `machine/API.md`).
  So "every directory inside the default folder is a project" can be done on the hub itself
  with local file reads, but for any other machine it needs a new service route (the hub cannot
  reach another machine's disk).
- The hub has no list of machines for the UI: `GET /sessions` returns groups per machine
  (`routes.js:45`, `handleSessions`; used for the nav line, `nav.js:115-135`), and there is no `GET /machines`.
  The form's node field is free text.

## How a page is added

- `viewer/server.js`: add the name to `APP_PAGES` (`:1830`), which makes
  `/wheelchair/app/<name>` serve `viewer/pages/<name>.html` behind the remember cookie
  (`handleAppPage`, `:1867-1883`). `viewer/pages/<name>.js` and `.css` are served by the
  existing asset rule with no change (`docs/maps/viewer-serving.md`).
- A new page includes `app.css`, `nav.js` and its own script, and has `<header id="app-nav"
  data-current="...">` (see `settings.html:5-10`, a recent example of a page with no thread
  list). `data-current` only highlights a nav link (`nav.js:66`); a screen that is not a nav
  link (like New thread) would leave it off or use `threads`.
- Server tests that enumerate pages: `viewer/test/app-pages.test.js` (maps note unknown-page
  refusal; not re-read for the new name).

## Wrong or contradictory

- The brief says the top-left button opens the screen, but the nav "New thread" button is at
  the **right** of the header (`nav.js:70`, `app.css:56`); the left-hand "+ New thread" is the
  sidebar one the idea removes. Collin needs to say which he means to keep; the nav button is
  the one that exists on every page and is the only one a phone shows on the thread page.
- `createThread` writes `projects.json` and the thread **before** the session starts
  (`threads.js:54-56`), so a mistyped path becomes a permanent project-list entry and a dead
  thread. The idea's "save directories as projects" would be easier to trust if validation
  happened first; today nothing does.
- `GET /projects` is documented as "added when a thread is created" (`API.md:25`), which stays
  true only while `createThread` is the sole writer; any new writer changes that contract.
- `app-thread-page.md` and `app-sessions.md` were stale against main (model tiers, nav
  links); fixed this run, with the unverified parts marked in them.

## What I did not check

- Whether a fixture or test in `viewer/test/` asserts the exact nav link set or the page list.
- The Features page and the thread page's other use of `col-side` beyond the form
  (`#files`, `thread.js`).
- Any place that reads `thread.project` as a display name beyond the Threads list, Features
  sidebar and Settings.
- Behavior when `project` is a path on another machine: I only read the code; I did not start
  a thread. Whether `git fetch origin` fails for a repo with no remote was not run.
- How `findSlug` and the Features board treat two projects with the same last segment.
- Mobile layout of a new full-screen page; only the CSS breakpoints were read.
- `codex/model.sh`, preflight, and the viewer's `PAGE_CSP` for a page that needs a `<select>`
  or datalist (no CSP issue expected; not tested).
