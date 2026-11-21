---
slug: auto-merge
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Auto-merge finished pull requests

## What we're building

A setting in the wheelchair app that, when turned on, lets a thread's lead merge its own
pull request once it judges the work done. When it is off, nothing changes: the lead opens
the pull request and Collin merges it.

## Why — the problem

Today every finished thread stops at an open pull request, and Collin has to go to GitHub
(often from a phone) to merge it, even when the work was planned, reviewed and verified and
nothing is left for Collin to check. That extra step slows down threads Collin already trusts.

## What good looks like

- The Settings page has an auto-merge option, off by default.
- With it on, a thread that finishes and passes its checks ends with its pull request
  merged, without Collin touching GitHub, and the thread says it was merged.
- With it off, threads behave exactly as today.
- A pull request that is not ready (failing checks, conflicts, still waiting) is never
  merged.

## Not doing

- Merging pull requests that were not opened by a wheelchair thread.
- Changing how work is planned, reviewed or verified before the merge.
- Deleting branches or archiving threads after the merge.

## Constraints

- Off by default; turning it on is Collin's explicit choice.
- Never merges past failing checks, conflicts or GitHub's own branch protection rules.
