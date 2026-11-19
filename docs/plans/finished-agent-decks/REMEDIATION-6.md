# Remediation 6: finished-agent-decks

Verification attempt 6 ran on commit eacd33d108a4b65ca834dd2752bcb7ded3225deb. The Claude verifier passed with no gaps. The GPT verifier failed with the two gaps below.

Gap 1 is G5 / Decision 18 surviving a second fix. It went to the lead and on to Collin, who chose to reword the invariant (PLAN.md Decision 19). That means no code change and a new boundary test. The lead said to fix gap 2.

## Gaps (verbatim)

GAP: Decision 18 and Spec §5, preserve popover scroll across refresh — In Chromium and Firefox at 390×844, adding a 41st reviewer and moving the open deck below the fold changed `scrollTop` from 943 to 806. The popover stayed inside the 8px margins and page scroll stayed at 1230px. The new placement grew the popover from 642px to 826px of client height, so the browser clamped the restored position. The committed tests set `scrollTop` to 250px and miss this boundary — `viewer/pages/agents.js:234–247`, `viewer/test/app-agents-decks.spec.js:259`, [probe log](/tmp/finished-agent-decks-verify.GeGP6M/probe.log).
GAP: Spec §1, `--round` CLI parsing — A session start ending in `--title '--round'` now fails with `--round requires a value`. The pre-feature parser accepted the literal title. The new scan checks every argument before the parser determines which tokens are flag values — `viewer/app/wc.js:39–45,75–76`.

## Tasks

| Task | Gap | Provider / tier | Ownership |
|------|-----|-----------------|-----------|
| R7 | 2 | gpt, light | `viewer/app/wc.js`, `viewer/test/app-session-meta.test.js` |
| R8 | 1 (Decision 19 boundary test) | claude, standard | `viewer/test/app-agents-decks.spec.js` |

### R7 brief

Plan slug: finished-agent-decks. Task id: R7 (remediation of verification attempt 6). Lead session (for questions the plan does not settle): wc-d268e3df9c50-lead.

Gap: `docs/plans/finished-agent-decks/REMEDIATION-6.md`, gap 2. `wc.js session start ... --title '--round'` is refused with "--round requires a value". The bare-`--round` check at `viewer/app/wc.js:75` scans every raw argument, so it treats the value of `--title` as the flag. Make exactly the change below.

## Code change, `viewer/app/wc.js` only
1. Delete line 75, which reads:
   `if (operation === 'start' && tail.some((arg, i) => arg === '--round' && (!tail[i + 1] || tail[i + 1].startsWith('--')))) throw new Error('--round requires a value');`
   Do this by editing the file; this is not a file deletion.
2. In `flags(args)` (lines 39-45), the last branch is `else output[args[index].slice(2)] = args[++index];`. Replace it with:
   `else { const name = args[index].slice(2), value = args[index + 1]; if (name === 'round' && (value === undefined || value.startsWith('--'))) throw new Error('--round requires a value'); output[name] = value; index += 1; }`
   This refuses a bare `--round` only where `--round` is in flag position. A flag's value is consumed before the next flag is looked at, so `--title --round` stores the title `--round`.
   `flags` is also used by `gitRequest`, and `round` never appears there, so nothing changes for git.

## Test, `viewer/test/app-session-meta.test.js`
Next to line 125, where bare `--round` refusals are already tested:
- add `assert.equal(sessionRequest('start', [...args, '--title', '--round']).body.title, '--round');`
- keep the existing refusals of `['--round']` and `['--round', '--title', 'x']`.

## Ownership boundary
You own `viewer/app/wc.js` (the two edits above) and `viewer/test/app-session-meta.test.js`. Touch nothing else except your report at `docs/plans/finished-agent-decks/reports/R7.md`.

## Validation
```bash
node --test viewer/test/app-session-meta.test.js viewer/test/wc-cli.test.js
node --test viewer/test/*.test.js
```

