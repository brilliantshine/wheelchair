---
slug: sidebar-files-followup
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-20
---

# Thread files: the parts saved for later

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

Background: `docs/plans/thread-sidebar-files/PLAN.md` (Deferred D1–D7, Accepted Risks,
Review Rounds) and this plan's `MAP.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | User's pick | user |
| 2 | Picture downloads are PNG | Opens in every phone gallery and app; SVG often does not | defaulted |
| 3 | "Download all" is one zip of the thread's existing MAP.md, IDEA.md and PLAN.md | IDEA asks for project documents; pictures have their own image download, sent files their own rows | defaulted |
| 4 | In-app preview covers Markdown (rendered like the doc page) and plain text types (.txt, .log, .csv, .json and similar, shown as text) | IDEA's "text or Markdown"; other types keep downloading | defaulted |
| 5 | Threads on another computer read documents and pictures through that thread's machine service, with the network call made outside the per-thread locks | Required by IDEA's "must not freeze the thread list" and the lock rules in MAP.md | defaulted |
| 6 | Files already deleted by past archives are not recovered | They no longer exist anywhere | defaulted |
| 7 | Files agents sent are kept for good after archive; no timer, no delete button | User's pick; few, small files (25 MiB cap each) | user |
| 8 | HTML pictures download as their .html file, not PNG; graphs and forms download as PNG | HTML pictures run in a sandboxed frame the page cannot draw from; they are the rare fallback form | defaulted |
| 9 | The zip is built on the hub with a small built-in writer (stored, no compression), no new dependency | Three small Markdown files; the package has no zip library | defaulted |
| 10 | Remote threads show the last committed plan on `wc/<id>`, read through a new machine route; local threads keep reading the working tree | Leads commit plan changes each turn; reading refs avoids trusting worktree paths sent by the hub | defaulted |

## Spec

Five parts, independent of each other except where noted. "Remote thread" means a thread
whose `thread.machine` does not resolve to the hub's own machine (resolution as in
`viewer/app/state.js:212-220`, compared like `viewer/app/peers.js:6-10`). Everything else is a
"local thread" and keeps today's code paths unchanged.

### S1. Picture download (D1)

- The picture page (`viewer/pages/picture.js`) gets a **Download** button for every picture
  it can show.
- **Graph pictures:** clone the rendered SVG from the graph viewer
  (`viewer/index.html:1888-1906`), reset pan/zoom so the whole graph is in view, copy each
  element's computed style that affects drawing (fill, stroke, stroke-width, stroke-dasharray,
  opacity, font-family, font-size, font-weight, text-anchor, dominant-baseline) inline,
  serialize it, draw it onto a canvas at 2× device scale on the page's background colour, and
  save the canvas as PNG.
- **Form pictures** (timeline, before-after, layers, side-by-side): draw the form onto a
  canvas from its JSON with a small drawer per form, following the same reading order and
  text as the on-screen form (`viewer/pages/diagram.js:28-80`), wrapping long text, at 2×
  scale, then save as PNG. Pixel-identical styling is not required; every string shown on
  screen appears in the image.
- **HTML pictures:** download the `.html` file itself (Decision 8), with
  `content-disposition: attachment`.
- File name: the picture's title, reduced to `[A-Za-z0-9._-]`, spaces to `-`, max 80
  characters, falling back to the graph file name; extension `.png` or `.html`.
- Saving uses a blob URL on an `<a download>` element, which works in phone Safari and
  Chrome. The canvas never reads cross-origin images, so it is never tainted.
- Works for local, remote and archived threads alike, since it runs on what the page already
  rendered.

### S2. Download all documents (D2)

- New hub route `GET /wheelchair/api/threads/:id/docs.zip`, same auth as the doc route
  (`viewer/app/routes.js:572-582`). It gathers the thread's existing MAP.md, IDEA.md and
  PLAN.md through the same readers the doc route uses (local, archived or remote, per S5),
  and returns a ZIP: `content-type: application/zip`,
  `content-disposition: attachment; filename="<slug>-documents.zip"`, entries named
  `<slug>/<FILE>`.
- The ZIP writer is a new hub module (`viewer/app/zip.js`, Decision 9): stored entries
  (method 0), CRC-32, local headers, central directory, end record; no ZIP64 (inputs are at
  most 3 × 2 MiB).
- 404 when the thread has no slug or none of the three files exists.
- The sidebar's Project documents section and the phone Files panel
  (`viewer/pages/thread.js:381-465`) get a **Download all** link above the list when at least
  one of the three files exists.

