---
slug: assistant-settings
status: ready-for-review
created: 2026-11-28
---

# Let the personal assistant change settings

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Skip designer mockups for this feature | No new screen or visual layout changes; uses existing assistant chat, existing question cards, and existing Settings page controls | defaulted |
| 2 | Include read-only inspection of current settings (excluding secret values) | The assistant needs to check current values to answer questions and report accurate before/after summaries | defaulted |
| 3 | Route all assistant setting reads and writes through the hub's existing validation and write handlers via `wc.js assistant`, with no automatic retry on writes | Preserves every Settings page invariant and matches existing assistant action transport and safety rules | defaulted |
| 4 | Keep browser-only "Enter to send" out of assistant writes; assistant tells Collin where to toggle it | Stored only in browser `localStorage`; hub cannot change another browser's local preference | defaulted |
| 5 | Allow assistant to change hub-stored settings only (You except browser-only "Enter to send", Models, Usage & balancing, Threads, Agent behavior templates & lessons, Assistant & project leads, AI provider enable/disable & account metadata, Shared tools repo); keep logins, CLI installs, API keys/secrets, and Project tools PR edits manual | Gives chat control over normal settings without putting secrets, interactive sign-ins, or surprise repo PRs into assistant chat | user |
| 6 | Apply normal preference changes right away; require a `question` card confirmation before high-impact or destructive changes (loosening session permissions or aside access, enabling auto-merge or branch deletion, turning off the personal assistant or disabling an AI provider, removing an account/template/lesson, or resetting model pins) | Keeps everyday tweaks fast while guarding against accidental safety-boundary changes, deletions, or shutting off the assistant | user |
| 7 | Forbid the personal assistant from turning itself off (enforced by the hub and documented in `protocol/app/assistant.md`); turning the personal assistant off stays manual on Settings → Assistant and project leads | Prevents the assistant from killing its own session or locking itself out | user |
| 8 | Refresh an already-open Settings page automatically when settings change externally, without clobbering unsaved edits or focused inputs | Makes changes requested in the assistant popup visible right away on an open Settings page without disrupting active form edits | user |
| 9 | Invoke `handleSettings` directly through a lightweight exported `invokeSettings` adapter in `viewer/app/routes.js` (and `background.commit`/`background.metadata` directly) instead of extracting a new `settings-ops.js` module | Guarantees 100% identical validation, status codes, and side effects without duplicating or relocating ~300 lines of route code | review-round-1 |
| 10 | Require confirmation before turning off `project_leads` or discarding a waiting lesson (`lesson-waiting` with `action: "discard"`), and require the approved `revision` on `background` removal | Turning off project leads stops live sessions; discarding a waiting lesson has no history entry; tying background removal to the approved revision prevents deleting a newer image | review-round-1 |
| 11 | Support optional `--section` and `--include-history` on `wc.js assistant settings`, omitting `lesson_history` by default | Keeps routine setting lookups compact in the assistant's context while still allowing full history inspection when needed | review-round-1 |

## Spec

### 1. Overview & Boundaries

Let the personal assistant read and update hub-stored settings through `wc.js assistant`, reusing the hub's existing Settings handlers and side effects, while keeping an open Settings page in sync automatically.

- **In scope (personal assistant only; project leads never have access):**
  - Read current hub settings (`settings` action), including `settings.describe(hub)` + `reserved_provider`, `diagram_sensitivity`, and `background` metadata, with optional section filtering and compact default (omitting `lesson_history` unless requested). Never exposes secret values (project keys, shared keys, sign-in tokens).
  - Write hub-stored settings (`setting` action) across the 19 supported targets below:
    - **You**: `user_name`, writing `style`, `diagram-sensitivity`, `background` (opacity change or remove image; not raw image upload).
    - **AI providers (metadata only)**: enable/disable `harness`, `account-add`, `account-update`, `account-remove`, `account-restore`.
    - **Usage and balancing**: `balancing`.
    - **Models**: `model` (per-provider slot/model/effort), `models-heads-up` (`switch`, `skip`, `reset`), plus `preferences` fields (`other_agents`, `provider_orders`, `review_families`, `escalation`, `lead_tier_notice_dismissed`).
    - **Assistant and project leads**: `project_leads` on/off via `preferences`.
    - **Threads**: `tool_steps`, `auto_merge`, `auto_merge_delete_branch`, `default_project_folder`, `permission_mode`, `codex_mode`, `aside_access`, `lead_name_list`, `lead_names` via `preferences`.
    - **Agent behavior**: `template-create`, `template-update`, `template-delete`, `lessons-update`, `lesson-restore`, `lesson-keep`, `lesson-waiting`.
    - **Shared tools (repo only)**: `shared_tools_repo` via `preferences`.
