# Remediation 4 — thread-asides

Verification attempt 4 (verifier `wc-54ce860aef63-verifier-4`, GPT, commit
`de3a4955938956addb9649eacbed03303b84d1f2`): **FAIL**, one gap.

## Gap list (verbatim)

```
GAP: §5 Archiving / Remediation 3 — a lost POST response still leaves an untracked machine turn running after archive. `viewer/app/asides.js:123` returns null on POST failure, `:161` skips compensation, and `:198` excludes archived threads from further pumping. Running `node /tmp/thread-asides-verifier-real-race.js` against the real machine turn store, with only the CLI runner stubbed, printed `{"archived":true,"hubTurn":null,"machinePOST":202,"spawned":1,"machineStates":["running"],"needsPump":false,"deletes":1,"acks":0}`.
```

Sub-lead triage: confirmed, and it is **the same gap as Remediation 3** (archive leaves a
machine turn the hub no longer tracks), surviving its first fix. This is its second and last
fix attempt: if it survives this one, it goes to the lead as a plan defect
(`sub-lead.md`, "Finishing and verifying", step 6).

Root cause: the hub can't tell whether a POST whose response was lost started the turn, and
archive's `DELETE` can reach the machine *before* that POST does. No hub-side ordering fixes
that. The fix moves to the machine, where the race is decided: a `DELETE` for a `turn_id` the
machine doesn't know records a stopped tombstone, so a POST that arrives later with that id
hits the existing idempotency rule (§4: "a second POST with an id the machine already knows
returns that turn's state and starts nothing") and spawns nothing. Archive already DELETEs
every turn an aside holds, dispatching included (`viewer/app/threads.js:161-164`), so every
ordering is covered:
- POST arrives first → DELETE kills it (existing behaviour);
- DELETE arrives first → tombstone → the POST starts nothing.

Escalation: Remediation 3 was one failed try on this gap, so this task's effort steps up one
level (Standard's CLI default counts as high → xhigh), per the Settings escalation rules.

## Task R4-1 — brief

Role: read /home/collin/projects/personal/wheelchair/protocol/app/worker.md and follow it (it points you at cards.md).
Plan slug: thread-asides. Task: R4-1. Lead session (for questions): wc-54ce860aef63-lead.

Read this file, PLAN.md Spec §4 (the machine route and its idempotency rule) and §5
("Archiving"), then `machine/lib/aside-turns.js` (all of it), `machine/service.js:821-827`,
`machine/API.md`, `machine/test/aside-turns.test.js`, and `viewer/app/threads.js:157-170`.

**Ownership boundary:** `machine/lib/aside-turns.js`, `machine/test/aside-turns.test.js`,
`machine/API.md` (the DELETE row), `viewer/test/app-asides.test.js` (one test, below),
`docs/plans/thread-asides/reports/R4-1.md`. Nothing else: no change to `viewer/app/`. Never
run `./install.sh`. Never run `rm` or delete files.

**Decisions already made:**

1. **Tombstone on DELETE of an unknown id.** `stop(id)` for a `turn_id` not in the store
   validates it is a UUID (400 otherwise), then stores a record `{ input: null, state:
   "failed", error: "stopped", pid: null, pid_start: null, started_at: <now>, finished_at:
   <now>, reply: null, conversation_id: null, limit: false }`, saves the store, and answers
   200. DELETE of a known id behaves as today.
2. **A later POST with that id starts nothing.** `start()` already returns the existing record
   for a known id before validating or spawning; keep that, so a POST after a tombstone
   answers 200 with `state: "failed"` and spawns nothing. `GET` of a tombstone returns it like
   any finished turn.
3. **Lifetime.** Tombstones live under the existing rules: `ack` forgets one; the 30-day drop on
   load removes it. Restart recovery skips it (its state isn't `running`).
4. **Docs.** `machine/API.md` DELETE row: "Kill a running turn and mark it failed; finished
   turns are unchanged; an unknown id is recorded as stopped, so a later POST with that id
   starts nothing."

**Tests to add:**

- `machine/test/aside-turns.test.js`: DELETE an unknown UUID → 200; then POST a valid body with
  that `turn_id` → 200 with `state: "failed"`, and the fake CLI is never run (its run counter
  stays 0); GET → `failed`/"stopped"; the record survives a service restart (still a
  tombstone, not spawned, not "the machine restarted"); ack forgets it; DELETE of a non-UUID →
  400.
- `viewer/test/app-asides.test.js`: an archive test with a fake machine that **behaves like
  the store**: it keeps a map of known turn ids, makes DELETE of an unknown id a tombstone, and
  makes a POST of a known id start nothing. Hold the pass's POST so that archive runs first and
  its DELETE reaches the fake before the POST; then release the POST, with its response
  "lost" (the fake records the turn as known, then throws a timeout error to the hub). Assert
  that the fake never started a turn, and that the archived aside's history is unchanged.

**Validation.**

```bash
bash machine/test/run.sh
node --test viewer/test/app-asides.test.js      # three runs; paste all three
node --test viewer/test/*.test.js               # unquoted glob; run `npm --prefix viewer ci` once first
git status --short                              # only files in the boundary
```

Known baseline, not yours: "a starter that loses the freed port registers through the new
holder" (`docs/known-issues.md`). Under heavy machine load another viewer timing test can fail;
re-run that file alone and paste both outputs. Every other test must pass. Paste summary lines
and every failure in your report. If the same gate (excluding those) fails twice, stop and
report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or
piece of the design it affected. Write 'none' if there were none.
