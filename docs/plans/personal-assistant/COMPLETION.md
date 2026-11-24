---
slug: personal-assistant
date: 2026-11-23
implemented-by: "standard (gpt-6.1-terra: T1, T2, T3, T4, T4b, T5; claude-sonnet-5-5: T6, T6b, T7, T8); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — A personal assistant across all projects

Written for a hostile reviewer: every claim checkable, no claim without evidence. Every line
below was confirmed against commit `afba6dbe` (the tip after T6b merged); T8 then changed only
`viewer/app/assistant.js:13` (the guard reads a snapshot) and appended a test at the end of `viewer/test/assistant.test.js`. Paths are relative to
the repository root. All rows are `this run`; the plan has no Prior Work.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 setting `assistant`, default `off`, normalised | this run | `viewer/app/settings.js:55`, `:326`; save validated `viewer/app/routes.js:376` | `viewer/test/assistant.test.js:12` (test "assistant lifecycle, visibility, refusals and fresh context", `:8`) |
| §1 Settings "Personal assistant" control and line | this run | `viewer/pages/settings.js:557-559`, `:603` | `viewer/test/app-assistant.spec.js:97` "Settings control turns the assistant on and off" |
| §1 turning on: create once, start lead; existing record gets a fresh lead | this run | `viewer/app/assistant.js:21-30`; `viewer/app/routes.js:347`, `:417` | `assistant.test.js:20`, `:25` |
| §1 turning off: stop sessions, keep record, routes 404, actions refused | this run | `viewer/app/assistant.js:12-14`, `:31-36`; `viewer/app/routes.js:47`, `:99`; `viewer/app/assistant-actions.js:9` | `assistant.test.js:39`, `:42`, `:44`, `:94` |
| §1 fresh install / update starts off | this run | `viewer/app/settings.js:55` | `assistant.test.js:12` |
| §2 record (`emptyThread` + `assistant`, `project: null`, title, hub machine), idempotent | this run | `viewer/app/assistant.js:24-27`; `viewer/app/threads.js:21` | `assistant.test.js:20`, `:22` |
| §2 never archived | this run | `viewer/app/threads.js:210` | `assistant.test.js:29` |
| §2 never handed off or exported | this run | `viewer/app/handoff.js:125`, `:145` | none dedicated (see gaps); `message` to a handed-off thread `assistant.test.js:136` |
| §2 not a stub; no branch, plan or PR | this run | no branch: `viewer/app/sessions.js:425`, `machine/service.js:846`; never a stub (created only by `assistant.js:24-27`, never by the stub path); out of the PR/auto-merge pollers `viewer/app/auto-merge.js:24`, `viewer/app/threads.js:488` | indirect: `assistant.test.js:25` (start payload has no project fields) |
| §2 folder `<state>/assistant`, `mkdir -p`, no git | this run | `machine/service.js:632-636`; hub payload `viewer/app/sessions.js:377` | `machine/test/assistant.test.js:90` "assistant start uses its own folder and prompt, and switch requires the matching session" |
| §2 "Used before" skips it | this run | `viewer/app/routes.js:188` | none dedicated |
| §2 account switch sends `assistant: true`; machine accepts | this run | `viewer/app/sessions.js:643`; `machine/service.js:881`, `:920` | `assistant.test.js:67` "account switching sends assistant identity without a project" (`:86`); `machine/test/assistant.test.js:90` |
| §2 lead role, `prompt_role: "assistant"`, prompt = `assistant.md` + `cards.md` + `cards-lead.md` + layers | this run | `viewer/app/sessions.js:377`; `machine/service.js:198-207` | `machine/test/assistant.test.js:90` |
| §2 `session start` from the assistant refused | this run | `viewer/app/sessions.js:741` | `assistant.test.js:32` |
| §2 fresh starts: context with id and title only | this run | `viewer/app/threads.js:127-153` (state `:141`) | `assistant.test.js:58` |
| §2 fresh starts: queued messages move, presses dropped | this run | `viewer/app/threads.js:189-190` | `assistant.test.js:59`, `:60` |
| §2 fresh starts: own question/needs cards retracted "The assistant restarted" | this run | `viewer/app/threads.js:195-197` | `assistant.test.js:61` |
| §2 context line "Assistant restarted · starting fresh" | this run | `connectors/hub-common.js:108` | `viewer/test/assistant-render.test.js:22` |
| §2 live account switch keeps the conversation | this run | the switch path (`viewer/app/sessions.js:643`) never calls `restartLead` | none dedicated |
| §2 lists: one shared check; off hides it everywhere | this run | `viewer/app/assistant.js:7-11`; `viewer/app/routes.js:525`; `viewer/app/views.js:33`, `:157`; `viewer/app/agents.js:139` | `assistant.test.js:20`, `:35`, `:37`, `:46-47` |
| §2 lists: out of project grouping | this run | `viewer/pages/threads.js:106` | `viewer/test/app-assistant.spec.js:17` |
| §2 lists: out of other leads' `session leads`, so out of lead overlap checks | this run | `viewer/app/peers.js:46` (the hub has no separate overlap code; leads find overlaps through `session leads`) | `assistant.test.js:34` |
| §2 lists: out of auto-merge and PR pollers | this run | `viewer/app/auto-merge.js:24`; `viewer/app/threads.js:488` | none dedicated |
| §2 lists: its question/needs cards count under Needs you | this run | `viewer/app/views.js:42` | `viewer/test/app-assistant.spec.js:129` (real hub question card → "1 needs you") |
| §2 no asides | this run | `viewer/app/routes.js:624`; `viewer/pages/thread.css:455`; `viewer/pages/thread.js:1492` | `assistant.test.js:30` |
| §2 thread page: title, no project/branch/plan/PR/Agents/archive controls, Restart | this run | `viewer/pages/thread.js:176`, `:185`, `:193-194`, `:201-202`, `:214`, `:322` | `viewer/test/app-assistant.spec.js:49` |
| §3 `wc.js assistant` group, one JSON line, failures exit 0 | this run | `viewer/app/wc.js:100`, `:196-197`, `:209-211`, `:240` | `assistant.test.js:151` "assistant command retries reads but not writes and reports failures as JSON"; `:289` CLI file args |
| §3 reads retry, writes never | this run | `viewer/app/wc.js:170-180`, `:206-208` | `assistant.test.js:166-167` |
| §3 writes print `{ok:true, result}` from the browser route, no tokens | this run | `viewer/app/assistant-actions.js:73-76` | `assistant.test.js:146`, `:256` |
| §3 machine relay, single attempt, 120 s | this run | `machine/service.js:2301-2310` | `machine/test/assistant.test.js:120` (hub answering after 6.1 s) |
| §3 only the live assistant lead, setting on; else 403 | this run | `viewer/app/assistant-actions.js:9-12` | `assistant.test.js:94`, `:98` |
| §3 `projects` | this run | `viewer/app/assistant-actions.js:15-24` (reuses `newThread`, `viewer/app/routes.js:166`) | refusal only (`assistant.test.js:279`); output not asserted (see gaps) |
| §3 `threads [--archived]`, `lead_live`, `waiting` | this run | `viewer/app/assistant-actions.js:25-32`; `viewer/app/routes.js:524`; `viewer/app/views.js:141` | `assistant.test.js:198` "threads lists both registered machines and includes archives only on request" |
| §3 `thread <id>` with `cards`, `queued`, `recent` | this run | `viewer/app/assistant-actions.js:33-36` | `assistant.test.js:109`, `:110` |
| §3 `start` with `[wc:assistant]` first message, title rule, failed-launch output | this run | `viewer/app/assistant-actions.js:38-47`; `viewer/app/threads.js:69`, `:83`; browser route strips `_assistant_title` `viewer/app/routes.js:560` | `assistant.test.js:120`, `:190`, `:217` |
| §3 `message` (queued, refusals, 20/hour limit) | this run | `viewer/app/assistant-actions.js:49-68` | `assistant.test.js:127`, `:136`, `:142`, `:268` |
| §3 `press` (browser press, `answered_by`, sudo refused) | this run | `viewer/app/assistant-actions.js:76`; `viewer/app/threads.js:339-341` | `assistant.test.js:114-115`, `:139`, `:228`, `:243` |
| §3 `restart` (refused archived/handed-off) | this run | `viewer/app/assistant-actions.js:69-74`; `viewer/app/threads.js:127-129` | `assistant.test.js:268` |
| §3 `archive` | this run | `viewer/app/assistant-actions.js:75`; `viewer/app/threads.js:255` | `assistant.test.js:145-147` |
| §3 the assistant thread refused as target of every action | this run | `viewer/app/assistant-actions.js:14` | `assistant.test.js:279` |
| §4 `[wc:assistant]` message → "From your assistant" bubble | this run | `viewer/app/assistant-actions.js:41`, `:63`; `connectors/hub-common.js:113-118`; `viewer/pages/thread.js:655` | `viewer/test/assistant-render.test.js:11`; `viewer/test/app-assistant.spec.js:66` |
| §4 press → "Your assistant: …", `answered_by`, cleared by a later browser press | this run | `connectors/hub-common.js:117`; `viewer/app/threads.js:339-341`; `viewer/pages/thread.js:865` | `assistant-render.test.js:16`; `assistant.test.js:228` |
| §4 restart `by: "assistant"` → "Lead restarted by your assistant" | this run | `viewer/app/threads.js:151`; `viewer/app/hub.js:230`; `connectors/hub-common.js:109` | `assistant-render.test.js:23`; `assistant.test.js:89` |
| §4 `archived_by` → "Archived by your assistant" | this run | `viewer/app/threads.js:255`; `viewer/pages/thread.js:193` | `viewer/test/app-assistant.spec.js:80`; `assistant.test.js:147` |
| §5 floating button on every `nav.js` page except the assistant page; nothing when off | this run | `viewer/pages/nav.js:168-181`; `viewer/pages/assistant-popup.js:15`, `:32-33` | `viewer/test/app-assistant-popup.spec.js:37` |
| §5 sheet under 900px, right panel at 900px and over, link to thread | this run | `viewer/pages/assistant-popup.css:9`, `:42-44` | `app-assistant-popup.spec.js:56`, `:78` |
| §5 conversation and text box on the same routes | this run | `viewer/pages/assistant-popup.js:225` | `app-assistant-popup.spec.js:78` |
| §5 "thinking…" | this run | `viewer/pages/assistant-popup.js:65`, `:115` | `app-assistant-popup.spec.js:96` |
| §5 unread dot (`localStorage` `wc-assistant-seen`, shared with the thread page) | this run | `viewer/pages/assistant-popup.js:9`, `:23-25`; `viewer/pages/thread.js:1508-1509` | `app-assistant-popup.spec.js:110`; `app-assistant.spec.js:49` |
| §5 "The assistant isn't running" + Restart | this run | `viewer/pages/assistant-popup.js:163-167` | `app-assistant-popup.spec.js:128` |
| §6 pinned row: first, outside groups, title, preview, Needs you count, no archive control | this run | `viewer/pages/threads.js:87-104`, `:114`, `:185-223` | `viewer/test/app-assistant.spec.js:17`, `:129` |
| §7 `protocol/app/assistant.md` rules | this run | `protocol/app/assistant.md:3-57` | no protocol test suite exists (AGENTS.md); read in review |
| §7 `lead.md` `[wc:assistant]` line | this run | `protocol/app/lead.md:23` | as above |
| §7 `cards.md` marker row | this run | `protocol/app/cards.md:213` | as above |
| §7 card kinds refused for the assistant thread | this run | `viewer/app/cards.js:61` | `assistant.test.js:31` (`offer`) |

