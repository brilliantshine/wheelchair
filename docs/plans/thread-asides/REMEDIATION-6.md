# Remediation 6 — thread-asides

Verification attempt 6 (verifier `wc-54ce860aef63-verifier-6`, GPT, commit
`83eccbbf090f55587475a178023bc4dfc0003533`): **FAIL**, one gap. Cause: Remediation 5's brief
implemented Decision 19 only in part. It kept acknowledging an `ok`/`failed` result for a turn
no aside holds, and after archive a cancelled turn polls back as `failed`/"stopped". The lead
approved applying Decision 19 fully (no new choice for Collin): **the hub never acknowledges a
turn no aside holds, whatever its state.** This remediation corrects Remediation 5's brief. If
verification 7 still finds this gap, the sub-lead stops and tells the lead before any further
fix.

## Gap (verbatim)

```
GAP: Decision 19 / Spec §4–§5 / Remediation 5 — A poll returning `failed: stopped` after archive still triggers acknowledgement (`viewer/app/asides.js:164,180`), deleting the cancellation record (`machine/lib/aside-turns.js:69`). A delayed POST can then restart that untracked turn. `node /tmp/wc-verifier-6-race.js`, using the real hub and turn store with CLI launch stubbed, printed `archived:true, hubTurn:null, machineHasTurn:false, acks:1`, followed by `status:202, machineState:"running", starts:2`.
```

## Task R6-1 — brief

Role: read /home/collin/projects/personal/wheelchair/protocol/app/worker.md and follow it (it points you at cards.md).
Plan slug: thread-asides. Task: R6-1. Lead session (for questions): wc-54ce860aef63-lead.

Read this file, PLAN.md Decision 19, then `viewer/app/asides.js:147-185` (`pass`) and, in
`viewer/test/app-asides.test.js`, the tests "archive races compensate claimed turns without
changing history" and "a cancelled turn is never acknowledged, so a late start runs nothing".

**Ownership boundary:** `viewer/app/asides.js`, `viewer/test/app-asides.test.js`,
`docs/plans/thread-asides/reports/R6-1.md`. Nothing else. Never run `./install.sh`. Never run
`rm` or delete files.

**The change (decided, transcribe it):** in `pass`, inside the branch for an item whose aside no
longer holds the turn (or whose thread is archived), delete the line

```js
else if (['ok', 'failed'].includes(item.result.state)) acks.push({ machine: item.machine, turnId: item.turnId });
```

so that branch only queues a cancel for a `running` result and otherwise does nothing. Results
saved into an aside are still acknowledged, as today. No other code changes.

**Tests:**

- In "archive races compensate claimed turns without changing history", the `finished unheld`
  scenario now expects **no** ack (today it expects one). Every scenario expects 0 acks.
- Add "a stopped result after archive is never acknowledged, so a late start runs nothing",
  reproducing verifier 6's case with the store-like fake from "a cancelled turn is never
  acknowledged, …" (known-id map; DELETE of an id records `{state:"failed", error:"stopped"}`;
  POST of a known id starts nothing; `…/ack` deletes the id). Sequence: the pass's POST is
  accepted (`starts === 1`); archive runs (DELETE → stopped); then run another pass, or let the
  same pass poll, so the hub GETs the turn and receives `{state:"failed", error:"stopped"}` for
  a turn no aside holds. Assert no `…/ack` was sent for that id, the fake still holds it as
  stopped, and a delayed duplicate POST with the same body sent straight to the fake starts
  nothing (`starts` still 1). History unchanged.

**Validation.** First, once: `npm --prefix viewer ci` in your worktree.

```bash
node --test viewer/test/app-asides.test.js      # three runs; paste all three
node --test viewer/test/*.test.js               # unquoted glob
git status --short                              # only files in the boundary
```

Known baseline, not yours: "a starter that loses the freed port registers through the new
holder" (`docs/known-issues.md`). If another viewer test outside `app-asides` fails, re-run its
file alone and paste both outputs. If the same gate (excluding those) fails twice, stop and
report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or
piece of the design it affected. Write 'none' if there were none.
