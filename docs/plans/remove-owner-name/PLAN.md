---
slug: remove-owner-name
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Remove the owner's name from wheelchair

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
| 1 | Mode is two-part | Chosen on the mode card | user |
| 2 | Pronouns for the person become they/them/their | "he/his" assumes the owner; neutral fits any installer | defaulted |
| 3 | The sub-lead's Log marker `Deferred and finished at Collin's choice` is written with the new wording from now on, and the reader (sub-lead.md 1a) accepts both the old and new phrase | Existing plans already carry the old phrase (`protocol/app/sub-lead.md:32,257`) | defaulted |
| 4 | Example home paths in protocol (e.g. `protocol/graphs.md:493`) use a placeholder such as `/home/you` | Illustrative only | defaulted |
| 5 | Router files agents read (`AGENTS.md:17`, `sudo-helper/AGENTS.md:3`, `protocol/app/AGENTS.md`) are in this thread's scope | They reach agents like the role rules do | defaulted |
| 6 | Imported handoff history shows the stored `who: collin` value as "You" on screen; the stored value itself is not changed | Visible text (`viewer/pages/thread.js:231`) without touching data formats | defaulted |
| 7 | Tests that assert changed strings (e.g. `machine/test/sudo.test.js:91`, `viewer/test/app-settings.test.js:273,278`) are updated in this thread; other test mentions are deferred | Keeps the suites green | defaulted |
| 8 | Agents call the person "the user" | Simplest, fits any install. The user plans a name in Settings later; that can be one added prompt line ("The user's name is X") with no change to the rules' wording, so doing "the user" now costs nothing extra | user |

## Spec

### Goal
No text that reaches an agent, and no text shown in the app, hard-codes the owner's name
"Collin". The person using wheelchair is called "the user" (capitalised "The user" at the
start of a sentence) and referred to with they/them/their. Behaviour is otherwise unchanged.

### Files in scope (all case-insensitive "collin" matches in them)
- Role and card rules: `protocol/app/lead.md`, `sub-lead.md`, `worker.md`, `verifier.md`,
  `aside.md`, `cards.md`, `cards-lead.md`, `protocol/app/AGENTS.md`.
- Other protocol files: `protocol/graphs.md`, `protocol/diagrams.md`, `protocol/sensitivity.md`.
- Routers agents read: `AGENTS.md` (line 17), `sudo-helper/AGENTS.md` (line 3).
- Prompt text built by the hub: `viewer/app/settings.js:144,145,158`
  (`ask the lead, who asks the user.`; `The user’s behavior template for this <role>: ...`).
- Machine message: `machine/service.js:1952` becomes
  `sudo helper not installed on <host>; the user installs it once with: sudo <ROOT>/sudo-helper/install.sh`,
  and the quoted form in `protocol/app/cards-lead.md` (sudo section) matches it.
- Imported handoff history display: `viewer/pages/thread.js:231` shows an entry whose
  `who` is `collin` as `You`; other `who` values unchanged. Stored data is not changed.
- Tests asserting changed strings: `machine/test/sudo.test.js:91`,
  `viewer/test/app-settings.test.js:273,278`, and any other test that fails because of
  the wording changes above.

### Rewriting rules
1. Replace "Collin" with "the user" / "The user"; "Collin's" with "the user's".
2. Pronouns referring to the person (he, him, his, himself) become they, them, their,
   themselves, with verbs agreeing ("they read", not "they reads"). Pronouns referring to
   anything else are untouched.
3. Rewrite only the words needed; do not restructure or reflow paragraphs beyond the
   lines touched. Meaning and every rule stay the same.
4. Example paths: `protocol/graphs.md` uses `/home/you/...` (URL-encoded `%2Fhome%2Fyou%2F...`)
   where it showed `/home/collin`. The sensitivity template keeps `{{WHEELCHAIR_ROOT}}`.
5. Legacy marker: the sub-lead now writes `Deferred and finished at the user's choice`.
   `protocol/app/sub-lead.md` step 1a treats a Log containing either that phrase or the
   older `Deferred and finished at Collin's choice` as the same marker. That one reader line
   is the only allowed remaining "Collin" in scope, and it must say it is the older form.

### Out of scope (see Deferred and IDEA.md)
Stored identifiers (`collin_at`, source `'collin'`, `resolved_by: 'collin'`, handoff
`who: 'collin'`), `viewer/app/API.md` and `machine/API.md` prose about them, code
comments, other test and fixture mentions, and everything under `docs/`.

### Validation
1. `git grep -n -i collin -- protocol AGENTS.md sudo-helper/AGENTS.md viewer/app/settings.js machine/service.js`
   prints exactly one line: the legacy-marker reader in `protocol/app/sub-lead.md`.
2. `git grep -n -w -E 'he|him|his|himself' -- protocol` : every remaining hit refers to
   something other than the user (expected: none).
3. `git grep -n "finished at the user's choice" -- protocol/app/sub-lead.md` shows the
   writer (step "Defer them and finish") and the reader in step 1a.
4. `bash machine/test/run.sh`, `node --test viewer/test/*.test.js` and
   `npm --prefix viewer run test:browser` pass.
5. A browser or unit test shows an imported history entry with `who: 'collin'` rendered as
   `You` on the thread page.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Rename stored identifiers: `collin_at`, message source `'collin'`, `resolved_by: 'collin'`, handoff `who: 'collin'` | Never shown to agents or on screen; needs conversion of saved threads and handoff compatibility | planning | MAP.md §3 and `docs/maps/owner-name-state.md`: thread JSON, sent JSONL, handoff v1 enum (`viewer/app/handoff.js:29`, `handoff-import.js:13`), API.md:22. Old files must still import; decide old-reader export compatibility |
| D2 | Rewrite code comments that mention Collin | Not read by agents at runtime or shown on screen | planning | MAP.md §4 and the runtime files in §3 (e.g. `viewer/app/sessions.js:476`, `viewer/pages/thread.js:433`, `viewer/server.js:499`) |
| D3 | Rewrite remaining test and fixture mentions | Tests stay green either way; captured fixtures are historical | planning | MAP.md §4 list, minus the tests updated under Decision 7 |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
