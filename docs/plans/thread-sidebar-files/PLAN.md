---
slug: thread-sidebar-files
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Thread sidebar: project documents and files from agents

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

_None._

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | User's pick | user |
| 2 | Only the lead sends documents to the user, through a new lead-only card kind; sub-leads and workers ask the lead with a `message` | Same rule as the `image` card; keeps one voice to the user | defaulted |
| 3 | A sent document is a copy taken at send time into the thread's uploads on its machine, like `image` | Reuses the existing copy, stream and safety path; later edits to the source do not change what the user got | defaulted |
| 4 | A sent document also shows as a small card in the chat, besides the sidebar listing | The user notices it arrived without watching the sidebar | defaulted |
| 5 | Plan documents are read through the thread's machine, so remote threads work | IDEA constraint; uploads already stream through the machine (`viewer/app/routes.js:104-117,501-510`) | defaulted |
| 6 | Each document gets its own open and download control; no "download all" | Simplest form of "easily downloadable" | defaulted |
| 7 | On a phone, both sections live where the plan links sit today, under the thread header | No right column on phones (`viewer/pages/thread.js:260`) | defaulted |
| 8 | Project documents are MAP.md, IDEA.md, PLAN.md and the thread's pictures (diagram cards and aside graphs); COMPLETION, REMEDIATION and reports/ are not listed | User's pick | user |
| 9 | Files agents sent are removed when the thread is archived, like attachments; their names stay listed, marked removed | User's pick | user |
| 10 | Images sent with the `image` card are listed in the sent-files section too | Both are things an agent handed the user | defaulted |
| 11 | Plan documents download as `<slug>-<FILE>.md` | Downloads from several threads don't overwrite each other | defaulted |
| 12 | On a phone, the header shows one Files button that opens a panel with both sections | A chip per file gets long once agents send files | defaulted |

## Spec

Line numbers are from commit `a5f9d5f6`; see `MAP.md` and `docs/maps/thread-sidebar-files.md`.

### S1. The right column has two sections

`renderFiles` (`viewer/pages/thread.js:235-275`) is rewritten. The right column
(`#files`, `viewer/pages/thread.html:58-60`) shows, in order:

1. **Project documents** (heading text exactly `Project documents`):
   - One row per plan document among `MAP.md`, `IDEA.md`, `PLAN.md` that exists (S3's
     list), in that order. Each row: the file name as a link to the existing document page
     (`/wheelchair/app/doc?thread=<id>&file=<FILE>`), and a **Download** link (S4).
   - Then the pictures exactly as `pictureList()` builds them today (diagram cards
     deduplicated by file, then aside graphs), each a link to its picture page. No download
     for pictures (Deferred D1).
   - Nothing else from the plan folder (COMPLETION.md, REMEDIATION-*.md, reports/, other
     graphs) is listed.
2. **Sent to you** (heading text exactly `Sent to you`): one row per `file` card (S5) and
   per `image` card in the thread, newest first. Each row: the card's `title`, below it the
   file name (S5's `name`, or for an image the stored `file` with its leading `<digits>-`
   removed) and, for `file` cards, a human size (`12 KB`, `3.4 MB`), and a **Download**
   link to `/wheelchair/api/threads/<id>/files/<stored file>` with the HTML `download`
   attribute set to the shown name. An image row also links its title to the image (opens
   in a new tab, as the chat card does). On an archived thread, rows stay with name and
   title but the links are replaced by the dim text `Removed when the thread was archived`.

A section with nothing in it is not shown. When both are empty the column shows nothing,
as today. The old heading "This thread's files" is gone.

Sent to you skips cards with `retracted_at` and cards the chat hides as before an import
(the same `sinceImport` test, `viewer/pages/thread.js:344,382`), so cards replaced by an
import are not listed.

The render signature (`viewer/pages/thread.js:1115`) also covers the import time and the `file` and `image`
cards (id, title, file, name, size) and S3's document list, so new items appear on the next
poll without reload.

### S2. Phone layout

Below 900px wide there is no right column. The header's `#head-files` strip
(`viewer/pages/thread.html:26`) is replaced by one button labelled `Files (<N>)`, N being the
total rows across both sections, hidden when N is 0. Pressing it opens a panel directly
under the header with the same two sections and the same rows and links as S1 (one shared
render function fills both places); pressing it again or following a link closes it. Every
link and button in it is at least 44px tall.

