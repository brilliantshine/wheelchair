# Remediation 3 — personal-assistant

Verification attempt 3 at `f140fe7c`: both verifiers FAIL. One rare path (`--archived` as a press value) went to Accepted Risks (`verification-3`). The lead's answers: J1 (phone button placement) survived two fix attempts (R3, R4) and is with the user; J3 fix; J7 repeat check and fix if this build made it worse; J4, J5, J6 deferred (PLAN.md Deferred 7-9, commit `77d4e072`).

## Gap list (verbatim)

From `wc-eec6963c41b4-verifier-5` (Claude):
- GAP: §5 closed button / `mockup-closed-phone` (R4's H1 fix) — On a 390×844 project thread page, the closed "✦ Assistant" button now covers the newest chat item. R4 places it 12 px above the composer (`viewer/pages/assistant-popup.js:60-63`), which is exactly where the last message sits. On a thread whose only message is the user's "Go ahead", the button (box 265,361–374,406) covers that bubble entirely (287,357–378,403), even scrolled to the end. On a 30-message thread it covers the right end of the last row. (J1 — survived two fix attempts; with the user)

From `wc-eec6963c41b4-verifier-6` (GPT):
- GAP: §3, `press` — The CLI strips a valid `--archived` answer. Picking it queued `picked: undefined`, and submitting it as a typed answer returned `a typed answer needs text`. — `viewer/app/wc.js:102`. (rare path, Accepted Risks)
- GAP: §5, pop-up composer — Send is enabled while the first chat request is pending. Clicking it raises a JavaScript error and sends no request. The same draft sends after chat loads. — `viewer/pages/assistant-popup.js:52`, `:339`. (J3, fix)
- GAP: §5, unread dot — A new tool step or peer activity line leaves the closed button’s dot clear. — `viewer/pages/assistant-popup.js:86`. (J4, deferred)
- GAP: Closed pop-up mockups — The floating button measures about 109 px wide on both viewports. The mockups show about 129 px. (J5, deferred)
- GAP: Assistant thread mockups — Desktop conversation width is 820 px against 772 px in the mockup. Both viewports use 18 px between conversation entries against 14 px in the mockups. — `viewer/pages/thread.css:73–74`. (J6, deferred)
- GAP: Browser validation — The Firefox desktop card test timed out waiting for a press in the full run and in one of three focused repeats. The focused failure occurred at the pinned idea’s Remove button. Base `25f34a45` passed all nine repeats. — `viewer/test/app-threads.spec.js:461`, `:550`. (J7, check)

## Tasks

| Gap | Task |
|---|---|
| J3, J7 | R5 |
| J1 | R6 — the user chose option (a): reserve space under the conversation so the button floats over empty space |

---

# R5 — Pop-up early Send, and a Firefox threads-test flake check (plan `personal-assistant`, remediation 3, task R5)

Read `docs/plans/personal-assistant/REMEDIATION-3.md` (gap list) and Spec §5 in `PLAN.md`. Two parts, in this order.

## Part 1 — J3: Send before the first chat load
In the pop-up, the Send button is enabled while the first `GET /threads/<assistant>/chat` is still pending; clicking it throws a JavaScript error (the submit handler reads `data.items` while `data` is null) and sends nothing (`viewer/pages/assistant-popup.js:52`, `:339`). Start Send (and Enter-to-send) disabled until the first chat response has arrived, then follow the existing live-lead rule. The draft must never be lost. Test in `viewer/test/app-assistant-popup.spec.js`: delay the first chat response (route the request and hold it), type and try to send, assert no page error and no `/messages` request, then release the response and assert the same draft sends. It must fail on the current code.

## Part 2 — J7: is `viewer/test/app-threads.spec.js` flakier because of this build?
A verifier saw the Firefox card test (`viewer/test/app-threads.spec.js:461` and `:550`, the pinned idea's Remove button) time out in its full run and in 1 of 3 focused repeats on the feature branch, while base `25f34a45` (the canonical clone at `/home/collin/projects/personal/wheelchair`, read-only for you: run tests there, never edit it) passed 9 of 9. The sub-lead's 5 repeats on the feature branch all passed.
1. Measure: run `cd viewer && npx playwright test test/app-threads.spec.js --project=firefox --reporter=line` 15 times on your branch and 15 times in the canonical clone's `viewer/`, with load (for example, run the two loops at the same time, or alongside `node --test viewer/test/*.test.js`). Paste each run's summary line and the failing test names.
2. If the feature fails clearly more often than base, find the cause in this build's changes (`git diff 25f34a45 HEAD -- viewer/pages viewer/app`; the likely suspects are things that run on every page: `viewer/pages/nav.js` re-checking `GET /api/assistant` every 30 s, `viewer/pages/threads.js` loading `views.css` and the preview fetch, the thread-page changes in `viewer/pages/thread.js`), and fix it in the product (not by loosening the test). If the rates are the same, report that with the numbers and change nothing.

## Ownership boundary
`viewer/pages/assistant-popup.js`, `viewer/test/app-assistant-popup.spec.js`; for Part 2's fix only, `viewer/pages/nav.js`, `viewer/pages/threads.js`, `viewer/pages/thread.js` (say exactly what and why). Nothing in `viewer/app/`. Never edit the canonical clone.

## Validation
```bash
cd viewer && for i in 1 2 3; do npx playwright test test/app-assistant-popup.spec.js --reporter=line 2>&1 | tail -1; done
cd viewer && npx playwright test test/app-assistant.spec.js test/app-send-now.spec.js test/app-threads.spec.js
```
Report Part 2's 15+15 numbers whatever the outcome.

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

# R6 — Make room for the pop-up button on phone thread pages (plan `personal-assistant`, remediation 3, task R6)

Read `docs/plans/personal-assistant/REMEDIATION-3.md` (gap J1) and the mockup `docs/plans/personal-assistant/graphs/mockup-closed-phone.html` (390x844).

## The problem
On phone thread pages (width under 900px) the closed "✦ Assistant" button has no empty space to float over. `viewer/pages/assistant-popup.js:60-63` (R4) places it 12px above the measured composer, which is exactly where the newest chat message sits: on a one-message thread it hides that message completely until the lead replies; on long threads it covers the end of the last row. Two earlier fixes failed; this one follows **the user's choice**, option (a): **make room for it.**

## What to build
On phone thread pages, while the pop-up button exists, reserve bottom space under the conversation (`#chat`, `viewer/pages/thread.html:41`) equal to the button's height plus a gap above and below it, so that at the end of the conversation the button floats over that empty space, above the composer, as in `mockup-closed-phone.html`. Keep R4's measured placement (the button sits 12px above the composer); the reserved space must be at least `button height + 24px` so the last message ends above the button. Do it in `viewer/pages/assistant-popup.css`, scoped so it only applies under 900px, only on thread pages (`.shell.on-thread`), and only while the button is on the page (e.g. `html:has(.wc-asst-float) .shell.on-thread #chat { padding-bottom: … }`); nothing changes at 900px and wider, on other pages, or with the assistant off. If CSS alone can't express it (for example, the button height must be measured), set a CSS variable from `assistant-popup.js` instead, and say so — but `assistant-popup.js` is also being edited by another worker (R5, early Send), so prefer CSS and touch the JS only for that variable.

## Tests (new file `viewer/test/app-assistant-phone.spec.js`, Playwright, isolated server like the other specs)
At 390x844, with the assistant on, scrolled to the end of the conversation, the button's bounding box overlaps **no** element in `#chat` and not `#composer`:
- a project thread with one user message (the verifier's case: "Go ahead");
- a project thread with 30 messages;
- the one-message thread after a lead reply arrives (the next poll).
Also: at 1280x800 the `#chat` padding is unchanged from the assistant-off value; with the assistant off, the phone padding is unchanged. The one-message case must fail on the current code.

## Screenshots
At 390x844: the one-message thread and the 30-message thread, closed button visible; name each path and `mockup-closed-phone.html` in your report.

## Ownership boundary
`viewer/pages/assistant-popup.css`, new `viewer/test/app-assistant-phone.spec.js`; `viewer/pages/assistant-popup.js` only for a CSS variable if CSS alone cannot do it.

## Validation
```bash
cd viewer && for i in 1 2 3; do npx playwright test test/app-assistant-phone.spec.js --reporter=line 2>&1 | tail -1; done
cd viewer && npx playwright test test/app-assistant-popup.spec.js test/app-assistant.spec.js test/app-threads.spec.js test/app-send-now.spec.js
```

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
