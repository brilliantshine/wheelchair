# Remediation 1 — lead-chat-solid

Verification attempt 1 at d8b87e12. Claude verifier: PASS. GPT verifier: FAIL. Gap list verbatim (GPT verifier):

GAP: S1 archive cleanup — A held message survived a successful archive in both queue records when the replacement lead had started but had yet to receive it. Archive filters the queues before marking the lead ended. — `viewer/app/threads.js:246`, [reproduction log](/tmp/wc-lead-solid-verification.nVadvV/archive-restarted-peer.log)
GAP: S2 hourly cap — Rare path: 181 unrelated incoming messages evicted one of the 20 qualifying sends before the pause was set. The hub accepted the 21st send within the hour without user activity. — `viewer/app/cards.js:167`, `viewer/app/peer-log.js:4`, [reproduction log](/tmp/wc-lead-solid-verification.nVadvV/cap-retention.log)
GAP: S5 thread display — A held peer message alone makes the receiving thread say “1 queued: waiting for the lead to finish its turn” alongside “The lead has stopped.” Delivery requires a restart. — `viewer/app/chat.js:465`, `viewer/pages/thread.js:1468`, [browser screenshot](/tmp/wc-lead-solid-verification.nVadvV/held-page.png)

Judgment: S2 cap is a rare path, recorded in PLAN.md Accepted Risks (verification-1), not remediated. The other two are tasks below.

## R1-1 (archive cleanup; built by gpt, routed to gpt)

Plan slug: lead-chat-solid. Task id: R1-1. Lead session (send questions there with a `message`, asks: true): wc-f4c68e8cbb15-lead.

Gap (verification attempt 1): a held cross-thread message survives a successful archive when the thread's lead was live at archive time (for example a new lead that started but had not yet received it). viewer/app/threads.js `archive` calls `require('./peer-log.js').dropHeld(thread);` (line 246) BEFORE the loop that marks every session ended (line 252), and dropHeld skips live sessions, so the entry stays.

Ownership boundary: viewer/app/threads.js, viewer/test/app-handoff-restart.test.js, your report docs/plans/lead-chat-solid/reports/R1-1.md. Nothing else.

Change, exactly:
1. viewer/app/threads.js: delete the line `  require('./peer-log.js').dropHeld(thread);` at line 246 (just before `thread.archived = true;`), and insert the same line right after `  for (const session of thread.sessions) { session.live = false; session.ended_at ||= new Date().toISOString(); }` at line 252 and before the `await hub.save(thread);` that follows it in the success path. Do not touch the identical-looking sessions loop inside the earlier `if (rebases.length || result.uploads_removed === false)` block.
2. viewer/test/app-handoff-restart.test.js: in the test 'held peer queues do not make export busy and archive drops them' (around line 248), or as a new test right after it copying its setup, add a case: the lead session is live (`live: true`, status 'ready') with a queue entry carrying `peer` (in both `session.queue` and `thread.queues[name]`), the thread is archived through the same archive call the existing test uses, and afterwards both the session's queue and `thread.queues[name]` hold no entry with `peer`. Seed one non-peer entry too and assert it is still there, so the test proves only peer entries go.
3. Break check: put the dropHeld line back where it was, run the test, see it fail; restore. Say so in your report.

Validation (paste the real output with summary lines into your report):
- node --test viewer/test/app-handoff-restart.test.js viewer/test/app-lead-messages.test.js
- git diff --stat wc/f4c68e8cbb15...HEAD   (three dots)

If the same gate fails twice, stop and report rather than iterating.
Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <comma-separated paths>`. Your own wc.js and card.js calls are always allowed.
Write the report, commit it, then post your result card (task R1-1).
List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.

## R1-2 (queued count; chat.js built by claude, routed to claude)

Plan slug: lead-chat-solid. Task id: R1-2. Lead session (send questions there with a `message`, asks: true): wc-f4c68e8cbb15-lead.

Gap (verification attempt 1): a cross-thread message held for a stopped lead counts toward the thread page's note "N queued: waiting for the lead to finish its turn" (shown next to "The lead has stopped"). Held messages are hidden lead-to-lead traffic waiting for the next lead; they must not be counted there. The count comes from viewer/app/chat.js line ~465: `queued: Object.values(thread.queues).flat().length,`. A held entry is one where `require('./peer-log.js').heldEntry(session, entry)` is true (viewer/app/peer-log.js:5: session not live, not pending, entry has `peer`).

Ownership boundary: viewer/app/chat.js, viewer/test/app-chat.test.js, your report docs/plans/lead-chat-solid/reports/R1-2.md. Nothing else (not viewer/pages/thread.js, not peer-log.js).

Change, exactly:
1. viewer/app/chat.js: replace that line with
   `    queued: Object.entries(thread.queues || {}).flatMap(([name, queue]) => { const session = (thread.sessions || []).find((item) => item.name === name); return session ? queue.filter((entry) => !require('./peer-log.js').heldEntry(session, entry)) : queue; }).length,`
2. viewer/test/app-chat.test.js: add one test after the existing 'peer_log becomes folded peer items...' test, reusing its hub stub pattern (`readSnapshot`, `state.settings`, `call`). Thread with two lead sessions: an ended one (`live: false`, status 'ended') whose `thread.queues` entry has one held entry `{ text: 'x', source: 'session', peer: { thread: 'o', title: 'O', session: 's' } }` and one ordinary entry `{ text: 'y', source: 'user' }`; and a live one whose queue has one entry carrying `peer`. Assert `queued` is 2 (the ordinary entry and the live lead's entry count; the held one does not).
3. Break check: revert the line to the old one, run the test, see it fail (it would give 3); restore. Say so in your report.

Validation (paste the real output with summary lines into your report):
- node --test viewer/test/app-chat.test.js
- git diff --stat wc/f4c68e8cbb15...HEAD   (three dots)

If the same gate fails twice, stop and report rather than iterating.
Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <comma-separated paths>`. Your own wc.js and card.js calls are always allowed.
Write the report, commit it, then post your result card (task R1-2).
List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
