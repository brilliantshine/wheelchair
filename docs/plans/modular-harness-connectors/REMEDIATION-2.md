# Remediation 2 — modular-harness-connectors

Verification attempt 2 at 132c4acf: two verifiers (claude-opus-5-5 `wc-dfb566cd9dd5-verifier-3`, gpt-6.2-sol `wc-dfb566cd9dd5-verifier-4`), both FAIL.

## Gap lists, verbatim

### Verifier 3 (claude-opus-5-5)

GAP: S6 name-check guard (shell hit forms: "a `case` pattern, a `[[ ... == name ]]` test or a word in a `for` list") — The guard misses the shell forms as soon as the tool name is quoted, which is ordinary shell style. Before matching, `mask()` swaps every quoted tool id for `#` characters. The shell regex at `machine/test/name-guard.test.js:24` only matches a bare word, so a quoted id never matches. A future `case "$cli" in "kimi")` in `install.sh` or `machine/*.sh` would pass the guard. The same masking lets a backtick literal in a JS comparison (`` cli === `kimi` ``) through. — I copied the guard's own `detect()` into a probe script (`scratchpad/guard-probe.js`). It printed 0 hits for `case "$x" in\n  "claude") echo;;`, 0 for `[[ $x == "codex" ]]`, 0 for `[[ $x == 'codex' ]]`, 0 for `for t in "claude" "codex"` (all as `t.sh`) and 0 for `` x = cli === `kimi` `` (as `a.js`). Unquoted `case x in codex)` is caught. The scanned shell files contain no such checks today, so this is a coverage hole and not a hidden name check. It is the same kind of hole as G5, which the last round sent to remediation.

### Verifier 4 (gpt-6.2-sol)

GAP: S1 registry loading — Loading Antigravity directly loads the Codex machine half and bypasses its registry validation. Kimi and Pi also import other machine halves directly. — `connectors/agy/machine.js:12`, `connectors/kimi/machine.js:293`, `connectors/pi/machine.js:83,160`. The require-cache probe loaded both Antigravity and Codex after calling only `connectors.machine('agy')`.
GAP: S2/S6 optional plan data — A connector that passes validation without plan weights loses saved account changes and returns HTTP 500 on account creation, plan editing, and default-account restoration. — Using `viewer/test/hooks/minimal-connector.js`, renaming and pausing an account returned 200, then a reload returned the original name and unpaused state. See `viewer/app/settings.js:272` and `viewer/app/routes.js:268,285,299`.
GAP: S2/S3/S6 provider identity — The machine requires a second copy of the provider ID in the machine half, although the contract requires it only in the manifest. — With the manifest intact and `machine.provider` removed, validation passed and status emitted `default-undefined` at `machine/service.js:1709`.
GAP: S3/S6 transcript polling — A `turnPoller` connector without `validTranscript` passes validation but throws when the service copies its transcript. — `connectors/contract.js:20–26` lists the member as optional, while `machine/service.js:1402` calls it unconditionally. The copy probe reproduced the TypeError.
GAP: S3/S6 aside capability — A connector with `aside: true` and no `asideParentField` passes validation but cannot fork an aside from a live lead. — `viewer/app/asides.js:42–43` returned 409, "the lead isn't ready yet," in the probe with an active lead and a valid conversation ID.
GAP: S6 name guard — The guard misses quoted shell comparisons, `case` patterns and `for` entries, plus Python membership comparisons with the tool ID on the left. — The detector at `machine/test/name-guard.test.js:24–25,61–66` returned zero hits for `[[ $cli == "kimi" ]]`, `case "$cli" in "kimi")`, `for cli in "kimi"`, and `'kimi' in enabled`.

## Merged gaps and judgment

| # | Gap | Reported by | Judgment |
|---|-----|-------------|----------|
| H1 | Antigravity, Kimi and Pi halves `require` other connectors' machine halves directly (S1: halves only through the registry) | verifier 4 | Spec rule; remediate |
| H2 | A connector without plan weights passes validation, then account edits are lost and account routes return 500 | verifier 4 | normal use (next tool), silent loss of the user's edits; remediate. **Second attempt on G2** |
| H3 | Machine halves carry a second copy of `provider`; without it status shows `default-undefined` | verifier 4 | normal use (next tool); remediate |
| H4 | `turnPoller` tool without `validTranscript` passes, then the transcript copy throws | verifier 4 | normal use (next tool); remediate |
| H5 | `aside` tool without `asideParentField` passes, then asides cannot fork | verifier 4 | normal use (next tool); remediate |
| H6 | Guard misses quoted shell `case`/`[[ == ]]`/`for` forms, Python `'x' in`, JS backtick literal | both | S6 test coverage; remediate. **Second attempt on G5** |

Six gaps to remediation, no rare paths. Per the sub-lead rules, if H2 or H6 survives this attempt it is a plan defect and goes to the user instead of a third fix.

## Tasks

### R3 — H1–H6, provider gpt (built the connectors, contract, hub and guard)

- H1: shared step vocabularies move to `connectors/common.js`; contract test forbids cross-connector requires.
- H2: `settings.weights` with a numeric `unknown` required; every plan-table reader works for a tool with only that; minimal-connector test covers create, rename, pause, reload, plan edit, default restore.
- H3: `provider` removed from machine halves; the service uses the manifest's; `validate()` rejects a half exporting it.
- H4: `turnPoller` requires `bindTranscript`, `spoolWaiting`, `validTranscript` (and forbids them without).
- H5: `asideParentField` required with `aside`, forbidden without.
- H6: literal-centred guard detection, all quoted shell/Python/backtick forms pinned in the snippet table.
