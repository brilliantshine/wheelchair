# Remediation 9 — modular-harness-connectors

Verification attempt 9 at 8674a075: verifier-17 (claude-opus-5-5) **PASS**, no gaps; verifier-18 (gpt-6.2-sol) FAIL with three small gaps.

## Gap list, verbatim (verifier 18, gpt-6.2-sol)

GAP: S6 / Decision 18 — The round-trip test rejects a valid connector that supports effort levels and leaves all five default pins unset — the registry validator accepted the fixture, and the real `model.sh` initialized it, saved `sixth-model` at effort `high`, and read both back. `machine/test/connectors-model-roundtrip.test.js:53–57` crashed because it assumes at least one default model is set.
GAP: S4 — Scout instructions still hard-code Claude's tool name in the shared hub — a sixth connector with `scoutAgentTool: true` received "Claude Code: the Agent tool" in its lead prompt from `viewer/app/settings.js:238`.
GAP: S2 / S7 — A key-sign-in connector can omit `settings.keyPrompt` and pass validation, leaving its password field without an accessible name — the sign-in hint returned `undefined` at `viewer/pages/settings.js:1350`, and the field's label and placeholder both use the missing value at `viewer/pages/settings.js:1405–1406`.

## Judgment

| # | Gap | Judgment |
|---|-----|----------|
| Q1 | Round-trip test crashes on a valid tool with all defaults unset | false failure in the Decision 18 test: fix |
| Q2 | Scout clause hard-codes "Claude Code: the Agent tool" for any tool with the flag | S4: fix with a text field, Claude's wording byte-identical |
| Q3 | Key-sign-in tool can omit `settings.keyPrompt` | normal use for the next key tool (unlabelled password field): fix by requiring it with `signInKind: key` |

Verifier-17's notes (no gap): `publicSession` strips stored `kimi_*` fields and `fatalKimi` is a generic method only Kimi calls; added to COMPLETION.md residual names.

## Task

### R10 — Q1–Q3, provider gpt, light tier
