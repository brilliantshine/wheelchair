# Stage 3 — Implementation

Lead-and-workers implementation of an approved plan.

**Input:** a plan slug.

**Precondition:** `docs/plans/<slug>/PLAN.md` has `status: approved`. Otherwise refuse
and name the missing stage. A plan written outside this workflow is brought in with
`adopt.md` first; this stage does not take document paths.

**Small-patch bypass:** if the whole Spec is a small patch (a couple of files, nothing
parallelizable), skip the fan-out and implement it directly — but still write
COMPLETION.md and still hand off to Stage 4.

## Lead role

The current session is the lead. The lead briefs, sequences, integrates, and validates —
it does **not** bulk-implement; lead tokens are the expensive kind.

Everything the lead writes for the user — status updates, the end-of-run summary —
follows `~/src/wheelchair/protocol/writing.md`:
sized by what the user needs to decide, every task ID and decision codename re-grounded
on first use (they mean nothing after a day away), and above the code — behavior and
areas, not function names.

**Read Prior Work before decomposing.** Items marked `pre-existing` do not become briefs
and their code is not touched — re-implementing working code is wasted lane time at best,
and at worst a worker rewrites it to match the letter of a spec written before that code
existed. Items marked `partial` do get a brief, one that names what already exists and
asks the worker to complete it rather than restart it.

**Resuming an interrupted run:** if `status` was already `implementing` when you started,
an earlier attempt died partway. Reconcile before dispatching anything — read the
Implementation Tasks table, check each row claiming completion against the tree, and move
what is genuinely built into Prior Work. Trust the tree, not the table: the table records
what a lane claimed, and a lane that died mid-write may have claimed more than it landed.

Set `status: implementing`. Decompose the remaining Spec into worker tasks in the
Implementation Tasks table. Every brief carries: a concrete objective, an ownership boundary (the
files/dirs the worker owns), the deliverable, and exact validation commands. GPT-lane
briefs additionally carry a fails-twice guardrail: *"if the same gate fails twice, stop
and report rather than iterating."*

Assign each task a tier as you write its brief and record it in the Lane column. The tier
follows the brief you actually wrote, not the one you meant to write: a task is
transcription-tier only if the brief names every file, the exact change, and a pattern
already in the tree to copy. The moment a brief has to say "figure out where this belongs"
or leaves a case unnamed, it is workhorse-tier. Writing the missing decision *into* the
brief to keep a task on the cheap lane is legitimate and good — that decision belonged in
the plan anyway. Assuming the lane will work it out is not.

## Lanes

Read `~/src/wheelchair/protocol/lanes.md` for the
exact invocations and cautions before launching any lane.

- **GPT workhorse:** `codex exec -m gpt-5.6-terra -s workspace-write -C "$PWD" -o "$OUT"
  - < brief`. Terra takes every GPT brief that leaves the lane a decision to make.
- **GPT transcription lane:** the same call with `-m gpt-5.6-luna`, for briefs where the
  plan already made every decision — the files, the change, and the pattern to copy are
  all named and the lane invents nothing.
- **Claude workhorse:** Agent tool with `model: sonnet` (from Codex:
  `claude --model sonnet -p "<brief>"`). UI/frontend implementation and taste-sensitive
  surfaces go here, never to a GPT lane. Sonnet takes the mechanical Claude-side work too;
  there is no Luna-equivalent third tier on that side.

Reasoning effort needs no flag at dispatch — every lane starts at `high` from
`~/.codex/config.toml`. Raising it to `xhigh` is an escalation rung, not a dispatch
choice; anything below high is a downgrade. See lanes.md.

Sol and Opus are not implementation lanes. A brief reaches one only after a cheaper lane
came back wrong, by lanes.md's "Escalate the model only on evidence" — a task that merely
looks hard is not grounds, it is just a task that starts at Terra. Escalating before a
lane has failed is the expensive mistake this stage exists to avoid; the lead's review
loop, not a bigger model, is what makes a cheap lane safe.

Because `codex exec` blocks, run each lane as a background Bash call and collect the
`-o` files as they finish. Parallelize only disjoint ownership boundaries — and only
across separate worktrees, since two write-lanes in one checkout corrupt each other.
Overlapping boundaries sequence.

## Integration and exit

After each lane finishes: re-run its validation yourself and read the diff —
`completed` is a claim, not a fact, and GPT lanes fabricate completions.

When all tasks are done and full validation is green, write
`docs/plans/<slug>/COMPLETION.md` from `templates/COMPLETION.md`: spec-item-by-item
coverage with file:line references and each item's origin (`this run` or `pre-existing`),
deviations from the Spec, pasted validation evidence, residual risks, and the implementing
lanes in frontmatter (Stage 4 picks the opposite family from it). Every spec item gets a
row including the pre-existing ones — coverage is the point, and Stage 4 verifies them
too. Set `status: verifying` and hand off to Stage 4.

COMPLETION.md is written for a hostile reviewer: every claim checkable, no claim
without evidence. It is written once and read rendered, so a Mermaid diagram of what the change
actually does belongs in it — `diagrams.md` for the rules.