### S3. Which plan documents exist, read through the thread's machine

New hub route `GET /wheelchair/api/threads/<id>/documents` (in `viewer/app/routes.js`,
same auth as the other thread GETs) returns `{ "documents": [ "MAP.md", ... ] }`: only the names that exist, in MAP, IDEA,
PLAN order. No sizes.

- **Live thread** (not archived): the hub asks the thread's machine,
  `GET /v1/threads/<thread id>/documents?slug=<slug>` (hub-authenticated with the machine
  secret, like `/v1/uploads`); it answers `{ "slug": <slug>, "documents": [...] }`. With no
  `slug` parameter it discovers one (see "Slug for a thread on another machine" below). The machine finds the worktree from its own record of the
  thread's lead session (`this.sessions` entry with that `thread_id` and role `lead`; the
  newest if several, live or not). The hub never sends a path. `slug` must match
  `^[a-z0-9][a-z0-9-]{0,79}$`, else 400. For each of the three names it includes it only if it passes
  the same eligibility check S4 uses to serve it (one shared function on the machine), so
  every listed document can be opened and downloaded. No lead record → `{ "documents": [] }`.
- **Archived thread:** the hub runs `git -C <project> cat-file -e <branch>:docs/plans/<slug>/<FILE>`
  for each name (as `archivedDocument` reads them, `viewer/app/threads.js:251-265`) and lists
  those that succeed.
- No slug → `{ "documents": [] }`.

**Slug for a thread on another machine.** Today the hub finds a thread's slug by running Git
on its own filesystem against `thread.worktree` (`viewer/app/views.js:71-105`, called from
`viewer/app/chat.js:338`), which fails when the worktree is on another machine. Change
`discoverSlug`: when the thread is not archived, has no slug, and `thread.worktree` does not
exist on the hub's filesystem, ask the thread's machine's `/documents` route (below) without a `slug`. The machine runs the same
`newPlanDirectories` logic (move that function to a module both `viewer/app/views.js` and
`machine/service.js` can require, or copy it with a comment naming the other) against the
lead worktree from its record (as above) and returns `{ "slug": <name or null>,
"documents": [...] }`: slug null unless exactly one name, documents listed for that slug
(empty when null). The hub saves it as `findSlug` does today. A machine that cannot
be reached leaves the slug unset; the next poll tries again. Test with a fake machine and a
worktree path that does not exist on the hub.

The page fetches this list when the thread loads and again whenever the render signature's
card part changes (a new card arrived) and at most once every 30 seconds otherwise while
the page is visible. A failed fetch keeps the last list.

### S4. Reading and downloading a plan document

The hub route `GET /wheelchair/api/threads/<id>/doc?file=<FILE>` (`viewer/app/routes.js:522-524`)
now serves live threads too:

- `FILE` must be one of `MAP.md`, `IDEA.md`, `PLAN.md`, else 404.
- Live: the hub streams from the machine's new `GET /v1/threads/<thread id>/document?slug=<slug>&file=<FILE>`,
  which resolves the worktree as in S3 and applies the eligibility check: the final
  component is not a symlink and is a regular file, its real path is inside the real path of
  `<worktree>/docs/plans/<slug>/`, and it is at most 2 MiB. Anything failing it is 404, and returns the bytes with `content-type: text/markdown; charset=utf-8` and
  `x-content-type-options: nosniff`.
- Archived: as today (`git show`).
- Without `download`: response stays `{ "content": "<text>" }` (JSON), as today.
- With `download=1`: the raw bytes, `content-type: text/markdown; charset=utf-8`,
  `x-content-type-options: nosniff`, `content-disposition: attachment; filename="<slug>-<FILE>"`.

The document page (`viewer/pages/doc.js:53-67`) reads live documents through this route
instead of `/wheelchair/doc?plan=...`, so a thread on another machine shows its documents.
It gains a **Download** link (to `...doc?file=<FILE>&download=1`) next to its title. The
older plan viewer's `/wheelchair/doc` route is left as it is.

The sidebar's **Download** link for a plan document is that same `download=1` URL.

### S5. The `file` card: an agent sends the user a document

