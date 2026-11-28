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

## Spec

### §1. Hub revision tracking (`viewer/app/hub.js`, `viewer/app/settings.js`, `viewer/app/routes.js`, `viewer/app/diagram-sensitivity.js`, `viewer/app/background.js`, `viewer/app/API.md`)

1. **Per-boot revision state on `Hub` (`viewer/app/hub.js`)**
   - In `Hub` constructor, generate a per-boot random id `this.settingsBootId = crypto.randomBytes(6).toString('hex')` and initialize `this.settingsRevs = { settings: 0, diagram: 0, background: 0, shared_keys: 0 }`.
   - Add two methods on `Hub`:
     - `settingsRevisions()`: returns `{ settings: `${this.settingsBootId}:${this.settingsRevs.settings}`, diagram: `${this.settingsBootId}:${this.settingsRevs.diagram}`, background: `${this.settingsBootId}:${this.settingsRevs.background}`, shared_keys: `${this.settingsBootId}:${this.settingsRevs.shared_keys}` }`.
     - `bumpSettingsRevision(domain = 'settings')`: increments `this.settingsRevs[domain]` (if `Object.hasOwn(this.settingsRevs, domain)`) and returns `${this.settingsBootId}:${this.settingsRevs[domain]}`.
   - Because `settingsBootId` is fresh on every `new Hub(...)`, a hub restart produces new tokens across all domains so open Settings tabs refresh cleanly and never collide with a cached counter.

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
   - `background` domain:
     - Inside `background.commit(...)` (`viewer/app/background.js:90-91`), call `hub.bumpSettingsRevision('background')` immediately after `atomicWrite(hub.state.settingsPath, ...)` succeeds. This covers both browser uploads/updates and assistant background removal.
   - `shared_keys` domain:
     - In `viewer/app/routes.js` (`POST /shared-keys/save` and `POST /shared-keys/remove`), call `hub.bumpSettingsRevision('shared_keys')` when the machine response is 2xx.

### §2. Client save ordering & polling (`viewer/pages/settings.js`)

1. **Single write-generation guard**
   - Track `let localWriteGen = 0;` and `let inFlightWrites = 0;` with helper:
     ```js
     async function withLocalWrite(fn) {
       localWriteGen += 1;
       inFlightWrites += 1;
       try { return await fn(); }
       finally { localWriteGen += 1; inFlightWrites -= 1; }
     }
     ```
   - Wrap all local Settings mutations in `withLocalWrite`:
     - Inside `api(path, opts)` whenever `opts && opts.method && opts.method !== 'GET'` and `path` is not a read-only POST (`/settings/style/preview`, `/project-tools/read`, `/shared-keys/read`, `/usage/seen`).
     - The raw `fetch` writes in lesson import (`settings.js:1450`) and `saveBackground` (`settings.js:2320-2321`).
   - In `reload(keep)` (`settings.js:1049`), capture `const gen = localWriteGen;` before `await api('/settings')`; if `gen !== localWriteGen` when it returns, discard the stale response instead of overwriting `data`. Account add/edit/delete/restore rereads of `/settings` must also go through `reload(false)` (or apply the same `localWriteGen` guard) so an older reread can never overwrite a newer local write.

