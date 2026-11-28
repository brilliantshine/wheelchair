# Remediation 2 — settings-live-refresh

Verification attempt 2 (commit `c4ae659202ed602ca7f1974854283a01c6e0f7ec`, mode: `two-part`).
- Accepted rare path recorded in `PLAN.md` (`verification-2`): delayed `/threads?view=list` response repainting a focused lesson textarea.
- Deferred as `d7` per lead decision: refresh Lead names cleanly when Custom is selected without an uploaded file and another tab changes the list.

## Gap list (verbatim)

1. `GAP: §3.1 exact-match focus — Deleting the open template in another tab transfers keyboard focus to the replacement template’s Duplicate, Mark in use, See it in full, or Save button — Chromium and Firefox reproduced all four transfers from Alpha to Bravo. The controls use IDs shared across templates, which swapKeepingFocus() treats as identity. viewer/pages/settings.js:594, :1610, :1648.`
2. `GAP: §4.2 Worker ladder coverage — The required automated assertion for an external worker_order change is missing — The test writes both ladder orders but asserts only the Lead ladder. A separate probe confirmed the Worker ladder refreshes in both browsers. docs/plans/settings-live-refresh/PLAN.md:243, viewer/test/app-settings.spec.js:1834, :1839.`

## Tasks

### R2-1 (Gaps 1 & 2 — routed to `claude`, matching T2 builder)
- **Objective:**
  - Gap 1 (§3.1 template action buttons focus): Add template-scoped `data-focus` keys (`tpl:${draft.id || 'new'}:save`, `tpl:${draft.id}:duplicate`, `tpl:${draft.id}:toggle-use`, `tpl:${draft.id || 'new'}:see-full`) to `#save-template`, `#duplicate`, `#toggle-use`, and `#see-full` in `viewer/pages/settings.js` so deleting the open template elsewhere never transfers focus to the replacement template's action buttons. Extend the template-deletion focus test in `viewer/test/app-settings.spec.js` to cover these buttons too.
  - Gap 2 (§4.2 Worker ladder automated assertion): In `viewer/test/app-settings.spec.js:1834-1839`, capture the initial Worker ladder order (`[data-order="worker_order"] li`) before the external write and assert after `refreshed(page)` that the Worker ladder reversed as well.
- **Ownership boundary:** `viewer/pages/settings.js`, `viewer/test/app-settings.spec.js`
- **Validation:** `npm --prefix viewer run test:browser -- viewer/test/app-settings.spec.js`
