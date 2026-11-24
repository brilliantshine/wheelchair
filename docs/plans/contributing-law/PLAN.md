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

### Q2: Do verifiers run the validation commands CONTRIBUTING.md asks for?
- **Context:** Wheelchair's own CONTRIBUTING.md asks for area and full validation (`CONTRIBUTING.md:73-93`). Verifiers today run the Spec's validation commands. The "Faster verification checks" thread is working to make checks shorter.
- **Options:** (a) yes, every command it requires for the touched areas; (b) only the Spec's commands; the lead copies CONTRIBUTING.md's required commands into the Spec while planning, so they are run once, deliberately.
- **Recommendation:** (b). One list of commands, decided at planning, keeps check time predictable. It also lines up with the faster-verification thread (8bfbebc2e0d5, Spec S5): in a project opted in to its test picker, verifiers run the Spec's commands plus picked tests and never whole suites; the full run belongs to the sub-lead or lead before a push.

### Q3: Overlap with 8bfbebc2e0d5 (Faster verification checks): both edit verifier.md, sub-lead.md, lead.md, worker.md
- **Context:** That thread is in final checks; it changes which tests verifiers run (picker plus a full run by the starter, opted in through an AGENTS.md heading) and edits wheelchair's CONTRIBUTING.md to name them. Its lead says our edits to the same role files will conflict as text; whichever merges second merges carefully.
- **Options:** keep the plan as it is (merge carefully if second); or change it to defer to the test-picker rule explicitly in verifier.md.
- **Recommendation:** decided with Q2.

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
| 8 | Agents get CONTRIBUTING.md through a rule in their role file telling them to read it from their own checkout; the machine does not paste it in. | Same for every provider, reads the copy being worked on, no machine change. | user |

## Spec

### S1. Which file is law
The project's CONTRIBUTING.md is the first that exists of `CONTRIBUTING.md`, `.github/CONTRIBUTING.md`, `docs/CONTRIBUTING.md` at the root of the agent's own checkout. No such file: every rule below is a no-op and behaviour is unchanged.

### S2. Reading it
Each of these role files gains a short rule to read the project's CONTRIBUTING.md (S1) from its own checkout before changing or judging anything, and to follow it: `lead.md`, `sub-lead.md`, `worker.md`, `mapper.md`, `designer.md`, `reviewer.md`, `verifier.md`. Steps-only verifier work and `aside.md` are unchanged. A lead's scout may do the reading but the lead acts on its rules. No machine or connector code changes.

### S3. Precedence
On the project's code, files, layout, tests and documentation, CONTRIBUTING.md wins over a worker's or lead's own judgement. On how agents coordinate (commits through `wc.js git`, pushes, PR opening, sessions, cards), wheelchair's role rules win; an agent that meets such a clash follows its role rules and names the clash in its report or result.

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
