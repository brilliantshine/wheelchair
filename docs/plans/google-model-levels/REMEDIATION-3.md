# Remediation 3 — google-model-levels

Verification attempt 3 checked commit fcf9ac83 (verifiers: claude-opus-5-5 FAIL, gpt-6.2-sol PASS). Full run on fcf9ac83: every suite exit 0 except viewer-browser exit 1, one failure: `app-settings.spec.js:1424:3 › Antigravity levels › effort save leaves the drafts typed in other cells, in both blocks` (`route.fetch: Test ended` in the route callback at `:1409`). The test does not exist at the comparison commit, so this is not a failure already on main.

## Gap list (verbatim, merged)

- (claude verifier, and the full run) GAP: Validation — `npm --prefix viewer run test:browser -- --grep 'effort'` is flaky. It failed 1 of 10 runs at fcf9ac83 and 1 of 6 at 732be642. The 'Antigravity levels' tests leave a `page.route('**/api/settings')` handler open when a test ends. The settings page reads `/settings` from several places (`viewer/pages/settings.js:236`, `:1871` and others), so a read can still be passing through the route after the test finishes. Playwright then fails that test or the next one with `route.fetch: Test ended … Consider awaiting page.unrouteAll`, and the 2 tests after it do not run. The block has no `test.afterEach(... page.unrouteAll({ behavior: 'ignoreErrors' }))`, though the describe block at `viewer/test/app-settings.spec.js:932` has one.

The test-isolation gap (G4) is confirmed fixed by both verifiers.

## Tasks

### R4 — flaky route handler (claude, light)

Task: R4 (remediation 3) — make the 'Antigravity levels' browser tests stop failing at random.

Gap, verbatim from the verifier (attempt 3, commit fcf9ac83), also seen in the full run: "Validation — `npm --prefix viewer run test:browser -- --grep 'effort'` is flaky. It failed 1 of 10 runs at fcf9ac83 and 1 of 6 at 732be642. The 'Antigravity levels' tests leave a `page.route('**/api/settings')` handler open when a test ends. The settings page reads `/settings` from several places (`viewer/pages/settings.js:236`, `:1871` and others), so a read can still be passing through the route after the test finishes. Playwright then fails that test or the next one with `route.fetch: Test ended … Consider awaiting page.unrouteAll`, and the 2 tests after it do not run. The block has no `test.afterEach(... page.unrouteAll({ behavior: 'ignoreErrors' }))`, though the describe block at `viewer/test/app-settings.spec.js:932` has one."

Exact change: in viewer/test/app-settings.spec.js, in `test.describe('Antigravity levels', () => {` (line ~1318), add as the line right after `test.use({ viewport: { width: 1280, height: 900 } });` the same line used at viewer/test/app-settings.spec.js:932:
  test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); });
Change nothing else.

Ownership boundary: viewer/test/app-settings.spec.js only.

Validation commands (paste the summary line of each):
- npm --prefix viewer run test:browser -- --grep 'Antigravity levels' --repeat-each=15
- npm --prefix viewer run test:browser -- --grep 'effort'
If the first command still fails, do not try other changes: stop and report the failing output.
