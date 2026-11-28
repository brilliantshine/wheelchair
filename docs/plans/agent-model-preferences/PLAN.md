---
slug: agent-model-preferences
status: ready-for-review
created: 2026-11-27
---

# Better agent model preferences in Settings

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Every agent role — including Leads and Sub-leads — picks a model tier (`light`, `standard`, `heavy`, `critical`) rather than maintaining separate per-provider Lead/Sub-lead model pickers. | One unified tier system for all agents removes the separate Leads block and lets you define each provider's models once in Tiers. | user |
| 2 | Layout for **Settings → Models**: **Agent tier buttons + Provider tabs** — top **Agents** block with 4-way segmented tier switches (`Light \| Standard \| Heavy \| Critical`) and live model previews per role, followed by **Tier models** with tabs per enabled provider and inline effort pills instead of a second dropdown. | One-tap tier switching for every agent and single-provider tabs keep the page clean on both desktop and phone. | user |
| 3 | Place the `Reviewers and checkers` family mix control in the Agents block alongside Plan reviewers and Checker, and keep `Escalation` as a compact block below Tier models. | Keeps review/check settings together and keeps worker escalation visible without competing with the main tier/agent controls. | defaulted |
| 4 | Give Personal assistant and Project leads their own tier switches in the Agents block (separate from thread Leads). | Lets Collin run Personal assistant and Project leads on a different tier from thread Leads. | user |
| 5 | Place Personal assistant and Project leads in their own separate block at the bottom of **Settings → Models** (separate from thread/build agents). | They don't build code directly, so keeping them in their own block keeps the main Agents block focused on thread/build roles. | user |
| 6 | Add per-role provider ladders (dropdown/collapsible custom provider order, defaulting to the global order in Usage and balancing) for each applicable agent role (`lead`, `reviewer`, `verifier`, `mapper`, `designer`, `assistant`, `project-lead`), updating `IDEA.md` scope accordingly. `sub-lead` (follows thread provider) and `scout`/`scout-heavy` (built-in CLI helpers on lead's provider) do not have provider ladders. | Gives full per-role provider preference control right alongside tier selection while keeping rows uncluttered until opened. | idea-change |
| 7 | Give `sub-lead` its own provider ladder too instead of forcing sub-leads onto the thread lead's provider (superseding the `sub-lead` exclusion in Decision 6). Only `scout` and `scout-heavy` have no provider ladder (they run as built-in CLI helpers inside the lead's or sub-lead's own CLI). | Collin explicitly rejected locking sub-leads to the lead's provider ("If i said i wanted the subleads to use the same provider as the lead, i don't want that. we should have the setting for that."). | user |
| 8 | Make "Default" provider order self-explanatory in the Models UI: show what Default currently resolves to and link directly to **Usage and balancing** (`#usage`) where the global Lead and Worker provider orders are set. | Removes ambiguity about where "Default" is configured. | user |
| 9 | Move the global Lead and Worker provider orders (`lead_order`, `worker_order`) out of **Usage and balancing** into a **Provider ladders** block on **Settings → Models** (superseding the Usage and balancing link in Decision 8). Each applicable agent role can choose `Default: Lead`, `Default: Worker`, or a `Custom` provider ladder. | Puts all model and provider-picking controls in **Models**, leaves **Usage and balancing** focused on quotas and reserves, and lets any agent reuse either shared ladder. | idea-change |
| 10 | Agreed on v5 desktop and phone mockups: `docs/plans/agent-model-preferences/graphs/mockup-models-desktop-v5.html` (`1280 × 900`) and `docs/plans/agent-model-preferences/graphs/mockup-models-phone-v5.html` (`390 × 844`). | Captures all settled decisions: Agents with tier switches + 3-way provider ladders, Provider ladders block in Models, Tier models with provider tabs + inline effort pills, Escalation, and bottom Assistants block. | user |
| 11 | Surface legacy `lead`/`sub-lead` pin differences via a one-time dismissible transition notice in **Settings → Models** (never silently overwriting shared tiers), and let Personal assistant and Project leads re-evaluate their provider ladder on each new session start (updating `thread.provider` and `thread.cli`, preserving queued messages). | Keeps all agents on tiers per Decision 1 while making any legacy pin differences visible and actionable, and ensures assistant/project-lead ladder changes take effect on existing conversations. | review-round-1 |
| 12 | Keep both the clear empty/`Not used` ladder configuration messages and the one-time dismissible legacy Lead/Sub-lead pin notice (with one-click recovery when the target tier is `Not used`), and run the next review pass. | Confirmed by Collin after the 3-round review budget check. | user |

## Spec

### Mockups

- `docs/plans/agent-model-preferences/graphs/mockup-models-desktop-v5.html` — **Settings → Models** (Code mapping custom provider order expanded, GPT tier tab active), `1280 × 900`.
- `docs/plans/agent-model-preferences/graphs/mockup-models-phone-v5.html` — **Settings → Models** (same state, phone layout), `390 × 844`.

### 1. Data model, defaults, and normalization (`viewer/app/settings.js`)

1. **Agent tier preferences (`other_agents`):**
   - Keep the persisted key name `other_agents` in `settings.json` for backward compatibility with existing saved files and API clients.
   - Expand `defaults().other_agents` to all 10 configurable agent roles:
     - `lead: 'heavy'`
     - `'sub-lead': 'heavy'`
     - `assistant: 'heavy'`
     - `'project-lead': 'heavy'`
     - `reviewer: 'heavy'`
     - `verifier: 'heavy'`
     - `mapper: 'standard'`
     - `designer: 'standard'`
     - `scout: 'light'`
     - `'scout-heavy': 'standard'`
   - In `normalize(saved)`: construct `other_agents` by iterating over every key in `base.other_agents` and keeping `saved.other_agents[k]` only when it is one of `['light', 'standard', 'heavy', 'critical']`; otherwise fall back to `base.other_agents[k]`. Unknown keys are dropped.

2. **Per-role provider ladders (`provider_orders`):**
   - Add `provider_orders` to `defaults()` covering all 8 standalone session roles:
     - Lead-family roles: `lead: 'lead'`, `'sub-lead': 'lead'`, `assistant: 'lead'`, `'project-lead': 'lead'`.
     - Worker-family roles: `reviewer: 'worker'`, `verifier: 'worker'`, `mapper: 'worker'`, `designer: 'worker'`.
   - Export a shared validator `validProviderOrder(value, { allowAny = false } = {})` in `viewer/app/settings.js` that returns `true` iff:
     - `value === 'lead'` or `value === 'worker'`, OR
     - `Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every((v, i) => Object.hasOwn(PROVIDERS, v) || (allowAny && v === 'any' && i === value.length - 1))`.
   - Allow `allowAny: true` only for lead-family roles (`lead`, `sub-lead`, `assistant`, `project-lead`), matching `lead_order` (including existing `['any']`, which expands to `worker_order`); use `allowAny: false` for worker-family roles (`reviewer`, `verifier`, `mapper`, `designer`), matching `worker_order`.
   - Keep `validBalancing('lead_order', value)` unchanged so existing `lead_order: ['any']` remains valid on load and write.
   - In `normalize(saved)`: construct `provider_orders` by iterating over every key in `base.provider_orders` and keeping `saved.provider_orders[k]` only when `validProviderOrder(saved.provider_orders[k], { allowAny: LEAD_FAMILY_ROLES.includes(k) })` is true; otherwise fall back to `base.provider_orders[k]`. Unknown keys are dropped.
   - Include `provider_orders` in `describe(hub)` so `GET /settings` returns it alongside `other_agents`, `lead_order`, and `worker_order`.

3. **Legacy `lead`/`sub-lead` pin transition notice & backward compatibility:**
   - Do **not** remove `lead` or `sub-lead` from `codex/model.sh`'s `SLOTS` or parser: existing `~/.wheelchair/models` files containing `lead`/`sub-lead` pins must continue to parse cleanly without triggering malformed-file fallbacks, and `codex/test/run.sh` remains untouched and green.
   - Add boolean `lead_tier_notice_dismissed` to `defaults()` (default `false`; normalized as `Boolean(saved.lead_tier_notice_dismissed)`).
   - In `describe(hub)`: when `!value.lead_tier_notice_dismissed`, read models strictly through `models(hub)` (`codex/model.sh show --json`, honoring `WHEELCHAIR_MODELS` and `viewer/AGENTS.md:27` — never reading `~/.wheelchair/models` directly). For each enabled provider and each legacy role (`lead`, `sub-lead`), compare its `models(hub)` cell (`legacy_model`, `legacy_effort`) against that provider's current `value.other_agents[role]` tier cell (`tier_model`, `tier_effort`). Emit a diff entry `{ provider, label, role, legacy_model, legacy_effort, tier, tier_model, tier_effort }` when the two cells differ (by model or effort) **and** either (a) the legacy cell differs from the provider manifest's shipped default for that slot, or (b) `tier_model === null` (`Not used`) while `legacy_model !== null` (so fresh installs whose shipped defaults match never trigger false notices, while any provider whose Heavy tier is `Not used` still surfaces the recovery action). When dismissed or when there are no diffs, return `legacy_lead_diffs: []`.
   - Never silently overwrite any shared tier cell on upgrade; the user decides whether to apply a legacy pin to a tier cell (via the explicit button in §4.2) or dismiss the notice.

### 2. API routes and documentation (`viewer/app/routes.js`, `viewer/app/API.md`)

1. **`PUT /settings/preferences` (`viewer/app/routes.js`):**
   - `other_agents`: accept any subset of the 10 role keys in `defaults().other_agents`. Reject unknown keys or invalid tiers with `400` (`settings.tier(value, ...)`). Merge validated entries into `s.other_agents`.
   - `provider_orders`: accept a plain object containing any subset of the 8 standalone role keys (`lead`, `sub-lead`, `assistant`, `project-lead`, `reviewer`, `verifier`, `mapper`, `designer`). Reject non-object values, unknown role keys, or entries failing `validProviderOrder(value, { allowAny: LEAD_FAMILY_ROLES.includes(role) })` with `400` and a plain error message. Merge validated entries into `s.provider_orders`.
   - **Shared enabled-lead-ladder invariant (enforced consistently across `PUT /settings/preferences`, `PUT /settings/balancing`, and `PUT /settings/harnesses/:provider`):** after applying the candidate update, `harnesses.enabledLeadOrder(value)` (the enabled providers in `balancer.expandOrder(value.provider_orders.lead, value)`) must be non-empty; otherwise reject with `409` (`'Leads would have no enabled provider left. Enable or add another provider in Settings → Models first.'`).
   - `lead_tier_notice_dismissed`: accept boolean; when `true`, persists dismissal of the one-time legacy lead-pin notice.
   - Include `provider_orders` and `lead_tier_notice_dismissed` in the JSON response alongside `other_agents` and all existing preference fields.
2. **`PUT /settings/balancing` (`viewer/app/routes.js`):**
   - Keep the existing request/response fields unchanged (`lead_order`, `worker_order`, `within`, `leave`, `notify_below`, `save_for_leads`, `margin`, `held_back`, returning all balancing keys plus `reserved_provider`), enforcing the shared enabled-lead-ladder invariant above on every write. The **Provider ladders** block on **Settings → Models** saves `lead_order` and `worker_order` through `PUT /settings/balancing`; the **Balancing** block on **Settings → Usage and balancing** saves `within`, `leave`, `notify_below`, `save_for_leads`, `margin`, `held_back` through `PUT /settings/balancing`.
3. **`viewer/app/API.md`:**
   - Update `GET /settings` and `PUT /settings/preferences` documentation to list all 10 `other_agents` keys (including `lead`, `sub-lead`, `assistant`, `project-lead`, and previously omitted `designer`), `provider_orders` and its allowed values (`'lead'`, `'worker'`, or custom provider array with `'any'` allowed for lead-family roles), `lead_tier_notice_dismissed` / `legacy_lead_diffs`, and previously omitted `project_leads`.
   - Update the session-start section (`viewer/app/API.md:115-120, 145`) to replace the old statement that Lead and Sub-lead use dedicated model slots with the new behavior: all roles resolve via `other_agents` tiers, regular thread leads stay pinned to `thread.provider` on restart while Personal assistant, Project leads, and Sub-leads evaluate their role provider ladder on each start, and `review_families` single-family eligibility/fallback precedes reviewer/verifier ladders.

### 3. Session placement, model resolution, and harness diagnostics (`viewer/app/balancer.js`, `viewer/app/sessions.js`, `viewer/app/harnesses.js`)

1. **Role-to-preference mapping (`viewer/app/balancer.js`):**
   - Add helper `preferenceRole(role, thread)`:
     - If `role === 'lead'`: return `thread?.assistant ? 'assistant' : thread?.project_lead ? 'project-lead' : 'lead'`.
     - Otherwise return `role`.
   - Add helper `isPinnedThreadLead(role, thread)`: `role === 'lead' && !thread?.assistant && !thread?.project_lead && Boolean(thread?.provider)`.
   - Update `slotFor(hub, role, requestedTier = 'top', thread = null)`:
     - Compute `prefRole = preferenceRole(role, thread)`.
     - If `prefRole` is one of `['lead', 'sub-lead', 'assistant', 'project-lead', 'reviewer', 'verifier', 'mapper', 'designer']`, load settings and return `settings.other_agents[prefRole]` (a work tier: `light | standard | heavy | critical`).
     - Otherwise (`worker` or other), keep existing `requestedTier` mapping (`haiku -> light`, `sonnet -> standard`, `opus -> heavy`, `top -> heavy`).
2. **Atomic slot carry-through to model resolution (`viewer/app/balancer.js`, `viewer/app/sessions.js`):**
   - `choose(hub, thread, role, tier, constraints)` returns `slot` in its success result: `{ provider: picked, account: available[picked], slot, ...(note ? { note } : {}) }`.
   - Update `resolveModel(hub, cli, role, requestedTier = 'top', thread = null, resolvedSlot = null)` in `viewer/app/sessions.js` to use `resolvedSlot || await slotFor(hub, role, requestedTier, thread)` so session launch always resolves the exact tier slot that `choose(...)` approved (preventing mid-startup Settings edits from causing a slot mismatch or unexpected `Not used` error). When preflight fails and `choose(...)` is retried, `selection.slot` updates from the new placement attempt.
   - Update `sessions.js:363`:
     - For regular thread leads (`role === 'lead' && !thread.assistant && !thread.project_lead && !thread.provider`): set `thread.provider = selection.provider; thread.cli = cli;`.
     - For Personal assistant and Project leads (`role === 'lead' && (thread.assistant || thread.project_lead)`): always update `thread.provider = selection.provider; thread.cli = cli;` on session start so a newly saved provider ladder takes effect on the next start/toggle/restart without losing queued messages on the thread.
     - For `sub-lead`: never overwrite `thread.provider`; `resolveScout(hub, selection.provider, ...)` (`sessions.js:370-371`) continues to resolve scouts on the sub-lead's own `selection.provider`.
3. **Provider order resolution (`viewer/app/balancer.js`):**
   - Export helper `expandOrder(entry, settings)`:
     - If `entry === 'lead'`: return `settings.lead_order.flatMap((p) => p === 'any' ? settings.worker_order : [p])`.
     - If `entry === 'worker'`: return `[...settings.worker_order]`.
     - If `Array.isArray(entry)`: return `entry.flatMap((p) => p === 'any' ? settings.worker_order : [p])`.
   - In `choose(hub, thread, role, tier, constraints)`:
     - Call `slotFor(hub, role, tier, thread)`.
     - Preserve the exact existing `effectiveFamilies` / `strictReview` / `fallbackReview` eligibility check (`balancer.js:76-86, 125`): when `review_families` is a single family (or Mix families narrowed to one signed-in family), check enabled + signed-in + `model.sh` exit-3 at `slot`; if eligible, set `strictReview = family`; otherwise set `fallbackReview = family` (when `settings.review_families !== 'both'`) and fall through to the role's provider ladder with the existing fallback note.
     - Compute candidate `order`:
       - If `isPinnedThreadLead(role, thread)`: `order = [thread.provider]`. If `!settings.harnesses[thread.provider]`, return the existing disabled-harness wait. If `model.sh` exits 3 (`Not used`) for `thread.provider` at `slot`, return `{ wait: { provider: thread.provider, until: new Date(now + 60000).toISOString(), reason: `${DISPLAY_NAMES[thread.provider]} is set to Not used for ${slot} in Settings → Models` } }` (instead of a misleading quota wait).
       - Else if `role === 'lead'` (new thread lead, Personal assistant, or Project lead) or `role === 'sub-lead'` or `['reviewer', 'verifier', 'mapper', 'designer'].includes(role)`: `order = expandOrder(settings.provider_orders[preferenceRole(role, thread)], settings)`.
       - Else (`worker`): `order = [...settings.worker_order]`.
     - Apply `strictReview` override and enabled-harness filter: `order = (strictReview ? [strictReview] : [...new Set(order.filter(Boolean))]).filter((p) => settings.harnesses[p])`.
     - **Configuration-block waits (before quota-refill waits):**
       - If `!order.length` (e.g. a role's Custom provider ladder has no enabled providers left after a harness is turned off): return `{ wait: { provider: null, until: new Date(now + 60000).toISOString(), reason: 'No enabled provider in this role\'s provider ladder in Settings → Models' } }`.
       - Track whether at least one provider in `order` had a configured model at `slot` (did not exit 3 from `model.sh`). If `order.length > 0` and zero providers in `order` had a configured model at `slot`: return `{ wait: { provider: order.length === 1 ? order[0] : null, until: new Date(now + 60000).toISOString(), reason: order.length === 1 ? `${DISPLAY_NAMES[order[0]]} is set to Not used for ${slot} in Settings → Models` : `All enabled providers on this role's ladder are set to Not used for ${slot} in Settings → Models` } }` (instead of a misleading quota wait).
     - Wait metadata (`balancer.js:139`): replace `['lead', 'sub-lead'].includes(role) && thread.provider` with `isPinnedThreadLead(role, thread)` so `sub-lead`, `assistant`, and `project-lead` never attribute exhausted-ladder waits to `thread.provider` (they use `order[0] || null` for `lead` or `null` for `sub-lead` when multiple providers were tried).
     - Keep `reservedProvider` (`balancer.js:24-27`), `heldBack` (`balancer.js:49-51`), and `save_for_leads` (`balancer.js:106`) unchanged (`lead` and `sub-lead` are not held back, and `reservedProvider` still uses `settings.lead_order`).
4. **Harness diagnostics, thread wait banner, and lead prompt (`viewer/app/harnesses.js`, `viewer/pages/settings.js`, `viewer/pages/thread.js`, `protocol/app/lead.md`):**
   - In `viewer/app/harnesses.js:28-36`, compute `enabledLeadOrder(value)` from `balancer.expandOrder(value.provider_orders.lead, value)` (filtered by `value.harnesses[p]`). If `selection.wait?.reason` names a `Not used` or empty-ladder configuration block, surface `selection.wait.reason` directly as `can_start[role].reason` (never falling through to the quota-limit message). When another enabled & signed-in provider exists outside the order, name the exact owning control without duplicating `"in Settings"`: `Worker ladder` for `role === 'worker'`, and for `role === 'lead'`, `Lead ladder` when `value.provider_orders.lead === 'lead'` (or `Worker ladder` if `lead_order` includes `'any'`), `Worker ladder` when `value.provider_orders.lead === 'worker'`, and `Leads provider order` when `value.provider_orders.lead` is a custom array (ending `in Settings.`).
   - In `viewer/pages/settings.js:2300-2303` (`linkReasons()`): update the matcher regex from `/(Workers try first|Leads try)/` to `/(Lead ladder|Worker ladder|Leads provider order)/` and link matches to `#models` (updating the corresponding assertion in `viewer/test/app-harnesses.spec.js:501`).
   - In `viewer/pages/thread.js:1633-1642` (`waitingLine()`): in addition to the existing `is left out in Settings` branch, when `lead.waiting_reason` ends with `in Settings → Models` (covering both `is set to Not used for ... in Settings → Models` and `No enabled provider in this role's provider ladder in Settings → Models`), display `lead.waiting_reason + '.'` directly instead of the quota refill message.
   - In `protocol/app/lead.md:92`: update `the lead and sub-lead run on the lead model from Settings, and the reviewer, verifier, mapper and designer on the Other agents tiers there` to `the lead, sub-lead, reviewer, verifier, mapper and designer each run on their configured tier in Settings → Models`.

