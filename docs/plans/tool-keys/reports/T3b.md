# T3b report — blocked

Implemented preliminary hub forwarding in `viewer/app/routes.js`, folder key lines and partial key-status refresh in `viewer/pages/project-tools.js`, and the Shared keys editor in `viewer/pages/settings.js`. Added route and browser coverage in the named viewer tests and extended the fake machine and project-tools browser fixture.

The Shared keys machine-switch browser check failed twice. The first attempted fix waited for the existing shared-project picker to finish loading; the same assertion still failed. Per the worker gate rule I stopped rather than iterate again. The implementation is incomplete and needs investigation before merge: the requested full behavior coverage, mutation checks, and final passing validation remain undone. `reports/T2d.md` is absent from this worktree; I asked the lead whether its commit must be merged.

Screenshots, captured at 390×844 and compared with rendered mockups:

- `/tmp/t3b-tools-phone.png` against `/tmp/t3b-mockup-tools-mixed-phone.png`: the fixture has one weather row instead of the mockup's mixed rows, and the app's existing navigation differs. The owned warning line and card styling match in layout and color.
- `/tmp/t3b-shared-phone.png` against `/tmp/t3b-mockup-shared-chosen-phone.png`: the fixture shows None rather than the chosen project and deliberately shows an unusable key reason; the machine chooser is required by the brief and absent from the mockup. Existing navigation also differs.

The two exact requested validation commands were run before the latest test and fixture edits; their outputs follow. The browser gate failed. The focused retry output is included as evidence of the stop condition.

## Choices

- `viewer/pages/settings.js`: show Shared keys even if no shared project is chosen, allowing access to stored names and the machine's explanatory note.

## Validation

`node --test viewer/test/app-project-tools.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js machine/test/project-tools.test.js`:

```text
exit 0
ok 58 - lead name settings trim and validate names
  ---
  duration_ms: 178.104191
  type: 'test'
  ...
# Subtest: lead name list choice saves, validates and migrates
ok 59 - lead name list choice saves, validates and migrates
  ---
  duration_ms: 174.728144
  type: 'test'
  ...
# Subtest: gemini settings migrate and enforce account and model rules
ok 60 - gemini settings migrate and enforce account and model rules
  ---
  duration_ms: 153.803643
  type: 'test'
  ...
# Subtest: removed worker providers stay removed after saving
ok 61 - removed worker providers stay removed after saving
  ---
  duration_ms: 177.101851
  type: 'test'
  ...
# Subtest: scout preferences and session layers follow the selected provider
ok 62 - scout preferences and session layers follow the selected provider
  ---
  duration_ms: 752.133061
  type: 'test'
  ...
# Subtest: model ID limits protect near-limit scout role layers
ok 63 - model ID limits protect near-limit scout role layers
  ---
  duration_ms: 527.235827
  type: 'test'
  ...
# Subtest: your name is saved, validated, and told to every agent only when set
ok 64 - your name is saved, validated, and told to every agent only when set
  ---
  duration_ms: 212.94056
  type: 'test'
  ...
# Subtest: shared tools project choice saves and clears
ok 65 - shared tools project choice saves and clears
  ---
  duration_ms: 174.229018
  type: 'test'
  ...
# Subtest: shared tools setting defaults, validates and saves
ok 66 - shared tools setting defaults, validates and saves
  ---
  duration_ms: 413.532126
  type: 'test'
  ...
# Subtest: folder problem lines appear and clear on a newer update
ok 67 - folder problem lines appear and clear on a newer update
  ---
  duration_ms: 1.536373
  type: 'test'
  ...
# Subtest: session start sends this machine’s saved paths in order and omits an unset choice
ok 68 - session start sends this machine’s saved paths in order and omits an unset choice
  ---
  duration_ms: 405.392473
  type: 'test'
  ...
# Subtest: ready event updates folder problem card
ok 69 - ready event updates folder problem card
  ---
  duration_ms: 256.152914
  type: 'test'
  ...
1..69
# tests 69
# suites 0
# pass 69
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8790.32021
```

`npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js`:

