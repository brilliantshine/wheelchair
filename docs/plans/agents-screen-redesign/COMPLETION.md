---
slug: agents-screen-redesign
date: 2026-11-17
implemented-by: "standard / gpt-6.1-terra (T1, T3 ×2, T4, T5; Claude requested for T3 and T4 but unavailable); light / gpt-6-luna (T2); sub-lead claude-opus-5-5 (integration: two test assertions, router and API docs)"
verified-by:
  - round: 1
    lane: verifier top / gpt-6.1-sol (FAIL, 2 gaps; REMEDIATION-1.md)
    checks: standard / gpt-6.1-terra, light / gpt-6-luna
  - round: 2
    lane: verifier top / gpt-6.1-sol (PASS on 10ed6ae)
    checks: standard / gpt-6.1-terra, light / gpt-6-luna
---

# Completion Report — Agents screen: layout and terminal

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by:
  - round: <n>
    lane: <verifier lane/model>
    checks: <the implementing lane it checked>
```

## Spec coverage

All rows are `this run`; Prior Work was empty. Line numbers are at commit `42d0ab9` plus this report's commit.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 `wc.js session start --title` | this run | `viewer/app/wc.js:90` | `viewer/test/app-session-meta.test.js:9`, `:62` (no `title` key without the flag) |
| §1 hub stores `title` (trimmed, 80 chars, absent when empty) and `brief` verbatim | this run | `viewer/app/sessions.js:134`, `:212-213` | `app-session-meta.test.js:9`, `:62` |
| §1 `publicSession` never returns `brief` (or `token`) | this run | `viewer/app/sessions.js:60-63`; open/restart responses `viewer/app/routes.js` (`POST threads/:id/open`, `/restart`) | `app-session-meta.test.js:89`; `app-agents.test.js:89` (walks the whole agents response) |
| §1 `GET /sessions/:name/brief` (200, 404, sign-in, `wc-` names) | this run | `viewer/app/routes.js:491-496` | `app-session-meta.test.js:9` (200/404/signed-out matches the pane route), non-`wc-` 404 |
| §1 display title rule; lead = thread title; finished = own newest result summary | this run | `viewer/app/agents.js:7-13`, `:55` | `app-agents.test.js:89` |
| §1 `--title` in lead.md, sub-lead.md, cards.md | this run | `protocol/app/lead.md:53-56`, `:287-288`; `protocol/app/sub-lead.md:99-101`; `protocol/app/cards.md` (`wc.js session` bullet) | `node --test viewer/test/protocol-rules.test.js` (in the full Node run) |
| §2 `turn_started_at` wherever a turn starts, including the first turn | this run | `viewer/app/sessions.js:124`, `:272`, `:379`; `viewer/app/routes.js:526` | `app-session-meta.test.js:9` |
| §2 `turn_ended_at` wherever a turn ends | this run | `viewer/app/sessions.js:317`, `:427`, `:431`, `:436`, `:451` | `app-session-meta.test.js:62` |
| §2 `ended_at` when `live` becomes false | this run | `viewer/app/sessions.js:249` (failed start), `:572` (stop), `:632` (pollDead); `viewer/app/threads.js:187`, `:197` (archive) | `app-session-meta.test.js:62`, `:111` |
| §2 side panel timing line ("Working for", "Idle for", "Ran"; omitted when missing) | this run | `viewer/pages/agents.js:22` | `viewer/test/app-views.spec.js:57` ("model-a · high", /Working for \d+m/, "Ran 22m") |
| §3 keep every session, parent rules, cycle guard, children by `created_at` | this run | `viewer/app/agents.js:14-60` | `app-agents.test.js:20`, `:99` |
| §3 lead `project`, `stage`, `finished`, `finished_at` | this run | `viewer/app/agents.js:60`, stage `:64-67` (worktree → `readStatus`, else `last_status`, no slug → idea) | `app-agents.test.js:77`, `:106` |
| §3 `asides` (open only, shape, working/idle) | this run | `viewer/app/agents.js:60` | `app-agents.test.js:77` |
| §3 `state` incl. Decision 13 waiting, `waiting_on` labels | this run | `viewer/app/agents.js:38-53` | `app-agents.test.js:52`, `:59`, `:77` |
| §3 `counts` (needs-you counted as waiting) | this run | `viewer/app/agents.js:56` | `app-agents.test.js:52` |
| §3 `has_brief`; no `brief`/`token` in the response | this run | `viewer/app/agents.js:19` | `app-agents.test.js:89` |
| §4 sidebar: live leads, tag, title, "<Stage> · N agent(s)", Needs you, Finished today fold | this run | `viewer/pages/agents.js:40-43` | `app-views.spec.js:57` |
| §4 URL selection `?lead=`/`&agent=`, default first live lead, legacy `#lead-`, unknown id falls back | this run | `viewer/pages/agents.js:18`, `:31-36` | `app-views.spec.js:57` (opens `#lead-a`, expects `?lead=a`) |
| §4 links use `?lead=` | this run | `viewer/pages/threads.js:57`; `viewer/pages/thread.js:137`, `:156` | `viewer/test/app-threads.spec.js:108`; `viewer/test/app-ui.spec.js:104` |
| §4 heading and count line | this run | `viewer/pages/agents.js:24`, `:46-47` | `app-views.spec.js:57`; screenshot `desktop-tree-panel.png` |
| §4 boxes: title, role, dot + status, dashed finished/not-started, no session names, no tmux anywhere | this run | `viewer/pages/agents.js:48`; `viewer/pages/views.css:136` | `app-views.spec.js:57` (dashed, waiting label, one "Needs you" box, no "tmux"); `app-ui.spec.js:238` |
| §4 side panel: role, title, model and effort, machine, timing, status, Open terminal (live only), Read its brief (dialog, plain text) | this run | `viewer/pages/agents.js:51` | `app-views.spec.js:57` (brief shown as text `<b>Plain brief</b>`) |
| §4 unreachable notice and empty state kept | this run | `viewer/pages/agents.js:28-29`, `:44` | `app-views.spec.js:57`; `app-ui.spec.js:238` |
| §4 5 s poll redraws without losing selection, terminal or fold | this run | `viewer/pages/agents.js:53-54`; terminal panel outside the redrawn root (`viewer/pages/agents.html:18`) | `app-views.spec.js:57` (two 5.5 s waits, added by the sub-lead) |
| §5 phone stacked levels with back links, URL driven | this run | `viewer/pages/agents.js:38`, `:45`, `:51`; `viewer/pages/views.css:164` | `app-views.spec.js:57` (phone project: Leads → tree → agent → back) |
| §6 reusable terminal module, destroyable, no page IDs | this run | `viewer/pages/term-view.js` (`mount`, `destroy`, `retarget`) | `app-views.spec.js:152`, `:57` |
| §6 bottom panel: height handle (localStorage, try/catch), Full screen + Escape, Pop out `terminal?name=`, close | this run | `viewer/pages/agents.js:9-16` | `app-views.spec.js:57` (Pop out URL) |
| §6 typing switch: starts View only, amber, notice line, cursor | this run | `viewer/pages/term-view.js:73-90`; `viewer/pages/views.css` `.tv-*` rules | `app-views.spec.js:152`, `:188`, `:57` |
| §6 reset to View only on close and on selecting another agent; re-target if live, else close | this run | `viewer/pages/agents.js:38`; `term-view.js` `retarget` | `app-views.spec.js:57` |
| §6 queued keys discarded on switch-off, close, re-target | this run | `viewer/pages/term-view.js:75`, `:93-96` | `app-views.spec.js:152` (switch after the first key; count stops below 200) |
| §6 never forward mouse reports; strip mouse modes | this run | `viewer/pages/term-view.js:45-52`, `:107` | `app-views.spec.js:152` |
| §6 history: machine `?history` | this run | `machine/service.js:349-351`, `:1130-1136` | `machine/test/service.test.js` "pane history captures requested scrollback and rejects invalid values" |
| §6 history: hub pass-through | this run | `viewer/app/routes.js:500-504` | `app-session-meta.test.js:47` |
| §6 history: view polls `history=2000` each second, scrollback 2000, keeps scroll place, skips unchanged | this run | `viewer/pages/term-view.js:134`, `:141-156`, `:169`, `:177` | `app-views.spec.js:152` (pane request carries `history=2000`); login without history `viewer/test/app-accounts.spec.js` 'terminal login mode' |
| §6 standalone terminal page: same switch, filter, history, starts View only | this run | `viewer/pages/terminal.js:32-33`; `viewer/pages/terminal.html` | `app-views.spec.js:152`, `:188`, `:206`, `:218` |
| §8 no lead session → not shown; older leads not boxes; missing parent → lead | this run | `viewer/app/agents.js:14-31` | `app-agents.test.js:99` |
| §8 unreachable machine: pane error shown in the terminal | this run | `viewer/pages/term-view.js:136-138`, `:162` | not covered by a test (see gaps) |
| §8 old records: no "undefined"/"NaN" | this run | `viewer/pages/agents.js:22` (duration returns '' on missing timestamps); `viewer/app/agents.js:7-13` fallbacks | `app-agents.test.js:89` (role fallback) |
| §8 `prefers-reduced-motion` | this run | no animation is defined anywhere on the page (`grep -n "animation\|@keyframes" viewer/pages/views.css` returns nothing) | by inspection |
| §9 tests and validation | this run | as listed in this table | Validation evidence below |

