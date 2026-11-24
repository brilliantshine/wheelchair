---
slug: contributing-law
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-24
---

# Follow a project's CONTRIBUTING.md as repo law

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: How do agents get CONTRIBUTING.md?
- **Context:** Role instructions are composed before the session's checkout exists (MAP.md; `machine/service.js:200-211,816-825`). Whether a CLI loads project files itself is not guaranteed.
- **Options:** (a) a rule in each role file: read CONTRIBUTING.md from your checkout before changing or judging anything; (b) the machine pastes the file's text into each session's instructions at start.
- **Recommendation:** (a). Works the same for every provider, reads the version in the agent's own checkout (a worker's branch may change it), costs nothing for projects without one. (b) needs a machine change, reads a possibly different copy, and adds its full text to every session.

### Q2: Do verifiers run the validation commands CONTRIBUTING.md asks for?
- **Context:** Wheelchair's own CONTRIBUTING.md asks for area and full validation (`CONTRIBUTING.md:73-93`). Verifiers today run the Spec's validation commands. The "Faster verification checks" thread is working to make checks shorter.
- **Options:** (a) yes, every command it requires for the touched areas; (b) only the Spec's commands; the lead copies CONTRIBUTING.md's required commands into the Spec while planning, so they are run once, deliberately.
- **Recommendation:** (b). One list of commands, decided at planning, keeps check time predictable.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part. | Collin's pick. | user |
| 2 | "CONTRIBUTING.md" means the first of `CONTRIBUTING.md`, `.github/CONTRIBUTING.md`, `docs/CONTRIBUTING.md` at the repository root, the order GitHub uses. Files with other casing or names are not law. | Matches where GitHub finds it; one file per project. | defaulted |
| 3 | Where CONTRIBUTING.md clashes with wheelchair's role rules on how agents coordinate (how to commit, push, open PRs, start sessions, cards), the role rules win and the agent names the clash in its report. On the project's code, files, layout, tests and docs, CONTRIBUTING.md wins. | Agents cannot run outside wheelchair's mechanics (e.g. Codex cannot write `.git`); everything else is the project's call. | defaulted |
| 4 | The verifier judges only what this thread changed against CONTRIBUTING.md, not breaks already on the default branch. | A thread should not inherit unrelated cleanup. | defaulted |
| 5 | A CONTRIBUTING.md break in the change is must-fix: added to `realism.md`'s always-fixed list, never deferred as hardening. | "Repo law" means it is not optional. | defaulted |
| 6 | Steps-only verifiers (Check it yourself) and asides are unchanged. | They judge steps or answer questions; they change nothing. | defaulted |
| 7 | No mockups: nothing on screen changes. | Protocol-only change. | defaulted |

## Spec

(Grows as decisions land.)

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