New lead-only card kind `file`, shown to the user, not pinned.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `path` | string | yes | Absolute path to a regular file on the lead's machine, at most 25 MB |
| `title` | string | yes | One line: what the document is |

- `viewer/app/card.js`: add `file` to the kinds, `roles.file = ['lead']`, fields `path`
  (absolute) and `title` (text). Any other field is refused, as for every kind.
- `machine/service.js`, in the `/v1/agent/cards` handler beside `copyImage`: before
  reserving or copying anything it refuses a non-lead session (403, `only a lead may post a
  file card`) and a card with fields other than `kind`, `path`, `title` (422). Then `copyFile`
  takes the same steps as `copyImage` (`machine/service.js:351-368`) without the extension
  check: absolute path, exists, regular file (following no symlink at the final component:
  `lstat` must say regular file), at most 25 MB (`UPLOAD_LIMIT`), real path not inside the machine's real `stateDir`
  (`machine/service.js:224`; that is where its secret, session records and uploads live;
  422 `file is inside the wheelchair state folder`) unless it is inside
  `<stateDir>/worktrees/` (`machine/service.js:584-585`), where every agent's checkout lives, copied into the thread's
  uploads with `reserveUpload`. Errors are 422 with plain sentences: `file path must be
  absolute`, `file does not exist`, `file is not a regular file`, `file exceeds 25 MB`. It
  passes on `{ path: <stored path>, title, name: <sanitized original basename>, size:
  <bytes> }`.
- `viewer/app/cards.js` (`:133`): a `file` card is stored with `file: path.basename(path)`
  as for `image`, plus `name` and `size` from the machine. The hub accepts `name` and
  `size` on a `file` card only from the machine relay.
- **Chat card:** title as heading, then `<name> · <size>` and a **Download** button (same
  link as S1). On an archived thread: `Removed when the thread was archived`, no button.
- **Serving:** unchanged route (`viewer/app/routes.js:501-510`). The machine's upload GET
  (`machine/service.js:1945-1953`) changes its non-image header to
  `content-disposition: attachment; filename="<stored name without its leading digits and dash>"`.
  The stored name is already limited to `[A-Za-z0-9._-]`, so it is header-safe. Images stay
  inline. Non-image files are never served inline and always with `nosniff`, so nothing
  sent can run in the browser.
- Archive removes them with the rest of the uploads folder, as today
  (`machine/service.js:1181-1189`).

### S6. Protocol

- `protocol/app/cards.md`: add `file` to the kinds table (shown, lead, not pinned).
- `protocol/app/cards-lead.md`: add a `### file` section with the fields, the 25 MB limit,
  that it is copied at send time (later edits to the source do not reach the user), that
  it shows in the chat and in the sidebar's Sent to you section, and that archiving the
  thread deletes it.
- `protocol/app/lead.md`, Diagrams section's last paragraph area: one sentence: to hand the
  user a document (a report, a spreadsheet, a PDF), post a `file` card; a sub-lead or
  worker that made one asks the lead with a `message` naming its path.
- `protocol/app/sub-lead.md` and `protocol/app/worker.md`: one sentence each that a document
  meant for the user goes to the lead with a `message` naming its path.

### Non-goals

Editing documents in the app; changing composer attachments; sharing files across threads;
carrying sent files through a handoff export or import; downloading pictures; download all;
in-app previews of sent non-image files; keeping sent files after archive; making the
archived-document read work for projects that exist only on another machine (Deferred D5).

### Validation

New or changed tests:

- `machine/test/`: `copyFile` accepts a text and a PDF file, refuses a relative path, a
  missing file, a directory, a symlink, a file over 25 MB, a file inside the state folder (but
  accepting one inside a worktree under `<stateDir>/worktrees/`),
  a non-lead session and an extra field, leaving no upload behind for any refusal; the
  documents route without a slug returns the one new plan directory as `slug` and null
  otherwise; a document over
  2 MiB is neither listed nor served; the document list and
  document routes return existing names only, refuse a bad slug, a symlinked document and a
  path escaping the plan folder, and return `[]` with no lead record; the upload GET sends
  `content-disposition: attachment; filename="report.pdf"` for `3-report.pdf`.
- `viewer/test/` unit: `card.js` accepts a valid `file` card and refuses it from non-leads
  and with extra fields; the hub stores `file`, `name`, `size`; `/documents` and `/doc` for
  live (through a fake machine) and archived threads; `download=1` headers.
