# Remediation 7 — thread-asides

Verification attempt 7 (verifier `wc-54ce860aef63-verifier-7`, GPT, commit
`6b3e5d3b7bbb770f0cc8980ce90f9cc1b2161865`): **FAIL**, two gaps. Both went to the lead before
any fix; the lead approved both fixes, adding the retry rule for gap 1 (Decision 20, Spec §5
amended). If verification 8 finds any archive gap again, the sub-lead stops and tells the lead:
that goes to Collin.

## Gaps (verbatim)

```
GAP: Decision 19 / Spec §4–§5 / Remediation 6 — A partially failed archive still acknowledges a cancelled turn. If the first aside's DELETE succeeds but the second times out, archive exits before saving (`viewer/app/threads.js:163`, `:168`). The next pump acknowledges the stopped result (`viewer/app/asides.js:170`, `:179`), deleting its tombstone. After archive is retried, a delayed POST starts an untracked turn. `node /tmp/wc-v7-partial-archive.js`, using the real hub and turn store with CLI launch stubbed, printed `acks:1,machineHasTurn:false`, then `archived:true,hubTurn:null,status:202,machineState:"running",starts:1`.
GAP: Spec §5 archived panel read-only — An already-closed aside displayed during archive retains enabled input and Send controls because the panel's change signature omits `thread.archived` (`viewer/pages/aside.js:95`). `node /tmp/wc-v7-panel-probe.js` printed `mainDisabled:true,asideDisabled:false,asideSendDisabled:false`.
```

## Task R7-1 — brief

Role: read /home/collin/projects/personal/wheelchair/protocol/app/worker.md and follow it (it points you at cards.md).
Plan slug: thread-asides. Task: R7-1. Lead session (for questions): wc-54ce860aef63-lead.

Read this file, PLAN.md Decisions 19 and 20 and Spec §5 "Archiving", then
`viewer/app/threads.js:157-185` (`archive`), `viewer/app/hub.js:42-60` (`init` and its timers),
`viewer/app/asides.js:147-200` (`pass`, `pump`, `needsPump`) and `viewer/pages/aside.js:93-96`.

**Ownership boundary:** `viewer/app/threads.js` (`archive` only), `viewer/app/asides.js`,
`viewer/app/hub.js` (`init` and the aside timer only), `viewer/pages/aside.js`,
`viewer/test/app-asides.test.js`, `viewer/test/app-asides.spec.js`, `viewer/app/API.md` (one
line on `pending_cancels`), `docs/plans/thread-asides/reports/R7-1.md`. Nothing else. Never
start a viewer server by hand on the default port. Never run `./install.sh`. Never run `rm` or
delete files.

**Decisions already made:**

1. **Archive saves first** (`threads.archive`, which already runs inside the thread's lock):
   for every aside, close it if open (as today); if it has a `turn`, append `turn.id` to
   `thread.pending_cancels` (create the array if missing; no duplicates) and set `turn = null`.
   **Save the thread.** Only then send `DELETE /v1/aside-turns/:id` for each id in
   `pending_cancels`. A 2xx or a 404 confirms the cancel: remove that id. Any other error
   leaves it pending, and archive **carries on** (it no longer throws on a failed cancel).
   Save again, then continue with `/v1/archive` exactly as today.
2. **The hub retries pending cancels itself.** Add `sweepCancels(hub, id)` to `asides.js`:
   inside `hub.withThread`, read the thread's `pending_cancels` (nothing to do if empty);
   outside the lock, send `DELETE` for each id to `thread.machine`; inside the lock again,
   re-read the thread and remove each confirmed id (2xx or 404) that's still listed; save. At
   most one sweep per thread runs at a time (a module-level set of thread ids; a sweep already
   running for that thread makes a new call return at once). It runs for archived and
   non-archived threads alike.
3. **When it runs:** the existing 2-second aside timer in `hub.js` also calls `sweepCancels`
   for every thread whose `pending_cancels` is non-empty; and `Hub.init` runs one sweep over all
   such threads right after the timers are set up (awaited errors are swallowed, as the timer
   does).
4. **Never acknowledged:** a turn id in `pending_cancels` is held by no aside, so Decision 19's
   rule already means `pass` never acknowledges it. Don't add an ack anywhere.
5. **Gap 2:** `panelChatSig` in `viewer/pages/aside.js` includes `value.thread.archived`, so an
   open panel re-renders, and its input and Send become disabled, when the thread is archived.
6. **API.md:** add one line saying the thread record carries `pending_cancels` (aside turn ids
   archive cancelled that the machine hasn't confirmed yet; the hub retries them).

**Tests:**

- `viewer/test/app-asides.test.js`, "a partly failed archive saves first and the hub retries the
  cancel": two asides with running turns; a store-like fake machine (known-id map; DELETE of a
  known or unknown id records `{state:"failed", error:"stopped"}`; POST of a known id starts
  nothing; `…/ack` deletes the id; copy it from the existing archive tests). The first DELETE
  succeeds and the second throws a timeout. Assert:
  - the archive completes, and the thread on disk is `archived: true` with both turns null and
    the second id in `pending_cancels`;
  - no `…/ack` is ever sent for either id;
  - one `sweepCancels` call (or one timer tick) sends the second DELETE, which now succeeds,
    and empties `pending_cancels`;
  - a delayed POST with the second turn's id, sent straight to the fake, starts nothing.
- Same file: a fresh `Hub` on a state directory holding a thread with a pending id sends that
  DELETE on `init()`.
- `viewer/test/app-asides.spec.js`: with the panel open on an aside, the next `/chat` response
  has `thread.archived: true`; within one poll the panel's "Ask more about this" input and its
  Send button are disabled.

**Validation.** First, once: `npm --prefix viewer ci` in your worktree.

```bash
node --test viewer/test/app-asides.test.js      # three runs; paste all three
(cd viewer && npx playwright test test/app-asides.spec.js)
node --test viewer/test/*.test.js               # unquoted glob
git status --short                              # only files in the boundary
```

Known baseline, not yours: "a starter that loses the freed port registers through the new
holder" (`docs/known-issues.md`). If another viewer test outside `app-asides` fails, re-run its
file alone and paste both outputs. If the same gate (excluding those) fails twice, stop and
report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or
piece of the design it affected. Write 'none' if there were none.
