---
slug: modular-harness-connectors
date: 2026-11-22
implemented-by: "standard / gpt-6.1-terra (T1–T4, T6, T7a, T7c; T1c–T1e at xhigh, T3d at high), light / gpt-6-luna (T6b), standard / claude-sonnet-5-5 (T5, T5b, T7b); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Make harness connectors modular

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line numbers
are at commit `ed360596` (feature branch `wc/dfb566cd9dd5`). Base commit for "before" is
`c7fc1322`. The plan's Prior Work table is empty, so every row's origin is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 `connectors/` at the repo root; registry order `claude, codex, agy, kimi, pi` | this run | `connectors/index.js:3` | `machine/test/connectors-contract.test.js:10` (folders ↔ registry, unique ids) |
| S1 `list()`, `manifest(cli)`, `byProvider(id)`; `machine(cli)`/`hub(cli)` load and validate a half on first use; nothing written at load | this run | `connectors/index.js:5-11` | contract test `:10`; `machine/test/adapters-loaded.test.js:6` |
| S1 `machine/adapters/` removed; `common.js` moved to `connectors/common.js`; Pi extension and guard moved | this run | `connectors/common.js`, `connectors/pi/extension.js`, `connectors/pi/guard.js` (git renames); only deletion since base is `machine/adapters/index.js` | Validation grep `adapters/(index\|claude\|…)` → no hits |
| S1 `connectors/` requires nothing under `viewer/`; hub loads only manifests and hub halves | this run | `connectors/*/hub.js`, `connectors/hub-common.js`; `viewer/app/chat.js:9-12` | require-cache check: loading `viewer/app/{routes,sessions,usage,usage-poll,settings}.js` loads no `connectors/*/machine.js` (run in T4 review; check shown to bite) |
| S1 `viewer/app/providers.js` exports unchanged, built from manifests | this run | `viewer/app/providers.js:3-8` | contract test `:43` (frozen snapshot); `node -e` output on `main` vs branch: identical (evidence below) |
| S2 manifest data per tool (identity, flags, capabilities, install, settings, models, placement, report, hook, recover, shortName, asideParentField) | this run | `connectors/{claude,codex,agy,kimi,pi}/manifest.js`; schema in `connectors/contract.js:1-16` | `contract.validateManifest` (`connectors/contract.js:29`) run for every manifest by contract test `:10`; fake-manifest rejections `:18` |
| S2 `effort`, `preflight`, `asideFork` derived, effort levels only in `models.efforts` | this run | `viewer/app/providers.js:4` | providers snapshot and main-vs-branch diff |
| S2 `placement` (`workerRank`, `leadDefault`, `seenByDefault`, `addOnMigration`, `appendWhenRequested`) | this run | `viewer/app/settings.js:54,280-281`; `viewer/app/balancer.js:98` | `viewer/test/char-settings-defaults.test.js`; `viewer/test/app-balancer.test.js:464` |
| S2 `install` (recipe, binary, label, `versionArgs`, `fallbackPath`, `pathRank`, `sensitivity`, plus `lookup`) | this run | `machine/lib/harness-recipes.js:4`; `machine/lib/harness-install.js:101,115,124`; `install.sh:62-75,431` | `machine/test/char-lib-install.test.js`, `char-lib-basics.test.js`; `install/test/run.sh` 213/213 |
| S2 `models.hubPattern`, `slotAliases`, `effortError`; `settings.modelPattern` kept separate | this run | `viewer/app/routes.js:316-322`; `viewer/pages/settings.js` (`toolOf(...).settings.modelPattern`) | `viewer/test/char-hub-dispatch.test.js` item 4; `viewer/test/app-openrouter-settings.test.js` |
| S2 `shortName` keeps machine wording | this run | `machine/service.js` `versionGate` (`${manifest.shortName \|\| manifest.displayName} is not installed`) | `machine/test/char-service-branches.test.js` ("launch version gates apply to Pi and Kimi and preserve their exact errors") |
| S2 `asideParentField` (aside tools only; Antigravity entry dropped) | this run | `viewer/app/asides.js:42` | `char-hub-dispatch.test.js` item 7 |
| S2 `hook` field (`payload` stdin / last-arg, `sessionFromEnv`) | this run | `machine/lib/hook-in.js:9,12` | `machine/test/char-hook.test.js` (T1) |
| S3 required machine members; exactly one of `hookEvent`/`turnPoller` | this run | `connectors/contract.js:17,21-27` | contract test `:10`, `:18` (missing member, both/neither turn end) |
| S3 required hub members `parseChat`, `readReport` → `{ text, settled }`; delivery loop retries while unsettled; `report.useHookText` (default true) | this run | `connectors/*/hub.js`; `viewer/app/sessions.js:439,453`; `viewer/app/chat.js:12,78` | `viewer/test/app-chat.test.js`, `app-report-retry.test.js`, `char-hub-dispatch.test.js` item 8; `viewer/test/report-default.test.js` |
| S3 `usageProbe` (claude, codex, kimi) | this run | `machine/service.js:2125-2129`; `viewer/app/usage-poll.js:18` | `machine/test/char-usage.test.js`; `viewer/test/app-usage.test.js` |
| S3 `usageEvents` (claude, codex) | this run | `machine/service.js:1555` | `machine/test/pi.test.js` ("Pi ignores usage-like hook events") |
| S3 `preflight` (codex; one connector) | this run | `machine/service.js:2136`; `connectors/codex/machine.js` `preflightCommand`; `viewer/app/balancer.js:60` | `char-service-branches.test.js` (preflight); `viewer/test/char-ready.test.js` |
| S3 `sandbox` (codex) | this run | `machine/lib/screen.js:3`; `machine/lib/win.js:3`; `machine/lib/win-prompt.js:3` | `machine/test/char-lib-screen.test.js`, `char-lib-win.test.js`, `char-win-prompt.test.js` |
| S3 `restartLoss` + `stopWhenEnded` (kimi, pi) | this run | `machine/service.js:564,568` | `char-service-branches.test.js` (restart recovery) |
| S3 `projectTools` (codex) | this run | `machine/lib/project-tools.js:8` | `char-lib-project-tools.test.js` |
| S3 `recover` (`recognizePane`, `recoverRank`, `recoverFallback`) | this run | `machine/service.js:560` | `char-service-branches.test.js` (recovery classifier) |
| S3 `spend` (pi) | this run | `machine/service.js:2110`; `viewer/app/usage.js:21` | `viewer/test/app-openrouter-usage.test.js`; `char-hub-dispatch.test.js` item 3 |
| S3 `liveSwitch` (claude, codex) | this run | `machine/service.js:869`; `viewer/app/sessions.js:632` | `machine/test/char-switch.test.js` |
| S3 `aside` (+ aside members, redaction) | this run | `machine/lib/aside-turns.js:7` | `machine/test/aside-turns.test.js`, `char-lib-aside.test.js`, `char-lib-argv.test.js`, `char-lib-basics.test.js` |
| S3 `versionCheck` (kimi, pi) | this run | `machine/service.js:805` (`versionGate`) | `char-service-branches.test.js`; `machine/test/kimi.test.js`, `pi.test.js` |
| S3 `steps` (codex; `readSteps`, `stepsReady`) | this run | `machine/service.js:1084`; `connectors/codex/steps.js`; `connectors/contract.js:18` | `machine/test/codex-steps.test.js`; contract test (T7c steps rule) |
| S3 `contract.validate` names tool and member; per-half validation on first load | this run | `connectors/contract.js:21`; `connectors/index.js:10` | contract test `:18` |
| S4 no name checks outside `connectors/`: capability checks, member calls, manifest fields | this run | across `machine/`, `viewer/app/`, `viewer/pages/` (rows above) | `machine/test/name-guard.test.js` (passes; allowlist `:25`) |
| S4 shared output scrub for every pane and login output | this run | `connectors/common.js:26`; `machine/service.js:603,1671` | `machine/test/char-redaction.test.js` |
| S4 Pi `redact` for its transcript lines, events, aside output | this run | `machine/service.js` transcript copy (`adapters[cli]?.redact?.(line)`); `machine/lib/aside-turns.js` | `char-redaction.test.js`; `char-service-branches.test.js` ("transcript copy redacts Pi lines…"); `char-lib-aside.test.js` |
| S4 diagram-sensitivity trigger via `install.sensitivity`; `sensitivity/set.sh` unchanged; at most two flagged | this run | `machine/lib/harness-install.js:101`; `connectors/contract.js:52` | `char-lib-install.test.js`; contract test `:18`; `sensitivity/test/run.sh` 67/67 |
| S4 user-visible wording byte-identical | this run | — | every `char-*.test.js` pins exact strings and passes unchanged (see Deviations for the allowed stub-target edits); browser suite |
| S5 `hook.sh` keeps path and arguments, bash 3.2, execs `hook-in.js` without reading stdin | this run | `machine/hook.sh:8`; `machine/lib/hook-in.js` | `machine/test/char-hook.test.js`; Accepted Risks row 1 (exit precedence) |
| S5 `hook-post.js` command line unchanged (statusline caller) | this run | `machine/lib/hook-post.js` | `machine/test/steps.test.js` ("statusline independently throttles…") |
| S5 `registry.json` generated and committed; `export.js --check` | this run | `connectors/export.js:6`; `connectors/registry.json` | `node connectors/export.js --check` exit 0; contract test runs it |
| S5 `codex/model.sh` reads the registry with Python (`WHEELCHAIR_REGISTRY` or real path); provider enumerations incl. `parse_pins` from it; per-tool code marked `model-script` | this run | `codex/model.sh:14-37,67-80` | `codex/test/run.sh` 164/164 incl. sixth-provider round trip (`:505-528`) |
| S5 `install.sh` detection, "harness found", `present` list, fallbacks, PATH order from the registry; legacy cleanup kept | this run | `install.sh:62-75,95-103,183-188,431` | `install/test/run.sh` 213/213 |
| S5 pages read `/wheelchair/assets/tools.js` (no `install`), loaded before page scripts; own copies deleted | this run | `viewer/server.js:8,1739`; `viewer/pages/{settings,threads,thread}.html`; `viewer/pages/settings.js:16`, `threads.js:15`, `thread.js:4` | `viewer/test/app-tools-asset.test.js`; page specs in browser suite |
| S6 characterization tests before moves | this run | 17 files `machine/test/char-*.test.js`, `viewer/test/char-*.test.js` (T1–T1e, merged before T2) | all pass at `ed360596` |
| S6 `adapters-loaded.test.js` iterates the registry | this run | `machine/test/adapters-loaded.test.js:6` | machine suite |
| S6 smoke scripts use connector paths; `live.sh` scope unchanged | this run | `test-support/smoke/kimi-live.js:68`, `pi-aside-live.js:9`, `pi-guard.js:29` | Validation grep; live smoke not run (costs model turns) |
| S6 contract test | this run | `machine/test/connectors-contract.test.js` | passes |
| S6 name-check guard test with tagged allowlist | this run | `machine/test/name-guard.test.js` | passes; bite-tested by T7a worker (throwaway `=== 'kimi'` line) |
| S6 `codex/test` sixth-provider round trip | this run | `codex/test/run.sh:500-528` | `codex/test/run.sh` 164/164 |
| S6 no test deleted without its assertions moving | this run | — | `git diff --diff-filter=D c7fc1322..ed360596` lists only `machine/adapters/index.js` |
| S7 `connectors/README.md` guide and checklist | this run | `connectors/README.md` (307 lines) | every `contract.js` member named in it (check in T7b/T7c); scout read against code |
| S7 routers and API docs | this run | `AGENTS.md:13,30`; `machine/AGENTS.md:10`; `viewer/AGENTS.md:34`; `machine/API.md` | grep for `adapters/` in those files → no hits |

