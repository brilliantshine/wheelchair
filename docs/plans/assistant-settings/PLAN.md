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

### Q2: When should the assistant ask for confirmation before applying a change?
- **Context:** Some settings are harmless preferences (writing style, tool steps, model choices), while others change safety boundaries or remove data (turning the assistant itself off, loosening session permissions or aside access, enabling auto-merge or branch deletion, removing an account/template/lesson, resetting model pins).
- **Options:**
  1. Ask before risky or destructive changes, apply normal preferences right away.
  2. Apply every requested change right away without a second confirmation.
  3. Always confirm every setting change with a card first.
- **Recommendation:** Option 1 (Ask before risky or destructive changes).

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

## Spec

### Scope & Boundaries

- **Included (read and write via `wc.js assistant`):**
  - **You**: user name, writing style, diagram sensitivity (with per-machine fanout result), background opacity and background removal (not browser-only "Enter to send", not raw image upload from chat unless an attachment path is supported — to be finalized in Spec pass).
  - **AI providers (metadata only)**: enable/disable harness, add/rename/plan/weight/pause/resume/remove accounts, restore default account.
  - **Usage and balancing**: within-provider mode, leave-for-user %, warning %, save provider for leads, lead margin, held-back roles.
  - **Models**: role tiers, review family, per-role provider preferences, assistant/project-lead tiers, lead/worker provider ladders, per-provider model & effort cells, heads-up switch/reset, escalation settings.
  - **Assistant and project leads**: personal assistant on/off, project leads on/off.
  - **Threads**: show/hide tool steps, auto-merge, delete-branch, default project folder, session permission modes, aside access, lead name list.
  - **Agent behavior**: templates (create, edit, duplicate, delete) and lessons (edit, remove, restore).
  - **Shared tools (repo only)**: shared tools repository (`owner/repo` or null).
- **Excluded (manual on the Settings page; refused by hub / explained by assistant):**
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
