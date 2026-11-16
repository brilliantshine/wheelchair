---
slug: sudo-cards
status: confirmed   # draft | confirmed
created: 2026-11-15
---

# Run sudo commands from a card

## What we're building

When an agent needs something run with sudo, it asks through a card in the thread. The card
shows the exact command, what it does and why the agent needs it. Collin can type his
password and double-click to run it, decline it, or talk it over first. The password goes
to sudo and nowhere else. No agent ever sees it.

## Why — the problem

Agents run without root. When a task needs it (installing a package, editing a system
file, restarting a system service), the agent stops and Collin has to SSH into the machine
and run the command himself. He is often on his phone, so that is slow and awkward.

## What good looks like

- A sudo card says, in plain words, what the command does and why it is needed, and shows
  the exact command that will run.
- What runs is exactly the command shown. Nothing can be changed after Collin reads it.
- Run needs the password and a deliberate double-click, so a stray tap can't trigger it.
- Decline tells the agent no. "Talk about it" opens a conversation, and nothing runs.
- The agent learns whether the command worked and sees its output. It never gets the password.
- The password is not saved anywhere: not on disk, not in a log, not in the thread, not
  in any agent's terminal or transcript.

## Not doing

- Remembering the password or keeping sudo unlocked between commands. Every run asks again.
- Letting agents run sudo themselves, or setting up passwordless sudo.
- Approving one command for later runs, or approving several commands at once.
- Interactive commands that need input while they run.

## Constraints

- Agents and the machine service run as the same Linux user. Isolation has to come from the
  password never existing anywhere an agent can read, not from file permissions.
- Has to work from a phone browser.