2. **Lightweight polling loop via `window.wcPoller`**
   - Maintain `let lastRev = null;` and `let pollRunning = false;`.
   - On initial page load (`settings.js:2914`), fetch `GET /settings/revision` alongside `GET /settings`, initialize `lastRev = { ...rev, settings: data.settings_revision || rev.settings }`, and start `window.wcPoller(pollSettings, 5000)` (pauses while hidden and fires once on tab visible).
   - On each `pollSettings()` tick:
     1. Return immediately if `!data || pollRunning || inFlightWrites > 0`.
     2. Set `pollRunning = true` and `const startGen = localWriteGen;`.
     3. Fetch `const rev = await api('/settings/revision');` (silently swallow transient network errors and retry on the next tick).
     4. If `inFlightWrites > 0 || localWriteGen !== startGen`, return without mutating state.
     5. Reconcile each changed domain independently:
        - **`rev.settings !== lastRev.settings`**:
          - Fetch `const next = await api('/settings');`.
          - Re-check `if (inFlightWrites > 0 || localWriteGen !== startGen) return;`.
          - Save `const prev = data;`, set `data = next;`, and update `lastRev.settings = next.settings_revision || rev.settings;`.
          - For every block in the currently open category (except `enter` and `tools`), call `reconcileBlock(name, prev, next)` (§3).
          - Trigger secondary refreshes when their underlying data changed:
            - If `section === 'providers'` and (`JSON.stringify(prev.harnesses) !== JSON.stringify(next.harnesses)` or `JSON.stringify(prev.accounts) !== JSON.stringify(next.accounts)`), call `refreshStatus()` (refreshes harnesses and usage/accounts; accounts repaint remains guarded by `accountsBusy()` / `signCard` / `blockFocused('accounts')`).
            - If `section === 'usage'`: if `accounts` or `harnesses` changed, call `refreshUsage()`; if any balancing key or `provider_orders` changed, call `readReserved()`.
            - If `section === 'shared-tools'` and `JSON.stringify(prev.saved_dirs) !== JSON.stringify(next.saved_dirs)`, reset `sharedProjects = null` before reconciling `shared-tools`.
            - If `section === 'shared-tools'` and `prev.shared_tools_repo !== next.shared_tools_repo`, also mark shared keys for refresh in `reconcileBlock('shared-tools', ...)`.
        - **`rev.diagram !== lastRev.diagram`**:
          - If `youShown()`: if `blockFocused('diagrams')`, add `'diagrams'` to `deferredBlocks` (do not update `lastRev.diagram` yet, or mark pending diagram refresh); else update `lastRev.diagram = rev.diagram` and call `readDiagram()`.
          - If `!youShown()`: set `diagram = null` and update `lastRev.diagram = rev.diagram` so entering `you` fetches fresh.
        - **`rev.background !== lastRev.background`**:
          - Update `lastRev.background = rev.background`.
          - If `youShown()` and `bg`, call `bg.refresh()`.
        - **`rev.shared_keys !== lastRev.shared_keys`**:
          - If `section === 'shared-tools'`: call `reconcileSharedKeys(rev.shared_keys)` (clean + unfocused -> call `readKeys()` and update `lastRev.shared_keys`; focused -> defer to `deferredBlocks`; dirty -> show stale banner and hold `lastRev.shared_keys` until resolved or loaded).
          - If `section !== 'shared-tools'`: update `lastRev.shared_keys = rev.shared_keys`.
     6. In `finally`, set `pollRunning = false`.

### §3. Uniform per-block dirty/focus guards, deferred repaints, and "Updated elsewhere" banner (`viewer/pages/settings.js`, `viewer/pages/settings.css`)

1. **Focus guard (`blockFocused(name)`)**
   - Returns `true` when `document.activeElement` is inside `blockHost(name)` and matches `'input, textarea, select, button, [contenteditable]'`.

2. **Dirty guard (`blockDirty(name)`)**
   - Covers every draft variable and DOM-only input:
     - `name`: `nameDraft !== null && nameDraft !== (data.user_name || '')`
     - `writing`: `styleDraft !== null && JSON.stringify(currentStyle()) !== JSON.stringify(data.style)` (note `currentStyle()` already includes any non-empty `pending` "Never say" input)
     - `diagrams`, `usage`, `agents`, `ladders`, `escalation`, `assistants`, `conversations`, `lead-names`: `false` (immediate-save or read-only; protected by `blockFocused`)
     - `background`: `Boolean(backgroundVisit && (backgroundVisit.dirty || backgroundVisit.pending || backgroundVisit.saving))`
     - `harnesses`: `Boolean(hz.confirmOff)`
     - `accounts`: `accountsBusy() || Boolean(signCard && signCard.waiting && signCard.el.isConnected && blockHost('accounts')?.contains(signCard.el))`
     - `balancing`: `balDraft !== null && ['within', 'leave', 'notify_below', 'save_for_leads', 'margin', 'held_back'].some((k) => JSON.stringify(balDraft[k]) !== JSON.stringify(data[k]))`
     - `tiers`: `Boolean(blockHost('tiers')?.querySelector('.other input'))` (custom "Other" model input open)
     - `thread-view`: `folderDraft !== null && folderDraft !== (data.default_project_folder || '')`
     - `permission`: `false`
     - `templates` (holds both Templates and Lessons under `behavior`):
       - When `isLessons(selected)`: `lessonDirty() || Boolean(lessonEdit?.confirming) || Boolean(lessonEdit?.saving)`
       - When a template or `'new'` is selected: store `draftBaseline = structuredClone(draft)` inside `select(id)` right when `draft` is created; dirty when `confirming || JSON.stringify(draft) !== JSON.stringify(draftBaseline)`. An unedited open template editor is therefore clean and refreshes automatically.
     - `shared-tools`: any `<input>` inside `blockHost('shared-tools')` with non-empty `.value` (password key values or new key name/value inputs).
   - `enter` (browser-only) and `tools` (Project tools, out of scope per `IDEA.md`) are never touched by external refresh.

