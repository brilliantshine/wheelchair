---
slug: google-model-levels
date: 2026-11-27
implemented-by: "standard gpt-6.1-terra (T1, T2, T4), standard claude-sonnet-5-5 (T3), light gpt-6-luna (T5); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Google model list and levels

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by: []
```

## Spec coverage

Line numbers are at the feature branch tip that carries this file. Worker reports: `docs/plans/google-model-levels/reports/T1.md` … `T5.md`.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1.1 grouping rule (suffix and `(Level)` agree, two or more members) | this run (T1, T4) | `codex/model.sh:285` (`agy_parse`) | `codex/test/run.sh` "groups level models in first-member order and keeps singles", lone `-low` case, `none`-base and duplicate-value cases (T4) |
| S1.2 entry shape `{value, label, efforts}`, singles `efforts: []`, filters on the base id | this run (T1, T4) | `codex/model.sh:285`–`317` | same tests; T4's `none` base and `x` / `x-low` collision tests |
| S1.3 30-second reuse in `show`, stale fallback on failure, old format accepted | this run (T1) | `codex/model.sh:273`, `:332`–`386` (`agy_models`, `refresh` at `:344`), `agy_valid` `:279` | "fresh list reused for 30 seconds", "show keeps the stale Antigravity list when agy models fails" |
| S1.4 `levels gemini <model>` exits 0 / 0 empty / 4 | this run (T1, T5) | `codex/model.sh:532` | "levels returns ordered levels", "single has no levels", "missing model levels exit 4", "unknown old-format levels exit 4" |
| S1.5 catalog on demand (missing or old-format list fetched by any reader; old format never reused) | this run (T1) | `codex/model.sh:344` (`complete` check) | "fresh old-format cache refreshes", "missing list fetch normalizes pin on demand" |
| S1.6 failure back-off (`failed_at` / `agy-models.json.failed`, 60 s, cleared on success; no marker without agy) | this run (T1, T4) | `codex/model.sh:339`, `:351`–`380` | "failure backoff avoids second invocation", "success clears failure", "missing-list failure backs off in sibling file", T4 no-marker-without-agy test |
| S2.1 suffixed pin read as base + level (readers uncapped; `show --json` capped for display) | this run (T1, T5) | `codex/model.sh:388` (`agy_normalize`), `:395` (`agy_fix`), readers `:511`, `:520`, show `:572` | "suffixed pin reads base", "suffix becomes pin effort", "Settings caps the explicit effort", "without a list a suffix stays unchanged" |
| S2.2 one list snapshot in `show --json` | this run (T1) | `codex/model.sh:567` (single `agy_models(pin_path, "show")`) | scout check of T1 diff (PLAN Log 2026-11-27, T1 accepted) |
| S2.3 explicit pin effort wins over the suffix | this run (T1) | `codex/model.sh:388` | "explicit pin effort wins without capping" |
| S2.4 shipped defaults `gemini-3.8-flash @low/@medium/@high`; registry regenerated | this run (T1) | `connectors/agy/manifest.js:77`–`93`, `connectors/registry.json` | `node connectors/export.js --check`; `install/test/run.sh:325`; `codex/test/run.sh` default-pin loop |
| S3.1 `options()` passes `efforts` through; appended pins unknown | this run (T3) | `viewer/app/settings.js:500` | `viewer/test/model-options.test.js` |
| S3.2 effort selector: levels only / disabled for no-level / all for unknown | this run (T3) | `viewer/pages/settings.js:210`, `:302` | `viewer/test/app-settings.spec.js:1318` "Antigravity levels" block (titles contain "effort") |
| S3.3 keep or reset effort on model change; typed member id saved as base + level | this run (T3) | `viewer/pages/settings.js:217`–`223`, `:279`, `:293` | spec "effort comes from a member id typed through Other" and the keep/reset cases |
| S3.4 PUT normalizes then refuses an unknown level with the two texts | this run (T3) | `viewer/app/routes.js:356`–`358`, `viewer/app/settings.js:444`, `:451` | `viewer/test/app-settings.test.js:523` and the suffixed-id cases beside it |
| S3.5 re-read GET /settings after save; `Saved; the list could not be refreshed` | this run (T3) | `viewer/pages/settings.js:50`, `:225`, `:272` | spec "effort save redraws the model cells…" and "effort stays saved, and says so, when the list cannot be re-read after a save" |
| S4.1 `model.sh agy-launch` (refresh rules, suffix, drop, round down, lowest-level exception, unknown unchanged; 5 s inner deadline) | this run (T1, T4) | `codex/model.sh:541`–`549` (`agy_models(..., "launch", ..., timeout=5)` at `:543`) | "launch normalizes suffix…", "launch rounds down", "launch drops effort on single", "launch preserves unknown model", "launch preserves CLI default", "launch uses lowest level if none is below request", "stalled launch refresh times out and uses saved list", T4 refresh cases (a)–(f) and suffix-without-effort |
| S4.2 connector `launchContext(service, input, session)` runs `agy-launch` without blocking, 15 s; builder uses the fixed-up values; fallback to inputs | this run (T2) | `machine/service.js:980`, `connectors/agy/machine.js:35`–`49` | `machine/test/project-mcp-agy.test.js:81` |
| S4.3 hub start path unchanged; record keeps the requested effort | this run (T2) | no hub change; `connectors/agy/machine.js:49` reads launch extras, `session.effort` untouched | `machine/test/agy-launch-service.test.js:9` (tmux argv carries fixed model and effort; record effort is the requested one) |
| S4.4 README `launchContext` row; machine API text | this run (T2) | `connectors/README.md:95`, `machine/API.md:10` | read in diff review |
| S5.1 sub-lead per-tier Antigravity level lines, only when Antigravity takes workers | this run (T3) | `viewer/app/settings.js:459`–`488` (`levelLines`), `:237`; `viewer/app/sessions.js:367` | `viewer/test/app-settings.test.js:552`–`590` (present, absent when off or not in worker order, escalation text unchanged) |
| S5.2 `protocol/app/sub-lead.md` unchanged | this run | — | `git diff 2c18acc4 -- protocol/app/sub-lead.md` is empty |
| S6 scout line names `<model>-<effort>` only when the group lists it | this run (T3) | `viewer/app/sessions.js:119`–`130` | `viewer/test/app-settings.test.js:589` scout cases (listed, unlisted level, no effort, unlisted model, single model) |
| S7 USAGE and `codex/AGENTS.md` | this run (T1) | `codex/model.sh:41`, `codex/AGENTS.md:13` | read in diff review |
| Validation: round trip without host agy | this run (T2) | `machine/test/helpers/model-roundtrip.js:15` (`WHEELCHAIR_AGY: ''`) | `node --test machine/test/connectors-model-roundtrip-real.test.js` |

## Deviations from plan

- S5.1's "refreshing the list first when it is over an hour old": `model.sh levels` never refreshes by age, so `levelLines` first runs `model.sh agy-launch <first set tier's model>` with no effort and ignores its output (`viewer/app/settings.js:459`–`478`). That refreshes a list over an hour old, and also one over 30 s old that does not list that model (at most one extra `agy models` run, about 1 s, per sub-lead start). Ruled by the sub-lead (PLAN Log).
- `codex/model.sh` dispatch compares against `AGY_PROVIDER` (derived from the manifest, `codex/model.sh:276`) instead of the literal `gemini`, so `machine/test/name-guard.test.js` passes (T5). The CLI still takes `levels gemini <model>`.
- A browser spec server (`viewer/test/app-settings.spec.js:22`) now sets `WHEELCHAIR_AGY: ''`; before this change it could reach the host's real agy.

