# T2d report — attempt 2

Completed the requested test coverage and corrected the ambiguous short-value assertion in `machine/test/project-tools.test.js:474`. This attempt did not change production code; the temporary mutations described below were restored before validation.

## Fixes already committed in the previous attempt

- `machine/lib/shared-keys-page.js:9` and `:30`: listing uses the current request's choice, not remembered state; `:34`, `:50`, `:55` separate the store write from listing and write paths do not refresh a missing copy (`:19`). Reads without a choice retain the explanatory note (`:12`).
- `machine/lib/shared-keys-page.js:42`: empty saves return `nothing to save` without a revision change.
- `machine/service.js:2196`: serialization covers the shared store's check and write; `:2201` releases the lock before listing at `:2202`.
- `machine/lib/project-tools.js:174`: `keyStatus` uses the same `remote()` destination as read when available. `:155` skips hidden rows, `:152` adds the unreadable shared-store note, and `:230`, `:286`, `:289` return `storeInfo` for successful writes without relisting. `:269` and `:270` also use `storeInfo` for PR outcomes.
- `machine/AGENTS.md:46` through `:49` identify the project-tools, project-keys, shared-keys and shared-keys-page modules.
- Previous tests cover selected store/status, missing choices, empty saves and shared write behavior at `machine/test/project-tools.test.js:467` and `machine/test/shared-keys-page.test.js:6`. The formerly ambiguous search for `short` is now a search for `zq7` at `machine/test/project-tools.test.js:475`.

## Response shapes for the page task

These are response **bodies**; HTTP status is separate. `key_info` entries are `{name, stored, folder_usable, reason, tools}`; `folder_tools` is `{rows, notes}`. Shared `keys` entries have the same five fields. Stored values are not returned.

- Project `read`: normal body `{wsl, windows, mode, notice, repo, default_branch, token, source, checks, file_warnings, keys, references, reserved, waiting, waiting_error, folder_tools, key_info}`. `mode` is `tools`, `keys-only`, or `unreachable`; `token` has `{project, baseline, key_revision}`, and a populated baseline has `{repo, source_state, branch, mode, oid}`. `source` is null or `{state, reason, document}`. A `repo_only: true` read returns only `{repo}`. Invalid paths return 400 `{outcome:'refused', reason}` (`machine/lib/project-tools.js:179`).
- Project `save`: key-only success is 200 `{outcome:'saved', key_revision, keys, key_info, warnings}`. A PR success is `{outcome:'opened', key_revision, keys, key_info, pr_url, warnings}`; PR creation failure is still 200 `{outcome:'pr_failed', key_revision, keys, key_info, branch, compare_url, error}`. Refusals are 400 or 409 `{outcome:'refused', reason}`; operational failures are 502 `{outcome:'failed', key_revision, keys, error}` (`machine/lib/project-tools.js:213`, `:230`, `:269`). Write `key_info` describes the store alone and has empty `tools` lists.
- Project `removeKey`: 200 `{outcome:'removed', key_revision, keys, key_info}`; refusal and failure shapes match save (`machine/lib/project-tools.js:280`).
- `/v1/project-tools/key-status`: 200 `{key_revision, keys, key_info, folder_tools}`; invalid path is 400 `{outcome:'refused', reason}` and store failure is 502 `{outcome:'failed', error}` (`machine/lib/project-tools.js:168`, `machine/service.js:2178`).
- `/v1/shared-keys/read`: 200 `{revision, keys, notes}`; store failure 502 `{outcome:'failed', error}` (`machine/lib/shared-keys-page.js:30`).
- `/v1/shared-keys/save` and `/v1/shared-keys/remove`: 200 `{outcome:'saved'|'removed', revision, keys}`. Invalid inputs return 400 `{outcome:'refused', reason}`, stale revision returns 409 with the same shape and `reason:'changed elsewhere, reload'`, and store failure returns 502 `{outcome:'failed', error}`. Listing after writes never refreshes a copy (`machine/lib/shared-keys-page.js:34`, `:50`, `machine/service.js:2192`).

## Mutation checks

Each mutation below was made temporarily, the named focused Node test was run and failed with `not ok` (exit 1), and the production line was restored. Separate mutations checked both write operations and all four secrecy responses. Logs were saved under `/tmp/t2d-mut-*.log` during this attempt.

- a. Two missing keys, `machine/test/project-tools.test.js:486`: changed the joined delimiter at `machine/lib/project-tools.js:160` from comma to `and`.
- b. Other project's shared row omits Settings suffix, `machine/test/project-tools.test.js:494`: forced the suffix on at `machine/lib/project-tools.js:160`.
- c. Exact short-value reason, `machine/test/project-tools.test.js:475`: replaced the stored-value reason at `machine/lib/project-tools.js:164` with `bad reason`.
- d. Hidden row has neither field, `machine/test/project-tools.test.js:506`: removed the hidden-row skip at `machine/lib/project-tools.js:155`.
- e. Write responses and network calls, `machine/test/project-tools.test.js:510`: replaced `key_info` with `[]` separately at `machine/lib/project-tools.js:230` and `:286`; added `ls-remote` to the save at `:230` and `fetch` to removal at `:286` separately. Each mutation failed.
- f. Secret absence, `machine/test/project-tools.test.js:521`: separately added a stored value to the read base at `machine/lib/project-tools.js:188`, save at `:230`, remove at `:286`, and key-status at `:177`; each failed.
- g. Missing shared project note, `machine/test/shared-keys-page.test.js:47`: replaced the missing-project message at `machine/lib/shared-keys-page.js:16`.
- h. Existing copy does not refresh, `machine/test/shared-keys-page.test.js:27`: made refresh unconditional on an existing copy at `machine/lib/shared-keys-page.js:19`.
- i. Two saves and lock boundary, `machine/test/shared-keys-page.test.js:31` and `:56`: moved listing inside the lock at `machine/service.js:2200`, removed the shared `await previous` at `:2198`, and independently disabled the revision guard at `machine/lib/shared-keys-page.js:36`. Each failed. The slow-listing wait has a three-second deadline; the same-revision wait has a five-second deadline.
- j. Service key-status fields, `machine/test/shared-keys-page.test.js:83`: routed key-status to read at `machine/service.js:2181`.

