# Remediation 1 — app-settings

Verification attempt 1 checked commit `10bf75b`. The Claude verifier passed it and the Codex
verifier failed it, so the attempt fails.

## Gaps (verbatim, Codex verifier)

GAP: Behavior templates, one sentence per switch value — browser Save discards false boolean values, removing their instructions — viewer/pages/settings.js:303-304 serializes only true; an isolated browser probe saved both switches as false, pressed Save, and observed `{}` with both sentences gone from the composed prompt.
GAP: Settings page, GPT picker includes visible cached models — visible models without a family suffix are omitted — codex/model.sh:189 requires the family-name pattern; an isolated cache containing visible `gpt-7` and `gpt-7-nova` produced picker options containing only the latter.

## Tasks

### R1-1 — save both values of a boolean switch (Claude, Light; built by T4's family)

- Objective: in `viewer/pages/settings.js` `templateBody()` (around :300-309), send
  `save_every_step` and `full_tests_before_done` as their checkbox's boolean value (`true` or
  `false`) whenever the draft holds a boolean for them, instead of only when `true`. A new
  template's checkboxes start unchecked and save `false`. Nothing else changes.
- Ownership: `viewer/pages/settings.js`, `viewer/test/app-settings.spec.js`.
- Test: in the existing template test, save a template with both switches unchecked, then
  GET `/wheelchair/api/settings` and assert both are `false`; GET `/settings/prompt` for that role
  (with the template in use) and assert it contains "Do not make an extra save after every
  step." and "Run the tests that fit the change before reporting done."
- Validation: `npm --prefix viewer run test:browser` (only the known "no drawn arrow's line"
  failures may remain).

### R1-2 — list every visible cached GPT model in `show --json` (Codex, Light; built by T1's family)

- Objective: in `codex/model.sh`, `show --json`'s `visible` lists every cache entry with
  `visibility == "list"` whose slug matches the `VALUE` pattern, without duplicates. Order:
  models that parse with `model_parts` first, newest first as today, then the others in cache
  order. The heads-up (`check`, `check --json`) keeps using today's filtered list unchanged.
  Do it by adding a separate helper (for example `listed_models(cache_path)`) used only by
  `show --json`; do not change `visible_models`.
- Ownership: `codex/model.sh`, `codex/test/run.sh`.
- Test: a cache with visible `gpt-7`, `gpt-7-nova` and a hidden `gpt-8` gives `visible` =
  `["gpt-7-nova", "gpt-7"]`; the check output for the same cache is unchanged.
- Validation: `bash codex/test/run.sh`.
