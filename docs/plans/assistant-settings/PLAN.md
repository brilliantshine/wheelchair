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

### Q1: Which settings should the personal assistant be allowed to change?
- **Context:** The Settings page has nine categories. Most controls are hub-stored preferences (You, Usage and balancing, Models, Assistant and project leads, Threads, Agent behavior, AI provider toggles/account metadata, Shared tools repo). Others involve browser-only storage ("Enter to send"), interactive machine actions (CLI installs, sign-in codes), machine-local secrets (Project/Shared keys), or opening PRs in project repos (Project tools).
- **Options:**
  1. Hub settings only (all hub-stored settings, excluding logins, installs, secrets, and Project tools PR edits).
  2. Core preferences only (You, Models, Usage & balancing, and non-destructive Threads settings).
  3. Everything the hub can reach (adds CLI installs and Project tools PR edits; still excludes secrets, sign-in codes, and browser-only settings).
- **Recommendation:** Option 1 (Hub settings only).

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

## Spec

To be filled as Open Questions are settled.

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
