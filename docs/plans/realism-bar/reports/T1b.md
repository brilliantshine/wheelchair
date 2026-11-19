# T1b — realism-bar wording fixes

1. **Done** — `protocol/app/realism.md:13`; replaced the rare-path example wording.
2. **Done** — `protocol/app/reviewer.md:54-57`; replaced the settled-findings paragraph.
3. **Done** — `protocol/app/sub-lead.md:244,247`; clarified the PLAN.md-only record commit and outcome after the lead answers.
4. **Done** — `protocol/app/sub-lead.md:248-249`; updated the PASS condition and wrapped the line.
5. **Done** — `protocol/app/sub-lead.md:274-276`; clarified that only remediation gaps count.
6. **Done** — `protocol/app/lead.md:253`; added that a pulled-back item is fixed like any Spec item.
7. **Done** — `protocol/app/lead.md:320-321,407-408`; rewrapped both prose passages without changing their words.
8. **Done** — `protocol/templates/PLAN.md:73-74`; added that listed checks stay as review history.

## Validation

`grep -n "RE-RAISE\|unusual screen\|needs no re-verification\|that go to\|fixed like any Spec item\|stays as review history\|after rare-path judgment" protocol/app/*.md protocol/templates/PLAN.md`

```text
exit 0
protocol/app/lead.md:109:needs no re-verification and is not an unverified commit for the repair rules. A check with
protocol/app/lead.md:253:same item; the item is then fixed like any Spec item.
protocol/app/realism.md:13:  writes; unusual screen layouts or versions the tool does not ship.
protocol/app/sub-lead.md:244:   and commit; that PLAN.md-only record commit needs no re-verification. The attempt's
protocol/app/sub-lead.md:248:4. **PASS**: once the merged list is empty after rare-path judgment, post `phase: clean`,
protocol/app/sub-lead.md:252:4a. In a lighter mode, when the merged list is non-empty after rare-path judgment and before
protocol/app/sub-lead.md:274:5. **FAIL**: post `phase: fixing` with `found` equal to the distinct gaps that go to
protocol/templates/PLAN.md:74:stays as review history.
```

`node --test viewer/test/protocol-rules.test.js`