### S3. Preview sent documents (D3)

- Previewable: a sent `file` card whose name ends (case-insensitive) in `.md`, `.markdown`,
  `.txt`, `.log`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, `.xml`, `.ini`, `.toml` and whose
  size is at most 2 MiB. Images keep today's behaviour.
- For those, the sent row in the sidebar/phone panel and the file chat card open a new page
  `viewer/pages/file.html` (+ `file.js`) at `?thread=<id>&file=<stored name>`. Others keep
  today's download link.
- The page fetches the existing file route (`viewer/app/routes.js:551-562`; a `fetch` reads
  the body regardless of `content-disposition`/`nosniff`, so the machine route is unchanged),
  stops with "Too big to preview" past 2 MiB, decodes as UTF-8, and shows:
  - Markdown through the shared `renderMarkdown` (`viewer/pages/markdown.js`), with a link
    resolver that allows only external `http(s)` links (no plan-file or relative links);
  - everything else as text in a `<pre>` via `textContent`, wrapping on narrow screens.
- The page shows the file name, a **Download** link (the plain file route) and a back link to
  the thread. Nothing from the file is ever inserted as HTML outside `renderMarkdown`'s
  existing escaping.
- On archived threads the preview works when the file is kept (S4).

### S4. Keep sent files after archive (D4)

- **Hub:** the archive call (`viewer/app/threads.js:217`) sends
  `{thread_id, keep: [names]}`, where `names` are the stored names (`card.file`) of the
  thread's `file` and `image` cards posted by a lead and not retracted, deduplicated. User
  attachments are never in the list.
- **Machine** `archive()` (`machine/service.js:1138-1217`): inside the existing per-thread
  lock and before removing `uploads/<thread>`, for each name matching
  `^[0-9]+-[A-Za-z0-9._-]+$` that is a regular file (lstat, not a symlink) in
  `uploads/<thread>/`, move it to `<stateDir>/kept/<thread>/<name>` (create the directory
  mode 0700; `rename`, falling back to copy-then-unlink across file systems). A name that
  does not exist is skipped. Any other failure is reported like a failed uploads removal
  (`uploads_removed: false` plus `uploads_error`), so today's retry contract
  (`viewer/app/threads.js:226-241`) applies unchanged. The response adds `kept_files: <n>`.
- `GET /v1/uploads/:threadId/:file` (`machine/service.js:1973-1981`) serves
  `uploads/<thread>/<file>` and, if absent, `kept/<thread>/<file>`, with the same name check,
  headers and symlink refusal.
- `reserveUpload` (`machine/service.js:300-315`) takes the highest `N-` prefix across both
  `uploads/<thread>/` and `kept/<thread>/`, so a restored thread never reuses a kept number.
- Kept files are never removed (Decision 7). A thread restore leaves them in `kept/`.
- **Hub record:** on a finished archive whose response has `kept_files > 0`, set
  `thread.kept_files = true`. The sidebar rows and file chat card show their links on an
  archived thread only when `thread.kept_files` is true (today they are always suppressed:
  `viewer/pages/thread.js:405-445,1139`); otherwise archived rows stay link-free as today.
  Archived image cards with kept files display their image again.

### S5. Documents and pictures of remote threads (D5, D6, D7)

**What it shows.** For a remote thread (live or archived), the sidebar and phone panel list
the plan's MAP.md, IDEA.md, PLAN.md and pictures, and they open, download and zip as for a
local thread. They show the **last committed** version on the thread's branch `wc/<id>`
(leads commit plan changes before each turn ends); a local live thread keeps reading the
working tree.

**Machine route.** New hub-authenticated `POST /v1/plan-files` with body
`{thread_id, project, default_branch, slug?, action, file?}`:

- `thread_id` must match `^[0-9a-f]{12}$`; the branch is always `wc/<thread_id>`.
- `project` must be absolute, a directory with `.git`, and exist on this machine.
- `action: "discover"`: run the `newPlanDirectories` logic on refs only — merge base of
  `wc/<id>` and `origin/<default_branch>` (falling back to `<default_branch>`), added files
  under `docs/plans` in `base..wc/<id>`, minus directories present at the base. Returns
  `{slug}` when exactly one, else `{slug: null}`.
