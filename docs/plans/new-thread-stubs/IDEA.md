---
slug: new-thread-stubs
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-27
---

# Save an idea as a stub from the New thread screen

## What we're building

The New thread screen gets a second way to finish: instead of starting a lead right away,
save the idea as a stub. The stub sits in the thread list with the first message as its
context, and a lead starts only when Collin opens it.

## Why — the problem

Today a stub can only be made by a lead inside another thread. When Collin has an idea they
want to park for later, the only option is Start, which launches a lead (and spends its
tokens) immediately, or keeping the idea somewhere outside the app.

## What good looks like

- On the New thread screen, after picking machine and project and typing a message, there is
  a button that saves it as a stub without starting any agent.
- The new stub shows in the thread list like other unopened stubs, titled from the message.
- Opening it starts a lead that reads the saved message as its starting context and begins
  from there.
- Nothing in the stub or its transcript claims it came from another thread.

## Not doing

- Changing how stubs posted by leads (stub cards) work.
- Editing a stub's text after it is saved.
- Changing the Start button's behaviour.

## Constraints

- Must work from a phone browser, like the rest of the New thread screen.
