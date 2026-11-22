---
slug: overlap-questions-solid
date: 2026-11-21
implemented-by: "standard (claude-sonnet-5-5); sub-lead claude-opus-5-5 (one clause)"
verified-by: []
---

# Completion Report — Make overlap questions solid

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| 1 Any project (D1) | this run | `protocol/app/lead.md:758` ("Any project" bullet replaces "This project only"; no-`stage` entry counts as not finished; discovery deferred to "Another project"); `protocol/app/lead.md:747` ("Leads inform": chat only for a late overlap) | `viewer/test/protocol-rules.test.js:105` (absence of "This project only"; phrase "apply to a thread in any project") |
| 2 Earlier chat decision (D2) | this run | `protocol/app/lead.md:782` (last sentence of "Feature, while planning") | `viewer/test/protocol-rules.test.js:105` (phrase "earlier user message (before or after PLAN.md was created)") |
| 3 Restart chat answer (D3) | this run | `protocol/app/lead.md:843` (new restart overlap bullet) | `viewer/test/protocol-rules.test.js:117` (phrase "resolved from the latest such message" in "Restarting what died") |
| 4 Finished before posting (D4) | this run | `protocol/app/lead.md:779` (end of "One question at a time", incl. small-fix line); `protocol/app/lead.md:785` (exception in "Cancelled or moot question") | `viewer/test/protocol-rules.test.js:105` (phrase "using its output only for this finished check") |
| 5 Re-ask (D5) | this run | `protocol/app/lead.md:762` ("New overlap": replaces "Re-asks are not done"); `protocol/app/lead.md:769` (peer path checks re-ask first, peer answered at once); `protocol/app/lead.md:845` (restart "not yet asked" definition) | `viewer/test/protocol-rules.test.js:105` (phrase "whether or not it still counts as an overlap") |
| 6 Non-goals | this run | `git diff e3f94d1f..HEAD --stat` touches only `protocol/app/lead.md`, `viewer/test/protocol-rules.test.js` and plan docs; no other file contains the replaced text (grep for "Re-asks are not done" / "This project only" outside docs/plans finds nothing) | diff stat |
| 7 Tests | this run | `viewer/test/protocol-rules.test.js:105-121` | runs below |

## Deviations from plan

None. Item 2 sits in the "Feature, while planning" bullet, which already scopes it to the card window for a feature (status `planning`).

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

```
$ node --test viewer/test/protocol-rules.test.js
# tests 38
# pass 38
# fail 0

$ (cd viewer && npm test)
# tests 833
# pass 833
# fail 0
```

The worker's own full run had one failure in `viewer/test/server.test.js` ("the global write lock serializes concurrent writes"), a timing test unrelated to this change; it passed alone and in the sub-lead's full run above.

## Known gaps / residual risks

- Accepted Risk from planning: answers older than the restart context's last 20 messages are not recovered.
- Pre-PR #148 overlap Decisions name no shared work and are not checked for re-asks (by design, Spec item 5).

## Remediation rounds