## Rules
- Never delete files with `rm` or any other deletion command.
- Never run `./install.sh`. Never start a viewer server by hand.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path1>,<path2>`, listing every path you changed, your report included, separated by commas.
- If the same gate fails twice, stop and report rather than iterating. Other sessions' test suites may load this machine heavily. These tests fail intermittently here without this change too:
  - app-quiet.test.js
  - app-uploads-archive.test.js
  - app-machines.test.js
  - app-hub.test.js
  - registration.test.js
  - routes.test.js
  - any test whose server refuses a held port

  If only these fail, re-run that file alone and paste both outputs.

## Deliverable
Committed code and test, plus your report. The report must list what changed in each file and paste the summary lines of each validation command. Close it with this section:

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.

### R8 brief

Plan slug: finished-agent-decks. Task id: R8 (remediation of verification attempt 6). Lead session (for questions the plan does not settle): wc-d268e3df9c50-lead.

Gap: `docs/plans/finished-agent-decks/REMEDIATION-6.md`, gap 1. A popover scrolled near its bottom grows on refresh, so the browser clamps `scrollTop`. In the verifier's run it went from 943 to 806. Collin decided (PLAN.md Decision 19) that this is correct behaviour. The invariant now reads: **after a refresh an open deck popover keeps its scroll position, or the nearest one the box allows; rows that were visible stay visible.** There is **no code change**. Your job is one new test case that pins this boundary. Do not touch `viewer/pages/agents.js` or any other source file.

## Where
`viewer/test/app-agents-decks.spec.js`, inside `test.describe('popover invariant across a refresh', ...)` (about lines 240-280). It runs for both browsers and for the phone (390×844) and desktop labels, like the other scenarios. Reuse the existing helpers there: `base`, `roundsOf`, `workers`, `spacer`, `raf2`, `open`, `lead`, `reviewer`, and the `scenario` flow as a model.

## The case
Name it `'popover scrolled to the bottom grows on refresh'`. Build it like the `'deck pushed off screen by a new finished member'` scenario: `before: workers(W)` and the same `change`, so the deck moves below the fold and the popover gets more room and grows. The differences:

1. After `Show all 40 rounds`, also expand round 40 (`[data-round="40"]`) so the popover is long. Then scroll the popover to its bottom: `e.scrollTop = e.scrollHeight`.
2. Before the refresh, record:
   - `want = scrollTop`, and assert it is greater than 0;
   - `clientHeight`;
   - the list of fully visible rows. Use the `data-round` of every `.deck-round-btn` whose bounding rect lies fully inside the popover's client rect (±1px).
   Assert that this list is not empty.
3. Run the same refresh, then the same wait as the scenario: `waitForResponse` on `/api/agents`, then `raf2`, then the poll that the deck is below the fold.
4. After the refresh, assert:
   - the popover is fully inside the viewport with 8px margins, using the same four assertions as the scenario;
   - its `clientHeight` grew compared with before. If it did not grow in some browser or width, the case is not testing the boundary. Then adjust the setup (more rows, a taller spacer) until it grows in all four browser and width combinations. Do not drop the assertion;
   - `scrollTop` is within 2px of `Math.min(want, scrollHeight - clientHeight)`, measured after the refresh;
   - every `data-round` recorded in step 2 is still fully inside the popover's client rect (±1px).

Keep the existing four scenarios and their `|scrollTop - want| <= 2` check unchanged: at a 250px scroll they still hold under Decision 19.

## Ownership boundary
You own only `viewer/test/app-agents-decks.spec.js`, plus your report at `docs/plans/finished-agent-decks/reports/R8.md`.

## Validation
```bash
cd viewer && npx playwright test test/app-agents-decks.spec.js
npm --prefix viewer run test:browser
```
The first must pass in full, including your new case in Chromium and Firefox at both widths. In the full suite, these tests fail intermittently on this machine without this change:
- `app-threads`
- `app-handoff` :205 and :227
- `browser.spec` :875 and :2157
- `app-settings` :45 and :61
- `pages` :360
- `app-accounts` :519, :527 and :534 (local midnight; they pass with `TZ=UTC`)

If only those fail, re-run the failing file alone and paste both outputs.

## Rules
- Never delete files with `rm` or any other deletion command.
- Never run `./install.sh`. Never start a viewer server by hand; the specs start isolated servers themselves.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path1>,<path2>`, comma-separated, report included.
- If the same gate fails twice for a reason you cannot trace to your test, stop and report.

## Deliverable
The committed test and your report. The report lists what you added and pastes the summary lines of both validation commands. It also gives the before and after `scrollTop` and `clientHeight` you observed in one browser at one width. Close the report with this section:

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
