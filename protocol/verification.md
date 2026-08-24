# Stage 4 — Blind verification

Cross-family blind review of a completed implementation, looping through remediation
until the plan is fully satisfied.

**Precondition:** `status: verifying` and `docs/plans/<slug>/COMPLETION.md` exists.
Otherwise refuse and name the missing stage.

## Reviewer selection

Read `implemented-by` from COMPLETION.md frontmatter. The verifier comes from the
**other** model family than the primary implementer:

- GPT implemented (sol/terra) → Claude verifier (fresh Agent-tool agent; from Codex:
  `claude -p "<brief>"`).
- Claude implemented (sonnet/opus/fable) → GPT verifier:
  `codex exec -m gpt-5.6-sol -s workspace-write -C "$PWD" -o "$OUT" - < brief`.
- Mixed → run both; cheap insurance.

The GPT verifier gets `workspace-write` only so it can run the test suite. Its brief
forbids editing anything; confirm with `git status` when it returns, and discard any
stray edits before trusting the verdict. Invocation details:
`~/src/wheelchair/protocol/lanes.md`.

The verifier gets the PLAN.md path, the COMPLETION.md path, and repo access — never the
implementation conversation.

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
  the **same** implementer family that built the work — `codex exec resume
  <SESSION_ID> "<follow-up>"` for a GPT lane. Round 1 sharpens the brief rather than
  reaching for a bigger model: a first FAIL is a brief defect more often than a model
  defect. Then re-apply Stage 3's tier test to the rewritten brief — a transcription-tier
  gap that turned out to need a decision is a Terra task now, and the plan that left that
  decision unmade is what actually failed. A gap that survives round 1 is the evidence
  lanes.md asks for: round 2 takes **one** rung in a fresh lane instead of resuming, and
  the failure mode picks which. A lane that produced nearly-right work and missed an edge
  case gets `xhigh` at the same tier. A lane that misread the shape of the task — wrong
  layer, wrong contract, a solution to a different problem — gets the next tier
  (Luna → Terra → Sol, Sonnet → Opus); more reasoning does not fix a lane that was
  never holding the right problem. Re-run
  validation, append a
  "Remediation N" section to COMPLETION.md — never erase history — and re-verify.
  Prefer resuming the original verifier's session for the closure review, plus one
  fresh verifier for the final round when remediation was large.

Loop until PASS. If the same gap survives two remediation rounds, stop and bring it to
the user — that is a plan defect, not an implementation defect: reopen Stage 1 on that
point.

When reporting rounds or gaps to the user, follow
`~/src/wheelchair/protocol/writing.md`. In
particular: a gap ID or spec-item codename is a pointer into the docs, not shared
vocabulary — re-ground it on first use, and report what behavior is wrong, not which
identifiers are involved.
