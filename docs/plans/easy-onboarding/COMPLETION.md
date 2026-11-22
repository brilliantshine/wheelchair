---
slug: easy-onboarding
date: 2026-11-21
implemented-by: "standard: gpt-6.1-terra (T1 installer, T2 machine, T3 hub), claude-sonnet-5-5 (T4 pages); sub-lead fixes: claude-opus-5-5"
verified-by: []
---

# Completion Report — Easy install and harness picker

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by: []
```

All rows are `this run`; the plan has no Prior Work section.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1.1 Prerequisite check after the clone guard, Node ≥ 20 via `node -e`, exit 1 before writes | this run | `install.sh:9-35` (loop `:12`, Node messages `:28,:30`) | `install/test/run.sh` cases `missing_tmux`, Node 18 (`WHEELCHAIR_REAL_NODE` stub), restricted-PATH shims `run_case` |
| S1.2 No agent CLI is not fatal; message; `codex/model.sh init` unconditional | this run | `install.sh:80` (message), `install.sh:141-145` (model init) | `install/test/run.sh` case `neither` (serving; exit 0; message; no Claude/Codex homes; stale-viewer check; PATH dirs) |
| S1.3 Service PATH always has `$HOME/.local/bin` and `$HOME/.kimi-code/bin` (systemd and launchd) | this run | `install.sh:414-416`; systemd `install.sh:440`; launchd plist `install.sh:370` | `install/test/run.sh` `neither` and `no_pi` cases; Darwin plist cases |
| S1.4 "Next:" line before the bookmark URL | this run | `install.sh:462` (URL line `:463`) | `install/test/run.sh` "serving setup prints the bookmark last" |
| S1.5 README first-time path, five optional harnesses, macOS steps | this run | `README.md` "First time", "On macOS", "Dependencies" | read |
| S1.6 Fixture changes | this run | `install/test/run.sh` (`neither`, `run_case` shims, `no_pi`, `missing_tmux`, Node 18) | `bash install/test/run.sh` (evidence below) |
| S2.1 Sessions and logins carry `PATH=<service PATH>`; `tmuxPath()` uses `process.env.PATH` | this run | `machine/service.js:786` (`launchEnv`), `:841` (token splice after PATH), `:1518` (login), `:700` (`tmuxPath`) | `machine/test/service.test.js` "default Claude start preserves complete command" and login test (`PATH=`); `machine/test/project-tools-state.test.js` "service PATH drives program checks" |
| S2.2 Recipes module, script download-then-run, vendor docs comments, `WHEELCHAIR_HARNESS_RECIPES` override | this run | `machine/lib/harness-recipes.js` | Sub-lead network check logged in PLAN.md Log (URLs answer; install folders read; Pi package chosen); `machine/test/harness-install.test.js` failed download (curl exit 22 → `failed`) |
| S2.3 npm recipe Node minimum (codex 16.0.0, pi 22.19.0) refuses with the exact message | this run | `machine/lib/harness-recipes.js` (`node:` fields), `machine/lib/harness-install.js` Node gate, labels `:10` | `harness-install.test.js` "npm recipe refuses an old Node before running", "full node version comparison" |
| S2.4 Detached job, log truncated, pid JSON, result JSON, pid removed, old result removed | this run | `machine/lib/harness-install.js` `start()` and `job()` | `harness-install.test.js` (gemini case: old log/result gone, timestamps) |
| S2.5 Setup (unseen.py, dial keeping level, dial failure only warns) and validation (resolve, `--version`), not-found message | this run | `machine/lib/harness-install.js` `job()` | `harness-install.test.js` claude case (setup marker, dial `codex --json` then `claude high`, warning in tail), kimi not-found message |
| S2.6 Routes POST/GET `/v1/harnesses/<p>/install`, 202/404/404 no recipe/409, GET state from files, stale pid → stopped message; `recipes` in `/v1/status` | this run | `machine/service.js:1942-1950`, `:1588` | `harness-install.test.js` (404 unknown, `no recipe`, idle, 409, restart 409, stale pid) |
| S2.7 Machine tests | this run | `machine/test/harness-install.test.js` | `bash machine/test/run.sh` 484/484 |
| S3.1 `harnesses` setting, `normalize`, `describe`; `onboarding_done` defaults | this run | `viewer/app/settings.js:38`, `:223-224`, `:309` | `viewer/test/app-harnesses.test.js` normalize test, "GET settings describes the harness switches" |
| S3.2 Switch governs new placements; pinned lead/sub-lead waits with the left-out reason; waiting line; `wc.js` prints `waiting:`; asides and retries unaffected; unpinned `waiting_provider` enabled | this run | `viewer/app/balancer.js:51-52`, `:95` (waitingProvider uses filtered order); `viewer/pages/thread.js:1304`; `viewer/app/wc.js:189` | app-harnesses tests: "ready and pinned leads…", "a live lead aside fork and an unanswered start retry survive switching off", "wc session start prints the left-out waiting reason" |
| S3.3 `PUT /settings/harnesses/<p>`, 400/404, 409 Lead-order guard, same guard on balancing writes | this run | `viewer/app/routes.js:217-223`, balancing guard in the `balancing` PUT | "switch and balancing writes guard the expanded lead order with the exact message" |
| S3.4 Placement skips switched-off providers; uninstalled CLI = signed out; review-family fallback; rank reason; reservation | this run | `viewer/app/balancer.js:25,40,48,52`; `viewer/app/usage.js` `machineAccounts` (`accounts = logged_in && installed`), `rank` reason | "new leads and all ordered worker roles skip…", "a switched-off review family uses the existing fallback", "missing executable prevents placement…", "lead reservation skips a switched-off provider" |
| S3.5 Ready reason | this run | `viewer/app/ready.js:32` | "ready and pinned leads report the left-out harness…" |
| S3.6 `GET /harnesses` shape (switches, threads_using, machines, `recipe: null` on old service, `signed_in` active accounts only) | this run | `viewer/app/harnesses.js:13-40`, `viewer/app/usage.js` per-CLI fields, `viewer/app/routes.js:95` | "status shape counts live threads, ignores paused and retired logins, and marks old recipes unknown" |
| S3.7 Install forwarders via `passThrough`, 502 naming the machine; `?fresh=1` clears cache | this run | `viewer/app/routes.js:97-103`; `viewer/app/usage.js` `clearCache` | "install forwarders retain every machine status and response body", "fresh harness status fetch clears cached machine status" |
| S3.8 `can_start` (alias resolved, unreachable, out of date, `choose` probe, reasons) | this run | `viewer/app/harnesses.js:18-38` | "can_start reports orders, room, version, connectivity and the resolved hub hostname" |
| S3.9 `GET /onboarding`, `onboarding_done` saved once, short-circuit | this run | `viewer/app/harnesses.js:41-53`, `viewer/app/routes.js:96` | "onboarding requires installation and sign-in on the same machine, saves completion, and short-circuits" |
| S3.10 Hub tests | this run | `viewer/test/app-harnesses.test.js` (18 tests) | `node --test viewer/test/*.test.js` 764/764 |
| S4.1 Harnesses first section, machine picker, unreachable text | this run | `viewer/pages/settings.js:8`, `loadHarnesses` `:1514` | `viewer/test/app-harnesses.spec.js` |
| S4.2 Rows, states, Use switch, action rules, old-service notice, vendor link, "can't start yet" notice with links, re-fetch on return and order save | this run | `viewer/pages/settings.js` `harnessRow` `:1600`, notice `:1678`, `syncSection`/`saveBalancing` re-fetch | `app-harnesses.spec.js` (five rows, vendor link, old service, notice reason, `recipe:false` installed shows Sign in) |
| S4.3 Install state on load / machine change / switch-on, 2 s polling, Can't reach retrying, 409, 404 no recipe, 5 s machine retry | this run | `viewer/pages/settings.js` `pollInstall` `:1542`, `loadHarnesses` `:1514-1540` | `app-harnesses.spec.js` (running on load → succeeded, failed → Try again, POST 404, outage mid-poll, reopen while unreachable then Installing…) |
| S4.4 Sign in inline for the first active account; all-paused and no-account links | this run | `viewer/pages/settings.js` `harnessRow` sign-in branch, sign-in card mount | `app-harnesses.spec.js` Sign in |
| S4.5 Switch-off confirmation with thread count; 409 under row; re-fetch | this run | `viewer/pages/settings.js` `setHarness` `:1576`, confirm text `:1646` | `app-harnesses.spec.js` switch-off confirmation, 409 |
| S4.6 Switched-off harness hidden in accounts, models, review-family picker, order editors; saved orders kept | this run | `viewer/pages/settings.js:485`, `:602`, `:1298`, `:1329`, `:1354-1357`, `harnessOn` `:1480` | `app-harnesses.spec.js` hide test |
| S5.1 Home checklist card from `/onboarding`, polled, hidden on false/failure | this run | `viewer/pages/threads.js:21`, `:87-103`, poll hook | `app-harnesses.spec.js` home card shows/hides |
| S5.2 Browser tests | this run | `viewer/test/app-harnesses.spec.js` (15 tests × phone/desktop × 2 browsers), `viewer/test/app-settings.spec.js` updated for the new first tab | `npm --prefix viewer run test:browser` (evidence below) |

## Deviations from plan

- **S2.2 network checks** were run by the sub-lead before dispatch, not by the worker. The results are in the PLAN.md Log. All five recipes are confirmed, so production ships no `recipe: false` provider; that path is covered only through the test override.
- **S4.5 wording**: with exactly one thread the confirmation reads "1 thread uses <Harness>." For more than one it matches the Spec text.
- **S4.3**: any 5xx from the install forwarder, not only 502, counts as "Can't reach <machine>, retrying…". The 5 s machine retry also runs when the `/harnesses` fetch itself fails.
- **S5.1**: the checklist card also shows in the thread-page sidebar, because that page shares `viewer/pages/threads.js`.
- **S4.1**: Harnesses is first in the section list, but the page still lands on Models and preferences by default.

## Routers

- `machine/AGENTS.md`: rows for `lib/harness-recipes.js`, `lib/harness-install.js` and `test/harness-install.test.js`.
- `viewer/AGENTS.md`: row for `app/harnesses.js`.
- `machine/API.md`: documents `GET/POST /v1/harnesses/<provider>/install` and the `recipes` field in `/v1/status`.

## Validation evidence

Run on the feature branch at `d90ebeea` (all four tasks merged; later commits change only PLAN.md and this file):

`bash install/test/run.sh`
```
FAIL real wheelchair directory is byte-identical after suite
RESULT 208 passed, 1 failed
exit 1
```
The single failure is environmental and pre-existing. The check hashes the real `~/.wheelchair` before and after the suite, and live agent sessions on this machine write under `~/.wheelchair/accounts/*` during the run. The unchanged feature branch, before any build work, gives the same result: `RESULT 205 passed, 1 failed`, same assertion. Every new and changed S1 fixture passes.

`bash machine/test/run.sh`
```
# tests 484
# pass 484
# fail 0
exit 0
```

`node --test viewer/test/*.test.js`
```
# tests 764
# pass 764
# fail 0
exit 0
```
Earlier runs showed `6 message clears debt` (`viewer/test/app-quiet.test.js`) failing about 1 time in 3. That test is a 220 ms timing check in the quiet-session watcher, which this build does not touch; it passes on this run.

`npm --prefix viewer run test:browser`
```
  34 skipped
  1174 passed (15.8m)
exit 0
```

T4 worker branch alone: 1174 passed, 34 skipped, 0 failed.

## Known gaps / residual risks

- The install job runs `<cli> --version` with no timeout, so a CLI that hangs there keeps the job `running`. Deferred D2 (install time limit) covers this.
- A hub-originated 4xx on an install poll (unknown provider or machine) would show `app-error` as the failure tail. Only a malformed URL can cause it.
- The browser tests don't directly check the re-fetch on returning to `#harnesses` or after an order save; the code path was read (`settings.js` `syncSection`, `saveBalancing`).
- `install/test/run.sh` "real wheelchair directory is byte-identical" fails on any machine with live sessions (pre-existing, above).
- Accepted Risks in PLAN.md stand as written.

## Remediation rounds

### Remediation 1 — 2026-11-21

Verification attempt 1 on `c281731a`: the Claude verifier (claude-opus-5-5) passed it; the GPT verifier (gpt-6.2-sol) failed it with 9 gaps. Five were judged rare paths and recorded in PLAN.md Accepted Risks (round verification-1). The lead had the other four fixed, none deferred (`REMEDIATION-1.md`):

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| S2.3: Node check read the service's Node, not the recipe PATH's | The job runs `node -e 'process.stdout.write(process.versions.node)'` with its own env before an npm recipe; too old or no working node → `failed` with the S2.3 message | `machine/lib/harness-install.js:49-55` | `machine/test/harness-install.test.js` "npm recipe checks PATH Node 20.19.0 / 22.19.0 / invalid" |
| S4.6: editing the visible order moved hidden providers | Hidden providers keep their saved slots; visible ones fill the rest; `any` last | `viewer/pages/settings.js` `orderEditor` (~`:1359-1377`) | `viewer/test/app-harnesses.spec.js` hidden-entry order test |
| S4.1–4.3: Install could target the previous machine | Install and Try again use the shown machine (`hz.machine`); rows show "Checking <machine>…" until that machine's status loads; a poll for another machine stops before touching rows | `viewer/pages/settings.js` (~`:1564-1571`, `:1623-1628`, `:1685-1701`) | `app-harnesses.spec.js` held-picker Install test |
| S4.2: sign-in card stayed after switch-off | A successful switch-off closes that harness's sign-in card | `viewer/pages/settings.js` `setHarness` (~`:1596`) | `app-harnesses.spec.js` sign-in close test |

Lanes: R1-1 standard gpt-6.1-terra; R1-2 standard claude-sonnet-5-5.

Validation on `9e1a29cd` (both remediation tasks merged):
```
bash install/test/run.sh          FAIL real wheelchair directory is byte-identical after suite
                                  RESULT 208 passed, 1 failed   (pre-existing live-folder check, see above)
bash machine/test/run.sh          # tests 486 / # pass 486 / # fail 0
node --test viewer/test/*.test.js # tests 764 / # pass 764 / # fail 0
npm --prefix viewer run test:browser   34 skipped / 1186 passed (15.4m) / exit 0
```

### Remediation 2 — 2026-11-21

Verification attempt 2 on `279fc36b`: the Claude verifier passed it; the GPT verifier failed it with 2 gaps, none rare. The lead had both fixed (`REMEDIATION-2.md`). The sign-in gap is the same gap as attempt 1's S4.2 sign-in gap, so this is its second fix attempt.

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| S4.6: Add account submitted a hidden `claude` default | One `addProviders()` list drives the default and the picker; it resets when switches change; nothing offered → no Add account button | `viewer/pages/settings.js` `addProviders`/`addForm` (~`:1288-1302`), `setHarness` (~`:1601`) | `viewer/test/app-harnesses.spec.js` tests (a) and (b) |
| S4.2/S4.6: a sign-in card opened from Accounts survived switch-off | The card records `provider`; a successful switch-off closes any card for that provider, wherever it was opened | `viewer/pages/settings.js` card (~`:1122`), `setHarness` (~`:1600`) | `app-harnesses.spec.js` test (c) |

Lane: R2-1 standard claude-sonnet-5-5.

Validation on `abb50e71`:
```
bash install/test/run.sh          RESULT 209 passed, 0 failed / exit 0
bash machine/test/run.sh          # tests 486 / # pass 486 / # fail 0
node --test viewer/test/*.test.js # tests 764 / # pass 764 / # fail 0
npm --prefix viewer run test:browser   1 failed / 34 skipped / 1197 passed (16.2m)
```
The one browser failure was `app-send-now.spec.js:84` (chromium, a 30 s timeout), which this build does not touch. Run alone it passed: `12 passed (17.2s)`. The GPT verifier saw the same test time out in attempt 2.

### Remediation 3 — 2026-11-21

Verification attempt 3 on `2cf9fa84`: both verifiers failed it on one shared gap, a flaky R2-1 browser test. The GPT verifier also found two cases that need two Settings tabs open at once. The lead accepted those as rare paths, recorded in PLAN.md Accepted Risks with round `verification-3` (`REMEDIATION-3.md`).

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| The Add account browser tests raced their own settings reload: a route handler's `r.fetch()` met a disposed response at teardown | Test-only. Settings stubs go through `patchSettings`, which tolerates a disposed response. Both Add account tests wait for the follow-up `GET /api/settings`. Each describe block unroutes in `afterEach` with `ignoreErrors`. One one-shot refetch count became `expect.poll` with the same predicate. | `viewer/test/app-harnesses.spec.js` (`patchSettings` ~`:36`, `settingsGet` ~`:48`, `afterEach` ~`:66`, `expect.poll` ~`:242`) | itself, repeated |

No product code changed. Lane: R3-1 light claude-haiku-5-5.

Focused repeat on `39de9149`, run by the sub-lead and not taken from the worker's report:
```
npx playwright test test/app-harnesses.spec.js --repeat-each=10   840 passed (14.3m) / exit 0
```

Validation on `bb42466d`:
```
bash install/test/run.sh          FAIL real wheelchair directory is byte-identical after suite
                                  RESULT 208 passed, 1 failed   (pre-existing live-folder check, see above)
bash machine/test/run.sh          # pass 486 / # fail 0
node --test viewer/test/*.test.js # pass 764 / # fail 0
npm --prefix viewer run test:browser   34 skipped / 1198 passed (12.8m) / exit 0
```