```text
exit 0
TAP version 13
# Subtest: worker permits its own commands
ok 1 - worker permits its own commands
  ---
  duration_ms: 3.548755
  type: 'test'
  ...
# Subtest: mapper permits its own commands
ok 2 - mapper permits its own commands
  ---
  duration_ms: 0.402953
  type: 'test'
  ...
# Subtest: sub-lead permits its own commands
ok 3 - sub-lead permits its own commands
  ---
  duration_ms: 0.308572
  type: 'test'
  ...
# Subtest: lead permits its own commands
ok 4 - lead permits its own commands
  ---
  duration_ms: 0.541919
  type: 'test'
  ...
# Subtest: cards permits its own commands
ok 5 - cards permits its own commands
  ---
  duration_ms: 0.295016
  type: 'test'
  ...
# Subtest: worker reports conflicts instead of stopping silently
ok 6 - worker reports conflicts instead of stopping silently
  ---
  duration_ms: 0.579771
  type: 'test'
  ...
# Subtest: mapper reports conflicts instead of stopping silently
ok 7 - mapper reports conflicts instead of stopping silently
  ---
  duration_ms: 0.32345
  type: 'test'
  ...
# Subtest: sub-lead reports conflicts instead of stopping silently
ok 8 - sub-lead reports conflicts instead of stopping silently
  ---
  duration_ms: 0.351223
  type: 'test'
  ...
# Subtest: reviewer reports obstacles instead of stopping silently
ok 9 - reviewer reports obstacles instead of stopping silently
  ---
  duration_ms: 2.443154
  type: 'test'
  ...
# Subtest: verifier reports obstacles instead of stopping silently
ok 10 - verifier reports obstacles instead of stopping silently
  ---
  duration_ms: 2.611347
  type: 'test'
  ...
# Subtest: worker waits for background work in the foreground
ok 11 - worker waits for background work in the foreground
  ---
  duration_ms: 0.45931
  type: 'test'
  ...
# Subtest: mapper waits for background work in the foreground
ok 12 - mapper waits for background work in the foreground
  ---
  duration_ms: 0.251161
  type: 'test'
  ...
# Subtest: sub-lead waits for background work in the foreground
ok 13 - sub-lead waits for background work in the foreground
  ---
  duration_ms: 0.247805
  type: 'test'
  ...
# Subtest: reviewer waits for background work in the foreground
ok 14 - reviewer waits for background work in the foreground
  ---
  duration_ms: 0.158244
  type: 'test'
  ...
# Subtest: verifier waits for background work in the foreground
ok 15 - verifier waits for background work in the foreground
  ---
  duration_ms: 0.174635
  type: 'test'
  ...
# Subtest: each schema kind has one card section, in its intended file
ok 16 - each schema kind has one card section, in its intended file
  ---
  duration_ms: 13.688616
  type: 'test'
  ...
# Subtest: lead has no obsolete read pointer
ok 17 - lead has no obsolete read pointer
  ---
  duration_ms: 0.501852
  type: 'test'
  ...
# Subtest: sub-lead has no obsolete read pointer
ok 18 - sub-lead has no obsolete read pointer
  ---
  duration_ms: 0.66251
  type: 'test'
  ...
# Subtest: worker has no obsolete read pointer
ok 19 - worker has no obsolete read pointer
  ---
  duration_ms: 0.274626
  type: 'test'
  ...
# Subtest: mapper has no obsolete read pointer
ok 20 - mapper has no obsolete read pointer
  ---
  duration_ms: 0.228949
  type: 'test'
  ...
# Subtest: reviewer has no obsolete read pointer
ok 21 - reviewer has no obsolete read pointer
  ---
  duration_ms: 0.173282
  type: 'test'
  ...
# Subtest: verifier has no obsolete read pointer
ok 22 - verifier has no obsolete read pointer
  ---
  duration_ms: 0.164546
  type: 'test'
  ...
# Subtest: cards has no obsolete read pointer
ok 23 - cards has no obsolete read pointer
  ---
  duration_ms: 0.174775
  type: 'test'
  ...
# Subtest: lead has the direct pointer fallback
ok 24 - lead has the direct pointer fallback
  ---
  duration_ms: 0.645819
  type: 'test'
  ...
# Subtest: sub-lead has the direct pointer fallback
ok 25 - sub-lead has the direct pointer fallback
  ---
  duration_ms: 0.28688
  type: 'test'
  ...
# Subtest: worker has the direct pointer fallback
ok 26 - worker has the direct pointer fallback
  ---
  duration_ms: 0.198651
  type: 'test'
  ...
# Subtest: mapper has the direct pointer fallback
ok 27 - mapper has the direct pointer fallback
  ---
  duration_ms: 0.181468
  type: 'test'
  ...
# Subtest: reviewer has the direct pointer fallback
ok 28 - reviewer has the direct pointer fallback
  ---
  duration_ms: 0.189884
  type: 'test'
  ...
# Subtest: verifier has the direct pointer fallback
ok 29 - verifier has the direct pointer fallback
  ---
  duration_ms: 0.306597
  type: 'test'
  ...
# Subtest: sub-lead uses the binding sizing command and no-scout fallback
ok 30 - sub-lead uses the binding sizing command and no-scout fallback
  ---
  duration_ms: 0.350151
  type: 'test'
  ...
# Subtest: sub-lead briefs say role rules are in starting instructions
ok 31 - sub-lead briefs say role rules are in starting instructions
  ---
  duration_ms: 0.230933
  type: 'test'
  ...
# Subtest: worker preserves suite exit status
ok 32 - worker preserves suite exit status
  ---
  duration_ms: 0.368817
  type: 'test'
  ...
# Subtest: verifier preserves suite exit status
ok 33 - verifier preserves suite exit status
  ---
  duration_ms: 0.207257
  type: 'test'
  ...
# Subtest: lead finishing steps point to mergeability before done
ok 34 - lead finishing steps point to mergeability before done
  ---
  duration_ms: 2.274982
  type: 'test'
  ...
# Subtest: done card table lists the pushed head
ok 35 - done card table lists the pushed head
  ---
  duration_ms: 1.631508
  type: 'test'
  ...
1..35
# tests 35
# suites 0
# pass 35
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 281.861775
```

`git diff --stat HEAD~1`

```text
exit 0
 docs/plans/realism-bar/reports/T1.md | 76 ++++++++++++++++++++++++++++++++++++
 protocol/app/AGENTS.md               |  3 +-
 protocol/app/lead.md                 | 40 ++++++++++++++-----
 protocol/app/realism.md              | 28 +++++++++++++
 protocol/app/reviewer.md             | 16 +++++---
 protocol/app/sub-lead.md             | 31 ++++++++++-----
 protocol/app/verifier.md             | 13 +++++-
 protocol/templates/PLAN.md           | 14 ++++++-
 8 files changed, 193 insertions(+), 28 deletions(-)
```

## Choices

none
