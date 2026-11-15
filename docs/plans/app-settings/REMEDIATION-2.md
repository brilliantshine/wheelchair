# Remediation 2 — app-settings

Verification attempt 2 checked commit `9649e1f`. The Claude verifier passed it and the Codex
verifier failed it with two new gaps (neither repeats a Remediation 1 gap), so the attempt
fails.

## Gaps (verbatim, Codex verifier)

GAP: Tier aliases accepted wherever tiers are read — PUT /settings/models rejects legacy slots: `{provider:"gpt",slot:"terra",model:"custom-model"}` returns 400 “slot is invalid”; `standard` succeeds — viewer/app/routes.js:53.
GAP: Template scope must be all or a project path from projects.json — POST /settings/templates accepts `scope:"not-a-project-path"` with 201 when the projects list is empty — viewer/app/settings.js:81.

## Tasks

### R2-1 — tier aliases on the models routes, and template scope checked against projects.json (Codex, Light; built by T3's family)

Change 1, tier aliases (Spec "Tier names": old names are accepted on input wherever a tier is
read):
- In `viewer/app/routes.js`, `PUT /settings/models` (around :51-60): before validating
  `body.slot`, map it through `settings.TIER_ALIASES` (`luna/terra/sol/astra`, for either
  provider), and for `provider === "claude"` also `haiku → light`, `sonnet → standard`,
  `opus → heavy`. Validate and pass the new name to `model.sh`. `lead` stays as is.
- In `POST /settings/models/heads-up` with `action: "switch"` (around :63-66): map
  `body.tier` through `settings.TIER_ALIASES` before validating it.

Change 2, template scope (Spec "Behavior templates": scope is `all` or a project path from
`projects.json`; Edge cases: a project removed later keeps its templates):
- `POST /settings/templates`: refuse 400 "template.scope must be all or a listed project"
  unless `scope === "all"` or `scope` is one of the strings in `await hub.projects()`.
- `PUT /settings/templates/:id`: the same check, but only when the request changes the
  scope. A template whose saved scope is no longer listed can still be edited while its
  scope stays the same.
- Read `hub.projects()` before entering `settings.update(...)`, and do the check inside the
  update callback, so a refusal leaves `settings.json` unchanged.

Ownership: `viewer/app/routes.js`, `viewer/app/settings.js` (only if a helper is cleaner
there), `viewer/test/app-settings.test.js`.

Tests (add to `viewer/test/app-settings.test.js`):
- `PUT /settings/models` with `{provider:"gpt", slot:"terra", model:"custom-model"}` → 200, and
  `models.gpt.standard.model === "custom-model"`. `{provider:"claude", slot:"opus", model:"opus"}`
  → 200 and sets `claude.heavy`. `{provider:"gpt", slot:"opus", …}` → 400.
- Heads-up switch with `tier:"sol"` sets `gpt.heavy`.
- `POST` with an unlisted scope → 400, file unchanged. `POST` with a listed project → 201.
- `PUT` changing the scope to an unlisted path → 400. `PUT` on a template whose saved
  project was removed from `projects.json`, changing only its name → 200.

Validation: `node --test viewer/test/*.test.js`. The one known failure, "a starter that
loses the freed port …", also fails without this work; name any other. Record
`sha256sum ~/.wheelchair/models` before and after; the two must match.
