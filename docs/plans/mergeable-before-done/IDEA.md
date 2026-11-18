---
slug: mergeable-before-done
status: confirmed   # draft | confirmed
created: 2026-11-17
---

# Pull requests are mergeable before work is called done

## What we're building

When an agent finishes a thread's work, it opens a pull request and tells Collin the work is
done. From now on, before it may say "done", the agent must make the pull request mergeable:
fix any merge conflicts with the main branch, and watch GitHub's automatic checks (CI) until
they pass, fixing whatever makes them fail.

## Why — the problem

Today an agent pushes, opens the pull request and posts "done" straight away. Nobody looks at
whether the pull request conflicts with main (other threads merge in the meantime) or whether
the checks pass. Collin then finds a "done" pull request he cannot merge, and has to fix it
himself or start more work.

## What good looks like

- A "done" card only ever points at a pull request with no merge conflicts and passing checks.
- When main moved on and conflicts, the agent resolves them itself, and the result is checked
  again before "done".
- When a check fails, the agent fixes the cause and waits for the checks again.
- This holds for small fixes, full builds and fixes made after a thread is done.

## Not doing

- Merging the pull request. Collin still merges; agents never do.
- Adding new CI checks or changing what the existing checks test.
- Changing anything about how work is planned, built or reviewed before the push.

## Constraints

- Agents never merge a pull request into main.
- GitHub can be slow or unavailable; that must not leave a thread silently stuck.
