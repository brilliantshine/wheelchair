---
slug: app-diagrams-uploads
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
adopted-from: docs/proposals/app-diagrams-uploads/proposal.md
---

# More diagram forms and file uploads in app threads

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | The new forms reuse the `diagram` card (`plan`, `graph`, `title`). The graph file under `docs/plans/<plan>/graphs/` says its form: a JSON file with a `form` field (`timeline`, `before-after`, `layers`, `side-by-side`; absent means boxes and arrows), or an `.html` file for the hand-written fallback. | Keeps one card kind, and diagrams stay committed, so archived threads still show them the way graphs do today (MAP: archive route reads the branch) | defaulted |
| D2 | The thread page draws the four JSON forms itself, in the card, as plain HTML and CSS that stacks to one column at phone width. Boxes and arrows keep the existing graph-page iframe. The `.html` fallback loads in `<iframe sandbox="allow-scripts">` from a route that sends `Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:`. | D19/D29: formats are design work. Drawing them in the page avoids a second iframe per card; the CSP is what forbids network access | defaulted |
| D3 | The lead shows an image with a new `image` card (`path`, `title`). `card.js` copies the file into `~/.local/state/wheelchair/uploads/<thread-id>/` on the lead's machine and the card carries that stored name; the hub fetches it from the thread's machine when the page asks. Only the lead posts it; screenshots from other sessions reach Collin through the lead. PNG, JPEG, GIF, WebP; 25 MB. | Shown cards are lead-only (cards.md). Copying keeps the image after the agent's temp file is gone, and puts it under the same cleanup as uploads | defaulted |
| D4 | Uploads: the page sends each file raw to the hub, which streams it to the thread's machine; the machine refuses anything over 25 MB, stores it as `uploads/<thread-id>/<n>-<sanitized filename>` (a counter prefix avoids collisions) and returns the absolute path. The message the lead receives gets one line per file: `[attached: <path>]`. The page refuses a file over 25 MB before sending. | D20/D28; a counter is simpler than asking about overwrites | defaulted |
| D5 | Archive deletes `uploads/<thread-id>/` in the same machine archive call that stops sessions and removes worktrees (`machine/service.js:430-486`). | One place already owns archive cleanup (MAP) | defaulted |
| D6 | Images the lead showed are deleted with the uploads at archive; an archived thread shows "Image removed when the thread was archived" in their place. | Archived means done; diagrams, the lasting pictures, survive on the branch | user |
| D7 | Refines D1: the `diagram` card gains an optional `format` field, `json` (default) or `html`, so the page knows which file to load (`<graph>.json` or `<graph>.html`) without fetching both. | D1 left the page guessing between two files | defaulted |
| D8 | Uploads are deleted at archive only when the hub will mark the thread archived: not when the machine keeps a worktree for a rebase in progress, since the thread then stays open (`viewer/app/threads.js:161-174`). | Refines D5: a thread still open must keep its files | defaulted |
| D9 | Refines D3: the machine service, not `card.js`, copies a shown image into the uploads folder, when the card reaches `/v1/agent/cards` and before it is spooled. | The service already knows the thread and owns `<state>`; `card.js` stays a validator and poster | defaulted |
| D10 | Supersedes D7: the card's `format` is `graph` (default), `form` or `html`. Form files are read by a new route that returns them unchanged and are never registered as graphs. | Review round 1: the graph route validates and canonicalizes boxes-and-arrows only | review-round-1 |
| D11 | The machine serializes archive, uploads and image copies per thread, and refuses uploads for a thread with no lead session record. | Review round 1: a write in flight could recreate files after archive | review-round-1 |
| D12 | The hand-written HTML fallback is static: no scripts. Iframe `sandbox` with no tokens, CSP with no script source. Supersedes the proposal's `allow-scripts` (D19's sandbox wording) and D2's iframe and CSP. | Scripts can navigate their own frame, which CSP cannot stop, so "no network" would not hold | user |

## Spec

Three parts: new diagram forms, images the lead shows, and Collin's uploads. "Machine"
means the machine service (`machine/service.js`) on the machine named by `thread.machine`;
"hub" means the app server (`viewer/server.js` + `viewer/app/`). `<state>` is the
machine's state root, `~/.local/state/wheelchair` by default (`machine/service.js:24`).
`UPLOAD_LIMIT` is 25 MB = 25 × 1024 × 1024 bytes, one constant per side.