## Deviations from plan

- **Pop-up chat is simplified** (§5 "same chat items and cards as the thread page"): the pop-up
  shows the user's and the assistant's messages and cards (question cards with option buttons;
  needs and other cards as a title and a link to the thread). Tool, context and peer items and
  press bubbles are left out. Matches the agreed mockups, which show only messages and cards.
- **Button shape** (§5 "round"): the agreed mockup's "✦ Assistant" pill (`border-radius: 999px`)
  is used; the mockup wins.
- **Side panel** (§5 "panel on the right side"): the mockup's floating 410px panel at the bottom
  right, not a full-height dock.
- **"Open in terminal"** stays on the assistant thread page; it is not among the Spec's removed
  controls, but the mockup does not show it.
- **Composer screen-reader label** in `viewer/pages/thread.html` still reads "Message the lead";
  the visible placeholder on the assistant page reads "Message the assistant".
- **Preview source**: the pinned row's preview is read from the assistant's chat route at most
  once a minute per page (cached in `sessionStorage`), because the list route has no reply text.

All per-task choices are logged in PLAN.md's Log.

## Routers

- `viewer/AGENTS.md`: lines for `viewer/app/assistant.js`, `viewer/app/assistant-actions.js`
  and `viewer/pages/assistant-popup.{js,css}`.
