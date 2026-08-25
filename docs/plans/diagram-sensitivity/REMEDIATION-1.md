---
slug: diagram-sensitivity
round: 1
date: 2026-08-25
verifiers: gpt-5.6-sol (PASS), claude (FAIL)
---

# Remediation 1 — the non-vacuity probes assert proxies, not behaviours

Two verifiers ran blind against the completed implementation, one from each family, as
`implemented-by: terra, sonnet` requires. The GPT verifier returned `VERDICT: PASS` after
39 command executions, including running every suite, sandboxing `HOME` to prove the install
preserves an existing level, and mutating `sensitivity/set.sh` to confirm its suite goes red.
The Claude verifier returned `VERDICT: FAIL` with one gap, and it is a gap about the tests
rather than the code — which is why the code-level lane missed it.

## The gap, verbatim

`GAP: §1 Validation — "the landed region contains … the ask planning carve-out **with its trigger stated** … [and] the repo-ownership-and-use-the-command sentence" — both probes assert a proxy substring that survives deleting the behaviour, so the two rules Round 7 was convened to add (Decisions 64 and 65) are unguarded — Mutation C: rewrote the `ask` bullet in protocol/sensitivity.md to "- `ask` — draw nothing unprompted, except as `{{WHEELCHAIR_ROOT}}/protocol/planning.md` already has it." (deleting "a planning turn discussing a proposed flow", i.e. all of Decision 65) → `bash sensitivity/test/run.sh` = RESULT 43 passed, 0 failed, because the probe at sensitivity/test/run.sh:190 is `grep -F 'protocol/planning.md'`. Mutation D: replaced the ownership paragraph (protocol/sensitivity.md:25-28) with "Three levels — `ask`, `default`, `high`. Move the dial with `/diagram-sensitivity <level>`." (deleting "owned by the wheelchair repo and rewritten in place", "never by editing these lines", and the silent-divergence warning, i.e. all of Decision 64) → RESULT 43 passed, 0 failed, because the probe is `grep -F '/diagram-sensitivity'`. Both mutations reverted. COMPLETION.md's "six phrase probes, one per behaviour that would otherwise vanish silently" is false for two of the six. Fix is two stronger probe strings.`

## Lead triage

**Upheld, and widened.** Both mutations reproduced exactly as reported. Two more were run
that the verifier did not:

| Mutation | What it deletes from the always-on block | Suite result |
|---|---|---|
| C (reported) | the `ask` carve-out's trigger, keeping the path | `RESULT 43 passed, 0 failed` |
| D (reported) | the ownership and never-hand-edit sentence, keeping the command name | `RESULT 43 passed, 0 failed` |
| E (lead) | the draw instruction — "read `<root>/protocol/graphs.md` and follow it" — entirely | `RESULT 43 passed, 0 failed` |
| F (lead) | two of the explanation instruction's three required elements | `RESULT 43 passed, 0 failed` |

So four of the Spec's region-contents items are unguarded, not two.

**F is inside the reported gap**, because the Spec's Validation section names the requirement
in the same sentence and in bold: the probe must cover the instruction to write an
`explanation` **"covering all three of shows / look at / leaves out."** The suite probes only
the third. That is the same defect — a probe asserting a fragment of the behaviour it claims
to guard — in a third place.

**E is outside the reported gap by the letter, and is included anyway.** The Spec's probe list
does not name the draw instruction, so nothing was breached. It is region-contents item 7, and
it is the one sentence without which the dial fires and nothing is ever drawn: an agent that
knows the level, knows the shape test, and is never told where to find the procedure produces
no picture at any setting. The Spec's own justification for having these probes at all is
"without this the whole suite goes green against a block that could not produce a picture,"
and a block missing item 7 is exactly that block. Adding it is one line. Fixing three of four
and leaving the most consequential one unguarded because the list did not think of it would be
satisfying the letter of the Spec against its stated intent.

**The underlying defect is one thing, not four.** Every probe was a short substring chosen
for being easy to grep, and a short substring survives any edit that keeps the words around
it. The probes also break on rewrapping a paragraph, which is the wrong sensitivity in both
directions: rewrapping should not fail, deleting a behaviour should. So the fix is not
"two stronger strings" but a change of method — probe the **flattened** region against phrases
that carry the behaviour itself.

## Task

