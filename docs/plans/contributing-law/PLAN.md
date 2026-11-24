---
slug: contributing-law
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-24
---

# Follow a project's CONTRIBUTING.md as repo law

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

(none)

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
| 9 | Validation commands CONTRIBUTING.md requires are copied into the Spec by the lead while planning; verifiers run the Spec's list as today, not CONTRIBUTING.md's list on their own. A required command missing from the Spec is a reviewer finding. | Collin's pick: one list, decided once, predictable check time. | user |
| 10 | Overlap with 8bfbebc2e0d5: the shared work is verifier.md, sub-lead.md, lead.md and worker.md, which that thread is editing (in final checks) to decide which tests verifiers run. Decision 9 makes this plan leave test selection to verifier.md as it stands, so the only overlap left is text in the same files; whichever merges second merges by hand. Moot, no question asked. | This thread's own decision removed the behavioural overlap. | defaulted |
| 11 | The user may set aside a CONTRIBUTING.md rule for one thread; the lead logs it as a Decision starting `CONTRIBUTING.md exception:` (source `user`), and verifiers and reviewers honour it. Agents never set a rule aside on their own. | Law needs a visible, owner-made way out; without it an agent would either break it silently or stall. | defaulted |

## Spec

### S1. Which file is law
The project's CONTRIBUTING.md is the first that exists of `CONTRIBUTING.md`, `.github/CONTRIBUTING.md`, `docs/CONTRIBUTING.md` at the root of the agent's own checkout. No such file: every rule below is a no-op and behaviour is unchanged.

### S2. Reading it
Each of these role files gains a short rule to read the project's CONTRIBUTING.md (S1) from its own checkout before changing or judging anything, and to follow it: `lead.md`, `sub-lead.md`, `worker.md`, `mapper.md`, `designer.md`, `reviewer.md`, `verifier.md`. Steps-only verifier work and `aside.md` are unchanged. A lead's scout may do the reading but the lead acts on its rules. No machine or connector code changes.

### S3. Precedence
On the project's code, files, layout, tests and documentation, CONTRIBUTING.md wins over a worker's or lead's own judgement. On how agents coordinate (commits through `wc.js git`, pushes, PR opening, sessions, cards), wheelchair's role rules win; an agent that meets such a clash follows its role rules and names the clash in its report or result.

### S4. Lead while planning, and on a small fix
Before writing a Spec the lead reads CONTRIBUTING.md (S1). The Spec must not require anything it forbids; where Collin's wish needs that, the lead tells him which rule it breaks and asks, and only his answer logged as `CONTRIBUTING.md exception: <rule>` (source `user`, Decision 11) allows it. Validation commands CONTRIBUTING.md requires for the areas the Spec touches go into the Spec's validation commands; how and when they run stays as `verifier.md` and `sub-lead.md` say. On a small fix the lead follows it in its own edits and puts those commands in the verifier brief. When opening a PR, the lead follows CONTRIBUTING.md's PR rules (title, description, checklist) as far as `wc.js git pr` allows; anything it cannot do is named in the done card's `note`.

### S5. Reviewer
Both lenses read CONTRIBUTING.md (S1) in the checkout. A Spec item that requires breaking a CONTRIBUTING.md rule not covered by an exception, or a required validation command missing from the Spec, is a finding citing the CONTRIBUTING.md line, rated on the usual ladder.

### S6. Worker and sub-lead
A worker follows CONTRIBUTING.md (S1) in its own checkout for everything it writes. A sub-lead follows it for anything it writes or merges and treats a verifier's CONTRIBUTING.md gap as must-fix: never deferred, never a rare path (S8).

### S7. Verifier
Every verifier except steps-only work (build, small-fix, after-done, repair) adds one check: read CONTRIBUTING.md (S1) at the checked commit and check the change (from the merge-base with the default branch to the checked commit) against each of its rules that the change can break. Only breaks in the change count, never ones already on the default branch. Rules a diff cannot show (for example "open an issue first") are skipped. Logged `CONTRIBUTING.md exception:` decisions are honoured. Each break is one line:
`GAP: CONTRIBUTING.md:<line> — <what the change does against that rule> — <file:line evidence>`
and makes the verdict FAIL like any gap. No CONTRIBUTING.md: the check is skipped with no line.

### S8. realism.md
The "Always fixed, however rare" list gains: breaking the project's CONTRIBUTING.md in this change, unless a logged exception covers it. So a CONTRIBUTING.md gap is never a rare path or deferred hardening, under the existing lead and sub-lead rules that keep always-fixed gaps out of Deferred.

### S9. Mapper and designer
The mapper reads CONTRIBUTING.md (S1) and adds to MAP.md, in a line or two, the rules that bear on the mapped areas with their line numbers. The designer follows any rules it has on look, style or UI files.

### S10. Tests
`viewer/test/protocol-rules.test.js` gains tests that: each of `lead`, `sub-lead`, `worker`, `mapper`, `designer`, `reviewer`, `verifier` names `.github/CONTRIBUTING.md` and `docs/CONTRIBUTING.md`; `verifier.md` contains `GAP: CONTRIBUTING.md:`; `realism.md`'s always-fixed paragraph names CONTRIBUTING.md; `aside.md` does not mention CONTRIBUTING.md.

### Non-goals
No machine, connector or viewer code changes; no change to wheelchair's own CONTRIBUTING.md or any project's; no other project document (README, AGENTS.md, style guides) becomes law by this plan, beyond what a CONTRIBUTING.md itself tells agents to read; no change to which tests verifiers run; no ROUTER.md removal (thread 84f82b5fc945).

### Validation
```bash
node --test viewer/test/protocol-rules.test.js
node --test viewer/test/*.test.js
git diff --name-only origin/main...HEAD | grep -v '^docs/plans/' | grep -v '^protocol/app/' | grep -v '^viewer/test/protocol-rules.test.js$' ; test $? -eq 1
```
The last command prints nothing and exits 0 when only protocol files, the test and plan files changed.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-24

**Lanes:** intent lens; mechanics lens; cross-family: pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
