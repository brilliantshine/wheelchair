---
slug: editable-node-graphs
round: 2
date: 2026-08-24
verifiers: gpt-5.6-sol (closure on its own gaps), claude opus (fresh, full re-verification)
---

# Remediation 2

Round 1 closed six of seven gaps. Both verifiers returned `FAIL` again, on four gaps between them.
**Three of the four are tests that cannot fail** — the same class that let a real user-facing bug pass
two suites in round 1, and the thing both verifiers were explicitly told to hunt. Finding more of them
is the instruction working, not a surprise.

The fresh verifier ran everything: `install.sh` idempotent, 80/80, 24/24, 16/16, never-skip proven by
pointing Playwright at an empty browser path (16 failed, loudly), the producer sequence run verbatim
from genuinely cold through to a graph on disk, and containment driven by hand through the page. It
also confirmed all six lead decisions are faithful and the router sweep is true.

Every gap below was reproduced by the lead.

## Gaps

### 1. The lockfile claim is still observable as an empty file — *survived round 1*

`GAP: §8 discovery — the exclusive lock claim is still briefly observable as an empty/corrupt file —
server.js:805 publishes the pathname before server.js:815 writes its payload, while the test hook
pauses only after closeSync at server.test.js:83, after the unsafe interval has ended`

Round 1 moved the payload write onto the exclusively-created descriptor and fsynced it, which is a
real improvement — but `open(..., 'wx')` **creates the file before anything is written to it**. A
second starter in that window reads an empty file, judges it corrupt, unlinks it and claims its own.

Reproduced by reading `viewer/server.js:803-818`. The standard fix is different in shape: write the
payload to a temp file, then `link()` it into place — `link` fails if the target exists, so
exclusivity and content arrive together.

The round-1 test **cannot reach this race**: it pauses after `closeSync`, by which point the payload
is already there.

### 2. A killed write leaves its temp file behind

`GAP: §8/§13 atomic writes — SIGKILL before rename leaves an untracked temporary file beside a
committed plan graph — server.js:448 creates the sibling .tmp file and cleanup at server.js:459
cannot run after SIGKILL; the new test at server.test.js:416 checks only the committed filename's
bytes and never asserts that the temporary sibling was removed`

Reproduced: after running the suite, `find viewer/test/.tmp -name '.*.tmp'` returns **11 files**.

In a real plan the temp sits in `docs/plans/<slug>/graphs/`, which is committed — so a crashed write
leaves an untracked file in a tracked directory, and §13's own validation requires
`git status --porcelain` to be empty. Surfaced by round 1's new fault-injection test, which is what a
good test does.

### 3. The layout test cannot fail on the bug it exists for

`GAP: §13 "layout places every component, including a disconnected two-cycle" / decision 98 — the
assertion cannot fail on the bug it was written for; it checks only Number.isInteger(node.x), and an
unplaced node keeps the 0 that validateGraph defaults it to — server.test.js:481 asserts
Number.isInteger; server.js:133 defaults x to 0; server.js:664 Object.assign(node,
positions.get(node.id)) is a silent no-op for an unplaced id. Reverting layout() to the
pre-decision-98 single-seed form and running that test alone: pass 1, fail 0`

This is the worst of the four, and it has **two** halves.

The test half: it is the only guard on decision 98 — the re-seed that places a disconnected cycle
sitting beside an ordinary source chain — and the verifier proved it passes against the reverted,
broken layout.

The code half, which matters more: `Object.assign(node, positions.get(node.id))` is a **silent no-op**
when the layout never placed that id, and the node keeps the `0` the validator defaulted it to. So the
server quietly writes a graph with unplaced nodes stacked at the origin instead of refusing. Confirmed:
`Object.assign(node, undefined)` does not throw. A layout that fails to place a node is a bug in the
layout, and the server should say so rather than paper over it.

### 4. Rounding half-up is asserted by nothing

`GAP: §13 "Canonical round-trip" — the non-canonical fixture is specified to carry float positions
and does not, so §3/decision 89's Math.round half-up rule is asserted by no test in either suite —
noncanonical.json has zero non-integer x/y; server.test.js:126 sends x = 99.6 on PUT /view and never
asserts the stored value`

Reproduced: the fixture has no non-integer positions at all. §13 names "float positions" as one of the
four things that fixture is supposed to be non-canonical *in*. The behaviour is correct — the verifier
sent `99.6` and `-0.5` through and disk shows `100` and `0` — so this is a missing guard, not a live
bug.

## Routing

One fresh GPT Terra lane at **`xhigh`**, not a tier change.

The lockfile gap is the only survivor, and it is the "nearly-right work that missed an edge case"
failure mode `lanes.md` names: the lane understood the problem, moved the write onto the exclusive
descriptor, and missed that `open` itself publishes the name. That buys the effort rung, not the tier
rung — a lane that misread the shape of the task would get the tier, and this one did not. The other
three are new, surfaced by better tests rather than by a lane doing worse.

Fresh lane rather than a resume, per `lanes.md`: a resume hands the next rung a context full of the
last one's dead ends.

## Non-blocking observations, recorded

| Observation | Standing |
|---|---|
| The edge detail panel **fully occludes** the node it lands on — measured at 100% area with the label covered, so it reads as if that node had been relabelled | Worse than round 1 recorded it ("darkens"). Still Collin's call, but he is being told the corrected measurement |
| `protocol/graphs.md`'s worked slug example is 51 characters against its own 40-character rule | Folded into this round — one-line fix, no behavioural consequence |
| "After the page's own write it does not reload" is asserted by nothing | Accepted. A spurious self-reload would discard nothing; the page holds no unsaved state |
| Both cache-root isolation tests compare a directory that does not exist on this machine, so both snapshots are `null` | Accepted. They can still fail if a test creates it, which is the thing they guard |