Small-patch bypass, taken deliberately. `protocol/implementation.md` allows a Spec that is
"a small patch (a couple of files, nothing parallelizable)" to skip the fan-out, and this is
one file and a dozen lines. Routing it to a lane would not buy independence either: what
proves the fix is running the four mutations and watching the suite go red, and the lead runs
those whichever hand types the diff. Independence comes from the closure review instead — the
Claude verifier that found the gap re-verifies its own finding.

| # | Objective | Ownership boundary | Lane | Validation | Status |
|---|-----------|--------------------|------|------------|--------|
| R1 | Replace the region-contents probes with behaviour-bearing phrases matched against the flattened region, covering all four unguarded items: the `ask` carve-out's stated trigger, the ownership-and-use-the-command sentence, the draw instruction, and all three elements of the explanation instruction | `sensitivity/test/run.sh` | lead | `bash sensitivity/test/run.sh`, plus mutations C–F each driving it red, plus every other suite still green | completed |

**Objective.** Each probe must fail when the behaviour it guards is deleted from
`protocol/sensitivity.md`'s region, and must survive that paragraph being rewrapped.

**Deliverable.** The probe block in `sensitivity/test/run.sh`, matched against the region
extracted and newline-flattened rather than against raw file lines.

**Validation.** Mutations C, D, E and F applied one at a time to
`protocol/sensitivity.md` must each drive `bash sensitivity/test/run.sh` to a non-zero exit,
and the unmutated tree must stay green across all five suites.

## Round 2 — the closure review found a fifth

The Claude verifier re-verified its own finding and found one more instance of the same
class, which the first fix had not covered:

`GAP: §1 region contents, item 4 — the probe set covers what `default` draws, what `high` draws, and both halves of `ask`'s carve-out, but nothing asserts what `ask` itself does; the whole content of the lowest level can be deleted with the suite green — Mutation G: changed protocol/sensitivity.md:34 from "- `ask` — draw nothing unprompted. The one carve-out: a planning turn…" to "- `ask` — use your judgement. The one carve-out: a planning turn…" (carve-out sentence and `protocol/planning.md` path left fully intact) → `bash sensitivity/test/run.sh` = exit 0, RESULT 54 passed, 0 failed. The region now gives an agent no rule for `ask` at all beyond the exception. This is the level carrying IDEA.md's "Turning it down has to be a real off" constraint, and it is the one level of three with no behaviour probe. Reverted. Fix: one more row, e.g. `what ask draws|draw nothing unprompted`.`

**Upheld, and the response is not one more row.** Three rounds have now each found a
different region-contents item nobody wrote a probe for. Patching the newest one leaves the
next round to find the one after it. So the probe table is now **keyed to the Spec's
region-contents list by item number**, and auditing it is mechanical: walk the Spec's nine
items, check each has at least one row, an item with no row is the bug. That audit found the
fifth instance *and* a sixth nobody had reported — item 1, the three level names, which could
be deleted with the suite green.

**On the verifier's other two answers.** Both taken.

- *"atomically updates" in the router* — it argued fair shorthand, since each file's own write
  is atomic and the Boundaries section three lines down states the pair's real guarantee. Its
  reasoning is right, but it offered exact phrasing for free if the file were being touched
  anyway, and it was. `sensitivity/AGENTS.md:11` now reads "both files together, or neither."
- *The unexercised rollback* — it argued against testing it, because reaching the second
  rename needs either a race or an injection seam added solely for a test, and a seam that
  exists only for a test is the decision-seam fake this repo's testing rule forbids. Agreed,
  and not tested. Recorded in `sensitivity/AGENTS.md`'s boundaries instead, which is the honest
  version: the preflight is what delivers all-or-nothing and is what the suite reaches.

  **One claim of its own I did not accept.** It reported that a *directory* at
  `~/.codex/AGENTS.md` clears the preflight and still breaks the write, concluding the
  property "is real even where the rollback would have been the thing defending it." The
  outcome is right — exit 1, first file untouched — but the mechanism is not: `bash -x` shows
  it dying at `cat: Is a directory` under `set -euo pipefail`, **before either rename**. It
  never reaches the rollback, so it demonstrates nothing about it. Not repeated as evidence.

## Round 3 — coverage held, precision did not

The numbering worked as intended: the closure review walked the Spec's nine items, found every
one had a row, and then found the half the numbering does not give you.

