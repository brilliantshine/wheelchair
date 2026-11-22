# R1-b — the "saved" message for the auto-merge switch

## What changed

- `viewer/pages/settings.js` — `modeGroup` takes an optional fourth parameter `saved` (default `SAVED`, so every existing caller is unchanged) and calls `setNote(saved, false)` on a successful save. The `auto_merge` call passes `'Saved'`, so the switch now shows "Saved" instead of "Saved, applies to new sessions".
- `viewer/test/app-settings.spec.js` — one new test, "the auto-merge switch says Saved, not applies to new sessions, and survives a reload". It opens `/app/settings#models`, clicks "On" in the radiogroup "Merge pull requests when done", expects `aria-checked="true"`, expects the page note to read exactly `Saved`, polls the settings API until `auto_merge` is `on`, reloads, and expects "On" still checked.

## Validation

`cd viewer && npx playwright test test/app-settings.spec.js --reporter=list` (log: `/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-91de6c1c2eb1-w6/8d0179e1-05c1-4cff-a8a8-39c3cc4564c6/scratchpad/r1b-pw.log`)

```
exit 0
...
  70 passed (59.2s)
```

The new test ran on both Chromium and Firefox and passed in each (`app-settings.spec.js:258`).

`cd viewer && node --test test/*.test.js` (log: `/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-91de6c1c2eb1-w6/8d0179e1-05c1-4cff-a8a8-39c3cc4564c6/scratchpad/r1b-node.log`)

```
exit 0
# tests 792
# suites 0
# pass 792
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

## Not done

Nothing in the brief was left undone.

## Choices

- `viewer/test/app-settings.spec.js`: placed the new test just before "the style saves", in the same describe block. Setup copies the `#models` route used by the Bypass/Unrestricted radio test; the brief's suggested `aside_access` search found no existing test that clicks that group.
- `viewer/test/app-settings.spec.js`: the test leaves `auto_merge` set to `on` on the shared test server. The spec is serial and no other test reads that key, so I did not add a reset to Off.
