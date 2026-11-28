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
| 7 | Give `sub-lead` its own provider ladder too instead of forcing sub-leads onto the thread lead's provider (superseding the `sub-lead` exclusion in Decision 6). Only `scout` and `scout-heavy` have no provider ladder (they run as built-in CLI helpers inside the lead's or sub-lead's own CLI). | Collin wants sub-leads to be able to pick their own provider order independently of the lead. | user |
| 8 | Make "Default" provider order self-explanatory in the Models UI: show what Default currently resolves to and link directly to **Usage and balancing** (`#usage`) where the global Lead and Worker provider orders are set. | Removes ambiguity about where "Default" is configured. | user |
| 9 | Move the global Lead and Worker provider orders (`lead_order`, `worker_order`) out of **Usage and balancing** into a **Provider ladders** block on **Settings → Models** (superseding the Usage and balancing link in Decision 8). Each applicable agent role can choose `Default: Lead`, `Default: Worker`, or a `Custom` provider ladder. | Puts all model and provider-picking controls in **Models**, leaves **Usage and balancing** focused on quotas and reserves, and lets any agent reuse either shared ladder. | idea-change |
| 10 | Agreed on v5 desktop and phone mockups: `docs/plans/agent-model-preferences/graphs/mockup-models-desktop-v5.html` (`1280 × 900`) and `docs/plans/agent-model-preferences/graphs/mockup-models-phone-v5.html` (`390 × 844`). | Captures all settled decisions: Agents with tier switches + 3-way provider ladders, Provider ladders block in Models, Tier models with provider tabs + inline effort pills, Escalation, and bottom Assistants block. | user |

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
     - `lead: 'lead'`
     - `'sub-lead': 'lead'`
     - `assistant: 'lead'`
     - `'project-lead': 'lead'`
     - `reviewer: 'worker'`
     - `verifier: 'worker'`
     - `mapper: 'worker'`
     - `designer: 'worker'`
   - Export a shared validator `validProviderOrder(value)` in `viewer/app/settings.js` that returns `true` iff:
     - `value === 'lead'` or `value === 'worker'`, OR
     - `Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every((v, i) => Object.hasOwn(PROVIDERS, v) || (v === 'any' && i === value.length - 1))` and at least one element is a real provider key (not `['any']` alone).
   - Also tighten `validBalancing('lead_order', value)` so `['any']` alone is rejected (must contain at least one provider, matching `validProviderOrder`).
   - In `normalize(saved)`: construct `provider_orders` by iterating over every key in `base.provider_orders` and keeping `saved.provider_orders[k]` only when `validProviderOrder(saved.provider_orders[k])` is true; otherwise fall back to `base.provider_orders[k]`. Unknown keys are dropped.
   - Include `provider_orders` in `describe(hub)` so `GET /settings` returns it alongside `other_agents`, `lead_order`, and `worker_order`.

3. **Backward compatibility for `~/.wheelchair/models` and `codex/model.sh`:**
   - Do **not** remove `lead` or `sub-lead` from `codex/model.sh`'s `SLOTS` or parser: existing `~/.wheelchair/models` files containing `lead`/`sub-lead` pins must continue to parse cleanly without triggering malformed-file fallbacks, and `codex/test/run.sh` remains untouched and green.
   - `viewer/app/settings.js` and `PUT /settings/models` continue to accept tier slots (`light`, `standard`, `heavy`, `critical`) as before; `lead` and `sub-lead` slots are no longer shown in Settings UI and are no longer read by hub session placement.

### 2. API routes and documentation (`viewer/app/routes.js`, `viewer/app/API.md`)

1. **`PUT /settings/preferences` (`viewer/app/routes.js`):**
   - `other_agents`: accept any subset of the 10 role keys in `defaults().other_agents`. Reject unknown keys or invalid tiers with `400` (`settings.tier(value, ...)`). Merge validated entries into `s.other_agents`.
   - `provider_orders`: accept a plain object containing any subset of the 8 standalone role keys (`lead`, `sub-lead`, `assistant`, `project-lead`, `reviewer`, `verifier`, `mapper`, `designer`). Reject non-object values, unknown role keys, or entries failing `validProviderOrder(value)` with `400` and a plain error message. Merge validated entries into `s.provider_orders`.
   - Include `provider_orders` in the JSON response alongside `other_agents` and all existing preference fields.
