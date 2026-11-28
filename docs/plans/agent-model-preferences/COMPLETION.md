---
slug: agent-model-preferences
date: 2026-11-27
implemented-by: standard (gpt-6.1-terra, gpt-6.1-terra --effort high, claude-sonnet-5-5)
verified-by: []
---

# Completion Report — Better agent model preferences in Settings

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1.1 Agent tier preferences (`other_agents` 10 roles, defaults, normalization) | this run | `viewer/app/settings.js:57-58`, `viewer/app/settings.js:337` | `viewer/test/app-settings.test.js`, `viewer/test/char-settings-defaults.test.js` |
| §1.2 Per-role provider ladders (`provider_orders`, `LEAD_FAMILY_ROLES`, `validProviderOrder`, `normalize`, `describe`, `validBalancing('lead_order')` unchanged) | this run | `viewer/app/settings.js:28-29`, `viewer/app/settings.js:58`, `viewer/app/settings.js:338`, `viewer/app/settings.js:404`, `viewer/app/settings.js:523-535` | `viewer/test/app-settings.test.js`, `viewer/test/app-balancer.test.js` |
| §1.3 Legacy `lead`/`sub-lead` pin transition notice & backward compatibility (`codex/model.sh` untouched, `lead_tier_notice_dismissed`, `legacyLeadDiffs` via `models(hub)`, auto-dismiss on fresh install) | this run | `viewer/app/settings.js:58`, `viewer/app/settings.js:339`, `viewer/app/settings.js:508-522`, `viewer/app/settings.js:532`, `viewer/app/routes.js:257`, `viewer/app/routes.js:365-370`, `viewer/app/routes.js:464-471` | `viewer/test/app-settings.test.js`, `bash codex/test/run.sh`, `viewer/test/app-settings.spec.js` |
| §2.1 `PUT /settings/preferences` (`other_agents`, `provider_orders`, `lead_tier_notice_dismissed`, shared enabled-lead-ladder 409 guard) | this run | `viewer/app/routes.js:255-256`, `viewer/app/routes.js:266-270`, `viewer/app/routes.js:390-485` | `viewer/test/app-settings.test.js`, `viewer/test/app-harnesses.test.js` |
| §2.2 `PUT /settings/balancing` (unchanged request/response shape + shared enabled-lead-ladder 409 guard) | this run | `viewer/app/routes.js:346-348` | `viewer/test/app-harnesses.test.js`, `viewer/test/app-accounts.spec.js`, `viewer/test/app-settings.spec.js` |
| §2.3 `viewer/app/API.md` documentation updates (`GET /settings`, `PUT /settings/preferences`, session start, `waiting_provider`) | this run | `viewer/app/API.md:46`, `viewer/app/API.md:49`, `viewer/app/API.md:115-117`, `viewer/app/API.md:143` | Direct inspection against routes/balancer |
| §3.1 Role-to-preference mapping (`preferenceRole`, `isPinnedThreadLead`, `slotFor`) | this run | `viewer/app/balancer.js:12-22` | `viewer/test/app-balancer.test.js` |
| §3.2 Atomic `selection.slot` carry-through & `thread.provider` update rules (regular lead pinned, assistant/project-lead re-evaluated on restart, sub-lead never overwrites `thread.provider`) | this run | `viewer/app/balancer.js:133`, `viewer/app/sessions.js:104-106`, `viewer/app/sessions.js:348`, `viewer/app/sessions.js:363-371` | `viewer/test/app-balancer.test.js`, `viewer/test/assistant.test.js`, `viewer/test/project-lead.test.js` |
| §3.3 Provider order resolution (`expandOrder`, `strictReview`/`fallbackReview` preserved, `appendWhenRequested` harness guard, empty-ladder & `Not used` configuration waits, `waitingProvider`) | this run | `viewer/app/balancer.js:14`, `viewer/app/balancer.js:79-106`, `viewer/app/balancer.js:133-148` | `viewer/test/app-balancer.test.js`, `viewer/test/app-harnesses.test.js` |
| §3.4 Harness diagnostics, wait banners, CLI output, lead prompt (`harnesses.js`, `settings.js` `linkReasons`, `thread.js` `waitingLine`, `assistant-popup.js`/`.css`, `wc.js`, `protocol/app/lead.md:93`) | this run | `viewer/app/harnesses.js:9-11`, `viewer/app/harnesses.js:28-36`, `viewer/pages/settings.js:2533-2536`, `viewer/pages/thread.js:1638`, `viewer/pages/assistant-popup.js:63-69`, `viewer/pages/assistant-popup.js:107-116`, `viewer/pages/assistant-popup.js:325`, `viewer/pages/assistant-popup.css:10-19`, `viewer/app/wc.js:226-227`, `protocol/app/lead.md:93` | `viewer/test/app-harnesses.test.js`, `viewer/test/app-harnesses.spec.js`, `viewer/test/app-assistant-popup.spec.js`, `protocol/app/lead.md` inspection |
| §4.1 Category definitions (`usage` without provider orders, `models` with `agents`, `ladders`, `tiers`, `escalation`, `assistants`) | this run | `viewer/pages/settings.js:14-15`, `viewer/pages/settings.js:2074`, `viewer/pages/settings.js:2191-2211`, `viewer/pages/settings.js:2756-2760` | `viewer/test/app-settings.spec.js`, `viewer/test/app-accounts.spec.js`, `viewer/test/background-settings-surfaces.spec.js` |
| §4.2 One-time legacy pin notice (inline banner, `Use <model> for <Tier>` recovery button for `Not used`, `Dismiss`) | this run | `viewer/pages/settings.js:852-887`, `viewer/pages/settings.css:449-454` | `viewer/test/app-settings.spec.js` |
| §4.3 Agents block (9 items in order, live previews scoped to effective ladder, 4-way tier switches, collapsible 3-way provider ladder disclosures, deterministic Custom init, lead-family `'any'` tail, `Applies to new threads` on Leads) | this run | `viewer/pages/settings.js:627-850`, `viewer/pages/settings.js:889-895`, `viewer/pages/settings.css:371-406` | `viewer/test/app-settings.spec.js`, desktop/phone screenshots vs v5 mockups |
| §4.4 Provider ladders block (Lead ladder & Worker ladder two-column desktop / stacked phone, immediate `PUT /settings/balancing`, switched-off index preservation) | this run | `viewer/pages/settings.js:902-908`, `viewer/pages/settings.css:408-424` | `viewer/test/app-settings.spec.js`, `viewer/test/app-accounts.spec.js`, `viewer/test/app-harnesses.spec.js` |
| §4.5 Tier models block (enabled-only provider tabs, 4 tier rows, inline segmented effort pills, `Other…` input, inline GPT heads-up banner, empty-providers fallback) | this run | `viewer/pages/settings.js:253-387`, `viewer/pages/settings.js:910-936`, `viewer/pages/settings.css:426-439` | `viewer/test/app-settings.spec.js`, `viewer/test/app-harnesses.spec.js` |
| §4.6 Escalation block (live `escalation_text` + 4 segmented rows styled to v5 mockup) | this run | `viewer/pages/settings.js:938-950`, `viewer/pages/settings.css:441-447` | `viewer/test/app-settings.spec.js`, desktop/phone screenshots vs v5 mockups |
| §4.7 Assistants block (`Personal assistant` and `Project leads` using shared role row with lead-family `'any'` tail) | this run | `viewer/pages/settings.js:635`, `viewer/pages/settings.js:897-900` | `viewer/test/app-settings.spec.js`, desktop/phone screenshots vs v5 mockups |
| §4.8 Responsive & accessibility rules (desktop `1280×900` and phone `390×844` matching v5 mockups, zero horizontal overflow, ARIA labels, `firefox-specs.js` updated with 4 scroll-testing specs) | this run | `viewer/pages/settings.css:456-490`, `viewer/test/firefox-specs.js:5-8` | `viewer/test/app-settings.spec.js`, `viewer/test/app-harnesses.spec.js`, `viewer/test/app-accounts.spec.js`, `viewer/test/background-settings-surfaces.spec.js` (Chromium + Firefox) |

