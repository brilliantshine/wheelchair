---
slug: escaped-keys
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-26
---

# Hide keys printed in escaped form

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first.
**Map:** `MAP.md`. **Parent plan:** `docs/plans/tool-keys/PLAN.md` (K4; Decisions 17, 19, 20, 23; Review Rounds 4-7).

## Open Questions

### Q1: Replace an escaped key with `[key]`, or withhold the whole stream?
- **Context:** The parent's last design withheld the whole stdout or stderr when any escaped spelling was found, because it decoded the whole stream and could not point back at where the key was. A per-key matcher finds exactly where each escaped spelling starts and ends, so it can replace just that stretch, the same as a plain key.
- **Options:** (a) replace the stretch with `[key]`; (b) withhold the stream with a one-line notice.
- **Recommendation:** (a): equally safe, and the agent keeps the rest of the output.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Escape forms caught: `\uXXXX` (hex any case), `\xXX`, a backslash before any character (covers `\/` and `\\`), and `%XX` (hex any case). HTML entities (`&#43;`) and other forms are not caught; the guide says so | Collin's limit in the parent (Decision 20): JSON/backslash and percent escapes | defaulted |
| 2 | Layers: each key character may be spelled as itself or by one of those escapes, and each character of that spelling may in turn be escaped, up to three layers deep, mixed in any order | Covers `%252B`, `\\u002B`, `%5Cu002B`; Collin's three-layer limit | defaulted |
| 3 | Matching runs per key, looking for a spelling starting at every position, never by decoding the whole stream first | Whole-stream decoding misses a key after a stray `%` (parent round 7, `progress=100%41CD%2BEFGH`) | defaulted |
| 4 | At a cut edge, trimming also passes over `%` and `\` (not only usable key characters), so no piece of an escaped key survives at a cut | `%` and `\` are separators today, so an escaped fragment can survive a cut (MAP.md) | defaulted |

## Spec

Grown as decisions land.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
