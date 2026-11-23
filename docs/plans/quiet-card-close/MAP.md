# Quiet card close: map

Checked against origin/main `87923e582b9b68a125ec2c34cbdcb321bd45a23d`; line references also checked in worktree HEAD `c4f9ccfb013f0542ad356bee95a9d4b58201fa87`. The reusable [system needs and quiet map](../../maps/system-needs-quiet.md) has the detailed lifecycle, other system cards, transport, and tests. The older card-closure, app-sessions, app-thread-page, app-cards-security and viewer-app-pages maps cover files changed since their recorded checks; their relevant claims were rechecked in that focused map, not adopted wholesale.

```text
quiet turn -> agent reminder -> starter reminder -> system needs card
                                                         |
      message/result or stop/death -> reset -> answered <-+
      starter message / child start -> activity, no reset -> card stays open
```

The quiet detector excludes sessions waiting on live children when deciding to escalate, but that exclusion does not answer a card already created: stage 3 has no activity-closing branch (`viewer/app/quiet.js:3-7,39-52`). Successful delivery clears `quiet_check_at` but leaves `quiet_card` and `quiet_stage`; child start similarly does not reset the caller (`viewer/app/sessions.js:512-539,699-718`). Message/result posted by the quiet session, reviewer/verifier report, stop and death do call reset (`viewer/app/cards.js:158-161`; `viewer/app/sessions.js:428-460,761-775,851-859`). Reset also removes queued quiet reminders, so closing a card and resetting the escalation ladder are distinct behavior choices (`viewer/app/quiet.js:13-23`).

System needs render no dismissal control, and both the existing dismiss endpoint and ordinary needs presses reject them (`viewer/pages/thread.js:1009-1029`; `viewer/app/threads.js:394-395,440-450`; `viewer/app/card.js:238-245`). An unanswered system card contributes to the thread's Needs you indicator (`viewer/app/views.js:140-149`; `viewer/pages/threads.js:75-77,115-119`). Dismissing a permission card must be considered separately from its delivery hold, which lives on the session (`viewer/app/sessions.js:503-509,634-655`).

Existing tests exercise the ladder, reset, waiting and holds, plus system dismissal refusal; they do not establish closure of an already raised quiet card on a starter message or new child (`viewer/test/app-quiet.test.js:33-84`; `viewer/test/app-hub.test.js:1805-1826`).

## What I did not look at

Machine hook internals, all archive retry outcomes, and unrelated card behavior in detail.