2. **`PUT /settings/balancing` (`viewer/app/routes.js`):**
   - Keep the existing contract unchanged (`lead_order`, `worker_order`, `within`, `leave`, `notify_below`, `save_for_leads`, `margin`, `held_back`, returning all balancing keys plus `reserved_provider`). The **Provider ladders** block on **Settings → Models** saves `lead_order` and `worker_order` through `PUT /settings/balancing`; the **Balancing** block on **Settings → Usage and balancing** saves `within`, `leave`, `notify_below`, `save_for_leads`, `margin`, `held_back` through `PUT /settings/balancing`.
3. **`viewer/app/API.md`:**
   - Update `GET /settings` and `PUT /settings/preferences` documentation to list all 10 `other_agents` keys (including `lead`, `sub-lead`, `assistant`, `project-lead`, and previously omitted `designer`), the new `provider_orders` object and its allowed values (`'lead'`, `'worker'`, or custom provider array), and previously omitted `project_leads`.

### 3. Session placement and model resolution (`viewer/app/balancer.js`, `viewer/app/sessions.js`)

1. **Role-to-preference mapping (`viewer/app/balancer.js`):**
   - Add helper `preferenceRole(role, thread)`:
     - If `role === 'lead'`: return `thread?.assistant ? 'assistant' : thread?.project_lead ? 'project-lead' : 'lead'`.
     - Otherwise return `role`.
   - Update `slotFor(hub, role, requestedTier = 'top', thread = null)`:
     - Compute `prefRole = preferenceRole(role, thread)`.
     - If `prefRole` is one of `['lead', 'sub-lead', 'assistant', 'project-lead', 'reviewer', 'verifier', 'mapper', 'designer']`, load settings and return `settings.other_agents[prefRole]` (a work tier: `light | standard | heavy | critical`).
     - Otherwise (`worker` or other), keep existing `requestedTier` mapping (`haiku -> light`, `sonnet -> standard`, `opus -> heavy`, `top -> heavy`).
2. **Model resolution (`viewer/app/sessions.js`):**
   - Update `resolveModel(hub, cli, role, requestedTier = 'top', thread = null)` to pass `thread` to `slotFor(hub, role, requestedTier, thread)`.
   - Update the call site in `startSession` (`sessions.js:364`) to pass `thread`: `resolveModel(hub, cli, role, input.tier, thread)`.
   - Keep `sessions.js:363` (`if (role === 'lead' && !thread.provider) { thread.provider = selection.provider; thread.cli = cli; }`) so starting a `sub-lead` on a different provider never overwrites `thread.provider`.
   - Keep `resolveScout(hub, selection.provider, ...)` (`sessions.js:370-371`) so a `sub-lead` resolves its scouts on its own chosen provider (`selection.provider`).
