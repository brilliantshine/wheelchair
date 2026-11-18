---
slug: self-check-steps
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-18
---

# Show Collin how to check a finished change himself

## What we're building

When a thread finishes, the lead also shows Collin how to check the change for himself: a
few steps to follow, and what he should see at each one if it worked. This shows in the
thread, next to the Done card.

## Why — the problem

Today the Done card says what he can do now and links the pull request, and he has to
trust that "done" means it works. He can't tell what was actually checked, or how he would
see it working with his own eyes.

## What good looks like

- Every finished thread shows check steps along with Done.
- Each step says what to do and what he should see.
- He can follow the steps without reading the code or asking the lead.
- A fix made after Done comes with its own steps for what that fix changed.

## Not doing

- Not replacing the automatic checks (reviewers, verifier, GitHub checks). These steps are
  for him, on top of those.
- Not running the steps for him or recording whether he did them.

## Constraints

- He often reads threads on a phone, so the steps must be short and readable there.
