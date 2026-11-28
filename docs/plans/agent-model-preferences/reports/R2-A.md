# R2-A report

- `viewer/app/routes.js`: Dismiss an empty legacy notice after a successful heads-up switch, preserving existing differences.
- `viewer/test/app-settings.test.js`: Cover fresh and legacy installations, including persisted settings.

## Validation

`node --test viewer/test/app-settings.test.js`

```text
exit 0
TAP version 13
# Subtest: style rendering uses the plain-words-first sentence and one-line default text
ok 1 - style rendering uses the plain-words-first sentence and one-line default text
  ---
  duration_ms: 1.041426
  type: 'test'
  ...
# Subtest: settings defaults, templates, prompt composition, counts, and validation
ok 2 - settings defaults, templates, prompt composition, counts, and validation
  ---
  duration_ms: 1354.458477
  type: 'test'
  ...
# Subtest: settings prompt preview composes role and card rule placeholders by role
ok 3 - settings prompt preview composes role and card rule placeholders by role
  ---
  duration_ms: 97.16476
  type: 'test'
  ...
# Subtest: style saving, trailer delivery, chat stripping, and preview stay scoped to leads
ok 4 - style saving, trailer delivery, chat stripping, and preview stay scoped to leads
  ---
  duration_ms: 570.371474
  type: 'test'
  ...
# Subtest: settings updates serialize concurrent saves and report a missing template project
ok 5 - settings updates serialize concurrent saves and report a missing template project
  ---
  duration_ms: 146.59354
  type: 'test'
  ...
# Subtest: the role-layer cap refuses template and style saves without changing settings
ok 6 - the role-layer cap refuses template and style saves without changing settings
  ---
  duration_ms: 86.396148
  type: 'test'
  ...
# Subtest: preview has a 75-second machine timeout while ordinary calls retain five seconds
ok 7 - preview has a 75-second machine timeout while ordinary calls retain five seconds
  ---
  duration_ms: 3.250658
  type: 'test'
  ...
# Subtest: settings model and heads-up routes reject bad input and preserve the settings file mode
ok 8 - settings model and heads-up routes reject bad input and preserve the settings file mode
  ---
  duration_ms: 803.988845
  type: 'test'
  ...
# Subtest: template scopes must be listed when added or changed, while removed-project templates remain editable
ok 9 - template scopes must be listed when added or changed, while removed-project templates remain editable
  ---
  duration_ms: 94.611748
  type: 'test'
  ...
# Subtest: escalation settings, sentences, and role layers
ok 10 - escalation settings, sentences, and role layers
  ---
  duration_ms: 150.088566
  type: 'test'
  ...
# Subtest: lead name settings trim and validate names
ok 11 - lead name settings trim and validate names
  ---
  duration_ms: 185.285472
  type: 'test'
  ...
# Subtest: lead name list choice saves, validates and migrates
ok 12 - lead name list choice saves, validates and migrates
  ---
  duration_ms: 183.869358
  type: 'test'
  ...
# Subtest: gemini settings migrate and enforce account and model rules
ok 13 - gemini settings migrate and enforce account and model rules
  ---
  duration_ms: 258.284931
  type: 'test'
  ...
# Subtest: removed worker providers stay removed after saving
ok 14 - removed worker providers stay removed after saving
  ---
  duration_ms: 177.458145
  type: 'test'
  ...
# Subtest: scout preferences and session layers follow the selected provider
ok 15 - scout preferences and session layers follow the selected provider
  ---
  duration_ms: 1193.759322
  type: 'test'
  ...
# Subtest: model ID limits protect near-limit scout role layers
ok 16 - model ID limits protect near-limit scout role layers
  ---
  duration_ms: 977.216003
  type: 'test'
  ...
# Subtest: your name is saved, validated, and told to every agent only when set
ok 17 - your name is saved, validated, and told to every agent only when set
  ---
  duration_ms: 227.505692
  type: 'test'
  ...
# Subtest: shared tools project choice saves and clears
ok 18 - shared tools project choice saves and clears
  ---
  duration_ms: 182.57572
  type: 'test'
  ...
# Subtest: a Google model save normalizes level suffixes and refuses levels the model lacks
ok 19 - a Google model save normalizes level suffixes and refuses levels the model lacks
  ---
  duration_ms: 826.902998
  type: 'test'
  ...
# Subtest: a sub-lead is told each Antigravity tier’s levels only when Antigravity can take workers
ok 20 - a sub-lead is told each Antigravity tier’s levels only when Antigravity can take workers
  ---
  duration_ms: 2063.355768
  type: 'test'
  ...
# Subtest: a sub-lead start refreshes an Antigravity list over an hour old
ok 21 - a sub-lead start refreshes an Antigravity list over an hour old
  ---
  duration_ms: 792.744573
  type: 'test'
  ...
# Subtest: a sub-lead start reuses a recent list even when its first pinned model is unlisted
ok 22 - a sub-lead start reuses a recent list even when its first pinned model is unlisted
  ---
  duration_ms: 792.689708
  type: 'test'
  ...
# Subtest: an Antigravity scout is named by its member id only when the list has it
ok 23 - an Antigravity scout is named by its member id only when the list has it
  ---
  duration_ms: 4631.729434
  type: 'test'
  ...
# Subtest: role tiers, ladders and legacy notice normalize and compare cells
ok 24 - role tiers, ladders and legacy notice normalize and compare cells
  ---
  duration_ms: 0.826083
  type: 'test'
  ...
# Subtest: role preferences round trip and validate before dismissing the notice
ok 25 - role preferences round trip and validate before dismissing the notice
  ---
  duration_ms: 221.636748
  type: 'test'
  ...
# Subtest: notice dismissal follows successful model and role saves
ok 26 - notice dismissal follows successful model and role saves
  ---
  duration_ms: 518.619783
  type: 'test'
  ...
# Subtest: heads-up switch dismisses only an empty legacy notice
ok 27 - heads-up switch dismisses only an empty legacy notice
  ---
  duration_ms: 681.655928
  type: 'test'
  ...
# Subtest: legacy lead comparisons include effort and distinct sub-lead cells
ok 28 - legacy lead comparisons include effort and distinct sub-lead cells
  ---
  duration_ms: 0.488526
  type: 'test'
  ...
1..28
# tests 28
# suites 0
# pass 28
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 17343.0705
```

`node --test machine/test/name-guard.test.js`

```text
exit 0
TAP version 13
# Subtest: detector recognizes name checks across lines
ok 1 - detector recognizes name checks across lines
  ---
  duration_ms: 5.268334
  type: 'test'
  ...
# Subtest: tool names do not dispatch outside connectors
ok 2 - tool names do not dispatch outside connectors
  ---
  duration_ms: 184.733824
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 240.753292
```

## Choices

none

## Not completed

Nothing.
