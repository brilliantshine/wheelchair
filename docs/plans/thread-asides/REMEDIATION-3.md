# Remediation 3 — thread-asides

Verification attempt 3 (verifier `wc-54ce860aef63-verifier-3`, GPT, commit
`fe1d2d49c86e1188b677588a9e7672a1db5bafde`): **FAIL**, one gap.

## Gap list (verbatim)

```
GAP: §5 Archiving — an in-flight dispatch can start a new turn after archive finishes. `viewer/app/asides.js:116` POSTs after a delayed GET returns 404 without rechecking the thread; `viewer/app/threads.js:160` has already attempted DELETE and cleared the turn. An isolated reproduction using the real machine turn store and a stubbed CLI runner returned `{"archived":true,"hubTurn":null,"machinePOST":202,"spawned":1,"machineStates":["running"]}`. With a retained worktree, this leaves a running turn the archived thread no longer tracks.
```

Sub-lead triage: confirmed. A new gap, introduced by Remediation 2's lock split, whose brief
said "on 404 for a dispatching item, POST the recorded body" without a recheck (a brief
defect). The Remediation 2 gap itself (polls blocking Done) passed. Fix both halves of the race:
recheck before the POST, and cancel on the machine any turn that ends up running for an aside
that no longer holds it.

## Task R3-1 — brief

Role: read /home/collin/projects/personal/wheelchair/protocol/app/worker.md and follow it (it points you at cards.md).
Plan slug: thread-asides. Task: R3-1. Lead session (for questions): wc-54ce860aef63-lead.

Read this file, PLAN.md Spec §5 ("Archiving"), `REMEDIATION-2.md` (the claim/call/apply
design you keep), then `viewer/app/asides.js:83-180` and `viewer/app/threads.js:157-170`.

**Ownership boundary:** `viewer/app/asides.js`, `viewer/test/app-asides.test.js`,
`docs/plans/thread-asides/reports/R3-1.md`. Nothing else. Never start a viewer server by hand
on the default port. Never run `./install.sh`. Never run `rm` or delete files.

**Decisions already made:**

1. **Recheck before POST.** In `call`, when the GET returns 404 for a `dispatching` item,
   before POSTing take `hub.withThread` just long enough to re-read the thread (no machine call
   inside the lock): POST only if the thread is not archived and the aside still holds
   `turn.id === item.turnId` with `state === "dispatching"`. Otherwise return null (no POST).
2. **Compensate a turn nobody holds.** In the apply phase of `pass`, an item whose aside no
   longer holds that turn id (or whose thread is archived) is not simply skipped:
   - if its result is `running` (a POST that was accepted, or a GET that says running), add it
     to a `cancels` list;
   - if its result is `ok` or `failed`, add it to the `acks` list (the machine can forget it).
   After the lock is released, for each cancel send `DELETE /v1/aside-turns/:id` and then
   `POST …/ack`, each ignoring errors (a 404 means already gone). Nothing is written to the
   aside for these.
3. Everything else in `asides.js` stays as Remediation 2 built it. No other file changes.

**Tests to add** (in `viewer/test/app-asides.test.js`, fake machine with a GET you can hold):

- Archive while a `dispatching` turn's GET is held, then release the GET with 404: no POST is
  sent (the fake records calls).
- Archive lands between the recheck and the POST (make the fake's POST handler archive the
  thread first, then answer 202): after the pass, the fake receives `DELETE
  /v1/aside-turns/<id>` and `POST …/ack` for that turn, and the archived aside's history is
  unchanged.
- A turn held by no aside that the machine reports `ok` is acked and nothing is added to
  history.
- Every existing aside test still passes.

**Validation.** First, once: `npm --prefix viewer ci` in your worktree.

```bash
node --test viewer/test/app-asides.test.js      # run it three times; paste all three
node --test viewer/test/*.test.js               # unquoted glob
git status --short                              # only files in the boundary
```

Known baseline, not yours: "a starter that loses the freed port registers through the new
holder" (`docs/known-issues.md`). Every other test must pass. Paste summary lines and every
failure in your report. If the same gate (excluding that) fails twice, stop and report rather
than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or
piece of the design it affected. Write 'none' if there were none.