- **Out of scope / Excluded (refused by hub if attempted; assistant directs Collin to the Settings page):**
  - Turning the personal assistant itself off (`preferences` payload containing `assistant` is refused with HTTP 403).
  - Browser-local "Enter to send" (`localStorage` only).
  - AI provider machine sign-ins / login codes and CLI installations.
  - Project tools (adding/editing/removing tools opens PRs, Windows switch, Unity prep) and Project keys.
  - Shared tools keys (machine-local secrets).
  - Background image file uploads.
  - Saved directories (`saved-dirs`), lesson export/import, style preview, and prompt preview are not write targets.

### 2. CLI Surface (`viewer/app/wc.js`)

Extend `assistantRequest(operation, tail, projectLead)` in `viewer/app/wc.js`:

- Add `'settings'` and `'setting'` to the personal assistant allowlist ONLY (when `projectLead` is false). `projectLead === true` MUST continue to reject `'settings'` and `'setting'` with `'unsupported assistant action'`.
- **`wc.js assistant settings [--section <name>] [--include-history]`** (read-only):
  - Optional `--section <name>` (`all`, `preferences`, `style`, `models`, `balancing`, `accounts`, `harnesses`, `templates`, `lessons`, `diagrams`, `background`) and boolean flag `--include-history` (filtered out before `flags()` just like `--archived`).
  - Sends `POST /assistant` with `{ action: 'settings', ...(section ? { section } : {}), ...(includeHistory ? { include_history: true } : {}) }`.
  - Retries on HTTP 503 ("hub unavailable") using `postSessionWithRetry`, the same as `projects`, `threads`, and `thread`.
  - Prints one JSON line.
- **`wc.js assistant setting <target> --file <json-file>`** (write):
  - Requires positional `<target>` (`parsed._[0]`) and `--file <json-file>` (`parsed.file`). If either is missing, throw `'setting requires <target> and --file'`.
  - Reads `<json-file>` as UTF-8 and parses JSON; if invalid JSON or not a plain JSON object (null, array, or primitive), throw `'setting --file must contain a JSON object'`.
  - Sends `POST /assistant` with `{ action: 'setting', target: parsed._[0], payload }`.
  - **Never retries automatically on 503** (only `settings` is added to the read-retry allowlist in `wc.js`).
  - Prints one JSON line (`{"ok":true,...}` on success; `{"ok":false,"error":...}` on failure, exit 0, matching existing `wc.js assistant` behavior).

### 3. Direct Settings Handler Adapter (`viewer/app/routes.js`)

Export a lightweight helper `invokeSettings(hub, method, relPath, body)` from `viewer/app/routes.js` that invokes `handleSettings(hub, fakeRequest, fakeResponse, fakeUrl, bits, body)` directly and returns `{ status, body }`:

- `relPath` is the path under `/settings` (for example `'/preferences'`, `'/harnesses/claude'`, `'/accounts'`, `'/accounts/abc/restore'`, `'/lessons/lead'`, `'/diagram-sensitivity'`). `bits` is `['settings', ...segments]`.
- `fakeRequest` provides `{ method }`; `fakeUrl` is `new URL('http://localhost/wheelchair/api/settings' + relPath)`; `fakeResponse` captures `statusCode`, headers (no-op `setHeader`), and the JSON body written by `send(...)`.
- Existing HTTP routes in `routes.js` are unchanged. No separate `settings-ops.js` file is created.
- Background reads and writes call `background.metadata(hub)` and `background.commit(...)` directly (`viewer/app/background.js`).

### 4. Hub Assistant Dispatcher (`viewer/app/assistant-actions.js`)