## Deviations from plan

- **Extra manifest fields and optional members** added under S4's "where today's behaviour differs and no existing name explains it" rule, each listed in `connectors/contract.js` and the guide: `install.lookup`, `wrapProjectTools`, `injectProjectKeys`, `joinPaneLines`, `login.killTarget`, `stylePreview` (+ `stylePreviewArgv`), `models.familyCommand`, `models.bareTierSet`, `settings.scoutAgentTool`, `settings.monoModelNames`, `settings.keyPrompt`, `usage.{showWarning,probeWhileLive,tryEveryMachine,defaultProblem}`; members `stepVocabulary`, `stepsReady`, aside members (`asideNewId`, `asideModel`, `asidePrepare`, `asideMessage`, `asideResult`, `asideProblem`), Kimi `bindTranscript`/`spoolWaiting`/`validTranscript`, version members (`checkVersion`, `versionStatus`, `recordLaunch`, `launchPath`), `launchContext`, `failureNote`, `beforeTurnEvent`, `loginState`/`loginResult`, `startupCheck`, `disableProjectServers`. Full list with reasons in PLAN.md Log ("Choice:" lines).
- **Some connector members run with the machine service as `this`** (Kimi `turnPoller`, binding and version checks; Pi version check), so the version caches stay on the service. Behaviour-neutral; a design choice recorded in the Log.
- **Characterization-test edits** (allowed by the briefs): `char-lib-argv.test.js` expected Pi guard path updated for the move; stub or call targets renamed in `char-service-branches.test.js`, `char-lib-project-tools.test.js`, `char-lib-aside.test.js` and non-char machine tests when service methods became generic. No assertion, expected value or input changed (checked line by line in T7a and T7c reviews).
- **Two OpenRouter page tests** (`viewer/test/app-openrouter-settings.test.js`, `app-openrouter-signin.test.js`) read constants from the page source that the page no longer holds; each assertion now checks the same fact in the manifest plus the page code that reads it (old → new list in `reports/T5.md`).
- **`model.sh` matches every provider's model name with `re.fullmatch`** (previously `re.match` with `$` for non-OpenRouter): differs only for a model name ending in a newline, which the hub already rejects.
- **`model.sh`'s "has no effort setting" message** is driven by an empty `models.efforts` and the tool's label; the Kimi wording is identical (new exact assertion).

