# Remediation 5 — personal-assistant

Verification attempt 5 at `0813d854`: Claude verifier PASS (no gaps); GPT verifier FAIL. One rare path (assistant restart of an imported thread before its import context) went to Accepted Risks (`verification-5`). The lead's answers: fix L1, L2 (route reports saved + start error; Settings shows On with the error), L5; decline L4 (by design).

## Gap list (verbatim, from `wc-eec6963c41b4-verifier-10`)

- GAP: §5, pop-up composer — A successful send erases a second draft typed while the first request is in flight — reproduced at 390×844 and 1280×800. The textarea remains editable during the request and is cleared unconditionally on success (`viewer/pages/assistant-popup.js:276,341–345`). (L1, fix)
- GAP: §1, Settings toggle — A failed first start leaves the server set to On while Settings shows Off. Clicking Off in that tab sends no request — reproduced after a Codex preflight returned HTTP 409 (`viewer/app/routes.js:347–417`, `viewer/pages/settings.js:501–511`). (L2, fix)
- GAP: §4, restart attribution — When the assistant restarts an imported thread whose lead has yet to receive its import context, chat shows only “Imported from a handoff” — the restart succeeded and the context carried `by: "assistant"`, but the import renderer ignores it (`viewer/app/threads.js:151–156`, `connectors/hub-common.js:101–109`). (rare path, Accepted Risks)
- GAP: §5, unread dot — A new user message from another browser appears in the conversation without lighting the closed button’s unread dot — reproduced with the user message as the sole new chat item (`viewer/pages/assistant-popup.js:89–103`). (L4, declined: the dot counts only what the user did not write)
- GAP: §6, pinned row — The Threads page says “No threads yet” while showing the pinned Personal assistant thread — reproduced with the assistant as the only thread (`viewer/pages/threads.js:105–114`). (L5, fix)

## Tasks

| Gap | Task |
|---|---|
| L1, L2, L5 | R8 |
| L4 | declined (PLAN.md Log) |

---

# R8 — Fixes from verification 5 (plan `personal-assistant`, remediation 5, task R8)

Read `docs/plans/personal-assistant/REMEDIATION-5.md` (gap list) and Spec §1, §5, §6 in `PLAN.md`. Three fixes, as the lead decided.

## L2 — Settings after a failed first start
If turning the assistant on saves the setting but its first lead start fails (for example a Codex preflight answering HTTP 409), the preferences save route (`viewer/app/routes.js:347-417`, calling `assistant.change`) returns an error, the Settings page (`viewer/pages/settings.js:501-511`) keeps showing Off, and clicking Off in that tab sends no request because the page believes it is already off. The lead's direction: **the route reports the setting as saved together with the start error, and the Settings page shows the saved value (On) with the error, so Off works from that tab.**
- Route: when the save succeeded but the assistant start failed, answer success with the saved preferences plus a field naming the start error (for example `assistant_error: "<reason>"`); document it in `viewer/app/API.md`. Other preference saves and other failures are unchanged.
- Page: show the saved value from the response (On) and the error text beside the Personal assistant control, so clicking Off sends the save.
- Tests: a unit test (`viewer/test/assistant.test.js`) that a failing first start returns the saved `assistant: "on"` and the error; a browser test (`viewer/test/app-assistant.spec.js`) where the start fails, the control shows On with the error, and clicking Off sends the request and turns it off.

## L1 — the pop-up wipes a second draft
In `viewer/pages/assistant-popup.js` (`:276`, `:341-345`) a successful send clears the text box unconditionally, so a second draft typed while the first request was in flight is lost. Clear the box only if it still holds exactly the text that was sent. Test in `viewer/test/app-assistant-popup.spec.js`: hold the first POST, type a different draft, release; the new draft remains.

## L5 — "No threads yet" beside the pinned row
With the assistant as the only thread, `viewer/pages/threads.js:105-114` shows "No threads yet" under the pinned assistant row. Don't show that empty message when the assistant row is shown (or word it "No project threads yet" — your choice, record it). Test in `viewer/test/app-assistant.spec.js`.

## Ownership boundary
`viewer/app/routes.js`, `viewer/app/assistant.js`, `viewer/app/API.md` (L2); `viewer/pages/settings.js` (L2); `viewer/pages/assistant-popup.js` (L1); `viewer/pages/threads.js` (L5); `viewer/test/assistant.test.js`, `app-assistant.spec.js`, `app-assistant-popup.spec.js`. Normal threads and other settings must behave exactly as before.

## Validation
```bash
node --test viewer/test/assistant.test.js viewer/test/app-settings.test.js
cd viewer && for i in 1 2; do npx playwright test test/app-assistant.spec.js test/app-assistant-popup.spec.js test/app-settings.spec.js --reporter=line 2>&1 | tail -1; done
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