### 1. Diagram forms (D1, D2, D7)

**Card.** `diagram` keeps `plan`, `graph`, `title` and gains optional `format`: `"graph"`
(default when absent: boxes and arrows, exactly as today), `"form"` (one of the four JSON
forms) or `"html"`. Validation in `viewer/app/card.js` (`fields.diagram`) accepts only
those three values. `viewer/app/cards.js` registers the plan as today, and registers
`<graph>.json` as a graph only when the format is `graph`: the graph registry and routes
validate the boxes-and-arrows schema and drop unknown keys (`viewer/server.js:158-175`),
so a form file must never go through them.

**JSON forms** (`format: "form"`). The file `docs/plans/<plan>/graphs/<graph>.json` has a
top-level `form`, one of the four below; anything else is a drawing error (below). Every form has `explanation`
(string, required; shown above the picture, like the graph schema's field in
`protocol/graphs.md`). Strings are rendered as text, never as HTML.

| `form` | Shape | Drawn as |
|---|---|---|
| `timeline` | `events: [{when, label, detail?}]`, 1+ items, in order | A vertical line with one marker per event; `when` small above `label`, `detail` muted below |
| `before-after` | `before: {title?, items: [string]}`, `after: {title?, items: [string]}` | Two columns, headed "Before"/"After" unless `title` is given; on a narrow card, Before stacked over After with a ↓ between |
| `layers` | `layers: [{label, detail?}]`, 1+ items, top layer first | Full-width stacked bands, top first |
| `side-by-side` | `columns: [{title, items: [string]}]`, 2–4 items | Equal columns; on a narrow card, stacked in order |

- "Narrow card" means the card is under 600 px wide (a CSS container query or media query
  on the card; at phone width 390 px every form is one column).
- No form scrolls sideways: long words wrap (`overflow-wrap: anywhere`).
- Loading: live thread, new route `GET /wheelchair/diagram-form?path=<abs path>`: accepts
  only a `.json` file directly inside the `graphs/` directory of a registered plan (same
  check as the HTML route below), returns the file parsed as JSON and otherwise unchanged
  (no schema check, no canonicalization), 2 MiB cap. Archived thread,
  `GET /wheelchair/api/threads/<id>/graph?file=<graph>.json` (`viewer/app/threads.js:195-208`),
  which already returns the committed file parsed and unchanged. The existing
  `/wheelchair/graph` route is not touched.
  The page fetches once per card and caches by card id; it does not refetch on each poll.
- A file that fails to load or does not match its form's shape shows, in the card,
  "This diagram could not be drawn" and the reason, plus the existing Open full screen link
  for boxes and arrows only.
- A file that loads but has no or an unknown `form` is a drawing error.
- The four JSON forms get no "Open full screen" link (they already fit the card).

**HTML fallback** (`format: "html"`). The file is `docs/plans/<plan>/graphs/<graph>.html`,
self-contained and static: HTML, inline `<style>` and inline SVG. No scripts (D12): any
`<script>` in the file never runs.

- New hub route `GET /wheelchair/diagram-html?path=<abs path>` serves a live file and
  `GET /wheelchair/api/threads/<id>/diagram-html?file=<graph>.html` an archived one (read with
  `git show` from the branch, as `archivedGraph` does; same name pattern but `\.html$`).
  The live route accepts only a path ending in `.html` directly inside the `graphs/`
  directory of a registered plan (`registeredPlanPath`, as `doc.html` uses at
  `viewer/server.js:1907`), authenticated by the remember cookie like other pages.
- Both responses send `content-type: text/html; charset=utf-8`,
  `x-content-type-options: nosniff` and
  `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox`.
  No script source at all, and `sandbox` with no tokens also blocks scripts, forms,
  popups and automatic redirects (meta refresh), so the picture loads nothing after itself.
  The only way out is Collin tapping a link in it, which is accepted.
- The thread page embeds it as `<iframe sandbox src=...>` (empty sandbox: no scripts, no
  same origin), same 340 px height as a graph, with an "Open full screen" link to
  the same URL. `APP_PAGE_CSP`'s `frame-src 'self'` already allows it.
- If the cookie is not sent on the sandboxed frame's request in either browser the suite
  runs, the browser test fails; the fix then is a signed per-file URL, not dropping the sandbox.