## Routers

- `AGENTS.md`: `connectors/` added to the Layout table's Executable row (`:13`) and to "Where to go" (`:30`, router `connectors/README.md`).
- `machine/AGENTS.md`: the stale `adapters/` row now points to `../connectors/` (`:10`); a row for the hook files names `lib/hook-in.js`.
- `viewer/AGENTS.md`: `app/providers.js` described as built from the connector manifests (`:34`); `/wheelchair/assets/tools.js` named among the asset routes.
- `machine/API.md`: "The adapter" → "The Antigravity connector".
- `viewer/app/API.md`: unchanged (names no adapter paths or asset routes).
- New router `connectors/README.md`.

## Validation evidence

All run at `ed360596` from the repository root with no worker running, one suite at a time.

`bash machine/test/run.sh` — first run stalled after the Windows-sync tests and was killed at 600 s (`exit 124`, 660 ok, 0 not ok so far); immediate re-run:
```
# tests 723
# pass 702
# fail 19
# duration_ms 65265.428659
```
The 19: the 18 known `wslpath` failures from the base-commit baseline (PLAN.md Log, c7fc1322) —
existing copy remains waiting until a post-start reconcile completes; failed readying becomes ready after a later successful sync; run timeout syncs, status syncs an exit and launch environment excludes the token; readying times out without blocking launch and does not create copies for ordinary sessions; worker merge cleanup deletes its copy and stop does not reconcile; verifier stop returns immediately and deletes after its apps stop; failed copies survive ordinary removal and archive, but verifier and merge removal delete them; archive waits for successful final sync then deletes the copy; archive removes the thread folder when the copy went with its worktree first; archive waits once for a final sync and retains a failed copy; sweep reconciles a dead lead with no apps; sweep marks dead app copies and reconciles a shared thread worktree after a worker registered; tracker close callback marks the copy used; sessions sharing a worktree share the copy and Windows tool use triggers stop sync; archive deletes copies while retaining conflict refs; cleanup removes a vanished linked worktree copy without a reconcile; launch marking causes a final reconcile after readying; restart recovery tracks a live lead and reconciles on stop —
plus `interop off withholds marked tool and logs it for every CLI` (`win-forward-service.test.js:113`, error `tmux buffer failed`), which passes alone:
```
$ node --test --test-name-pattern "interop off withholds marked tool" machine/test/win-forward-service.test.js
# tests 1
# pass 1
# fail 0
```

