---
slug: owner-name-identifiers
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Finish removing the owner name

**Idea:** `IDEA.md` — read it first. Map: `MAP.md`, `docs/maps/owner-name-state.md`,
`docs/maps/owner-name-identifiers-inventory.md`. Follows plan `remove-owner-name` (PR #123).

## Open Questions

### Q1: What do exported handoff files say for the user's entries?
- **Context:** v1 export writes `who: "collin"`; v1 import allows only `collin`, `lead`,
  `app` (`viewer/app/handoff.js:28-29`). An older install rejects a new `who` value
  (422 `invalid history`) and a new version number (`unknown format or version`).
- **Options:** (A) keep writing v1 with `collin` on the wire, translating at the boundary;
  older installs keep importing, the name stays in exported files. (B) write version 2 with
  `user`; import accepts v1 and v2; an older install refuses new files with "unknown format
  or version" until updated. (C) write `user` under v1; older installs fail with a vaguer
  "invalid history".
- **Recommendation:** B.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | New stored names: thread field `user_at` (replaces `collin_at`); message/queue source `'user'`; card `resolved_by: 'user'`; imported history `who: 'user'` | Neutral, matches the restart context's existing `asUser` relabel | defaulted |
| 2 | Old saved threads are converted when read: one normaliser maps `collin_at`→`user_at` and every `'collin'` source, `resolved_by` and imported `who` to `'user'`, in thread JSON (both queue copies, `sent`, cards, `imported.history`) and in-memory session queues; the converted form is written at the next save | One conversion point instead of dual readers scattered across pages and app code | defaulted |
| 3 | `threads/<id>.sent.jsonl` overflow lines are left as written | Nothing reads them (`viewer/app/state.js:96` is the only reference; export and restart read `thread.sent`); rewriting an append-only archive adds risk for no reader | defaulted |
| 4 | Captured fixtures (`machine/test/fixtures/agy/`, `codex-steps/`) are left as recorded | Their only mentions are `/home/collin` paths and the Linux user name, which IDEA.md excludes | defaulted |

## Spec

(Grows as decisions land.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
