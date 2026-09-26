# Remediation 3 — implementation-view

Verification round 3, 2026-09-26. The Claude verifier passed. The GPT verifier failed.

## Gaps, verbatim

```
GAP: Box contents and height (D34) — `linesForAll` still truncates a single word longer than 32 characters — `viewer/index.html:425-426` returns one permitted line for one word, and `:406-417` replaces that word with `…`; a 739-character single-token probe rendered only `…`, while `viewer/test/run.spec.js:327-362` tests only many short words
GAP: D57 / choice-box contents — PLAN.md is corrected, but COMPLETION.md still claims a choice face has “label only” — `PLAN.md:301-302` and `viewer/index.html:1414-1416` include the kind tag, contradicting `COMPLETION.md:75`
GAP: COMPLETION.md citations — the claimed recitation remains stale after R5 shifted `viewer/index.html` — `COMPLETION.md:76` cites `:1826-1830` for the task id now at `:1834`; `:79` cites `:1125-1128` for reserved-name handling now at `:1132-1135`; and `:175` cites `:1826-1830` for direct needs text now at `:1845-1846`
```

## Settled by the lead

The two COMPLETION.md gaps are fixed. The choice row now says "label and kind tag", and every
`viewer/index.html` citation was shifted to match R5's added lines, then spot-checked.

## Brought to Collin

The needs-text gap has survived two remediation rounds (round 1: missing from the panel;
round 2: cut at four lines; round 3: a single over-long word cut). Collin chose to fix it
(D59).

## Tasks

| # | Gap | Objective | Ownership | Lane | Validation |
|---|-----|-----------|-----------|------|------------|
| R6 | Needs text, single long word | Break any word longer than 32 characters in the run picture's needs detail fields across lines, so the whole text shows. A browser test uses one 739-character word | `viewer/index.html`, `viewer/test/run.spec.js` | Claude / opus | `npm --prefix viewer run test:browser` |
