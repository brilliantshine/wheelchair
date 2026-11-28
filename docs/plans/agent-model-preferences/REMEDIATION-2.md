# Remediation 2 — `agent-model-preferences`

Verified commit: `12cb6ed62fb7cb4cb4befc6a2e82602808a53728`

## Merged GAP list (verbatim from verifiers)

1. `GAP: §1.3 legacy pin transition — On a clean install, clicking Switch on the GPT Heavy heads-up creates a legacy migration notice. Before the switch, /settings returned legacy_lead_diffs: []. After the switch, it reported the previous default as a legacy Lead pin — viewer/app/routes.js:373.` (GPT verifier; Claude verifier returned `PASS`.)

(Note: GPT verifier's `§4.6 Escalation mockup match` note about the 4-paragraph `escalation_text` summary being taller than the mockup's 1-line placeholder is not a gap: Spec §4.6 explicitly mandates keeping the live `escalation_text` summary, which Claude verifier confirmed.)

## Tasks

### R2-A (provider: `gpt`, tier: `standard`) — Auto-dismiss empty legacy notice on `POST /settings/models/heads-up` `switch`

- **Ownership boundary:** `viewer/app/routes.js`, `viewer/test/app-settings.test.js`, `docs/plans/agent-model-preferences/reports/R2-A.md`
- **Objective:** In `POST /settings/models/heads-up` (`viewer/app/routes.js:373`), when `action === 'switch'`, check whether `!value.lead_tier_notice_dismissed` and `legacyLeadDiffs` was empty *before* running `settings.modelCommand` (just like `PUT /settings/models` at `:365-370`), and persist `lead_tier_notice_dismissed = true` after `settings.modelCommand` succeeds so clicking Switch on a fresh install never creates a retroactive legacy migration notice. Add a unit test in `viewer/test/app-settings.test.js` covering both a fresh install (auto-dismissed, `legacy_lead_diffs: []`) and a non-empty legacy diff install (not dismissed).
- **Validation:** `node --test viewer/test/app-settings.test.js`
