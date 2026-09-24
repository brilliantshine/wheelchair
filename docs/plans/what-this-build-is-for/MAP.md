# How a plan gets graded today

What happens to a plan from the moment it is described to the moment it is done, with
attention to the one thing this change is about: where the workflow learns how solid the
build has to be, and what it does with work it decides to skip.

## End to end

You type a description. The session reads the code the change will touch and writes
`MAP.md` — this file (`protocol/planning.md:31-39`). Then it writes `IDEA.md` from a
template and **stops**, because getting the north star wrong makes every later question
wrong (`protocol/planning.md:44-51`). Once you confirm it, the session enumerates every
open question into `PLAN.md` and works through them one per turn, folding each answer into
a growing Spec (`protocol/planning.md:55-64`, `:85-93`). When the question queue and the
watch list are both empty the plan flips to `ready-for-review`
(`protocol/planning.md:184-188`).

Review launches two reviewers who never see the planning conversation — just the plan path
and the repo (`protocol/plan-review.md:35-40`). Each is told to read `IDEA.md` first, then
attack the Spec (`protocol/plan-review.md:48-54`). Each finding comes back with a severity
the reviewer assigned itself, and the lead then re-grades every one of them
(`protocol/plan-review.md:95-103`). The round is clean when the lead's own triage upholds
zero blocking and zero major findings (`protocol/plan-review.md:124-126`); otherwise the
Spec is edited and another round runs, up to three (`protocol/plan-review.md:133`). A clean
triage sets `approved`.

Implementation decomposes the Spec into worker briefs and writes `COMPLETION.md`
(`protocol/implementation.md:94-101`), with a bypass that implements a small patch directly
rather than fanning out (`protocol/implementation.md:11-13`). Verification hands a fresh
lane the plan and the completion claims and asks it to falsify them, looping through
remediation until PASS (`protocol/verification.md:78-100`). That verifier also reads
`IDEA.md`, and is specifically asked whether the non-goals were violated and whether "what
good looks like" is actually true (`protocol/verification.md:61-74`).

```
description → read the code → IDEA.md ──you confirm──→ questions, one at a time
                                                                  ↓
                                                          ready-for-review
                                                                  ↓
                                               two reviewers attack the Spec
                                                                  ↓
                                          lead re-grades every finding it gets
                                                                  ↓
                                    any upheld blocking or major? ──yes──→ edit Spec
                                                                  ↓ no       ↑ next round
                                                              approved
                                                                  ↓
                                             implement → verify → done
```

## The part this change is about

**Nothing states how solid the build has to be.** `IDEA.md` has five sections — what we're
building, why, what good looks like, not doing, constraints
(`protocol/templates/IDEA.md:15-38`). "Not doing" excludes *features*, not a *standard*.
Nowhere does a plan say whether this is a demo shown once or something people will depend
on.

**Severity is defined by consequence, which is exactly why the missing statement bites.**
The ladder handed to both reviewers is `blocking` = a worker would build the wrong thing,
`major` = a worker would have to stop and ask, `minor` = everything else
(`protocol/plan-review.md:56-65`). That is the right axis. But a reviewer told to attack a
spec with no statement of what it is for has only one safe reading of "the wrong thing,"
and it is the strict one — so a missing edge case on a path a demo never walks comes back
as major, correctly, given what the reviewer was told.

**The round count is not the cost driver.** The loop exits on the triage, not on a counter:
a first round that comes back clean ends review at one round. A plan grinding through three
rounds is a plan where findings keep landing as major.

**There is one place to record work you chose not to do, and it says the wrong thing.**
`accepted-risk` promotes a finding into the Spec's Accepted Risks section
(`protocol/plan-review.md:102`), which the template defines as "real issues consciously not
fixed" that later rounds must not re-raise (`protocol/templates/PLAN.md:54-60`). That is
"not worth fixing" — a different claim from "we'll need this if the thing survives." A demo
that earns a second life currently has no list to start its hardening plan from.

## How a rule reaches an agent

One `protocol/` file per stage is the single source. The Claude wrapper in `skills/` and
the Codex prompt in `codex/prompts/` both do nothing but name that file by absolute path,
so an edit under `protocol/` takes effect in both harnesses with no reinstall
(`skills/AGENTS.md:7-9`, `skills/AGENTS.md:40-44`). Two consequences for this change:

- **A template edit is a contract change** (`protocol/AGENTS.md:46-48`). A rule written into
  a stage's prose but not into `templates/IDEA.md` or `templates/PLAN.md` reaches nobody,
  because the stage tells the agent to write from the template.
- **Never add a second gate for a rule that already has one** (`protocol/AGENTS.md:43-45`).
  If the bar lands in `IDEA.md`, the review stage points at it rather than restating it.

The one frontmatter field in a wrapper that is not a pointer is its `description` — the
harness matches on it to decide whether to offer the command (`skills/AGENTS.md:11-13`). The
plan-review wrapper's description currently spells out "capped at three before escalating to
the user" (`skills/plan-review/SKILL.md:3`), so a change to the loop shape has to be
reflected there too.

## What I did not check

- `protocol/lanes.md` — how reviewers and workers are actually spawned. If the demo bar
  changes how many reviewers launch, that file is in scope and I have not read it.
- `protocol/diagrams.md` and `protocol/writing.md`.
- `install.sh` and how wrappers are rendered, beyond what the two routers above claim.
- The two in-flight plans sitting untracked in `docs/plans/` — `separate-the-record`
  (`status: planning`, three open questions, about splitting a plan's spec from the record
  of how it was argued) and `shell-free-recipes` (idea still `draft`). I read their
  frontmatter and titles only. `separate-the-record` is the adjacent one: it is already
  reorganizing the same `PLAN.md` sections a Deferred section would land in.
