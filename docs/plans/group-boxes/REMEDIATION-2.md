---
slug: group-boxes
round: 2
date: 2026-08-30
verifiers: gpt-5.6-sol (closure review, resumed session)
---

# Remediation 2

The resumed GPT verifier returned `VERDICT: FAIL` on the closure review of Remediation 1.
It confirmed the new assertions consume the behaviour their mutations change, accepted two
of the three findings I had declined, and raised two gaps. **Both are upheld and both are
mine** — one a decline I got wrong, one a self-inflicted staleness.

## Gap list, verbatim, with the lead's verdict

| # | Gap | Verdict | Basis |
|---|-----|---------|-------|
| V1 | An explicit `visible: null` is canonicalized to `false`, although the Spec limits defaulting to an **omitted** key and refuses any non-boolean `visible` | `upheld` — reversing my round-1 decline | I declined this on consistency: every other key in the schema treats null as absent. The verifier's counter is better. `PLAN.md:128` says the default applies to an omitted key and `PLAN.md:347` refuses a non-boolean; `null` is neither omitted nor boolean. The consistency argument also cuts the other way — a group entry **already** distinguishes null from absent, because `label` and `note` carry null as a required value on an invisible group. And `IDEA.md` names refusing what it does not recognise as this server's character. One line |
| V2 | The coverage table's citations are stale again after remediation — geometry cites `browser.spec.js:1640` but the test starts at `:1753`, paint order `:1811` against `:1990`, measurement `:1924` against `:2135`, the edge-neighbour anchor `server.test.js:565` against `:664` | `upheld` | Entirely self-inflicted: I corrected the citations **before** integrating the two remediation lanes, and their twelve new tests shifted every line below them. The lesson is ordering — citations are the last thing to fix, never the first |

## What was done

**V1.** `viewer/server.js:196` now reads `raw.visible === undefined ? false : raw.visible`, so
an omitted key still defaults to `false` while an explicit `null` falls through to the
existing non-boolean check and draws `group-bad-shape`. A comment beside it says why this is
the one key in the schema where a null and a missing key differ. `protocol/graphs.md:314-316`
says the same in the defaults paragraph. A row was added to the refusal table test
(`viewer/test/server.test.js:264`); reverting the line to `?? false` fails it, checked.

**V2.** The whole Spec-coverage table was rebuilt against the final files rather than patched,
and the "not yet guarded" notes added in Remediation 1 removed, since every one of those gaps
is now closed. **Every citation in COMPLETION.md is now checked mechanically** — a script
resolves each `file:line` and `file:line-line` reference and fails on any that is out of range
or lands on a blank line. 37 distinct citations, 0 bad. That check is repeatable and is what
should be run before this document is trusted again.

## One thing the verifier could not do, and why its test output is not evidence

Its report contains a failing server suite (`listen EPERM`) and 51 failed browser tests
(`sandbox_host_linux.cc ... Operation not permitted`). Both are environmental. `codex exec
resume` takes no sandbox flags and does not carry forward the `-c
sandbox_workspace_write.network_access=true` the original dispatch was given, so the resumed
session could neither bind a localhost port nor start Chromium. It said so plainly and did not
claim otherwise, and its code-level reasoning stands on its own — but the numbers in that
section describe the sandbox, not the repo. The suites were run by the lead instead.

This is worth carrying into `protocol/lanes.md` if it recurs: a resumed lane silently loses
the `-c` overrides of the session it resumes.

## Validation after remediation

```
$ node --test 'viewer/test/*.test.js'
ℹ tests 52   ℹ pass 52   ℹ fail 0

$ npm --prefix viewer run test:browser
51 passed (27.0s)

$ ./install.sh && ./install.sh
both runs exit 0

$ python3 /tmp/checkcites.py
37 distinct citations checked, 0 bad
```
