# Remediation 1 — modular-harness-connectors

Verification attempt 1 at 80b45598: two verifiers (claude-opus-5-5 `wc-dfb566cd9dd5-verifier`, gpt-6.2-sol `wc-dfb566cd9dd5-verifier-2`), both FAIL.

## Gap lists, verbatim

### Verifier 1 (claude-opus-5-5)

GAP: S4 (manifest field for data; `viewer/app/settings.js:…,430-440` named in the Spec) — The `options()` model-choice lists the hub sends to the Settings page still name each tool in code. It builds hand-written `claude`, `gpt` and `kimi` lists, with Claude's alias choices typed in and the GPT and Kimi lists read from tool-named `model.sh` output keys, and returns `{ claude, gpt, kimi }`. The function is unchanged from the base commit. The Spec lists this range under the "manifest field" treatment, and S4 bans hand-written lists of tool names outside `connectors/`. So a new tool's model choices would still mean editing `settings.js`, which goes against IDEA.md's "nothing else in … the app has to name it". The guard test misses it because object shorthand has no `:`. Nothing in PLAN.md Decisions or Log and nothing in `connectors/README.md` covers it. — `viewer/app/settings.js:429-441`; `git show c7fc1322:viewer/app/settings.js` lines 429-441 are identical.
GAP: S6 contract test / IDEA.md "a test fails if a connector or list entry is missing something required" — `models.slotAliases` is optional in the contract, but the hub reads it without a guard. A connector without it passes `validateManifest`, then makes the hub's `PUT /settings/models` route throw a TypeError (a 500) for that tool. The guide admits this instead of fixing it. — `connectors/contract.js:41` only checks `models.slotAliases` when it is present; `viewer/app/routes.js:318` `slot = manifest.models.slotAliases[slot] || slot`; `connectors/README.md:226` says "defaulted: `undefined` (the route indexes it directly)". Running `node -e` on a codex manifest with `slotAliases` deleted printed "validateManifest accepts manifest without slotAliases", and the line-318 access threw "Cannot read properties of undefined (reading 'x')". `models.effortError` has the same pattern: when absent, `routes.js:321` throws `appError(400, undefined)`.

### Verifier 2 (gpt-6.2-sol)

GAP: S4 model options — Settings still builds choices specifically for Claude, GPT, and Kimi. A sixth provider's discovered models require another hub edit. `viewer/app/settings.js:429–440` returned only `claude`, `gpt`, and `kimi` when given a sixth provider's pins and discovery results.
GAP: S2/S6 manifest defaults — A connector can pass validation without the optional plan-weight tables and then prevent the hub from loading. Omitting those tables in a fixture passed validation and threw at `viewer/app/settings.js:37`.
GAP: S3/S6 hook contract — A hook-driven connector passes validation without `hook.payload`, then its hook exits 64. Reproduced through `connectors/contract.js:24,50` and `machine/lib/hook-in.js:8`.
GAP: S3/S6 aside contract — A connector with `aside: true` passes validation without `asideModel` or `asideResult`. The aside request then throws at `machine/lib/aside-turns.js:68`, and the reply path calls `asideResult` unconditionally at line 124.
GAP: S6 name guard — The guard passed when I injected a multiline `kimi` object key, a multiline call with `'codex'` as an argument, and `'pi'` as the left operand of `||`. [Probe output](/tmp/wc-verifier-2.XikW5G/name-guard-probe.log)
GAP: S5 model-script compatibility — Rare path: `model.sh set gpt light $'gpt-6-luna\n'` stores the pin and exits 0 on the base commit. The verified commit prints usage and exits 2 because `codex/model.sh:34` uses `fullmatch`.
GAP: S7 documentation — `machine/AGENTS.md:60` still points to the removed `lib/codex-steps.js`. `viewer/app/API.md:45` says OpenRouter rejects effort, although its manifest and the route accept it.

## Merged gaps and judgment

| # | Gap | Reported by | Judgment |
|---|-----|-------------|----------|
| G1 | Settings `options()` model choices hand-written for claude/gpt/kimi (`viewer/app/settings.js:429-441`) | both | normal use (next tool added): remediate |
| G2 | Optional manifest fields read without defaults: `models.slotAliases`, `models.effortError` (`routes.js:318,321`), plan-weight tables (`settings.js:37`) | both | normal use: remediate |
| G3 | Hook-driven connector passes the contract without `hook.payload`, hook then exits 64 | verifier 2 | normal use: remediate |
| G4 | `aside` connector passes the contract without `asideModel`/`asideResult` | verifier 2 | normal use: remediate |
| G5 | Name guard misses multi-line object keys and calls, and a tool id as the left operand of `\|\|` (S6 hit forms) | verifier 2 | S6 test coverage: remediate |
| G6 | `model.sh set gpt light $'gpt-6-luna\n'` accepted at base, refused now (`fullmatch`) | verifier 2 (marked rare) | rare path: malformed input the hub never sends (the hub's model check rejects it first); Accepted Risks, `verification-1` |
| G7 | Stale docs: `machine/AGENTS.md:60` names removed `lib/codex-steps.js`; `viewer/app/API.md:45` says OpenRouter takes no effort (already wrong at c7fc1322) | verifier 2 | normal use (docs that mislead the next implementer): remediate |

Six gaps go to remediation (G1–G5, G7); one rare path accepted (G6).

## Tasks

### R1 — G1–G5 (code and tests), provider gpt (built T4, T7a and the contract)

Brief: the R1 brief file (objective per gap, ownership, validation as in the brief format). Summary:
- G1: new manifest field `settings.modelOptions` (`fixed` list, or `listedKey` + `listedShape` + `includePins`) on claude, codex, kimi; `options()` loops over the registry; exact-output test plus a sixth-tool test.
- G2: every optional field reader defaults as the guide says; a minimal-connector test (all optional fields deleted) exercising the hub's manifest readers.
- G3: `validate` requires `hook.payload` for halves with `hookEvent`, forbids `hook` with `turnPoller`.
- G4: `aside` capability requires `asideArgv`, `asideResult` and a RegExp `asideModel`.
- G5: whole-file guard detection with a pinned table of positive/negative snippets; fix real hits found.

### R2 — G7 and guide updates for R1 (docs), provider claude (built T7b)

After R1: fix `machine/AGENTS.md` (codex-steps → `connectors/codex/steps.js`, hook row), `viewer/app/API.md:45` (OpenRouter accepts `low`–`max` effort; Kimi none), and update `connectors/README.md` for `settings.modelOptions`, the stated defaults, the new required rules (G3, G4) and the guard's detection.
