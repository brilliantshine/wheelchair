# Map: stub deduplication

Checked against `7204dd2af8986aa1cdbca73f6b98c25d0fc26095` (origin/main). Detailed lifecycle and test pointers: [stub lifecycle](../../maps/stub-lifecycle.md); peer overlap context: [overlap decision flow](../../maps/overlap-decision-flow.md).

```text
lead considers stub -> lists peers -> posts stub card -> child saved -> user opens -> lead receives context
                         | existing unopened stub omitted
                         -> no summary available for comparison
```

- The lead protocol instructs posting for new work and writing context for a new lead, with special duplicate checks for two-part follow-ups and missed-merge commits; it has no general pre-post stub comparison (`protocol/app/lead.md:801`, `protocol/app/lead.md:870`, `protocol/app/lead.md:675`). `session leads` filters same-project threads without a prior lead and returns no context, so it cannot find unopened stubs or compare summaries (`viewer/app/peers.js:41`).
- Each accepted stub creates a new child; the card's summary and the child's `context` are separate copies, and delivery-ID replay protection only identifies repeated delivery (`viewer/app/cards.js:56`, `viewer/app/cards.js:192`, `viewer/app/threads.js:93`). A near-duplicate addition needs a defined target and update path; existing card validation does not accept a target field (`viewer/app/card.js:170`, `viewer/app/card.js:198`).
- The child page rerenders changed context while unopened; the original parent card renders its own summary. Once opened, the lead receives a queued context snapshot, so changing stored context alone does not notify it; restart later reads current context (`viewer/pages/thread.js:522`, `viewer/pages/thread.js:1219`, `viewer/pages/thread.js:1434`, `viewer/app/threads.js:118`, `viewer/app/threads.js:138`).
- Candidate policy must account for waiting/ready, opened, archived, handed-off/frozen and merged work; existing peer discovery excludes archived and frozen threads but does not exclude merged ones (`viewer/app/threads.js:494`, `viewer/app/peers.js:11`, `viewer/app/peers.js:41`, `viewer/app/threads.js:463`). Parent dependencies and commit lists belong to the child and may differ between prospective contributions (`viewer/app/threads.js:93`).
- Existing tests cover discovery, creation, opening and the relevant pages (`viewer/test/app-lead-list.test.js:10`, `viewer/test/app-hub.test.js:667`, `viewer/test/app-threads.spec.js:614`). The protocol's same-CLI promise conflicts with actual provider selection (`protocol/app/cards-lead.md:249`, `viewer/app/threads.js:93`, `viewer/test/app-hub.test.js:691`).

Not checked: machine spool internals, every handoff import/undo path, and unrelated UI pages and card kinds.
