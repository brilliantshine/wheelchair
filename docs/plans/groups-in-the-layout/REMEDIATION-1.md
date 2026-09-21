# Remediation 1 — 2026-09-21

Verification round 1 returned `FAIL` from both verifiers. **Every gap is in the test suite or
the completion report. Not one is an implementation defect**, and that distinction is what
scopes this round: no behaviour changes.

The server verifier established that positively rather than by omission. It built a mutation
harness and could not break the implementation: byte-identity holds as *file bytes* against a
`HEAD` worktree over 35 constructed graphs and all 72 real corpus files with no visible group;
across the 30 real group-bearing graphs no non-member lands inside a rectangle and no two
rectangles overlap, with backwards arrows falling from 90 to 4; both counter-example shapes
recorded in the plan's Log reduce crossings rather than raising them (1→0 and 2→1); and across
400–600 fuzzed group graphs the third pass never raises a crossing count, never changes a
rectangle or a member's row, never moves a non-member or an arrow-less member, and only ever
permutes the x multiset the first pass assigned — invariant under shuffling nodes, edges,
groups and member lists, and under reversing the group walk order.

What it did break is the suite. Seven of the Spec's test criteria are absent or vacuous, and
it proved each one by mutating the code and watching both suites stay green.

## Gaps, verbatim

**From the Claude-family verifier, over the GPT-built half:**

```
GAP: Tests — "The third pass never raises a group's crossing count. Assert it directly — count before and after" — no test counts crossings anywhere; deleting the keep-the-best guard line (`viewer/server.js:880`) outright leaves both suites green (45/45, 63/63). The guard is load-bearing — I proved a guard-free build raises the count on 7 of 400 fuzzed group graphs and differs from the real build on 11 — so this is an unguarded behaviour, not an equivalent mutant. COMPLETION.md:65 claims it is validated by the parallel-arrow test; that test cannot see a crossing count.

GAP: Tests — "A group where the all-neighbour key and an external-only key disagree comes out ordered by the all-neighbour key" — no such fixture exists; rewriting `reorderGroupedRows`'s median key (`viewer/server.js:873-876`) to read external neighbours only, the algorithm D20 superseded, leaves both suites green while changing the output of 34 of 600 fuzzed group graphs.

GAP: Tests — "The third pass gives the same result whichever order the groups are walked in — the one-snapshot requirement" — no test; replacing the frozen `snapshot` with live reads at `viewer/server.js:853` and `:860` leaves both suites green while changing 20 of 600 fuzzed graphs.

GAP: Tests — "No box that is not a member of a visible group falls inside that group's rectangle" — untested. The one test named for it, `viewer/test/server.test.js:613` ("…and leave every outsider clear"), has no non-member in its fixture: all four nodes are members. Reporting every group unit as `GROUP_NODE_W` wide (`viewer/server.js:831`) — which puts non-members inside rectangles, overlaps rectangles with each other, and draws boxes on top of each other on my fuzz corpus — passes 45/45 and 63/63.

GAP: Tests — "No component overlaps another, measured against real right edges rather than origins… needs a fixture with a wide group alone in one component" — that fixture does not exist. Reverting the cursor at `viewer/server.js:591` to the old `max - min + NODE_PITCH + COMPONENT_GAP` leaves both suites green, while putting the next component's first box at x=460 inside a group rectangle running to x=1288. This was Round 1's blocking finding and it has no regression test; COMPLETION.md:59 claims it is validated by the row-alignment and byte-identity tests, and neither sees it.

GAP: Tests — "A group's rectangle and every member's row are byte-identical before and after the third pass. This is the pass's whole safety argument and nothing else asserts it" — no test observes the pre-third-pass state. (I verified the property itself holds on 400 fuzzed group graphs; only the assertion is missing.)

GAP: Tests — "A member with no arrow… stays in the slot the first pass gave it… not because their key happens to hold them in place" — `viewer/test/server.test.js:638` is satisfied by letter only: the superseded implementation that keys an arrow-less member on its own x-centre, which Round 3 proved wrong, passes it, because `idle` sits in the rightmost slot with the largest key. The same applies to `viewer/test/server.test.js:655` for "two arrows between the same pair pull no harder than one": removing the endpoint dedupe at `viewer/server.js:850` leaves both suites green.

GAP: Dead code — `nodeBox` (`viewer/test/server.test.js:65`) and `setPositions` (`:74`) are defined and never called; both were live at HEAD and were orphaned by the deletion of the mechanism block. D22's `clearsGroupBox`/`GROUP_GAP` removal was done correctly; these two were missed.

GAP: COMPLETION.md accuracy — the write-path row cites `viewer/server.js:1219-1243`; the merged call is at `:1178`, inside `handleGraphPut` at `:1157-1195`. The three "Validated by" claims named in the gaps above (crossing guard, component cursor, pass-three snapshot) do not hold against the tests they name.
```

**From the GPT-family verifier, over the Claude-built half:**

```
GAP: Opening the picture — browser tests do not distinguish the too-tall or too-big-both-ways cases; an implementation that always centers the vertical axis would pass — `viewer/test/browser.spec.js:1588` only checks scale and that the tall fixture's header is onscreen, while `:1620` covers fits-both and `:1665` covers wide-only; required cases are specified at `docs/plans/groups-in-the-layout/PLAN.md:338`
```

## What actually failed, and why the brief is the cause

Stage 3's briefs told both lanes to implement the Spec's Tests section. Both did — they wrote a
test per criterion. What neither brief said is that **a test for a criterion has to fail when
the behaviour it names is removed**, and the Spec's criteria were written as descriptions of
correct output rather than as mutations to kill. A lane that writes the obvious test for
"no non-member falls inside a group's rectangle" reaches for a fixture of one group and its
members, and that fixture has no non-member in it. The criterion is satisfied, the property is
not guarded, and nothing in the brief catches the difference.

So this is a brief defect, not a model defect, and round 1 sharpens the brief rather than
changing tier. The sharpened version is below: every task names the exact mutation its test
must kill, and the verifier has already proved each mutation survives today. A test that does
not turn that mutation red has not done the job.

## Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|
| R1-A | Seven server-suite gaps: write a test for each that turns its named mutation red. Delete the two orphaned helpers | `viewer/test/server.test.js` | GPT / gpt-5.6-terra | | `node --test 'viewer/test/*.test.js'`, plus the mutation checks in the brief | dispatched |
| R1-B | Two opening branches: a graph too tall, and a graph too big both ways. Tighten the existing too-tall test so centring fails it | `viewer/test/browser.spec.js` | Claude / sonnet, own worktree | | `npm --prefix viewer run test:browser` | dispatched |
| R1-C | COMPLETION.md: correct the write-path citation and the three false "Validated by" claims | `docs/plans/groups-in-the-layout/COMPLETION.md` | lead | | read | done |

**No task in this round may edit `viewer/server.js` or `viewer/index.html`.** The
implementation passed verification; the only reason to touch it would be to make a test easier
to write, and that inverts what is being fixed.