`(cd viewer && npm test)`:
```
# tests 912
# pass 912
# fail 0
```

`(cd viewer && npm run test:browser)`:
```
  9 failed
  1397 passed (16.2m)
```
Failures: `app-accounts.spec.js:576,584,591,599` (`lead waiting line`) in chromium and firefox — each prints a weekday time ("about Mon 12:38 AM") because now + the test's offset crosses midnight (run at 22:3x–22:5x PST); the 576/584/591 trio was shown failing identically on the feature branch without T5 (`reports/T5.md`, T5b section). `app-send-now.spec.js:84` (chromium) timed out waiting for a response; alone:
```
$ npx playwright test test/app-send-now.spec.js --project=chromium
  6 passed (15.4s)
```

Other commands:
```
$ bash install/test/run.sh        → RESULT 213 passed, 0 failed
$ bash sensitivity/test/run.sh    → RESULT 67 passed, 0 failed
$ bash codex/test/run.sh          → RESULT 164 passed, 0 failed
$ node connectors/export.js --check   → exit 0, no output
$ grep -rnE "adapters/(index|claude|codex|agy|kimi|pi)" machine viewer codex install.sh test-support   → no output (exit 1)
$ diff <(providers.js from main) <(providers.js on branch)   → no output (exit 0)
```
`providers.js` on `main` was run from `git archive main viewer/app/providers.js`; both print
`{"PROVIDERS":{"claude":{"cli":"claude","label":"Claude","effort":true,…},"DISPLAY_NAMES":{…,"openrouter":"Pi (OpenRouter)"}}`.