- `action: "list"`: `slug` required and valid (`documents.validSlug` rules). Returns
  `{files: [...], graphs: [...]}`: which of the three plan files exist at `wc/<id>`, and the
  `.json`/`.html` names under `docs/plans/<slug>/graphs/` (`git ls-tree`).
- `action: "read"`: `slug` and `file` required. `file` is one of the three plan files or
  `graphs/<name>` with `<name>` matching `^[A-Za-z0-9._-]+\.(json|html)$`. Returns the blob
  via `git show wc/<id>:docs/plans/<slug>/<file>`, refused past 2 MiB (`git cat-file -s`
  first), as `{content}` (UTF-8 string).
- Errors: 400 for bad input, 404 for a missing ref or file. All git calls use `execFile`
  with argument arrays, never a shell.

**Hub reads.** A new hub module (`viewer/app/remote-plan.js`) owns remote reads through
`MachineClient.call` with a 10 s timeout:

- **Discovery and listing, never under a lock.** `discoverSlug`/`findSlug` and
  `documents.list` skip remote threads (return null / use the cache). After the chat lock is
  released (as `refreshHandoffStatus` does: `viewer/app/hub.js:267-295`), and after the
  thread-list poll finishes its per-thread section, the hub fires a background refresh for
  each remote thread whose cache is older than 30 s and has no refresh in flight. The
  refresh snapshots `machine`, `project`, `default_branch`, `slug`; calls `discover` if no
  slug, then `list`; then takes `withThread`, re-reads the thread and stores the result only
  if `machine`, `project` and `slug` (when it had one) still match. A discovered slug is
  saved to `thread.slug`; `{files, graphs}` go into an in-memory cache keyed by thread id.
  Failures keep the last good cache and are not shown as errors.
- The chat response and thread list use the cached file list for remote threads, and the
  chat response adds `remote: true` for them.
- **Document reads** (doc route, download, S2 zip) for a remote thread call `read` outside
  any lock. A machine error or timeout returns 502 with a plain message ("Couldn't reach
  <machine>"), as the file route does today.
- **Picture reads:** the existing thread-scoped routes
  `GET /wheelchair/api/threads/:id/graph?file=` and `.../diagram-html?file=`
  (`viewer/app/routes.js:563-568,584-586`) serve remote threads through `read`, live or
  archived, with the same headers as the archived path; local archived threads keep the
  local Git path. `viewer/pages/diagram.js:12-24` and `viewer/pages/picture.js:31-41` use
  these thread-scoped URLs (and `/wheelchair/?archive=<id>&file=` for the graph viewer)
  when `ctx.archived || ctx.remote`, instead of hub-local worktree paths. The graph viewer
  path for `archive=` must therefore accept remote live threads too.
- Local threads (live or archived) behave exactly as today.

### Non-goals

- Aside pictures on remote threads (Deferred D1).
- Showing uncommitted plan edits of remote threads.
- Editing, deleting or expiring kept files; recovering files deleted by earlier archives.
- Previews for other file types; zipping pictures or sent files.

### Validation

```bash
node --test viewer/test/*.test.js
bash machine/test/run.sh
npm --prefix viewer run test:browser
```

New tests, at least:

- `viewer/test/zip.test.js`: the ZIP writer's output unzips (`unzip -t` or Python
  `zipfile`) with the right names and bytes.
- Viewer route tests: `docs.zip` for a local live, local archived and remote thread (fake
  machine); 404 with no documents; remote doc/graph/html reads; 502 on machine failure;
  remote discovery stores the slug only when the snapshot still matches; no machine call
  happens while `withThread`/`withChatThread` is held (fake machine that checks a lock flag).
- Machine tests: `/v1/plan-files` discover/list/read on a temp repo, input refusals,
  2 MiB refusal; archive moves only listed names to `kept/`, serves them afterwards, still
  removes everything else; a move failure yields `uploads_removed: false`; `reserveUpload`
  numbering across `kept/`.
- Browser tests: picture page Download produces a PNG blob for a graph and a form and an
  `.html` download for an HTML picture; file preview page renders Markdown and text and shows
  "Too big to preview"; Download all link appears; archived thread with `kept_files` shows
  download links.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Aside pictures on threads running on another computer | Plan pictures work; aside pictures are drawn in side conversations and stay as today | planning | Aside pictures use a stored absolute graph path (`viewer/pages/picture.js:44-52`); route them through `/v1/plan-files` or a similar machine read |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-20

**Lanes:** intent: claude; mechanics: gpt (gpt-6.2-sol); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
