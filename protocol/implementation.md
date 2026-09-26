# Stage 3 — Implementation

Lead-and-workers implementation of an approved plan.

**Input:** a plan slug.

**Register the plan directory with the viewer at the start**, before anything else. You
are reading this document at `<root>/protocol/implementation.md`, so `WHEELCHAIR` is that
path with `/protocol/implementation.md` dropped, the same rule `graphs.md` uses:

```bash
node "$WHEELCHAIR/viewer/server.js" --register-plan <repo>/docs/plans/<slug>
```

It returns at once, never starts a server, and never fails the stage: it registers
through a running viewer if one answers, and otherwise does nothing. On any error it
prints one warning line — pass it on to Collin in your turn, including "a viewer from an
older version is running; run ./install.sh", and carry on.

**Precondition:** `docs/plans/<slug>/PLAN.md` has `status: approved`, or `status:
implementing` as a resume of a run that died partway (see "Resuming an interrupted run"
below). Otherwise refuse and name the missing stage. A plan written outside this
workflow is brought in with `adopt.md` first; this stage does not take document paths.

**Small-patch bypass:** if the whole Spec is a small patch (a couple of files, nothing
parallelizable), skip the fan-out and implement it directly — but still write
COMPLETION.md and still hand off to Stage 4. The run picture below is skipped too —
drawing it and every update to it — but the ask-at-start step is not: it still runs
before any work begins, small patch or not.

## Lead role

The current session is the lead. The lead briefs, sequences, integrates, and validates —
it does **not** bulk-implement; lead tokens are the expensive kind.

Everything the lead writes for the user — status updates, the end-of-run summary —
follows `writing.md`, beside this file:
sized by what the user needs to decide, every task ID and decision codename re-grounded
on first use (they mean nothing after a day away), and above the code — behavior and
areas, not function names. The lead also keeps the plan's record of what the user has
seen — write and read it per `seen.md`, beside this file, before composing a turn.

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

As part of this same reconcile step — or, on a fresh start, before anything else — move
any old run picture aside: if `run.json` or any `run-*.json` exists in `graphs/`, move
all of them together into `graphs/before-run-<N>/` (the first `N` not already used), a
plain file move with no server call. They keep their rulings there as a committed
record; the viewer never opens them, since it serves only files directly in `graphs/`. A
fresh start still needs this check — a plan verification sent back to planning and
approved again can leave an old picture behind. When this moved anything, or the Log
already holds a `Stage 3 started` line from an earlier attempt (even one whose picture
never got drawn), the ask-at-start message below says in one sentence where the earlier
run's records are — the picture in `graphs/before-run-<N>/`, and its choices in the
Log's `Choice:` lines — and that nothing struck there is acted on unless Collin asks. If
the earlier run left unfinished follow-up rows in the Implementation Tasks table, that
same sentence names them, since reconciling drops rows that aren't part of the Spec. You
read nothing else back for this: if Collin asks for an old choice to be undone, that is
an ordinary request, not a step here.

Set `status: implementing`. Decompose the remaining Spec into worker tasks in the
Implementation Tasks table. Every brief carries: a concrete objective, an ownership boundary (the
files/dirs the worker owns), the deliverable, and exact validation commands. GPT-lane
briefs additionally carry a fails-twice guardrail: *"if the same gate fails twice, stop
and report rather than iterating."* Every brief also gains a required closing section
reporting the worker's own choices: *"List each decision you made that this brief did
not settle, one line each, naming the file or piece of the design it affected. Write
'none' if there were none."* What you do with that section — and what you do when a
report lacks one — is under "Integration and exit" below.

Assign each task a tier as you write its brief and record it in the Lane column. The tier
follows the brief you actually wrote, not the one you meant to write: a task is
transcription-tier only if the brief names every file, the exact change, and a pattern
already in the tree to copy. The moment a brief has to say "figure out where this belongs"
or leaves a case unnamed, it is workhorse-tier. Writing the missing decision *into* the
brief to keep a task on the cheap lane is legitimate and good — that decision belonged in
the plan anyway. Assuming the lane will work it out is not.