- In `dispatch(hub, input)` (personal assistant only), pass `allowSettings: true` in `policy`. Project-lead callers (`project-lead-actions.js`) do NOT pass `allowSettings: true`.
- In `run(hub, input, policy)`:
  - If `action === 'settings'` or `action === 'setting'`:
    - Require `policy.allowSettings === true`; otherwise throw `appError(403, 'only the personal assistant may do that')`.
    - Do not require `input.thread`.
  - **`action === 'settings'`**:
    - Validate optional `input.section` (must be undefined or one of `'all'`, `'preferences'`, `'style'`, `'models'`, `'balancing'`, `'accounts'`, `'harnesses'`, `'templates'`, `'lessons'`, `'diagrams'`, `'background'`; otherwise throw `appError(400, 'invalid settings section')`).
    - Fetch base snapshot via `routes.invokeSettings(hub, 'GET', '')` (same payload as `GET /wheelchair/api/settings`, including `reserved_provider`), plus `diagramSensitivity.read(hub)` when section is `'all'` or `'diagrams'`, and `background.metadata(hub)` when section is `'all'` or `'background'`.
    - When `section` is omitted or `'all'`: return the combined snapshot with `diagram_sensitivity` and `background`, omitting `lesson_history` unless `input.include_history === true`.
    - When a specific `section` is given: return only that section's relevant keys (e.g., `lessons` includes `lessons`, `lesson_waiting`, and `lesson_history` when `include_history` is true; `models` includes `models`, `heads_up`, `other_agents`, `provider_orders`, `review_families`, `escalation`, `lead_tier_notice_dismissed`, `lead_order`, `worker_order`; `preferences` includes the preference fields; `diagrams` includes `{ diagram_sensitivity }`; `background` includes `{ background }`; etc.).
  - **`action === 'setting'`**:
    - Require `typeof input.target === 'string' && input.target.trim()` and `input.payload` to be a plain non-null, non-array object; otherwise throw `appError(400, 'target and object payload are required')`.
    - Map each allowed `target` to `routes.invokeSettings(...)` (or `background.commit(...)` for `background`), propagating any `appError` thrown by `handleSettings`:
      1. `preferences`: if `Object.hasOwn(payload, 'assistant')`, throw `appError(403, 'the assistant cannot change its own on/off setting; change it under Settings → Assistant and project leads')`. Otherwise call `invokeSettings(hub, 'PUT', '/preferences', payload)` and return `{ ok: true, result: res.body }`.
      2. `style`: `PUT /style` with `payload`; return `{ ok: true, result: res.body }`.
      3. `diagram-sensitivity`: `POST /diagram-sensitivity` with `payload`. Invalid `level` throws `appError(400, ...)`. On `res.status === 200`, return `{ ok: true, result: res.body }`. On non-200 (partial/all machine failure, e.g. 502), return `{ ok: false, error: 'one or more machines did not update diagram sensitivity', result: res.body }` (HTTP 200 so the assistant receives the full `machines` map and can report which machine failed).
      4. `background`: accept `payload.action === 'opacity'` (requires integer `payload.opacity` 0–100; optional integer `payload.revision` — if omitted, reads current `background.metadata(hub)` revision; if `!current.image_id`, throw `appError(400, 'no background image is set')`; calls `background.commit(hub, rev, payload.opacity, current.image_id, current.media_type, null)`) or `payload.action === 'remove'` (**requires** integer `payload.revision`, matching the revision the user approved removing; if missing or not a non-negative safe integer, throw `appError(400, 'background remove requires revision')`; calls `background.commit(hub, payload.revision, 35, null, null, null)`). If `background.commit` throws 409 (`Background changed elsewhere`), propagate the 409 error so the assistant re-reads `settings` and asks Collin again before removing a newly uploaded image. Any other `action` throws `appError(400, 'background action must be opacity or remove')`. Return `{ ok: true, result }`.
      5. `harness`: require non-empty string `payload.provider` (URL-encoded) and boolean `payload.enabled`; `PUT /harnesses/${encodeURIComponent(payload.provider)}` with `{ enabled: payload.enabled }`; return `{ ok: true, result: res.body }`.
      6. `account-add`: `POST /accounts` with `payload`; return `{ ok: true, result: res.body }`.
      7. `account-update`: require non-empty string `payload.id`; `PUT /accounts/${encodeURIComponent(payload.id)}` with `{ ...payload }` (without `id`); return `{ ok: true, result: res.body }`.
      8. `account-remove`: require non-empty string `payload.id`; `DELETE /accounts/${encodeURIComponent(payload.id)}` with `{}`; return `{ ok: true, result: res.body }`.
      9. `account-restore`: require non-empty string `payload.id`; `POST /accounts/${encodeURIComponent(payload.id)}/restore` with `{}`; return `{ ok: true, result: res.body }`.
      10. `balancing`: `PUT /balancing` with `payload`; return `{ ok: true, result: res.body }`.
      11. `model`: `PUT /models` with `payload`; return `{ ok: true, result: res.body }`.
      12. `models-heads-up`: `POST /models/heads-up` with `payload`; return `{ ok: true, result: res.body }`.
      13. `template-create`: `POST /templates` with `payload`; return `{ ok: true, result: res.body }`.
      14. `template-update`: require non-empty string `payload.id`; `PUT /templates/${encodeURIComponent(payload.id)}` with `{ ...payload }` (without `id`); return `{ ok: true, result: res.body }`.
      15. `template-delete`: require non-empty string `payload.id`; `DELETE /templates/${encodeURIComponent(payload.id)}` with `{}`; return `{ ok: true, result: res.body }`.
      16. `lessons-update`: require non-empty string `payload.role`; `PUT /lessons/${encodeURIComponent(payload.role)}` with `{ edits: payload.edits, removals: payload.removals }`; return `{ ok: true, result: res.body }`.
      17. `lesson-restore`: require non-empty string `payload.role`; `POST /lessons/${encodeURIComponent(payload.role)}/restore` with `{ id: payload.id, vid: payload.vid }`; return `{ ok: true, result: res.body }`.
      18. `lesson-keep`: require non-empty string `payload.role`; `POST /lessons/${encodeURIComponent(payload.role)}/keep` with `{ id: payload.id }`; return `{ ok: true, result: res.body }`.
      19. `lesson-waiting`: require non-empty string `payload.role`; `POST /lessons/${encodeURIComponent(payload.role)}/waiting` with `{ wid: payload.wid, action: payload.action }`; return `{ ok: true, result: res.body }`.
      - Any other `target` throws `appError(400, 'unsupported setting target')`.

