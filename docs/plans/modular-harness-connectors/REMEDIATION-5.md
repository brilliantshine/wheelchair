# Remediation 5 — modular-harness-connectors

Verification attempt 5 at 9fba590b: verifier-9 (claude-opus-5-5) **PASS**, no gaps (K1–K5 confirmed); verifier-10 (gpt-6.2-sol) FAIL with five gaps.

## Gap list, verbatim (verifier 10, gpt-6.2-sol)

GAP: S5 model pin round trip — `set` accepted `Model-V2` under a valid sixth provider's manifest, then the pin reader treated the shared file as malformed. The sixth provider and GPT both returned shipped defaults, hiding the saved GPT override. — `codex/model.sh:79,424`. [Reproduction](/tmp/wc-verify-10.kqBFx4/model-roundtrip.log)
GAP: S2 worker effort — A connector declaring `low` and `high` still accepts worker requests for `medium` and `xhigh`. The hub checks manifest membership only for `max`. — `viewer/app/sessions.js:207`. [Reproduction](/tmp/wc-verify-10.kqBFx4/effort-probe.log)
GAP: S4 Settings permission labels — A sixth connector using `permission_mode` appears in Settings, but the visible and accessible permission labels still name only the original tools. Adding the connector requires editing the page to show which setting applies. — `viewer/pages/settings.js:538,577`. [Browser probe](/tmp/wc-verify-10.kqBFx4/settings-probe.log)
GAP: S2 Settings model validation — A valid manifest can omit `settings.modelError`. In that case, the browser rejects an invalid custom model silently and leaves the input open without an error. — `viewer/pages/settings.js:93,217`. [Browser probe](/tmp/wc-verify-10.kqBFx4/settings-probe.log)
GAP: S6 name-check guard — The detector returned no hits for a normal shell `case` pattern written `kimi )` or the comparison `[[ codex == $cli ]]`. — `machine/test/name-guard.test.js:24,120`. [Reproduction](/tmp/wc-verify-10.kqBFx4/guard-probe.log)

## Judgment

| # | Gap | Judgment |
|---|-----|----------|
| L1 | `model.sh set` stores a pin the pin reader rejects, hiding other providers' saved pins | silent loss of the user's settings for the next tool: fix |
| L2 | Worker effort accepted outside the tool's `models.efforts` (only `max` checked) | normal use for the next tool: fix |
| L3 | `settings.modelError` optional, so a bad model is rejected with no message | normal use for the next tool: fix (make required; all five have it) |
| L4 | Permission-mode labels name tools by hand | S4 / IDEA ("nothing else … has to name it"): fix with `settings.permissionName`, strings byte-identical |
| — | Guard misses `kimi )` and `[[ codex == $cli ]]` | **Rare path**: unusual spellings absent from the code, like the verification-3 row; Accepted Risks (`verification-5`). Not counted toward the two-attempt rule. |

Four gaps to remediation, none a repeat; one rare path.

## Task

### R6 — L1–L4, provider gpt, light tier (every change specified)
