# Lead chat solid: map index

Checked against `7204dd2af8986aa1cdbca73f6b98c25d0fc26095` (origin/main and worktree HEAD). The current end-to-end flow, source evidence, test entry points and unchecked scope are in [lead chat delivery](../../maps/lead-chat-delivery.md).

```text
sender card -> sender thread -> target lead queue -> turn end -> recipient
                    |                |
                 refusal       restart moves waiting queue
sender cards + recipient sent history -> restart context and thread page
```

- D1: queues already move from ended leads to a restarted lead, but a message is currently refused before storage when no lead is live; the two-lock acceptance path also has a loss window if the lead dies between checks (`viewer/app/cards.js:154`, `viewer/app/hub.js:200`, `viewer/app/threads.js:180`).
- D2: the inspected path has no pair cap; concurrent opposite sends use separate thread locks, and a synchronous 422 can reach the sender, whereas an outage-spooled card may be rejected later (`viewer/app/hub.js:200`, `machine/service.js:1497`, `machine/service.js:2301`).
- D3: restart context includes outgoing message cards but excludes incoming `session` entries from recent messages; sent history is bounded in the thread record (`viewer/app/threads.js:138`, `viewer/app/sessions.js:547`).
- D4: chat hides `[wc:from ...]` turns and replies; the page already renders context lines, but message cards have no renderer and the target has no copy of the sender card (`viewer/app/chat.js:125`, `viewer/pages/thread.js:660`, `viewer/pages/thread.js:1295`, `viewer/app/hub.js:203`).

Older maps [app-sessions](../../maps/app-sessions.md), [session-token-flow](../../maps/session-token-flow.md), [app-cards-security](../../maps/app-cards-security.md), [app-thread-page](../../maps/app-thread-page.md), [chat-transcript-refresh](../../maps/chat-transcript-refresh.md), and [app-session-tree](../../maps/app-session-tree.md) have covered-file changes since their recorded commits; their relevant paths were rechecked in the new map, not trusted wholesale. The earlier [lead-chat map](../lead-chat/MAP.md) predates the merged cross-thread route and its refusal claim is stale (`viewer/app/cards.js:154`).

## What I did not look at

- All unrelated portions of the older maps, and the policy and implementation choices for these deferred changes.
