# Remediation 2 — implementation-view

Verification round 2, 2026-09-26. Both verifiers resumed for the closure review, and both
returned FAIL.

## Gaps, verbatim

Claude verifier:

```
GAP: Validation, new server tests — "a write changing only `status`/`needs`/`task`/labels keeps every `x`/`y` from disk, including a dragged one. A write adding an edge relays out" — R1 removed the only test covering the status, needs and label changes with a drag, and the relayout on an added edge; neither is tested anywhere now, and COMPLETION.md still cites the deleted test — `git diff e20f312 HEAD -- viewer/test/run.test.js` drops the `relayout` block and the `status: 'needs-you', needs:, label:` update; the new test changes only `task`; `grep -n "relay" viewer/test/run.test.js` finds nothing; `COMPLETION.md:63` cites "run layouts…preserve drags for progress-only writes (dragged box kept; added edge relays out)" and `:61` cites "run layouts are left-to-right…", and no test has either name (my probe confirms the behavior itself is correct: drag kept at 901,337 after a status, needs and label change, laid out fresh to 0,0 after an added edge)
```

GPT verifier:

```
GAP: Box contents and height (D34) — long `needs` values are still truncated in the detail panel instead of shown in full — `viewer/index.html:1835-1836` adds the value as an ordinary field, while `:1861` and `:1918-1920` apply the default four-line limit; a 739-character probe rendered only 112 characters ending in an ellipsis
GAP: Required server validation — remediation replaced the original preservation test and removed coverage for label/status/needs-only writes and edge-triggered relayout — `PLAN.md:532-535` requires those cases, but `viewer/test/run.test.js:105-117` now changes only `task` and never adds an edge
GAP: D57 / choice-box contents — the amended Spec contradicts itself about whether choice boxes display their kind — `PLAN.md:96` and `:243-246` require a kind tag on every run box, while `:298-302` still says a choice face contains only its label
GAP: COMPLETION.md evidence and Routers — the remediation’s claim that the coverage table was re-cited is false, and the Router account remains internally stale — `COMPLETION.md:156-157` claims recitation, but `:85` points before the collection step now at `protocol/implementation.md:218`, `:86` points before “Never block” now at `:147`, and `:114` says root `AGENTS.md` was unchanged while `:171-175` says it was updated
```

## Settled by the lead (documents, not implementation)

- **D57 / choice-box contents:** the Spec's choice-face sentence now says a choice box carries
  its label and the kind tag, like every run box (PLAN.md, "Statuses and needs-you on the
  page").
- **COMPLETION.md evidence and Routers:** the `protocol/implementation.md` and `graphs.md`
  citations were re-checked line by line. The Routers section now says the root `AGENTS.md`
  had its line citations corrected in remediation 1.

## Tasks

Both code gaps survived round 1 as the same kind of defect: nearly-right work that missed a
case. Per `protocol/verification.md`, each takes one rung, in a fresh lane.

| # | Gaps | Objective | Ownership | Lane | Validation |
|---|------|-----------|-----------|------|------------|
| R4 | Required server tests (both verifiers) | Restore a test where a dragged box keeps its place through a status, needs and label change, and an added edge lays the picture out again. Keep every test R1 added | `viewer/test/run.test.js` | GPT / gpt-5.6-terra at `xhigh`, fresh lane | `node --test viewer/test/*.test.js` |
| R5 | Detail panel truncates long needs | The needs text in the detail panel shows in full at any length, for a direct needs-you node and each container entry, with a browser test using text of more than 700 characters | `viewer/index.html`, `viewer/test/run.spec.js` | Claude / opus (the next Claude rung) | `npm --prefix viewer run test:browser` |
