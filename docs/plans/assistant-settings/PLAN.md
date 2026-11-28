---
slug: assistant-settings
status: planning
created: 2026-11-28
---

# Let the personal assistant change settings

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q3: Should an already-open Settings page update automatically when the assistant changes a setting?
- **Context:** Today the Settings page fetches `/wheelchair/api/settings` once on load and does not poll general settings. If Collin uses the assistant popup while on the Settings page, controls would look stale until reload unless the page refreshes.
- **Options:**
  1. Yes — refresh the open Settings page automatically (without clobbering unsaved edits).
  2. No — keep the current behavior (changes appear on reload or next visit).
- **Recommendation:** Option 1 (Refresh automatically).

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

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

## Spec

### Confirmation Policy

- **Immediate (no extra card):** Everyday preferences (name, writing style, diagram sensitivity, background opacity, model/tier/ladder/effort/escalation choices, balancing settings, tool steps, default project folder, lead names, shared tools repo, creating/editing/duplicating templates, editing/restoring lessons, adding/renaming/pausing/resuming/updating accounts, enabling a provider, enabling/disabling project leads, tightening/turning off permissions or auto-merge).
- **Confirm first with a `question` card:**
  - Loosening session permission modes (switching to unrestricted/bypass) or broadening aside access.
  - Turning on auto-merge or delete-branch.
  - Disabling an AI provider.
  - Removing an account, deleting a template, removing a lesson, removing the background image, or resetting model pins.
  - Any ambiguous request where multiple settings or values could match.

### Scope & Boundaries

- **Included (read and write via `wc.js assistant`):**
  - **You**: user name, writing style, diagram sensitivity (with per-machine fanout result), background opacity and background removal (not browser-only "Enter to send", not raw image upload from chat unless an attachment path is supported — to be finalized in Spec pass).
  - **AI providers (metadata only)**: enable/disable harness, add/rename/plan/weight/pause/resume/remove accounts, restore default account.
  - **Usage and balancing**: within-provider mode, leave-for-user %, warning %, save provider for leads, lead margin, held-back roles.
  - **Models**: role tiers, review family, per-role provider preferences, assistant/project-lead tiers, lead/worker provider ladders, per-provider model & effort cells, heads-up switch/reset, escalation settings.
  - **Assistant and project leads**: project leads on/off (personal assistant on/off is excluded).
  - **Threads**: show/hide tool steps, auto-merge, delete-branch, default project folder, session permission modes, aside access, lead name list.
  - **Agent behavior**: templates (create, edit, duplicate, delete) and lessons (edit, remove, restore).
  - **Shared tools (repo only)**: shared tools repository (`owner/repo` or null).
- **Excluded (manual on the Settings page; refused by hub / explained by assistant):**
  - Turning the personal assistant itself off (refused by the hub; Collin turns it off on Settings → Assistant and project leads).
  - Browser-local "Enter to send" (`localStorage` only).
  - AI provider machine sign-ins / login codes and CLI installations.
  - Project tools (adding/editing/removing tools opens PRs, Windows switch, Unity prep) and Project keys.
  - Shared tools keys (machine-local secrets).
- **Read-only inspection:** The assistant can read current hub settings (and diagram sensitivity / harness status / account metadata, never secret values) to answer questions and show before/after changes.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

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
