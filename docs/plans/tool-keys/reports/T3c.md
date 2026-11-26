# T3c — Dismissed project tools card after keyed lines disappear

- `viewer/app/sessions.js:193`: keep a dismissed card closed when the remaining names are a subset of the saved names and there are no new keyed lines.
- `viewer/test/app-project-tools-card.test.js`: cover a dismissed card with a folder line after a keyed session ends, and open-card refresh after a failed start, `pollDead`, and archive.
- Mutation checks: reverted the subset condition; the dismissed-card shrink test failed. Removed the failed-start refresh call; its test failed. Removed the `pollDead` refresh call; its test failed. Removed the archive refresh call in `viewer/app/threads.js` temporarily; its test failed. All mutations were restored.

Validation: `node --test viewer/test/app-project-tools-card.test.js viewer/test/app-shared-tools-setting.test.js`

```text
exit 0
TAP version 13
# Subtest: card opens, keeps id on same names, replaces on different names, closes on reset
ok 1 - card opens, keeps id on same names, replaces on different names, closes on reset
  ---
  duration_ms: 1139.553764
  type: 'test'
  ...
# Subtest: per-CLI and program lines are kept apart; a file line uses the name file
ok 2 - per-CLI and program lines are kept apart; a file line uses the name file
  ---
  duration_ms: 475.292582
  type: 'test'
  ...
# Subtest: more than 20 lines shows and N more; duplicates by text drop
ok 3 - more than 20 lines shows and N more; duplicates by text drop
  ---
  duration_ms: 468.999697
  type: 'test'
  ...
# Subtest: a line with underscores is kept byte-for-byte in items
ok 4 - a line with underscores is kept byte-for-byte in items
  ---
  duration_ms: 468.768295
  type: 'test'
  ...
# Subtest: seq and boot ordering
ok 5 - seq and boot ordering
  ---
  duration_ms: 1012.379248
  type: 'test'
  ...
# Subtest: project_tools is not left on the session record
ok 6 - project_tools is not left on the session record
  ---
  duration_ms: 642.460918
  type: 'test'
  ...
# Subtest: applied in a queued promotion and in resumeUnanswered, without re-taking the lock
ok 7 - applied in a queued promotion and in resumeUnanswered, without re-taking the lock
  ---
  duration_ms: 483.585789
  type: 'test'
  ...
# Subtest: default wc.js session list shows project_tools on the lead entry
ok 8 - default wc.js session list shows project_tools on the lead entry
  ---
  duration_ms: 35.513599
  type: 'test'
  ...
# Subtest: with two lead sessions only the newest lead carries project_tools in the hub list
ok 9 - with two lead sessions only the newest lead carries project_tools in the hub list
  ---
  duration_ms: 470.439862
  type: 'test'
  ...
# Subtest: a new thread gets the default project_tools record when the machine start answer has none
ok 10 - a new thread gets the default project_tools record when the machine start answer has none
  ---
  duration_ms: 294.230242
  type: 'test'
  ...
# Subtest: a handoff import creates a thread with the default project_tools, even when the lead cannot start
ok 11 - a handoff import creates a thread with the default project_tools, even when the lead cannot start
  ---
  duration_ms: 8.826493
  type: 'test'
  ...
# Subtest: dismissed project tools card stays closed until problem names change
ok 12 - dismissed project tools card stays closed until problem names change
  ---
  duration_ms: 826.258155
  type: 'test'
  ...
# Subtest: keyed lines survive another start and leave when their session stops
ok 13 - keyed lines survive another start and leave when their session stops
  ---
  duration_ms: 823.73697
  type: 'test'
  ...
# Subtest: dismissed card stays closed when a keyed session ends and names shrink
ok 14 - dismissed card stays closed when a keyed session ends and names shrink
  ---
  duration_ms: 479.847354
  type: 'test'
  ...
# Subtest: failed start refresh drops keyed lines from the open card
ok 15 - failed start refresh drops keyed lines from the open card
  ---
  duration_ms: 591.831043
  type: 'test'
  ...
# Subtest: pollDead refresh drops keyed lines from the open card
ok 16 - pollDead refresh drops keyed lines from the open card
  ---
  duration_ms: 470.392784
  type: 'test'
  ...
# Subtest: archive refresh drops keyed lines from the open card
ok 17 - archive refresh drops keyed lines from the open card
  ---
  duration_ms: 479.156771
  type: 'test'
  ...
# Subtest: ended and malformed keyed entries do not appear
ok 18 - ended and malformed keyed entries do not appear
  ---
  duration_ms: 0.461582
  type: 'test'
  ...
# Subtest: dismissal covers shown keyed texts and prioritizes new text across later starts
ok 19 - dismissal covers shown keyed texts and prioritizes new text across later starts
  ---
  duration_ms: 1011.126989
  type: 'test'
  ...
# Subtest: stopping the only session with a keyed problem closes the card
ok 20 - stopping the only session with a keyed problem closes the card
  ---
  duration_ms: 479.552572
  type: 'test'
  ...
# Subtest: shared tools setting defaults, validates and saves
ok 21 - shared tools setting defaults, validates and saves
  ---
  duration_ms: 365.707115
  type: 'test'
  ...
# Subtest: folder problem lines appear and clear on a newer update
ok 22 - folder problem lines appear and clear on a newer update
  ---
  duration_ms: 1.430435
  type: 'test'
  ...
# Subtest: session start sends this machine’s saved paths in order and omits an unset choice
ok 23 - session start sends this machine’s saved paths in order and omits an unset choice
  ---
  duration_ms: 388.629896
  type: 'test'
  ...
# Subtest: ready event updates folder problem card
ok 24 - ready event updates folder problem card
  ---
  duration_ms: 231.496341
  type: 'test'
  ...
1..24
# tests 24
# suites 0
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 13570.778571
```

Nothing else could not be done.

## Choices

- Failed-start test setup: passed the existing session as `_waiting` to exercise its start-failure cleanup with its keyed line still present.
