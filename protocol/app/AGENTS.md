# `protocol/app/` — the app's role protocol

Owned by [`protocol/`](../AGENTS.md). The machine puts the role file and its card files, and for the lead, sub-lead, reviewer and verifier `realism.md`, into each session's starting instructions (Claude) or one composed file the session reads once (GPT, Antigravity, Kimi); the machine also loads `repo-law.md` after `realism.md`'s place for all seven roles, but not asides or a `role_prompt` override; asides keep their pointer. Reviewer and verifier get neither card file. Sessions do not need the slash-command stage files. Those stay untouched until a later feature retires them.

The organizing idea: **The user hears from the workflow only through cards and the lead's
visible replies.** Every file here is written around that, and `cards.md` and `cards-lead.md` are the contract
that makes it checkable: `viewer/app/card.js` validates against it.

| File | Read by | What it is for |
|---|---|---|
| `lead.md` | the lead of a thread | The whole lifecycle from the lead's side: small fix or offer, ideation, mapping, planning, silent review, approval and the Ready check, Start building, done, in-thread review fixes, stubs, restarts, which `status:` it writes and when |
| `sub-lead.md` | the sub-lead the lead starts at Start building | Running the build: decompose, brief, tier rules, escalation on evidence, merging workers, verification and its two-attempts rule, resuming after a restart |
| `designer.md` | a design session | Drafting and revising mockups for the lead |
| `mapper.md` | a mapping session | Building or reusing `docs/maps/` and the plan's MAP.md, committing only those paths |
| `worker.md` | a worker | Doing one briefed task inside its ownership boundary, asking the lead when the plan is silent, reporting |
| `reviewer.md` | a plan reviewer | The two lenses, the severity ladder and the one-line finding format; read-only |
| `verifier.md` | a verifier | Falsifying claims against the Spec or the reported problem; names the commit it checked |
| `realism.md` | lead, sub-lead, reviewer, verifier | The realism bar: normal use vs rare path, the always-fixed list, check once built; the machine loads it into those four roles' starting instructions |
| `repo-law.md` | lead, sub-lead, worker, mapper, designer, reviewer, verifier | The shared project law; the machine loads it after `realism.md`'s place for those seven roles, not asides or a `role_prompt` override |
| `aside.md` | an aside: one headless turn of a side conversation about part of a lead message | Who it is (a read-only copy of the lead's conversation), the `[wc:aside …]` message headers, the ask, simpler and draw actions, stepping up, and the one-line summary for the main thread |
| `cards.md` | every card-posting role: lead, sub-lead, worker, mapper, designer | Shared card rules, kinds, markers and commands |
| `cards-lead.md` | lead only | Lead-only card kind sections and fields |

## Boundaries

- **These files never reference the old stage-file communication rules or their record
  files.** The per-turn wording hook is gone. Leads follow the user's writing style from
  Settings instead.
- **A rule lives in one file.** Card fields live in `cards.md` or `cards-lead.md`, each in one place; a role file
  names a card kind and says when to post it.
- **No Mermaid here.** These are read by an agent mid-task, not rendered.
- `status:` in a plan's PLAN.md is the state machine: `lead.md` says who writes each value.
- The commands the files name (`viewer/app/card.js`, `viewer/app/wc.js`) are defined by
  the app plan, `docs/plans/app-shell/PLAN.md`; if a command's flags change, change the
  files that use it in the same commit.
