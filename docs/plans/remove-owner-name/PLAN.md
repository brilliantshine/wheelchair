---
slug: remove-owner-name
status: approved   # planning | ready-for-review | approved | implementing | verifying | done
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
| 9 | The restart/import context the hub sends a lead relabels the stored owner tag `collin` as `user` (message `source`, import history `who`, card `resolved_by`), on copies only; the screen keeps showing "You" | Stored tags otherwise reach the lead's prompt and reintroduce the name; one agent-facing value avoids two names for the same tag | review-round-1 |

## Spec

### Goal
No text that reaches an agent, and no text shown in the app, hard-codes the owner's name
"Collin". The person using wheelchair is called "the user" (capitalised "The user" at the
start of a sentence) and referred to with they/them/their. Behaviour is otherwise unchanged.

```mermaid
flowchart LR
  A[Agent rules and router files] -->|reworded: "the user", they/them| P[Agent prompt]
  B[Prompt lines built in Settings] -->|reworded| P
  C[Saved thread data, still tagged collin] -->|copy relabelled to user| X[Restart or import context] --> P
  C -->|shown as You| UI[Thread page]
  M[Missing sudo helper message] -->|reworded| UI
```

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
- Lead context: `viewer/app/threads.js` (the `[wc:context restart|import]` state built
  around lines 138-150). In the JSON sent to the lead, replace the value `collin` with
  `user` in: each `recent_messages[].source`, each `import.history[].who`, and
  `resolved_by` on every card in `cards` and every card object in `pinned`. Work on copies:
  `thread.sent`, `thread.cards`, `thread.pinned` and `thread.imported` on disk keep
  `collin`. Other values pass through unchanged. The serialized context must contain no
  case-insensitive "collin" coming from these tags (text a person typed is passed as is).
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
4. Example paths: every `/home/collin` example in scope becomes `/home/you`, keeping the
   rest of the path: `protocol/graphs.md` (URL-encoded `%2Fhome%2Fyou%2F...`) and
   `protocol/app/lead.md` (step 10 path map example: `/home/you/projects/personal/wheelchair`). The sensitivity template keeps `{{WHEELCHAIR_ROOT}}`.
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
2. After the rewrite, `git grep -n -i -w -E 'he|him|his|himself' -- protocol`: every
   remaining hit refers to something other than the user (today about 89 hits, nearly all
   about the user, e.g. `protocol/app/lead.md:37`; after the change, expected none).
3. `git grep -n "finished at the user's choice" -- protocol/app/sub-lead.md` shows the
   writer (step "Defer them and finish") and the reader in step 1a.
4. `bash machine/test/run.sh`, `node --test viewer/test/*.test.js` and
   `npm --prefix viewer run test:browser` pass.
5. A browser or unit test shows an imported history entry with `who: 'collin'` rendered as
   `You` on the thread page.
6. A test in `viewer/test/app-handoff-restart.test.js` (or `app-hub.test.js`) restarts a
   lead on an imported thread that has a typed message, a `collin`-resolved needs card and
   imported history with `who: 'collin'`, and asserts the delivered context has `source`
   `user`, `resolved_by` `user` and `who` `user`, while the thread's stored state still has
   `collin`. The test also puts a card record with `resolved_by: 'collin'` into
   `thread.pinned` directly and asserts it is `user` in the delivered `pinned` and still
   `collin` in saved state.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Rename stored identifiers: `collin_at`, message source `'collin'`, `resolved_by: 'collin'`, handoff `who: 'collin'` | Never shown to agents or on screen; needs conversion of saved threads and handoff compatibility | planning | MAP.md §3 and `docs/maps/owner-name-state.md`: thread JSON, sent JSONL, handoff v1 enum (`viewer/app/handoff.js:29`, `handoff-import.js:13`), API.md:22. Old files must still import; decide old-reader export compatibility |
| D2 | Rewrite code comments that mention Collin | Not read by agents at runtime or shown on screen | planning | MAP.md §4 and the runtime files in §3 (e.g. `viewer/app/sessions.js:476`, `viewer/pages/thread.js:433`, `viewer/server.js:499`) |
| D3 | Rewrite remaining test and fixture mentions | Tests stay green either way; captured fixtures are historical | planning | MAP.md §4 list, minus the tests updated under Decision 7 |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A restart/import context message already queued before the upgrade is delivered later with the old `collin` tags | Needs a lead waiting (e.g. for an account) across the upgrade; one-off and harmless (a data tag, not prose) | 2 |
| `wc.js session list --full` shows queued messages with `source: "collin"` | No rule tells agents to use `--full`; it is a data tag, not wording; D1's rename removes it | 2 |

## Review Rounds

### Round 1 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent + mechanics | major / blocking | Restart/import context still sends stored `collin` tags to the lead | upheld (major: a worker would build it incompletely but the Goal states the rule) | Spec "Lead context" item, Decision 9, Validation 6 |
| intent | major | `protocol/app/lead.md:506` home path example not covered by rule 4 | upheld | Rule 4 covers every `/home/collin` example |
| intent | minor | Pronoun check's "expected: none" reads as true today | upheld | Validation 2 says it is the post-change result |
| intent | minor | Two names for one stored tag | upheld | Decision 9 names `user` for agents, "You" on screen |
| mechanics | minor | Pronoun check is case-sensitive, misses `He` at `lead.md:37` | upheld | Validation 2 uses `-i` |

### Round 2 — 2026-11-19

**Lanes:** intent: claude; mechanics: non-claude; cross-family: yes.

**Changed since Round 1:**
- New Spec item "Lead context": restart/import context relabels stored `collin` tags as `user` (Decision 9).
- Rule 4 now covers every `/home/collin` example, including `protocol/app/lead.md` step 10.
- Validation 2 is case-insensitive and stated as a post-change result; new Validation 6.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | — | No findings | — | — |
| mechanics | major | Pre-upgrade queued restart/import context keeps old tags | downgraded to minor, accepted-risk: only a lead queued across the upgrade (`viewer/app/sessions.js:846-855`); a worker needs no answer to build the Spec | Accepted Risks |
| mechanics | major | `session list --full` exposes queued `source: "collin"` | downgraded to minor, accepted-risk: `--full` appears in no protocol file (`git grep -- --full protocol` empty); a data tag D1 renames | Accepted Risks |
| mechanics | minor | Validation 6 does not cover `pinned` | upheld | Validation 6 seeds and asserts a pinned record |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