## Known gaps / residual risks

- **Machine-suite stalls.** About half the full machine runs this build stalled after the Windows-sync tests with no failures recorded; re-runs finish in about 65 s. With a per-test timeout the stuck files (`screen.test.js`, `win-tool-proxy.test.js`) pass alone. Not shown to happen at the base commit (it was not run repeatedly there); no test added by this build is involved.
- **Load flakes** seen during the build, each passing alone: "tmux buffer failed" in `win-forward-service.test.js` and the project-tools launch test; viewer `6 message clears debt`; EADDRINUSE port collisions when suites ran in parallel.
- **`install/test/run.sh` "real wheelchair directory is byte-identical after suite"** failed during T6 because live sessions write to `~/.wheelchair`; it fails the same way without this build's changes, and passed in the final run.
- **Tool-named identifiers that are not tool checks remain in `machine/service.js`**: `sweepAgyTools` (cleans a legacy `agy-tools` state folder), `retryPiStartupEnter` and `reconcilePiExits` (generic bodies gated on connector members), `kimiTimer`, `piStartupRetries`, the `codexStepChunkSize` option, and stored session fields (`pi_version`, `kimi_log_id`, `codex_thread_id`, `kimi_missing_since`). None decides behaviour by tool name.
- **Guard test blind spots** (listed in its header comment): multi-line calls, plain assignments such as `x = 'kimi'`, Python dict keys, property access on objects other than `adapters`/`connectors`.
- **Accepted Risks** (PLAN.md): hook exit-code precedence for malformed calls; pages fall back to an empty tool list if `tools.js` fails to load; settings page throws on an account whose provider is not registered.
- **Live smoke** (`test-support/smoke/live.sh`, Kimi and Pi smoke) not run: it costs model turns; the import paths are covered by the grep.
- **`connectors.manifest(cli)` dereferenced without a guard** in `viewer/app/sessions.js` `checkEffort`; unreachable today (callers pass `cliOf(provider)`).

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-23

