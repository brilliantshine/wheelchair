# Map: overlap questions solid

```text
list peers -> identify project and completion -> ask or hold question
                                         -> answer stored -> restart recovers state
```

- Discovery includes linked cross-project threads with full fields; `--all-projects` adds unlinked peers with no stage or PR field. `linked` is cross-project only. A reach approval links both directions for messaging, not for card validation (`viewer/app/peers.js:41`, `viewer/app/threads.js:327`, `viewer/app/cards.js:143`). A question's `about_thread` is format-validated and stored without target or project lookup, so a cross-project id is accepted even though protocol currently forbids that card (`viewer/app/card.js:104`, `viewer/app/cards.js:69`, `:168`, `protocol/app/lead.md:758`).
- A fresh list uses cached `last_status`, falling back to `unknown` or `no plan`; it does not itself refresh the plan. `pr_url` is taken from the latest eligible done card and can be null even when one exists. An unlinked cross-project entry lacks both fields, and absent, archived or handed-off peers are not listed, so listing alone cannot always prove completion (`viewer/app/peers.js:11`, `:41`, `viewer/app/cards.js:51`, `viewer/app/views.js:122`). Current protocol defines completion as `done` or `no plan` plus `pr_url`, posts waiting cards unchanged, and keeps open cards valid if the peer finishes (`protocol/app/lead.md:757`, `:779`, `:784`).
- Restart context includes non-replaced cards with stored press and resolve fields, all card IDs and kinds, pins, and only the last 20 sent user/card messages, not delivered peer messages. Queued non-context messages move to the replacement (`viewer/app/threads.js:138`, `:180`, `:398`, `viewer/app/cards.js:37`).
- Rules live in `protocol/app/lead.md:740` and `:753`; restart rules start at `:841`. The prior plan defers cross-project cards, pre-PLAN chat decisions, unresolved chat-answer recovery, finished-peer rechecks and re-asks (`docs/plans/overlap-questions/PLAN.md:319`). The protocol test checks the discovery section and bans historical wording there; `rg 'Overlap with' viewer/test` finds no test (`viewer/test/protocol-rules.test.js:96`). See [overlap decision flow](../../maps/overlap-decision-flow.md) for details.

Not checked: browser rendering, unrelated card kinds, and transport or race behavior beyond the cited paths.
