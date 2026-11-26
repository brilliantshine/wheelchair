# T2d report — blocked

The first validation gate failed twice, so work stopped as required. The first failure was the old test expecting a note on a read without a choice; the implementation was adjusted to preserve that read behavior. The second failure is at `machine/test/project-tools.test.js:475`: the test searches for the stored value `short`, which also occurs in the usability reason. Use a distinctive short value and rerun; this failure does not establish a value leak.

Changes in progress: `machine/lib/shared-keys-page.js` separates writes and listings, removes remembered choice, and refuses empty saves; `machine/service.js` releases the shared lock before listing. `machine/lib/project-tools.js` changes status destination, hidden rows, unreadable store notes and store-only write responses. `machine/AGENTS.md` adds the requested router rows. The test files contain partial coverage only. The requested mutation checks, several tests, response-shape inventory, and full review remain undone; these changes are not ready to merge.

## Validation

`node --test machine/test/project-tools.test.js machine/test/shared-keys-page.test.js machine/test/shared-keys.test.js machine/test/shared-tools.test.js (first)`

```text
exit 1
ok 47 - finds first matching repository and skips missing and unrelated candidates
  ---
  duration_ms: 105.499511
  type: 'test'
  ...
# Subtest: refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
ok 48 - refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
  ---
  duration_ms: 268.663505
  type: 'test'
  ...
# Subtest: concurrent refreshes share one fetch, and deadline kills a stalled process
ok 49 - concurrent refreshes share one fetch, and deadline kills a stalled process
  ---
  duration_ms: 3098.729891
  type: 'test'
  ...
# Subtest: failed copy extraction leaves pointer and no temporary folder
ok 50 - failed copy extraction leaves pointer and no temporary folder
  ---
  duration_ms: 147.933832
  type: 'test'
  ...
# Subtest: a waiting caller has its own deadline and stale temporary copies are removed
ok 51 - a waiting caller has its own deadline and stale temporary copies are removed
  ---
  duration_ms: 3116.20279
  type: 'test'
  ...
# Subtest: a commit without tools produces an empty copy
ok 52 - a commit without tools produces an empty copy
  ---
  duration_ms: 98.999938
  type: 'test'
  ...
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
ok 53 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 83.653614
  type: 'test'
  ...
# Subtest: cleanup cannot remove a copy before its refresh publishes the pointer
ok 54 - cleanup cannot remove a copy before its refresh publishes the pointer
  ---
  duration_ms: 131.499016
  type: 'test'
  ...
# Subtest: origin lookup honors insteadOf and identity errors are clear
ok 55 - origin lookup honors insteadOf and identity errors are clear
  ---
  duration_ms: 57.331835
  type: 'test'
  ...
# Subtest: a waiter does not overwrite a newer recorded outcome
ok 56 - a waiter does not overwrite a newer recorded outcome
  ---
  duration_ms: 2112.456603
  type: 'test'
  ...
# Subtest: refresh failure messages name the step and fit on one short line
ok 57 - refresh failure messages name the step and fit on one short line
  ---
  duration_ms: 58.848609
  type: 'test'
  ...
# Subtest: a copy publication failure names its step
ok 58 - a copy publication failure names its step
  ---
  duration_ms: 82.792997
  type: 'test'
  ...
1..58
# tests 58
# suites 0
# pass 57
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9435.490593
```

`node --test machine/test/project-tools.test.js machine/test/shared-keys-page.test.js machine/test/shared-keys.test.js machine/test/shared-tools.test.js (second)`