`GAP: §1 region contents, item 5 — the row claiming to pin the floor's level scope asserts only the slogan, so the clause that makes the floor bind at `high` is deletable with the suite green — sensitivity/test/run.sh's row reads `item 5, the floor, at every level|No shape, no picture`, but the Spec's item 5 is "The floor: no shape, no picture, **at any level** … it is what stops `high` inventing boxes to fill a diagram it had already decided to draw." Mutation I: changed protocol/sensitivity.md:31-32 from "No shape, no picture — at every level, including \`high\`." to "No shape, no picture." → `bash sensitivity/test/run.sh` = exit 0, RESULT 56 passed, 0 failed. The region now states the floor with no scope, sitting three lines above "\`high\` — draw whenever a shape is present at all". Same pattern, second instance: Mutation J broadened item 6 from "At \`high\` the prose stays complete but terse" to "Prose everywhere stays complete but terse" → exit 0, 56/0, though the row is named "item 6, the high prose rule". Both reverted; protocol/sensitivity.md byte-identical.`

**Upheld. A row can be numbered against an item and still assert less than the item says.** In
both cases the row's *name* promised a scope — "at every level", "the high prose rule" — that
its *phrase* did not contain, so the scope could be deleted while the slogan stayed. Item 5's
scope is the clause that stops the top setting inventing boxes; item 6's is what confines the
prose-tightening rule to `high`.

**The audit ritual gains its second half**, which is the durable part of this round. Coverage
alone is what let these two through, so the comment above the table now states both checks:

> COVERAGE: walk the Spec's nine items, check each has a row; an item with no row is the bug.
> PRECISION: for each row, read its name and ask whether the phrase would still match with the
> named thing removed — if it would, the row asserts less than it claims.

The precision check is the verifier's own proposal, and it is the check that would have caught
this round's two in the previous one.

**Three other things in the same pass.**

- `sensitivity/AGENTS.md:25` said the region "is forty lines." It is 31 including markers. A
  router that lies is worse than no router, and a number is the easiest kind of lie to leave
  behind. Corrected.
- **A setup gate in `sensitivity/test/run.sh`.** A malformed source region used to surface as
  `sed: can't read …` five cases later, because no case checked that the writer had accepted
  `protocol/sensitivity.md` in the first place. The suite now runs one write up front and, if
  the writer refuses, prints the refusal and exits. The verifier called this optional; taken
  because the next person to break the region while editing it is the person who most needs the
  real error. Verified by breaking the end marker: the suite now prints `FATAL the writer
  refuses this repo's own protocol/sensitivity.md: … 1 start marker(s), 0 end marker(s)`.
- **The verifier retracted its directory-case sentence** after checking the trace: zero `mv`
  invocations, death at `cat: Is a directory`, trap cleaning all four temp files. Its corrected
  reading — that the pre-rename construction, not the rollback, is what protects the pair — is
  right and is what the router now says.

**One thing left alone on the verifier's advice.** Item 9's rule survives a wholesale rewrite of
its subject ("At `ask`, an agent ignores this block entirely") because that is a reword rather
than a deletion, and it falls inside the documented limit that a substring cannot catch
qualification. Adding machinery for that is not worth it; the region is 31 lines and is meant to
be read.

## Round 4 — the last one, and why it is the last

The fourth adversarial pass found an eighth instance, and this one is different in kind from
the two before it: it is a mistake **this plan already made once**.

`GAP: §1 region contents, items 4 and 7 — the two rows named "where that trigger already lives" and "where the drawing procedure lives" pin the path but not that it is reachable, so the `{{WHEELCHAIR_ROOT}}` prefix can be deleted from both and the region lands naming files an agent cannot open, suite green — Mutation N → `bash sensitivity/test/run.sh` = exit 0, RESULT 56 passed, 0 failed. The landed-equals-substituted-source assertion cannot catch this because it applies the same substitution to both sides.`

**Upheld.** Reproduced: with the prefix gone the block lands saying "read `protocol/graphs.md`
and follow it", a path that resolves to nothing from whatever directory the agent is standing
in — which is the entire reason `install.sh` renders wrappers instead of symlinking them. The
existing byte-comparison is blind to it by construction, running the same substitution over
both sides.

What separates this from the round's other survivors is that **someone actually made it**:
Round 7's finding Y3 records this region shipping a bare relative `protocol/planning.md` while
the sibling item correctly used the absolute form.

**Fixed with three assertions rather than three more rows**, because the property is about every
path the region will ever name, not about these two:

