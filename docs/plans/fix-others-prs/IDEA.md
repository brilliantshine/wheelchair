---
slug: fix-others-prs
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-23
---

# Fix other people's pull requests

## What we're building

A wheelchair thread can take on someone else's open pull request (for example a
collaborator's PR that has merge conflicts), review and fix it, and push the fix to that
pull request's own branch once Collin approves, instead of opening a replacement pull request.

## Why — the problem

Today a thread may only push to its own branch. That stops two threads on one machine
overwriting each other, but it also blocks fixing an outside pull request: in "Review
Junjie's image backgrounds PR", PR #173 had a conflict resolved locally, but the fix could
only ship as a second, replacement pull request.

## What good looks like

- Collin can point a thread at an existing open pull request and have it reviewed and fixed.
- After his OK for that pull request, the fix lands on the original pull request; no
  replacement pull request is opened.
- If the author pushed meanwhile, nothing of theirs is overwritten: the thread brings in
  their changes, checks again, then pushes.
- A thread never pushes to a branch another live thread on this machine is working on.

## Not doing

- Force-pushing to anyone's branch.
- Pushing to another pull request without Collin's OK for that pull request.
- Changing how a thread's own pull request works.

## Constraints

- The protection against two threads on this machine overwriting each other stays.