## Deviations from plan

- Login terminal (`/app/terminal?login=…`) gets the switch and starts View only like a session terminal. It requests no history, because the login pane route takes none. This is the sub-lead's reading of §6 "the standalone terminal page" (Log, 2026-11-17).
- On the side panel, a `waiting`, `not-started` or `needs-you` agent uses the "Idle for" wording from `turn_ended_at`. §2 names only working, turn ended and finished.
- The first T4 commit put three screenshots under `reports/`. The sub-lead removed them on merge (`42d0ab9`), because the lead asked for them outside the repo.

## Routers

- `viewer/AGENTS.md` (`pages/` row): now names `term-view.js` as the terminal view that both the Agents panel and `terminal.html`/`terminal.js` mount, and describes `agents.*` as the sidebar, tree, side panel and bottom terminal.
- `viewer/app/API.md`: the `GET /agents` paragraph now describes the new response (`project`, `stage`, `finished`, `finished_at`, `asides`, `counts`, node `display_title`, `state`, `waiting_on`, `has_brief`, finished sessions kept). The brief route and `?history` rows were added by T1.
- `machine/API.md`: pane row documents `?history` (T2).

## Validation evidence

Run by the sub-lead on the feature branch at `42d0ab9`, all tasks merged, after `npm --prefix viewer ci` (this worktree had no `viewer/node_modules`):

