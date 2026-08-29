# Stage 4 — Blind verification

Blind verification of a completed implementation, looping through remediation until the
plan is fully satisfied.

**Precondition:** `status: verifying` and `docs/plans/<slug>/COMPLETION.md` exists.
Otherwise refuse and name the missing stage.

## Reviewer selection

Read `implemented-by` from COMPLETION.md frontmatter. Where it names several lanes — for
example, `terra (lead: fable)` — the family is the one that implemented the work, not the
one that led it.

With both families available, retain the existing selection: GPT work is checked by the
Claude family's default reviewer, Claude work by `gpt-5.6-sol`, and mixed implementation
gets both checks. Read `lanes.md`, in this same directory, for the exact lane invocations
and cautions.

With one family, the verifier comes from that family regardless of what built the work:

- GPT family — `gpt-5.6-sol`, including for Luna-built work.
- Claude family — Opus. Where Opus built the work, use a fresh Opus with no shared context.

Implementation spanning both families is not a one-account run: dispatch one verifier per
implementing family as above. If a family reports that it is not authenticated, the
surviving family verifies both implementing lanes instead: make two dispatches and append
two `verified-by` entries, and name the unreachable family in the gate line. One verifier
over both would hide that half the work received a same-family check.

The GPT verifier gets `workspace-write` only so it can run the test suite. Its brief
forbids editing anything; confirm with `git status` when it returns, and discard any
stray edits before trusting the verdict.

The verifier gets the PLAN.md path, the COMPLETION.md path, and repo access — never the
implementation conversation.

`lanes.md` determines and reports when a lane returned nothing. For an ordinary dead
lane, stop the stage; there is no verdict to carry forward. An announced authentication
failure is different: run the one-account selection above and name the login failure in
the gate line.

For every verification round, append — never overwrite — one `verified-by` entry per
verifier in COMPLETION.md:

```yaml
verified-by:
  - round: 1
    lane: gpt-5.6-sol
    checks: sonnet
```

`lane` and `checks` together show whether that check crossed families, so do not add a
separate relation field. The gate line also names each verifier and whether its family
differed from the implementer's, on every run: for example, “checked by a fresh lane,
same family as the builder.” This is attribution, not a warning; a cross-family gate is
recorded just as explicitly.

## The brief

*"Read `docs/plans/<slug>/IDEA.md` for what this work is for, then verify the
implementation in this repo against the Spec in `docs/plans/<slug>/PLAN.md`.
COMPLETION.md is the implementer's claims — treat every claim as something to falsify,
not to trust. For each spec item: locate the code, read it, and where a validation
command exists, run it yourself. Items listed in the plan's Prior Work section were built
before this workflow ran and have never been reviewed against the Spec — verify them
exactly as rigorously as the rest, and do not read 'pre-existing' as 'already checked.'
Check that the idea's non-goals weren't violated, that what the idea calls 'what good
looks like' is actually true, and that no spec item was satisfied by letter but not
intent. Check that the Routers section in COMPLETION.md is true: that the routers it claims
were updated say what the change actually made true, and that a change which moved ownership
between directories did not leave one side's router stale. Verdict format: `VERDICT: PASS`, or
`VERDICT: FAIL` followed by one line per gap:
`GAP: <spec item> — <what is missing or wrong> — <evidence>`."*

## Remediation loop

- **PASS** → set `status: done`. Sweep docs the change made stale (CLAUDE.md/AGENTS.md,
  repo skills, touched docs) before any PR opens.
- **FAIL** → write `docs/plans/<slug>/REMEDIATION-N.md` (N = verification round): the
  gap list verbatim, then one task per gap in the Stage 3 brief format. Route tasks to
  the **same** implementer family that built the work, following `lanes.md`'s continuation
  rules. Round 1 sharpens the brief rather than reaching for a bigger model: a first FAIL
  is a brief defect more often than a model defect. Then re-apply Stage 3's tier test to
  the rewritten brief — a transcription-tier gap that turned out to need a decision is a
  Terra task now, and the plan that left that decision unmade is what actually failed. A
  gap that survives round 1 is the evidence lanes.md asks for: round 2 takes **one** rung
  in a fresh lane instead of resuming, and the failure mode picks which. A lane that
  produced nearly-right work and missed an edge case gets `xhigh` at the same tier. A lane
  that misread the shape of the task — wrong layer, wrong contract, a solution to a
  different problem — gets the next tier; more reasoning does not fix a lane that was
  never holding the right problem. Re-run
  validation, append a
  "Remediation N" section to COMPLETION.md — never erase history — and re-verify.
  Prefer resuming the original verifier's session for the closure review, plus one
  fresh verifier for the final round when remediation was large.

Loop until PASS. If the same gap survives two remediation rounds, stop and bring it to
the user — that is a plan defect, not an implementation defect: reopen Stage 1 on that
point.

When reporting rounds or gaps to the user, follow
`writing.md`, beside this file. In
particular: a gap ID or spec-item codename is a pointer into the docs, not shared
vocabulary — re-ground it on first use, and report what behavior is wrong, not which
identifiers are involved.
