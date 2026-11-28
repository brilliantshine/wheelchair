---
slug: settings-live-refresh
status: ready-for-review
created: 2026-11-28
---

# Auto-refresh an open Settings page when settings change

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

*(None — all planning questions settled.)*

## Watch List

*(Empty — peer overlap check for `11c53653de4e` moved to Log per lead rules: never wait on another lead; a late reply will be handled by the late-overlap rule.)*

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Skip designer mockups for this feature | Only visible addition is a compact inline note and Load latest button reusing existing Settings page styles; no new screen or layout redesign | defaulted |
| 2 | Track external changes with a lightweight hub revision endpoint (`GET /wheelchair/api/settings/revision`) returning restart-safe `<boot-id>:<seq>` tokens per domain, polled every 5 seconds via `window.wcPoller` (paused when hidden), fetching full data only when a token changes | Keeps idle tabs cheap (zero `model.sh` subprocesses or machine calls when unchanged) and prevents revision collisions after a hub restart | defaulted |
| 3 | Preserve typed edits with a clear conflict note if saving a lesson fails because it was removed externally (HTTP 409) | Matches existing lesson import/action draft retention and ensures user text is never silently wiped | defaulted |
| 4 | When an external change arrives while a section has unsaved edits, keep the draft untouched and show an inline "Updated elsewhere" note with a one-tap "Load latest" button (Save still saves the draft as usual) | Gives a one-tap way on a phone to pull in external changes without manually undoing a draft or reloading the whole page, while never blocking Save | user |
| 5 | Drop the redundant `background` revision domain (keep `background.js`'s existing 10 s/focus/visibility poller with `syncBackground` dirty/focus guards); narrow `blockFocused` to `'input, textarea, select, [contenteditable]'` and use `repaint()` (`swapKeepingFocus`) for buttons/summaries; track `renderedSlice` per block and editor baselines (`styleBaseline`, `balBaseline`, `draftBaseline`, `lessonEdit.baseList`, `backgroundVisit.baseRevision`) | Removes duplicate background polling machinery, prevents a clicked Save/toggle button from holding stale values across tab switches, and makes dirty detection and snapshot reconciliation immune to `data` replacement and whole-page reloads | review-round-1 |

## Spec

### §1. Hub revision tracking (`viewer/app/hub.js`, `viewer/app/settings.js`, `viewer/app/routes.js`, `viewer/app/diagram-sensitivity.js`, `viewer/app/API.md`)

1. **Per-boot revision state on `Hub` (`viewer/app/hub.js`)**
   - In `Hub` constructor, generate a per-boot random id `this.settingsBootId = crypto.randomBytes(6).toString('hex')` and initialize `this.settingsRevs = { settings: 0, diagram: 0, shared_keys: 0 }`.
   - Add two methods on `Hub`:
     - `settingsRevisions()`: returns `{ settings: `${this.settingsBootId}:${this.settingsRevs.settings}`, diagram: `${this.settingsBootId}:${this.settingsRevs.diagram}`, shared_keys: `${this.settingsBootId}:${this.settingsRevs.shared_keys}` }`.
     - `bumpSettingsRevision(domain = 'settings')`: increments `this.settingsRevs[domain]` (if `Object.hasOwn(this.settingsRevs, domain)`) and returns `${this.settingsBootId}:${this.settingsRevs[domain]}`.
   - Because `settingsBootId` is fresh on every `new Hub(...)`, a hub restart produces new tokens across all domains so open Settings tabs refresh cleanly and never collide with a cached counter.
   - Background appearance continues to use `viewer/pages/background.js`'s existing 10 s / focus / visibility poller and persisted `background.revision` (no duplicate `background` hub revision domain).

2. **Revision endpoint and stamped `GET /settings` (`viewer/app/routes.js`, `viewer/app/API.md`)**
   - Add `GET /wheelchair/api/settings/revision` in `handleSettings` (`bits[1] === 'revision' && bits.length === 2 && request.method === 'GET'`), returning HTTP `200` with `hub.settingsRevisions()`. This route performs zero disk I/O, zero `model.sh` subprocesses, and zero machine calls.
   - In `GET /wheelchair/api/settings` (`routes.js:265`), capture `const settings_revision = hub.settingsRevisions().settings;` **before** awaiting `settings.describe(hub)` and `settings.load(hub)`, and include `settings_revision` in the JSON response object. Stamping before async reads guarantees that a write landing mid-`describe()` leaves the returned snapshot tagged with the older revision so the next poll detects the newer revision and refreshes again.
   - Document `GET /settings/revision` and `settings_revision` on `GET /settings` in `viewer/app/API.md`.

3. **Write sites that bump revisions**
   - `settings` domain:
     - Inside `settings.update(hub, change)` (`viewer/app/settings.js:428`), call `hub.bumpSettingsRevision('settings')` immediately after `hub.state.updateSettings(...)` resolves. This covers every `settings.json` mutation (harnesses, accounts, balancing, models `PUT`, heads-up `switch`, preferences, saved-dirs, templates, style, lessons save/restore/keep/waiting/import/merge, and all assistant `setting` actions routed through `routes.invokeSettings`).
     - In `POST /settings/models/heads-up` (`viewer/app/routes.js:394`), for `skip` and `reset` (which invoke `settings.modelCommand` without `settings.update`), call `hub.bumpSettingsRevision('settings')` immediately after `settings.modelCommand` succeeds.
   - `diagram` domain:
     - Inside `diagramSensitivity.write(hub, body)` (`viewer/app/diagram-sensitivity.js:45-49`), call `hub.bumpSettingsRevision('diagram')` whenever at least one machine succeeded (`Object.values(machines).some((m) => !m.error)`). This covers both browser `POST /settings/diagram-sensitivity` and assistant `diagram-sensitivity` writes, including partial multi-machine updates.
   - `shared_keys` domain:
     - In `viewer/app/routes.js` (`POST /shared-keys/save` and `POST /shared-keys/remove`), call `hub.bumpSettingsRevision('shared_keys')` when the machine response is 2xx.

### §2. Client save ordering, snapshot monotonicity, and polling (`viewer/pages/settings.js`)

1. **Settings-scoped write guard and monotonic snapshot acceptance**
   - Track `let localWriteGen = 0;` and `let inFlightWrites = 0;` with helper:
     ```js
     async function withLocalWrite(fn) {
       localWriteGen += 1;
       inFlightWrites += 1;
       try { return await fn(); }
       finally { localWriteGen += 1; inFlightWrites -= 1; }
     }
     ```
   - Scope `withLocalWrite` strictly to Settings-domain mutations (never account sign-in POSTs under `/accounts/.../signin` or read-only POSTs `/settings/style/preview`, `/project-tools/read`, `/shared-keys/read`, `/usage/seen`):
     - Inside `api(path, opts)` when `opts && opts.method && opts.method !== 'GET'` and `(path.startsWith('/settings') && path !== '/settings/style/preview') || path === '/shared-keys/save' || path === '/shared-keys/remove'`.
     - Wrap full save-plus-reread handlers (`saveTemplate`, `duplicateTemplate`, `deleteTemplate`, `toggleTemplate`, `saveLessons`, lesson import raw `fetch`, account add/edit/delete/restore rereads, and `saveBackground` raw `fetch`) so `inFlightWrites` stays > 0 across both the write and its immediate follow-up `reload()` / `api('/settings')`.
   - Add `parseRev(token)` parsing `<boot>:<seq>` into `{ boot, seq }` (or `null`), and one monotonic snapshot helper `applySettingsSnapshot(next, { reconcile = true } = {})`:
     - If `data?.settings_revision` and `next?.settings_revision` share the same `boot` and `next.seq < data.seq`, discard `next` and return `false` (an older snapshot can never roll back a newer one).
     - Otherwise set `data = next;`, update `if (next.settings_revision) lastRev.settings = next.settings_revision;`, and if `reconcile`, run `reconcileVisibleBlocks()` (§3) against `renderedSlice` so even a whole-page `reload()` after a local save surfaces any external changes that arrived in the same snapshot. Return `true`.
   - `reload(keep)` fetches `GET /settings` and applies it through `applySettingsSnapshot(fresh, { reconcile: true })`. If `applySettingsSnapshot` returns `false` (a newer snapshot already landed), `data` already holds the newer state so callers proceed safely using `data`. Account add/edit/delete/restore rereads also go through `reload(false)`.

2. **Lightweight polling loop via `window.wcPoller`**
   - Maintain `let lastRev = { settings: null, diagram: null, shared_keys: null };` and `let pollRunning = false;`.
   - On initial page load (`settings.js:2914`), fetch `GET /settings` (required) and `GET /settings/revision` (best-effort: if it fails, leave `lastRev = { settings: data.settings_revision || null, diagram: null, shared_keys: null }` so the first successful poll initializes it instead of breaking page load). Start one `window.wcPoller(pollSettings, 5000)` (pauses while hidden and fires once on tab visible).
   - On each `pollSettings()` tick:
     1. Return immediately if `!data || pollRunning || inFlightWrites > 0`.
     2. Set `pollRunning = true` and `const startGen = localWriteGen;`.
     3. Fetch `const rev = await api('/settings/revision');` (on network error, return silently and retry on next tick).
     4. If `inFlightWrites > 0 || localWriteGen !== startGen`, return without mutating state.
     5. Process each domain in its own independent `try { ... } catch {}` block so a failure in one domain never blocks the others on the same tick, and acknowledge each token **only after** its secondary read succeeds:
        - **`settings` (`rev.settings !== lastRev.settings`)**:
          - Fetch `const next = await api('/settings');`.
          - Re-check `if (inFlightWrites > 0 || localWriteGen !== startGen)` -> abort this domain without mutating `data` or `lastRev.settings`.
          - Capture `const prev = data;` before `applySettingsSnapshot(next, { reconcile: true })`.
          - If `applySettingsSnapshot` accepted `next`:
            - If `section === 'providers'` and (`JSON.stringify(prev.harnesses) !== JSON.stringify(next.harnesses)` or `JSON.stringify(prev.accounts) !== JSON.stringify(next.accounts)`), call `refreshStatus()`.
            - If `section === 'usage'`: if `accounts` or `harnesses` changed, call `refreshUsage()`; if any balancing key or `provider_orders` / `lead_order` / `worker_order` changed, call `readReserved()`.
            - If `section === 'shared-tools'` and `JSON.stringify(prev.saved_dirs) !== JSON.stringify(next.saved_dirs)`, reset `sharedProjects = null` and call `loadSharedProjects()`.
            - If `section === 'shared-tools'` and `prev.shared_tools_repo !== next.shared_tools_repo`, trigger `refreshSharedKeys(null)` (guarded by §3).
        - **`diagram` (`rev.diagram !== lastRev.diagram`)**:
          - If `!youShown()`: set `diagram = null; lastRev.diagram = rev.diagram;` so entering `you` fetches fresh.
          - If `youShown()`: call `const ok = await loadDiagram({ fromRefresh: true });` — `loadDiagram()` returns `true` only when `GET /settings/diagram-sensitivity` succeeded (not caught error); only then set `lastRev.diagram = rev.diagram;`.
        - **`shared_keys` (`rev.shared_keys !== lastRev.shared_keys`)**:
          - If `section !== 'shared-tools'`: set `lastRev.shared_keys = rev.shared_keys;`.
          - If `section === 'shared-tools'`: call `refreshSharedKeys(rev.shared_keys)` (which calls `readKeys({ fromRefresh: true })` when clean and unfocused, advancing `lastRev.shared_keys = rev.shared_keys` only on success; if focused, defers in `deferredBlocks` without advancing `lastRev.shared_keys`; if dirty, marks `staleBlocks.add('shared-tools')` and shows `.stale-banner` without advancing `lastRev.shared_keys` until loaded or saved).
     6. In `finally`, set `pollRunning = false`.

### §3. Uniform per-block rendered slices, editor baselines, focus/dirty guards, and "Updated elsewhere" banner (`viewer/pages/settings.js`, `viewer/pages/settings.css`)

1. **Focus guard (`blockFocused(name)`)**
   - Returns `true` when `document.activeElement` is inside `blockHost(name)` and matches `'input, textarea, select, [contenteditable]'`.
   - Buttons, `<summary>` disclosures, and links are intentionally excluded so clicking Save or a toggle (or switching tabs and returning) never freezes stale values in a clean block; clean repaints use `repaint(name)` (`swapKeepingFocus`) so keyboard focus on `[data-focus]` controls is restored in place.

2. **Editor baselines and dirty guard (`blockDirty(name)`)**
   - Every editor compares against the **baseline it was built from**, never against live `data` (so updating `data` before or during reconciliation never makes an untouched editor look dirty):
     - `name`: `nameDraft !== null && nameDraft !== nameBaseline` (set `nameBaseline = data.user_name || ''` when `nameRow` initializes or saves).
     - `writing`: store `styleBaseline = structuredClone(data.style)` whenever `styleDraft` is initialized or saved; dirty when `styleDraft !== null && JSON.stringify(currentStyle()) !== JSON.stringify(styleBaseline)` (`currentStyle()` already includes any non-empty `pending` "Never say" input).
     - `balancing`: store `balBaseline = ...` (cloned keys `within`, `leave`, `notify_below`, `save_for_leads`, `margin`, `held_back`) inside `ensureDraft()` and after `saveBalancing()`; dirty when `balDraft !== null && ['within', 'leave', 'notify_below', 'save_for_leads', 'margin', 'held_back'].some((k) => JSON.stringify(balDraft[k]) !== JSON.stringify(balBaseline[k]))`.
     - `templates` (holds both Templates and Lessons under `behavior`):
       - When `isLessons(selected)`: store `lessonEdit.baseList = structuredClone(lessonList(role))` in `select('lessons:...')` and after `saveLessons()`. `lessonDirty()` compares `lessonEdit.texts[item.id]` against `item.text` in `lessonEdit.baseList` (plus `lessonEdit.removals.size > 0`). Dirty when `lessonDirty() || Boolean(lessonEdit?.confirming) || Boolean(lessonEdit?.saving)`.
       - When a template or `'new'` is selected: store `draftBaseline = structuredClone(draft)` in `select(id)`. Dirty when `confirming || JSON.stringify(draft) !== JSON.stringify(draftBaseline)`. An unedited open template editor is clean and refreshes automatically.
     - `thread-view`: `folderDraft !== null && folderDraft !== folderBaseline` (set `folderBaseline = data.default_project_folder || ''` when `folderRow` initializes or saves).
     - `tiers`: `Boolean(blockHost('tiers')?.querySelector('.other input'))` (custom "Other" model input open).
     - `accounts`: separate `accountsDirty()` from focus: `Boolean(editing || adding || (signCard && signCard.waiting && signCard.el.isConnected && blockHost('accounts')?.contains(signCard.el)))`. (`accountsBusy()` remains for existing usage-polling callers or delegates to `accountsDirty() || blockFocused('accounts')`.)
     - `harnesses`: `Boolean(hz.confirmOff)`.
     - `background`: `Boolean(backgroundVisit && (backgroundVisit.dirty || backgroundVisit.pending || backgroundVisit.saving))`.
     - `shared-tools`: any `<input>` inside `blockHost('shared-tools')` with non-empty `.value` (password key values or new key name/value inputs).
     - `diagrams`, `usage`, `agents`, `ladders`, `escalation`, `assistants`, `conversations`, `permission`, `lead-names`: `false` (immediate-save or read-only; protected by `blockFocused`).
   - `enter` (browser-only) and `tools` (Project tools, out of scope per `IDEA.md`) are never touched by external refresh.

3. **Per-block rendered slice tracking (`renderedSlice` & `blockSlice(name, d)`)**
   - Maintain `const renderedSlice = new Map();`. Inside `paint(name)`, record `renderedSlice.set(name, JSON.stringify(blockSlice(name, data)))` (and if `staleBlocks.has(name)`, append/prepend the `.stale-banner` so any independent repaint such as `refreshUsage()` never drops an active banner).
   - Define `stripVolatileTemplate(t)` returning `{ id: t.id, name: t.name, role: t.role, scope: t.scope, switches: t.switches, text: t.text, in_use: t.in_use }` (omitting `live_sessions` and `scope_missing` so thread starts/stops never trigger false "Updated elsewhere." banners).
   - Exact `blockSlice(name, d)` per block:
     - `name`: `d.user_name`
     - `writing`: `[d.style, d.style_version]`
     - `harnesses`: `d.harnesses`
     - `accounts`: `[d.accounts, d.harnesses]`
     - `usage`: `[d.accounts, d.harnesses]`
     - `balancing`: `[d.within, d.leave, d.notify_below, d.save_for_leads, d.margin, d.held_back, d.reserved_provider]`
     - `agents`: `[d.models, d.provider_orders, d.lead_order, d.worker_order, d.other_agents, d.review_families, d.harnesses, d.legacy_lead_diffs, d.lead_tier_notice_dismissed]`
     - `ladders`: `[d.lead_order, d.worker_order, d.harnesses]`
     - `tiers`: `[d.models, d.model_options, d.heads_up, d.harnesses]`
     - `escalation`: `[d.escalation, d.escalation_text]`
     - `assistants`: `[d.models, d.provider_orders, d.lead_order, d.worker_order, d.other_agents, d.harnesses]`
     - `conversations`: `[d.assistant, d.project_leads]`
     - `thread-view`: `[d.tool_steps, d.auto_merge, d.auto_merge_delete_branch, d.default_project_folder]`
     - `permission`: `[d.permission_mode, d.codex_mode, d.aside_access]`
     - `lead-names`: `[d.lead_name_list, d.lead_names]`
     - `templates`: `[(d.templates || []).map(stripVolatileTemplate), d.lessons, d.lesson_history, d.lesson_waiting]` (omits `d.projects`)
     - `shared-tools`: `[d.shared_tools_repo, d.saved_dirs]`
   - On category entry (`renderCategory()`): before painting the category's blocks, reset any clean editor cache whose underlying data may have changed while the category was closed (`if (!blockDirty('writing')) styleDraft = null;`, `if (!blockDirty('balancing')) balDraft = null;`, `if (!blockDirty('name')) nameDraft = null;`, `if (!blockDirty('thread-view')) folderDraft = null;`, `if (!blockDirty('templates') && selected && !isLessons(selected) && selected !== 'new') select(data.templates.some((t) => t.id === selected) ? selected : (data.templates[0]?.id || 'new'))`).

4. **Reconciliation rules (`reconcileVisibleBlocks()` & secondary read completion guards)**
   - Maintain `const deferredBlocks = new Set();` and `const staleBlocks = new Set();`.
   - For each block `name` in the active category (except `enter` and `tools`): if `renderedSlice.get(name) !== JSON.stringify(blockSlice(name, data))`:
     - **Clean and unfocused (`!blockDirty(name) && !blockFocused(name)`)**:
       - Reset clean draft caches (`styleDraft = null` for `writing`; `balDraft = null` for `balancing`; `nameDraft = null` for `name`; `folderDraft = null` for `thread-view`; for `templates`: if `!isLessons(selected) && selected !== 'new'`, `select(data.templates.some((t) => t.id === selected) ? selected : (data.templates[0]?.id || 'new'))`, and if `isLessons(selected)`, refresh `lessonEdit.baseList = structuredClone(lessonList(lessonEdit.role))`).
       - Clear `deferredBlocks.delete(name)` and `staleBlocks.delete(name)`.
       - Call `repaint(name)` (which uses `swapKeepingFocus`).
     - **Clean and focused (`!blockDirty(name) && blockFocused(name)`)**:
       - Do not repaint now. Add `name` to `deferredBlocks`.
     - **Dirty (`blockDirty(name)`)**:
       - Do not repaint and do not overwrite the draft.
       - Add `name` to `staleBlocks` and ensure a compact inline `.stale-banner` (`role="status"`) is shown at the top of `blockHost(name)` without rebuilding existing form controls:
         - Text: `Updated elsewhere.`
         - Button: `<button type="button" class="small">Load latest</button>`
   - **Deferred block resolution (`focusout` and `input` on `panel`)**:
     - On `input` inside a block in `deferredBlocks`: if `blockDirty(name)` is now true, move `name` from `deferredBlocks` to `staleBlocks` and render `.stale-banner` immediately so the user never misses the external update after typing.
     - On `focusout` on `panel` (checked via `queueMicrotask`): for each `name` in `deferredBlocks`, if `!blockFocused(name)`:
       - Remove `name` from `deferredBlocks`.
       - If `blockDirty(name)`: add `name` to `staleBlocks` and render `.stale-banner`.
       - Else: run the clean repaint path from current `data` (and for `diagrams`, call `drawDiagram()`; for `shared-tools`, call `readKeys({ fromRefresh: true })`; for `background`, `repaint('background')`; for `harnesses`, `repaint('harnesses')`).
   - **Clicking `Load latest` on `.stale-banner`**:
     - Discards that block's draft (`nameDraft = null`, `folderDraft = null`, `styleDraft = null`, `balDraft = null`, `editing = null; adding = null;` for `accounts`, `hz.confirmOff = null;` for `harnesses`, `select(...)` for `templates`/`lessons`, `discardBackground(); bg.refresh(); ensureBackground();` for `background`, clear inputs + `readKeys({ fromRefresh: false })` for `shared-tools`, remove `.other` for `tiers`), clears `staleBlocks.delete(name)` and `deferredBlocks.delete(name)`, and repaints `name` from current `data` (and advances `lastRev.shared_keys` when `readKeys` succeeds).
   - **Clicking `Save` on a stale block**:
     - Proceeds as normal and clears `staleBlocks.delete(name)` and `deferredBlocks.delete(name)` on success.
   - **Switching categories (`readHash` when `leaving` is true)**:
     - Clears `deferredBlocks` and `staleBlocks`.
   - **Secondary read completion guards** (every async completion checks guards at render time, not only before starting):
     - `loadDiagram({ fromRefresh = false } = {})`: on response, store `diagram = next`; if `fromRefresh && blockFocused('diagrams')`, add `'diagrams'` to `deferredBlocks` instead of calling `drawDiagram()`; otherwise call `drawDiagram()`. Return `true` on HTTP 200 and `false` on error.
     - `loadHarnesses()`: when repainting `harnesses` on success or error, if `blockDirty('harnesses')` add `'harnesses'` to `staleBlocks` and show `.stale-banner`; if `blockFocused('harnesses')` add `'harnesses'` to `deferredBlocks`; otherwise `repaint('harnesses')`.
     - `loadSharedProjects()`: persist the selected machine in module state (`let sharedMachine = 'hub'`, updated on machine `<select>` change) so `paint('shared-tools')` restores `machine.value = sharedMachine` instead of resetting to `'hub'`. Before calling `paint('shared-tools')` on completion, if `blockDirty('shared-tools')` show `.stale-banner` and skip repaint; if `blockFocused('shared-tools')` defer in `deferredBlocks`; otherwise `repaint('shared-tools')`.
     - `readKeys({ fromRefresh = false } = {})`: on both success and `catch` error, if `fromRefresh && blockDirty('shared-tools')`, mark `staleBlocks.add('shared-tools')` and show `.stale-banner` without calling `paintKeys()` or replacing `keyHost`; if `fromRefresh && blockFocused('shared-tools')`, add `'shared-tools'` to `deferredBlocks` without painting; otherwise paint as usual.
     - `syncBackground(state)`:
       - In `selectBackground(v, file)`, capture `v.baseRevision = bg.current().metadata?.revision ?? null` when setting `v.pending = true` so `baseRev = v.dirty ? v.revision : v.baseRevision` is always defined during decoding.
       - In `syncBackground(state)`: let `incomingRev = state?.metadata?.revision`; if `v && (v.dirty || v.pending || v.saving)`: only if `incomingRev != null && baseRev != null && incomingRev !== baseRev`, add `'background'` to `staleBlocks` and show `.stale-banner` without repainting (never on unchanged poll notifications). If clean and `v.renderedState !== backgroundStateKey(state)`: if `blockFocused('background')`, add `'background'` to `deferredBlocks`; else `repaint('background')`.

### §4. Draft-preserving 409 recovery in `saveLessons()` and Shared-key `change()` (`viewer/pages/settings.js`)

1. **`saveLessons()` (`settings.js:1264-1289`)**
   - Build `edits` by iterating over `lessonEdit.baseList` (the lessons the editor was built from), NOT live `data.lessons[role]`, so an external removal observed by a prior poll still submits the edited id and receives HTTP 409 instead of being silently omitted.
   - When `PUT /settings/lessons/:role` fails with `e.status === 409`:
     1. Preserve `prevTexts = { ...lessonEdit.texts }`, `prevRemovals = new Set(lessonEdit.removals)`, and `prevBase = lessonEdit.baseList`.
     2. Call `await reload(false);` to load the current server lessons for `role`.
     3. Build `survivingIds = new Set(lessonList(role).map((item) => item.id))`.
     4. Reset `lessonEdit.baseList = structuredClone(lessonList(role))`, retain `lessonEdit.texts` for `id` in `survivingIds`, and retain `lessonEdit.removals` for `id` in `survivingIds`.
     5. Collect edited texts for ids in `prevBase` where `!survivingIds.has(id)` and `prevTexts[id] !== undefined && prevTexts[id] !== prevBaseItem.text`.
     6. Clear `lessonEdit.saving = false`, clear `staleBlocks.delete('templates')`, repaint `templates`, and display an inline error message naming the removed lesson edit text(s) so Collin can copy or re-add them (matching `lessonAction` and lesson import).

2. **Shared-key `change()` 409 recovery (`settings.js:2738-2749`)**
   - On `error.status === 409` in `shared-tools` `change()`:
     1. Before calling `await readKeys({ fromRefresh: false })`, snapshot all non-empty inputs inside `keyHost`: existing key password inputs keyed by `.pt-key[data-key]` plus the new-key name and value inputs inside `.pt-addkey`.
     2. Call `await readKeys({ fromRefresh: false })` to refresh the machine-store `revision` and key list.
     3. Restore the snapshotted values into matching rebuilt inputs (and `.pt-addkey` name/value inputs) so Collin's typed key values are preserved and can be saved immediately against the fresh revision, and prepend the 409 alert message at the top of `keyHost`.

### §5. Validation

Targeted commands covering all touched files (full-run is handled before push per `AGENTS.md`):

1. **Node unit/API tests:**
   ```bash
   node --test viewer/test/app-settings.test.js viewer/test/app-diagram-sensitivity.test.js machine/test/name-guard.test.js
   ```
   Required assertions to add:
   - `GET /wheelchair/api/settings/revision` returns `{ settings, diagram, shared_keys }` tokens with `<bootId>:<seq>` format.
   - Mutating `settings` (e.g., `PUT /settings/preferences`, `POST /settings/models/heads-up` `skip`/`reset`), `diagram` (`POST /settings/diagram-sensitivity`, including partial failure where at least one machine succeeded), and `shared_keys` each bump only their respective counter.
   - `GET /wheelchair/api/settings` includes `settings_revision` captured before `settings.describe(hub)` starts (never stamped with a write that occurs mid-read).
   - Creating a new `Hub` instance (simulating hub restart) produces a different `bootId` so tokens never collide with the prior instance.

2. **Playwright browser tests:**
   ```bash
   npm --prefix viewer run test:browser -- viewer/test/app-settings.spec.js viewer/test/app-accounts.spec.js viewer/test/app-lessons.spec.js viewer/test/app-diagram-sensitivity.spec.js
   ```
   Required assertions to add/update:
   - External setting change (made via API while Settings is open) automatically updates a clean unfocused block within one poll interval without manual reload — covering main settings (`name`, `writing`, `balancing`, `models` including `lead_order`/`worker_order`/`other_agents`/`review_families`, `templates` open by default, `accounts`/`harnesses`, `diagrams`, and `shared-tools` repo/keys).
   - Focused text/select control in a clean block defers repaint until focus leaves (or transitions to `.stale-banner` if the user types before blurring), then repaints cleanly without stealing focus; clicking a toggle or Save button does not hold stale values after an external update.
   - Unsaved draft in a dirty block (tested on `name`, `writing` including pending Never say input, `balancing`, `templates`, `lessons`, `accounts`, `shared-tools` key inputs) is preserved when an external change arrives, shows the inline `Updated elsewhere.` banner with `Load latest`, and clicking `Load latest` discards the draft and paints the newer values (while clicking `Save` still saves the draft, including shared-key 409 draft preservation).
   - Local save ordering: a slow in-flight refresh GET never overwrites a newer local save, and an older post-save reread cannot roll back a newer snapshot.
   - `app-lessons.spec.js`: update the existing 409 conflict test (`viewer/test/app-lessons.spec.js:111-117`) to assert retained surviving edits, reloaded current list, and visible lost text, AND add a case that removes the lesson through a real hub mutation route so the revision poll runs before Save and 409 recovery still preserves the lost text.
   - Idle Settings tab does not re-fetch `GET /settings` when `GET /settings/revision` is unchanged.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-28

**Lanes:** claude / claude-opus-5-5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | `templates` slice includes volatile `live_sessions`/`scope_missing` and `d.projects`, causing false stale banners when threads start/stop | upheld | Stripped `live_sessions`/`scope_missing` and dropped `d.projects` from `templates` slice in Spec §3.3 |
| intent | minor | `background` revision domain duplicates `background.js`'s existing 10 s/focus/visibility poller | upheld | Dropped `background` revision domain from §1–§2; kept `syncBackground` dirty/focus guards in §3.4 (Decision 5) |
| intent | minor | Focus guard on buttons/selects holds stale values after clicking Save/toggle and switching tabs | upheld | Narrowed `blockFocused` to `'input, textarea, select, [contenteditable]'` and used `repaint()` (`swapKeepingFocus`) for buttons/summaries in Spec §3.1 (Decision 5) |
| intent | minor | `withLocalWrite` wraps account sign-in POSTs too | upheld | Scoped `withLocalWrite` strictly to Settings/shared-keys mutations in Spec §2.1 |
| mechanics | blocking | Replacing `data` before checking `blockDirty` makes untouched Writing/Balancing drafts look edited | upheld | Added editor baselines (`styleBaseline`, `balBaseline`, `nameBaseline`, `folderBaseline`, `draftBaseline`, `lessonEdit.baseList`) in Spec §3.2 (Decision 5) |
| mechanics | blocking | `saveLessons()` loops live `data.lessons` after poll updates `data`, omitting externally removed id so 409 never fires | upheld | Iterate `lessonEdit.baseList` in `lessonDirty()` and `saveLessons()` in Spec §3.2 & §4.1 |
| mechanics | blocking | Model slices omit `lead_order`, `worker_order`, `other_agents`, `review_families`, and `thread-view` wrongly includes `other_agents`/`review_families` | upheld | Corrected `agents`, `assistants`, `ladders`, `tiers`, and `thread-view` slices in Spec §3.3 |
| mechanics | blocking | Diagram function is `loadDiagram()` (not `readDiagram()`), and its response redraws unconditionally | upheld | Named `loadDiagram()` and applied focus guard at render time in Spec §2.2 & §3.4 |
| mechanics | blocking | Shared-key Save after same-machine change hits 409 and `readKeys()` wipes password/name inputs | upheld | Added draft-preserving 409 recovery in `shared-tools` `change()` in Spec §4.2 |
| mechanics | major | `withLocalWrite` ends before post-save `reload()`, allowing older reread to roll back newer poll snapshot | upheld | Wrapped full save+reread in `withLocalWrite` and added monotonic `applySettingsSnapshot` in Spec §2.1 |
| mechanics | major | Whole-page `reload()` absorbs external changes without drawing them; retained caches go stale when category closed | upheld | Added per-block `renderedSlice` tracking and category-entry clean cache reset in Spec §3.3 (Decision 5) |
| mechanics | major | Blur handler skips deferred block if it became dirty after update arrived, never showing stale banner | upheld | Promote `deferredBlocks` to `staleBlocks` + `.stale-banner` on `input` or on `focusout` when dirty in Spec §3.4 |
| mechanics | major | `loadHarnesses()`, `loadSharedProjects()`, and `readKeys()` failures bypass guards and reset selected machine | upheld | Guarded all completion/error paths and persisted `sharedMachine` across repaints in Spec §3.4 |
| mechanics | major | `accountsBusy()` includes focus, misclassifying focused Accounts input as dirty; usage repaint wipes `.stale-banner` | upheld | Separated `accountsDirty()` from `blockFocused('accounts')` and re-rendered `.stale-banner` in `paint()` in Spec §3.2–§3.3 |
| mechanics | major | Diagram/shared-key tokens acknowledged before reads succeed; failed `/settings` aborts later domains; initial revision fetch failure unhandled | upheld | Isolated per-domain `try/catch`, advance tokens only on success, and made initial revision fetch best-effort in Spec §2.2 |
| mechanics | major | Background conflict check compares `backgroundVisit.revision` before set while decoding (`v.pending`) | upheld | Capture `v.baseRevision` when `v.pending` starts and compare only non-null differing revisions in Spec §3.4 |
| mechanics | minor | Focus selector excludes `<summary>` and lesson source link | upheld | Addressed via `repaint()` (`swapKeepingFocus`) for buttons/summaries/links while `blockFocused` protects text/select inputs in Spec §3.1 |
| mechanics | minor | Targeted validation omits `node --test machine/test/name-guard.test.js` | upheld | Added `machine/test/name-guard.test.js` to Spec §5 |
| mechanics | minor | Existing `app-lessons.spec.js:111-117` asserts exact 409 text and mutates `settings.json` directly | upheld | Specified updating that assertion and adding a hub-route removal test case in Spec §5 |

### Round 2 — 2026-11-28

**Changed since Round 1:**
- Dropped the redundant `background` revision domain from `Hub` (`settingsRevs` now tracks `settings`, `diagram`, `shared_keys`) and kept `syncBackground` dirty/focus guards with `v.baseRevision` captured at decode start (Decision 5, §1, §2.2, §3.4).
- Added monotonic `applySettingsSnapshot` + `withLocalWrite` covering full save-and-reread handlers scoped strictly to Settings/shared-keys writes, plus independent per-domain `try/catch`, post-success token acknowledgment, and best-effort initial revision fetch (§2.1–§2.2).
- Added editor baselines (`nameBaseline`, `folderBaseline`, `styleBaseline`, `balBaseline`, `draftBaseline`, `lessonEdit.baseList`), per-block `renderedSlice` tracking, category-entry clean cache reset, and `paint()` preservation of `.stale-banner` (§3.2–§3.3).
- Narrowed `blockFocused` to `'input, textarea, select, [contenteditable]'` and used `repaint()` (`swapKeepingFocus`) for buttons/summaries/links; separated `accountsDirty()` from focus; promoted dirty `deferredBlocks` to `staleBlocks` on `input`/`focusout` (§3.1–§3.4).
- Fixed `blockSlice` for `agents`, `assistants`, `ladders`, `tiers`, `thread-view`, and `templates` (stripped `live_sessions`/`scope_missing` and dropped `d.projects`) (§3.3).
- Named `loadDiagram()` and guarded completion/error paths for `loadDiagram`, `loadHarnesses`, `loadSharedProjects` (preserving `sharedMachine`), and `readKeys` (§3.4).
- Updated `saveLessons()` to iterate `lessonEdit.baseList` for 409 detection, added draft-preserving 409 recovery in shared-key `change()`, added `machine/test/name-guard.test.js`, and specified updating `app-lessons.spec.js` (§4–§5).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-28: Created `PLAN.md` after `IDEA.md` confirmation and mapping (`MAP.md` at `86e9b02d`). Messaged peer lead `wc-11c53653de4e-lead` to check whether "Custom accent color and theme options" overlaps with Settings page/hub files.
- 2026-11-28: Settled Q1 (Decision 4: inline "Updated elsewhere" note + "Load latest" button). Watch List #1 (`11c53653de4e` overlap check) cleared from Watch List per lead rule "Never wait on another lead"; any late reply from `wc-11c53653de4e-lead` will be handled under the late-overlap rule. Wrote Spec (§1–§5) and set `status: ready-for-review`.
- 2026-11-28: Peer lead `wc-11c53653de4e-lead` confirmed its theme-options thread will add a Theme section in Settings → You (`viewer/pages/settings.js`, and possibly `viewer/app/settings.js` / `viewer/app/routes.js`). Because this thread is already in review (late overlap), replied with our Spec details and noted to mention this overlap in one line of our next visible reply to Collin.
- 2026-11-28: Triaged Review Round 1 (19 findings: 4 intent minor, 15 mechanics — 5 blocking, 7 major, 3 minor; all 19 upheld) and updated Spec for Round 2.