```text
$ node --test viewer/test/*.test.js
not ok 357 - a starter that loses the freed port registers through the new holder
# tests 490
# pass 489
# fail 1

$ bash machine/test/run.sh
# tests 115
# pass 115
# fail 0

$ npm --prefix viewer run test:browser
  2 skipped
  662 passed (3.1m)

$ cd viewer && npx playwright test test/app-views.spec.js --grep "agent tree" --reporter=line
  4 passed (38.9s)
```

The one Node failure is `docs/known-issues.md` ("Viewer: 'a starter that loses the freed port registers through the new holder' fails"). It failed the same way on the feature branch before any viewer-page task merged. The lead confirmed it can stay.

Screenshots (test-helper data, outside the repo) are in the sub-lead's scratch folder `…/scratchpad/shots/`: `desktop-tree-panel.png`, `desktop-terminal-typing.png`, `phone-tree.png`.

## Known gaps / residual risks

- §8 "Open terminal shows the pane route's error": implemented (`term-view.js:136-138`, `:162`), but no browser test drives a failing pane route.
- Mouse-report dropping is tested on the standalone page through `_onDataForTest`, not through real xterm mouse events. The Agents panel uses the same module.
- The cursor is hidden in View only with `ESC[?25l`. No test checks this pixel by pixel.
- `agents()` reads each slugged thread's PLAN.md on every 5 s poll, which is one file read per thread per poll.
- Lead stage for a thread whose slug is not yet discovered shows `idea` until the Threads/Features page records the slug. `agents()` does not run slug discovery.
- Every Claude worker request fell back to GPT. The design match was judged from screenshots only.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-17

Verification attempt 1 (verifier gpt-6.1-sol, commit 589d66d) failed with two gaps (REMEDIATION-1.md, verbatim there).

| Gap | Fix (file:line) | Validated by |
|-----|-----------------|--------------|
| §4 wide desktop trees clipped past the unreachable left edge | `viewer/pages/views.css:132-133` (`.agents-tree` flex, top branch `margin: 0 auto; flex-shrink: 0`), `:146` (`.agents-children` `justify-content: safe center`) | `viewer/test/app-views.spec.js` 'wide agent trees scroll from the left while narrow trees stay centred' |
| §5 phone: tree stayed above the selected agent's details | `viewer/pages/views.css:170` (show rule `.has-lead:not(.has-agent) .agents-main`) | `viewer/test/app-views.spec.js` 'phone agent selection shows only details and returns to the tree' |

Lane: R1, light / gpt-6-luna. The worker's desktop test measured before the first render; the sub-lead added waits for the boxes before measuring (two lines). Both new tests fail against the pre-fix CSS (`895f77c`): 4 failed (2 tests, Chromium and Firefox), checked by the sub-lead, and pass with it.

```text
$ cd viewer && npx playwright test test/app-views.spec.js --reporter=line   (twice)
  6 skipped
  38 passed (56.1s)

$ npm --prefix viewer run test:browser
  6 skipped
  666 passed (3.1m)

$ node --test viewer/test/*.test.js
not ok 357 - a starter that loses the freed port registers through the new holder   (known, docs/known-issues.md)
# tests 490
# pass 489
# fail 1
```

### Verification attempt 2 — 2026-11-17

PASS on 10ed6aef8aa1f15eb5b9ee1491ccd3f0d53a8660 (verifier gpt-6.1-sol). Its run: machine 115/115; viewer Node 488/490 and browser 664 passed, 6 skipped, 2 failed, the failures being the known lifecycle port-retry test and the font check, which needs `viewer/node_modules` (its run used the canonical clone's Playwright). The sub-lead's runs on the same tree with dependencies installed: browser 666 passed, 6 skipped; Node 489/490 (known lifecycle only).