```text
exit 1
      505 |   await page.getByLabel('Value for K1').fill('s');
      506 |   await page.getByRole('button', { name: 'Set K1' }).click();
    > 507 |   await expect(keyRow(page, 'K1').locator('.pt-chip.set')).toBeVisible();
          |                                                            ^
      508 |   await expect(tool(page, 'ro')).not.toContainText('needs K1');
      509 |   await expect(tool(page, 'multi')).toContainText('needs A, not set on this machine');
      510 |   await expect(tool(page, 'al')).toContainText('needs TOKEN, not set on this machine');
        at /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-1d9da322519c-w11/viewer/test/app-project-tools.spec.js:507:60

    Error Context: test-results/app-project-tools-machine--c2f60-s-and-follow-the-key-status-chromium/error-context.md

    Error Context: test-results/app-project-tools-machine--c2f60-s-and-follow-the-key-status-chromium/error-context.md

  5) [chromium] › test/app-project-tools.spec.js:666:1 › key warnings and shared with follow the loaded checks, not draft edits 

    Error: expect(locator).toContainText(expected) failed

    Locator: locator('.pt-tool[data-tool="a"]')
    Expected substring: "needs TOKEN, not set on this machine"
    Received string:    "acommandxSettingsTOKEN ‹key TOKEN› setRuns on WindowsTurn on if this tool's server runs on Windows. Agents here reach it through wheelchair.shared with b (TOKEN)EditRemove"
    Timeout: 5000ms

    Call log:
      - Expect "toContainText" with timeout 5000ms
      - waiting for locator('.pt-tool[data-tool="a"]')
        14 × locator resolved to <div data-tool="a" class="pt-tool">…</div>
           - unexpected value "acommandxSettingsTOKEN ‹key TOKEN› setRuns on WindowsTurn on if this tool's server runs on Windows. Agents here reach it through wheelchair.shared with b (TOKEN)EditRemove"


      676 |   await keyRow(page, 'TOKEN').getByRole('button', { name: 'Remove TOKEN' }).click();
      677 |   await page.getByRole('button', { name: 'Yes, remove TOKEN' }).click();
    > 678 |   for (const n of ['a', 'b']) await expect(tool(page, n)).toContainText(NEEDS_TOKEN);
          |                                                           ^
      679 |   // an unsaved edit that drops a's TOKEN setting changes nothing
      680 |   await tool(page, 'a').getByRole('button', { name: 'Edit a' }).click();
      681 |   await page.getByRole('button', { name: 'Remove setting' }).click();
        at /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-1d9da322519c-w11/viewer/test/app-project-tools.spec.js:678:59

    Error Context: test-results/app-project-tools-key-warn-ff391-aded-checks-not-draft-edits-chromium/error-context.md

    Error Context: test-results/app-project-tools-key-warn-ff391-aded-checks-not-draft-edits-chromium/error-context.md

  6) [chromium] › test/app-project-tools.spec.js:819:1 › the open editor shows the value field when a key is removed from the Keys list 

    Error: expect(locator).toHaveText(expected) failed

    Locator:  locator('.pt-key[data-key="API_KEY"]').locator('.pt-chip')
    Expected: "not set"
    Received: "set"
    Timeout:  5000ms

    Call log:
      - Expect "toHaveText" with timeout 5000ms
      - waiting for locator('.pt-key[data-key="API_KEY"]').locator('.pt-chip')
        14 × locator resolved to <span class="pt-chip set">set</span>
           - unexpected value "set"


      826 |   await page.getByLabel('Setting name').fill('API_KEY');
      827 |   await page.getByLabel('Setting kind').selectOption('key');
    > 828 |   await expect(page.getByLabel('Value for the new key')).toBeHidden();
          |                                                             ^
      829 |   await keyRow(page, 'API_KEY').getByRole('button', { name: 'Remove API_KEY' }).click();
      830 |   await page.getByRole('button', { name: 'Yes, remove API_KEY' }).click();
      831 |   await expect(keyRow(page, 'API_KEY').locator('.pt-chip')).toHaveText('not set');
        at /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-1d9da322519c-w11/viewer/test/app-project-tools.spec.js:828:61

    Error Context: test-results/app-project-tools-the-open-7b933--removed-from-the-Keys-list-chromium/error-context.md

    Error Context: test-results/app-project-tools-the-open-7b933--removed-from-the-Keys-list-chromium/error-context.md

  6 failed
    [chromium] › test/app-project-tools.spec.js:153:1 › adding and removing keys rebuilds the Keys list while an unsaved tool edit stays 
    [chromium] › test/app-project-tools.spec.js:403:1 › the pickers are locked while a save is pending, and the reply lands on its own project 
    [chromium] › test/app-project-tools.spec.js:439:1 › key warnings follow the current key status ─
    [chromium] › test/app-project-tools.spec.js:484:1 › machine key warnings show for read-only tools and rows, and follow the key status 
    [chromium] › test/app-project-tools.spec.js:666:1 › key warnings and shared with follow the loaded checks, not draft edits 
    [chromium] › test/app-project-tools.spec.js:819:1 › the open editor shows the value field when a key is removed from the Keys list 
  2 skipped
  156 passed (1.7m)
```

`npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js --grep 'folder key status refresh|shared keys follow machine|adding and removing keys'` (second focused attempt):

```text
exit 1

> agent-graph-viewer@1.0.0 test:browser
> playwright test --reporter=list app-project-tools.spec.js app-settings.spec.js --grep folder key status refresh|shared keys follow machine|adding and removing keys


Running 3 tests using 2 workers

(node:1381852) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:1381853) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  2 [chromium] › test/app-project-tools.spec.js:156:1 › adding and removing keys rebuilds the Keys list while an unsaved tool edit stays (803ms)
  ✓  3 [chromium] › test/app-project-tools.spec.js:1554:1 › folder key status refresh preserves drafts and conflict retry uses the new revision (488ms)
  ✘  1 [chromium] › test/app-settings.spec.js:1235:1 › shared keys follow machine, show refusals and reload on revision conflicts (6.7s)


  1) [chromium] › test/app-settings.spec.js:1235:1 › shared keys follow machine, show refusals and reload on revision conflicts 

    Error: expect(locator).toBeVisible() failed

    Locator: getByText('couldn\'t read the shared tools: no copy')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByText('couldn\'t read the shared tools: no copy')


      1263 |   await expect(page.getByRole('alert').filter({ hasText: 'changed elsewhere, reload' })).toBeVisible();
      1264 |   await page.getByLabel('Machine', { exact: true }).selectOption('node-2');
    > 1265 |   await expect(page.getByText("couldn't read the shared tools: no copy")).toBeVisible();
           |                                                                           ^
      1266 |   expect(reads).toContain('node-2');
      1267 | });
      1268 |
        at /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-1d9da322519c-w11/viewer/test/app-settings.spec.js:1265:75

    Error Context: test-results/app-settings-shared-keys-f-d291c-eload-on-revision-conflicts-chromium/error-context.md

    Error Context: test-results/app-settings-shared-keys-f-d291c-eload-on-revision-conflicts-chromium/error-context.md

  1 failed
    [chromium] › test/app-settings.spec.js:1235:1 › shared keys follow machine, show refusals and reload on revision conflicts 
  2 passed (7.6s)
```
