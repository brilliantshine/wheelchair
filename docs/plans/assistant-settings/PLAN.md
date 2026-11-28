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

## Spec

### 1. Overview & Boundaries

Let the personal assistant read and update hub-stored settings through `wc.js assistant`, reusing the hub's existing Settings validators and side effects, while keeping an open Settings page in sync automatically.

- **In scope (personal assistant only; project leads never have access):**
  - Read current hub settings (`settings` action), including `settings.describe(hub)` + `reserved_provider`, `diagram_sensitivity`, and `background` metadata. Never exposes secret values (project keys, shared keys, sign-in tokens).
  - Write hub-stored settings (`setting` action) across the supported targets below:
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
  - Saved directories (`saved-dirs`), lesson export/import, style preview, and prompt preview are not write targets (reading settings already returns current style, templates, and lessons).

### 2. CLI Surface (`viewer/app/wc.js`)

Extend `assistantRequest(operation, tail, projectLead)` in `viewer/app/wc.js`:

- Add `'settings'` and `'setting'` to the personal assistant allowlist ONLY (when `projectLead` is false). `projectLead === true` MUST continue to reject `'settings'` and `'setting'` with `'unsupported assistant action'`.
- **`wc.js assistant settings`** (read-only):
  - Sends `POST /assistant` with `{ action: 'settings' }`.
  - Retries on HTTP 503 ("hub unavailable") using `postSessionWithRetry`, the same as `projects`, `threads`, and `thread`.
  - Prints one JSON line.
- **`wc.js assistant setting <target> --file <json-file>`** (write):
  - Requires positional `<target>` (`parsed._[0]`) and `--file <json-file>` (`parsed.file`). If either is missing, throw `'setting requires <target> and --file'`.
  - Reads `<json-file>` as UTF-8 and parses JSON; if invalid JSON or not a plain JSON object (null, array, or primitive), throw `'setting --file must contain a JSON object'`.
  - Sends `POST /assistant` with `{ action: 'setting', target: parsed._[0], payload }`.
  - **Never retries automatically on 503** (only `settings` is added to the read-retry allowlist in `wc.js`).
  - Prints one JSON line (`{"ok":true,...}` on success; `{"ok":false,"error":...}` on failure, exit 0, matching existing `wc.js assistant` behavior).

### 3. Shared Settings Operations (`viewer/app/settings-ops.js`) & Hub Routes (`viewer/app/routes.js`)

Extract the hub's settings read/write business logic into a shared module `viewer/app/settings-ops.js` (and add `settings-ops.js` to the file table in `viewer/AGENTS.md` per `CONTRIBUTING.md`) so `viewer/app/routes.js` and `viewer/app/assistant-actions.js` share one authoritative implementation for validation, `settings.update`, `guardLeadLadder`, `projectLead.change`, `codex/model.sh`, install-cancel fanout, `diagramSensitivity`, and `background.commit`.

`viewer/app/routes.js` delegates its existing `handleSettings` endpoints to `settings-ops.js` with zero behavioral change to browser HTTP status codes or response bodies.

### 4. Hub Assistant Dispatcher (`viewer/app/assistant-actions.js`)

