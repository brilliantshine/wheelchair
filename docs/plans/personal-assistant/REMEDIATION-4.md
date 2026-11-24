# Remediation 4 — personal-assistant

Verification attempt 4 at `f82e1b31`: both verifiers FAIL. 6 gap lines merge into 5 gaps (K1-K5), no rare paths. The lead's answers: fix K1 (lift the assistant button above the jump button while it shows; do not hide it), K2, K3, K4; decline K5 (the user's 'make room' choice working as chosen; Log only).

## Gap list (verbatim)

From `wc-eec6963c41b4-verifier-7` (Claude):
- GAP: §5 closed button on phone thread pages — with the assistant on, the thread page's own "jump to latest message" button is fully hidden under the "✦ Assistant" button at 390×844 ... On a project thread with 80 messages scrolled to the top, the jump button is at (326,681)–(366,721) and the assistant button covers it at (265,674)–(374,720) ... the jump button is placed in `viewer/pages/thread.css:213` (`right: 24px; top: -52px` from the composer), and the assistant button 12 px above the composer in `viewer/pages/assistant-popup.js:60-63`, with `z-index: 40` in `viewer/pages/assistant-popup.css:2`. (K1)

From `wc-eec6963c41b4-verifier-8` (GPT):
- GAP: §2, assistant thread Restart — A failed first Codex preflight leaves the assistant enabled with zero sessions and no Restart control on its thread page — reproduced with HTTP 409 in the isolated browser. `viewer/app/sessions.js:312–314` records the preflight failure before creating a session, and `viewer/pages/thread.js:569` requires a session before showing Restart. (K2)
- GAP: §4, card press attribution — An answered Check card omits “by your assistant” — an assistant “Leave it” press succeeded and saved `answered_by: "assistant"`, but `viewer/pages/thread.js:1347` skips the attribution tag for Check cards. (K3)
- GAP: §5, pop-up composer — A chat poll re-enables Send while the previous send is in flight — holding the first POST across a poll let a second click queue the identical draft twice. `viewer/pages/assistant-popup.js:272` overrides the disabled state set at `:337`. (K4)
- GAP: §5, phone thread controls — The closed Assistant button covers “Jump to the latest message” when Collin scrolls back in a long thread — tapping the center of the jump control opened the assistant in Chromium and Firefox at 390×844. (K1, same as above)
- GAP: §5, `mockup-closed-phone` — On a one-message thread, the closed button sits 276 px above its mockup position, leaving 243 px below the composer — the built button starts at y=430 and the mockup button at y=706. (K5, declined: the user's make-room choice)

## Tasks

| Gap | Task |
|---|---|
| K1, K2, K3, K4 | R7 |
| K5 | declined (PLAN.md Log) |

---

# R7 — Fixes from verification 4 (plan `personal-assistant`, remediation 4, task R7)

Read `docs/plans/personal-assistant/REMEDIATION-4.md` (gap list) and Spec §2, §4, §5 in `PLAN.md`. Four fixes, as the lead decided.

## K1 — the assistant button covers "Jump to the latest message" on phone thread pages
At 390x844 on a long project thread scrolled back more than two screens, the thread page shows its jump button (`viewer/pages/thread.css:213-215`: `right: 24px`, 52px above the composer). The assistant button (`viewer/pages/assistant-popup.js:60-63`, 12px above the composer, `z-index: 40`) sits exactly on it, so tapping the jump button opens the assistant. **While the jump button is showing, lift the assistant button above it** (do not hide the assistant button): bottom offset = the jump button's measured top distance from the viewport bottom + 12px, recomputed when the jump button appears or disappears (observe its visibility: a `MutationObserver` on its `hidden`/class, or check it in the existing `positionButton` scheduling) and on the existing triggers. When the jump button is hidden, keep today's placement. Keep the reserved space under `#chat` (R6) as is. Test (`viewer/test/app-assistant-phone.spec.js`): 80-message thread, scroll to the top, the jump button is visible and `document.elementFromPoint` at its centre is the jump button (not the assistant button), and the two boxes do not overlap; tapping it scrolls to the latest message; scrolled to the end, the R6 no-overlap checks still pass. Chromium and Firefox.

## K2 — no Restart after a failed first start
If the assistant's first lead start fails a CLI preflight (for example HTTP 409 when Codex is not signed in), `viewer/app/sessions.js:312-314` records the failure before any session exists, and the thread page shows Restart only when a session exists (`viewer/pages/thread.js:569`), so the assistant is on with no way to start it except turning it off and on. Make the assistant thread show its Restart action whenever no lead is live, sessions or not, and make sure the hub's restart route actually starts a lead for an assistant thread with no sessions (check `restartLead` in `viewer/app/threads.js`; it must not require an earlier session for the assistant thread and must still use the fresh-start context from Spec §2). The pop-up's "The assistant isn't running" Restart must work in the same state. Tests: a unit test (`viewer/test/assistant.test.js`) where the first start fails preflight and `POST /threads/<assistant>/restart` then starts a lead with `prompt_role: "assistant"` and the fresh context; a browser test that the Restart control shows on the assistant thread page with zero sessions.

## K3 — Check cards omit "by your assistant"
`viewer/pages/thread.js:1347` skips the attribution tag for Check cards. When a Check card has `answered_by: "assistant"`, show "by your assistant" like other answered cards. Test in `viewer/test/app-assistant.spec.js`.

## K4 — double send from the pop-up
A chat poll re-enables Send while a send is in flight (`viewer/pages/assistant-popup.js:272` overrides `:337`), so a second click queues the same draft twice. Keep Send disabled while a send is in flight (a `sending` flag the render respects). Test in `viewer/test/app-assistant-popup.spec.js`: hold the first POST across a poll, click Send again, assert exactly one `/messages` request.

## Ownership boundary
`viewer/pages/assistant-popup.js`, `assistant-popup.css`, `viewer/pages/thread.js` (Restart condition, Check card tag), `viewer/app/threads.js` and `viewer/app/sessions.js` (K2 only), `viewer/test/assistant.test.js`, `app-assistant.spec.js`, `app-assistant-popup.spec.js`, `app-assistant-phone.spec.js`. Normal threads must behave exactly as before.

## Validation
```bash
node --test viewer/test/assistant.test.js
cd viewer && for i in 1 2 3; do npx playwright test test/app-assistant-phone.spec.js test/app-assistant-popup.spec.js --reporter=line 2>&1 | tail -1; done
cd viewer && npx playwright test test/app-assistant.spec.js test/app-threads.spec.js test/app-send-now.spec.js
```
Known flakes that also happen on base: Firefox `app-threads.spec.js:555` (about 1 in 24), `app-send-now.spec.js:84`, port clashes that pass alone.

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
