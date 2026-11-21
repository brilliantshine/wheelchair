# Remediation 2 — quiet-card-close

Verification attempt 2 at `1f732426`: Claude verifier PASS; GPT verifier FAIL with one gap.

## Gap list (verbatim)

GAP: S1 validation — The committed duplicate-start test seeds an already-dismissed card, leaving the required closure of an open warning untested for that branch — `PLAN.md:77`, `viewer/test/app-quiet.test.js:109–111`.

Judgment: a Spec Validation item; fixed. The verifier confirmed the product behaviour by a direct API check. Not the same gap as Remediation 1.

## R2

# Brief R2 — duplicate-start test must use an open quiet card (quiet-card-close remediation 2)

Plan slug: `quiet-card-close`. Task id: **R2**. Lead session: `wc-4866136bd5dd-lead`.

## Gap
PLAN.md Validation asks that a raised (open) quiet card closes when the quiet session makes a duplicate start of a live child's attempt id. The test "child starts reset quiet card on new and duplicate starts, but not refusal" in `viewer/test/app-quiet.test.js` (~lines 103-112) seeds an already **dismissed** card for the duplicate start (`seedQuiet(f, f.sub, true)`), so closing an open card on that branch is untested. The product code is correct.

## Exact change (only this test)
Replace the last three lines of that test body (from `id = await seedQuiet(f, f.sub, true);` to the final assertion line) with:

```js
  id = await seedQuiet(f, f.sub);
  const dup = await machinePost(f.c, '/machine/session', { calling_session: f.sub.name, action: 'start', role: 'worker', attempt_id: 'new-child', brief: 'work' });
  assert.equal(dup.status, 200); assert.equal(dup.body.duplicate, true);
  const fresh = await f.read(); const sub = fresh.sessions.find(x => x.name === f.sub.name);
  assert.equal(sub.quiet_card, undefined); assert.equal(sub.quiet_stage, 0); assert.equal(fresh.cards.find(c => c.id === id).answered, true);
```

Keep the rest of the file unchanged. If `dup.body.duplicate` is not `true` (check `viewer/app/sessions.js` ~699 for the duplicate branch's return shape), stop and report what it returns rather than changing the assertion.

## Ownership boundary
Only `viewer/test/app-quiet.test.js` and your report `docs/plans/quiet-card-close/reports/R2.md`. No product code.

## Rules
- Never delete files with `rm` (or any other deletion). Never run `./install.sh`. Never start a viewer server by hand.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <exact paths>`. Your own `wc.js` and `card.js` calls are always allowed.
- If the same gate fails twice, stop and report rather than iterating.

## Validation (paste summary lines into your report)
```bash
node --test viewer/test/app-quiet.test.js
node --test viewer/test/*.test.js     # unquoted glob
```

## Deliverable
The commit and `docs/plans/quiet-card-close/reports/R2.md` with the pasted output and a closing section:

**Choices:** List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.

Then post your `result` card (task `R2`).