- `viewer/app/API.md`: `GET /api/assistant`, the assistant setting, `POST /api/machine/assistant`
  and the actions.
- `machine/API.md`: the `assistant`/`prompt_role` start fields, the switch field and
  `POST /v1/agent/assistant`.
- `protocol/AGENTS.md`: lists `app/assistant.md`.

## Validation evidence

Run by the sub-lead on the feature branch at `afba6dbe`:

`node --test viewer/test/*.test.js`
```
not ok 251 - switching a harness off cancels its install on every known machine, without waiting
# tests 951
# pass 950
# fail 1
```
The one failure is pre-existing: `viewer/test/app-harnesses.test.js:311` also fails when run alone
on the feature branch before any viewer change of this build (19 pass, 1 fail; Log 2026-11-23).

`node --test machine/test/assistant.test.js`
```
# tests 2
# pass 2
# fail 0
```

`bash machine/test/run.sh`: the whole suite takes over 15 minutes on this host under parallel
load. Its failures were compared file by file against the feature branch before T2:
`machine/test/win*.test.js` + `plan-files.test.js` give 124 pass / 18 fail on both, with the same
18 Windows-copy tests failing (`wslpath` is absent on this host). No other machine test file
failed in an unloaded re-run.

`npm --prefix viewer run test:browser` at `afba6dbe`:
```
  1 failed
    [chromium] › test/app-send-now.spec.js:84:1 › Enter sends, Shift+Enter starts a new line, and the switch turns Enter-to-send off
  34 skipped
  1449 passed (20.3m)
```
That failure is pre-existing: run alone in Chromium it fails 3 of 10 times on base `25f34a45`
(before this build) and 2 of 8 on the feature branch after T8.