- the landed region names no path relative to nowhere (no backticked `` `protocol/ ``);
- it holds no unsubstituted `{{` placeholder;
- it names this clone by absolute path.

Two further survivors were reported and **deliberately not fixed**, on the verifier's own
recommendation: stripping the `` `ask` ``/`` `default` ``/`` `high` `` labels off the three
bullets, and deleting the verb from "Move the dial with". Neither is an edit a person makes,
and the second loses nothing an agent needs.

## Why this is the stopping point

Four rounds have each found one more slice of the same nine prose sentences — a whole missing
item, then a scope clause inside an item, now a path prefix inside a clause. The findings shrink
monotonically, and this round's was already covered by round 3's precision check: read the row
named "where the drawing procedure lives", ask whether its phrase still matches with the *where*
removed, and the answer is yes. The method did not fail; it was applied to the rows someone
suspected instead of to all nineteen.

But a sentence has no finite property set, so "no row asserts less than it claims" is testable
and never provable. A fifth round would find something. What says stop is not finding size but
**plausibility**: of this round's three survivors, exactly one is an edit a person would make,
and it had a precedent in this very plan. The other two are not edits anyone makes. When the
surviving mutations stop resembling real edits, the guard has reached its useful limit.

**So the last change is to what the guard claims, not to its phrase list.** The Spec bought this
as the cheap half of an accepted risk — the one property of the block that is checkable, standing
against a behaviour that is not. It was never a conformance test for the region, and four rounds
of sharpening had quietly let it drift toward being read as one. `sensitivity/AGENTS.md` and the
comment above the probe table now say what it is: a regression tripwire keyed to the plan's nine
items, catching a rule quietly disappearing; the authority for what the region must contain is
the plan, read by a person editing the region; a later round finding another slice adds a row and
is the tripwire working, not the method failing.

That framing has a bounded end state. "Every property of nine prose sentences is probed" does not.

## Closure — `VERDICT: PASS`

The verifier re-ran its own eighth finding against the fix and confirmed it, in both the form it
originally reported and a narrower one that leaves the second path absolute. It also checked the
code-level route: `set.sh` ceasing to substitute at all trips the placeholder check, the
absolute-path check and the landed-equals-source comparison.

**It corrected one overstatement of mine in the same breath**, which is recorded rather than
quietly fixed: I had written that the substitution failure trips all three new assertions. It
trips two — an unsubstituted `` `{{WHEELCHAIR_ROOT}}/protocol/ `` is not a backticked *relative*
path, so that probe stays green. Caught loudly either way, but by three checks rather than four.

**Two routes past the assertions are documented, not closed.** A path written unbackticked as
bare prose, or as `` `./protocol/planning.md` ``, both stay green. Each needs someone to reach
for a relative form this region has never used, in a file whose every other path is absolute, so
both fail the plausibility criterion this round adopted. The general property is one assertion —
every `protocol/` occurrence immediately preceded by the repo root — and it is **declined with a
reason**: it goes red the moment the region mentions `protocol/` in prose rather than as a path,
which is a false positive on an ordinary edit. Written down so a later round does not rediscover
the option without the reason.

Regression clean at closure: the six earlier mutations still red and each still naming its item;
the rewrap control across six widths and the four-simultaneous-reword control both green; spine
80/0, sensitivity 59/0, node 29/29, Chromium 25/25; tree otherwise unchanged and `./install.sh`
not run by the verifier.

The verifier's read on the two reframings: both accurate, and they route correctly in **both**
directions — they stop a reader over-trusting the probes, because they say outright what the
probes cannot see, and they stop a reader ripping them out as brittle, because a maintainer who
hits a red probe after rewording learns that updating the row is the expected move rather than
that the guard is broken.

## Outcome

Nineteen probes and six assertions replace six probes, keyed to the Spec's nine region-contents items, each pinning the
scope its name claims, matched against the flattened region. Assertion count 43 → 56.

**Ten deletions each drive the suite red, every one naming its item.** Two controls stay green:
every paragraph and bullet rewrapped to five different widths, and four behaviour-preserving
rewords applied at once. So the suite is strict about a rule leaving the block and indifferent
to the prose being reflowed or rephrased around it, which is the sensitivity worth having.

`protocol/sensitivity.md`'s region is byte-identical to what Stage 3 shipped across all four
rounds — `c6197fd28a506788…`, verified by hashing it against the live landed block with the path
substitution reversed. The tests were never fitted to the text. Evidence in COMPLETION.md's
"Remediation 1" section.