3. **Per-block slice comparison (`blockSlice(name, d)`)**
   - Compare `JSON.stringify(blockSlice(name, prev)) !== JSON.stringify(blockSlice(name, next))` before touching a block so unrelated changes never cause spurious repaints or false "Updated elsewhere" banners:
     - `name`: `d.user_name`
     - `writing`: `[d.style, d.style_version]`
     - `harnesses`: `d.harnesses`
     - `accounts`: `[d.accounts, d.harnesses]`
     - `usage`: `[d.accounts, d.harnesses]`
     - `balancing`: `[d.within, d.leave, d.notify_below, d.save_for_leads, d.margin, d.held_back, d.reserved_provider]`
     - `agents`: `[d.models, d.provider_orders, d.harnesses, d.lead_tier_notice_dismissed]`
     - `ladders`: `[d.provider_orders, d.harnesses]`
     - `tiers`: `[d.models, d.heads_up, d.harnesses]`
     - `escalation`: `[d.escalation, d.escalation_text]`
     - `assistants`: `[d.models, d.harnesses]`
     - `conversations`: `[d.assistant, d.project_leads]`
     - `thread-view`: `[d.tool_steps, d.auto_merge, d.auto_merge_delete_branch, d.default_project_folder, d.other_agents, d.review_families]`
     - `permission`: `[d.permission_mode, d.codex_mode, d.aside_access]`
     - `lead-names`: `[d.lead_name_list, d.lead_names]`
     - `templates`: `[d.templates, d.lessons, d.lesson_history, d.lesson_waiting, d.projects]`
     - `shared-tools`: `[d.shared_tools_repo, d.saved_dirs]`

4. **Reconciliation rules (`reconcileBlock(name, prev, next)`)**
   - Maintain `const deferredBlocks = new Set();` and `const staleBlocks = new Set();`.
   - When a block's slice changed (or a domain refresh for `diagrams` / `background` / `shared-tools` applies):
     - **Clean and unfocused (`!blockDirty(name) && !blockFocused(name)`)**:
       - Reset clean draft caches so the repaint reads fresh `data`:
         - `writing`: `styleDraft = null;`
         - `balancing`: `balDraft = null;`
         - `templates`: if `!isLessons(selected)` and `selected !== 'new'`, re-run `select(data.templates.some((t) => t.id === selected) ? selected : (data.templates[0]?.id || 'new'))`.
         - `name`: `nameDraft = null;`
         - `thread-view`: `folderDraft = null;`
       - Clear `deferredBlocks.delete(name)` and `staleBlocks.delete(name)`.
       - Repaint `paint(name)` (and for `shared-tools`, update the `<select>` / add any missing repo option and trigger `readKeys()` if clean; for `diagrams`, `readDiagram()`; for `background`, `paint('background')`).
     - **Clean and focused (`!blockDirty(name) && blockFocused(name)`)**:
       - Do not repaint now. Add `name` to `deferredBlocks`.
       - A single `focusout` listener on `panel` runs via `queueMicrotask`: for each `name` in `deferredBlocks`, if `!blockFocused(name)` and `!blockDirty(name)`, remove `name` from `deferredBlocks` and run the clean repaint path above using the **current** `data` (never an old captured snapshot, so a newer local save is never overwritten).
     - **Dirty (`blockDirty(name)`)**:
       - Do not repaint and do not overwrite the draft.
       - Add `name` to `staleBlocks` and render/keep a compact inline `.stale-banner` (`role="status"`) at the top of `blockHost(name)` without rebuilding existing form controls:
         - Text: `Updated elsewhere.`
         - Button: `<button type="button" class="small">Load latest</button>`
       - Clicking **Load latest** discards that block's draft (`nameDraft = null`, `folderDraft = null`, `styleDraft = null`, `balDraft = null`, `editing = null; adding = null;` for `accounts`, `hz.confirmOff = null;` for `harnesses`, `select(...)` for `templates`/`lessons`, `discardBackground(); bg.refresh(); ensureBackground();` for `background`, clear inputs + `readKeys()` for `shared-tools`, remove `.other` for `tiers`), clears `staleBlocks.delete(name)` and `deferredBlocks.delete(name)`, and repaints `name` from current `data`.
       - Clicking **Save** on that block proceeds as normal and clears `staleBlocks.delete(name)` and `deferredBlocks.delete(name)` on success.
       - Switching categories (`readHash` when `leaving` is true) clears `deferredBlocks` and `staleBlocks`.
   - **Background subscription (`syncBackground`)**:
     - If `backgroundVisit && (backgroundVisit.dirty || backgroundVisit.pending || backgroundVisit.saving)` and incoming `state.metadata?.revision !== backgroundVisit.revision`: show `.stale-banner` on `background` without repainting.
     - If clean and `blockFocused('background')`: defer via `deferredBlocks.add('background')` instead of repainting mid-focus.
   - **Shared keys `readKeys()` guard**:
     - When `readKeys()` finishes during a background refresh (`fromRefresh = true`), if `blockDirty('shared-tools') || blockFocused('shared-tools')` became true while the request was in flight, do not call `paintKeys()` (show `.stale-banner` if dirty, or defer if focused); explicit user actions (machine picker change, Save/Remove, Load latest) pass `fromRefresh = false` and paint as before.

