---
slug: agents-screen
date: 2026-11-15
implemented-by: "GPT Standard (gpt-6.1-terra) for T1, T2, T3 (T2 and T3 asked for Claude; the hub fell back to GPT); sub-lead Claude Opus 5.5 (integration edits only)"
verified-by:
  - round: 1
    lane: GPT top tier (hub fallback; Claude unavailable)
    checks: GPT Standard (gpt-6.1-terra)
  - round: 2
    lane: GPT top tier (hub fallback; Claude unavailable)
    checks: GPT Standard (gpt-6.1-terra)
---

# Completion Report — Agents screen with named leads

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
numbers are at commit `5a0a2e2` (branch `wc/85d38701e785`).

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Lead names: stored on the thread as `thread.lead_name`; restarted lead keeps it | this run | `viewer/app/sessions.js:92`, `:150` (only when `!thread.lead_name`) | `viewer/test/app-hub.test.js:436` (assert `:452`) |
| Lead names: assigned when the first lead record is pushed, at both push sites (capacity-waiting and normal), saved with that save | this run | `viewer/app/sessions.js:92` (waiting record), `:150` (normal record); `viewer/app/hub.js:87-97` `saveWithLeadName` | `app-hub.test.js:1726`, `:510` (asserts `:522`, `:524`) |
| A start that throws before any record is pushed leaves the thread unnamed | this run | ordering in `viewer/app/sessions.js` (name set only at `:92`/`:150`, after the throws above them) | `app-hub.test.js:1268` (preflight failure, assert `:1276`) |
| Choice: `settings.lead_names` else Greek list; first name not held case-insensitively by an unarchived thread; else `<name> <n>` walking the list for each n | this run | `viewer/app/names.js:3`, `:5-12` | `viewer/test/app-agents.test.js:7` |
| Release: archived threads do not hold a name, keep `lead_name` for display | this run | `viewer/app/names.js:7` (filters `!thread.archived`) | `app-agents.test.js:7` (archived case) |
| Serialized hub-wide (promise chain) | this run | `viewer/app/hub.js:36`, `:87-97` | `app-hub.test.js:1726` (two concurrent threads get distinct names) |
| Backfill at hub start, oldest `created_at` first | this run | `viewer/app/hub.js:46-47` | `app-hub.test.js:1739` |
| Editing the list never renames existing threads | this run | names are only set when `!thread.lead_name` (`sessions.js:92`, `:150`; `hub.js:89`) | code reading |
| No names for non-lead roles | this run | `sessions.js:92`, `:150` gated on `role === 'lead'` | code reading |
| `settings.lead_names` default `[]`, kept by `normalize` | this run | `viewer/app/settings.js:27`, `:185`, returned by `describe` `:257` | `viewer/test/app-settings.test.js:266` |
| Validation: trim, 1–40 chars, no case-insensitive duplicates, ≤200, blank lines dropped | this run | `viewer/app/routes.js:186-191` | `app-settings.test.js:266` |
| Settings page "Lead names" text box in Leads section with the hint | this run | `viewer/pages/settings.js:215-225`, `:336` | `viewer/test/app-settings.spec.js:346` |
| Model and effort on the hub session record | this run | `viewer/app/sessions.js:147`, `:187` (re-applied after the machine response is merged) | `app-hub.test.js:1726` (asserts `model` present, `effort` key present) |
| `GET /wheelchair/api/agents`, unarchived threads, `{leads, machines}` shape, token stripped | this run | `viewer/app/routes.js:57`; `viewer/app/agents.js:3-29`, `:31-40` | `app-agents.test.js:15` |
| Tree: newest lead is the node; non-lead children of any lead hang under it; grandchildren under their starter; missing starter → under lead | this run | `viewer/app/agents.js:6-18` | `app-agents.test.js:15` (`sub` started by old lead under new; `worker` under `sub`; `orphan` under lead) |
| Shown: live only; ended kept with live descendant; all-ended thread omitted | this run | `viewer/app/agents.js:20-26` | `app-agents.test.js:15` (`dead` dropped, `sub` kept, all-ended → `[]`) |
| `waiting_on` follows `started_by`, only when `turn_ended === true`, live and not finished | this run | `viewer/app/agents.js:13` | `app-agents.test.js:15` (new lead waits on `review` only, not `done` or old lead's `sub`) |
| `machines[]` with `reachable`, `last_seen` (machineSeen), `hub` flag as views.js | this run | `viewer/app/agents.js:31-40` | `viewer/test/app-ui.spec.js:196` (unreachable banner) |
| `GET /wheelchair/api/sessions` kept | pre-existing, untouched | `viewer/app/views.js:109` | full suites |
| API documented | this run | `viewer/app/API.md:109-113`, `:31` (`lead_names` in preferences) | — |
| Agents page served at `/wheelchair/app/agents`, in allowlist | this run | `viewer/pages/agents.html`; `viewer/server.js:1830` | `viewer/test/app-views.spec.js:57` |
| Polls every 5s; folds keep state across redraws | this run | `viewer/pages/agents.js:107`, `:23`, `:82-83` | `app-views.spec.js:57` |
| One block per lead, newest `collin_at || created_at` first, `id="lead-<thread_id>"`, hash scrolls and highlights | this run | `viewer/pages/agents.js:36-38`, `:94-96`; `viewer/pages/views.css:110` | `viewer/test/app-threads.spec.js:100` (link target), `app-views.spec.js:57` |
| Card contents: lead name + lead badge / role + internal name, thread title, machine, CLI, model, effort ("default effort"), status badge, Open terminal, attach + Copy, Open thread | this run | `viewer/pages/agents.js:48-79`, `:10-12` | `app-views.spec.js:57`, `app-ui.spec.js:196` |
| Controls by state: terminal/attach only for live, non-waiting; capacity-waiting line; ended ancestor dimmed with name, role, "ended" | this run | `viewer/pages/agents.js:61-79`; `views.css:111` | `app-views.spec.js:57` |
| Waiting line with child roles de-duplicated in start order; subtle marker on named children | this run | `viewer/pages/agents.js:46`, `:49`, `:63-66`; `views.css:112` | `app-views.spec.js:57` |
| Tree indent with connecting line, capped so three levels fit at 360px | this run | `viewer/pages/agents.js:85`; `views.css:118-119` | `app-views.spec.js:57` (360px and desktop, no horizontal scroll) |
| Unreachable banner; empty state "No agents running." | this run | `viewer/pages/agents.js:29-34`, `:93`; `agents.html` | `app-ui.spec.js:196` |
| Sessions page deleted; `/wheelchair/app/sessions` → 302 to Agents | this run | `viewer/pages/sessions.html`, `sessions.js` removed (commit `25fe7a2`); `viewer/server.js:1879` | `viewer/test/app-pages.test.js:90`, `app-views.spec.js:74` |
| Nav entry Agents; live-count badge from the agents API | this run | `viewer/pages/nav.js:41`, `:68`, `:121-125` | `app-settings.spec.js:38`, `app-doc.spec.js:55`, `app-threads.spec.js:32` |
| Terminal page: `data-current="agents"`, "← Agents", lead name before session name (agents API, then threads for ended leads) | this run | `viewer/pages/terminal.html:11`, `:14`; `viewer/pages/terminal.js:17-30` | code reading (no browser test asserts the terminal header name) |
| Other references updated: features machine rows, server header comment, thread header button, routers | this run | `viewer/pages/features.js:84`; `viewer/server.js:8`; `viewer/pages/thread.js:149`; `viewer/AGENTS.md` pages row; `AGENTS.md` viewer row | `app-ui.spec.js:104` |
| Threads row chip after title; thread link and chip siblings; link still covers row | this run | `viewer/pages/threads.js:49-60`; `viewer/pages/app.css:127-135` | `app-threads.spec.js:100` (asserts no `a a`) |
| Chip links to `#lead-<id>` when newest lead live, else plain text; none when unnamed | this run | `viewer/pages/threads.js:54-59` | `app-threads.spec.js:100` |
| `GET /wheelchair/api/threads` returns `lead_name` | pre-existing route, this run's field | `viewer/app/routes.js` threads handler returns stored threads | `app-hub.test.js:522-524`, `app-threads.spec.js:100` |
| Thread page header shows the lead name chip, linked when live | this run | `viewer/pages/thread.js:125-133`; `viewer/pages/thread.css:11` | `app-threads.spec.js:100` |

## Deviations from plan

- The thread page's old "Sessions" header button (`thread.js:149`) is now "Agents" linking to
  `/wheelchair/app/agents#lead-<thread_id>`. The Spec says only "update every other reference";
  the target is a sub-lead choice, logged in PLAN.md.
- `sessions` stays in the server's `APP_PAGES` allowlist (`server.js:1830`) so the route reaches
  the 302 at `:1879` rather than 404; there is no `sessions.html` behind it.
- Otherwise none.

## Routers

highways not installed; routers not maintained by it. Updated by hand as the brief asked:
`viewer/AGENTS.md` — new rows for `app/names.js`/`app/agents.js`, and the `pages/` row now lists
agents (with `agents.html`/`agents.js`) instead of sessions. Root `AGENTS.md` — the viewer row's
page list says Agents instead of Sessions.

## Validation evidence

Run by the sub-lead on the integrated branch at `5a0a2e2`, own processes only (the suites'
helpers start servers with `--port`/`--cache-root`; no server started by hand, no install.sh).

`node --test viewer/test/*.test.js`:

```text
1..339
# tests 348
# suites 0
# pass 347
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 79105.186521
not ok 233 - a starter that loses the freed port registers through the new holder
```

The one failure (`viewer/test/lifecycle.test.js:420`) also fails on the pre-build base
`7f4c318` (checked in a detached checkout of that commit: `# pass 30 # fail 1`, same test).

`npm --prefix viewer run test:browser`:

```text
  3 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/app-settings.spec.js:61:3 › desktop › editing a table cell saves, and Not used saves null
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  18 did not run
  539 passed (2.5m)
```

- `browser.spec.js:2395` fails identically on the pre-build base `7f4c318` (both browsers).
- `app-settings.spec.js:61` (Firefox) is load-sensitive: rerun alone twice,
  `npx playwright test app-settings.spec.js --project=firefox` → `21 passed` both times
  (including the new `:346` lead-names test). The 18 "did not run" are that serial
  describe's remaining tests after the failure.
- Earlier one-off Firefox failures reported by workers (`app-ui.spec.js:192`,
  `browser.spec.js:1043`, `app-threads.spec.js:339`) passed on rerun on the integrated branch.

## Known gaps / residual risks

- The model/effort test asserts presence, not the exact resolved values; exact values are
  only checked indirectly by the pre-existing machine-side model tests (`app-hub.test.js:932`).
- No browser test asserts the terminal page's "<lead name> · <session>" header.
- Backfill at hub start (`hub.js:46-47`) writes threads outside the per-thread lock; it runs
  in `init` before routes are served, so no concurrent writer is expected.
- Pre-existing failing tests above (lifecycle port race, arrow-through-box) remain.

## Remediation rounds

### Remediation 1 (verification attempt 1 at `70668d4`: FAIL)

No functional gaps. The verifier saw the font tests 404 because its worktree had no
`viewer/node_modules`, and it saw the two failures that predate the build. The lead ruled those
two out of scope, and they are recorded in `docs/known-issues.md` (commit `01ec327`). No code
changed. Details are in `REMEDIATION-1.md`. Re-verification is attempt 2, with dependencies
installed first.

### Verification attempt 2 at `e4c4c71`: PASS

After `npm --prefix viewer ci`, the unit suite had 347 passed, and its only failure was the exempted lifecycle test. The browser suite had 558 passed and 2 skipped, and its only failure was the exempted arrow test, in both browsers. Extra Chromium and Firefox checks of ended ancestors, capacity-waiting controls, the 360px layout, hash highlighting and terminal lead-name headers all passed.
