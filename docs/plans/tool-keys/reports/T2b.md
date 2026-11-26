# T2b report

- `machine/lib/project-tools.js:150` decorates keyed folder rows and builds project key information; `:168` reads key status without reading `.mcp.json`; `:288` adds key information to successful saves and removals.
- `machine/lib/shared-keys-page.js:9` lists declarations and stored names, fetches an absent shared copy, validates values and handles revisions and removal.
- `machine/service.js:286` creates the page and lock; `:2157` dispatches key status; `:2171` provides hub-authenticated shared-key routes and serializes writes.
- `machine/test/project-tools.test.js` and `machine/test/shared-keys-page.test.js` cover key status, revision, value validation, refresh and concurrent writes. Deliberately disabling the missing-key flag, revision check, missing-copy refresh and service lock caused the corresponding tests to fail; the changes were restored.

## Response shapes

Project read retains its existing body, adding `key_info: [{ name, stored, folder_usable, reason, tools }]` and, for keyed folder rows, `keys`, `key_store`, `key_lines`, and `key_missing`. Successful project save and remove responses retain their existing fields and add `key_info`. `key-status` returns `{ key_revision, keys, key_info, folder_tools: { rows, notes } }`. Existing project error and refusal responses remain in place.

Shared read returns `{ revision, keys: [{ name, stored, folder_usable, reason, tools }], notes }`. Save and remove return `{ outcome, revision, keys }`; validation and stale revisions return `{ outcome: 'refused', reason }`, with status 409 for stale revisions. Store errors return status 502 with `{ outcome: 'failed', error }`. No key values appear in these bodies.

## Validation

`node --test machine/test/project-tools.test.js machine/test/shared-keys-page.test.js machine/test/shared-keys.test.js machine/test/shared-tools.test.js`

```text
exit 0
ok 47 - finds first matching repository and skips missing and unrelated candidates
  ---
  duration_ms: 108.175667
  type: 'test'
  ...
# Subtest: refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
ok 48 - refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
  ---
  duration_ms: 289.434571
  type: 'test'
  ...
# Subtest: concurrent refreshes share one fetch, and deadline kills a stalled process
ok 49 - concurrent refreshes share one fetch, and deadline kills a stalled process
  ---
  duration_ms: 3102.793265
  type: 'test'
  ...
# Subtest: failed copy extraction leaves pointer and no temporary folder
ok 50 - failed copy extraction leaves pointer and no temporary folder
  ---
  duration_ms: 136.898119
  type: 'test'
  ...
# Subtest: a waiting caller has its own deadline and stale temporary copies are removed
ok 51 - a waiting caller has its own deadline and stale temporary copies are removed
  ---
  duration_ms: 3108.340276
  type: 'test'
  ...
# Subtest: a commit without tools produces an empty copy
ok 52 - a commit without tools produces an empty copy
  ---
  duration_ms: 95.341815
  type: 'test'
  ...
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
ok 53 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 79.769838
  type: 'test'
  ...
# Subtest: cleanup cannot remove a copy before its refresh publishes the pointer
ok 54 - cleanup cannot remove a copy before its refresh publishes the pointer
  ---
  duration_ms: 127.351981
  type: 'test'
  ...
# Subtest: origin lookup honors insteadOf and identity errors are clear
ok 55 - origin lookup honors insteadOf and identity errors are clear
  ---
  duration_ms: 55.298582
  type: 'test'
  ...
# Subtest: a waiter does not overwrite a newer recorded outcome
ok 56 - a waiter does not overwrite a newer recorded outcome
  ---
  duration_ms: 2107.973493
  type: 'test'
  ...
# Subtest: refresh failure messages name the step and fit on one short line
ok 57 - refresh failure messages name the step and fit on one short line
  ---
  duration_ms: 60.031315
  type: 'test'
  ...
# Subtest: a copy publication failure names its step
ok 58 - a copy publication failure names its step
  ---
  duration_ms: 85.355143
  type: 'test'
  ...
1..58
# tests 58
# suites 0
# pass 58
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9425.316488
```

`node --test machine/test/project-tools-service.test.js machine/test/service.test.js`

```text
exit 0
  ...
# machine service listening on 127.0.0.1:34055
# Subtest: inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
ok 130 - inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
  ---
  duration_ms: 365.171974
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40147
# Subtest: archive saves the in-progress marker before stopping and clears it on failure
ok 131 - archive saves the in-progress marker before stopping and clears it on failure
  ---
  duration_ms: 80.982506
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43249
# Subtest: agents cannot set approval warnings
ok 132 - agents cannot set approval warnings
  ---
  duration_ms: 93.193864
  type: 'test'
  ...
# machine service listening on 127.0.0.1:38471
# Subtest: idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
ok 133 - idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
  ---
  duration_ms: 68.458007
  type: 'test'
  ...
# machine service listening on 127.0.0.1:41057
# Subtest: copier cuts a crash fragment before replaying a complete source row
ok 134 - copier cuts a crash fragment before replaying a complete source row
  ---
  duration_ms: 79.408014
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43189
# Subtest: busy transcript copies reuse in-memory hashes and drop them when idle or stopped
ok 135 - busy transcript copies reuse in-memory hashes and drop them when idle or stopped
  ---
  duration_ms: 76.658583
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33051
# Subtest: idle hash timer sweeps without a copy and is cleared on close
ok 136 - idle hash timer sweeps without a copy and is cleared on close
  ---
  duration_ms: 42.036864
  type: 'test'
  ...
# machine service listening on 127.0.0.1:35203
# Subtest: transcript stamps avoid all content reads on a match and detect replacement
ok 137 - transcript stamps avoid all content reads on a match and detect replacement
  ---
  duration_ms: 73.153198
  type: 'test'
  ...
# machine service listening on 127.0.0.1:35817
# Subtest: Kimi usage route protects credentials and reports usage failures
ok 138 - Kimi usage route protects credentials and reports usage failures
  ---
  duration_ms: 52.8399
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39211
# Subtest: spooled receipt id becomes the drained hub card id
ok 139 - spooled receipt id becomes the drained hub card id
  ---
  duration_ms: 73.274039
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
# duration_ms 37984.357944
```

## Choices

- `shared-keys-page.js`: remember the last read's shared-tools choice for save/remove requests that omit it; an explicitly supplied choice takes precedence.
- `project-tools.js`: when the shared store cannot be read, keyed rows are treated as missing; project store read behavior retains the existing notice.