Verification attempt 1 (80b45598) failed on both verifiers; gap list and judgment in `REMEDIATION-1.md`. Six gaps remediated, one rare path accepted (`model.sh` refusing a model name ending in a newline → Accepted Risks, `verification-1`).

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| G1 Settings model choices hand-written per tool | manifest `settings.modelOptions` (`fixed`, or `listedKey`/`listedShape`/`includePins`) on claude, codex, kimi; `options()` loops over the registry | `viewer/app/settings.js` `options()`; `connectors/{claude,codex,kimi}/manifest.js` | `viewer/test/model-options.test.js` (exact output today; a sixth tool appears) |
| G2 optional fields read without defaults | defaults for `models.slotAliases` (`{}`), `models.effortError` (`effort is invalid`), plan tables (absent = none); `install.fallbackPath` required when `install.lookup` is `fallback`; `recoverRank` required with `capabilities.recover`; `install.label` required; Settings page plan select guarded | `viewer/app/routes.js`, `viewer/app/settings.js`, `viewer/pages/settings.js` (`planSelect`), `connectors/contract.js` | `viewer/test/minimal-manifest.test.js` + `viewer/test/hooks/minimal-connector.js` (connector with every optional field removed, through the model PUT route, `tools.js`, usage, placement); contract-test lines |
| G3 hook-driven connector without `hook.payload` | `validate()` requires `hook.payload` for halves with `hookEvent`, forbids `hook` with `turnPoller` | `connectors/contract.js` `validate` | contract test |
| G4 aside connector without its members | `aside` requires `asideArgv`, `asideResult` and a RegExp `asideModel` | `connectors/contract.js` | contract test |
| G5 guard misses multi-line forms | detector masks string/template/regex literals and comments, then matches S6 forms across lines (either operand of `\|\|`/`&&`); pinned positive/negative snippet table; `cli must be …` message built from the registry, text pinned | `machine/test/name-guard.test.js`; `machine/service.js` (`listWords`) | name-guard test; `char-service-branches.test.js` (exact message) |
| G7 stale docs | `machine/AGENTS.md` (steps parser path, hook rows), `viewer/app/API.md` effort per provider, guide updated for G1–G5 | those files, `connectors/README.md` | review against code (scout) |

Lanes: R1 standard / gpt-6.1-terra (G5 re-briefed once after its fails-twice guardrail), R2 standard / claude-sonnet-5-5.

Validation at dc1bb93f, one suite at a time:
```
$ bash machine/test/run.sh        → # tests 725  # pass 705  # fail 18   (the 18 known wslpath failures; no other)
$ (cd viewer && npm test)         → # tests 916  # pass 916  # fail 0
$ node connectors/export.js --check   → exit 0
$ node --test machine/test/connectors-contract.test.js machine/test/name-guard.test.js   → pass 5, fail 0
```