## Validation

`node --test machine/test/project-tools.test.js machine/test/shared-keys-page.test.js machine/test/shared-keys.test.js machine/test/shared-tools.test.js`

```text
exit 0
ok 53 - finds first matching repository and skips missing and unrelated candidates
  ---
  duration_ms: 101.587932
  type: 'test'
  ...
# Subtest: refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
ok 54 - refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
  ---
  duration_ms: 312.607052
  type: 'test'
  ...
# Subtest: concurrent refreshes share one fetch, and deadline kills a stalled process
ok 55 - concurrent refreshes share one fetch, and deadline kills a stalled process
  ---
  duration_ms: 3133.502095
  type: 'test'
  ...
# Subtest: failed copy extraction leaves pointer and no temporary folder
ok 56 - failed copy extraction leaves pointer and no temporary folder
  ---
  duration_ms: 137.60302
  type: 'test'
  ...
# Subtest: a waiting caller has its own deadline and stale temporary copies are removed
ok 57 - a waiting caller has its own deadline and stale temporary copies are removed
  ---
  duration_ms: 3105.591999
  type: 'test'
  ...
# Subtest: a commit without tools produces an empty copy
ok 58 - a commit without tools produces an empty copy
  ---
  duration_ms: 98.953247
  type: 'test'
  ...
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
ok 59 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 81.456772
  type: 'test'
  ...
# Subtest: cleanup cannot remove a copy before its refresh publishes the pointer
ok 60 - cleanup cannot remove a copy before its refresh publishes the pointer
  ---
  duration_ms: 147.217307
  type: 'test'
  ...
# Subtest: origin lookup honors insteadOf and identity errors are clear
ok 61 - origin lookup honors insteadOf and identity errors are clear
  ---
  duration_ms: 56.38164
  type: 'test'
  ...
# Subtest: a waiter does not overwrite a newer recorded outcome
ok 62 - a waiter does not overwrite a newer recorded outcome
  ---
  duration_ms: 2103.22116
  type: 'test'
  ...
# Subtest: refresh failure messages name the step and fit on one short line
ok 63 - refresh failure messages name the step and fit on one short line
  ---
  duration_ms: 57.585135
  type: 'test'
  ...
# Subtest: a copy publication failure names its step
ok 64 - a copy publication failure names its step
  ---
  duration_ms: 80.189835
  type: 'test'
  ...
1..64
# tests 64
# suites 0
# pass 64
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9485.184223
```

`node --test machine/test/project-tools-service.test.js machine/test/service.test.js`

```text
exit 0
  ...
# machine service listening on 127.0.0.1:36745
# Subtest: inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
ok 130 - inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
  ---
  duration_ms: 347.606643
  type: 'test'
  ...
# machine service listening on 127.0.0.1:38603
# Subtest: archive saves the in-progress marker before stopping and clears it on failure
ok 131 - archive saves the in-progress marker before stopping and clears it on failure
  ---
  duration_ms: 77.466868
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45735
# Subtest: agents cannot set approval warnings
ok 132 - agents cannot set approval warnings
  ---
  duration_ms: 94.547697
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33067
# Subtest: idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
ok 133 - idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
  ---
  duration_ms: 66.897271
  type: 'test'
  ...
# machine service listening on 127.0.0.1:38711
# Subtest: copier cuts a crash fragment before replaying a complete source row
ok 134 - copier cuts a crash fragment before replaying a complete source row
  ---
  duration_ms: 68.172986
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46855
# Subtest: busy transcript copies reuse in-memory hashes and drop them when idle or stopped
ok 135 - busy transcript copies reuse in-memory hashes and drop them when idle or stopped
  ---
  duration_ms: 85.453276
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40953
# Subtest: idle hash timer sweeps without a copy and is cleared on close
ok 136 - idle hash timer sweeps without a copy and is cleared on close
  ---
  duration_ms: 47.342324
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36749
# Subtest: transcript stamps avoid all content reads on a match and detect replacement
ok 137 - transcript stamps avoid all content reads on a match and detect replacement
  ---
  duration_ms: 79.840134
  type: 'test'
  ...
# machine service listening on 127.0.0.1:35995
# Subtest: Kimi usage route protects credentials and reports usage failures
ok 138 - Kimi usage route protects credentials and reports usage failures
  ---
  duration_ms: 57.30062
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34893
# Subtest: spooled receipt id becomes the drained hub card id
ok 139 - spooled receipt id becomes the drained hub card id
  ---
  duration_ms: 77.382977
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
# duration_ms 38392.428576
```

## Choices

- `machine/test/shared-keys-page.test.js`: chose three-second listing and five-second concurrent-save deadlines to allow scheduling while bounding failures.