## Routers

- `codex/AGENTS.md:13`: the `model.sh` row now says the agy connector calls `agy-launch` at launch.
- `connectors/README.md:95`: the `launchContext` contract row gives the new signature.
- `viewer/app/API.md`: the two settings rows describe the efforts and PUT checks.
- No ownership moved.

## Validation evidence

On the feature branch after all five merges (merge commit `4df69772`), run by the sub-lead:

```text
$ bash codex/test/run.sh | tail -1
RESULT 211 passed, 0 failed
$ node connectors/export.js --check; echo export $?
export 0
$ node --test machine/test/name-guard.test.js machine/test/project-mcp-agy.test.js machine/test/agy-launch-service.test.js machine/test/connectors-model-roundtrip-real.test.js
# pass 9
# fail 0
$ node --test viewer/test/model-options.test.js viewer/test/app-settings.test.js viewer/test/app-hub.test.js viewer/test/worker-effort-membership.test.js
# pass 145
# fail 0
$ npm --prefix viewer run test:browser -- --grep 'effort'
  10 passed (6.2s)
$ bash install/test/run.sh | tail -1
RESULT 217 passed, 0 failed
```

Each worker report pastes its own runs and states each new test was seen failing against a deliberate break (T2, T3, T4); those mutation runs are the workers' claims, not re-run here. Whole suites and the full run (`bash test-support/full-run.sh`) are run by the starter (project `AGENTS.md`, "Test picker and full run").

Screenshot of the Settings grid (a level group with its levels, a no-level model with the selector disabled): `docs/plans/google-model-levels/reports/T3-grid.png`.

## Known gaps / residual risks

- A `model.sh` failure other than "not used" / "unknown" during `levelLines` fails the sub-lead start when Antigravity takes workers, as scout resolution already does (`viewer/app/settings.js:459`). A sub-lead start with Antigravity on runs up to 17 `model.sh` calls.
- The connector's 15 s timeout kills `model.sh agy-launch` but not necessarily a child `agy models` (which has its own 5 s limit).
- Saving a cell redraws both model blocks, which clears an Other… input left open in another cell.
- T4's no-marker test covers an empty `WHEELCHAIR_AGY` only, not a missing binary (same code path, `codex/model.sh:361`).
- The PUT's suffix rule is mirrored in JS (`viewer/app/settings.js:451`) rather than read from `model.sh`; the two must stay in step.
- Plan Accepted Risks stand as written.