**Protocol.** `protocol/app/cards.md` `diagram` section: add `format`, the four schemas
above, the HTML rules, and one line on picking: timeline for an order of events, before
and after for a change, layers for a stack, side by side for a comparison of 2–4 things,
boxes and arrows for connections, HTML only when none fits. `protocol/app/lead.md`
"Diagrams": one sentence pointing at that section.

### 2. Images the lead shows (D3, D6)

**Card.** New shown kind `image`, lead only, not pinned: `path` (absolute path to an image
file on the lead's machine, required), `title` (one line, required). Add to `shown`,
`roles` and `fields` in `viewer/app/card.js`, and document it in `cards.md`.

**Flow.**

1. `card.js image <file>` validates and posts to the machine's `/v1/agent/cards` as usual.
2. The machine, for `kind: "image"` only and before spooling: checks the file exists, is a
   regular file, at most `UPLOAD_LIMIT`, and its extension is `.png`, `.jpg`, `.jpeg`,
   `.gif` or `.webp` (case-insensitive); otherwise 422 with the reason, nothing spooled.
   It copies the file into `<state>/uploads/<thread-id>/` under the naming rule in part 3
   and replaces `path` with the stored file's absolute path.
3. The hub accepts it (role lead), and stores the card with an extra `file` field: the
   basename of `path`. The hub never reads `path` itself.
4. The page renders the title and `<img src="/wheelchair/api/threads/<id>/files/<file>" alt="<title>">`,
   `max-width: 100%`, height auto. Tapping opens the image URL in a new tab.
5. `GET /wheelchair/api/threads/<id>/files/<file>`: the hub checks `file` matches
   `^[0-9]+-[A-Za-z0-9._-]+$`, then streams `GET /v1/uploads/<thread-id>/<file>` from
   `thread.machine` with the hub secret. The machine serves the file with a content type
   from its extension (images as `image/*`; anything else `application/octet-stream` with
   `content-disposition: attachment`) and `x-content-type-options: nosniff`; 404 if absent.
6. Archived thread: the page shows "Image removed when the thread was archived" and
   fetches nothing.

`MachineClient.call` is JSON-only; add a streaming variant (`stream(machine, suffix, method,
readable?)`) that pipes a request body and returns the response stream with status and
headers.

### 3. Uploads (D4, D5, D8)

**Composer** (`viewer/pages/thread.html`, `thread.js`, `thread.css`).

- An attach button (paper-clip icon) beside Send opens a file picker (`multiple`, any type).
- Pasting into the textarea with files on the clipboard, or dropping files on the composer,
  adds them. Text pasted alone behaves as today.
- Attached files show as chips above the textarea: name and size, with a remove ×. A
  pasted image with no useful name is named `pasted-<YYYYMMDD-HHMMSS>.png` (its type's
  extension).
- A file over `UPLOAD_LIMIT` is never added: the chip area shows "<name> is over 25 MB"
  for that file.
- Send is allowed with text, files or both. On send: upload each file in order; if any
  upload fails, show "Upload failed: <reason>", keep the chips and the text, and post no
  message. When all succeed, post the message with text
  `<typed text>\n\n[attached: <path>]` (one line per file; no leading blank lines when the
  typed text is empty), then clear chips and textarea.

**Hub route** `POST /wheelchair/api/threads/<id>/uploads?name=<filename>`, raw body (the
file bytes), `content-type` the file's type.

- `routes.js` `handle()` currently JSON-parses every POST body (`viewer/app/routes.js:37`);
  this route must be matched before that and read the body as a stream.
- Refuse 409 if the thread is archived or has no live lead (same check as `messages`,
  `routes.js:343-350`), 413 if `content-length` is missing or over `UPLOAD_LIMIT`.
- Stream the body to `POST /v1/uploads?thread_id=<id>&name=<filename>` on `thread.machine`;
  return the machine's `{path}` as `201`.

**Machine route** `POST /v1/uploads` (hub secret).

- Sanitize `name`: keep `[A-Za-z0-9._-]`, replace every other character with `-`, strip
  leading dots. Split off the extension (the last `.` followed by 1–10 characters) and cut
  the stem so stem plus extension is at most 100 characters; the extension is never cut.
  An empty stem becomes `file`.
- Create `<state>/uploads/<thread-id>/` (mode 0700). Stored name is `<n>-<sanitized>`, `n`
  one more than the highest existing prefix (1 when empty); create with the `wx` flag and
  retry with the next `n` on `EEXIST`.
- Stream to disk counting bytes; past `UPLOAD_LIMIT`, stop, delete the partial file and
  answer 413. Refuse 409 unless the thread has a writable lead (defined below). Return `201 {path: <absolute stored path>}`.
- Same naming and directory are used for image cards (part 2).

**Archive and in-flight writes.** The machine holds one promise-chain lock per thread id
(`withThreadLock(threadId, fn)`). `archive`, the `/v1/uploads` handler (from the name
check through the final rename or delete) and the image-card copy in `/v1/agent/cards`
(from the file checks through the rewrite of `path`) each run inside it. Uploads stream to
`<n>-<name>.part` and are renamed on success, so a crash leaves only `.part` files, which
archive removes with the folder.

**Archive never waits behind an upload.** The hub's machine call times out after 5 s
(`viewer/app/machine-client.js:42,64`) and a 25 MB upload from a phone can take longer, so
archive must not queue behind one. The machine keeps, per thread, a `closing` flag and the
set of in-flight upload requests. `archive` sets `closing` and destroys every in-flight
upload for the thread **before** taking the lock; each destroyed upload deletes its
`.part` file, releases the lock and answers 409 (if its connection still exists). An
upload checks `closing` on admission and on every chunk. Image copies are local and short,
so archive waits for those. `archive` clears `closing` when it returns; a late request is
then refused by the admission check below. Test through the hub (real `archive` route,
default timeout): start an upload paused for more than 5 s, request archive: archive
answers within the timeout, the thread is archived, the upload ends with 409 or a
dropped connection, and the uploads folder does not exist.

The admission check runs **inside the lock**, first thing, not only at authorization
(which happens before the lock, `machine/service.js:838`). Archive does not always delete
session records: a retained worktree keeps its records with `archived_pending: true` and
`status: 'stopped'` (`machine/service.js:472-482`). So the check is on record state:

- **Writable lead:** a record in `this.sessions` with that `thread_id`, `role: 'lead'`, no
  `archived_pending`, and `status` not `'stopped'`. An upload without one answers 409.
- **Image card:** re-read the posting session's record by name inside the lock; if it is
  gone, `archived_pending`, or `status: 'stopped'`, answer 409 and spool nothing.

Tests: (1) start an upload that pauses mid-stream, call archive, resume: the upload answers
409 or finished before archive ran, and afterwards the folder does not exist. (2) Post an
image card whose copy is held until archive has run (a test hook that delays entry to the
lock): it answers 409 and the folder does not exist. (3) Archive with a non-rebase retained
worktree, then post an image card with that session's still-valid token: 409.

**Archive** (`machine/service.js` `archive`). After worktrees are handled and before
returning: if no entry in `kept` has reason `rebase in progress`, remove
`<state>/uploads/<thread-id>/` recursively (`fs.rm`, `force: true`); report it in the
result as `uploads_removed: true|false` (true also when the folder never existed). In
`viewer/app/threads.js` `archive`, `uploads_removed === false` is handled like a kept
rebase: the thread stays unarchived and gets a system `needs` card "Uploads could not be
removed" with the folder path and the error, so archiving again retries. Sessions are
already stopped either way.

### Not in this plan

Previews or downloads of Collin's own uploads in the thread (his bubble shows the
`[attached: ...]` lines as text); uploads to sessions other than the lead; changes to boxes
and arrows; deleting threads; worker machines (slice 2).

