# Map: message delivery and machine archive

Checked against: `be198998f46768a07d03019a25d1d4fd6890bf71` (origin/main)
Files covered: `viewer/app/sessions.js`, `viewer/app/threads.js`, `viewer/app/cards.js`, `machine/service.js`

## Flow

The hub queues a message on the target session and mirrors the queue in the thread; first messages may be prepended (`viewer/app/sessions.js:297-309`). Delivery requires a live, ready, turn-ended session with a nonempty queue and no permission, needs or active limit hold (`viewer/app/sessions.js:312-315`). The machine submits by tmux paste and Enter; failure keeps the queue, success shifts it, clears `turn_ended`, and records the delivered text in `thread.sent` (`viewer/app/sessions.js:317-350`; `machine/service.js:523-531`). A freshly ready session without its own first message is marked idle; otherwise the machine independently submits `pending_initial` at readiness, outside this sent history (`viewer/app/sessions.js:283-288,243-247`; `machine/service.js:482-488`).

A child card queues a message to its chosen recipient or its result to its starter; the card, queue and delivery id persist before delivery is attempted (`viewer/app/cards.js:79-95,101-115`). A dead session's starter gets an app message; a dead lead gets a system needs card (`viewer/app/sessions.js:528-545,561-587`). Restarting a lead moves old queues and answers the Sessions ended card (`viewer/app/threads.js:140-152`). Archive asks the machine to stop sessions and remove or retain worktrees (`viewer/app/threads.js:158-175`; `machine/service.js:568-609`).

```text
message -> session queue -> ready and idle -> machine submit -> sent history
                                          | failure -> queue retained
```

## What I did not look at

Archive failure cases in detail, account placement, or UI rendering.

> Risk-flow recheck at `635c45f07991f31191f2ab1443b52b4ee76559d5`: see [app-risks.md](app-risks.md).