Residual (documentation only, no effect on today's five tools): `connectors/README.md` says a tool without `settings.plans` gets no plan control; the page actually renders an empty plan select for it. It also says `settings.keyPrompt` falls back to an empty string when no tool uses key sign-in; the page code would throw in that case. Both concern a hypothetical registry and are recorded here rather than fixed.

### Remediation 2 — 2026-11-23

Verification attempt 2 (132c4acf) failed on both verifiers; gaps H1–H6 and judgment in `REMEDIATION-2.md` (no rare paths). H2 and H6 were second attempts on G2 and G5.

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| H1 halves loaded other connectors' halves | step vocabularies are plain data in `connectors/common.js` (`stepVocabularies.claudeStyle`/`codexStyle`); no connector file requires another connector folder | `connectors/common.js`, `connectors/*/machine.js` | contract test "connector files do not require another connector folder" (lookahead pattern; bite-checked) |
| H2 plan data | `settings.weights` required with a numeric `unknown`; `settings.plans` required (string pairs, includes `unknown`, keys present in `weights`); every server plan reader safe for a weights-only tool | `connectors/contract.js`; `viewer/app/settings.js`, `viewer/app/routes.js` | contract-test lines; `viewer/test/minimal-manifest.test.js` (create, rename, pause, reload persisted, plan edit, default restore for a minimal provider) |
| H3 duplicate provider id | `provider` removed from machine halves; the service builds `default-<provider>` from the manifest (`defaultAccount(cli)`); `validate()` rejects a half exporting `provider` | `machine/service.js`, `connectors/*/machine.js`, `connectors/contract.js` | contract test; char tests (account ids and messages unchanged) |
| H4 poller transcript members | `turnPoller` requires `bindTranscript`, `spoolWaiting`, `validTranscript`, and they are refused without it | `connectors/contract.js` `validate` | contract test |
| H5 aside parent field | `asideParentField` required with `capabilities.aside`, refused without | `connectors/contract.js` | contract test |
| H6 guard quoted forms | literal-centred detection: every literal equal to a tool id (single, double, backtick without `${}`, shell/Python quoted words) is judged by its context; quoted `case`/`[[ == ]]`/`for`, Python `in`/`not in`, backtick comparisons pinned in the snippet table | `machine/test/name-guard.test.js` | name-guard test; scout probe of every reported form (all detected, negatives clean) |

Lanes: R3 standard / gpt-6.1-terra (re-briefed once: the first attempt's cross-require test pattern matched `../../`), R3c light / gpt-6-luna (`settings.plans` required).

Validation at 808c3dcf, one suite at a time:
```
$ bash machine/test/run.sh        → # tests 726  # pass 705  # fail 19   (the 18 known wslpath failures + "interop off withholds marked tool…", tmux buffer failed, which passes alone: # pass 1 # fail 0)
$ (cd viewer && npm test)         → # tests 916  # pass 916  # fail 0
$ node connectors/export.js --check   → exit 0
$ node --test machine/test/connectors-contract.test.js machine/test/name-guard.test.js   → pass 6, fail 0
```

### Remediation 3 — 2026-11-23

Verification attempt 3 (cc90bc9c): both FAIL, H1–H6 confirmed fixed. Three rare paths to Accepted Risks (`verification-3`): unusual guard spellings (`adapters?.codex`, a dot on the next line, an id after a nested array element, a backtick `require` path), a non-function `turnPoller`, `permissionChoices: [null]`. Six new gaps (none a repeat), `REMEDIATION-3.md`.

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| J1 per-tool hub helpers in the shared module | `claudeReply`/`isClaudeMidTurnHuman`, `codexReply`/`isCodexHuman`, `piReport`/`hasPiEntry`, `kimiReport` moved byte-identical into their tools' `hub.js`; `hub-common.js` keeps only helpers several tools use; `chat.js` no longer re-exports `hasPiEntry` (nothing read it) | `connectors/{claude,codex,pi,kimi}/hub.js`, `connectors/hub-common.js`, `viewer/app/chat.js` | viewer suite, char tests; contract test (no cross-connector requires) |
| J2 steps flush without `onTurnEnded` | turn end flushes steps for every `steps` tool; Codex order unchanged (`ignored` checked first) | `machine/service.js` (turn-ended handling) | `machine/test/steps-turn-end.test.js` |
| J3 second spend tool | `validateRegistry` allows at most one `spend` tool | `connectors/contract.js` | contract test |
| J4 key prompt | sign-in hint uses the account's own tool's `keyPrompt` (first key tool only when no account is in context); OpenRouter text unchanged | `viewer/pages/settings.js` (`signinHint`) | `viewer/test/key-prompt-provider.test.js`; `app-openrouter-signin.test.js` unchanged |
| J5 `stylePreview` without its member | `validate()` requires `stylePreviewArgv` with the flag and refuses it without | `connectors/contract.js` | contract test |
| J6 guide contradiction | `settings.weights`/`plans` required everywhere in the guide; J2, J3, J5 and the guard's accepted limits documented | `connectors/README.md` | scout read against `contract.js` |

Lane: R4 standard / gpt-6.1-terra.

Validation on the R4 branch (merged without conflicts), one suite at a time:
```
$ bash machine/test/run.sh        → # tests 727  # pass 707  # fail 18   (the 18 known wslpath failures only)
$ (cd viewer && npm test)         → # tests 917  # pass 917  # fail 0
$ npx playwright test test/app-settings.spec.js test/app-accounts.spec.js --project=chromium   → 87 passed
$ node connectors/export.js --check   → exit 0;  contract + guard tests → pass 6, fail 0
$ providers.js output vs main     → identical
```

### Remediation 4 — 2026-11-23

Verification attempt 4 (02129f90): verifier-7 (claude-opus-5-5) PASS with no gaps; verifier-8 (gpt-6.2-sol) FAIL with five gaps, none a repeat (`REMEDIATION-4.md`).

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| K1 aside output not redacted by the service | aside stdout/stderr redacted before `asideResult`, reply/error and `prepared.error` after, with the tool's `redact` | `machine/lib/aside-turns.js` `run()` | `machine/test/aside-turns.test.js` (marker connector) |
| K2 version-check masking keyed on `resolveCli` | keyed on `capabilities.versionCheck` | `machine/service.js` status accounts | `machine/test/remediation-r5.test.js` (login stubbed; bite-checked) |
| K3 launcher hard-coded `kimiExecutable` | the connector's `launchContext` result is kept as `context.launchExtras` and spread **first** into `command`'s context, so it adds keys and never replaces the service's own | `machine/service.js` (launch context, `commandFor`) | `remediation-r5.test.js` (through `launchContext`; `stateDir` cannot be overridden; bite-checked); `char-service-branches.test.js:175` reads the same value from `launchExtras` |
| K4 omitted `install.versionArgs` | defaults to `['--version']`; `null` skips | `machine/lib/harness-install.js` (`versionArgs`) | `remediation-r5.test.js` |
| K5 default account weight | fresh default accounts use the tool's `settings.weights.unknown` | `viewer/app/settings.js:54` | `viewer/test/remediation-r5.test.js` |

Lanes: R5 and R5b light / gpt-6-luna.

Validation on the merged head 13d264cd:
```
$ bash machine/test/run.sh        → # tests 731  # pass 711  # fail 18   (the 18 known wslpath failures only; R5b branch, identical code)
$ (cd viewer && npm test)         → # tests 918  # pass 918  # fail 0
$ node connectors/export.js --check   → exit 0;  contract + guard tests → pass 6, fail 0
```

### Remediation 5 — 2026-11-23

Verification attempt 5 (9fba590b): verifier-9 (claude-opus-5-5) PASS with no gaps; verifier-10 (gpt-6.2-sol) FAIL with five future-tool gaps (`REMEDIATION-5.md`). One rare path (guard spellings `kimi )` and `[[ codex == $cli ]]`) to Accepted Risks (`verification-5`).

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| L1 a pin the pin reader rejects | one pin-model rule (`PIN_MODEL`) used by `parse_pins` and by `set`, which refuses names the pin file cannot hold | `codex/model.sh` | `codex/test/run.sh` 167/167 (sixth provider with capitals refused; GPT pin still read back) |
| L2 effort outside the tool's list | `checkEffort` refuses any effort not in `models.efforts`: above the highest → `<label>'s highest effort is <highest>` (GPT text unchanged), otherwise `<label> has no <effort> effort` | `viewer/app/sessions.js` | `viewer/test/worker-effort-membership.test.js` (bite-checked) |
| L3 missing model error text | `settings.modelError` required | `connectors/contract.js` | contract test; minimal-connector fixtures keep it |
| L4 hand-written permission labels | manifest `settings.permissionName` (required with `permissionMode`); the page joins names in registry order; the four labels are byte-identical | `viewer/pages/settings.js`, `connectors/{claude,codex,agy,kimi}/manifest.js` | `viewer/test/app-settings.spec.js` (exact strings) |

Lanes: R6 and R6b light / gpt-6-luna.

Validation on the merged head 1e75a6d9:
```
$ node --test --test-timeout=90000 machine/test/*.test.js   → # tests 732  # pass 709  # fail 20  # cancelled 1   (18 known wslpath + win-tool-proxy timeout and "project tools launch privately…" under load; alone: 27/27 and pass)
$ (cd viewer && node --test --test-timeout=120000 test/*.test.js)   → # tests 919  # pass 919  # fail 0   (R6b branch, identical code)
$ bash codex/test/run.sh          → RESULT 167 passed, 0 failed
$ node connectors/export.js --check   → exit 0
```

### Remediation 6 — 2026-11-23

Verification attempt 6 (69c299a4): verifier-11 (claude-opus-5-5) PASS with no gaps; verifier-12 (gpt-6.2-sol) FAIL with two gaps (`REMEDIATION-6.md`). M1 was the second attempt on L1.

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| M1 shipped default pins could break the shared pin file | `validateManifest` requires every default pin to be `none` or match the pin-file rule (`PIN_MODEL`, kept aligned with `codex/model.sh`) and the tool's own `models.format` | `connectors/contract.js` | contract test (`Model-V2` refused; a 65-character pin refused by format only; bite-checked) |
| M2 guide | `launchContext` keys never replace the service's own context keys; signatures and calling convention of `bindTranscript`, `spoolWaiting`, `validTranscript` | `connectors/README.md` | scout read against `machine/service.js` |

Lane: R7 light / gpt-6-luna.

Validation on the merged head:
```
$ node --test --test-timeout=90000 machine/test/*.test.js   → see Log (18 known wslpath failures; load flakes pass alone)
$ (cd viewer && node --test --test-timeout=120000 test/*.test.js)   → # tests 919  # pass 919  # fail 0   (R7 branch)
$ bash codex/test/run.sh          → RESULT 167 passed, 0 failed
$ node connectors/export.js --check   → exit 0;  contract + guard → pass 6, fail 0
```
