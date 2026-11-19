---
slug: lighter-server
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-18
---

# A lighter server when many agents run

## What we're building

Make wheelchair's app server use much less CPU and memory, so that with many agents running the machine's power goes to
the agents, not to wheelchair watching them. Also stop the project's browser test runs
from flooding the machine with browsers when several agents test at once.

## Why — the problem

With about ten agents live, the app server holds about 730 MB and uses about a third of a
CPU core all the time, mostly re-reading every thread file (including archived ones)
several times a second, and more for every open browser tab. Its memory only grows: it
keeps a copy of every transcript it has shown. The chat page pulls whole transcripts
every two seconds. The machine service stalls while it waits on tmux. Separately, each
browser test run opens about 8 browsers, so two agents testing at once take about 10
cores. Leftover test processes have run for days.

## What good looks like

- With the same number of agents and an open thread page, the app server's idle CPU is
  clearly lower than today, measured before and after.
- Everything in the app behaves the same: lists, chat, agents, cards, dead-session
  detection and message delivery update as quickly as now.
- Two agents running browser tests at the same time no longer saturate the machine.

## Not doing

- Making the agent CLIs (Claude Code, Codex) themselves lighter.
- Changing what the app shows or how it looks.
- Deleting or moving archived threads or old transcripts.
- Running fewer agents or changing how many may run at once.
- Making chat fetch only transcripts that changed: split into its own follow-up thread.
- Changing the machine service (its tmux checks and transcript handling): it is already light.
- Stopping the server's memory from growing: it comes from the transcript copies the chat
  follow-up thread rewrites, so it is fixed there.

## Constraints

- No behaviour change visible to Collin; nothing may show stale state longer than it does
  today.
- Existing test suites stay green.
