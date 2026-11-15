---
slug: app-paper-cuts
date: 2026-11-14
implemented-by: "sonnet (T1, T3, T4), terra gpt-5.6-terra (T2); sub-lead: opus"
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty.
---

# Completion Report — The app's screen paper cuts

Written for a hostile reviewer: every claim checkable, no claim without evidence.
Built on branch `wc/1f02c3554935` from `7246e90`; the four worker branches were merged
(`wc-1f02c3554935-w1` … `-w4`), and their reports are in `docs/plans/app-paper-cuts/reports/T1.md` … `T4.md`.
Every spec item below is `this run`: Prior Work was empty.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 first-message title (first line, collapsed, ≤60 at a word boundary + `…`; none when empty) | this run | `viewer/app/threads.js:50-53`; cut helper `viewer/app/card.js:43-48` | `viewer/test/app-hub.test.js` "derives an opening title and lets only the lead rename it with title cards"; `viewer/test/app-threads.spec.js:421` |
| S1 `title` card (lead only, never shown, not stored, ≤80, renames) | this run | `viewer/app/card.js:31` (roles), `card.js` `fields.title`; `viewer/app/cards.js:66-70` | same hub test (sets, renames, absent from `cards`, a sub-lead's refused 422) |
| S1 protocol | this run | `protocol/app/cards.md:46` (kinds table), `:205` (`### title`); `protocol/app/lead.md:87-90`; `viewer/app/API.md` (`POST /threads` row, accepted cards paragraph) | read |
| S2 `question.doc` validation | this run | `viewer/app/card.js:66` | `app-hub.test.js` "validates the optional question document name" |
| S2 "Open <doc>" link, slug in chat signature | this run | `viewer/pages/thread.js:404-408`, `:592` | `app-threads.spec.js:435`, `:447` |
| S2 protocol | this run | `protocol/app/cards.md:96`, `:100`; `protocol/app/lead.md:135-137` | read |
| S3 in-app document page | this run | `viewer/server.js:1830` (`'doc'` in `APP_PAGES`); `viewer/pages/doc.html`, `viewer/pages/doc.js` (link rule `:26-41`, live/archived loading `:43-72`), `viewer/pages/doc.css` | `viewer/test/app-pages.test.js` "the document page is served behind the remember cookie…"; `viewer/test/app-doc.spec.js:52`, `:64`, `:78`, `:94`, `:111` |
| S3 shared renderer with link resolver | this run | `viewer/pages/markdown.js:314` (`renderMarkdown`), `:341`; `viewer/doc.js:130` (old page keeps its resolver); `viewer/doc.html` loads markdown.js first | `viewer/test/markdown.test.js`; the existing `viewer/test/render.spec.js` document-page specs (pass) |
| S3 thread page links; `#docview`/`showArchivedDoc` removed | this run | `viewer/pages/thread.js:147-153`; removed from `thread.js`, `thread.html`, `thread.css` | `app-threads.spec.js:410`, `:527`; `app-doc.spec.js:111` |
| S4 press stores `answered_action`/`answered_value` | this run | `viewer/app/threads.js:228-232` | `app-hub.test.js` "records a press and lets a lead resolve an open question only in its thread" |
| S4 lead resolve reaches questions; dismiss stays needs-only | this run | `viewer/app/card.js:143-152`; `viewer/app/cards.js:59`; dismiss unchanged call `viewer/app/threads.js` `dismiss` | same hub test (resolve ok, `resolved_note`; already-answered, other thread, system card refused; dismiss of a question 422); "a resolve is refused for a system card, another kind…" |
| S4 "You picked …", picked marker, "Answered in chat" | this run | `viewer/pages/thread.js:9-12` (offer value→label map), `:325-331`, `:333-347`, `:410-416` | `app-threads.spec.js:458`, `:473`, `:488`, `:517` |
| S4 protocol | this run | `protocol/app/cards.md:142-160` (`resolve`); `protocol/app/lead.md:39-40`, `:148-149` | read |
| S5 "Keep talking first" button | this run | `viewer/pages/thread.js:9-12`, `:367-372` | `app-threads.spec.js:501` |
| S5 hub offer limit (422 "the offer was already asked") | this run | `viewer/app/cards.js:72-77` | `app-hub.test.js` "limits offers to a second request after keep talking first" (second after keep-talking accepted and pinned; after take-it, while open, and a third refused) |
| S5 protocol | this run | `protocol/app/cards.md:58-70`, `:260`; `protocol/app/lead.md:100-104`, `:111-112` | read |
| S6 font packages, exact versions | this run | `viewer/package.json` (`@fontsource/inter` 5.3.0, `@fontsource/jetbrains-mono` 5.3.0, both published 2026-07-19 per `npm view … time`), `viewer/package-lock.json` | `npm --prefix viewer ci` |
| S6 font route allowlist | this run | `viewer/server.js:1835-1840` (`FONT_FILES`), `:1850-1859` | `viewer/test/routes.test.js` "an app page carries font-src self and the font route serves only the allowlist" |
| S6 `@font-face` and `font-src 'self'` | this run | `viewer/pages/app.css:4-11`; `viewer/server.js:47` | same routes test; "/wheelchair/docs and list have CSP…"; `viewer/test/app-fonts.spec.js:13` (loaded FontFaces, 200 `font/woff2`, no CSP violation, both browsers) |

## Deviations from plan

- **Installer idempotence was not checked with `./install.sh && ./install.sh`.** That line is
  only safe from the canonical clone: run from a worktree it re-renders the real home's
  harness files and services to that worktree. It was run once that way (see Known gaps);
  after that, per the lead, installer behaviour was checked with `bash install/test/run.sh`
  (temp homes only), which passes. The lead will correct the plan's Validation line.
- Three files outside a worker's original boundary were edited, each a one-line test fixture
  the spec change forces: `viewer/test/render.spec.js` (T1, lead-approved: mock route for
  `pages/markdown.js`), `viewer/test/pages.spec.js` (T4: its hard-coded CSP string gains
  `font-src 'self'`), and older `app-hub.test.js` fixtures that posted repeated offers or
  used a question as the "wrong kind" for resolve (T2, within its boundary but changing
  existing tests). Logged in PLAN.md.
- `protocol/app/lead.md:101`: the sub-lead dropped "as today" from T2's wording on merge.
- Everything else as specified. Worker choices are logged in PLAN.md's Log.

## Routers

highways not installed; routers not maintained. (`viewer/AGENTS.md` was nonetheless updated
by hand where it lists files: the doc page and `pages/markdown.js` in the file table and
pages row, and the font route in the `vendor/` row.)

## Validation evidence

All run by the sub-lead at `9fc7ff5` (all four tasks merged), in this worktree after
`npm --prefix viewer ci`.

```
$ node --test viewer/test/*.test.js
not ok 148 - a starter that loses the freed port registers through the new holder
# tests 254
# pass 253
# fail 1

$ npm --prefix viewer run test:browser
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  410 passed (1.3m)

$ bash machine/test/run.sh
# tests 51
# pass 51
# fail 0

$ bash install/test/run.sh
PASS real Codex hooks are byte-identical after suite
PASS real Codex config is byte-identical after suite
PASS real wheelchair directory is byte-identical after suite
RESULT 87 passed, 0 failed

$ bash sensitivity/test/run.sh; bash seen/test/run.sh; bash codex/test/run.sh
exit 0, exit 0, exit 0

$ git status --porcelain
(empty)
```

The three failures are pre-existing and already recorded in `docs/known-issues.md` (sections
"a starter that loses the freed port…" and "no drawn arrow's line passes through…"). Both
were also reproduced by the sub-lead on this branch before any task merged (`3808ae5`), and
neither test touches a file this build changed.

**Fails before, passes after.** The final test files (`git archive HEAD viewer/test`) were laid
over a `git archive 7246e90` export in a scratch git repository and run there:

```
$ node --test viewer/test/app-hub.test.js viewer/test/app-pages.test.js viewer/test/routes.test.js viewer/test/markdown.test.js
not ok 5 - derives an opening title and lets only the lead rename it with title cards
not ok 6 - validates the optional question document name
not ok 11 - records a press and lets a lead resolve an open question only in its thread
not ok 12 - limits offers to a second request after keep talking first
not ok 88 - the document page is served behind the remember cookie like the other app pages
not ok 3 - viewer/test/markdown.test.js
not ok 97 - /wheelchair/docs and list have CSP while a graph page keeps the index page header-free
not ok 98 - an app page carries font-src self and the font route serves only the allowlist
not ok 112 - page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in
# tests 113
# pass 104
# fail 9

$ npx playwright test app-threads.spec.js app-doc.spec.js app-fonts.spec.js   (7246e90 code)
  62 failed / 60 passed. Each failing test fails in both browsers (and both sizes where it has them):
  app-doc.spec.js:52, :64, :78, :94, :111 (phone and desktop)
  app-fonts.spec.js:13
  app-threads.spec.js:410, :421 (S1), :435, :447 (S2), :458, :473, :488, :517 (S4), :501 (S5), :527 (S3)
  Every other spec in those files passes at 7246e90.
```

So each of S1–S6 has at least one test that fails on `7246e90` and passes at `9fc7ff5`. T3's
S1 list spec passed when written only because T2's `createThread` change was already on its
branch; the run above shows it failing without it.

## Known gaps / residual risks

- **Machine-wide side effect, not yet undone.** T4's brief carried the plan's
  `./install.sh && ./install.sh`, and the worker ran it in its worktree
  `~/.local/state/wheelchair/worktrees/wheelchair/wc-1f02c3554935-w3`. The dial region in
  `~/.claude/CLAUDE.md`, every wheelchair skill and Codex prompt, the seen hook in
  `~/.claude/settings.json`, `~/.codex/AGENTS.md` and both systemd units now point at that
  worktree, and wheelchair-viewer and wheelchair-machine were restarted on its code (T1 and T4,
  not T2/T3). The lead has put the restore (re-run `install.sh` from the canonical clone) to
  Collin. That worktree is deliberately kept and must not be removed before the restore.
- Fonts are the latin subset only (as specified); text outside it falls back to system fonts.
- `@fontsource` packages are now runtime dependencies of the viewer; a machine that skipped
  `npm --prefix viewer install` serves 404 for the fonts and falls back to system fonts (no
  error, `font-display: swap`).
- Cards answered before this change carry no `answered_value` and keep the generic "Answered" tag (by design).

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