- `viewer/test/` browser spec: the sidebar shows `Project documents` with only the existing
  plan files and a Download link carrying `download=1`, then pictures; `Sent to you` lists a
  `file` card and an `image` card newest first with Download links; archived thread shows
  `Removed when the thread was archived`; a retracted or pre-import `file` card is not listed; at 390px wide the `Files (N)` button opens the
  panel with both sections; the doc page has a Download link and loads a live document
  through the hub route.

Commands (all must pass):

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Download pictures (diagrams) as image files | Pictures still open full size; the map, idea and plan downloads carry the content | planning | Graphs are JSON/HTML rendered client-side; needs a render-to-PNG or SVG export |
| D2 | Download all documents at once (zip) | Per-file download works | planning | |
| D3 | In-app preview for sent documents other than images | Download opens them with the phone's own viewer | planning | Markdown could reuse the doc page renderer |
| D4 | Keep sent files after the thread is archived | User chose removal for now | planning | Needs a store outside the uploads folder and a cleanup rule |
| D5 | Project documents of an archived thread whose project exists only on another machine | Live remote threads work; archived reads stay as today | review-round-1 | Archived reads run `git -C <project>` on the hub (`viewer/app/threads.js:251-265`); route them through the thread's machine like S3/S4 live reads |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-19

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since the last round:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Archived remote threads lose project documents; hidden in Non-goals | upheld | Moved to Deferred D5 with notes |
| intent | minor | Widen `image` to any file instead of a new `file` kind | declined | `image` has a fixed contract (inline display, image extensions) used by existing leads and the chat card; a separate kind keeps both simple and is what the reviewer calls defensible |
| intent | minor | `/documents` returns sizes nobody shows | upheld | S3 returns names only; archived check uses `cat-file -e` |
| intent | minor | S5 filename header also changes user attachments; say so | upheld | S5 Serving says it is intended |
| mechanics | blocking | Remote thread never gets a slug: discovery runs Git on the hub | upheld | S3 adds machine-side slug discovery (round 2: folded into the machine's `/documents` route) |
| mechanics | blocking | Machine copies before the hub checks role and fields; refused cards leave uploads | downgraded → minor | The orphan copy is never listed and needs a session bypassing `card.js`'s own role check; cheap to close: S5 checks role and fields on the machine before copying |
| mechanics | blocking | Lead could send the machine secret or session records | downgraded → minor | The lead already runs as the same user and can print any of these files into its reply, and the receiver is the owner; still cheap to refuse: S5 refuses sources inside the machine's state folder |
| mechanics | blocking | Listing and serving disagree (big files, symlinked parents) | downgraded → minor | Would show a dead link, not build the wrong thing; S3/S4 share one eligibility check |
| mechanics | blocking | Import-retracted file/image cards would still be listed | downgraded → minor | Edge of handoff import, a worker builds the rest correctly; S1 skips retracted and pre-import cards |

### Round 2 — 2026-11-19

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt; cross-family: yes.

**Changed since the last round:**
- S3: `/documents` returns names only; archived existence check is `cat-file -e`.
- S3: new machine-side slug discovery for threads whose worktree is not on the hub.
- S3/S4: listing and serving share one eligibility check (no final symlink, regular file, real path inside the plan folder, at most 2 MiB).
- S5: machine checks lead role and allowed fields before copying; refuses sources inside the machine's state folder.
- S5: states that the filename header also applies to the user's own attachments, on purpose.
- S1: Sent to you skips retracted and pre-import cards; signature covers the import time.
- Deferred D5 added (archived threads from another machine); Non-goals points to it.
- Validation list extended for the above.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | State-folder refusal blocks files in agents' own worktrees | upheld | S5 exempts `<stateDir>/worktrees/`; test added |
| intent | minor | Decide "remote" from `thread.machine`, not a missing path | declined | `discoverSlug` runs on every thread-list poll; the local path check keeps local threads on the existing Git path with no machine round trip, and a missing worktree on an unarchived thread is exactly the remote case |
| intent | minor | `/plan-slug` duplicates `/documents`' worktree lookup | upheld | Machine `/documents` returns `{slug, documents}` and discovers the slug when none is given; `/plan-slug` removed |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