### Validation

```bash
node --test viewer/test/*.test.js
bash machine/test/run.sh
npm --prefix viewer run test:browser
```

New tests, at least:

- `card.js`: `diagram` accepts no `format` (meaning `graph`) or `format` `graph`/`form`/`html`,
  and refuses any other value; `image` requires
  `path` and `title` and is lead-only.
- Machine: upload stores `1-name`, then `2-name`; a 25 MB + 1 byte body answers 413 and
  leaves no file; an image card with a `.txt` path is refused 422; a valid one is copied
  and its `path` rewritten; archive removes the uploads folder, and keeps it when a rebase
  is in progress.
- Hub: uploads route refuses an archived thread (409) and oversize `content-length` (413);
  the files route refuses a name outside the pattern; the HTML route refuses a path outside
  a registered plan's `graphs/` and sends the CSP above.
- Browser (Chromium and Firefox), at a 390 × 844 viewport: one thread with a card of each
  of the four JSON forms and one HTML card; each is visible and
  `document.documentElement.scrollWidth <= innerWidth`. The HTML card's fixture holds a
  `<script>` that fetches a test-only URL, an `<img>` and a `<link rel=stylesheet>` pointing
  at test-only URLs, and a `<meta http-equiv=refresh>` to one; the test server records no
  request to any of them, the fixture's text is visible inside the frame (Playwright
  `frameLocator`, which works on a sandboxed frame) and an element styled by the fixture's
  inline `<style>` has that computed style (for example, its `color`); the response carried
  the CSP above. Pasting an image file into the composer shows a chip; sending posts a message
  whose text ends with `[attached: <path>]`, and the file exists at that path with the
  same bytes. An `image` card shows an `<img>` that loads (`naturalWidth > 0`).

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-15

