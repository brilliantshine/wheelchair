---
slug: personal-assistant
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-23
---

# A personal assistant across all projects

## What we're building

A personal assistant agent that sits above all of Collin's projects. It knows where every
thread stands and acts for Collin on what Collin tells it to do: starting new threads with full
project leads, passing instructions to existing leads, and reporting back. Collin talks to
it in a special pinned thread, and from a pop-up that opens on any page of the app.

## Why — the problem

Today every thread is its own conversation. To find out where things stand, or to start
and steer work, Collin has to open each thread one by one, usually on a phone. Nothing
looks across projects for Collin or carries out an instruction like "start a thread to fix X
in project Y" or "tell the lead on Z to hold off".

## What good looks like

- One pinned thread, not tied to any project, where Collin chats with the assistant.
- A pop-up on any page of the app opens the same assistant conversation.
- Asking "where do things stand?" gets an accurate summary across all projects, including
  what is waiting on Collin.
- Telling it to start work in a project gives a new thread there with its own lead,
  started from what Collin said.
- Telling it to pass something to an existing thread's lead gets that message to the lead,
  and the assistant reports what happened.

## Not doing

- Replacing project leads: they still plan, review and build their own threads.
- The assistant deciding things Collin hasn't asked it to.

## Constraints

- Leads and threads keep working as they do today for anyone not using the assistant.
