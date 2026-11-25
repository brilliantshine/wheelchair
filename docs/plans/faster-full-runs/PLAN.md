---
slug: faster-full-runs
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-25
---

# Faster full test runs

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first.
**Map:** `MAP.md`, plus `docs/maps/full-test-runs.md`.

## Open Questions

_None._

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode two-part, chosen before PLAN.md existed. | Time savings now; smaller leftovers later. | user |
| D2 | `full-run.sh` runs the browser suite and the other suites side by side instead of one after another. | Logs show browser ~10 min and machine ~6 min running in sequence, with nothing making them wait for each other. | defaulted |
| D3 | Fix the free-port race in `viewer/test/helpers/server.js` (probe closes before the viewer binds, `:15-23`, `:73-76`). | Pre-existing flake that grows with more workers; blocks raising the worker count. | defaulted |
| D4 | After the port fix, the lone full-run browser worker cap is set from a measured comparison rather than kept at 6. | The cap of 6 was chosen because parallel servers clashed. | defaulted |
| D5 | `summary.txt` records each suite's seconds (old Deferred row 3). | Small, and needed to aim further speedups. | defaulted |
| D6 | Qualify lead.md repair step 7's full-run phrase with the `Test picker and full run` heading (old Deferred row 5). | Protocol edits all map to every suite; batch it here. | defaulted |
| D7 | A build runs one full run, only after its verifiers pass, on the final commit; remediation rounds rely on the picked tests. A failing full run is handled as a failed verification (one more round). | Six full runs in the Settings rework; the picker already checks each round. | user |
| D8 | Every browser spec runs in Chromium; only specs marked browser-sensitive (graph geometry, touch, pixel sampling and the like) also run in Firefox. | Running everything twice is about half the browser suite's time. | user |
| D9 | When full runs overlap (another thread's full run is live), browser workers are shared fairly across them instead of dropping each to 2. | `test-support/browser-workers.js:8` drops overlapping runs to 2 workers, likely why runs feel like 30 minutes. | defaulted |
| D10 | Supersedes D7: the full run keeps today's timing, started alongside the verifiers on each verification and remediation commit. No role-rule change for timing. | Collin: the slow part is the wait after verification passes; starting late would make that wait the whole run. | user |
| D11 | CONTRIBUTING.md (the repo law), AGENTS.md and viewer/AGENTS.md are edited to say the browser suite runs every spec in Chromium and only the listed specs in Firefox. | Follows D8; the law currently says the suite runs in both browsers (`CONTRIBUTING.md:94`). | user |
## Spec

Goal: shorten one full run and the wait after verification passes, without missing what a
full run catches today. Full-run timing in the build is unchanged (D10). This project has a
`Test picker and full run` heading: commands below are targeted; the pusher's full run covers
the whole set.

### S1. Port clash fix (D3) — `viewer/test/helpers/server.js`

- Today `freePort()` (`:15-23`) closes its probe before the spawned viewer binds, so two
  parallel `startServer` calls can get the same port; the loser exits with "Refused to use a
  port held by a process it cannot identify." (`viewer/server.js:2287-2310`).
- When `startServer` chose the port itself (no `port` argument) and the child exits before
  printing its URL with stderr containing `Refused to use a port held by a process it cannot
  identify` or `EADDRINUSE`, it picks a fresh port and starts again, up to 5 attempts in all,
  then throws the last error unchanged. Any other startup failure throws at once, as today.
- An explicit `port` argument (sequential restart tests) never retries.
- Each failed attempt's child is killed and awaited before the next starts, as the existing
  error path does; temp and state directories are reused across attempts.
- For the test, `startServer` accepts an optional `nextPort` function (default `freePort`);
  only tests pass it.
- Test: new `viewer/test/server-port-retry.test.js`. (a) `nextPort` returns first a port held
  by a plain `net` listener in the test, then a free one: the server starts on the second
  port. (b) With an explicit `port` held by such a listener, `startServer` rejects without
  retrying. (c) A failure without either message is not retried.

### S2. Suites side by side, with timings (D2, D5) — `test-support/full-run.sh`

- `viewer-browser` starts in the background, writing its log as today. Meanwhile the other
  suites run one after another in today's order (viewer-node, machine, test-support,
  sensitivity, codex, install, sudo-helper). The script waits for the browser suite before
  writing the summary.
- `summary.txt`: first line `commit <sha>` as today, then one line per suite in today's
  fixed order (viewer-browser first), whatever order they finish in:
  `suite <name> exit <n> seconds <s>`, `<s>` the suite's wall time in whole seconds. The
  printed progress lines gain the same seconds.