### 4. Reworked Settings → Models & Usage and balancing UI (`viewer/pages/settings.js`, `viewer/pages/settings.css`)

Match the agreed v5 desktop (`1280 × 900`) and phone (`390 × 844`) mockups in visual hierarchy, spacing, controls, and responsive behavior:

1. **Category definitions (`viewer/pages/settings.js`):**
   - `usage`: `line: 'Usage and reserves'`, `blocks: ['usage', 'balancing']`. Remove `'lead-order'` block and remove the `'Workers try first'` (`worker_order`) row from `renderBalancing()`. Update `#bal-save` to save `['within', 'leave', 'notify_below', 'save_for_leads', 'margin', 'held_back']` (never overwriting `worker_order` or `lead_order`).
   - `models`: `line: 'Agents, provider ladders, tiers and escalation'`, `blocks: ['agents', 'ladders', 'tiers', 'escalation', 'assistants']`. Remove the old `renderLeadModels()` and `renderOthers()` blocks.

2. **One-time legacy pin notice (top of `agents` block when `data.legacy_lead_diffs.length > 0`):**
   - Compact inline banner listing each differing enabled provider/role with both model and effort (showing `Not used` for `null`, and showing effort-only changes cleanly, e.g. `GPT lead was gpt-6.1-sol (medium); Heavy is gpt-6.2-sol (high)` or `Kimi lead was kimi-code/k3.1-pro; Heavy is Not used`).
   - For any diff where `tier_model === null` (`Not used`) and `legacy_model !== null`, include an explicit recovery button **`Use <legacy_model> for <Tier>`** that calls `PUT /settings/models` to set that provider's tier cell to `legacy_model` (and `legacy_effort` if present), refreshes models/diffs, and never silently overwrites any shared tier without the user's click.
   - Include a **`Dismiss`** button that calls `PUT /settings/preferences` with `{ lead_tier_notice_dismissed: true }` and removes the banner.

