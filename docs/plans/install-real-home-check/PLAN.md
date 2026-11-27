---
slug: install-real-home-check
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-26
---

# Install tests: only check wheelchair's own files in the real folder

**Idea:** `IDEA.md`. Map: `MAP.md`, detail in `docs/maps/install-real-home.md`.

## Open Questions

### Q1: Which of wheelchair's files does the real-folder check compare?
- **Context:** The code the install suite runs (`install.sh` and its children) can write only
  `~/.wheelchair/models` and `~/.wheelchair/.lock` there (`codex/model.sh:45,143-164,455-456`;
  nothing in `install.sh` seeds accounts, runs agy discovery or touches `installs/`). The live
  app also writes wheelchair files there during a run: account metadata
  (`connectors/common.js:9-14`), `agy-models.json` (`codex/model.sh:290-324`), `installs/`
  logs, results and PIDs (`machine/lib/harness-install.js:39-49,128-133`). Those live writes
  are what drew the blocking findings in the earlier attempt
  (`docs/plans/load-flaky-tests/PLAN.md:328`).
- **Options:** (a) only the files the installer can write, byte for byte; (b) every file
  wheelchair writes there, including the live app's (the earlier design).
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode is thorough | Collin's pick | user |
| 2 | Carried over from `docs/plans/load-flaky-tests/` Decisions 6 and 8: byte-check only what wheelchair itself writes in the real folder, listing wheelchair's files rather than skipping the AI tools' files | AI-tool file names change by version and event | user |

## Spec

(Grows as decisions land.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
