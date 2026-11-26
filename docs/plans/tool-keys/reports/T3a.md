# T3a — Hub project tools card

- `viewer/app/sessions.js:148`: validate and store per-session keyed lines, filter by live session, retain shown texts and prioritize new keyed texts after dismissal. Refresh from stored state on session stop, failure, disappearance and resumed start.
- `viewer/app/hub.js:72`, `viewer/app/handoff-ops.js:90`, `viewer/app/threads.js:254`: refresh after the remaining session-ending paths.
- `viewer/test/app-project-tools-card.test.js:238`: cover session lifetime, invalid and ended entries, dismissal, ordering under the cap and closure on stop. Mutation checks disabling keyed lines, the live filter, priority ordering and stop refresh produced the expected test failures, then the code was restored.

Screenshot: unavailable; `wc.js screen run -- chromium --version` returned `command not found: chromium`.

Validation: `node --test viewer/test/app-project-tools-card.test.js viewer/test/app-shared-tools-setting.test.js`

```text
exit 0
ok 9 - with two lead sessions only the newest lead carries project_tools in the hub list
  ---
  duration_ms: 475.552921
  type: 'test'
  ...
# Subtest: a new thread gets the default project_tools record when the machine start answer has none
ok 10 - a new thread gets the default project_tools record when the machine start answer has none
  ---
  duration_ms: 306.718037
  type: 'test'
  ...
# Subtest: a handoff import creates a thread with the default project_tools, even when the lead cannot start
ok 11 - a handoff import creates a thread with the default project_tools, even when the lead cannot start
  ---
  duration_ms: 8.980042
  type: 'test'
  ...
# Subtest: dismissed project tools card stays closed until problem names change
ok 12 - dismissed project tools card stays closed until problem names change
  ---
  duration_ms: 814.640799
  type: 'test'
  ...
# Subtest: keyed lines survive another start and leave when their session stops
ok 13 - keyed lines survive another start and leave when their session stops
  ---
  duration_ms: 827.757389
  type: 'test'
  ...
# Subtest: ended and malformed keyed entries do not appear
ok 14 - ended and malformed keyed entries do not appear
  ---
  duration_ms: 0.251712
  type: 'test'
  ...
# Subtest: dismissal covers shown keyed texts and prioritizes new text across later starts
ok 15 - dismissal covers shown keyed texts and prioritizes new text across later starts
  ---
  duration_ms: 1001.038649
  type: 'test'
  ...
# Subtest: stopping the only session with a keyed problem closes the card
ok 16 - stopping the only session with a keyed problem closes the card
  ---
  duration_ms: 473.780796
  type: 'test'
  ...
# Subtest: shared tools setting defaults, validates and saves
ok 17 - shared tools setting defaults, validates and saves
  ---
  duration_ms: 309.543692
  type: 'test'
  ...
# Subtest: folder problem lines appear and clear on a newer update
ok 18 - folder problem lines appear and clear on a newer update
  ---
  duration_ms: 1.246098
  type: 'test'
  ...
# Subtest: session start sends this machine’s saved paths in order and omits an unset choice
ok 19 - session start sends this machine’s saved paths in order and omits an unset choice
  ---
  duration_ms: 356.728456
  type: 'test'
  ...
# Subtest: ready event updates folder problem card
ok 20 - ready event updates folder problem card
  ---
  duration_ms: 234.567831
  type: 'test'
  ...
1..20
# tests 20
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11477.959949
```

## Choices

- `viewer/app/sessions.js`: reject the entire keyed map if any entry is not an array of lines with string text and string names; missing or invalid maps become empty.
- `viewer/app/sessions.js`: preserve existing prioritized texts in their current problem-line order, and drop priority when no live keyed line has that text.
