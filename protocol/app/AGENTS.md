# `protocol/app/` — the app's role protocol

Owned by [`protocol/`](../AGENTS.md). Every agent session the app starts is told one thing:
read your role file here. Each file stands alone for its role, so a session never needs
the slash-command stage files. Those stay untouched until a later feature retires them.

The organizing idea: **Collin hears from the workflow only through cards and the lead's
visible replies.** Every file here is written around that, and `cards.md` is the contract
that makes it checkable: `viewer/app/card.js` validates against it.

| File | Read by | What it is for |
|---|---|---|
| `lead.md` | the lead of a thread | The whole lifecycle from the lead's side: small fix or offer, ideation, mapping, planning, silent review, approval and the Ready check, Start building, done, in-thread review fixes, stubs, restarts, which `status:` it writes and when |
| `sub-lead.md` | the sub-lead the lead starts at Start building | Running the build: decompose, brief, tier rules, escalation on evidence, merging workers, verification and its two-attempts rule, resuming after a restart |
| `mapper.md` | a mapping session | Building or reusing `docs/maps/` and the plan's MAP.md, committing only those paths |
| `worker.md` | a worker | Doing one briefed task inside its ownership boundary, asking the lead when the plan is silent, reporting |
| `reviewer.md` | a plan reviewer | The two lenses, the severity ladder and the one-line finding format; read-only |
| `verifier.md` | a verifier | Falsifying claims against the Spec or the reported problem; names the commit it checked |
| `aside.md` | an aside: one headless turn of a side conversation about part of a lead message | Who it is (a read-only copy of the lead's conversation), the `[wc:aside …]` message headers, the ask, simpler and draw actions, stepping up, and the one-line summary for the main thread |
| `cards.md` | every role | Every card kind and its JSON fields, which are shown, how a button press comes back, the message markers, and the `card.js`, `wc.js git` and `wc.js session` commands |

## Boundaries

- **These files never reference the old stage-file communication rules or their record
  files.** The per-turn wording hook is gone. Leads follow Collin's writing style from
  Settings instead.
- **A rule lives in one file.** The card fields live only in `cards.md`; a role file
  names a card kind and says when to post it.
- **No Mermaid here.** These are read by an agent mid-task, not rendered.
- `status:` in a plan's PLAN.md is the state machine: `lead.md` says who writes each value.
- The commands the files name (`viewer/app/card.js`, `viewer/app/wc.js`) are defined by
  the app plan, `docs/plans/app-shell/PLAN.md`; if a command's flags change, change the
  files that use it in the same commit.
