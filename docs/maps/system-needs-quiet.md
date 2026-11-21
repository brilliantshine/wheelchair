# Map: quiet sessions and system needs cards

Checked against: `87923e582b9b68a125ec2c34cbdcb321bd45a23d` (origin/main); worktree HEAD `c4f9ccfb013f0542ad356bee95a9d4b58201fa87` was also read for the line references below.
Files covered: `viewer/app/quiet.js`, `viewer/app/sessions.js`, `viewer/app/cards.js`, `viewer/app/card.js`, `viewer/app/threads.js`, `viewer/app/hub.js`, `viewer/app/routes.js`, `viewer/app/views.js`, `viewer/app/wc.js`, `viewer/server.js`, `viewer/pages/thread.js`, `viewer/pages/threads.js`, `viewer/test/app-quiet.test.js`, `viewer/test/app-hub.test.js`, `viewer/test/app-project-tools-card.test.js`.

## Flow

```text
turn ends owing a report -> grace check -> agent reminder -> starter reminder -> system needs card
                                                                                  |
message / result, starter message, child start, stop / death -> reset -> card answered <-----------------------
```

The retry timer runs `checkQuiet` after retrying queues (`viewer/app/hub.js:88-89`). Watched live workers, mappers, sub-leads, reviewers and verifiers must have a starter and owe a reply; a finished reviewer/verifier is excluded. A quiet turn also requires no queued messages, permission or needs hold, unexpired limit, or live child owing a reply, waiting, or with a queue (`viewer/app/quiet.js:3-7`). Turn end arms a grace check; stage 0 queues an agent reminder, stage 1 queues a starter reminder or alerts if the starter is dead, and stage 2 alerts on another quiet turn, dead starter, or the escalation timer. The timer starts when the starter reminder is actually delivered; stage 2 waits for that delivery on the turn path (`viewer/app/sessions.js:624-632,534-537`; `viewer/app/quiet.js:12,32-56`). The timer branch checks `waiting` but does not require the full `isQuiet` predicate (`viewer/app/quiet.js:44-52`).

Alert stores a system needs card ID on the session and advances to stage 3; reset answers that card, clears the ID/check and queued quiet reminders, and normally resets the stage and starter timestamp (`viewer/app/quiet.js:13-30`). An accepted message or result from that session, or a reviewer/verifier report, clears its debt and resets it; stop and confirmed death also reset it (`viewer/app/cards.js:158-175`; `viewer/app/sessions.js:428-460,761-775,851-859`). A starter's accepted message to the quiet session and a successful child start also reset it whenever `quiet_card` is set; user dismissal answers the card without resetting the watch.

A starter's message card is queued with `source: session`; enqueue and delivery persist a queue, require a live ready unheld session and a finished turn, and remove the message only after the machine accepts it (`viewer/app/cards.js:162-167,182-195`; `viewer/app/sessions.js:487-509,525-542`). `wc.js` forwards `--replaces`; only worker starts use it: the named worker must be recorded dead and confirmed absent from tmux, and its worktree must be unoccupied (`viewer/app/wc.js:95`; `viewer/app/sessions.js:699-718,721-745`). Stopping or death already resets the old worker's quiet card; replacement itself has no reset call in that path (`viewer/app/sessions.js:761-775,851-859,699-718`).

## Other system needs

- Startup stuck and permission events set a delivery hold and remember the newest card ID; ready, prompt-cleared, permission-cleared, or a turn end with permission open clears the hold and answers that remembered card (`viewer/app/sessions.js:634-655`). Repeated events overwrite the remembered ID (`viewer/app/sessions.js:635-644`).
- Lead turn failure posts a card; a later lead turn end or lead restart answers matching cards (`viewer/app/sessions.js:608-616,624-629`; `viewer/app/threads.js:168-171,189-195`). A child failure instead tells its starter (`viewer/app/sessions.js:608-614`).
- An ended child with an end reason posts `Session ended` and tells its starter; a dead lead posts `Sessions ended`, answered by lead restart (`viewer/app/sessions.js:790-806`; `viewer/app/threads.js:168-171,189-195`). No `Session ended` closure is present in these lifecycle paths.
- Newer project-tools reports update the same warning for the same names, answer and replace it when names change, or answer it when problems disappear (`viewer/app/sessions.js:151-184`). A lead preflight failure can post `Codex preflight failed`; no closure is present in the checked start path (`viewer/app/sessions.js:290-311,395-425`). Archive failures also post system needs (`viewer/app/threads.js:223-237`).

## Browser and boundaries

`addCard` records `system`, session and `answered: false` (`viewer/app/cards.js:11-34`). The needs renderer shows an open system card's terminal link when it has a session; only non-system needs get Keep going and Talk about it (`viewer/pages/thread.js:1009-1029`). A press posts to the authenticated viewer API; browser writes require a remember cookie or token header and matching origin, then the route dispatches through the hub (`viewer/pages/thread.js:746-752`; `viewer/server.js:1292-1298,2106-2113`; `viewer/app/routes.js:628-632`; `viewer/app/hub.js:223`). Ordinary needs presses reject system cards; supported ordinary actions include keep-going, picked, answered, removed, talk, start-building and start-thread, with separate reach, sudo, merged and recheck handling (`viewer/app/threads.js:321-327,349-395,397-436`). The dismiss endpoint resolves non-blocking system needs cards without notifying the lead; a card held open by a live session is refused. The thread view computes a `blocking` flag at read time; lead resolve and retract still refuse system needs cards.

The features view counts each unanswered, unreplaced needs, question, approval, merged or reach card, including system cards; the Threads page groups these by thread and displays `needs you` whenever the count is nonzero (`viewer/app/views.js:140-149`; `viewer/pages/threads.js:75-77,115-119`).

## Existing coverage

Quiet escalation, report/result closure, stop, child waiting, held reminders and queue races are covered in `viewer/test/app-quiet.test.js:33-84`; system permission clearing, lead restart, preflight failure, resolve/dismiss refusal, and retract refusal are covered in `viewer/test/app-hub.test.js:413-447,610,1428-1438,1743-1757,1805-1826,2075-2080`. Project-tools warning replacement and clearing are covered in `viewer/test/app-project-tools-card.test.js:50-66`.

## What I did not look at

Machine hook implementation, all archive retry outcomes, all browser tests and unrelated card kinds in detail. This map records checked paths, not a claim that every historical map claim was revalidated.
