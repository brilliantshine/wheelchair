# T3b — hub settings fixes and tests

## Changed

- `viewer/app/state.js` — added `State.updateSettings(change)`, which serializes the settings file's read-change-write transaction on its path and writes atomically at mode 0600.
- `viewer/app/settings.js` — factored settings normalization and added `update(hub, change)`, so normalization, mutation, capacity validation, and persistence run under that transaction. Tier aliases now contain only the cross-CLI names.
- `viewer/app/routes.js` — preferences, template create/update/delete, and style writes now use `settings.update` rather than a separate load and save.
- `viewer/app/sessions.js` — maps `haiku`, `sonnet`, and `opus` only for Claude worker requests; Codex reports them as unknown tiers.
- `viewer/test/app-settings.test.js` — added concurrent write, capacity/no-write, 75-second preview/default timeout, missing-scope, and both-CLI style trailer coverage.
- `viewer/test/app-hub.test.js` — added Claude-versus-Codex alias resolution coverage and confirms Other agents accepts only new names plus Luna/Terra/Sol/Astra aliases.

Existing coverage already checked the default settings, general template lifecycle, one Codex style trailer, chat trailer stripping, preview success/failure, settings-file mode, universal aliases, and model resolution. The tests above extend those cases rather than duplicate them.

## Validation

```text
$ sha256sum ~/.wheelchair/models
cdb9373d2d90d7b38be4c5c1b18ce9c1e3bbaa30abf8f1709c81abf191ef73c2  /home/collin/.wheelchair/models
```

```text
$ node --test viewer/test/*.test.js
TAP version 13
...
# Subtest: a starter that loses the freed port registers through the new holder
not ok 155 - a starter that loses the freed port registers through the new holder
  ---
  duration_ms: 540.999186
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-983d91c069d3-w6/viewer/test/lifecycle.test.js:420:1'
  failureType: 'testCodeFailure'
  error: 'C retried after the silent holder'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    first
  operator: 'match'
...
# Subtest: an app page carries font-src self and the font route serves only the allowlist
not ok 183 - an app page carries font-src self and the font route serves only the allowlist
  ---
  duration_ms: 84.424039
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-983d91c069d3-w6/viewer/test/routes.test.js:170:1'
  failureType: 'testCodeFailure'
...
1..261
# tests 261
# suites 0
# pass 259
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 34970.844451
```

The only failures are the two known environment failures named in the task: the freed-port lifecycle race and the app-page `font-src 'self'` assertion. There were no additional failures.

```text
$ sha256sum ~/.wheelchair/models
cdb9373d2d90d7b38be4c5c1b18ce9c1e3bbaa30abf8f1709c81abf191ef73c2  /home/collin/.wheelchair/models
```

## Choices

- `viewer/test/app-settings.test.js`: used the settings-store update seam for the template capacity rejection because accepted template and style field limits cannot compose to 12,000 characters; used a legacy oversized stored template to exercise the style route's 400/no-write behavior.
