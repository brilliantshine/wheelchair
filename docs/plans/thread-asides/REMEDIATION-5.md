# Remediation 5 — thread-asides

Verification attempt 5 (verifier `wc-54ce860aef63-verifier-5`, GPT, commit
`83fd3f076154a7401dd7584288d262a5fca9b2d7`): **FAIL**, one gap, the archive gap surviving
Remediations 3 and 4. Escalated to the lead as a plan defect; Collin decided (Decision 19,
option A): the hub never acknowledges a turn it cancelled. Spec §4/§5 and Accepted Risks are
amended in PLAN.md. This remediation implements that decision.

## Gap (verbatim)

```
GAP: Spec §5 Archiving / Remediation 4 — A delayed, timed-out POST can start an untracked turn after archive. If a retry is accepted and archive retains the worktree, compensation acknowledges the stopped turn (`viewer/app/asides.js:176-179`), deleting its cancellation record (`machine/lib/aside-turns.js:69`). The original delayed POST can then spawn again. Reproduction: `node /tmp/wc-verifier-5-race.js` printed `archived:true, hubTurn:null, machineHasTurn:false, starts:1`, followed by `status:202, machineState:"running", starts:2, hubTurn:null`.
```

## Task R5-1 — brief

Role: read /home/collin/projects/personal/wheelchair/protocol/app/worker.md and follow it (it points you at cards.md).
Plan slug: thread-asides. Task: R5-1. Lead session (for questions): wc-54ce860aef63-lead.

Read this file, PLAN.md Decision 19 and Spec §4 (the paragraph on acknowledging) and §5
("Archiving"), then `viewer/app/asides.js:147-185` (`pass`) and `viewer/test/app-asides.test.js`
(the tests "archive races compensate claimed turns without changing history" and "archive
tombstones a delayed POST whose response is lost").

**Ownership boundary:** `viewer/app/asides.js`, `viewer/test/app-asides.test.js`,
`docs/plans/thread-asides/reports/R5-1.md`. Nothing else (the machine side already keeps a
stopped record until the 30-day drop; don't touch `machine/`). Never run `./install.sh`. Never
run `rm` or delete files.

**The change (decided, transcribe it):**

1. In `pass`, the loop over `cancels` sends only `DELETE /v1/aside-turns/:id`. Remove the
   `POST …/ack` that follows it. Nothing else in `pass` changes: results the hub saved into an
   aside are still acknowledged, and an `ok`/`failed` result for a turn no aside holds is still
   acknowledged (it was never cancelled by the hub).
2. `viewer/app/threads.js` archive already sends no ack; leave it.

**Tests:**

- Update "archive races compensate claimed turns without changing history": in the scenario
  where the turn is cancelled (`before post response`), assert **no** ack is sent for that
  turn (today it asserts one). Keep the scenario where an `ok` result for an unheld turn is
  acknowledged.
- Add "a cancelled turn is never acknowledged, so a late start runs nothing", reproducing
  verifier 5's case against a fake machine that behaves like the store (copy the store-like fake
  from "archive tombstones a delayed POST whose response is lost": a map of known ids, DELETE of
  an unknown id records `{state:"failed", error:"stopped"}`, POST of a known id starts nothing,
  `…/ack` deletes the id). Sequence: the pass's POST is accepted by the fake (the id becomes
  known, `starts === 1`) but the response is held; archive runs (DELETE → the fake marks it
  stopped); release the response; let the pass finish. Then assert the hub sent no `…/ack` for
  that id, the fake still knows the id as stopped, and a second POST with the same body (the
  "delayed original") sent directly to the fake starts nothing (`starts` still 1). History
  unchanged.

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
