# Stage 1 — Planning

Interactive planning that produces an implementable spec through one-question-at-a-time
discussion, with all state in persistent documents. **The docs are the state; the
conversation is disposable** — a fresh session in either harness must resume from them
alone.

Three documents:

- `docs/plans/<slug>/MAP.md` — how the existing code works today, in plain language. Built
  first, so decisions get made against what is actually there.
- `docs/plans/<slug>/IDEA.md` — what we're doing and why. Confirmed by the user, then held
  stable. The north star.
- `docs/plans/<slug>/PLAN.md` — the mutating work: questions, decisions, the spec.

IDEA and PLAN are separate because the spec grows every turn and the intent does not. In
one document the design detail buries the goal, and by turn fifteen the plan is driven by
the last few decisions instead of by what it was for.

## Step 1 — read the code, then explain it

Input: an existing slug (resume) or a short description (new plan). A plan written outside
this workflow is brought in with `adopt.md` first, then continues here by slug.

**Resume:** read MAP.md, IDEA.md, then PLAN.md. Give a 2–3 sentence state summary (the
idea, what's settled, what's open) and continue the loop at the first open question.

**Adopted:** adoption already wrote IDEA.md and PLAN.md. Build the map, then go to Step 3
and finish the question queue.

**New:** derive a short kebab-case slug. Read the code the change will touch, then write
MAP.md following
`map.md`, beside this file: end-to-end flow
first, plain-text diagram, every specific claim carrying `file:line`, and an explicit list
of what you did not check.

Show the map to the user before writing the idea. It is information, not a question, so it
does not compete with the one-question rule. The point is to let the user correct your
reading of their own system before that reading shapes everything downstream.

For a change touching one obvious spot, this is three lines in the conversation, not a
document.

## Step 2 — the idea document

Write IDEA.md from `templates/IDEA.md` (sibling directory of this file).

Then **stop and show it to the user for confirmation before anything else.** Do not
build the question queue and do not ask a design question in the same turn. Getting the
north star wrong makes every subsequent question wrong, and this is the cheapest possible
moment to catch it. Set `status: confirmed` once the user agrees.

## Step 3 — build the question queue

Once the idea is confirmed, create PLAN.md from `templates/PLAN.md`.

Enumerate EVERY open question into PLAN.md's Open Questions section, ordered by leverage —
questions whose answers reshape the rest come first. Each entry carries 1–3 sentences of
context, the realistic options, and your recommendation with a one-line why.

**Decide-don't-ask filter:** a question with a defensible default the user is unlikely to
overturn does not enter the queue. Decide it yourself and record it in the Decision Log
with source `defaulted` — the user can reopen any of these later. The queue holds only
genuine forks: irreversible, taste-dependent, or requirements-shaped calls.

## Step 4 — the discussion loop

Before each turn, re-read IDEA.md and check the emerging spec still serves it. If it has
drifted — you are solving a different problem than the one stated, or scope has grown past
what the idea describes — say so plainly instead of continuing. Drift is not resolved
silently in the Spec.

Before composing the question, also re-read every graph under `docs/plans/<slug>/graphs/`
and every graph reachable from one through a container node, depth-bounded at 5 — a walk
that hits the bound reports a cycle rather than recursing, because a hand-edited file can
hold a containment cycle the server's write-time check never saw. An unaccounted `rejected`
entry is an input to this turn.

A rejection usually means "not this," which is a defensible default under the
decide-don't-ask filter above: fold it into the Spec, log it in the Decision Log with source
`user`, and say so in one line. It becomes the turn's question only when striking it left
something genuinely open — the struck entry was load-bearing and nothing else covers it, or
the rejection contradicts a logged decision.

Present exactly **one** question per turn, in this shape:

> **Where this fits** — one plain sentence connecting the question to the idea.
> **The question** — plain language.
> **Options** — each with its practical consequence, not just its name.
> **Recommendation** — and a one-line why.
> **Progress** — "decision 4 of roughly 9."

Never present two questions; never append "also, quick question…".

### How to write it

