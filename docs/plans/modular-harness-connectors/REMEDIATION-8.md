# Remediation 8 — modular-harness-connectors

Verification attempt 8 at d2b269b7: verifier-15 (claude-opus-5-5) **PASS**, no gaps (N1–N3 confirmed; it probed routes the direct checks miss and the real round trip caught them); verifier-16 (gpt-6.2-sol) FAIL with two gaps.

## Gap list, verbatim (verifier 16, gpt-6.2-sol)

GAP: S5/S6, Decision 18 — `model.sh init` ignores an explicit `sub-lead` default that the manifest contract accepts. An isolated sixth connector declared `sixth-sublead-model @high`, but `init` wrote its `lead` model. The round-trip test still passed because it explicitly set the expected value before reading it. (`codex/model.sh:126`, `machine/test/connectors-model-roundtrip.test.js:32`, reproduction `/tmp/wc-verify16.SMEhR3/sublead.log`)
GAP: S2 — A manifest-declared effort can be saved and read back but rejected at launch. An isolated sixth connector declared `minimal`, passed contract validation, and round-tripped the pin through `model.sh`. The machine returned HTTP 400 because launch validation still uses a fixed list of five efforts. (`machine/service.js:219`, reproduction `/tmp/wc-verify16.SMEhR3/extra-effort.log`)

## Judgment

| # | Gap | Judgment |
|---|-----|----------|
| P1 | A manifest `sub-lead` default is accepted but `model.sh init` ignores it (writes `lead`'s) | normal use for the next tool; not the Decision 18 gap (no malformed file, no hidden pins): fix in the contract (pins hold exactly five slots) and make the round trip check `init`'s own output |
| P2 | A manifest effort word outside the machine's five passes the contract and round trip but launch refuses it | normal use for the next tool: fix in the contract (efforts an ordered subset of the five) |

## Task

### R9 — P1, P2, provider gpt, light tier (contract and tests only)
