# Map: lead-to-lead messages and restart

Checked against: `7204dd2af8986aa1cdbca73f6b98c25d0fc26095` (origin/main)
Files covered: `viewer/app/card.js`, `viewer/app/cards.js`, `viewer/app/hub.js`, `viewer/app/peers.js`, `viewer/app/routes.js`, `viewer/app/sessions.js`, `viewer/app/threads.js`, `viewer/app/chat.js`, `viewer/app/state.js`, `viewer/pages/thread.js`, `machine/service.js`, `viewer/test/app-lead-messages.test.js`, `viewer/test/app-hub.test.js`, `viewer/test/app-chat.test.js`, `viewer/test/app-handoff-restart.test.js`, `machine/test/service.test.js`.

```text
lead message -> card.js -> machine card spool -> hub sender card
                                                   -> target lead queue -> turn ends -> machine submit
                                                   -> refusal -> machine -> sender
lead dies -> restart context + old lead queues -> new lead queue -> submit
lead transcripts + cards -> chat response -> thread page
```

## Send and delivery

`card.js` validates `to`, `text`, optional `asks` and `passes_on`, then posts with the session token; non-2xx prints the response body (`viewer/app/card.js:180`, `viewer/app/card.js:304`, `viewer/app/card.js:320`). The machine authorizes the agent, adds its session and thread, writes a durable card spool before relaying, and returns hub responses or queued success on an outage (`machine/service.js:2246`, `machine/service.js:2282`, `machine/service.js:2297`). A 4xx moves the spool aside; a later drain likewise rejects it, so a previously queued receipt cannot report a later refusal to its sender (`machine/service.js:1467`, `machine/service.js:1480`, `machine/service.js:1497`, `machine/service.js:2303`). This spool bridges machine-to-hub outages, not an absent recipient lead.

The authenticated hub card route invokes acceptance (`viewer/app/routes.js:457`). The sender-thread update checks role and fields, deduplicates delivery IDs, and for a lead naming a session outside its thread finds the owning thread and requires the named session to be a lead. It checks same machine, archive, handoff, project or link, then refuses with 422 `that thread has no live lead right now` before storing the card if none is live (`viewer/app/cards.js:56`, `viewer/app/cards.js:69`, `viewer/app/cards.js:154`). `passes_on` only names a question in the sender's own cards (`viewer/app/cards.js:79`). `latestLiveLead` reverses session order and picks the first live lead; title falls back through slug, project basename and ID (`viewer/app/peers.js:13`).

The sender card and delivery ID save first; then a separate target-thread lock rechecks reachability and latest live lead, queues `[wc:from <session>] [thread <sender-id>: <title>]` plus optional question marker and text, and attempts delivery (`viewer/app/cards.js:168`, `viewer/app/cards.js:201`, `viewer/app/hub.js:200`). **There is a loss window:** if the target becomes unreachable or loses its live lead between checks, the second update returns null but the sender card still succeeds; a retry with the same delivery ID is deduplicated before target enqueue (`viewer/app/hub.js:203`, `viewer/app/hub.js:214`, `viewer/app/cards.js:61`). Separate locks also matter for any pair counter: simultaneous opposite sends are tested and must not deadlock (`viewer/test/app-lead-messages.test.js:79`).

Queues belong to sessions and are mirrored in `thread.queues`; normal delivery requires live, ready, turn-ended, unheld session and nonempty queue (`viewer/app/sessions.js:489`, `viewer/app/sessions.js:505`). Turn-end marks idle (`viewer/app/sessions.js:626`); machine submission must succeed before the head is shifted, then the submitted text is appended to `thread.sent`, capped at 500 with older entries appended to a sent log (`viewer/app/sessions.js:527`, `viewer/app/sessions.js:536`, `viewer/app/sessions.js:547`; `viewer/app/state.js:122`). The machine types via tmux (`machine/service.js:1194`).

## Restart and visibility

Restart rejects an existing live lead and constructs context from slug, unreplaced cards, pins, all card IDs and kinds, optional stub summary, and the latest 20 `thread.sent` entries with source `user` or `card`; imports add their own history (`viewer/app/threads.js:125`, `viewer/app/threads.js:138`). Outgoing cross-thread messages are stored as sender message cards, so they occur in `cards`; incoming delivered messages have source `session` in `sent` and are excluded from `recent_messages`. The latter is capped before restart and older entries are in the separate sent log (`viewer/app/cards.js:168`, `viewer/app/hub.js:208`, `viewer/app/sessions.js:547`, `viewer/app/threads.js:144`). Restart moves old leads' queued messages to the new lead, drops old context, and puts fresh context first; imported restarts have a separate pending-session path (`viewer/app/threads.js:159`, `viewer/app/threads.js:180`, `viewer/app/threads.js:193`).

Chat collects each lead transcript, discards entire turns beginning `[wc:from ` including replies, and converts restart context into a `Lead restarted` context item while retaining its replies (`viewer/app/chat.js:125`, `viewer/app/chat.js:385`). It returns unreplaced cards alongside items (`viewer/app/chat.js:412`); the page interleaves cards by time, but `renderCard` returns null for unhandled message cards (`viewer/pages/thread.js:620`, `viewer/pages/thread.js:885`, `viewer/pages/thread.js:1295`). Context items already render as small `.ctx` lines (`viewer/pages/thread.js:660`). The sender card is not present in the receiving thread's cards; a line on both sides needs a receiving-side source (`viewer/app/hub.js:203`).

No per-pair message counter or cap appears in the inspected acceptance and delivery path (`viewer/app/cards.js:154`, `viewer/app/hub.js:189`). Existing 422 reasons originate in `appError` validation and policy checks and propagate through the hub and machine to `card.js` when the relay is synchronous (`viewer/app/cards.js:69`, `viewer/app/cards.js:158`, `viewer/server.js:1278`, `machine/service.js:2301`, `viewer/app/card.js:321`). Session step counters and provider limit holds solve different problems (`viewer/app/sessions.js:19`, `viewer/app/sessions.js:505`).

## Tests

`viewer/test/app-lead-messages.test.js:23` covers ordered refusals and no mutation; line 41 covers latest lead, marker, hidden traffic and `passes_on`; lines 56, 74, 79 and 86 cover chat hiding, worker restriction, concurrent exchange and links. `viewer/test/app-hub.test.js:1401` checks restart's 20 user/card messages and `:2200` checks stub summary/card kinds; `viewer/test/app-handoff-restart.test.js:172` covers restart queue. `machine/test/service.test.js:268` covers spool ordering, refusal and retry. Run `node --test viewer/test/app-lead-messages.test.js viewer/test/app-hub.test.js viewer/test/app-chat.test.js viewer/test/app-handoff-restart.test.js` and `bash machine/test/run.sh`; browser changes also use `npm --prefix viewer run test:browser` (root `AGENTS.md`, Verification).

## What I did not look at

- Every provider transcript parser, handoff export semantics, and all hub limits outside the inspected message path.
- A proposed cap policy, retention policy, or implementation and its new tests.
