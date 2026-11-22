---
slug: lessons-hardening
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Make agent lessons solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

_None._

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
| 1 | Mode: thorough | Chosen by Collin before planning | user |
| 2 | Every change to a lesson (agent add/replace/remove, Settings edit/remove, restore, import) records the previous version with who changed it and when; up to 20 versions per lesson are kept, oldest dropped first | Enough to undo any realistic run of changes without growing settings without bound | defaulted |
| 3 | Removed lessons stay findable in Settings with their history (the 50 most recently removed across all agent types) and can be restored | "A removed lesson can be found again" (IDEA.md) needs a home for them | defaulted |
| 4 | Restoring is a user action: the restored lesson is marked "(edited by the user)" | Matches how Settings edits already make a lesson user-owned (`viewer/app/routes.js:229`) | defaulted |
| 5 | Restoring a removed lesson into an agent type that already has 12 is refused with a plain message to remove one first | The cap of 12 stays (IDEA.md Constraints) | defaulted |
| 6 | Lessons travel two ways: Export/Import of a lessons file in Settings, and handoffs carry lessons automatically; both use the same merge rule | Q1 answered "File and handoffs" | user |
| 7 | A project-only lesson in a handoff is re-scoped to the project path the thread is imported into; in a file import it keeps its path | The exact path differs between installs (`viewer/app/settings.js:183`); a handoff knows the destination, a file does not | defaulted |
| 8 | Handoffs from an install without lessons support still import; an install without support importing a newer handoff is out of scope (it refuses version 3 with its existing message) | IDEA.md Constraints name only the first direction | defaulted |
| 9 | Incoming lessons are added automatically: matched by agent type + exact text (trimmed); a match is skipped; a new one is added with a new local id, saved_by and only_ai kept; nothing existing is overwritten; lessons that would take a type past 12 wait in a "Waiting to add" list in Settings where Collin adds (after removing one) or discards each | Q3 answered "Add automatically" | user |
| 10 | A lesson is marked possibly stale after 90 days since it was last saved, edited, restored or kept; a Keep button in Settings clears the mark; agents are unchanged | Q2 answered "Age only" | user |
|   |          |           | user / defaulted / adopted / idea-change / review-round-N |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

Terms. A **lesson** is an entry in `settings.lessons[<role>]` (`viewer/app/settings.js:282-288`): `{id, text, provider?, project?, saved_by: 'agent'|'user', thread?, saved_at}`. **Role** is one of the agent types in `ROLES`. "Settings" is the "Lessons learned · <role>" editor reached from the Templates section (`viewer/pages/settings.js:894`, list item `:936-958`).

### S1 Storage

All new data lives in the hub's `settings.json` beside `lessons`, read and written through the existing serialized `update` (`viewer/app/settings.js`), and `normalize` (`:265`) must keep it (dropping only invalid entries, as it does for lessons):

- `lessons[role][i].kept_at` (optional ISO time): set by Keep (S4).
- `lesson_history`: object keyed by lesson id. Each value is `{ role, versions: [...], removed?: { at, by } }`. A version is a copy of the lesson's fields as they were before a change (`text, provider?, project?, saved_by, saved_at, kept_at?`) plus `changed_at` (ISO time of the change that replaced it) and `changed_by`: `agent` | `user` | `import`. Newest last. At most 20 versions per id; the oldest is dropped first. `removed` is present when the lesson is not in `lessons` any more.
- At most 50 ids may have `removed`; when a removal would make 51, the entry with the oldest `removed.at` is deleted from `lesson_history` entirely. An id with no `removed` whose lesson no longer exists in `lessons` is dropped by `normalize`.
- `lesson_waiting`: array of `{ role, text, provider?, project?, saved_by, saved_at, kept_at?, source: 'file'|'handoff', received_at }`, at most 50 (oldest `received_at` dropped first), no two with the same role and text.
- New lesson ids are never ids already present in `lessons` or `lesson_history` (extend the uniqueness loop at `:212`).

### S2 Recording history

Every change to an existing lesson appends that lesson's previous state to its history, in the same `update` as the change:

| Change | Where | `changed_by` | Effect on history |
|---|---|---|---|
| Agent `replace` that changes the lesson | `applyLesson` (`settings.js:191`) | `agent` | append previous |
| Agent `remove` | `applyLesson` | `agent` | append previous; set `removed: {at, by: 'agent'}` |
| Settings edit (text changed) | `PUT /settings/lessons/:role` (`routes.js:224`) | `user` | append previous |
| Settings removal | same route | `user` | append previous; set `removed: {at, by: 'user'}` |
| Restore (S3) | new route | `user` | append the current state if the lesson exists |

No-op changes (identical retry, unchanged text) record nothing. An agent `add` creates no history entry. History never appears in agents' starting instructions: `lessonBlocks` (`:181`) keeps reading only `lessons`.

### S3 History and restore in Settings

In each role's editor:

- Each lesson row has a "History (N)" toggle when it has versions. Expanded, it lists versions newest first: the text, "by an agent" / "by you" / "imported", and the date it was replaced (`changed_at`). Each version has **Restore**.
- Below the current lessons, a **Removed** section lists that role's removed lessons (newest removal first): last text, who removed it and when, its History toggle, and **Restore**.
- Restore sets the lesson's fields to that version's `text`, `provider`, `project`, with `saved_by: 'user'` and `saved_at` now (Decision 4); it keeps the same id. Restoring a removed lesson puts it back at the end of `lessons[role]` and deletes `removed`.
- Restoring a removed lesson when the role already has 12 is refused (422) with "<Role> lessons are full (12): remove one before restoring"; Settings shows that sentence.
- The Templates list shows a role's "Lessons learned" item when it has current lessons, removed lessons or waiting lessons (today only current, `:939`).
- Pending unsaved edits in the editor are not lost by a restore: restore is disabled while the editor has unsaved changes, with the hint "Save or undo your changes first".

