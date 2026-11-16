# T3b report

## Changes

- `test-support/smoke/live.js`: poll for turn end and the provider's CLI ID together; report specific session and transcript timeouts. Report hub-held sessions and stop outcomes, preserve provider notes for permission failures, and add repeatable or comma-separated provider and tier filters. The slow-start check uses the first selected tier start.
- `test-support/smoke/live.sh`: unchanged; it already forwards arguments.

## Validation

```text
$ node --check test-support/smoke/live.js && bash -n test-support/smoke/live.sh
exit: 0
```

```text
$ bash test-support/smoke/run.sh
PASS readiness through hub
PASS start
PASS stop
  removed run folder: /tmp/wheelchair-test-run-362494-uWKpn5; private tmux server gone
PASS clean
exit: 0
```

```text
$ node test-support/smoke/harness.js --check-live
Seeded session: {"name":"wc-smoke-sub-lead","role":"sub-lead","live":true,"status":"ready"}
Slow origin fetch: 8.01 s
Run folder removed: true
exit: 0
```

```text
$ bash test-support/smoke/live.sh --only tiers --provider gpt --tier light
CHECK | RESULT | DETAIL
light/gpt | PASS | model gpt-6-luna
exit: 0
```

## Choices

- `live.js`: when only slow-start is selected, retain the existing Claude/light start; provider and tier filters narrow the tier loop only.
- `live.js`: include the last transcript lookup error in the transcript timeout detail.

Nothing requested remained undone.
