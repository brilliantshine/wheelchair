---
slug: graph-legibility
round: 1
date: 2026-08-29
---

# Remediation 1

Two verifiers ran, each cross-family to part of a mixed implementation. The Claude lane returned
`VERDICT: PASS`. The GPT lane returned `VERDICT: FAIL` with two gaps.

## The gap list, verbatim

```
VERDICT: FAIL
GAP: Validation — neither required suite could execute its tests in this runner, so the claimed passes are independently unverifiable — the Node suite reports 0/36 passed because every test hits `listen EPERM: operation not permitted 127.0.0.1`; the browser suite reports 38/38 failed before page creation because Chromium terminates with `sandbox_host_linux.cc:41 … Operation not permitted`
GAP: Routers — COMPLETION.md says "no router named a file this change touched," but the protocol router explicitly names `graphs.md`, which this change modified; no router is stale, but the completion claim is false — COMPLETION.md:196, protocol/AGENTS.md:32
```

## Adjudication

| Gap | Lead verdict | Resolution |
|-----|--------------|------------|
| Validation — neither suite could execute | **declined** | The lane's own sandbox denied it a listening socket and denied Chromium its sandbox, so it never executed a line of the code under test — this is an observation about the runner, not about the work. Both suites do pass: the other verifier ran them independently on the branch head (36 node, 38 browser, real Chromium, nothing skipped), and the lead ran both before writing the report. Recorded in the gate line rather than dismissed, because it means half the cross-family check reached the source but not the gates. |
| Routers — the claim is false | **upheld** | Correct, and the paragraph contradicts itself: it reasons about `protocol/AGENTS.md:32` naming `graphs.md` two sentences before claiming no router names a file this change touched. The conclusion still holds — the rule in `protocol/implementation.md:88` turns on a change that *adds or removes* a file, and `graphs.md` was modified — but the stated reason was wrong. Sentence corrected. |

No task is routed to an implementer lane. The upheld gap is in the lead's own report, not in any
lane's output, and the fix is one sentence; a brief and a lane round-trip would buy nothing over
the lead correcting its own prose. Nothing in `viewer/` or `protocol/` changed as code.

## Also fixed, reported as an observation rather than a gap

The Claude verifier flagged `protocol/graphs.md:126` reading "it matters most exactly where it
matters most" — a garbled adaptation of the idea's "It is worst exactly where it matters most". It
sits in the paragraph that exists to make agents reach for the feature at all, in the one file an
agent reads before its first write, so it is worth the same care as a gap even though it violates
no spec item.
