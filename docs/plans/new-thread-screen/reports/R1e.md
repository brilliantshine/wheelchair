# R1e — machine switch clears the saved list; Remove uses the loaded machine

## What changed, by file

- `viewer/pages/new.js`
  - `machineEl` change handler: after `projectEl.textContent = '';`, now also clears
    `#saved-list` and hides `#saved-empty`, so the previous machine's saved directories
    don't stay on screen until the new answer lands.
  - `removeSaved(name)`: first line is now `if (!state || state.machine !== machineEl.value) return;`;
    the DELETE URL uses `encodeURIComponent(state.machine)` in place of `encodeURIComponent(machineEl.value)`.
- `viewer/test/app-new-thread.spec.js`: new test `switching machine empties the saved list until the answer lands`,
  placed after the delayed machine-switch test and built on the same `page.route` pattern
  (the `other` answer is held on a gate; `hub` answers at once). It asserts the list has one
  `li` on `hub`, zero `li` after switching to `other` while the answer is held, and then one
  `li` (`other-dir`) once it lands.
- `docs/plans/new-thread-screen/reports/R1e.md`: this report.

## Validation

### `npm --prefix viewer ci` (run first)

```
found 0 vulnerabilities
```

### `npm --prefix viewer run test:browser -- app-new-thread.spec.js`

```
Running 20 tests using 2 workers
  20 passed (10.8s)
```

All 10 tests, in both chromium and firefox, passed, including the new one.

### New test fails without the fix

Original `new.js` (from `HEAD`) was swapped in temporarily, and the new test was run with `-g "saved list until"`:

```
    Error: expect(locator).toHaveCount(expected) failed
           - unexpected value "1"
    > 149 |   await expect(page.locator('#saved-list li')).toHaveCount(0);
  2 failed
```

Failing in both chromium and firefox. The fixed `new.js` was then restored and the diff confirmed (`viewer/pages/new.js` and `viewer/test/app-new-thread.spec.js` changed, nothing else).

### `npm --prefix viewer run test:browser`

```
Running 476 tests using 8 workers
  ✘  307 [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  ✘  465 [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  472 passed (1.5m)
```

Failing lines (both browsers, the known failure named in the brief, not in this change's ownership):

```
Error: page.evaluate: TypeError: Cannot read properties of null (reading 'map')
Error: page.evaluate: can't access property "map", line.getAttribute(...).match(...) is null
```

## Not done / could not do

Nothing in the brief was left undone. The arrow test failure is pre-existing and was left alone as instructed.

## Choices

- `viewer/pages/new.js` `removeSaved`: when the machine has changed since the row was rendered, the click is dropped silently (early return), with no message to the user. The brief specified the guard; the silent behaviour is my reading.
- `viewer/test/app-new-thread.spec.js`: the new test seeds one saved entry on both machines (`hub-dir`, `other-dir`) and asserts the count after the answer lands, so the "empty until the answer" check is meaningful. The brief did not specify the seed data or the post-landing assertion.
