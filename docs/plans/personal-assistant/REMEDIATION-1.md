# Remediation 1 — personal-assistant

Verification attempt 1 at `125ffb25`: both verifiers FAIL. The lead's answer: fix all 11 gaps (G1–G11), defer none. One rare path (a slow remote launch outliving the 120 s relay) went to Accepted Risks with round `verification-1`.

## Gap list (verbatim, merged)

From `wc-eec6963c41b4-verifier-2` (GPT):

- GAP: Boundaries and non-goals — Both assistant read actions expose full aside conversations — `viewer/app/routes.js:540` retains `asides` in the thread summary, and `viewer/app/assistant-actions.js:30,36` returns it. Both responses included a synthetic private aside reply.
- GAP: §1 and §5, opt-in visibility — Turning the assistant off leaves the panel and floating button visible in an already-open tab — `viewer/pages/nav.js:170-184` checks the setting once. An isolated browser showed “the assistant is off” inside the still-open panel, and closing it revealed the button again.
- GAP: §3, thread stage — Assistant reads can report an outdated stage for a local project — `viewer/app/routes.js:524-549` returns the cached stage. The assistant reported `planning` after the plan changed to `implementing`, which `/features` read correctly.
- GAP: §3, recent conversation — Tool entries consume the 30-item limit and can push out the user’s instructions — `viewer/app/assistant-actions.js:36` slices before filtering. A fixture with 31 tool entries returned 29 tool entries and one reply, omitting the user’s message.
- GAP: Check once built #1 — Rare path: a slow remote launch can finish after `start` or `restart` has already reported “hub unavailable” — `viewer/app/sessions.js:228-234` gives the launch two 60-second attempts, while `machine/service.js:2306` gives the whole relay 120 seconds. (Judged rare; Accepted Risks.)
- GAP: §4, message attribution — A queued assistant message shows the raw `[wc:assistant]` marker. Using Send now leaves a second bubble after the attributed message arrives — `viewer/pages/thread.js:618-622,691-708,759-771` matches pending entries by the prefixed text, while the transcript removes the prefix.
- GAP: §5, shared conversation — The pop-up omits context and card-press bubbles, and its question cards omit option consequences and the inline free-text answer — `viewer/pages/assistant-popup.js:98-106,126-135`.
- GAP: §6, pinned preview — A reply with a Markdown link displays the raw link syntax and wraps to three lines — `viewer/pages/threads.js:185-190` and `viewer/pages/app.css:148`.
- GAP: Assistant thread mockups, phone and desktop — The built page adds an “Open in terminal” control and an attachment button. The desktop layout also reserves an empty right column that narrows the conversation.
- GAP: Closed pop-up mockup, phone — The floating button overlaps the project composer by about 45 CSS pixels at 390×844.
- GAP: Validation — The assistant route guard breaks two existing viewer tests by requiring `hub.threadSnapshot` on fixtures that supply only `hub.thread` — `viewer/app/assistant.js:14`, `viewer/test/app-hub.test.js:2046`, and `viewer/test/app-session-meta.test.js:89`.

From `wc-eec6963c41b4-verifier` (Claude):

- GAP: Validation (`node --test viewer/test/*.test.js`) — T8 broke two existing unit tests ... `TypeError: hub.threadSnapshot is not a function` at `viewer/app/assistant.js:14` ← `viewer/app/routes.js:47`. (Same as the GPT validation gap.)
- GAP: Spec mockup `mockup-thread-{desktop,phone}` — the built assistant page has an "Open in terminal" button ... an empty right-hand files column (960–1280px, with a » toggle) that narrows the chat. (Same as the GPT mockup gap.)
- GAP: §5 unread dot — a card seen on the assistant thread page does not clear the dot. The thread page's `rememberSeen` (`viewer/pages/thread.js:204-211`) records only the newest chat item's `at`. The pop-up counts cards as unread (`viewer/pages/assistant-popup.js:374-379`).

## Merged gaps and tasks