- In `dispatch(hub, input)` (personal assistant only), pass `allowSettings: true` in `policy`. Project-lead callers do NOT pass `allowSettings: true`.
- In `run(hub, input, policy)`:
  - If `action === 'settings'` or `action === 'setting'`:
    - Require `policy.allowSettings === true`; otherwise throw `appError(403, 'only the personal assistant may do that')`.
    - Do not require `input.thread`.
  - **`action === 'settings'`**:
    - Return `{ ...await settings.describe(hub), reserved_provider: await reservedLabel(hub, await settings.load(hub)), diagram_sensitivity: await diagramSensitivity.read(hub), background: await background.metadata(hub) }`.
  - **`action === 'setting'`**:
    - Require `typeof input.target === 'string' && input.target.trim()` and `input.payload` to be a plain non-null, non-array object; otherwise throw `appError(400, 'target and object payload are required')`.
    - Dispatch by `input.target`:
      1. `preferences`: if `Object.hasOwn(payload, 'assistant')`, throw `appError(403, 'the assistant cannot change its own on/off setting; change it under Settings → Assistant and project leads')`. Otherwise run the shared `PUT /settings/preferences` logic (including `guardLeadLadder` and `projectLead.change` when `project_leads` changes) and return `{ ok: true, result }`.
      2. `style`: run shared `PUT /settings/style` logic; return `{ ok: true, result }`.
      3. `diagram-sensitivity`: run `diagramSensitivity.write(hub, payload)`. Invalid `level` throws `appError(400, ...)`. On `status === 200`, return `{ ok: true, result: res.body }`. On non-200 (partial/all machine failure, e.g. 502), return `{ ok: false, error: 'one or more machines did not update diagram sensitivity', result: res.body }` (HTTP 200 so the assistant receives the per-machine `machines` map and can report which machine failed).
      4. `background`: accept `payload.action === 'opacity'` (requires integer `payload.opacity` 0–100; reads current `background.metadata(hub)`; if `!current.image_id`, throw `appError(400, 'no background image is set')`; calls `background.commit(hub, current.revision, payload.opacity, current.image_id, current.media_type, null)`) or `payload.action === 'remove'` (reads current metadata; calls `background.commit(hub, current.revision, 35, null, null, null)`). Any other `action` throws `appError(400, 'background action must be opacity or remove')`. Return `{ ok: true, result }`.
      5. `harness`: requires `payload.provider` (string) and `payload.enabled` (boolean); runs shared `PUT /settings/harnesses/:provider` logic (including `guardLeadLadder` and install-cancel fanout when disabling); return `{ ok: true, result }`.
      6. `account-add`: runs shared `POST /settings/accounts` logic with `payload` (`{ provider, name, plan }`); return `{ ok: true, result }`.
      7. `account-update`: requires `payload.id` (string); runs shared `PUT /settings/accounts/:id` logic with remaining fields (`name`, `plan`, `weight`, `paused`); return `{ ok: true, result }`.
      8. `account-remove`: requires `payload.id` (string); runs shared `DELETE /settings/accounts/:id` logic; return `{ ok: true, result }`.
      9. `account-restore`: requires `payload.id` (string); runs shared `POST /settings/accounts/:id/restore` logic; return `{ ok: true, result }`.
      10. `balancing`: runs shared `PUT /settings/balancing` logic (including `guardLeadLadder`); return `{ ok: true, result }`.
      11. `model`: runs shared `PUT /settings/models` logic (`{ provider, slot, model, effort? }`); return `{ ok: true, result }`.
      12. `models-heads-up`: runs shared `POST /settings/models/heads-up` logic (`{ action: 'switch' | 'skip' | 'reset', tier?, model? }`); return `{ ok: true, result }`.
      13. `template-create`: runs shared `POST /settings/templates` logic; return `{ ok: true, result }`.
      14. `template-update`: requires `payload.id` (string); runs shared `PUT /settings/templates/:id` logic with the rest of `payload`; return `{ ok: true, result }`.
      15. `template-delete`: requires `payload.id` (string); runs shared `DELETE /settings/templates/:id` logic; return `{ ok: true, result }`.
      16. `lessons-update`: requires `payload.role` (string); runs shared `PUT /settings/lessons/:role` logic with `{ edits: payload.edits, removals: payload.removals }`; return `{ ok: true, result }`.
      17. `lesson-restore`: requires `payload.role`, `payload.id`, `payload.vid`; runs shared `POST /settings/lessons/:role/restore` logic; return `{ ok: true, result }`.
      18. `lesson-keep`: requires `payload.role`, `payload.id`; runs shared `POST /settings/lessons/:role/keep` logic; return `{ ok: true, result }`.
      19. `lesson-waiting`: requires `payload.role`, `payload.wid`, `payload.action`; runs shared `POST /settings/lessons/:role/waiting` logic; return `{ ok: true, result }`.
      - Any other `target` throws `appError(400, 'unsupported setting target')`.

### 5. Live Refresh on the Settings Page (`viewer/pages/settings.js`)

Keep an already-open Settings page in sync when settings change externally (for example, via the assistant popup or another tab) without disrupting active edits:

- Add a periodic refresh (`setInterval`, every 5,000 ms while `!document.hidden`, plus immediate refresh on `window` `focus` and `document` `visibilitychange` when becoming visible). Prevent overlapping in-flight refreshes with a single in-flight guard; ignore network errors silently so transient blips don't disrupt the page.
- Each refresh fetches `GET /wheelchair/api/settings`. When the active category is `you`, also re-fetch `GET /wheelchair/api/settings/diagram-sensitivity` and repaint `renderDiagrams` if the diagram response changed.
- Compare the newly fetched `/settings` snapshot against the previous `state.settings` per block (using JSON equality on each block's slice of `state.settings`) and **only repaint blocks whose data actually changed**.
- **Dirty / active-edit guard:** Never overwrite a block while the user has unsaved edits or an active focused form control (`input`, `textarea`, `select`) inside that block:
  - `renderName`: skip if `nameDraft` differs from saved `user_name` or the name input is focused.
  - `renderWriting`: skip if the writing style form has unsaved edits (differs from saved `style`) or an input/textarea/select inside its container is focused.
  - `renderAccounts`: skip if the add-account form or an inline account edit form is open/dirty, or an input/select inside its container is focused.
  - `renderThreadView`: skip if `folderDraft` differs from saved `default_project_folder` or an input inside its container is focused.
  - `renderLeadNames`: skip if the custom lead-names input/textarea has unsaved edits or is focused.
  - `renderTemplates`: skip if a template create/edit form is open or an input/textarea/select inside its container is focused.
  - `renderLessons`: skip if a lesson edit is dirty or an input/textarea inside its container is focused.
  - `renderSharedTools`: skip if the shared-repo input has unsaved edits or is focused.
  - All other hub-settings blocks (`renderHarnesses`, `renderBalancing`, `renderAgents`, `renderLadders`, `renderTiers`, `renderEscalation`, `renderAssistants`, `renderPermission`, `renderDiagrams`) repaint cleanly when their slice changed and no input/select inside them is focused.
  - When a block is skipped due to active edits, still update the underlying saved baseline in `state.settings` (without overwriting the user's draft variables) so once the user saves or cancels, the block reflects the latest state.
- `renderBackground` already refreshes via `viewer/pages/background.js` (every 10s + focus/visibility); no duplicate background fetch is needed.

### 6. Assistant Protocol Rules (`protocol/app/assistant.md`)

Update `protocol/app/assistant.md`:

- Replace `"Do not change Settings."` with a **Settings** rule block:
  - You can inspect and change hub settings when Collin asks in chat using `wc.js assistant settings` (read) and `wc.js assistant setting <target> --file <json-file>` (write).
  - Read `settings` first when you need current values or ids (accounts, templates, lessons), and report clearly what changed (before → after).
  - **Confirm first with a `question` card** (naming the exact change and its effect) before applying:
    - Loosening session permissions (`permission_mode: "bypass"`, `codex_mode: "unrestricted"`) or broadening aside access (`aside_access: "full"`).
    - Turning on `auto_merge: "on"` or `auto_merge_delete_branch: "on"`.
    - Disabling an AI provider (`harness` with `enabled: false`).
    - Removing an account (`account-remove`), deleting a template (`template-delete`), removing a lesson (`lessons-update` with non-empty `removals`), removing the background image (`background` with `action: "remove"`), or resetting model pins (`models-heads-up` with `action: "reset"`).
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

### 7. Validation Commands

Targeted tests per area (whole-suite and full-run checks are run by the pusher before push):

- **CLI (`viewer/app/wc.js`):**
  ```bash
  node --test viewer/test/wc-cli.test.js
  ```
- **Hub settings operations, routes, and assistant actions (`viewer/app/settings-ops.js`, `viewer/app/routes.js`, `viewer/app/assistant-actions.js`):**
  ```bash
  node --test viewer/test/assistant.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js
  ```
- **Settings page live refresh and assistant popup UI (`viewer/pages/settings.js`):**
  ```bash
  npx --prefix viewer playwright test viewer/test/app-settings.spec.js viewer/test/app-assistant-popup.spec.js
  ```
- **Protocol (`protocol/app/assistant.md`) & Router (`viewer/AGENTS.md`):**
  - Review rendered prose for consistency with `viewer/app/wc.js` and `viewer/app/assistant-actions.js`, and verify `viewer/AGENTS.md` lists `settings-ops.js`.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-28: IDEA.md confirmed (`mode: thorough`). Checked `session leads`: only one active thread (`75365a4c3d07`, "Add account button under each provider", verifying a small UI fix in `renderAccounts`); no overlap.
- 2026-11-28: All Open Questions settled; checked `session leads` again before `ready-for-review` (`75365a4c3d07` still the only active thread, now Verified; no overlap). Set `status: ready-for-review`.
