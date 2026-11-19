---
slug: chat-transcripts
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-19
---

# Chat: less memory, cheap unchanged transcripts

## What we're building

The wheelchair app server shows each thread's chat by reading the agents' transcripts. Today it keeps a copy of every transcript it has ever shown, forever, and re-reads every lead's whole transcript every 2 seconds while a thread page is open. We make the server let go of transcripts nobody is looking at, and make the 2-second check almost free when nothing has changed.

## Why — the problem

- Memory: the server's memory grows without limit. Measured live on 2026-11-18: 730 MB after 10 minutes, 1.7 GB after 47 minutes.
- CPU: while a thread page is open, every 2 seconds the server asks the machine for each lead's whole transcript. The machine re-reads and checks the whole file and saves its session list each time, and the server parses it all again, even when nothing changed. With several agents running this keeps the server busy.

## What good looks like

- The app server's memory stays roughly flat over hours of use instead of climbing.
- With a thread page open and no agent writing, the server and the machine do almost no work per check.
- Chat looks and behaves exactly as today: the same messages, new messages appearing as quickly, and the same behaviour when the machine is briefly unreachable (the last chat stays on screen).
- A thread not looked at for a while opens as it does today, just read fresh.
- A hub and a machine service on different versions still show chat correctly.

## Not doing

- Changing how chat looks or what it shows.
- Changing how often the page checks for new chat.
- Sending only the new part of a transcript (the parent's review found that splicing pieces together causes wrong chat; a transcript is either unchanged or sent whole).
- Other memory or CPU work outside chat transcripts (the parent thread handled thread files and hidden tabs).

## Constraints

- Older machines and hubs keep working: an empty reply from an older machine means "fall back to the last copy", never "this chat is empty".
- Readers that collect agent reports never use an old copy of a transcript.
- Chat keeps holding the thread lock as today.
- Builds on the parent thread's work (merged in PR #120).