**Ask once for everything the run needs, before dispatching anyone.** List what the run
depends on that only Collin can supply: every command named in the briefs' validation
lines that isn't on `PATH`, each lane the briefs use and whether it can log in
(`lanes.md`, "Checking a lane can log in"), and any service, credential, or access the
Spec names. Check what you can, then send Collin one message: every missing item with
its exact command, or a line saying nothing is needed — plus, when the reconcile step
above found an earlier run's records, its one-sentence pointer. A task depending on a
missing item isn't dispatched until Collin says it's resolved; every other task goes
ahead. A family that fails its login check holds back only the tasks assigned to that
family — they are not rerouted to the other family, per the existing Lanes rule below.
This step replaces "stop and report" for a login found missing before any dispatch; once
workers are running, the existing rules apply unchanged. It runs even in the small-patch
bypass. Once the message is sent, write a `Stage 3 started` line to the plan's Log — it
marks where this run's own records begin, for the end-of-run list under "Integration and
exit".

**Draw the run picture.** `docs/plans/<slug>/graphs/run.json`, with `run: true`,
`source: plan-proposal`, and `source_detail` naming the plan's Spec (`protocol/graphs.md`,
"Run pictures", has the format). One box per piece of the design, each tagged with the
task building it and status `not-started`, or `needs-you` with its `needs` for a task
held back above. A piece whose work moved to Prior Work as `pre-existing` gets task
`prior` and status `done` instead — that one value covers both a piece carried over from
an earlier attempt and one that came in already built with an adopted plan. Stores,
outside systems, and touched files that no task builds get boxes with no task. Related
pieces sit in visible groups; past 25 boxes, one container box per group opens into
`run-<group id>.json`, the same as any oversized graph. Labels follow `graphs.md`'s
plain-language rule, and the explanation names each task id's objective in a few words,
including what `prior` means ("built before this run") so it's never a bare coined id on
screen. Write it with the producer sequence in `graphs.md` ("Writing a graph"), show it with
`--show`, and print the URL. Right after that `--open`, run `--register-plan` again —
the registration at the top of this stage does nothing when no viewer was running yet,
and without this second call the list page has no entry to carry the run link. The
move-aside step above leaves no `run*.json` behind, so every name here is free to write.
Skipped, along with every update below, in the small-patch bypass.

