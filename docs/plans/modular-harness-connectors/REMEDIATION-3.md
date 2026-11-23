# Remediation 3 — modular-harness-connectors

Verification attempt 3 at cc90bc9c: verifier-5 (claude-opus-5-5) FAIL with one gap it marked rare; verifier-6 (gpt-6.2-sol) FAIL with eight gaps. Both confirmed H1–H6 fixed.

## Gap lists, verbatim

### Verifier 5 (claude-opus-5-5)

GAP: S6 name-check guard ("property access on a connector or adapter object (`adapters.codex`)") — Rare path: two unusual spellings of that access get past the guard. One puts the dot on the next line (`adapters\n  .codex.loginEnv()`); the other uses optional chaining on the always-defined `adapters` object (`adapters?.codex`). The pattern at `machine/test/name-guard.test.js:21` (`\b(?:adapters|connectors)\.\s*(?:word)`) allows whitespace only after the dot, and does not allow `?.`. Neither form appears in the scanned code at HEAD or at base c7fc1322. Both are odd syntax that the test header and `connectors/README.md` already list as a known heuristic limit, so this belongs in Accepted Risks, not another fix. — I exported the guard's own `detect()` from a copy in the scratchpad folder and ran it: `adapters\n  .codex.loginEnv()` → MISS, `adapters?.codex` → MISS. Every ordinary form in S6 was a HIT: 32 of 33 probes, covering JS, shell and Python, all the quoted shell forms H6 named and backtick literals. The five non-tool snippets came back clean.

### Verifier 6 (gpt-6.2-sol)

GAP: S1 hub layout — Claude and Codex transcript parsing and Pi and Kimi report selection still live in the shared module, outside their connector folders. — `connectors/hub-common.js:45,93,105,147–181`
GAP: S3 turn-end contract — A hook-driven connector can export a string as `turnPoller` and pass validation. The machine then ignores its hook events and calls `.call` on the string during polling. — `connectors/contract.js:25`, `machine/service.js:1081,2288`
GAP: S3 steps capability — A connector with `readSteps` and `stepsReady` can omit the optional `onTurnEnded` member, but the service then forwards the turn end without flushing steps. An in-memory probe recorded zero flushes. — `machine/service.js:1539–1546`
GAP: S3 spend capability — A second spend connector passes conformance, but `/v1/spend` queries only the first connector and the hub uses that total for every spend-capable provider. The probe returned only `default-openrouter` and called only Pi. — `machine/service.js:2108–2120`, `viewer/app/usage.js:100–109,148`
GAP: S2/S5 Settings sign-in — The status hint for a second key-based connector says "Paste your OpenRouter key" even when its manifest supplies its own prompt. The hint selects the first key-based tool. — `viewer/pages/settings.js:1341,1396,1449`
GAP: S6 contract coverage — Validation accepts `settings.permissionChoices: [null]`, which throws when Settings renders the choices. It also accepts `stylePreview: true` with no `stylePreviewArgv`, which makes the preview report that the CLI is missing. — `connectors/contract.js:20–31,53`, `viewer/pages/settings.js:499`, `machine/service.js:1754–1761`
GAP: S6 name guard — The detector returned zero hits for `adapters?.codex`, `[[1], 'kimi']`, and a backtick-delimited `require` path into `connectors/kimi/machine.js`. — [Guard probe output](/tmp/wc-verifier-6.zjQ8acCV/guard-probes.log)
GAP: S7 connector guide — The guide says `settings.weights` and `settings.plans` can be omitted a few lines after declaring both required. The contract rejects either omission. — `connectors/README.md:212,235–240`, `connectors/contract.js:38–41`

## Merged gaps and judgment

| # | Gap | Reported by | Judgment |
|---|-----|-------------|----------|
| — | Guard misses `adapters?.codex`, a dot on the next line, a tool id after a nested array element (`[[1], 'kimi']`), a backtick `require` path | both | **Rare path**: unusual spellings absent from the code at HEAD and base; the guard pins 32 of 33 ordinary S6 forms. Accepted Risks (`verification-3`). Not counted toward the two-attempt rule (the G5/H6 forms both verifiers named last round are now detected). |
| — | `turnPoller` exported as a non-function passes validation | verifier 6 | **Rare path**: malformed member value no connector author writes by accident. Accepted Risks. |
| — | `settings.permissionChoices: [null]` passes validation | verifier 6 | **Rare path**: malformed data value. Accepted Risks. |
| J1 | Per-tool hub helpers (Claude/Codex reply folding, Pi/Kimi report pick) in `connectors/hub-common.js`, not their folders | verifier 6 | Spec S1 / Decision 8 (one folder per tool): remediate |
| J2 | A steps connector without `onTurnEnded` never flushes steps on turn end | verifier 6 | normal use for the next steps tool: remediate |
| J3 | A second spend connector is ignored and shares the first's total | verifier 6 | normal use for the next spend tool: remediate as a contract rule (at most one, like `preflight`) |
| J4 | Key sign-in hint always uses the first key tool's prompt | verifier 6 | normal use for the next key-sign-in tool: remediate |
| J5 | `stylePreview: true` without `stylePreviewArgv` passes validation | verifier 6 | flag without its member (as G4): remediate |
| J6 | Guide contradicts itself on `settings.weights`/`settings.plans` | verifier 6 | docs that mislead the next implementer: remediate |

Six gaps to remediation, three rare paths accepted. None of J1–J6 repeats a gap fixed before.

## Task

### R4 — J1–J6, provider gpt (built the hub halves, contract and service)

Brief: per gap as listed; byte-identical behaviour; one path per commit.