After T8: `node --test viewer/test/assistant.test.js` → `# pass 14`, `# fail 0`.

Focused browser specs (Chromium and Firefox), re-run by the sub-lead on T6b's branch:
`app-assistant.spec.js` + `app-assistant-popup.spec.js` → `26 passed`.

## Known gaps / residual risks

- No dedicated test for: export/hand-off refusal, "Used before" skipping the assistant, the
  `projects` action's output, a live account switch keeping the conversation, auto-merge/PR
  poller exclusion, and a 400 for a bad `assistant` value. The code is cited above.
- Turning the assistant on when its lead fails to start leaves the setting on and returns an
  error; the Restart button recovers.
- A session rebuilt from tmux after a machine restart loses the `assistant` flag (such sessions
  have no token and are only stopped or replaced).
- Check Once Built 1 (120 s for `start`/`restart`, including a remote machine) is untested
  against a real remote machine.
- Two worker worktrees (`wc-eec6963c41b4-w7`, `wc-eec6963c41b4-w9`) still exist because each
  holds an uncommitted scratch test file; removing them needs a delete.

## Remediation rounds

### Remediation 1 (after verification attempt 1 at `125ffb25`)

The lead answered fix all 11 gaps (`REMEDIATION-1.md`); one rare path (slow remote launch vs the 120 s relay) went to Accepted Risks.

| Gap | Fix | Task | Evidence |
|---|---|---|---|
| G1 guard broke two existing tests | fakes in `viewer/test/app-hub.test.js` and `app-session-meta.test.js` gain `threadSnapshot`; guard stays read-only | R1 | both files pass (142/142 with `assistant.test.js`) |
| G2 assistant saw asides | `asides` removed from what `threads`/`thread` return (`viewer/app/assistant-actions.js`) | R1 | new test in `viewer/test/assistant.test.js` |
| G3 stale stage | stage from `views.currentStatus`, the reader `/features` uses | R1 | new test in `assistant.test.js` |
| G4 `recent` lost user messages | filter to human, assistant and context items, then last 30 | R1 | new test in `assistant.test.js` |
| G5 queued `[wc:assistant]` marker and Send now duplicate | pending text unprefixed and labelled; matched by unprefixed text | R2 | `viewer/test/app-assistant.spec.js` "assistant queued messages and card presses render and reconcile after Send now" |
| G6 pop-up not the same conversation | the pop-up renderer (`viewer/pages/assistant-popup.js`) now draws context, tool and peer lines, press bubbles, question consequences and free-text answers, needs actions, file, image and lesson cards; repeated-text pending bubbles kept by occurrence count. Per the lead: no iframe or CSP change, and the queued list and Send now may be omitted | R3b, R3c | `viewer/test/app-assistant-popup.spec.js` (22 tests) |
| G7 assistant page vs mockup | terminal, attach and files column hidden on the assistant thread; screen-reader label | R2 | `app-assistant.spec.js`; screenshots posted beside `mockup-thread-*` |
| G8 phone button over the composer | button lifted above the composer on phone thread pages | R3 | `app-assistant-popup.spec.js` bounding-box test |
| G9 off in an open tab | pop-up removes itself on 404 "the assistant is off" | R3 | `app-assistant-popup.spec.js` |
| G10 preview link syntax and wrap | link text only, one line with ellipsis | R2 | `app-assistant.spec.js` |
| G11 card seen leaves unread dot | `rememberSeen` includes card times | R2 | `app-assistant.spec.js` |

