---
slug: cheap-chat-refresh
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-19
---

# Cheaper chat refresh on the thread page

## What we're building

When a thread page is open, it asks the app server for the chat every two seconds. Today
each ask copies the lead's whole conversation from the machine service to the app server
and reads it again from scratch, even when nothing changed, and the app server keeps a
copy of every conversation it has ever shown. We make an unchanged conversation cost
almost nothing to refresh, and stop the app server's memory from growing without end.

## Why — the problem

Measured on the live server on 2026-11-18: the app server held 730 MB after 10 minutes and
1.7 GB after 47 minutes, mostly copies of conversations it showed once. Each open thread
page makes the machine service re-read, re-check and re-save its records for every lead
conversation every two seconds, and the app server re-read the whole text, although most
of the time the lead is idle and nothing changed. The earlier "Lighter server with many
agents" thread fixed the thread-file side and left this part to this thread.

## What good looks like

- With a thread page open and its lead idle, a refresh moves no conversation text between
  the machine and the app server, and neither side re-reads the whole conversation.
- The app server's memory stops growing with every conversation shown: a conversation not
  looked at for 10 minutes is let go.
- Chat looks and updates exactly as today: new messages appear as quickly, nothing goes
  missing or shows twice, and two tabs on the same thread both stay right.
- An updated app server still works with a machine service that has not been updated
  yet, and the other way round; mixing versions never shows an empty or wrong chat.
- Agent reports are never read from an old copy of a conversation.

## Not doing

- Sending only the new part of a conversation (deltas). The earlier thread tried it for
  four review rounds; it kept causing ordering problems.
- Changing how chat looks, or how often the page refreshes.
- Changing how the agent CLIs write their conversations.
- Deleting or moving old conversation files on disk.

## Constraints

- Mixed versions of app server and machine service must keep working, since they are
  updated separately and may sit on different machines.
- Chat keeps holding the thread's lock while it assembles, so a thread handoff cannot
  change things under it.
- The machine service's kept copy of each conversation must never lose or duplicate a
  line, including after a crash.