## Deviations from plan

None.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

### Targeted unit tests (T1 + T4)

- `node --test viewer/test/app-settings.test.js viewer/test/app-balancer.test.js viewer/test/char-settings-defaults.test.js viewer/test/app-kimi-settings.test.js viewer/test/app-openrouter-settings.test.js viewer/test/assistant.test.js viewer/test/project-lead.test.js viewer/test/app-hub.test.js viewer/test/app-harnesses.test.js`: **273 passed, 0 failed** (exit 0).
- `node --test machine/test/name-guard.test.js`: **2 passed, 0 failed** (exit 0).
- `node --test viewer/test/protocol-rules.test.js`: **47 passed, 0 failed** (exit 0).
- `bash codex/test/run.sh`: **217 passed, 0 failed** (exit 0; `codex/model.sh` unmodified).

### Targeted browser tests (T2 + T3)

- `npm --prefix viewer run test:browser -- app-assistant-popup.spec.js`: **22 passed, 0 failed** (exit 0).
- `TZ=UTC npm --prefix viewer run test:browser -- browser.spec.js app-settings.spec.js app-harnesses.spec.js app-accounts.spec.js app-settings-hold.spec.js background-settings-surfaces.spec.js`: **530 passed, 2 skipped, 0 failed** in Chromium + Firefox (exit 0).

### Protocol check (`protocol/app/lead.md:93`)

Inspected `protocol/app/lead.md:93`: `the lead, sub-lead, reviewer, verifier, mapper and designer each run on their configured tier in Settings → Models.` Matches `viewer/app/balancer.js:15-22` with no conflicting references in `protocol/`.

### Visual comparison screenshots

- Desktop (`1280 × 900`): `/tmp/agent-model-preferences-desktop.png` compared against `docs/plans/agent-model-preferences/graphs/mockup-models-desktop-v5.html` (posted as `image` card with `mockup`).
- Phone (`390 × 844`): `/tmp/agent-model-preferences-phone.png` compared against `docs/plans/agent-model-preferences/graphs/mockup-models-phone-v5.html` (posted as `image` card with `mockup`).
- Pop-up configuration wait banner (T2): desktop and phone screenshots posted as `image` cards.

## Known gaps / residual risks

- **Pre-existing late-evening flake in `viewer/test/app-accounts.spec.js` (`lead waiting line`):** Four pre-existing tests in `app-accounts.spec.js:574-597` fail when local time + 2–3 hours crosses midnight (because `thread.js` formats tomorrow's time with a weekday prefix like `about Sat 01:49 AM` while the tests assert `about <digit>`). Confirmed pre-existing on `origin/main` (`7254ef05`); passes with `TZ=UTC` (or outside late-evening local hours).
- Accepted Risks recorded in `PLAN.md` (nested array coercion in `Object.hasOwn(PROVIDERS, v)`, concurrent cross-tab edit during one-time legacy pin recovery).

## Remediation rounds

None yet.