```text
exit 1
ok 47 - finds first matching repository and skips missing and unrelated candidates
  ---
  duration_ms: 105.180618
  type: 'test'
  ...
# Subtest: refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
ok 48 - refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
  ---
  duration_ms: 268.053605
  type: 'test'
  ...
# Subtest: concurrent refreshes share one fetch, and deadline kills a stalled process
ok 49 - concurrent refreshes share one fetch, and deadline kills a stalled process
  ---
  duration_ms: 3099.123607
  type: 'test'
  ...
# Subtest: failed copy extraction leaves pointer and no temporary folder
ok 50 - failed copy extraction leaves pointer and no temporary folder
  ---
  duration_ms: 137.882947
  type: 'test'
  ...
# Subtest: a waiting caller has its own deadline and stale temporary copies are removed
ok 51 - a waiting caller has its own deadline and stale temporary copies are removed
  ---
  duration_ms: 3108.028509
  type: 'test'
  ...
# Subtest: a commit without tools produces an empty copy
ok 52 - a commit without tools produces an empty copy
  ---
  duration_ms: 90.378447
  type: 'test'
  ...
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
ok 53 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 78.175159
  type: 'test'
  ...
# Subtest: cleanup cannot remove a copy before its refresh publishes the pointer
ok 54 - cleanup cannot remove a copy before its refresh publishes the pointer
  ---
  duration_ms: 129.578528
  type: 'test'
  ...
# Subtest: origin lookup honors insteadOf and identity errors are clear
ok 55 - origin lookup honors insteadOf and identity errors are clear
  ---
  duration_ms: 58.259244
  type: 'test'
  ...
# Subtest: a waiter does not overwrite a newer recorded outcome
ok 56 - a waiter does not overwrite a newer recorded outcome
  ---
  duration_ms: 2106.044718
  type: 'test'
  ...
# Subtest: refresh failure messages name the step and fit on one short line
ok 57 - refresh failure messages name the step and fit on one short line
  ---
  duration_ms: 57.73438
  type: 'test'
  ...
# Subtest: a copy publication failure names its step
ok 58 - a copy publication failure names its step
  ---
  duration_ms: 82.198324
  type: 'test'
  ...
1..58
# tests 58
# suites 0
# pass 57
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9385.597191
```

`node --test machine/test/project-tools-service.test.js machine/test/service.test.js`

```text
exit 0
  ...
# machine service listening on 127.0.0.1:38143
# Subtest: inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
ok 130 - inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
  ---
  duration_ms: 357.595538
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43041
# Subtest: archive saves the in-progress marker before stopping and clears it on failure
ok 131 - archive saves the in-progress marker before stopping and clears it on failure
  ---
  duration_ms: 84.155407
  type: 'test'
  ...
# machine service listening on 127.0.0.1:35131
# Subtest: agents cannot set approval warnings
ok 132 - agents cannot set approval warnings
  ---
  duration_ms: 97.090766
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43939
# Subtest: idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
ok 133 - idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
  ---
  duration_ms: 73.75431
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45985
# Subtest: copier cuts a crash fragment before replaying a complete source row
ok 134 - copier cuts a crash fragment before replaying a complete source row
  ---
  duration_ms: 69.681732
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42363
# Subtest: busy transcript copies reuse in-memory hashes and drop them when idle or stopped
ok 135 - busy transcript copies reuse in-memory hashes and drop them when idle or stopped
  ---
  duration_ms: 89.216659
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39029
# Subtest: idle hash timer sweeps without a copy and is cleared on close
ok 136 - idle hash timer sweeps without a copy and is cleared on close
  ---
  duration_ms: 42.392376
  type: 'test'
  ...
# machine service listening on 127.0.0.1:38283
# Subtest: transcript stamps avoid all content reads on a match and detect replacement
ok 137 - transcript stamps avoid all content reads on a match and detect replacement
  ---
  duration_ms: 75.614933
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33193
# Subtest: Kimi usage route protects credentials and reports usage failures
ok 138 - Kimi usage route protects credentials and reports usage failures
  ---
  duration_ms: 56.314365
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40255
# Subtest: spooled receipt id becomes the drained hub card id
ok 139 - spooled receipt id becomes the drained hub card id
  ---
  duration_ms: 74.526138
  type: 'test'
  ...
1..139
# tests 139
# suites 0
# pass 139
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 38068.202201
```

## Choices

- `shared-keys-page.js`: preserve the existing missing-choice note for reads; the brief explicitly removes it for saves and removals.
