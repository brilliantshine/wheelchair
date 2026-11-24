# R3c — report

`viewer/pages/assistant-popup.js:100` now counts human transcript occurrences per text. Pending entries retain their `{ text, seen }` baseline until the transcript contains one more matching human line; when a pending entry clears, later same-text entries advance their baseline. Submission captures that baseline before posting, and the pending bubble renders `p.text` at `:131` and `:317`.

`viewer/test/app-assistant-popup.spec.js:64` seeds an earlier human “yes”, sends another “yes” with the POST acknowledged while the transcript remains unchanged, and asserts that both transcript and pending bubbles remain visible. The old renderer mutation failed at the final bubble assertion (2 elements remained instead of 3); with the fix, the focused regression passed.

The intermittent assertion was the “Open terminal” link `href` in the system-needs card test (`app-assistant-popup.spec.js:110`). The card text could appear before the next poll redraw added the link; product behavior is sound. The test now gives this locator assertion 15 seconds to cover that redraw.

## Validation

`cd viewer && for i in 1 2 3 4 5; do npx playwright test test/app-assistant-popup.spec.js --reporter=line 2>&1 | tail -1; done` (each run was captured to a separate log so exit codes were retained):
```
run 1 exit 0 — 22 passed (49.6s)
run 2 exit 0 — 22 passed (1.0m)
run 3 exit 0 — 22 passed (1.3m)
run 4 exit 0 — 22 passed (56.3s)
run 5 exit 0 — 22 passed (49.9s)
```

`cd viewer && npx playwright test test/app-assistant.spec.js test/app-send-now.spec.js --reporter=line`:
```
exit 0
  28 passed (1.1m)
```

Regression mutation check, with the old renderer temporarily restored:
```
exit 1 (expected)
  1 failed
  › keeps a pending message when earlier transcript text matches
  Failure: expected 3 human bubbles; locator resolved to 2 elements
```
Focused regression with the fix:
```
exit 0
  1 passed (2.5s)
```

## Choices

none
