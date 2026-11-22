---
slug: lead-chat-solid
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Make lead-to-lead chat solid

## What we're building

The follow-up to lead-to-lead chat (plan `lead-chat`, PR #134). Four improvements: a
message to a thread whose lead is restarting waits and reaches the next lead; a limit on
messages between two threads so their leads can't loop; a restarted lead sees its earlier
conversations with other leads; and a short "Talked with <thread>" line in the thread when
its lead talked with another thread's lead.

## Why — the problem

- A message sent while the other thread's lead is restarting is refused, so the sender has
  to notice and try again later, and a message can be lost if a lead stops at the moment
  one arrives.
- Nothing stops two leads replying to each other indefinitely, burning tokens with no one
  watching.
- A restarted lead sees messages it sent but not the ones it received, so it loses half of
  any cross-thread conversation.
- Lead-to-lead traffic is fully hidden, so Collin cannot tell from the thread that its lead
  talked to another thread.

## What good looks like

- Sending to a thread whose lead is restarting succeeds; the new lead receives the message
  once it is up, and no message is lost when a lead stops as one arrives.
- When two threads exceed the message limit, further messages are refused with a reason the
  sending lead can read, and normal conversations never hit it.
- After a restart, the lead's context shows the recent messages it both sent and received
  from other threads.
- The thread shows a small line such as "Talked with <thread title>" when its lead
  exchanged messages with another thread's lead, without showing the hidden messages
  themselves.

## Not doing

- Showing the full text of lead-to-lead messages in the thread.
- Letting leads decide things for the user: leads still only inform; Collin decides.
- Changing who may message whom, or the Allow step for other projects.
- Messages between threads on different machines.

## Constraints

- Builds on the merged lead-chat code on `main`; no change to cards other roles post.
