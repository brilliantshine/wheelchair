# Remediation 1 — `agent-model-preferences`

Verified commit: `a2c1f2b418cfc22232e12a05fd7bf375163b6cee`

## Merged GAP list (verbatim from verifiers and full run)

1. `GAP: §6 targeted unit validation — The OpenRouter family-hint assertion still expects the old render expression — viewer/test/app-openrouter-settings.test.js:29 fails against viewer/pages/settings.js:933. All three tests in that file pass at the comparison commit.` (Reported by both Claude and GPT verifiers and `full-run-1`.)
2. `GAP (full-run-1 viewer-node): viewer/test/char-hub-dispatch.test.js:224 (session model resolution uses provider cells and tier aliases) fails asserting 'claude' === 'gpt' because sub-lead now follows provider_orders['sub-lead'] ('lead') rather than locking to thread.provider.`
3. `GAP: §4.2 legacy pin notice — Switching to a newer GPT model updates the tier and live previews but leaves the notice reporting the old model until reload — viewer/pages/settings.js:355 leaves the notice data stale. The browser showed gpt-6.1-sol after Heavy changed to gpt-9-sol.` (GPT verifier.)
4. `GAP: §4.4 shared provider ladders — Removing an enabled provider can reverse the relative order of switched-off providers — viewer/pages/settings.js:757 saved OpenRouter ahead of Kimi Code in both shared ladders after removing Claude.` (GPT verifier.)
5. `GAP: §4.8 desktop breakpoint — At 900 px, a custom ladder can squeeze the Code mapping preview to zero width — with five providers enabled, the preview measured 0 × 2040 px. The fixed controls and shrinking preview are at viewer/pages/settings.css:332.` (GPT verifier; also covers tightening vertical rhythm on desktop/phone where previews wrap.)
6. `GAP: repo law CONTRIBUTING.md:93 — The new pop-up test checks horizontal scroll containment but runs only in Chromium — viewer/test/app-assistant-popup.spec.js:233 checks scrollWidth, and viewer/test/firefox-specs.js:3 omits that file.` (GPT verifier.)

(Note: GPT verifier's two vertical-position notes — desktop `y=936` vs `781` and phone `y=2171` vs `2114` — stem from Spec §4.3's `Provider: <model-id> (<effort>)` preview format wrapping to two lines vs the mockup's short display names, as confirmed by Claude's verifier; R1-B also tightens row vertical padding slightly where safe.)

## Tasks

### R1-A (provider: `gpt`, tier: `standard`) — Fix stale unit test assertions (GAPs 1 & 2)

- **Ownership boundary:** `viewer/test/app-openrouter-settings.test.js`, `viewer/test/char-hub-dispatch.test.js`, `docs/plans/agent-model-preferences/reports/R1-A.md`
- **Objective:** Update `viewer/test/app-openrouter-settings.test.js:29` to match `viewer/pages/settings.js:933` (`tool.settings.familyHint`), and update `viewer/test/char-hub-dispatch.test.js:224` to reflect Spec §3.3 (`sub-lead` uses its configured `provider_orders['sub-lead']` ladder instead of locking to `thread.provider`).
- **Validation:** `node --test viewer/test/app-openrouter-settings.test.js viewer/test/char-hub-dispatch.test.js`

### R1-B (provider: `claude`, tier: `standard`) — Fix Settings UI gaps & `firefox-specs.js` (GAPs 3, 4, 5, 6)

- **Ownership boundary:** `viewer/pages/settings.js`, `viewer/pages/settings.css`, `viewer/test/app-settings.spec.js`, `viewer/test/firefox-specs.js`, `docs/plans/agent-model-preferences/reports/R1-B.md`
- **Objective:**
  1. Refresh `legacy_lead_diffs` (via `refreshDiffs()` / `/settings`) after `headsUpAction` in `viewer/pages/settings.js:355` so switching to a newer GPT model updates the legacy pin notice immediately without reload.
  2. Fix `ladderList` `commit()` in `viewer/pages/settings.js:757` so switched-off providers preserve their exact relative order whenever enabled providers are removed, moved, or added.
  3. Fix `viewer/pages/settings.css` around `:332` so at `900px` viewport width with 5 providers enabled and a custom ladder open, `.m-preview` never collapses to 0 width (allow `.m-agent-main` to wrap `.m-controls` cleanly onto the next line when `.m-id` would shrink below a readable min-width, e.g. `220px`, and keep vertical rhythm compact).
  4. Add `'app-assistant-popup.spec.js'` to `viewer/test/firefox-specs.js`.
  5. Add regression tests in `viewer/test/app-settings.spec.js` for GAPs 3, 4, and 5.
- **Validation:** `npm --prefix viewer run test:browser -- app-settings.spec.js app-assistant-popup.spec.js` and `node --test machine/test/name-guard.test.js`