3. **Provider order resolution (`viewer/app/balancer.js`):**
   - Add helper `expandOrder(entry, settings)`:
     - If `entry === 'lead'`: return `settings.lead_order.flatMap((p) => p === 'any' ? settings.worker_order : [p])`.
     - If `entry === 'worker'`: return `[...settings.worker_order]`.
     - If `Array.isArray(entry)`: return `entry.flatMap((p) => p === 'any' ? settings.worker_order : [p])`.
   - In `choose(hub, thread, role, tier, constraints)`:
     - Call `slotFor(hub, role, tier, thread)`.
     - For `role === 'lead'` when `thread.provider` is already set (continuing/restarting an existing thread's lead): keep `[thread.provider]` and keep the disabled-harness wait check (`if (role === 'lead' && thread.provider && !settings.harnesses[thread.provider]) return { wait: ... }`).
     - For `role === 'lead'` when `!thread.provider` (new thread lead, new Personal assistant, new Project lead): use `expandOrder(settings.provider_orders[preferenceRole(role, thread)], settings)`.
     - For `role === 'sub-lead'`: **remove** the `[thread.provider]` lock and its `thread.provider` disabled-harness check; always use `expandOrder(settings.provider_orders['sub-lead'], settings)`.
     - For `role` in `['reviewer', 'verifier', 'mapper', 'designer']`: use `expandOrder(settings.provider_orders[role], settings)`.
     - For `role === 'worker'`: unchanged (`[...settings.worker_order]`).
     - For `reviewer` and `verifier`: when `effectiveFamilies(...)` returns a single family (`strictReview`), that single family still takes precedence over the per-role ladder; when it is `'both'`, the per-role ladder orders candidate providers while honoring `provider` / `not_provider` constraints.
     - Keep `reservedProvider` (`balancer.js:24-27`), `heldBack` (`balancer.js:49-51`), and `save_for_leads` (`balancer.js:106`) unchanged: `lead` and `sub-lead` are not held back, and `reservedProvider` still uses `settings.lead_order`.
   - Also check `choose` / `slotFor` call sites across `viewer/app/` (e.g. `sessions.js`, `assistant.js`, `project-lead.js`, `balancer.js`) so every call passes `thread` when resolving a model or slot.

### 4. Reworked Settings → Models & Usage and balancing UI (`viewer/pages/settings.js`, `viewer/pages/settings.css`)

Match the agreed v5 desktop (`1280 × 900`) and phone (`390 × 844`) mockups in visual hierarchy, spacing, controls, and responsive behavior:

1. **Category definitions (`viewer/pages/settings.js`):**
   - `usage`: `line: 'Usage and reserves'`, `blocks: ['usage', 'balancing']`. Remove `'lead-order'` block and remove the `'Workers try first'` (`worker_order`) row from `renderBalancing()`. Update `#bal-save` to save `['within', 'leave', 'notify_below', 'save_for_leads', 'margin', 'held_back']` (never overwriting `worker_order` or `lead_order`).
   - `models`: `line: 'Agents, provider ladders, tiers and escalation'`, `blocks: ['agents', 'ladders', 'tiers', 'escalation', 'assistants']`. Remove the old `renderLeadModels()` and `renderOthers()` blocks.

2. **Agents block (`agents`):**
   - Heading: `Agents`, subtitle: `Choose a tier for each role. Models depend on the provider used.`
   - Roles in order:
     1. `Leads` (`lead`)
     2. `Sub-leads` (`sub-lead`)
     3. `Plan reviewers` (`reviewer`)
     4. `Checker` (`verifier`)
     5. `Reviewers and checkers` family mix row (`review_families` segmented control: `Mix families` plus each enabled `reviewFamily` provider, same behavior and hint text as today)
     6. `Code mapping` (`mapper`)
     7. `Mockups` (`designer`)
     8. `Scout` (`scout`, hint/note: runs on the lead's provider — no provider ladder control)
     9. `Scout for bigger changes` (`scout-heavy`, hint/note: runs on the sub-lead's provider — no provider ladder control)
   - Each role row displays:
     - Role title and a live resolved model preview line showing what that role's selected tier resolves to across enabled providers (e.g. `Claude: claude-opus-4-6 · GPT: gpt-5.4 (high)` — omitting providers set to `Not used` for that tier; showing `No provider set for this tier` if all enabled providers are `Not used`). Changing any tier model/effort or toggling a role's tier updates affected previews immediately.
     - A 4-way segmented tier control (`role="radiogroup"`, `Light | Standard | Heavy | Critical`) that saves immediately via `PUT /settings/preferences` (`{ other_agents: { [role]: tier } }`). On failure, restores the previous tier and shows an inline error on that row.
     - For every role except `scout` and `scout-heavy`: a collapsible provider ladder control (`<details>` / disclosure trigger):
       - Closed summary label shows `Default: Lead`, `Default: Worker`, or `Custom: <Prov1> → <Prov2>…` (only listing enabled providers in the summary, plus `→ any` if `'any'` is enabled).
       - Opening the disclosure shows a 3-way segmented mode switch (`Default: Lead | Default: Worker | Custom`):
         - Clicking `Default: Lead` or `Default: Worker` saves immediately via `PUT /settings/preferences` (`{ provider_orders: { [role]: 'lead' | 'worker' } }`).
         - Clicking `Custom` initializes the custom list from the role's current effective order (if switching from `Default: Lead` or `Default: Worker`, copies `lead_order` or `worker_order` filtered/preserved so switched-off providers keep their positions, or all enabled providers) and saves immediately, then renders the ordered list of enabled providers with `↑`, `↓`, `Remove` (disabled/hidden when only 1 enabled provider remains), `+ <Provider>` buttons for omitted enabled providers, and a `"then whatever's left"` checkbox (`'any'` tail). Every reorder, add, remove, or tail toggle saves immediately via `PUT /settings/preferences` (`{ provider_orders: { [role]: nextArray } }`), reverting and showing an inline error on failure. Keep the disclosure open across repaints while editing that role's ladder.

3. **Provider ladders block (`ladders`):**
   - Heading: `Provider ladders`, subtitle explaining that `Lead ladder` and `Worker ladder` are the shared defaults (and workers always use the Worker ladder).
   - Two columns on desktop (stacked on phone `< 900px`):
     - **Lead ladder** (`lead_order`): ordered list of enabled providers with `↑`, `↓`, `Remove` (when > 1 enabled provider), `+ <Provider>` buttons for omitted enabled providers, and `"then whatever's left"` checkbox (`'any'` tail). Preserves switched-off providers' relative indices in the saved array (matching existing `orderEditor` behavior).
     - **Worker ladder** (`worker_order`): same controls, without `"then whatever's left"`.
   - Every change saves immediately via `PUT /settings/balancing` (`{ lead_order }` or `{ worker_order }`), updates `data.lead_order` / `data.worker_order` / `data.reserved_provider`, shows the section saved status note (`Saved, applies to new sessions`), and reverts with an inline error on failure.

4. **Tier models block (`tiers`):**
   - Heading: `Tier models` (keeping `#tiers` anchor / section id).
   - Show any global heads-up lines (`malformed`, `tierless`) at the top of the block as before.
   - Provider tabs (`role="tablist"`) for **enabled providers only** (`PROVIDERS.filter(([p]) => harnessOn(p))`). Keep the active tab in page state (defaulting to the first enabled provider; if the active provider is disabled, fall back to the first enabled provider). If no providers are enabled, show a brief empty message pointing to AI providers.
   - Below the tabs, render the active provider's 4 tiers (`Light`, `Standard`, `Heavy`, `Critical`) as clean rows:
     - Tier name and description (`Spelled-out changes, few files`, `Most building`, `Leading, planning, review, checking`, `Can't afford to get wrong`).
     - Model `<select>` with the provider's options, `Not used`, and `Other…` (opening the inline text input + `Use` button with existing regex validation and error display).
     - For providers with effort levels (`EFFORTS[provider]`): inline segmented effort pills (`role="radiogroup"`, `CLI default` plus the model's supported effort levels, disabled when model is `Not used` or the model supports no effort levels `levels.length === 0`) instead of a second `<select>` dropdown. Clicking a pill saves immediately via `PUT /settings/models` and refreshes models/options (`refreshModels`), preserving the active provider tab and updating Agent/Assistant live model previews.
     - For providers with `modelHeadsUp` (GPT), render any tier-specific `newer`/`available` heads-up banner (`Switch` / `Skip`) inline under that tier row, repainting cleanly on action.

5. **Escalation block (`escalation`):**
   - Keep the existing `Escalation` block (live `escalation_text` summary + 4 segmented rows: `What steps up first`, `Highest effort`, `Highest tier`, `Ask me before`) styled cleanly to match the v5 mockup.

6. **Assistants block (`assistants`):**
   - Heading: `Assistants`, subtitle: `Choose models for conversations outside a thread's build.`
   - Two rows: `Personal assistant` (`assistant`) and `Project leads` (`project-lead`), using the exact same row component as **Agents** (live model preview, 4-way segmented tier switch, and collapsible 3-way provider ladder control).

7. **Responsive & accessibility rules:**
   - Must match `mockup-models-desktop-v5.html` at desktop widths (`>= 900px`) and `mockup-models-phone-v5.html` at phone widths (`<= 899px`), with no horizontal overflow and comfortable tap targets on phone.
   - Preserve semantic ARIA labels (`aria-label` on tier radiogroups, model selects, effort radiogroups, provider tabs `role="tab"`/`aria-selected`, and ladder controls) so keyboard navigation and Playwright tests remain reliable.

### 5. Non-goals and boundaries

- Do not remove `lead` or `sub-lead` slots from `codex/model.sh`.
- Do not change how usage polling, account ranking, or `save_for_leads` / `held_back` forecasting work in `viewer/app/usage.js` or `viewer/app/usage-poll.js`.
- Do not redesign unrelated Settings categories (only remove the moved provider-order controls from **Usage and balancing** and update its subtitle).
- Update existing unit and Playwright tests that asserted on the removed `lead-models` block, the moved `lead-order`/`worker_order` blocks in Usage and balancing, or the old `sub-lead` lock to `thread.provider`, and add new unit and browser tests covering all new behaviors (10 agent tiers, `provider_orders` validation/normalization/placement, `sub-lead`/`assistant`/`project-lead` tier & ladder resolution, provider tabs, effort pills, live previews, and phone layout).

### 6. Validation commands

Targeted unit and browser tests covering the changed areas (the full test suite runs before push):

- `node --test viewer/test/app-settings.test.js`
- `node --test viewer/test/app-balancer.test.js`
- `node --test viewer/test/char-settings-defaults.test.js`
- `node --test viewer/test/app-kimi-settings.test.js`
- `node --test viewer/test/app-openrouter-settings.test.js`
- `node --test viewer/test/app-assistant.test.js`
- `node --test viewer/test/project-lead.test.js`
- `npx --prefix viewer playwright test viewer/test/app-settings.spec.js`

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-27

**Lanes:** pending

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

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
