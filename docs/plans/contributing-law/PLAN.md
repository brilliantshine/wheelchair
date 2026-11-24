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
| 12 | The shared law rule lives once in `protocol/app/repo-law.md`, composed by the machine into all seven roles like `realism.md`; role files carry only their role's part. Supersedes the per-role copies in the first draft. | Keeps rules in one place (`CONTRIBUTING.md:42`). | review-round-1 |
| 13 | The verifier compares from a change base the brief names (where this thread's work started), not the default branch. | A thread taking on someone else's PR must not be blamed for its earlier commits. | review-round-1 |
| 14 | Wheelchair's own files (`docs/plans/`, `docs/maps/`, mockups, reports) keep their role-rule formats over CONTRIBUTING.md. A small fix has no exceptions; one needing one is taken into planning. | Mockups must render in the app; a small fix has no Decision Log to record an exception. | review-round-1 |

## Spec

### S1. One source: `protocol/app/repo-law.md`
A new file `protocol/app/repo-law.md` holds the whole shared rule, once:
- **Which file is law:** the first that exists of `CONTRIBUTING.md`, `.github/CONTRIBUTING.md`, `docs/CONTRIBUTING.md` at the root of the agent's own checkout. None: the rest of this file and every role rule that refers to it is a no-op.
- **Read it yourself** before changing or judging anything, and follow it. Not through a scout or helper.
- **Precedence:** on the project's code, files, layout, tests and documentation, it wins over the agent's own judgement. Wheelchair's role rules win on how agents coordinate (commits through `wc.js git`, pushes, PR opening, sessions, cards) and on the format of wheelchair's own files (`docs/plans/`, `docs/maps/`, mockups and reports). An agent meeting such a clash follows its role rules and names the clash in its report or result.
- **Exceptions:** only Collin may set a rule aside, for one planned thread, logged in PLAN.md's Decision Log as a Decision starting `CONTRIBUTING.md exception:` (source `user`). Agents honour logged exceptions and never make their own.

The machine composes `repo-law.md` into the starting instructions of `lead`, `sub-lead`, `worker`, `mapper`, `designer`, `reviewer` and `verifier`, the same way it adds `realism.md` (`machine/service.js:199-208`, as `--- repo-law.md ---`). Asides and any `role_prompt` override are unchanged. `protocol/app/AGENTS.md` lists the new file and its delivery. Role files do not repeat these rules; they add only their role's part below.

### S2. Lead
While planning: the Spec must not require breaking a CONTRIBUTING.md rule unless Collin approved an exception (S1); where his wish needs one, the lead names the rule and asks. Validation commands CONTRIBUTING.md requires for the areas the Spec touches go into the Spec's validation commands; how and when they run stays as `verifier.md` and `sub-lead.md` say.
A small fix follows CONTRIBUTING.md and has no exceptions: one that would need to break a rule is taken into planning instead. Its verifier brief lists the required commands.
When opening a PR, the lead follows CONTRIBUTING.md's PR rules (title, description, checklist) as far as `wc.js git pr` allows; anything it cannot do is named in the done card's `note`.
Every verifier brief the lead writes names the **change base**: the commit this thread's work started from (the commit the branch was cut from, or for a thread taking on someone else's pull request, that pull request's head when the thread took it on).

### S3. Reviewer
A Spec item requiring a break of a CONTRIBUTING.md rule not covered by a logged exception, or a required validation command missing from the Spec, is a finding citing the CONTRIBUTING.md line, rated on the usual ladder.

### S4. Sub-lead and worker
The sub-lead copies every logged `CONTRIBUTING.md exception:` Decision that bears on a task into that worker's brief, and names the change base (S2) in every verifier brief it writes. It treats a verifier's CONTRIBUTING.md gap as must-fix (S6). A worker follows exceptions given in its brief.

### S5. Verifier
Every verifier except steps-only work adds one check: read CONTRIBUTING.md at the checked commit and check the change, from the brief's change base to the checked commit, against each of its rules the change can break. Only breaks introduced in that range count. A brief without a change base: use the merge-base with the default branch. Rules a diff cannot show (for example "open an issue first") are skipped. Logged exceptions are honoured. Each break is one line:
`GAP: CONTRIBUTING.md:<line> — <what the change does against that rule> — <file:line evidence>`
and makes the verdict FAIL like any gap. No CONTRIBUTING.md: no line.

### S6. realism.md
The "Always fixed, however rare" list gains: breaking the project's CONTRIBUTING.md in this change, unless a logged exception covers it. So a CONTRIBUTING.md gap is never a rare path or deferred hardening.

### S7. Mapper and designer
No role-file change beyond S1's delivery: they read and follow CONTRIBUTING.md through `repo-law.md`. The mapper does not copy its rules into maps. Mockup files keep their format rules (S1 precedence).

### S8. Tests
- `viewer/test/protocol-rules.test.js`: `repo-law.md` names all three paths in order and `CONTRIBUTING.md exception:`; no role file other than `repo-law.md` names `.github/CONTRIBUTING.md` (one source); `verifier.md` contains `GAP: CONTRIBUTING.md:` and `change base`; `realism.md`'s always-fixed paragraph names CONTRIBUTING.md; `aside.md` does not mention CONTRIBUTING.md.
- `machine/test/service.test.js`: the composed prompt contains `--- repo-law.md ---` for each of the seven roles, and not for a `role_prompt` override.

### Non-goals
No connector or viewer app code changes, and no machine change beyond adding `repo-law.md` to composition; no change to wheelchair's own CONTRIBUTING.md or any project's; no other document becomes law by this plan, beyond what a CONTRIBUTING.md itself tells agents to read; no change to which tests verifiers run; no ROUTER.md removal (thread 84f82b5fc945).

### Validation
This change touches protocol, machine and viewer tests, so it runs wheelchair's full set (`CONTRIBUTING.md:73-94`), with `install/test/run.sh` standing in for `./install.sh`, which is refused from a worktree:
```bash
node --test viewer/test/protocol-rules.test.js
bash sensitivity/test/run.sh
bash codex/test/run.sh
bash install/test/run.sh
bash machine/test/run.sh
python3 -m unittest discover -s sudo-helper/test
bash sudo-helper/test/install-test.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```
Protocol documents have no suite (`CONTRIBUTING.md:90-92`): read the composed prompt for one role (for example the verifier) and confirm `repo-law.md` follows `realism.md`, and that the sub-lead's GAP handling still parses the new GAP line form.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| The changed-path check in the first draft's Validation exited 0 if `git diff` itself failed. | Needs a broken base ref; that command has been dropped anyway. | review-round-1 |

## Review Rounds

### Round 1 — 2026-11-24

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Law rules copied into seven role files breaks "keep rules in one place" | upheld | S1: one `repo-law.md`, Decision 12 |
| intent | minor | Lead's scout may read CONTRIBUTING.md, dropping rules | upheld | S1: read it yourself |
| intent | minor | Mapper copying rules into MAP.md makes a stale second copy | upheld | S7: removed |
| mechanics | blocking | Default-branch baseline blames a thread for a taken-over PR's earlier commits | upheld | S2/S5 change base, Decision 13 |
| mechanics | blocking | Precedence unclear for role rules on files, e.g. designer mockup format | upheld | S1 precedence covers wheelchair's own files, Decision 14 |
| mechanics | major | Small fix has nowhere to record an exception | upheld | S2: small fix has none, goes to planning, Decision 14 |
| mechanics | major | Worker not told of logged exceptions | upheld | S4: sub-lead copies them into briefs |
| mechanics | blocking | Validation omits wheelchair's full set and the protocol rendered check | upheld | Validation: full set and composed-prompt check |
| mechanics | minor | Rare path: changed-path command exits 0 if git diff fails | accepted-risk | Accepted Risks; command dropped |

### Round 2 — 2026-11-24

**Lanes:** intent lens; mechanics lens; cross-family: pending.

**Changed since Round 1:** the Spec was rewritten: shared rule moved to one `protocol/app/repo-law.md` composed by the machine into seven roles (S1); precedence now covers wheelchair's own files; small fixes have no exceptions; change base in verifier briefs (S2, S5); sub-lead copies exceptions into worker briefs (S4); mapper no longer copies rules (S7); tests (S8) and Validation (full set) redone. Decisions 12-14.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