## Remediation rounds

### Remediation 1 — 2026-11-27

Verification attempt 1 (commit 0eadce68; claude-opus-5-5 and gpt-6.2-sol) failed with four gaps; see `REMEDIATION-1.md`. G1 (overlapping refreshes) is a rare path, recorded in PLAN.md Accepted Risks.

| Gap | Fix | Lane | At | Validated by |
|-----|-----|------|----|--------------|
| G3 sub-lead start refreshed a list under an hour old | new `model.sh agy-refresh` (only when missing, old format or over an hour old; S1.6 back-off; silent, exit 0), used once by `levelLines` | R1, standard / gpt-6.1-terra | `codex/model.sh:41`, `:344`–`346`, `:543`–`545`; `viewer/app/settings.js:474` | `codex/test/run.sh` agy-refresh cases; `viewer/test/app-settings.test.js:589` (two-minute list, no agy run) |
| G2 a save wiped another cell's Other… draft | the saved cell alone is redrawn after the PUT and after the re-read | R2, standard / claude-sonnet-5-5 | `viewer/pages/settings.js` (`redrawCell`, `refreshModels`) | `viewer/test/app-settings.spec.js:1424`, `:1446` |
| G4 a test server could run the real agy and write the real `~/.wheelchair` | `startServer` defaults `WHEELCHAIR_AGY=''` and `WHEELCHAIR_MODELS` inside the state dir unless the caller sets them; same defaults in `pages.spec.js` | R2 | `viewer/test/helpers/server.js:75`–`80`, `viewer/test/pages.spec.js:180`, `:326` | R2 report's scratch-HOME proof (agy call before, none after) |

The S5.1 deviation in "Deviations from plan" (refresh through `agy-launch`) is superseded by G3's fix: the sub-lead start now refreshes only a list that is missing, in the old format, or over an hour old.

Task checks on the merged tip (f5a2d1ff), run by the sub-lead:

```text
bash codex/test/run.sh                         RESULT 217 passed, 0 failed
node connectors/export.js --check              exit 0
node --test machine/test/{name-guard,project-mcp-agy,agy-launch-service,connectors-model-roundtrip-real}.test.js   # pass 9 # fail 0
node --test viewer/test/{model-options,app-settings,app-hub,worker-effort-membership}.test.js                      # pass 146 # fail 0
npm --prefix viewer run test:browser -- --grep 'effort'                                                            12 passed
bash install/test/run.sh                       RESULT 217 passed, 0 failed
```

Known residual (superseded by Remediation 2): viewer tests outside the Spec list still reached the PATH agy through in-process hubs; see REMEDIATION-2.md.

### Remediation 2 — 2026-11-27

Verification attempt 2 (commit 732be642; claude-opus-5-5 and gpt-6.2-sol) failed; see `REMEDIATION-2.md`. One gap was a rare path (overlapping saves, Accepted Risks), one was judged not a gap (PLAN Log), and one went to remediation: viewer tests outside the Spec list still reached the PATH agy.

| Gap | Fix | Lane | At | Validated by |
|-----|-----|------|----|--------------|
| G4 (second fix): viewer tests reaching codex/model.sh through in-process hubs or direct spawns ran the PATH agy; app-usage wrote under $HOME/.wheelchair | `viewer/test/helpers/isolate-models.js` sets `WHEELCHAIR_AGY=''` and a temp `WHEELCHAIR_MODELS`; loaded by `helpers/server.js` and required by 26 test files; `app-uploads-archive.test.js` stubs `agy` for its real machine service | R3, standard / claude-sonnet-5-5 | `viewer/test/helpers/isolate-models.js:1`–`10` | R3 report: whole viewer Node and browser suites under a scratch HOME with a logging fake agy, 16 agy calls and one agy-models.json before, zero after |

Task checks on the merged tip, run by the sub-lead:

```text
bash codex/test/run.sh                         RESULT 217 passed, 0 failed
node --test machine/test/{name-guard,project-mcp-agy,agy-launch-service,connectors-model-roundtrip-real}.test.js   # pass 9 # fail 0
node --test viewer/test/{model-options,app-settings,app-hub,worker-effort-membership,app-usage,app-balancer,app-project-tools-card}.test.js   # pass 243 # fail 0
npm --prefix viewer run test:browser -- --grep 'effort'                                                            12 passed
```

Residual: five files that load viewer/app/ have no direct require of the isolation helper (app-lessons, app-lessons-history, app-shared-tools-setting, char-hub-dispatch, background-completion); none called agy in the proof run.
