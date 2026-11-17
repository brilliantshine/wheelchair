---
slug: startup-growth-warning
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Warn when agent sessions start bigger again

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: What counts as "sessions grew"?
- **Context:** The lean-sessions plan's rule (newest-3 median vs earlier-20 median per role and project, +5,000) drew most of that plan's review findings: brief sizes and role-text edits move it too, and it needs a long history. Every Claude transcript record carries the Claude Code version (`"version": "2.1.326"`), and the thing we want to catch is an update.
- **Options:** (a) per role, compare the median startup of sessions on the newest Claude Code version with the previous version's, warn at +5,000 with at least 3 samples on each; (b) a fixed limit per role kept in code (e.g. worker 25,000, lead 32,000); (c) the cut design's recent-vs-earlier median.
- **Recommendation:** (a): it ties the warning to the cause, needs only a few samples, and a role-text edit within one version never trips it.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Measure startup tokens, not the tool list | Deferred tools appear only as a placeholder in transcripts, and the request-shape record is undocumented (MAP.md §5); token usage on the first assistant record is stable | defaulted |
| 2 | The machine records each Claude session's startup sample when it handles that session's first Stop hook: it reads the first usable assistant record (model not `<synthetic>`, input + cache write + cache read > 0) from the transcript path it already gets, and appends `{at, kind: "startup", cli_session_id, cli_version, startup_tokens}` to the session ledger once per session | Stop already carries `transcript_path` (MAP.md §3–4); one line per session keeps the check a ledger read | defaulted |
| 3 | The lead fetches the warnings itself during its Ready check (a new `wc.js` command backed by a ledger-only machine route) and puts them in an optional `warnings` field on the approval card; the hub stores and draws them and never re-computes them | The hub's Ready gate compares only `ready` (MAP.md §7), so a separate lead-supplied field cannot consume a Start press; no hub cache or background poll is needed — the part of the cut design that drew most findings | defaulted |
| 4 | Any failure in capture or check means no sample or no warning, never an error on a start, hook, card or build | IDEA.md constraint | defaulted |

## Spec

To be written as decisions land.

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