**Keep it current.** Rewrite the picture when a task is dispatched (its boxes go
`in-progress`) and when you accept the task after your own re-run of its checks passes
(its boxes go `done` — a worker's claim alone never sets `done`). `in-progress` covers
everything in between: the worker running, your check, and any retry or escalation. A
box goes `needs-you` in exactly three cases: its task is blocked on something only
Collin can supply; the escalation ladder in `lanes.md` has run out; or a lane returned
nothing, so this stage stops under its own Lanes rule below and Collin has to step
in — `needs` then says what is needed. A failure you recover from, by a retry or an
escalation that works, never shows. Each of these moments is also where you read the
picture back first (`graphs.md`, "Reading a graph back"), so Collin's rulings are never
overwritten; a `409` is handled as `graphs.md` says. Tell Collin in your own turn, too,
whenever a part turns `needs-you` — the picture and its tab signal are not a substitute
for saying so.

**Never block on the picture.** A `409` is the normal race, handled as `graphs.md` says,
up to three times in a row on one update — a fourth counts as a failure. Any other
failure, at any point in the run — `--open` printing no URL, a refused write or
read-back, a viewer that can't be reached — ends the picture for the rest of this run.
Say so once, in plain words, and write nothing more to it: never delete, repair, or
recreate a picture file mid-run, and no retry. The next Stage 3 start draws a fresh one.
Choices still go into the Log (see "Integration and exit" below), so the end-of-run
message can still list them. The run's own gates — validation, review, escalation —
stay exactly as they are: showing progress is the extra here, the run is the job.

## Lanes

Read `lanes.md`, in this same directory, for the
exact invocations and cautions before launching any lane.

`lanes.md` owns tier selection and every lane invocation. On a Claude-only machine,
transcription briefs that would have gone to Luna stay on Sonnet: the Claude side has two
tiers, so nothing drops to Haiku. On a ChatGPT-only machine, interface, frontend, and
other taste-sensitive work goes to a GPT lane because no Claude lane exists; state that
cost at dispatch rather than refusing the task. Where a Claude lane is available, those
surfaces remain Claude work — the one-account exception does not permit rerouting one
family's logged-out work on a two-family machine.

`lanes.md` determines and reports when a lane returned nothing. Stage 3 stops with that
task recorded **unstarted**, not attempted; do not reroute its brief to the other family.
Its escalation ladder is untouched: it is for a lane that came back wrong, and a lane that
never ran has nothing to escalate.

Sol and Opus are not implementation lanes. A brief reaches one only after a cheaper lane
came back wrong, by lanes.md's "Escalate the model only on evidence" — a task that merely
looks hard is not grounds, it is just a task that starts at Terra. Escalating before a
lane has failed is the expensive mistake this stage exists to avoid; the lead's review
loop, not a bigger model, is what makes a cheap lane safe.

Because `codex exec` blocks, run each lane as a background Bash call and collect the
`-o` files as they finish. Parallelize only disjoint ownership boundaries — and only
across separate worktrees, where `lanes.md`'s credential rules allow it, since two
write-lanes in one checkout corrupt each other.
Overlapping boundaries sequence.

## Integration and exit

After each lane finishes: re-run its validation yourself and read the diff —
`completed` is a claim, not a fact, and GPT lanes fabricate completions.

When you accept a task's result, also handle its brief's choices section. For each
decision it lists, add one `choice` box to the run picture, wired to the part it
affected, with `task` set to that task, a plain-language label, and the worker's own
words in `note`. Before drawing them, write each one to the plan's Log first, one line
per choice in the Log's usual `- <date> — ` form, the text after the dash starting
`Choice:`, naming the task, the part, and the choice — the Log is written first so a
crash between the two writes never leaves a choice on the picture with no record. A
report with no such section is not accepted as `none`: list the choices you can see
against the brief in the diff you're already reading here, and draw them the same way,
with `note` saying you listed them because the worker didn't — no lane is re-contacted,
since no new invocation is needed. Either way, log it: "worker didn't report its
choices; the lead listed N" (including when N is 0), so a missing report is never
mistaken for "none".

Then sweep the routers. A change that moves ownership between directories updates the
routers on both sides as part of this change. A change that adds or removes a file updates
that directory's router only if it changes what the directory owns, or if the router named
that file. A router that is now false is fixed here. `protocol/routers.md` is the format —
read it before writing one, and note that it describes a router being *created* and is never
a conformance test for one that already exists.

**Immediately before writing COMPLETION.md**, read the run picture and every child you
can read — plain file reads of `run.json` and its children, not the viewer, so this
still works even if the picture ended under "Never block on the picture" above — and
collect every `choice` whose `origin` is `rejected`. A file that doesn't parse is
skipped, and the end-of-run message names it so Collin can raise a strike by hand. Turn
each into a new Implementation Tasks row, a follow-up task that undoes or redoes that
choice, whose objective names the choice; every part it affected — including one in
another file that its `note` names — gets `task` set to the follow-up and status
`in-progress`, and the follow-up is dispatched and accepted like any other task before
COMPLETION.md is written. The struck `choice` box stays on the picture; a replacement
choice gets a new id. Do this once. The end-of-run message lists every `Choice:` Log
line since this run's own `Stage 3 started` line, and says that a strike made from here
on isn't picked up automatically — Collin can still raise one with you by hand.

When all tasks are done and full validation is green, write
`docs/plans/<slug>/COMPLETION.md` from `templates/COMPLETION.md`: spec-item-by-item
coverage with file:line references and each item's origin (`this run` or `pre-existing`),
deviations from the Spec (including each struck choice from the collection just above and
what replaced it), pasted validation evidence, residual risks, and the implementing
lanes in frontmatter (Stage 4 selects and records its verifier under
`verification.md`). Every spec item gets a row including the pre-existing ones — coverage
is the point, and Stage 4 verifies them
too. Set `status: verifying` and hand off to Stage 4.

COMPLETION.md is written for a hostile reviewer: every claim checkable, no claim
without evidence. It is written once and read rendered, so a Mermaid diagram of what the change
actually does belongs in it — `diagrams.md` for the rules.
