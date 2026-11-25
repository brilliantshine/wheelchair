# R2a report

## Changes

- `viewer/app/project-lead-actions.js`: match outside PR URLs at URL boundaries separately from other identifiers, and collect object-form `target_pr.url`.
- `viewer/test/project-lead.test.js`: cover prefix collisions, sentence-ending punctuation, and object-form target PR redaction.
- `protocol/app/cards.md`: exclude the assistant and project lead from the message-card emitters.

No screenshots: this task has no visible UI changes or mockup.

## Validation

Each new regression test failed against the original implementation before the fix and passed in the project-lead suite afterward.

`node --test --test-name-pattern="outside PR URLs match whole" viewer/test/project-lead.test.js`

```text
exit 1
    + []
    - [
    -   'https://github.com/wheelchair/wheelchair/pull/186'
    - ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'https://github.com/wheelchair/wheelchair/pull/186'
  actual:
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-df22283a57e1-w14/viewer/test/project-lead.test.js:519:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 100.845525
```

`node --test --test-name-pattern="outside object target PR" viewer/test/project-lead.test.js`

```text
exit 1
        'local'
      ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'local'
  actual:
    0: 'See https://github.com/wheelchair/wheelchair/pull/77'
    1: 'local'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-df22283a57e1-w14/viewer/test/project-lead.test.js:530:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 100.110068
```

`node --check viewer/app/project-lead-actions.js viewer/test/project-lead.test.js`

```text
exit 0

```

`node --test viewer/test/project-lead.test.js`

```text
exit 0
ok 20 - outside titles do not erase local question text
  ---
  duration_ms: 13.983187
  type: 'test'
  ...
# Subtest: outside pull request URLs are removed from recent chat
ok 21 - outside pull request URLs are removed from recent chat
  ---
  duration_ms: 9.724595
  type: 'test'
  ...
# Subtest: outside PR URLs match whole URLs without hiding local PR prefixes
ok 22 - outside PR URLs match whole URLs without hiding local PR prefixes
  ---
  duration_ms: 10.174325
  type: 'test'
  ...
# Subtest: outside object target PR URLs are removed from thread details
ok 23 - outside object target PR URLs are removed from thread details
  ---
  duration_ms: 9.119468
  type: 'test'
  ...
# Subtest: the same path on another registered machine is outside the project
ok 24 - the same path on another registered machine is outside the project
  ---
  duration_ms: 11.378778
  type: 'test'
  ...
# Subtest: another project lead is refused as a target of every targeted action
ok 25 - another project lead is refused as a target of every targeted action
  ---
  duration_ms: 9.725677
  type: 'test'
  ...
# Subtest: closed reach and permit cards are absent from waiting and cards
ok 26 - closed reach and permit cards are absent from waiting and cards
  ---
  duration_ms: 8.967096
  type: 'test'
  ...
# Subtest: cross-thread messages and recent chat omit other project identifiers but keep titles
ok 27 - cross-thread messages and recent chat omit other project identifiers but keep titles
  ---
  duration_ms: 8.170894
  type: 'test'
  ...
# Subtest: short other-project titles do not redact same-project text
ok 28 - short other-project titles do not redact same-project text
  ---
  duration_ms: 9.289283
  type: 'test'
  ...
# Subtest: same-project text mentioning its project path remains in recent chat
ok 29 - same-project text mentioning its project path remains in recent chat
  ---
  duration_ms: 7.985569
  type: 'test'
  ...
# Subtest: every project lead action is refused when the setting is off
ok 30 - every project lead action is refused when the setting is off
  ---
  duration_ms: 8.129605
  type: 'test'
  ...
# Subtest: project lead CLI retries thread reads and does not retry writes
ok 31 - project lead CLI retries thread reads and does not retry writes
  ---
  duration_ms: 2183.39122
  type: 'test'
  ...
1..31
# tests 31
# suites 0
# pass 31
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 13991.539619
```

`node --test viewer/test/assistant.test.js`

```text
exit 0
ok 8 - assistant press attribution is cleared by a later browser press on the same idea
  ---
  duration_ms: 468.20871
  type: 'test'
  ...
# Subtest: approval recheck refreshes Ready without attributing an answer
ok 9 - approval recheck refreshes Ready without attributing an answer
  ---
  duration_ms: 456.527054
  type: 'test'
  ...
# Subtest: press and archive results do not expose session tokens
ok 10 - press and archive results do not expose session tokens
  ---
  duration_ms: 440.62666
  type: 'test'
  ...
# Subtest: message and restart refuse archived threads and restart refuses handed-off threads
ok 11 - message and restart refuse archived threads and restart refuses handed-off threads
  ---
  duration_ms: 441.874848
  type: 'test'
  ...
# Subtest: every assistant action refuses the assistant thread as a target
ok 12 - every assistant action refuses the assistant thread as a target
  ---
  duration_ms: 310.413455
  type: 'test'
  ...
# Subtest: assistant CLI sends the contents of message and text files
ok 13 - assistant CLI sends the contents of message and text files
  ---
  duration_ms: 71.353094
  type: 'test'
  ...
# Subtest: the thread guard reads without writing, so it cannot overwrite a concurrent change
ok 14 - the thread guard reads without writing, so it cannot overwrite a concurrent change
  ---
  duration_ms: 7.253911
  type: 'test'
  ...
# Subtest: assistant reads omit aside conversations
ok 15 - assistant reads omit aside conversations
  ---
  duration_ms: 453.120536
  type: 'test'
  ...
# Subtest: assistant reads refresh local plan status like features
ok 16 - assistant reads refresh local plan status like features
  ---
  duration_ms: 458.025589
  type: 'test'
  ...
# Subtest: assistant recent filters before applying the 30 item limit
ok 17 - assistant recent filters before applying the 30 item limit
  ---
  duration_ms: 1.682327
  type: 'test'
  ...
# Subtest: restart starts a fresh assistant after first preflight fails
ok 18 - restart starts a fresh assistant after first preflight fails
  ---
  duration_ms: 288.25692
  type: 'test'
  ...
# Subtest: assistant actions exclude and refuse project lead threads
ok 19 - assistant actions exclude and refuse project lead threads
  ---
  duration_ms: 323.471439
  type: 'test'
  ...
1..19
# tests 19
# suites 0
# pass 19
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7666.019171
```

`node --test viewer/test/*.test.js`

```text
exit 0
ok 987 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 76.515519
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 988 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 79.796394
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 989 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 133.748168
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 990 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 112.626182
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 991 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 99.392883
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 992 - unknown win op fails without sending a request
  ---
  duration_ms: 84.018239
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 993 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.99371
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 994 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 94.447144
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 995 - the page eligibility regex equals the machine one
  ---
  duration_ms: 2.644577
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 996 - the page eligibility function
  ---
  duration_ms: 0.593265
  type: 'test'
  ...
# Subtest: worker effort must be a supported level and cannot exceed the manifest ceiling
ok 997 - worker effort must be a supported level and cannot exceed the manifest ceiling
  ---
  duration_ms: 3861.879927
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 998 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 72.143197
  type: 'test'
  ...
1..998
# tests 1014
# suites 0
# pass 1014
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 72311.507368
```

## Choices

none
