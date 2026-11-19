# Map: self-check steps

```text
plan checks and completion -> verifier report -> lead opens PR -> readiness gate
                                                            -> done card -> thread and handoff
```

The current end-to-end flow, card extension points, evidence sources and tests are mapped in [done-card.md](../../maps/done-card.md), checked against `4cfa20cd5aafa0418afabb829c9a4c73430a435f`.

- Done already carries capabilities and omissions, not a sequence of actions and expected observations; the page renders those two lists with follow-up buttons (`viewer/app/card.js:125-132`; `viewer/pages/thread.js:805-834`). A field needs schema, protocol, page and handoff treatment; a separate kind also needs role, shown/pin choices, rendering and handoff kind handling (`viewer/app/card.js:10-43,160-175`; `viewer/app/cards.js:9-34`; `viewer/app/handoff.js:5,34-46`; `viewer/pages/thread.js:8,601,805-835`). Existing cards must still be considered: stored records and exported history predate any new field (`viewer/app/chat.js:277-282`; `viewer/app/handoff.js:55-70`).
- The lead posts done for small fixes, planned builds and after-done fixes, after a PR check; a small fix has no PLAN or COMPLETION (`protocol/app/lead.md:112-122,390-398,411-439`). A check-instructions rule must cover all three paths, including the fresh card after a fix.
- PLAN validation commands, COMPLETION evidence and verifier reports describe how the implementation was checked, but are not guaranteed to be instructions a person can follow. The plan template requires commands; verifier reports may only summarize what was run, and small fixes have no plan (`protocol/templates/PLAN.md:44-48`; `protocol/app/sub-lead.md:213-242`; `protocol/app/verifier.md:33-50,52-76`; `protocol/app/lead.md:112-114`). An example is `docs/plans/plan-modes/PLAN.md:456-469` and `docs/plans/plan-modes/COMPLETION.md:80-97`.
- All five requested older maps have changed covered files since their checked commits. Do not treat their old line references as current; in particular `pr-finishing.md` says there is no acceptance gate, but `viewer/app/hub.js:167-178` and `viewer/app/pr-gate.js:8-43` now implement one. The focused current map above rechecks the paths relevant to this idea; the older maps retain their wider historical coverage.

## What I did not look at

Live GitHub settings, every card kind or handoff import path, and verification reports beyond the protocol and cited example. No tests were run for this documentation-only map.