| Gap | Summary | Task |
|---|---|---|
| G1 | Guard's `threadSnapshot` breaks two existing tests | R1 |
| G2 | Assistant reads expose asides | R1 |
| G3 | Stale stage in `threads`/`thread` (use `/features`' fresh source) | R1 |
| G4 | `recent` slices before filtering | R1 |
| G5 | Queued assistant message shows raw marker; Send now duplicate | R2 |
| G6 | Pop-up is not the same conversation (reuse thread page rendering) | R3 |
| G7 | Assistant page: terminal, attach, files column vs mockup | R2 |
| G8 | Closed button overlaps composer on phone | R3 |
| G9 | Off leaves the pop-up in an open tab | R3 |
| G10 | Preview raw link syntax, wraps past one line | R2 |
| G11 | Card seen on the assistant page leaves the unread dot | R2 |

R1 and R2 run in parallel (disjoint files); R3 runs after R2 because it extracts rendering from `viewer/pages/thread.js`. Each brief follows.


---

# R1 — Hub fixes from verification 1 (plan `personal-assistant`, remediation 1, task R1)

Read `docs/plans/personal-assistant/REMEDIATION-1.md` (gap list verbatim) and the Spec §3 in `PLAN.md`. Fix gaps G1–G4, all in the hub.

## G1 — two existing unit tests broken
`viewer/app/assistant.js` `guard` (called from `viewer/app/routes.js:47` on every `/threads/<id>` route) calls `hub.threadSnapshot`, which the fake hubs in `viewer/test/app-hub.test.js:2046` and `viewer/test/app-session-meta.test.js:89` do not have (`TypeError: hub.threadSnapshot is not a function`). Keep the guard read-only (it must never save outside the thread's lock — see the test at the end of `viewer/test/assistant.test.js`) and make both tests pass. Prefer giving those two fakes a `threadSnapshot` (the same way T1 added `thread` to them) over weakening the guard; record which you chose.

## G2 — the assistant sees asides
Spec boundary: "The assistant does not see aside conversations". `threads` and `thread` (`viewer/app/assistant-actions.js:30,36`) return each thread's `asides` because the reused Threads list summary (`viewer/app/routes.js` `listThreads`, ~`:540`) keeps them. Strip asides (and any aside history or aside-derived fields such as aside `graphs`) from everything the assistant actions return, including `thread`'s `recent` and `cards`. Do not change what the browser routes return. Test: seed a thread with an aside containing a unique string; neither action's JSON contains it.

## G3 — stale stage
`threads`/`thread` can report a stale cached stage (verifier: `planning` after the plan moved to `implementing`, while `/features` was right). Make the assistant actions use the same fresh stage source `/features` uses (`viewer/app/views.js`), as the lead directed. Do not change the Threads list route's own behaviour. Test: change a local thread's plan status after a first read; the next `threads` and `thread` report the new stage, matching `/features`.

## G4 — `recent` loses the user's messages
`thread`'s `recent` slices the last 30 chat items before filtering (`assistant-actions.js:36`), so tool entries push out user messages. Spec: "the last 30 chat items: the user's bubbles, lead replies and context lines, as the thread page shows them". Filter to those kinds first, then take the last 30. Test: 31 tool entries after a user message and a reply → `recent` contains the user message and the reply and no tool entries.

## Ownership boundary
`viewer/app/**`, `viewer/test/assistant.test.js`, and the two fakes in `viewer/test/app-hub.test.js` and `viewer/test/app-session-meta.test.js`. Not `viewer/pages/` (other tasks are editing pages now).

## Validation
```bash
node --test viewer/test/assistant.test.js viewer/test/app-hub.test.js viewer/test/app-session-meta.test.js
node --test viewer/test/*.test.js
```
Known, not yours: `viewer/test/app-harnesses.test.js:311` (pre-existing), and `app-quiet.test.js` / `run.test.js` failures that pass when run alone (load).

## Rules for every task in this build

- Plan: `docs/plans/personal-assistant/PLAN.md` (read the Spec sections named above, plus `IDEA.md` beside it). The lead's session is `wc-eec6963c41b4-lead`; send it a `message` card (with `asks: true`) if the plan leaves something you cannot settle.
- Never delete files: no `rm`, no `git rm`, no `git clean`. If something should go, say so in your report.
- Never run `./install.sh` from this worktree. Never start the viewer by hand: tests start their own isolated server with `--port` and `--cache-root` as in `viewer/test/helpers/server.js:72`.
- Stay inside your ownership boundary. If a change outside it is unavoidable, stop and message the lead instead of making it.
- If the same validation gate fails twice for the same reason, stop and report rather than iterating. Known pre-existing failure on the feature branch, not yours to fix: `viewer/test/app-harnesses.test.js:311` ("switching a harness off cancels its install ... without waiting", a wall-clock < 1000 ms check). Report it as pre-existing; it does not count as your gate failing.
- Your own `wc.js` and `card.js` calls are always allowed. Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <exact paths>`.
- Every test you add must fail when the behaviour it covers breaks: seed a starting state that differs from the result you assert, break the code once, watch the test fail, restore it.
- When you shorten timers around spawned processes in tests, give each wait at least a second.
- Write your report to `docs/plans/personal-assistant/reports/<task id>.md` and commit it: what you built with `file:line` references, the **pasted output** of every validation command (the tail with pass/fail counts is enough), and the closing section below. Then post your `result` card.
- Closing request: List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.


---

# R2 — Assistant thread page and Threads list fixes from verification 1 (plan `personal-assistant`, remediation 1, task R2)

Read `docs/plans/personal-assistant/REMEDIATION-1.md` (gap list verbatim), Spec §2 "Thread page", §4, §5 unread dot and §6 in `PLAN.md`, and the mockups `docs/plans/personal-assistant/graphs/mockup-thread-{phone,desktop}.html` (390x844, 1280x800; same responsive HTML) and `mockup-threads-{phone,desktop}.html`. Fix G5, G7, G10, G11.

## G5 — queued assistant messages (all threads)
A message the assistant queued for a lead shows the raw `[wc:assistant]` marker in the thread page's pending/queued bubble, and after Send now a second bubble remains once the attributed message is delivered, because pending entries are matched by the prefixed text while the transcript item has the prefix removed (`viewer/pages/thread.js:618-622, 691-708, 759-771`). Make a pending entry whose text starts `[wc:assistant] ` display without the marker, with the "From your assistant" label, and match it against delivered items by the unprefixed text, so exactly one bubble remains after delivery. A pending `[wc:assistant] [card …]` press should show as "Your assistant: …" like the delivered one. Test it (browser spec, seeding a queue entry through the real hub).

## G7 — assistant thread page vs mockup
On the assistant thread only (other threads unchanged), hide: the "Open in terminal" control (`thread.js:95-99`), the composer's attach button (and its file input/drop handling), and the right-hand files column with its » toggle, so the chat takes the full width as in `mockup-thread-desktop.html` and the phone header is one row as in `mockup-thread-phone.html`. Also set the composer's screen-reader label (`viewer/pages/thread.html`) to "Message the assistant" on the assistant thread. Test that these are absent on the assistant page and present on a project thread.

## G10 — pinned-row preview
The preview shows raw Markdown link syntax and wraps to three lines (`viewer/pages/threads.js:185-190`, `viewer/pages/app.css:148`). Show a link's text only (`[text](url)` → `text`), and keep the preview to one line with an ellipsis (CSS on the assistant row's preview class in `views.css` or `thread.css`, not `app.css`). Test both.

## G11 — unread dot after viewing a card
`rememberSeen` (`viewer/pages/thread.js:204-211`) records only chat items' `at`, while the pop-up also counts cards as unread. Record the newest of chat items and the cards shown (use the same timestamp field the pop-up uses for cards in `viewer/pages/assistant-popup.js` — read it, do not edit that file). Test: a card newer than the last reply, viewed on the assistant page, leaves no dot on the next page.

## Ownership boundary
`viewer/pages/thread.js`, `thread.html`, `thread.css`, `threads.js`, `views.css`, `viewer/test/app-assistant.spec.js`. Not `nav.js`, `assistant-popup.*`, `app.css`, `viewer/app/`.

## Screenshots
With the final code, screenshot the assistant thread page at 390x844 and 1280x800 and the Threads list at both sizes; name each path and its mockup in your report and list remaining differences.

## Validation
```bash
cd viewer && npx playwright test test/app-assistant.spec.js test/app-assistant-popup.spec.js test/app-send-now.spec.js
npm --prefix viewer run test:browser
```
Known pre-existing flake: `app-send-now.spec.js:84` (Enter sends) fails about 1 run in 4 on the base commit too. Port-clash failures that pass alone are load.

## Rules for every task in this build

- Plan: `docs/plans/personal-assistant/PLAN.md` (read the Spec sections named above, plus `IDEA.md` beside it). The lead's session is `wc-eec6963c41b4-lead`; send it a `message` card (with `asks: true`) if the plan leaves something you cannot settle.
- Never delete files: no `rm`, no `git rm`, no `git clean`. If something should go, say so in your report.
- Never run `./install.sh` from this worktree. Never start the viewer by hand: tests start their own isolated server with `--port` and `--cache-root` as in `viewer/test/helpers/server.js:72`.
- Stay inside your ownership boundary. If a change outside it is unavoidable, stop and message the lead instead of making it.
- If the same validation gate fails twice for the same reason, stop and report rather than iterating. Known pre-existing failure on the feature branch, not yours to fix: `viewer/test/app-harnesses.test.js:311` ("switching a harness off cancels its install ... without waiting", a wall-clock < 1000 ms check). Report it as pre-existing; it does not count as your gate failing.
- Your own `wc.js` and `card.js` calls are always allowed. Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <exact paths>`.
- Every test you add must fail when the behaviour it covers breaks: seed a starting state that differs from the result you assert, break the code once, watch the test fail, restore it.
- When you shorten timers around spawned processes in tests, give each wait at least a second.
- Write your report to `docs/plans/personal-assistant/reports/<task id>.md` and commit it: what you built with `file:line` references, the **pasted output** of every validation command (the tail with pass/fail counts is enough), and the closing section below. Then post your `result` card.
- Closing request: List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.


---

# R3 — Pop-up fixes from verification 1 (plan `personal-assistant`, remediation 1, task R3)

Read `docs/plans/personal-assistant/REMEDIATION-1.md` (gap list verbatim), Spec §5 in `PLAN.md`, and mockups `docs/plans/personal-assistant/graphs/mockup-{closed,popup,thinking}-{phone,desktop}.html`. R2 (merged before you start) changed `viewer/pages/thread.js`; read `docs/plans/personal-assistant/reports/R2.md`. Fix G6, G8, G9.

## G6 — the pop-up must show the same conversation as the thread page
Spec §5: the panel shows "the assistant conversation (same chat items and cards as the thread page...)". Today `viewer/pages/assistant-popup.js` (~`:98-106`, `:126-135`) has its own simplified renderer: no context lines, no press bubbles, question cards without option consequences or the inline free-text answer, needs cards only as links. The lead's direction: render the same chat items and cards as the thread page, **reusing the thread page's rendering rather than a second renderer if practical**. Do that by extracting the item and card rendering from `viewer/pages/thread.js` into a shared page module (e.g. `viewer/pages/chat-render.js`) that both `thread.js` and the pop-up use, with the thread page's behaviour unchanged; card presses and free-text answers post to the same routes. If extraction is impractical for a specific piece, say exactly which and why in your report. The mockup's compact panel styling still applies.

## G8 — phone overlap
At 390x844 the closed button overlaps a project thread's composer by about 45px; the mockup (`mockup-closed-phone.html`, `.float{right:16px;bottom:92px}` under 900px) leaves a gap. Position the button so it never covers the composer on thread pages at phone widths (match the mockup's offset, or lift it above the composer when one is present). Test with bounding boxes at 390x844 on a project thread page.

## G9 — turning off while a tab is open
`viewer/pages/nav.js` checks `GET /api/assistant` once per load, so a tab already open keeps the button and panel after the assistant is turned off (the panel then shows "the assistant is off"). When a pop-up poll gets the 404 "the assistant is off" (or a periodic re-check says off), remove the button and panel. Test: open a page with it on, turn it off through the settings route, the button disappears without a reload.

## Ownership boundary
`viewer/pages/nav.js`, `viewer/pages/assistant-popup.js`, `assistant-popup.css`, `viewer/pages/thread.js` (only to extract shared rendering), a new shared rendering module under `viewer/pages/` (and the `<script>` tags that load it in `thread.html`), `viewer/AGENTS.md` (pages lines), `viewer/test/app-assistant-popup.spec.js`. Not `viewer/app/`.

## Screenshots
With the final code, screenshot closed, popup (with a question card and a context line) and thinking at 390x844 and 1280x800; name each path and its mockup in your report.

## Validation
```bash
cd viewer && npx playwright test test/app-assistant-popup.spec.js test/app-assistant.spec.js
npm --prefix viewer run test:browser
node --test viewer/test/*.test.js
```
The whole browser suite matters here because you touch `thread.js`. Known pre-existing flake: `app-send-now.spec.js:84` fails about 1 run in 4 on the base commit too.

## Rules for every task in this build

- Plan: `docs/plans/personal-assistant/PLAN.md` (read the Spec sections named above, plus `IDEA.md` beside it). The lead's session is `wc-eec6963c41b4-lead`; send it a `message` card (with `asks: true`) if the plan leaves something you cannot settle.
- Never delete files: no `rm`, no `git rm`, no `git clean`. If something should go, say so in your report.
- Never run `./install.sh` from this worktree. Never start the viewer by hand: tests start their own isolated server with `--port` and `--cache-root` as in `viewer/test/helpers/server.js:72`.
- Stay inside your ownership boundary. If a change outside it is unavoidable, stop and message the lead instead of making it.
- If the same validation gate fails twice for the same reason, stop and report rather than iterating. Known pre-existing failure on the feature branch, not yours to fix: `viewer/test/app-harnesses.test.js:311` ("switching a harness off cancels its install ... without waiting", a wall-clock < 1000 ms check). Report it as pre-existing; it does not count as your gate failing.
- Your own `wc.js` and `card.js` calls are always allowed. Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <exact paths>`.
- Every test you add must fail when the behaviour it covers breaks: seed a starting state that differs from the result you assert, break the code once, watch the test fail, restore it.
- When you shorten timers around spawned processes in tests, give each wait at least a second.
- Write your report to `docs/plans/personal-assistant/reports/<task id>.md` and commit it: what you built with `file:line` references, the **pasted output** of every validation command (the tail with pass/fail counts is enough), and the closing section below. Then post your `result` card.
- Closing request: List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.

