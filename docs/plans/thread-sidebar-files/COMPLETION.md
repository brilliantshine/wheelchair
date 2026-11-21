---
slug: thread-sidebar-files
date: 2026-11-19
implemented-by: "T1 standard gpt-6.1-terra; T2 standard gpt-6.1-terra; T3 standard claude-sonnet-5-5 (sub-lead: claude-opus-5-5)"
verified-by: []
---

# Completion Report — Thread sidebar: project documents and files from agents

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line numbers
are on the feature branch `wc/620b2787c998` after the T3 merge.

## Spec coverage

No Prior Work section in the plan; every item was built in this run.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 Project documents section (only `data.documents`, doc link + `download=1` link, then pictures) | this run | `viewer/pages/thread.js:273` (section), `:304` (`renderFiles`) | `viewer/test/app-files.spec.js:43`; updated `app-threads.spec.js`, `app-pictures.spec.js` |
| S1 Sent to you (file + image cards, newest first, skips retracted and pre-import, name, size, Download with `download` attr, image title new tab) | this run | `viewer/pages/thread.js:258-264` (list, name), `:289-296` (rows), `:252` (`humanSize`) | `app-files.spec.js:43`, `:81` |
| S1 Archived: links replaced by `Removed when the thread was archived` | this run | `viewer/pages/thread.js:251` (`REMOVED`), rows at `:289-300` | `app-files.spec.js:67` |
| S1 Empty sections hidden; old heading gone | this run | `viewer/pages/thread.js:304` | `app-files.spec.js:43` (no "This thread's files"), `:124` |
| S1 Render signature covers import time, file/image cards, documents | this run | `viewer/pages/thread.js:1164` | `app-files.spec.js` (cards and documents appear via poll) |
| S2 Phone `Files (N)` button, panel filled by same render function, toggles, ≥44px | this run | `viewer/pages/thread.html:23-27`, `viewer/pages/thread.js:18` (`files-toggle`, `files-panel`), `viewer/pages/thread.css` (media rules) | `app-files.spec.js:101`, `:124` |
| S3 `documents` in chat response | this run | `viewer/app/chat.js:371` | `viewer/test/app-documents.test.js:38`, `:65` |
| S3 Live: hub filesystem check with shared eligibility; worktree not on hub → `[]` | this run | `viewer/app/documents.js:13` (`eligible`), `:34` (`list`) | `app-documents.test.js:38` |
| S3 Archived: `cat-file -e` per name, no worktree needed, cached per id + branch | this run | `viewer/app/documents.js:34-46` | `app-documents.test.js:65` |
| S3 Slug check | this run | `viewer/app/documents.js:11` (`validSlug`); used at `viewer/app/routes.js:526`, `viewer/app/threads.js:253` | `app-documents.test.js:38` |
| S4 `/doc` live + archived, allowlist, eligibility, JSON without `download` | this run | `viewer/app/routes.js:522-533`, `viewer/app/documents.js:26` (`readLive`) | `app-documents.test.js:38`, `:65` |
| S4 `download=1` headers (`text/markdown; charset=utf-8`, nosniff, `attachment; filename="<slug>-<FILE>"`) | this run | `viewer/app/routes.js:528-530` | `app-documents.test.js:38` |
| S4 Doc page reads through the hub route and has Download | this run | `viewer/pages/doc.js:15-16`, `:57-58`; `viewer/pages/doc.html` | `viewer/test/app-doc.spec.js:127` |
| S5 `card.js`: `file` kind, lead-only, `path` + `title` | this run | `viewer/app/card.js:22`, `:39`, `:151` | `app-documents.test.js:22`; `protocol-rules.test.js` |
| S5 Machine checks before copy (role 403, extra fields 422, blank title 422) | this run | `machine/service.js:2025-2029` | `machine/test/service.test.js:1250` |
| S5 `copyFile` (absolute, exists, lstat regular file, 25 MB, state folder refused except `worktrees/`, `reserveUpload`, forwards name + size) | this run | `machine/service.js:371-394` | `machine/test/service.test.js:1250-1287` |
| S5 Hub stores `file`, `name`, `size`; `name`/`size` only on machine relay | this run | `viewer/app/cards.js:133`, `viewer/app/card.js:172`, `:186` | `app-documents.test.js:22` |
| S5 Chat card (title, `name · size`, Download; archived text) | this run | `viewer/pages/thread.js:966` (card body) | `app-files.spec.js:88`, `:67` |
| S5 Upload GET: non-image `attachment; filename="<name without digits->"`, images inline, nosniff | this run | `machine/service.js:1978` | `machine/test/service.test.js:1219-1220` |
| S5 Archive removes sent files | pre-existing | `machine/service.js` archive removes the uploads folder (unchanged) | existing machine archive tests |
| S6 `cards.md` kinds row | this run | `protocol/app/cards.md:49` | `viewer/test/protocol-rules.test.js` |
| S6 `cards-lead.md` `### file` section | this run | `protocol/app/cards-lead.md:222` | `protocol-rules.test.js` (one section per kind) |
| S6 `lead.md` sentence | this run | `protocol/app/lead.md:838` | read |
| S6 `sub-lead.md`, `worker.md` sentence | this run | `protocol/app/sub-lead.md:297`, `protocol/app/worker.md:79` | read |

## Deviations from plan

- The forwarded `name` of a sent file is the sanitized original basename and keeps any leading
  `<digits>-` it already had (Spec says "sanitized original basename", which this matches; the
  T1 brief had said to strip the digits).
- The phone panel sits below the `#head-files` button strip, after `#export-reason`, rather
  than literally the first element under the header.
- Everything else matches the Spec. Choices that the Spec left open are in PLAN.md's Log.

## Routers

`viewer/AGENTS.md`: added a row for the new `viewer/app/documents.js` (plan document listing,
eligibility and slug check). No other router changed; no ownership moved.

## Validation evidence

Run by the sub-lead on the merged feature branch.

`bash machine/test/run.sh`

```text
# tests 375
# suites 0
# pass 375
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 45088.824373
machine exit 0
```

`node --test viewer/test/*.test.js`

```text
# tests 704
# suites 0
# pass 704
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 61828.70975
unit exit 0
```

`npm --prefix viewer run test:browser`

```text
  34 skipped
  1060 passed (11.5m)
browser exit 0
```

Screenshots from T3's run: `docs/plans/thread-sidebar-files/reports/T3-sidebar.png`,
`docs/plans/thread-sidebar-files/reports/T3-phone-panel.png`.

## Known gaps / residual risks

- Archived document list cache also keeps a failed lookup's `[]` until the hub restarts
  (`viewer/app/documents.js:40-46`); needs a transient Git failure on the first poll.
- `copyFile` does not call the `beforeImageLock` archive hook `copyImage` uses, so an
  archive racing a file copy is not cancelled the way an image copy is.
- `readLive` reads the checked path, not its resolved real path; a symlink swapped in between
  the check and the read would be followed (needs tampering).
- No timeout on the archived `git cat-file` calls (same as the existing `archivedDocument`).
- The stored card keeps the machine-side upload `path`, which reaches the browser in the chat
  response, as image cards already do.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