3. **Agents block (`agents`):**
   - Heading: `Agents`, subtitle: `Choose a tier for each role. Models depend on the provider used.`
   - Roles in order:
     1. `Leads` (`lead`, ladder hint: `Provider order applies to new threads; existing threads stay on their provider`)
     2. `Sub-leads` (`sub-lead`)
     3. `Plan reviewers` (`reviewer`)
     4. `Checker` (`verifier`)
     5. `Reviewers and checkers` family mix row (`review_families` segmented control: `Mix families` plus each enabled `reviewFamily` provider, same behavior and hint text as today)
     6. `Code mapping` (`mapper`)
     7. `Mockups` (`designer`)
     8. `Scout` (`scout`, hint: `Runs on the lead's or sub-lead's provider` — no provider ladder control)
     9. `Scout for bigger changes` (`scout-heavy`, hint: `Runs on the sub-lead's provider` — no provider ladder control)
   - Each role row displays:
     - Role title and a live resolved model preview line showing the configured tier models across enabled providers (e.g. `Claude: claude-opus-4-6 · GPT: gpt-5.4 (high)` — omitting providers set to `Not used`; showing `No provider set for this tier` if all enabled providers are `Not used`). For Scouts, the preview displays the same configured tier models (CLI family/member-id resolution occurs at launch). Changing any tier model/effort or toggling a role's tier updates affected previews immediately.
     - A 4-way segmented tier control (`role="radiogroup"`, `Light | Standard | Heavy | Critical`) that saves immediately via `PUT /settings/preferences` (`{ other_agents: { [role]: tier } }`). On failure, restores the previous tier and shows an inline error on that row.
     - For every role except `scout` and `scout-heavy`: a collapsible provider ladder control (`<details>` / disclosure trigger):
       - Closed summary label shows `Default: Lead`, `Default: Worker`, or `Custom: <Prov1> → <Prov2>…` (listing enabled providers in order, plus `→ any` if `'any'` is enabled).
       - Opening the disclosure shows a 3-way segmented mode switch (`Default: Lead | Default: Worker | Custom`) plus a muted resolved-order line when `Default: Lead` or `Default: Worker` is active (e.g. `Uses Lead ladder: Claude → GPT → any` or `Uses Worker ladder: GPT → Claude → Antigravity`), and on the `Leads` row notes `Applies to new threads`.
         - Clicking `Default: Lead` or `Default: Worker` saves immediately via `PUT /settings/preferences` (`{ provider_orders: { [role]: 'lead' | 'worker' } }`).
         - Clicking `Custom` initializes the custom list deterministically from the role's current mode:
           - For **lead-family** roles (`lead`, `sub-lead`, `assistant`, `project-lead`): from `'lead'`, copy `data.lead_order` as-is (preserving any `'any'` tail and switched-off providers' positions); from `'worker'`, copy `data.worker_order` as-is.
           - For **worker-family** roles (`reviewer`, `verifier`, `mapper`, `designer`): from `'worker'`, copy `data.worker_order` as-is; from `'lead'`, expand and deduplicate `[...new Set(data.lead_order.flatMap((p) => p === 'any' ? data.worker_order : [p]))]` with no `'any'` tail (so it always passes `allowAny: false` validation).
         - Saves immediately, then renders the ordered list of enabled providers with `↑`, `↓`, `Remove` (when > 1 enabled provider remains), `+ <Provider>` buttons for omitted enabled providers, and — for lead-family roles only — a `"then whatever's left"` checkbox (`'any'` tail). Every reorder, add, remove, or tail toggle saves immediately via `PUT /settings/preferences` (`{ provider_orders: { [role]: nextArray } }`), reverting and showing an inline error on failure. Keep the disclosure open across repaints while editing that role's ladder.

4. **Provider ladders block (`ladders`):**
   - Heading: `Provider ladders`, subtitle: `Shared provider orders. Workers always use the Worker ladder; Save for leads in Usage and balancing protects the top provider on the Lead ladder.`
   - Two columns on desktop (stacked on phone `< 900px`):
     - **Lead ladder** (`lead_order`): ordered list of enabled providers with `↑`, `↓`, `Remove` (when > 1 enabled provider), `+ <Provider>` buttons for omitted enabled providers, and `"then whatever's left"` checkbox (`'any'` tail). Preserves switched-off providers' relative indices in the saved array.
     - **Worker ladder** (`worker_order`): same controls, without `"then whatever's left"`.
   - Every change saves immediately via `PUT /settings/balancing` (`{ lead_order }` or `{ worker_order }`), updates `data.lead_order` / `data.worker_order` / `data.reserved_provider`, shows the section saved status note (`Saved, applies to new sessions`), refreshes any open role-ladder resolved-order lines, and reverts with an inline error on failure.

5. **Tier models block (`tiers`):**
   - Heading: `Tier models` (keeping `#tiers` anchor / section id).
   - Show any global heads-up lines (`malformed`, `tierless`) at the top of the block as before.
   - Provider tabs (`role="tablist"`) for **enabled providers only** (`PROVIDERS.filter(([p]) => harnessOn(p))`). Keep the active tab in page state (defaulting to the first enabled provider; if the active provider is disabled, fall back to the first enabled provider). If no providers are enabled, show a brief empty message pointing to AI providers.
   - Below the tabs, render the active provider's 4 tiers (`Light`, `Standard`, `Heavy`, `Critical`) as clean rows:
     - Tier name and description (`Spelled-out changes, few files`, `Most building`, `Leading, planning, review, checking`, `Can't afford to get wrong`).
     - Model `<select>` with the provider's options, `Not used`, and `Other…` (opening the inline text input + `Use` button with existing regex validation and error display).
     - For providers with effort levels (`EFFORTS[provider]`): inline segmented effort pills (`role="radiogroup"`, `CLI default` plus the model's supported effort levels, disabled when model is `Not used` or the model supports no effort levels `levels.length === 0`) instead of a second `<select>` dropdown. Clicking a pill saves immediately via `PUT /settings/models` and refreshes models/options (`refreshModels`), preserving the active provider tab and updating Agent/Assistant live model previews.
     - For providers with `modelHeadsUp` (GPT), render any tier-specific `newer`/`available` heads-up banner (`Switch` / `Skip`) inline under that tier row, repainting cleanly on action.

6. **Escalation block (`escalation`):**
   - Keep the existing `Escalation` block (live `escalation_text` summary + 4 segmented rows: `What steps up first`, `Highest effort`, `Highest tier`, `Ask me before`) styled cleanly to match the v5 mockup.

7. **Assistants block (`assistants`):**
   - Heading: `Assistants`, subtitle: `Choose models for conversations outside a thread's build.`
   - Two rows: `Personal assistant` (`assistant`) and `Project leads` (`project-lead`), using the exact same row component as **Agents** (live model preview, 4-way segmented tier switch, and collapsible 3-way provider ladder control with lead-family `'any'` tail support).

8. **Responsive & accessibility rules:**
   - Match `mockup-models-desktop-v5.html` at desktop widths (`>= 900px`) and `mockup-models-phone-v5.html` at phone widths (`<= 899px`), with no horizontal overflow and comfortable tap targets on phone.
   - Preserve semantic ARIA labels (`aria-label` on tier radiogroups, model selects, effort radiogroups, provider tabs `role="tab"`/`aria-selected`, and ladder controls) so keyboard navigation and Playwright tests remain reliable.

### 5. Non-goals and boundaries

- Do not remove `lead` or `sub-lead` slots from `codex/model.sh`.
- Do not change how usage polling, account ranking, or `save_for_leads` / `held_back` forecasting work in `viewer/app/usage.js` or `viewer/app/usage-poll.js`.
- Do not redesign unrelated Settings categories (only remove the moved provider-order controls from **Usage and balancing**, update its subtitle, and point the AI providers ladder link to `#models`).
- Update existing unit and Playwright tests that asserted on the removed `lead-models` block, the moved `lead-order`/`worker_order` blocks in Usage and balancing (including `viewer/test/background-settings-surfaces.spec.js`), the old 409 message (`viewer/test/app-harnesses.test.js:113`, `viewer/test/app-harnesses.spec.js:482,485`) and link matcher (`viewer/test/app-harnesses.spec.js:501`), or the old `sub-lead` lock to `thread.provider`; add `'app-settings.spec.js'`, `'app-harnesses.spec.js'`, `'app-accounts.spec.js'`, and `'background-settings-surfaces.spec.js'` to `viewer/test/firefox-specs.js` (per `CONTRIBUTING.md:92-94`, since they test horizontal scroll containment); and add new unit and browser tests covering all new behaviors (10 agent tiers, `provider_orders` validation/normalization/placement, shared enabled-lead-ladder 409 guard across all three write routes, legacy lead-pin notice + recovery button, `sub-lead`/`assistant`/`project-lead` tier & ladder resolution, atomic slot carry-through, empty-ladder & `Not used` wait reasons & thread banner, provider tabs, effort pills, live previews, and phone layout).

### 6. Validation commands

Targeted unit and browser tests covering the changed areas (the full test suite runs before push):

- `node --test viewer/test/app-settings.test.js viewer/test/app-balancer.test.js viewer/test/char-settings-defaults.test.js viewer/test/app-kimi-settings.test.js viewer/test/app-openrouter-settings.test.js viewer/test/assistant.test.js viewer/test/project-lead.test.js viewer/test/app-hub.test.js viewer/test/app-harnesses.test.js`
- `node --test machine/test/name-guard.test.js`
- `npm --prefix viewer run test:browser -- browser.spec.js app-settings.spec.js app-harnesses.spec.js app-accounts.spec.js app-settings-hold.spec.js background-settings-surfaces.spec.js`

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| `Object.hasOwn(PROVIDERS, v)` in array validation coerces nested single-element arrays like `['gpt']` to string keys. | Rare path per `realism.md`: neither the UI nor any real tool writes nested arrays into `provider_orders` or `lead_order`. | review-round-1 |
| Clicking the one-time legacy pin recovery button in one tab while manually editing the same tier cell in a second open Settings tab could overwrite the other tab's edit. | Rare path per `realism.md`: requires concurrent manual edits to the same tier cell across two open Settings tabs during the one-time notice. | review-round-3 |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-27

**Lanes:** claude / claude-opus-5-5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Stopping reading `lead`/`sub-lead` pins without migration can silently change models or leave Kimi/OpenRouter Heavy at `Not used`. | upheld | Added one-time dismissible legacy lead-pin transition notice in §1.3, §2.1, §4.2 (Decision 11); never silently overwrites shared tiers. |
| intent | major | Defaulting `sub-lead` provider order to `'lead'` removes the `[thread.provider]` lock; suggests a `'thread'` default. | declined | Contradicts Collin's explicit instruction on v3 ("If i said i wanted the subleads to use the same provider as the lead, i don't want that. we should have the setting for that." — Decision 7). |
| intent | minor | `save_for_leads` still reserves `lead_order`'s top provider even if Leads/Assistants use Worker or Custom; add a note. | upheld | Added explicit note in Provider ladders subtitle (§4.4). |
| intent | minor | Custom ladders allowed `'any'` tail for worker-family roles while shared Worker ladder did not. | upheld | Restricted `'any'` tail in custom ladders to lead-family roles only (§1.2, §2.1, §4.3). |
| intent | minor | Validation command named `viewer/test/app-assistant.test.js` which does not exist (`viewer/test/assistant.test.js`). | upheld | Fixed to `viewer/test/assistant.test.js` (§6). |
| mechanics | blocking | Upgrade silently stops using saved Lead/Sub-lead pins without transition. | upheld | Resolved with intent finding 1 via one-time dismissible transition notice (§1.3, §2.1, §4.2, Decision 11). |
| mechanics | blocking | Personal assistant and Project leads ladder controls cannot change provider on existing conversations because `thread.provider` restart lock wins. | upheld | Exempted `thread.assistant` and `thread.project_lead` from the `thread.provider` restart lock and updated `thread.provider`/`thread.cli` on start (§3.1–3.3, Decision 11). |
| mechanics | major | Equating single `effectiveFamilies` with `strictReview` omits eligibility check and `fallbackReview` fallback. | upheld | Preserved exact `balancer.js:76-86, 125` eligibility check and fallback into role ladder (§3.3). |
| mechanics | major | Tightening `validBalancing('lead_order')` to reject `['any']` breaks existing `lead_order: ['any']` configs. | upheld | Kept `validBalancing('lead_order')` unchanged and kept `['any']` valid for lead-family custom ladders (§1.2). |
| mechanics | major | Restarted thread lead pinned to a provider with `Not used` at its tier loops a quota-style wait; sub-lead wait metadata still referenced `thread.provider`. | upheld | Added explicit `Not used` configuration wait reason for pinned thread leads and fixed `waitingProvider` in `balancer.js:139` to use `isPinnedThreadLead` (§3.3). |
| mechanics | major | Placement and launch resolve `slotFor` separately with async preflight in between, allowing mid-startup Settings drift. | upheld | `choose` now returns `slot` and `resolveModel` uses `selection.slot` directly (§3.2). |
| mechanics | minor | `viewer/app/harnesses.js:26-36` and `viewer/pages/settings.js:2300-2303` still diagnose new leads against `lead_order` and link to `#usage`. | upheld | Updated `harnesses.js` to use `provider_orders.lead` and updated Settings link to `#models` (§3.4). |
| mechanics | minor | Default disclosure did not show the resolved provider order inside the open panel. | upheld | Added muted resolved-order line inside open disclosure when `Default: Lead` or `Default: Worker` is active (§4.3). |
| mechanics | minor | Scout preview/hint omitted that Scout also runs in sub-leads and that launch resolves family/member-id. | upheld | Updated Scout hint and preview behavior in §4.3. |
| mechanics | minor | `viewer/app/API.md:115-120, 145` session-start docs still say Lead/Sub-lead use dedicated model slots. | upheld | Added session-start API doc updates to §2.3. |
| mechanics | minor | Playwright command omitted config (`npm --prefix viewer run test:browser -- ...`) and missed affected test files. | upheld | Updated §6 with exact `npm --prefix viewer run test:browser -- ...` and missing unit/browser test files. |
| mechanics | minor | Rare path: `Object.hasOwn(PROVIDERS, v)` coerces nested single-element arrays like `['gpt']`. | accepted-risk | Rare path per `realism.md`; recorded in Accepted Risks. |

### Round 2 — 2026-11-27

**Lanes:** claude / claude-opus-5-5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

**Changed since Round 1:**
- §1.2, §2.1, §4.3: Restricted `'any'` tail in custom provider ladders to lead-family roles only; kept `validBalancing('lead_order')` unchanged so `['any']` remains valid.
- §1.3, §2.1, §4.2 (Decision 11): Added one-time dismissible legacy `lead`/`sub-lead` pin transition notice (`lead_tier_notice_dismissed`, `legacy_lead_diffs`) without silently overwriting shared tiers.
- §2.3: Added `viewer/app/API.md` session-start section updates (`:115-120, 145`).
- §3.1–3.3: Exempted Personal assistant and Project leads from the `thread.provider` restart lock (updating `thread.provider`/`thread.cli` on start); carried `selection.slot` from `choose()` through `resolveModel()`; preserved exact `strictReview`/`fallbackReview` eligibility check; added explicit `Not used` wait reason for pinned thread leads and fixed `waitingProvider` for `sub-lead`/`assistant`/`project-lead`.
- §3.4: Updated `viewer/app/harnesses.js` lead-order diagnostics to use `provider_orders.lead` and updated the AI providers link to `#models`.
- §4.3–4.4: Added resolved default order text inside open role disclosures, added `save_for_leads` note to Provider ladders subtitle, and clarified Scout hints/previews.
- §6: Fixed validation commands (`assistant.test.js`, `app-hub.test.js`, `app-harnesses.test.js`, and `npm --prefix viewer run test:browser -- app-settings.spec.js app-harnesses.spec.js app-accounts.spec.js app-settings-hold.spec.js`).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Leads row ladder only applies to new threads; add a hint so users don't expect running threads to move. | upheld | Added `Applies to new threads` hint on the Leads row and its open disclosure (§4.3). |
| intent | minor | `viewer/test/background-settings-surfaces.spec.js:46` checks `.lead-order-box > section` under `usage`; add to §5 and §6. | upheld | Added `background-settings-surfaces.spec.js` to §5 and §6. |
| mechanics | major | Transition notice leaves a pinned thread unable to restart when its provider has a legacy Lead pin and Heavy is `Not used`, with no explicit recovery action. | upheld | Added one-click `Use <legacy_model> for <Tier>` recovery button on `Not used` diffs in the transition notice (§4.2) alongside the clear thread banner (§3.4). |
| mechanics | major | `viewer/pages/thread.js:1633-1642` (`waitingLine()`) ignores the new `Not used` wait reason and shows a quota refill message instead. | upheld | Added explicit `is set to Not used for ` branch in `viewer/pages/thread.js` `waitingLine()` (§3.4). |
| mechanics | major | `PUT /settings/preferences` could set `provider_orders.lead` to an order with no enabled harness, causing later `PUT /settings/balancing` or `PUT /settings/harnesses` writes to 409. | upheld | Enforced the single `enabledLeadOrder(value).length > 0` 409 invariant consistently across `PUT /settings/preferences`, `PUT /settings/balancing`, and `PUT /settings/harnesses/:provider` (§2.1–2.2). |
| mechanics | minor | Define how Custom initializes from a shared Lead ladder with an `'any'` tail for worker-family vs lead-family roles. | upheld | Specified exact deterministic initialization rules for lead-family (keep `'any'`) vs worker-family (expand & deduplicate, no `'any'`) (§4.3). |
| mechanics | minor | `viewer/app/harnesses.js` startup repair hint must name the actual owner of Leads' order (`Lead ladder`, `Worker ladder`, or `Leads provider order`). | upheld | Updated §3.4 to name the exact owning control based on `value.provider_orders.lead`. |
| mechanics | minor | `show --json` fills absent legacy `lead`/`sub-lead` slots from defaults/inheritance; read explicit lines from the raw pins file and include effort-only diffs and explicit `none`. | upheld | Updated §1.3 and §4.2 to inspect explicit saved lines in the raw pins file and report model+effort diffs including `Not used`. |
| mechanics | minor | §6 omits `node --test machine/test/name-guard.test.js` mapped to `viewer/app/**` and `viewer/pages/**`. | upheld | Added `node --test machine/test/name-guard.test.js` to §6. |
| mechanics | minor | Add `app-settings.spec.js` to `viewer/test/firefox-specs.js` per `CONTRIBUTING.md:92-94` since it tests phone horizontal scroll/overflow. | upheld | Added `viewer/test/firefox-specs.js` update to §5. |

### Round 3 — 2026-11-27

**Lanes:** claude / claude-opus-5-5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

**Changed since Round 2:**
- §1.3, §4.2: Legacy `lead`/`sub-lead` pin diff reads explicit saved lines from the raw pins file (never flagging defaults/inheritance), covers effort-only diffs and explicit `none`, and adds an explicit `Use <legacy_model> for <Tier>` recovery button when the target tier is `Not used`.
- §2.1–2.2: Enforced the shared `enabledLeadOrder(value).length > 0` 409 guard consistently across `PUT /settings/preferences`, `PUT /settings/balancing`, and `PUT /settings/harnesses/:provider`.
- §3.4: Added `is set to Not used for ` handling to `viewer/pages/thread.js` `waitingLine()` and made `viewer/app/harnesses.js` startup repair hints name the actual owning control for Leads' provider order.
- §4.3: Added `Applies to new threads` hint to the Leads row/disclosure and defined deterministic Custom ladder initialization from `'lead'`/`'worker'` for lead-family vs worker-family roles.
- §5–6: Added `background-settings-surfaces.spec.js`, `machine/test/name-guard.test.js`, and adding `'app-settings.spec.js'` to `viewer/test/firefox-specs.js`.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Turning off a provider can leave a custom assistant/project-lead/sub-lead ladder with no enabled provider, falling through to `"no account has room"`. | upheld | Added explicit empty-ladder wait reason in `balancer.js` and rendered it in `thread.js` `waitingLine()` (§3.3–3.4). |
| intent | minor | `linkReasons()` still splits on `Workers try first\|Leads try`, and `harnesses.js` already appends `in Settings.`. | upheld | Updated `linkReasons()` regex to `Lead ladder\|Worker ladder\|Leads provider order` and removed duplicate `in Settings` (§3.4). |
| intent | minor | Two existing tests (`app-harnesses.test.js:113`, `app-harnesses.spec.js:482,485`) assert the old 409 message. | upheld | Listed both tests for updating in §5. |
| mechanics | major | A new thread, assistant, or project lead whose enabled ladder providers are all `Not used` at its tier falls through to a quota wait and `harnesses.js` reports a quota problem. | upheld | Generalized `Not used` configuration wait in `balancer.js` to any role whose enabled ladder has zero configured models at `slot`, surfaced in `harnesses.js` and `thread.js` (§3.3–3.4). |
| mechanics | major | Recovery button in legacy pin notice can overwrite a tier cell edited in a second open Settings tab. | accepted-risk | Rare path per `realism.md` (concurrent manual edits across two tabs during a one-time notice); recorded in Accepted Risks. |
| mechanics | minor | Raw saved line in `~/.wheelchair/models` includes installer-written shipped defaults, triggering false notices on fresh installs. | upheld | Compared `models(hub)` against shipped defaults and `Not used` instead (§1.3). |
| mechanics | minor | Reading `~/.wheelchair/models` via undefined `hub.modelsFile` bypasses `WHEELCHAIR_MODELS` and `viewer/AGENTS.md:27`. | upheld | Switched §1.3 strictly to `models(hub)` (`codex/model.sh show --json`). |
| mechanics | minor | `linkReasons()` matcher regex and `app-harnesses.spec.js:501` must be updated for new ladder names. | upheld | Updated §3.4 and §5. |
| mechanics | minor | `protocol/app/lead.md:92` still says Lead and Sub-lead use the old lead model setting. | upheld | Added `protocol/app/lead.md:92` update to §3.4. |
| mechanics | minor | §6 omits `browser.spec.js` selected by test picker for committed mockups. | upheld | Added `browser.spec.js` to §6 Playwright command. |
| mechanics | minor | Changed `app-harnesses.spec.js`, `app-accounts.spec.js`, and `background-settings-surfaces.spec.js` also assert horizontal scroll containment and belong in `viewer/test/firefox-specs.js`. | upheld | Added all four specs to `viewer/test/firefox-specs.js` in §5. |

### Round 4 — 2026-11-27

**Lanes:** pending

**Changed since Round 3:**
- §1.3: Switched legacy `lead`/`sub-lead` pin diff strictly to `models(hub)` (`codex/model.sh show --json`), comparing against manifest shipped defaults and `Not used` so fresh installs never trigger false notices and `WHEELCHAIR_MODELS` / `viewer/AGENTS.md:27` are honored.
- §3.3–3.4: Added explicit empty-ladder and all-`Not used` configuration wait reasons in `balancer.js` (for any role, not only pinned leads), surfaced them in `harnesses.js` and `thread.js` `waitingLine()`, updated `linkReasons()` regex in `viewer/pages/settings.js:2300` without duplicating `"in Settings"`, and updated `protocol/app/lead.md:92`.
- §5–6: Added `browser.spec.js` to §6, added `app-harnesses.spec.js`, `app-accounts.spec.js`, and `background-settings-surfaces.spec.js` to `viewer/test/firefox-specs.js`, and noted the 409/link test updates in `app-harnesses.test.js` and `app-harnesses.spec.js`.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-27: Mapper completed (`1d29e050`); created `PLAN.md` in `planning` status.
- 2026-11-27: Watch List items settled (keep `lead`/`sub-lead` tolerated in `codex/model.sh`; update `viewer/app/API.md` with new & previously omitted fields) and folded into Spec.
- 2026-11-27: Mockups v5 agreed by Collin; designer stopped; overlap check clean (no overlapping active threads); Spec completed and set to `ready-for-review`.
- 2026-11-27: Round 1 review completed (15 counted findings resolved, 1 declined, 1 rare-path accepted risk); moving to Round 2.