The user has not memorized this conversation and does not have the codebase in their head.
Write every turn for someone arriving cold. The general prose rules — sized by what the
reader needs to decide, every label and prior decision re-grounded on first use, above
the code, no AI tells — live in
`writing.md`, beside this file; read it
once per session and apply it to every turn. Specific to this loop:

- **Consequence before mechanism.** Lead with what a choice means for how the thing behaves
  or what work it creates; the implementation detail comes after, if at all.
- **No unexplained jargon.** If a term is load-bearing, define it in the same breath in a
  few words. If a question can only be asked in jargon, you understand it well enough to
  translate it — do that.
- **Ask about the decision, not the design.** The user is choosing an outcome; you own
  turning that into a design.
- **Say it straight when something is wrong.** If the user's idea won't work against the
  actual code, contradicts a decision they already made, or is more expensive than they
  seem to think, say so and show the evidence. Do not accommodate it quietly and do not
  bury the objection in options.

### Grounding a question in the code

When a question depends on how something works today, explain that part in the same turn,
with `file:line`. Just the part the question touches — not a tour.

Keep it to what the decision needs. If the explanation runs longer than the question, the
question is too big: split it.

If the explanation is a lasting fact about the system rather than a detail of this one
decision, add it to MAP.md so the next session gets it for free.

### Drawing a flow

When a turn discusses a flow — a proposed design, not just a fact about the current code —
write or update a graph under `docs/plans/<slug>/graphs/`, start the viewer if it is not
already running, and print the URL that turn. The format and how the viewer starts are
`protocol/graphs.md`'s; this loop only triggers it. `MAP.md`'s plain-text diagram is
untouched — `protocol/map.md` bans Mermaid there because the map is read in a terminal, and
that is unchanged.

### Recording answers

When the user answers: append the decision and rationale to the Decision Log, remove the
question from Open Questions, fold the consequence into the Spec, and cascade — add,
remove, or reorder downstream questions the answer affects. Save the file **before**
responding, then present the next question.

The Decision Log is append-only: a reversal is a new entry superseding the old, never an
edit.

### Things that need looking into

When you notice something that needs attention but is not yet a decision for the user — an
inconsistency in the code, a risk, an unknown needing research — write it to PLAN.md's
Watch List immediately, so it cannot be forgotten.

At the start of a turn, if new items landed since the last one, mention them in **one line
each, as awareness rather than a request**: "heads up — I noticed X; it's on the watch
list, no action needed from you yet." They are not extra questions, and they never
displace the single question of the turn. Surfacing must not recreate the
answer-ten-things-at-once problem it exists to prevent.

Every watch-list item eventually resolves one of four ways: you settle it yourself (note it
in the Log), it becomes an Open Question, it becomes a Constraint or an Accepted Risk, or
the user waves it off. The Watch List must be empty before Stage 1 exits.

## Changing the idea

IDEA.md is stable, not frozen. A newly discovered hard constraint may be added to its
Constraints section directly — say so in the turn ("adding X to constraints; it's a hard
limit in the current code"). Any change to What / Why / What good looks like / Not doing is
a scope change: propose it explicitly, get the user's agreement, and log it in the Decision
Log with source `idea-change`.

## Exit

When Open Questions and the Watch List are both empty, write the final Spec pass. The bar:
a fresh agent with no conversation history could implement from the Spec alone — behavior,
boundaries, edge cases, non-goals, and concrete validation commands. Set frontmatter
`status: ready-for-review` and tell the user the next step is plan-review.

Before that pass is done, the Spec must account in prose for every `rejected` entry across
`docs/plans/<slug>/graphs/` and everything reachable from it through a container — the same
walk as above, depth-bounded at 5 and reporting a cycle rather than recursing. `agreed`
needs no prose; it means the proposal was right. One sentence may cover many rejections —
striking a whole region is one decision, not fifteen — so the gate is "no rejection
unaddressed," not "one paragraph each."

No Mermaid diagram is drawn in the Spec at this point. Stage 2 rewrites the Spec for every
upheld finding, so a diagram drawn here is stale before anyone reads it — `diagrams.md` puts it
at approval instead. `MAP.md`'s plain-text diagram is unaffected and stays as `map.md` describes.
