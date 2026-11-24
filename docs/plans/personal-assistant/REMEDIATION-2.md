# Remediation 2 — personal-assistant

Verification attempt 2 at `db9d1081`: Claude verifier PASS; GPT verifier FAIL with 8 gap lines. One rare path (an assistant `lesson` card) went to Accepted Risks (`verification-2`). The lead's answers: fix H1, H3, H4; defer H2, H5, H6, H7 (PLAN.md Deferred 3-6, source verification, commit `e33d07f7`).

## Gap list (verbatim, from `wc-eec6963c41b4-verifier-4`)

- GAP: §3, recent conversation — `assistant thread` returns chat from before an Advance cutoff. In an isolated test, it returned both the old and current replies, while the thread page showed only the current reply. `viewer/app/assistant-actions.js:38`, `viewer/pages/thread.js:586`. (H5, deferred)
- GAP: §4 and remediation G5, queued press attribution — An accepted assistant press produced zero pending bubbles on the target thread. The hub queues it with `source: 'card'`, the page only renders pending entries with `source: 'user'`, and the regression test seeds the press as `source: 'user'`. `viewer/app/threads.js:455`, `viewer/pages/thread.js:702`, `viewer/test/app-assistant.spec.js:208`. (H2, deferred)
- GAP: §5, opt-in visibility — Turning the assistant on leaves the button absent in an already-open project tab until reload. Turning it off and back on reproduces the same failure. The nav checks the setting once and the pop-up stops polling when it is turned off. `viewer/pages/nav.js:170–184`, `viewer/pages/assistant-popup.js:267–271`. (H3, fix)
- GAP: §5, unread dot — A new restart context line appears in the pop-up but leaves its closed button without an unread dot. Reproduced with the restart line as the sole new item. `viewer/pages/assistant-popup.js:67–71`. (H4, fix)
- GAP: §7, permitted card kinds — The assistant can submit a `lesson` card outside its six permitted kinds. The hub applies the normal lead permission and persists the lesson in Settings. `protocol/app/assistant.md:28`, `viewer/app/card.js:32`, `viewer/app/cards.js:61–79`. (rare path, Accepted Risks)
- GAP: Closed pop-up phone mockup and remediation G8 — At 390×844 on a short project thread, the button overlaps the top of the composer by 15.9 CSS pixels. The built button ends at y=720 and the composer starts at y=704.1. (H1, fix — second attempt on G8)
- GAP: Assistant thread mockups — The composer is 70 px high on phone and 74.6 px on desktop against 58.3 px in both mockups. The desktop page also adds a list-collapse button. (H6, deferred)
- GAP: Threads list mockups — The pinned row’s dot turns amber when the row shows “1 needs you”. Both mockups show a blue dot beside the amber badge in that state. `viewer/pages/threads.js:92`. (H7, deferred)

## Tasks

| Gap | Task |
|---|---|
| H1, H3, H4 | R4 |

---

# R4 — Pop-up button placement, turning on in an open tab, restart lines unread (plan `personal-assistant`, remediation 2, task R4)

Read `docs/plans/personal-assistant/REMEDIATION-2.md` (gap list) and Spec §5 in `PLAN.md`. Three fixes in the pop-up, all in normal use.

## H1 — the closed button must never cover a thread page's composer (second fix attempt for this gap)
At 390x844 on a **short** project thread the closed button still covers the top of the composer by about 16px (button bottom y=720, composer top y=704). Today `viewer/pages/assistant-popup.css:44` lifts the button by `var(--composer-h, 130px) + 12px`, and nothing sets `--composer-h`, so it is a fixed 130px. That works only when the composer sits at the viewport bottom (long threads). The lead's direction: **measure the composer instead of a fixed lift.**
- In `viewer/pages/assistant-popup.js`, when the page has the thread composer (`#composer`, `viewer/pages/thread.html:46`) and the width is under 900px, place the button from the composer's measured position: its bottom offset = `max(92, window.innerHeight - composer.getBoundingClientRect().top + 12)` px (92 is the mockup's phone offset). Recompute on resize, on scroll, when the composer's size changes (`ResizeObserver`), and after each render of the page content (a `MutationObserver` on the chat container or a cheap `requestAnimationFrame` check — your choice, record it). Remove the `--composer-h` CSS rule. Pages with no composer keep the mockup's `bottom: 92px`; 900px and wider are unchanged.
- Tests (`viewer/test/app-assistant-popup.spec.js`) at 390x844, by bounding boxes, with **no overlap** between the button and `#composer`: a short project thread (one message, composer well above the bottom), a long one (composer at the bottom), and a thread that grows from short to long while open (send messages / seed more items, then re-check after the next poll). Each must fail on the current code where applicable (the short case must).

## H3 — turning the assistant on in an open tab
`viewer/pages/nav.js:170-184` asks `GET /wheelchair/api/assistant` once per page load, so a tab already open never shows the button after the assistant is turned on, nor again after it was turned off and on (the pop-up removes itself and stops polling on "the assistant is off", `assistant-popup.js:267-271`). Re-check `GET /api/assistant` with `window.wcPoller` (every 30 seconds while the tab is visible) whenever the pop-up is not loaded or has removed itself; when it says on, load (or re-create) the pop-up for that thread id. Keep off costing nothing more than that one small request per 30 s. Test: open a project thread page with the assistant off, turn it on through the settings route, the button appears without a reload; then off (it goes) and on again (it comes back).

## H4 — a restart line lights the unread dot
`newestAt` (`assistant-popup.js:67-71`) counts only assistant text and cards, so a new context line (e.g. "Assistant restarted · starting fresh") as the only new item leaves no dot. Count context items too (not the user's own messages). Test: with the dot clear, add only a restart context line to the assistant transcript; the dot appears on the next poll.

## Ownership boundary
`viewer/pages/assistant-popup.js`, `viewer/pages/assistant-popup.css`, `viewer/pages/nav.js`, `viewer/test/app-assistant-popup.spec.js`. Not `thread.js` or `viewer/app/`.

## Screenshots
At 390x844, the closed button on a short project thread and on a long one; name each path and the mockup (`mockup-closed-phone.html`) in your report.

## Validation
```bash
cd viewer && for i in 1 2 3; do npx playwright test test/app-assistant-popup.spec.js --reporter=line 2>&1 | tail -1; done
cd viewer && npx playwright test test/app-assistant.spec.js test/app-send-now.spec.js
npm --prefix viewer run test:browser
```
Run the full browser suite to the end. Known failures that also happen on base: `app-accounts.spec.js` "lead waiting line" tests after 9 PM Pacific (pass with `TZ=UTC`), `app-send-now.spec.js:84` about 1 run in 4, and port clashes that pass alone.

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