- Exit status, the dirty-worktree refusal, `WHEELCHAIR_FULL_RUN=1`, log file names and the
  sudo-helper pair's combined result are unchanged.
- Anything that reads `summary.txt` keeps working: it only looks at the `commit` line and
  each suite's exit. Update the format sentence in `AGENTS.md:85`.
- Test: new `test-support/test/full-run.test.js`. In a temp git repo containing a copy of
  `full-run.sh` and stub suites at the paths it calls (each stub records start and end
  times and exits with a chosen code; the browser stub sleeps longer than the rest), assert:
  the browser stub's run overlaps the machine stub's; summary lines appear in the fixed order
  with the `seconds` field; the script exits 1 when one stub fails and 0 when all pass; the
  dirty-tree refusal still exits 2.

### S3. Browser workers (D4, D9) — `test-support/browser-workers.js`

- `chooseWorkers({ full, others, cpus })`: a non-full run gets 2. A full run gets
  `max(2, floor(top / (others + 1)))` with `top = min(CAP, floor(cpus / 2))`, `others` the
  number of other live full runs. With `CAP` 8 on 16 cores: alone 8, one other 4, two or more 2.
- `CAP` is a named constant, measured once after S1 is in: run the browser suite alone as a
  full run with `WHEELCHAIR_BROWSER_WORKERS=6` and `=8` on the same commit (each run uses
  `WHEELCHAIR_FULL_RUN=1`), and set `CAP` to the faster one that passed; ties keep 6. Record
  both times and the choice in the task report.
- `decide()` passes the live count instead of a yes/no; the env override and registration
  are unchanged. Update `viewer/playwright.config.js:10` comment and `viewer/AGENTS.md:57`.
- Test: `test-support/test/browser-workers.test.js` covers alone, one other, two others,
  low-CPU machines and non-full runs.

### S4. Firefox only where it matters (D8, D11)

- `viewer/playwright.config.js`: the `chromium` project runs every `*.spec.js` as today. The
  `firefox` project runs only the files in one exported list,
  `viewer/test/firefox-specs.js` (an array of file names), initially: `browser.spec.js`
  (graph rendering and geometry), `touch.spec.js` (touch gestures),
  `background-rendering.spec.js` (pixel sampling), `background-editor.spec.js`,
  `app-mockup-png.spec.js`, `app-screenshot-view.spec.js`, `app-spot-comment.spec.js`,
  `app-chat-stability.spec.js` (drawing, images and scroll behaviour). Each entry has a
  one-line comment saying why it needs Firefox.
- `npm --prefix viewer run test:browser` still fails loudly if either browser is missing.
- Edit the law and routers to match: `CONTRIBUTING.md:94` ("runs in both Chromium and
  Firefox"), `AGENTS.md:67`, `viewer/AGENTS.md:57` and `:94`, and the config's top comment.
  Each says: every spec in Chromium, the specs in `viewer/test/firefox-specs.js` also in
  Firefox, and that a spec testing drawing, touch, pixels or scroll belongs on that list.
- Test: new `viewer/test/playwright-projects.test.js` loads the config and asserts the
  firefox project selects exactly the listed files, every listed file exists, and the
  chromium project is unrestricted.

### S5. lead.md wording (D6)

- `protocol/app/lead.md` repair step 7: "and start the full run alongside it unless the
  commit is covered" becomes "and, with that heading, start the full run alongside it unless
  the commit is covered". No other protocol change.

### Validation commands

```bash
node --test viewer/test/server-port-retry.test.js viewer/test/server.test.js viewer/test/app-new-thread.test.js
node --test test-support/test/full-run.test.js test-support/test/browser-workers.test.js
node --test viewer/test/playwright-projects.test.js
npm --prefix viewer run test:browser -- --list   # firefox lists only the files in firefox-specs.js
npm --prefix viewer run test:browser -- touch.spec.js app-new-thread.spec.js
git diff --check
```

### Non-goals

- No change to when full runs start or what gates a push (D10).
- No change to test content beyond S1's helper; no tests deleted.
- Picker changes stay deferred.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | Follow imports transitively so picks are smaller | The fallback already runs more, never less | planning | `test-support/pick-tests.js:55-74` reads only direct relative imports in non-browser test files |
| 2 | Flag test-map.json entries pointing at missing files or globs matching nothing | A stale entry only makes picks larger or falls back | planning | Missing targets are skipped silently (`test-support/pick-tests.js:33`, `:76-80`); could live in pick-tests.test.js against the real tree |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-25

**Lanes:** intent (pending); mechanics (pending); cross-family: pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