### 5. Live Refresh on the Settings Page (`viewer/pages/settings.js`)

Keep an already-open Settings page in sync when settings change externally (for example, via the assistant popup or another tab) without disrupting active edits or racing local saves:

- **Polling & triggers:**
  - Reuse `window.wcPoller(refreshSettings, 5000)` (`viewer/pages/nav.js:6`) so polling runs every 5,000 ms while visible, pauses when hidden, and fires once on becoming visible. Also trigger `refreshSettings` on `window` `focus`.
  - Guard against overlapping in-flight refreshes with a single `refreshInFlight` boolean; silently ignore transient network errors.
- **Ordering against local browser saves:**
  - Track `localWriteGen` (monotonic counter) and `inFlightWrites` (active mutation count). Every mutating `api(...)` call in `settings.js` (any method other than `GET`) increments `localWriteGen` and `inFlightWrites` before the fetch and decrements `inFlightWrites` in `finally`.
  - `refreshSettings` skips starting when `inFlightWrites > 0`, and captures `const gen = localWriteGen` before `GET /settings`. When the `GET` resolves, if `inFlightWrites > 0 || localWriteGen !== gen`, discard the stale response.
- **Deferred repaint tracking (never consuming skipped updates):**
  - Track `renderedSlices` (map of block key → last rendered JSON string) independently of the latest fetched `data`, plus a `flushDeferredRepaints()` helper invoked on `focusout` (after a microtask so `document.activeElement` settles) and after local save/cancel actions, as well as on each refresh tick.
  - A block is repainted whenever its current slice in `data` differs from `renderedSlices[key]` AND its edit/focus guard is clear; `renderedSlices[key]` is updated ONLY when the block actually repaints (never when skipped). Thus blurring a control or cancelling a draft immediately paints any change that arrived while editing.