**Lanes:** intent lens; mechanics lens; cross-family: no (both GPT; the hub could not place Claude).

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics (gpt) | blocking | `/wheelchair/graph` validates schema 1 and drops `form`, so it cannot load the new forms | upheld (`viewer/server.js:158-175,1649`) | D10: card `format` graph/form/html; new `/wheelchair/diagram-form` route returns the file unchanged; forms never registered as graphs |
| mechanics (gpt) | blocking | A sandboxed script can still navigate its own frame to any URL; CSP does not stop navigation, so "no network" is not guaranteed | user-decision | Collin picked static only (D12) |
| mechanics (gpt) | major | Uploads or image copies in flight can recreate files after archive removed the folder | upheld (archive and the cards handler share no lock, `machine/service.js:430,837`) | Spec part 3: per-thread lock on the machine, `.part` files, late requests refused |
| intent (gpt) | blocking | Archive could succeed while uploads stay on disk, against IDEA's "gone after archive" | upheld (major: contradicts IDEA.md:35 as written) | Spec part 3, Archive: a failed removal keeps the thread unarchived with a needs card, like a kept rebase |

### Round 2 — 2026-11-15

**Lanes:** intent (gpt); mechanics (gpt); cross-family: no (the hub could not place Claude).

**Changed since Round 1:**
- D10: `diagram` card `format` (`graph`/`form`/`html`); new `/wheelchair/diagram-form` route; forms never registered as graphs.
- D11: per-thread lock on the machine for archive, uploads and image copies; `.part` files; late uploads refused 409.
- D12: HTML fallback is static only (empty sandbox, no script source in CSP).
- Archive: a failed uploads removal keeps the thread unarchived with a needs card.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (gpt) | — | No findings | — | — |
| mechanics (gpt) | major | Image copy authorizes before the lock, so it can recreate the folder after archive | upheld (`machine/service.js:838` authorizes before the body is read) | Admission check moved inside the lock; test (2) |
| mechanics (gpt) | major | Retained sessions keep valid tokens after a successful archive | upheld (`machine/service.js:472-482`) | Check record state (`archived_pending`, `stopped`) inside the lock; test (3) |
| mechanics (gpt) | minor | Validator test still says `json`/`html` | upheld | Test bullet updated to `graph`/`form`/`html` |
| mechanics (gpt) | minor | HTML visibility check passes on an empty frame | upheld | Assert fixture text and a computed style via `frameLocator` |

### Round 3 — 2026-11-15

**Lanes:** intent (gpt); mechanics (gpt); cross-family: no.

**Changed since Round 2:**
- Admission check for uploads and image copies now runs inside the per-thread lock and checks record state (`archived_pending`, `stopped`), with three ordering tests.
- Validator test bullet uses `graph`/`form`/`html`.
- HTML browser test asserts fixture text and a computed style inside the frame.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (gpt) | — | No findings | — | — |
| mechanics (gpt) | major | Archive can queue behind a slow upload past the hub's 5 s timeout | upheld (`viewer/app/machine-client.js:64`; lock held while streaming) | Archive cancels in-flight uploads before taking the lock; hub-level test |
| mechanics (gpt) | minor | Truncating a long name can cut an image's extension | upheld | Sanitizer keeps the extension and cuts the stem |

### Round 4 — 2026-11-15

**Lanes:** intent; mechanics.

**Changed since Round 3:**
- Archive sets a per-thread `closing` flag and cancels in-flight uploads before taking the lock; uploads check it per chunk; hub-level test.
- Filename sanitizer keeps the extension when cutting to 100 characters.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
