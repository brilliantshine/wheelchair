# Map: overlap questions

```text
peer overlap -> user question -> decision -> plan or follow-up
                         -> pending review change -> triage -> apply -> next round
card post -> machine spool -> hub id -> receipt -> later retract
lead restart -> saved plan + cards + recent messages -> recover pending work
```

The current overlap rule asks another lead for information without waiting, then generally tells the user in one visible line; only a new overlap at the pre-review planning check becomes a PLAN Open Question (`protocol/app/lead.md:711`). Small fixes have no IDEA or PLAN, while features confirm IDEA before design questions (`protocol/app/lead.md:122`, `:187`). See [overlap decision flow](../../maps/overlap-decision-flow.md) for discovery, messaging, question and restart paths.

A review can already commit pending pull-backs before triage, but its `fixing` progress requires at least one finding; a pending change after a zero-finding round needs a defined transition (`protocol/app/lead.md:250`, `:323`; `protocol/app/cards.md:81`). Restart context includes non-replaced cards, all card ids/kinds and only the last 20 sent user/card messages, not delivered peer messages; pending changes need durable recovery and unambiguous matching (`viewer/app/threads.js:138`; `docs/plans/lead-chat/PLAN.md:461`). After Start building, the sub-lead owns the worktree (`protocol/app/lead.md:401`).

The hub assigns the id and normally returns the card, but `card.js` currently prints nothing and the machine can acknowledge a spool without a hub id (`viewer/app/card.js:285`; `viewer/app/cards.js:11`; `machine/service.js:2062`). Retraction needs that id and fails once the card is answered or replaced (`viewer/app/card.js:248`). The design must reconcile receipt behavior with durable offline posting and the Start/retract race (`viewer/app/threads.js:381`; `viewer/app/cards.js:89`).

The split-off review recorded early IDEA confirmation, small fixes, open questions at Start, stopping a running build, restart matching and zero-finding progress as unresolved design cases (`docs/plans/lead-chat/PLAN.md:435`, `:451`, `:466`).

Not checked: browser rendering details, all card types, and unrelated provider startup or failure paths.