### §4. Draft-preserving 409 recovery in `saveLessons()` (`viewer/pages/settings.js`)

- When `PUT /settings/lessons/:role` fails with `e.status === 409`:
  1. Preserve the user's `prevTexts = { ...lessonEdit.texts }` and `prevRemovals = new Set(lessonEdit.removals)`.
  2. Call `await reload(false);` to load the current server lessons for `role`.
  3. Build `survivingIds = new Set(lessonList(role).map((item) => item.id))`.
  4. Re-populate `lessonEdit.texts` with entries from `prevTexts` whose id is in `survivingIds`, and `lessonEdit.removals` with ids from `prevRemovals` that are in `survivingIds`.
  5. Collect edited texts for ids that were removed externally (`!survivingIds.has(id)` and `prevTexts[id] !== undefined`).
  6. Clear `lessonEdit.saving = false`, clear `staleBlocks.delete('templates')`, repaint `templates`, and display an inline error message naming the removed lesson edit text(s) so Collin can copy or re-add them (matching the existing draft-preserving behavior of `lessonAction` and lesson import).

### §5. Validation

Targeted commands covering all touched files (full-run is handled before push per `AGENTS.md`):

1. **Node unit/API tests:**
   ```bash
   node --test viewer/test/app-settings.test.js viewer/test/background.test.js viewer/test/app-diagram-sensitivity.test.js
   ```
   Required assertions to add:
   - `GET /wheelchair/api/settings/revision` returns `{ settings, diagram, background, shared_keys }` tokens with `<bootId>:<seq>` format.
   - Mutating `settings` (e.g., `PUT /settings/preferences`, `POST /settings/models/heads-up` `skip`/`reset`), `diagram` (`POST /settings/diagram-sensitivity`), `background` (`PUT`/`POST /settings/background`), and `shared_keys` each bump only their respective counter.
   - `GET /wheelchair/api/settings` includes `settings_revision` matching the pre-read revision (never stamped with a write that occurs after `describe()` starts).
   - Creating a new `Hub` instance (simulating hub restart) produces a different `bootId` so tokens never collide with the prior instance.

2. **Playwright browser tests:**
   ```bash
   npm --prefix viewer run test:browser -- viewer/test/app-settings.spec.js viewer/test/app-accounts.spec.js viewer/test/app-lessons.spec.js viewer/test/app-diagram-sensitivity.spec.js
   ```
   Required assertions to add:
   - External setting change (made via API while Settings is open) automatically updates a clean unfocused block within one poll interval without manual reload (tested across main settings, templates editor open by default, accounts/harnesses, diagram sensitivity, and shared-tools repo/keys).
   - Focused control in a clean block defers repaint until focus leaves, then repaints cleanly without stealing focus.
   - Unsaved draft in a dirty block (tested on `name`, `writing` including pending Never say input, `balancing`, `templates`, `lessons`, `accounts`, `shared-tools` key inputs) is preserved when an external change arrives, shows the inline `Updated elsewhere.` banner with `Load latest`, and clicking `Load latest` discards the draft and paints the newer values (while clicking `Save` still saves the draft).
   - Local save ordering: a slow in-flight refresh GET never overwrites a newer local save.
   - `saveLessons()` 409 recovery: external removal of a lesson being edited preserves surviving edits and shows the lost text in an inline error instead of silently clearing it.
   - Idle Settings tab does not re-fetch `GET /settings` when `GET /settings/revision` is unchanged.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-28

**Changed since Round 0:** n/a (first round — whole Spec in scope)

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
