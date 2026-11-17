# Remediation 1

## Gaps (verifier attempt 1, verbatim)

GAP: Composed instructions must fit 12000 characters — `viewer/app/settings.js:176` checks 60-character placeholder model IDs, while `viewer/app/routes.js:211` accepts longer IDs. An API probe using valid style settings and a 250-character scout model ID returned style=200, model=200, start=201, but sent 12030 characters of role instructions.

## Tasks

### R1 — bound model IDs at 64 characters so the 12000-character check covers every scout block

Ownership boundary: codex/model.sh, codex/test/run.sh, viewer/app/routes.js, viewer/app/settings.js, viewer/app/sessions.js, viewer/app/API.md, viewer/test/app-settings.test.js, docs/plans/token-efficiency/reports/R1.md.

1. One limit: a model ID is at most 64 characters.
   - `codex/model.sh:38` VALUE becomes `^[a-z0-9][a-z0-9._-]{0,63}$` (this covers `set`, `skip` and the listed-models filter). The pins-line regex in parse_pins (`([a-z0-9][a-z0-9._-]*)` for the model, around :80) gets the same `{0,63}` bound, so a hand-edited file with a longer ID reads as malformed, which falls back to defaults as today.
   - `viewer/app/routes.js:211`: the model regex gets `{0,63}`; the 400 message stays "model is invalid".
   - `viewer/app/settings.js:176` (assertFits): placeholder model names become `'x'.repeat(64)`; define a shared constant `MODEL_MAX = 64` in settings.js, export it, and use it there.
   - `viewer/app/sessions.js` resolveScout: belt and braces, a resolved value longer than MODEL_MAX is treated as unavailable (null).
2. API.md: say model IDs are at most 64 characters in the PUT /settings/models row.
3. Tests: codex/test/run.sh — `set` with a 65-character ID is refused (usage exit), 64 accepted; a pins file with a 65-character ID reads as malformed. app-settings.test.js — PUT /settings/models with a 65-character model returns 400; with a 64-character Claude-family-less GPT scout model ID and a near-limit style, the started lead/sub-lead's role_layers stay at or under 12000 characters (or the settings save is refused); the verifier's probe (250-character scout model) is now refused at PUT /settings/models.

Validation:
  bash codex/test/run.sh
  node --test viewer/test/*.test.js   (lifecycle.test.js "a starter that loses the freed port registers through the new holder" is a known pre-existing failure; everything else must pass)
