---
slug: editable-node-graphs
round: 3
date: 2026-08-24
verifier: claude opus (closure)
implemented-by: lead (small-patch bypass)
---

# Remediation 3

Two gaps. Both fixed by the lead directly under Stage 3's small-patch bypass — each is a handful of
lines, both were precisely specified by the verifier, and a lane round-trip would have cost more than
the diff.

## 1. Round 2's temp sweep introduced a race that kills live processes

`GAP: §8/§13 atomic writes (round-2 gap 2) — the sweep's safety argument is false and the fix crashes
live processes: --open runs registerPath → saveRegistered → atomicWrite('.registered') from a
*separate process* with no mutex, so its sweepStaleTemps deletes another process's in-flight temp and
that process dies on rename — 24 concurrent --open invocations × 12 rounds against one cache root: 11
deaths with ENOENT: no such file or directory, rename ... ; the same script with sweepStaleTemps
removed: 0`

**This is a regression the lead accepted in round 2.** The sweep was put inside `atomicWrite` on the
argument that the global write mutex means a matching sibling can only be a leftover. That argument is
true for graph writes and false for the writable-set file, which `--open` writes from a short-lived
process holding no lock at all.

Reproduced independently by the lead, with no instrumentation: **57 deaths** against the round-2 form,
**0** against the fix.

The fix is the one the verifier pointed at: scope the sweep to graph writes. The orphan problem §13
cares about is an untracked file in a **committed** directory, and only a graph write can produce one —
the cache root is not committed. `sweepStaleTemps` moved out of `atomicWrite` and called explicitly at
the two graph-write sites, both inside the mutex, with the reasoning written at the call site so the
next reader does not re-derive it wrong.

## 2. Another assertion that cannot fail, in the sibling of the one round 2 fixed

`GAP: §13 "PUT /graph ignores known positions and lays out new nodes" — the layout half of the
assertion cannot fail; it checks only Number.isInteger, and rounded() makes every served coordinate an
integer unconditionally — server.test.js:272; replacing layout's body with positions.set(id,{x:0,y:0})
leaves this test passing while the pinned layout test fails`

Exactly the defect round 2 fixed in `layout places every component`, sitting in the test next to it.
Now pins the coordinate the layout is specified to produce.

Proven non-vacuous: with `layout()` replaced by one that stacks every node at the origin, the
assertion fails.

**A note on how the lead got this wrong first.** The expected coordinate was reasoned to rather than
measured — `{x: 480, y: 0}` — and the test rejected it with the real value, `{x: 240, y: 0}`. The three
unplaced ids sort `gather, new, timeline`, so `new` takes column one, not column two. Corrected against
the measurement. The test caught the lead exactly as it is meant to.

## Validation

```
$ ./install.sh && ./install.sh          # idempotent, tree clean
$ bash spine/test/run.sh
RESULT 80 passed, 0 failed
$ node --test 'viewer/test/*.test.js'
ℹ tests 24   ℹ pass 24   ℹ fail 0
$ npm --prefix viewer run test:browser
  16 passed (11.9s)
$ find viewer/test/.tmp -name '.*.tmp' | wc -l
0
$ node /tmp/race.js                     # 24 concurrent --open × 12 rounds, one cache root
concurrent --open deaths: 0 (ENOENT-on-rename: 0)
  # against the round-2 form of the same code: 57 deaths, all ENOENT on rename
```

## Non-blocking, carried from the closure review

| Observation | Standing |
|---|---|
| `retainDiskPositions` has no equivalent of the create path's guard, so an unplaced id on the **update** path gives a bare TypeError (still 500) instead of the named `InternalError` | Accepted. Same outcome, worse message. Worth tidying if that code is touched again |
| Corrupt-lock reclaim is untested; it works by hand at three truncation lengths | Accepted, and now low-value: hard-linking makes a half-written lockfile unreachable from this code |
| Four redundant assertions that cannot fail but carry no claim — each already guaranteed by the `expect.poll` above it | Accepted. Unlike the two real cases, none of these is the only assertion standing behind its test's claim |
| Half-even rounding is not discriminated by the `.5` fixtures | Accepted. The Spec names `Math.round`; half-even is not a plausible JavaScript mistake |
| Both cache-root isolation tests compare `null` to `null` on this machine | Accepted. They still fail on the leak they guard |