### S4 Possibly stale

- A current lesson is **possibly stale** when now − max(`saved_at`, `kept_at`) ≥ 90 days.
- Its row in Settings shows "Possibly out of date: not changed or kept since <date>" and a **Keep** button. Keep sets `kept_at` to now (no history entry, `saved_by` unchanged), and the mark goes away.
- The Templates list item for that role shows the count of possibly stale lessons beside its lesson count (e.g. "5 · 2 may be out of date").
- Agents are unchanged: no prompt text, card field or rule mentions staleness.

### S5 Merging incoming lessons

One function merges a list of incoming lessons (from S6 or S7) in a single `update`, and returns `{added, skipped, waiting}` counts. For each incoming lesson, in order:

1. Validate it like `normalize` does (role in `ROLES`, `validLessonText`, known provider, `saved_by` agent|user, valid `saved_at`); invalid ones are skipped and counted in `skipped`.
2. **Match** on role + exact text (both trimmed). If a current lesson matches, or a removed lesson's last version matches, or a waiting entry matches, skip it.
3. Otherwise, if the role has fewer than 12 current lessons, add it with a new local id, keeping `text, provider, project, saved_by, saved_at, kept_at`; drop `thread`. Record no history.
4. Otherwise put it in `lesson_waiting` with its `source` and `received_at` now.

Nothing existing is overwritten. Running the same merge twice changes nothing the second time (step 2), so a retried handoff import is safe.

In each role's editor, a **Waiting to add** section lists that role's waiting lessons with **Add** and **Discard**. Add is disabled while the role has 12, with "Remove one first"; Add appends it as in step 3 and removes it from the list. Discard removes it.

### S6 Lessons file: Export and Import in Settings

- The Templates section of Settings gets **Export lessons** and **Import lessons** buttons.
- Export downloads `wheelchair-lessons.json`: `{ format: 'wheelchair-lessons', version: 1, exported_at, lessons: { <role>: [ {text, provider?, project?, saved_by, saved_at, kept_at?} ] } }` with every current lesson of every role. No ids, threads, history or waiting entries.
- Import takes such a file (≤ 1 MB). A file whose `format`/`version` doesn't match, that isn't JSON, or whose `lessons` isn't an object of arrays is refused whole with a plain message ("This isn't a wheelchair lessons file"). Otherwise S5 runs with `source: 'file'`; project paths are kept as they are (Decision 7). Settings then shows "Added A, skipped S already here, W waiting for room" and refreshes.

### S7 Handoffs carry lessons

- `buildHandoffFile` (`viewer/app/handoff.js:58`) writes `version: 3` and a top-level `lessons` array: every current lesson of every role as `{role, text, provider?, project?, saved_by, saved_at, kept_at?}`, except a project-only lesson whose `project` is not the thread's project, which is left out. A project-only lesson for the thread's project is written with `project: true` (meaning "the thread's project").
- `validateHandoffFile` (`:12`) accepts versions 1, 2 and 3; `lessons` is allowed (optional) only for version 3 and must be an array of objects; a malformed entry is dropped, not a reason to refuse the file. Version 3 history is treated like version 2 (`:29`, `:31`).
- On import, once the thread is applied (`viewer/app/handoff-ops.js` `runLocked`, `:73`), S5 runs on the file's lessons with `source: 'handoff'`, turning `project: true` into the destination project path (`targetProject` in `handoff-import.js`). This happens on every path that applies a handoff (create and advance). It is idempotent by S5 step 2, so a retried or resumed operation may run it again.
- A version 1 or 2 file imports exactly as today (IDEA.md Constraints). An older install refusing a version 3 file is accepted (Decision 8).

### S8 Not changing

- The `lesson` card, its fields and receipts, `applyLesson`'s rules (access matrix, cap, user-edited protection), the thread notice, and what agents see at start.
- Lessons remain user-protected through every path here: restore marks `saved_by: 'user'`; import keeps an incoming `saved_by: 'user'`.

### S9 Validation

From `viewer/`:

- `npm test` passes, including new node tests in `test/app-lessons.test.js` (or a new `test/app-lessons-history.test.js`) covering: each S2 row records history with the right `changed_by`; 20-version and 50-removed caps; normalize keeps `kept_at`, `lesson_history`, `lesson_waiting` and drops invalid entries; restore of a version and of a removed lesson, refusal at 12, `saved_by: 'user'` after restore; new ids avoid history ids; stale at 90 days and Keep clearing it; S5 match/skip/add/waiting and running it twice; file export/import round-trip and refusal of a non-lessons file; handoff v3 export with the project filter and `project: true`, import into another project path, v2 file import unchanged, a retried import adding nothing new; `lessonBlocks` output unchanged by history, waiting and `kept_at`.
- Existing handoff tests (`test/app-handoff*.test.js`) pass, updated only where they assert `version: 2` on export.
- `npx playwright test test/app-lessons.spec.js test/app-handoff.spec.js` passes, with new browser cases: History toggle and Restore; Removed section and Restore; stale mark and Keep; Waiting to add Add/Discard; Export then Import showing the counts.

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

### Round 1 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
|           | pre-existing / partial | | high / low |

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
