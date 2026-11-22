# R1-TESTS report

- `viewer/test/app-lessons-history.test.js`: added waiting preservation, populated HTTP export/import round-trip, and history attribution assertions.
- `docs/plans/lessons-hardening/reports/R1-TESTS.md`: this report.

Both validations passed; nothing remains undone.

## Choices

- `viewer/test/app-lessons-history.test.js`: used two distinct file/handoff waiting entries and cleared the same hub before import, retaining its saved directory.

## Validation

From `viewer/`:

### `node --test test/app-lessons-history.test.js test/app-lessons.test.js`

```text
exit 0
  ---
  duration_ms: 100.27856
  type: 'test'
  ...
# Subtest: new ids avoid removed history and different project scopes remain distinct
ok 6 - new ids avoid removed history and different project scopes remain distinct
  ---
  duration_ms: 4.013178
  type: 'test'
  ...
# Subtest: card schema and saver pairs
ok 7 - card schema and saver pairs
  ---
  duration_ms: 27.079351
  type: 'test'
  ...
# Subtest: sub-lead can save a worker lesson for another provider
ok 8 - sub-lead can save a worker lesson for another provider
  ---
  duration_ms: 5.061128
  type: 'test'
  ...
# Subtest: reviewers and verifiers cannot save lessons through the hub
ok 9 - reviewers and verifiers cannot save lessons through the hub
  ---
  duration_ms: 2.531556
  type: 'test'
  ...
# Subtest: scope, repeat safety, replacement, removal and user ownership
ok 10 - scope, repeat safety, replacement, removal and user ownership
  ---
  duration_ms: 24.979202
  type: 'test'
  ...
# Subtest: normalization, cap, prompts and preview
ok 11 - normalization, cap, prompts and preview
  ---
  duration_ms: 12.74685
  type: 'test'
  ...
# Subtest: lead roleLayers keeps reviewer, verifier and mapper blocks
ok 12 - lead roleLayers keeps reviewer, verifier and mapper blocks
  ---
  duration_ms: 0.2453
  type: 'test'
  ...
# Subtest: card.js lesson validation refuses reviewer and missing why
ok 13 - card.js lesson validation refuses reviewer and missing why
  ---
  duration_ms: 0.233578
  type: 'test'
  ...
# Subtest: settings PUT merges edits and removals over HTTP
ok 14 - settings PUT merges edits and removals over HTTP
  ---
  duration_ms: 177.448959
  type: 'test'
  ...
# Subtest: all saver and target pairs enforce the role matrix
ok 15 - all saver and target pairs enforce the role matrix
  ---
  duration_ms: 13.44552
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-75ee90ac1c52.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 16 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 179.350497
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 870.502763
```

### `npm test`

```text
exit 0
ok 817 - win run passes the operation and unchanged arguments
  ---
  duration_ms: 58.325449
  type: 'test'
  ...
# Subtest: win start passes the operation and unchanged arguments
ok 818 - win start passes the operation and unchanged arguments
  ---
  duration_ms: 59.677092
  type: 'test'
  ...
# Subtest: win status passes the operation and unchanged arguments
ok 819 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 59.944072
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 820 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 60.512968
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 821 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 54.044694
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 822 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 59.313859
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 823 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 63.661954
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 824 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 51.056737
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 825 - unknown win op fails without sending a request
  ---
  duration_ms: 41.217341
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 826 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.805609
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 827 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 59.378081
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 828 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 48.02224
  type: 'test'
  ...
1..828
# tests 844
# suites 0
# pass 844
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 51666.794374
```
