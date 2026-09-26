# Remediation 1 — implementation-view

Verification round 1, 2026-09-26. Both verifiers returned FAIL.

## Gaps, verbatim

Claude verifier (checking T1, built by gpt-5.6-terra):

```
GAP: Routers (COMPLETION.md "The root AGENTS.md is unchanged") — T1 added about 190 lines to `viewer/server.js`, so the line citations in the root router now point at the wrong code, and the router sweep says a router that is now false is fixed in the same change — `AGENTS.md:121` cites `viewer/server.js:2108-2109` for the port-reuse branch, which is now at `:2303` (2108 is the start of `startServer`); `AGENTS.md:122` cites `:148` for "canonicalization drops unknown keys", which is now at `:157` (148 is `compareId`)
GAP: Format additions / "Run pictures" in protocol/graphs.md — all four new file:line pointers in the canonical rules are stale on this branch — `graphs.md:851` says `sameExceptPosition` is at `viewer/server.js:325` (actually `:367`); `:856` says `checkViewChanges` is at `:1349` (actually `:1507`); `:236` cites `viewer/index.html:885-894` for the badge line cap (now `:1028-1029`); `:843` cites `index.html:253-263` for face slotting (moved)
GAP: Validation, new server tests — several rollup and layout cases the Spec lists are not tested; the behavior is correct by my probes, but the required tests are missing — `viewer/test/run.test.js` has no child with no statused node (the `null` status case), no child with `needs-you` alongside `done` (COMPLETION admits this one), and its "non-run" child is `{run:false}`, which fails schema validation and so exercises the unreadable path, not a valid `run: false` file; the layout test uses a two-box A→B, not A→B→C, and has no plain-graph comparison
GAP: Left-to-right layout vs IDEA "he can see how the parts fit together" — the columns are only 24px apart, because the old 24px clearance between rows (`LAYER_GAP - GROUP_NODE_H`) became the gap between 200px-wide columns, so wires between adjacent columns share one 24px channel — probe chain x = 0, 224, 448; in the screenshot the wires `a→d` ("canonical bytes") and `choice→b` overlap in the channel, and the "passes" label sits between the boxes; this follows the Spec's own "swap roles in every spacing constant" arithmetic, so the fix needs a plan decision
GAP: Box contents vs IDEA "which files, databases or outside services each part reads or writes" — run-picture boxes show no kind tag, so a `store`, a `file` and an `external` box look the same, and `graphs.md:266-267` still says every box renders its kind as a text tag — `viewer/index.html:1514-1538` draws the kind and fork tags only when the graph is not a run picture; COMPLETION logs this as a T2 choice
```

GPT verifier (gpt-5.6-sol, checking T2 and T3, built by sonnet):

```
GAP: `needs-missing` — an empty `needs` value returns `run-field-shape`, although the Spec requires `needs-missing` — `viewer/server.js:216-230`; reproduced with a real PUT
GAP: Reserved run names — `run-A.json` with `run: false` is accepted despite `run-*.json` being reserved — `viewer/server.js:1535-1538`; reproduced with a real PUT returning 200
GAP: Loop-back wires — their endpoint tangents are deliberately non-horizontal, contrary to the socket-and-wire requirement — `viewer/index.html:1564-1582`
GAP: Full truncated needs text — a direct `needs-you` node’s `needs` value is never added to its detail panel — `viewer/index.html:1790-1825`
GAP: Restart record pointer — when an earlier `Stage 3 started` marker exists but no picture was moved, the instructions still tell the lead to name a nonexistent `graphs/before-run-<N>/` picture — `protocol/implementation.md:61-69`
GAP: Sequential ownership edge case — the canonical Stage 3 rules never say that a piece built by two tasks takes the currently active task’s id — required at `PLAN.md:487-489`, absent from `protocol/implementation.md:124-136`
GAP: Multi-piece and cross-file choices — Stage 3 does not preserve the required one-box ruling, multiple edges, first-file placement, or cross-file names in `note` — required at `PLAN.md:490-494`, absent from `protocol/implementation.md:183-195`
GAP: Choice split threshold — the canonical rules do not say choices are excluded from the 25-box threshold or that splitting is decided only at initial drawing — required at `PLAN.md:494-495`, absent from `protocol/implementation.md:105-122`
GAP: Required server validation cases — tests use only A→B, never exercise task-only position preservation, and omit the required mixed `needs-you` plus `done` rollup case — `viewer/test/run.test.js:77-114` versus `PLAN.md:524-531`
```

## Plan decisions this round

The column-spacing and kind-tag gaps followed the Spec as written, so the plan is what
failed there. The lead settled both as defensible defaults, recorded in PLAN.md: D56 (120px
between columns) and D57 (the top line always carries the kind tag). The loop-back gap is
settled by D58 (two cubic segments, horizontal at both sockets), which meets the Spec as
written. Collin can reopen any of them.

## Tasks

Routed to the family that built each piece. This is round 1, so briefs are sharpened and no
tier is raised.

| # | Gaps | Objective | Ownership | Lane | Validation |
|---|------|-----------|-----------|------|------------|
| R1 | `needs-missing`; reserved run names; server tests (both verifiers); column spacing | An empty `needs` on a `needs-you` node refuses `needs-missing`. `run-*.json` is reserved for any characters after `run-`. 120px between run-picture columns (D56). Add the missing server tests | `viewer/server.js`, `viewer/test/run.test.js`, `viewer/test/fixtures/run-*.json` | GPT / gpt-5.6-terra, resuming T1's thread | `node --test viewer/test/*.test.js` |
| R2 | Kind tag; loop-back wires; full needs text | Top line with the kind tag (D57), loop-back as two segments (D58), and the full `needs` text in the detail panel, each with a browser test | `viewer/index.html`, `viewer/test/run.spec.js` | Claude / sonnet | `npm --prefix viewer run test:browser` |
| R3 | Restart pointer; sequential ownership; multi-piece and cross-file choices; choice split threshold; stale citations in graphs.md and the root router; graphs.md for D56–D58 | Bring the prose up to the Spec, and re-cite every `file:line` in `protocol/graphs.md` and `AGENTS.md` against the merged code | `protocol/implementation.md`, `protocol/graphs.md`, `AGENTS.md` | Claude / sonnet, after R1 and R2 merge | read against the Spec; every cited line checked |