Validation after remediation:
- `npm --prefix viewer run test:browser` at `712c888b` (everything but R3c): `34 skipped`, `1460 passed (23.9m)`, exit 0.
- `node --test viewer/test/*.test.js` at `712c888b`: `# tests 955`, `# pass 953`, `# fail 2` — `app-harnesses.test.js:311` (pre-existing) and `app-quiet.test.js` "6 message clears debt" (fails 2 of 3 runs alone under the same load on base `25f34a45`).
- At the merged tip after R3c: `node --test viewer/test/assistant.test.js viewer/test/assistant-render.test.js machine/test/assistant.test.js` → `# pass 22`, `# fail 0`; `npx playwright test test/app-assistant-popup.spec.js test/app-assistant.spec.js test/app-send-now.spec.js` → `50 passed`.

Line references in the coverage table above predate remediation; the files named are unchanged in role.

### Remediation 2 (after verification attempt 2 at `db9d1081`)

Attempt 2: Claude verifier PASS, GPT verifier FAIL (`REMEDIATION-2.md`). One rare path (an assistant `lesson` card) went to Accepted Risks. The lead deferred H2, H5, H6, H7 (PLAN.md Deferred 3-6) and asked for H1, H3, H4.

| Gap | Fix | Task | Evidence |
|---|---|---|---|
| H1 closed button over a short thread's composer (second attempt on G8) | button placed from the measured composer top under 900px, recomputed on resize, scroll, composer size and chat changes (`viewer/pages/assistant-popup.js`) | R4 | `viewer/test/app-assistant-popup.spec.js` no-overlap tests for short, long and growing threads at 390x844 |
| H3 turning on in an open tab | `viewer/pages/nav.js` re-checks `GET /api/assistant` every 30 s while the pop-up is absent | R4 | spec test: off → on → off → on without reload |
| H4 restart line leaves no unread dot | `newestAt` counts context items | R4 | spec test: a context line alone lights the dot |

Validation at `f2a4b7a8`:
- `TZ=UTC npm --prefix viewer run test:browser`: `34 skipped`, `1470 passed (21.8m)`, exit 0. (`TZ=UTC` because the `app-accounts.spec.js` "lead waiting line" tests fail after 9 PM Pacific on base `25f34a45` too, when the shown wait crosses midnight.)
- `node --test viewer/test/*.test.js`: `# tests 955`, `# pass 953`, `# fail 2` — `app-harnesses.test.js:311` and `app-quiet.test.js` "6 message clears debt", both failing on base too.

### Remediation 3 (after verification attempt 3 at `f140fe7c`)

Attempt 3: both verifiers FAIL (`REMEDIATION-3.md`). One rare path (`--archived` as a press value) went to Accepted Risks. The lead deferred J4, J5, J6 (PLAN.md Deferred 7-9). J1 (phone button placement) had survived two fix attempts (R3, R4) and went to the user, who chose option (a): make room for the button.

| Gap | Fix | Task | Evidence |
|---|---|---|---|
| J1 button covers the newest message on phone thread pages | phone thread pages reserve 70px under `#chat` while the button exists; the button is 46px high and sits 12px above the composer (`viewer/pages/assistant-popup.css`) | R6 | `viewer/test/app-assistant-phone.spec.js`: no overlap with any `#chat` element or `#composer` at 390x844 for a one-message thread (before and after a reply) and a 30-message thread; desktop and off unchanged |
| J3 Send before the first chat load | Send starts disabled until the first render applies the live-lead rule; the draft is kept (`viewer/pages/assistant-popup.js`) | R5 | `viewer/test/app-assistant-popup.spec.js` held-first-response test |
| J7 Firefox `app-threads.spec.js` card test | no change: 1 failure in 24 runs on the feature branch and 1 in 24 on base `25f34a45` | R5 | PLAN.md Log 2026-11-24 |

