---
slug: review-progress
status: confirmed   # draft | confirmed
created: 2026-11-15
---

# See progress while a plan is reviewed and a build is verified

## What we're building

A pinned line in the thread that says where things stand while a plan is being reviewed
and while a finished build is being checked. It names the stage, which pass or attempt
it is on, and a count of issues found and fixed.

## Why — the problem

Today the thread goes quiet in both stages. Plan review runs in rounds you never see:
nothing appears until the approval card, or until review gets stuck. During a build, the
pinned line stops at "N of M tasks done" and doesn't change when the build moves into
checking, or into a fix-and-recheck loop. From the outside, slow progress and a stall look
the same.

## What good looks like

- While a plan is in review, the thread shows something like "Reviewing the plan · pass 2
  · 5 issues found, 4 fixed".
- After the build tasks are done, the line changes from "Building" to verifying, and it
  says when a check failed and a fix is being rechecked (e.g. "Verifying · attempt 2 ·
  1 gap being fixed").
- You can tell at a glance whether it's converging or going round in circles, without
  reading any findings.
- The line updates as each round or attempt moves on, not only at the end.

## Not doing

- Showing the findings themselves, or anything you'd need to read or act on.
- Changing how review or verification decide things: same rounds, same limits, same
  "needs you" card when review keeps failing.
- Progress for mapping or planning questions.

## Constraints

- Works on a phone, inside the existing thread page.
- Cards stay the only channel from sessions to the app: no new side channel.
- Review stays quiet in substance: no finding text or reviewer names reach the thread.