- **Per-block refresh & edit-preservation rules:**
  - **`renderName`**: skip repaint if `nameDraft !== (prev.user_name || '')` or the name input is focused.
  - **`renderWriting` (Style)**: compare `styleDraft` against previous saved `prev.style` field-by-field. If completely clean, replace `styleDraft = structuredClone(next.style)` and repaint (if unfocused). If dirty, rebase only untouched fields (fields equal to `prev.style`) to `next.style` while preserving edited fields; repaint only if unfocused.
  - **`renderBalancing` (Balancing)**: same field-by-field rebase on `balDraft` against previous saved balancing fields (`prev` vs `next`), preserving any edited fields and repainting only when unfocused.
  - **`renderTemplates` (Behavior templates)**: an editor is open by default on visit (`selected` initialized), so NEVER skip merely because an editor is open. Guard by actual dirty state (`draft` differs from the selected template's saved fields in `prev.templates`, or an input/textarea/select inside the templates block is focused). When clean and unfocused, update `templates` and re-initialize `draft` from the updated selected template (or select the first template / empty draft if the selected template was deleted), then repaint.
  - **`renderLessons` (Lessons)**: if `lessonDirty()` is true when `next.lessons` arrives, run the existing `keepLessonEdits()` + `showLessonLost()` recovery path (`viewer/pages/settings.js:1322–1363`) so edits to surviving lessons are preserved and any unsaved text for an externally removed lesson is surfaced in the lost-text notice rather than silently cleared. Skip repaint while an input/textarea inside lessons is focused (deferring via `renderedSlices`).
  - **`renderSharedTools` (Shared tools)**: when `shared_tools_repo` changes, update ONLY the repository `<select>` value in place (when that `<select>` is not focused) without calling `renderSharedTools()` or `paintKeys()`, so machine-local key inputs and drafts are never erased.
  - **`renderAccounts` & `renderHarnesses` (AI providers)**:
    - When `accounts` or `retired_accounts` change in `/settings`, trigger `refreshUsage()` (so `accountRows()` gets the updated `/usage` snapshot) and repaint `renderAccounts` when the add-account or inline edit form is not open/dirty and no input/select inside it is focused, preserving active sign-in flows.
    - When `harnesses` change in `/settings`, update `hz.data` enabled flags (and call `loadHarnesses()` if the AI providers category is active and no install poll would be disrupted) and repaint `renderHarnesses` when unfocused.
  - **`renderThreadView` (Threads)**: skip repaint if `folderDraft !== (prev.default_project_folder || '')` or an input inside its container is focused.
  - **`renderLeadNames` (Lead names)**: skip repaint if the custom lead-names input/textarea has unsaved edits or is focused.
  - **Other hub blocks**: `renderConversations` (owns `assistant` and `project_leads` toggles), `renderAssistants` (assistant role tiers under Models), `renderAgents`, `renderLadders`, `renderTiers`, `renderEscalation`, `renderPermission` repaint whenever their slice differs from `renderedSlices[key]` and no input/select inside their container is focused.
  - **`renderDiagrams` (You → Diagrams)**: when the active category is `you`, `refreshSettings` also fetches `GET /wheelchair/api/settings/diagram-sensitivity` (honoring `localWriteGen` / `diagramReads`) and repaints `renderDiagrams` if changed and unfocused.
  - **`renderBackground`**: already polls via `viewer/pages/background.js`; no duplicate fetch needed.

### 6. Assistant Protocol Rules (`protocol/app/assistant.md`) & Rollout

Update `protocol/app/assistant.md`:

- Replace `"Do not change Settings."` with a **Settings** rule block:
  - You can inspect and change hub settings when Collin asks in chat using `wc.js assistant settings [--section <name>] [--include-history]` (read) and `wc.js assistant setting <target> --file <json-file>` (write).
  - Read `settings` first when you need current values, ids (accounts, templates, lessons), or revisions (background), and report clearly what changed (before → after).
  - **Confirm first with a `question` card** (naming the exact change and its effect) before applying:
    - Loosening session permissions (`permission_mode: "bypass"`, `codex_mode: "unrestricted"`) or broadening aside access (`aside_access: "full"`).
    - Turning on `auto_merge: "on"` or `auto_merge_delete_branch: "on"`.
    - Turning off `project_leads: "off"` (stops live project-lead sessions) or disabling an AI provider (`harness` with `enabled: false`).
    - Removing an account (`account-remove`), deleting a template (`template-delete`), removing a lesson (`lessons-update` with non-empty `removals`), discarding a waiting lesson (`lesson-waiting` with `action: "discard"`), removing the background image (`background` with `action: "remove"`, passing the `revision` read before the card — if the write returns 409 because a new image was uploaded meanwhile, re-read `settings` and ask again), or resetting model pins (`models-heads-up` with `action: "reset"`).
    - Any ambiguous request where more than one setting or value could match.
  - Apply other hub setting changes immediately and confirm what changed.
  - **Stay manual (never attempt; tell Collin which Settings category to use):**
    - Turning the personal assistant itself off (`Settings → Assistant and project leads`) — refused by the hub.
    - "Enter to send" (`Settings → You`) — browser-local only.
    - AI provider sign-ins / login codes and CLI installations (`Settings → AI providers`).
    - Project tools and Project keys (`Settings → Project tools`).
    - Shared tools keys (`Settings → Shared tools`).
    - Uploading a new background image file (`Settings → You`).
  - `settings` retries on hub unavailability; `setting` never retries automatically. After "hub unavailable" on `setting`, check `settings` before trying again. Report the returned outcome (including per-machine results on `diagram-sensitivity`).
- Add `settings` and `setting <target> --file <f>` rows to the **Actions** table, listing the supported targets.
- **Activation / Rollout (`CONTRIBUTING.md:67`):** Role file edits reach sessions started after the edit, never an already-running session. After merging and updating, restart the personal assistant session (or toggle it off and on in Settings) so it picks up the new `protocol/app/assistant.md` rules. Verification must test from a fresh assistant session.

### 7. Validation Commands & Required Assertions

Targeted tests per area (whole-suite and full-run checks are run by the pusher before push):

- **CLI (`viewer/app/wc.js`):**
  ```bash
  node --test viewer/test/wc-cli.test.js
  ```
  Required assertions: `wc.js assistant settings` (with/without `--section` and `--include-history`) retries on 503; `wc.js assistant setting <target> --file <f>` rejects missing target/file or non-object JSON and never retries on 503; `wc.js project-lead` rejects both `settings` and `setting`.
- **Machine relay & name guard (`machine/service.js`):**
  ```bash
  node --test machine/test/name-guard.test.js
  ```
- **Hub settings adapter, routes, and assistant actions (`viewer/app/routes.js`, `viewer/app/assistant-actions.js`):**
  ```bash
  node --test viewer/test/assistant.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js
  ```
  Required assertions: live personal assistant reads settings (full and filtered by section, compact default without `lesson_history` unless requested) and writes across supported targets; project-lead and non-assistant sessions are refused (403); `preferences` containing `assistant` is refused (403); unknown target is refused (400); `diagram-sensitivity` partial machine failure returns `{ ok: false, error, result: { machines } }` cleanly through the relay; `background` `remove` requires `revision` and returns 409 on stale revision.
- **Settings page live refresh and assistant popup UI (`viewer/pages/settings.js`):**
  ```bash
  npm --prefix viewer run test:browser -- app-settings.spec.js app-assistant-popup.spec.js
  ```
  (Runs both Chromium and Firefox via `viewer/playwright.config.js` and `viewer/test/firefox-specs.js`.)
  Required assertions: external preference/conversation/template/account/shared-repo changes update an open Settings page automatically without reload; clean default-open template editor refreshes when templates change; deferred repaint fires after a focused input blurs; dirty `styleDraft`/`balDraft` preserves edited fields while rebasing untouched fields; external lesson removal while editing surfaces the lost-text recovery notice; shared-repo update preserves unsaved shared-key drafts; stale GET responses crossing a local write are discarded.
- **Protocol (`protocol/app/assistant.md`):**
  - Review rendered prose for consistency with `viewer/app/wc.js` and `viewer/app/assistant-actions.js`, and verify activation guidance.

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
|---|---|---|---|---|
| intent | minor | Call `handleSettings` directly via allowlist + stub response instead of extracting `settings-ops.js` | upheld | Replaced `settings-ops.js` with `routes.invokeSettings` adapter in Spec §3–§4 (Decision 9) |
| intent | minor | Reuse `window.wcPoller` (`viewer/pages/nav.js:6`) instead of custom `setInterval` + `visibilitychange` | upheld | Updated Spec §5 to reuse `window.wcPoller(refreshSettings, 5000)` |
| intent | minor | Add `project_leads: "off"` to confirmation list since it stops live sessions | upheld | Added `project_leads: "off"` to confirm list in Spec §6 (Decision 10) |
| intent | minor | `settings` read returns large `settings.describe` blob including `lesson_history` | upheld | Added optional `--section` and `--include-history`, omitting `lesson_history` by default in Spec §2, §4, §6 (Decision 11) |
| mechanics | blocking | Templates editor is open by default; skipping whenever open leaves templates stale | upheld | Guard by actual dirty `draft` / focus, and refresh/reselect clean editor in Spec §5 |
| mechanics | major | Deferred repaints consumed when snapshot advances while skipped | upheld | Track `renderedSlices` independently and flush deferred repaints on `focusout`, save/cancel, and next tick in Spec §5 |
| mechanics | major | `balDraft` and `styleDraft` persist after blur; whole-form save risks stale or lost edits | upheld | Specified field-by-field rebase of untouched fields preserving dirty edits in Spec §5 |
| mechanics | major | External lesson removal during edit silently clears typed text on Save | upheld | Required existing `keepLessonEdits()` + `showLessonLost()` recovery path on refresh in Spec §5 |
| mechanics | major | `renderSharedTools` rebuilds key inputs and can erase unsaved key drafts | upheld | Update only the repository `<select>` in place without rebuilding key fields in Spec §5 |
| mechanics | major | Refresh GETs not ordered against local browser saves | upheld | Added `localWriteGen` + `inFlightWrites` stale-GET discard rule in Spec §5 |
| mechanics | major | Accounts uses `/usage` snapshot and Harnesses uses `/harnesses` (`hz.data`) | upheld | Specified refreshing `/usage` and updating/refreshing `hz.data` on account/harness changes in Spec §5 |
| mechanics | major | Background removal confirmation not tied to approved revision | upheld | Required `revision` on `background` `remove` and re-confirm on 409 conflict in Spec §4, §6 (Decision 10) |
| mechanics | major | `lesson-waiting` `discard` removes pending lesson without history or confirmation | upheld | Added `lesson-waiting` `action: "discard"` to confirmation list in Spec §6 (Decision 10) |
| mechanics | minor | `renderConversations` (not `renderAssistants`) owns `project_leads` toggle | upheld | Named `renderConversations` explicitly in Spec §5 |
| mechanics | minor | Rollout must note restarting already-running assistant session for new role rules | upheld | Added Activation / Rollout note in Spec §6 |
| mechanics | minor | Playwright command must use `npm --prefix viewer run test:browser -- ...` for Firefox coverage | upheld | Updated Playwright command in Spec §7 |
| mechanics | minor | Validation list omitted `node --test machine/test/name-guard.test.js` | upheld | Added `node --test machine/test/name-guard.test.js` to Spec §7 |
| mechanics | minor | Validation list should specify required assertions for new actions and refresh behavior | upheld | Added required test assertions per suite in Spec §7 |

### Round 2 — 2026-11-28

**Changed since Round 1:**
- Replaced `settings-ops.js` extraction with exported `routes.invokeSettings` adapter in `viewer/app/routes.js` (Spec §3–§4, Decision 9).
- Added optional `--section` and `--include-history` flags to `wc.js assistant settings`, omitting `lesson_history` by default (Spec §2, §4, §6, Decision 11).
- Required `revision` on `background` `remove` (propagating 409 conflict to re-confirm), and added `project_leads: "off"` and `lesson-waiting` `action: "discard"` to the confirmation list (Spec §4, §6, Decision 10).
- Rewrote Spec §5 live refresh to reuse `window.wcPoller`, order GETs against local writes (`localWriteGen`/`inFlightWrites`), track deferred repaints via `renderedSlices` + `focusout` flush, guard templates by actual `draft` dirtiness rather than open state, rebase `styleDraft`/`balDraft` untouched fields, use `keepLessonEdits()`/`showLessonLost()` on external lesson removal, update only the Shared tools repo `<select>` in place, refresh `/usage` and `/harnesses` on account/harness changes, and name `renderConversations`.
- Added activation/rollout note (Spec §6), fixed Playwright command for Firefox coverage, added `name-guard.test.js`, and added concrete required test assertions (Spec §7).

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-28: IDEA.md confirmed (`mode: thorough`). Checked `session leads`: only one active thread (`75365a4c3d07`, "Add account button under each provider", verifying a small UI fix in `renderAccounts`); no overlap.
- 2026-11-28: All Open Questions settled; checked `session leads` again before `ready-for-review` (`75365a4c3d07` still the only active thread, now Verified; no overlap). Set `status: ready-for-review`.
- 2026-11-28: Round 1 triaged (18 findings upheld: 1 blocking, 8 major, 9 minor; 0 declined). All 18 resolved in Spec and logged; starting Round 2.