Validation at `3e6a9f5b`:
- `TZ=UTC npm --prefix viewer run test:browser`: `1 failed` (`[firefox] app-threads.spec.js:555:5`, the J7 flake that fails on base too), `34 skipped`, `1479 passed (21.9m)`.
- `node --test viewer/test/*.test.js`: `# tests 955`, `# pass 954`, `# fail 1` — `app-harnesses.test.js:311` (pre-existing).

### Remediation 4 (after verification attempt 4 at `f82e1b31`)

Attempt 4: both verifiers FAIL (`REMEDIATION-4.md`). The lead declined K5: on a short thread the closed button sits higher than in `mockup-closed-phone` because it follows the composer, which is the user's make-room choice working as chosen.

| Gap | Fix | Task | Evidence |
|---|---|---|---|
| K1 assistant button covers "Jump to the latest message" on phone | while the jump button shows, the assistant button sits 12px above it (`viewer/pages/assistant-popup.js`) | R7 | `viewer/test/app-assistant-phone.spec.js`: 80-message thread scrolled to the top, `elementFromPoint` at the jump button's centre is the jump button |
| K2 no Restart after a failed first start | the assistant thread shows its Restart box whenever no lead is live, even with no sessions (`viewer/pages/thread.js` `renderDead`); the hub restart route already starts a lead with the fresh context | R7 | `viewer/test/assistant.test.js` failed-preflight then `POST /restart`; `app-assistant.spec.js` "assistant with no sessions offers restart" |
| K3 Check card omits "by your assistant" | the answered tag shows on Check cards answered by the assistant (`viewer/pages/thread.js:1347`, scoped by the sub-lead so normal threads are unchanged) | R7 | `app-assistant.spec.js` "answered Check card attributes the assistant"; `app-check-card.spec.js` unchanged and passing |
| K4 double send from the pop-up | a `sending` flag keeps Send disabled through a send | R7 | `app-assistant-popup.spec.js` held-POST test |

Validation at `fc8f4525`:
- `TZ=UTC npm --prefix viewer run test:browser`: `34 skipped`, `1488 passed (18.7m)`, exit 0.
- `node --test viewer/test/*.test.js` (run alone; a run alongside the browser suite stalled after 231 tests and timed out): `# tests 956`, `# pass 955`, `# fail 1` — `app-harnesses.test.js:311` (pre-existing).

### Remediation 5 (after verification attempt 5 at `0813d854`)

Attempt 5: Claude verifier PASS (no gaps), GPT verifier FAIL (`REMEDIATION-5.md`). One rare path (assistant restart of an imported thread before its import context) went to Accepted Risks. The lead declined L4 (the unread dot counts only what the user did not write).

| Gap | Fix | Task | Evidence |
|---|---|---|---|
| L2 Settings shows Off after a failed first start; Off does nothing | the save answers 200 with the saved preferences and `assistant_error`; Settings shows On with the error, so Off sends the save (`viewer/app/routes.js`, `viewer/app/assistant.js`, `viewer/pages/settings.js`) | R8 | `viewer/test/assistant.test.js`; `viewer/test/app-assistant.spec.js` failed-start Settings test |
| L1 second draft wiped by the first send | the box clears only if it still holds the sent draft (`viewer/pages/assistant-popup.js`) | R8 | `app-assistant-popup.spec.js` held-POST draft test |
| L5 "No threads yet" beside the pinned row | empty message hidden while the assistant row shows (`viewer/pages/threads.js`) | R8 | `app-assistant.spec.js` |

Validation at `68dbb6e2`:
- `TZ=UTC npm --prefix viewer run test:browser`: `34 skipped`, `1494 passed (19.0m)`, exit 0.
- `node --test viewer/test/*.test.js`: `tests 956`, `pass 955`, `fail 1` — `app-harnesses.test.js:311` (pre-existing). One earlier run of the same command stalled without a summary and was stopped; a stall like this was also seen before the page and remediation work, so it is not attributed to a specific change.
