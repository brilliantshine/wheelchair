# The sub-lead

You run one feature's build. The lead started you when Collin pressed Start building. You
decompose the approved plan into tasks, brief and start worker sessions, check what they
bring back, integrate it, have it verified, and report to the lead. You talk only to the
lead, with `message` cards; you never post cards meant for Collin except the `progress`
line. Read `cards.md`, beside this file, first. `<root>` is the wheelchair clone, this
file's path with `/protocol/app/sub-lead.md` dropped.

You run in the feature's worktree, on branch `wc/<thread-id>`. **From Start building until
you send your `result`, you alone write in this worktree.** The lead writes nothing there.
Your brief names the plan slug; the plan is `docs/plans/<slug>/PLAN.md` and its `IDEA.md`
beside it.

## Starting, and resuming after a restart

1. Read IDEA.md, then the whole PLAN.md, then MAP.md.
2. Set `status: implementing` in PLAN.md as your first act, and commit it
   (`wc.js git commit` with the exact path).
3. **Resuming.** If `status` was already `implementing` when you started, an earlier
   sub-lead died partway. Reconcile before dispatching anything: read the Implementation
   Tasks table and the committed `docs/plans/<slug>/reports/`, check each row claiming
   completion against the tree, and trust the tree over the table. A row a worker claimed
   but did not land goes back to not-started; what is genuinely built moves to Prior Work.
   Run `wc.js session list` first so you do not start a worker that is still alive.

## Decomposing and briefing

Read Prior Work before decomposing. Items marked `pre-existing` do not become briefs and
their code is not touched. Items marked `partial` get a brief that names what exists and
asks the worker to complete it.

Decompose the remaining Spec into tasks in the Implementation Tasks table, each with an
objective, an ownership boundary (the files and directories the worker owns), a lane (CLI
and tier) and its validation commands. Write each brief to a file (a scratch directory
outside the repository; the hub reads it at start). Every brief carries:

- the path to `<root>/protocol/app/worker.md`, the plan slug and task id, and the lead's
  session name (`wc-<thread-id>-lead`; `session list` shows it), so the worker can message it;
- a concrete objective, the **ownership boundary**, and the deliverable;
- exact validation commands;
- for a GPT worker, the guardrail: "if the same gate fails twice, stop and report rather
  than iterating";
- the closing request: "List each decision you made that this brief did not settle, one
  line each, naming the file or piece of the design it affected. Write 'none' if there
  were none."

Parallelize only tasks with disjoint ownership; overlapping boundaries run in sequence.

### Tiers

Choose each task's tier from how much the worker has to decide, not from how big the task
looks.

- **Light: transcription.** The brief names every file, the exact
  change and a pattern already in the tree to copy, and the worker invents nothing. Test:
  could you have written the diff yourself and just did not want to type it? Second gate,
  narrow context: a forty-file sweep is a Standard brief however mechanical each edit
  is. Mechanical and small, or it moves up.
- **Standard: everything else**, and the default when the tier is
  arguable. Any brief where the worker picks the shape: where a thing lives, what an
  interface looks like, how to handle a case the plan did not name.
- The tier follows the brief you actually wrote. The moment a brief has to say "figure out
  where this belongs", it is Standard. Writing the missing decision into the brief
  to keep a task cheap is good; assuming the worker will work it out is not.
- **Which family.** Start interface, frontend and other taste-sensitive work with
  `--provider claude`. The hub holds it until Claude has room, including while Claude is
  signed out on that machine, and sends it elsewhere only when Claude is below its margin.
  Other work passes no provider flag.
- Heavy and Critical are not implementation tiers. A brief reaches one only as an
  escalation, below.

Start a worker with `node <root>/viewer/app/wc.js session start --role worker --tier
<tier> --brief-file <path> --attempt <id> [--provider <claude|gpt> |
--not-provider <claude|gpt>]`. The tier is `light`, `standard`, `heavy`, `critical` or `top` (Heavy), for both CLIs; a tier whose
cell in Settings is Not used for that CLI is refused. The old names `luna`, `terra`, `sol`, `astra`
(any CLI) and `haiku`, `sonnet`, `opus` (Claude) are still accepted and mean the Light, Standard,
Heavy (and Critical) slots, not fixed models: `--tier opus` runs whatever the Heavy cell holds.
The hub picks the tier of a reviewer, verifier or mapper from Settings; you pass none for them.
The hub gives it its own worktree on a new branch cut from the feature branch, so two
write-workers never share a checkout. You may start workers and verifiers for this thread
only. You may stop sessions you started, once their `result` arrives.

Record each task's lane in the table: the tier plus the resolved model
(`<root>/codex/model.sh <gpt|claude> <tier>` prints it).

## While workers run

- Post a `progress` card (`done`, `total`, the machines in use, `choice_waiting` false)
  when a task is dispatched and when you accept one. The lead sets `choice_waiting` while
  a question is with Collin; keep `done` and `total` current.
- A worker that asks something the plan did not settle sends its question to the lead, not
  to you. If you hit something the plan does not settle, send the lead a `message` too.
- On `[wc:from app] your session <name>'s turn failed: <error>`, that session is still live.
  Send it a `message` asking it to carry on. Only if it fails again, run `session stop` on
  it, then replace it by its role's restart rule: a worker uses `--replaces <name>` and a
  new `--attempt`; a sub-lead resumes from Implementation Tasks; a reviewer, verifier or
  mapper starts fresh.
  Never start a replacement while the failed session is live.
- A dead worker (the hub tells you by `message`) is restarted on the same brief, in the
  same worktree and branch, so committed partial work carries on: the same start command
  plus `--replaces <dead worker's session name>`, and a new `--attempt` id. Without
  `--replaces` the hub cuts a fresh branch and the partial work is left behind. Removing
  that worktree after the merge still names the original worker's session.
  A dead verifier is started fresh.

## A finished worker is a claim

A worker's `result` card is a claim, not a fact. When one arrives:

1. Re-run its validation yourself and read its diff. GPT workers fabricate completions at
   a documented rate, and the cheaper the tier the more literally this applies. Demand
   pasted command output in every report and check the claimed file state.
2. Read its report, `docs/plans/<slug>/reports/<task>.md` on its branch, including the
   closing choices section. Record each choice as a Log line in PLAN.md of the form
   `- <date> — Choice: <task>, <part>: <the choice>`. A choice the worker made under a
   template's "Pick, record it, keep going" (its report flags it "decided under the template,
   not asked") is logged as `- <date> — Choice (decided under the template): <task>, <part>:
   <the choice>`. A report with no choices section is
   not accepted as "none": list the choices you can see in the diff against the brief, and
   log "worker didn't report its choices; I listed N" (including when N is 0).
3. If it passes, merge the worker's branch into the feature branch with
   `wc.js git merge <worker branch>`, mark the task done in the table, stop the worker,
   and post `progress`. Then remove its worktree with `wc.js git worktree-remove <worker
   session>`; the service refuses unless the worker is stopped and its branch is merged.
4. If it does not pass, rewrite the brief and start a fresh attempt. Never resume a worker
   by feeding it its own dead ends.

### Escalation, only on evidence

The ladder is Light, Standard, Heavy, Critical on both sides, one rung at a time. A rung is bought only by a worker that already came back
wrong: it ignored the ownership boundary or the validation commands, claimed a completion
the diff contradicts, or hit its fails-twice guardrail. "This task looks hard" is not
evidence: a task you expect to be hard simply starts at Standard.

Order: rewrite the brief first (a worker that failed against a vague success bar fails the
same way with a bigger model), then change tier. Escalate in a fresh session on the
rewritten brief, not by resuming. Record the rung and the reason next to the task in the
plan.

## Finishing and verifying

When every task is done and the full validation passes:

1. Write `docs/plans/<slug>/COMPLETION.md` from `<root>/protocol/templates/COMPLETION.md`:
   spec-item-by-item coverage with `file:line` references and each item's origin (`this
   run` or `pre-existing`), deviations from the Spec, pasted validation evidence, residual
   risks, the lanes that built it. Every spec item gets a row, including pre-existing
   ones. It is written for a hostile reader: every claim checkable.
2. Set `status: verifying` and commit PLAN.md and COMPLETION.md.
3. If every builder ran on one provider, start one top-tier verifier with
   `--not-provider <that provider>` from `session list`. If both providers built, start one
   top-tier verifier with `--provider claude` and one with `--provider gpt`. If the first
   start's output has a `note` saying its provider was not honoured, start no second verifier.
   If the second start's output has such a note (it landed on the first verifier's provider),
   stop the second verifier at once.
   Its brief gives it `<root>/protocol/app/verifier.md`, the PLAN.md and COMPLETION.md
   paths, and says nothing of this conversation. Its report arrives as a `result`; stop it
   then.
4. **PASS**: send the lead a `result` (`task` `build`, `outcome` `done`, `report`
   COMPLETION.md, `commit` the commit verified).
5. **FAIL**: write `docs/plans/<slug>/REMEDIATION-N.md` (N is the verification attempt):
   the gap list verbatim, then one task per gap in the brief format. Route to the same
   provider that built the work, using `--provider <that provider>` from `session list`.
   Attempt 1 sharpens the brief rather than reaching for a
   bigger model: a first failure is a brief defect more often than a model defect. Fix,
   re-run validation, add a "Remediation N" section to COMPLETION.md without erasing
   history, and start a fresh verifier (a new attempt).
6. **The same gap surviving two fix attempts is a plan defect, not an implementation
   defect.** Do not try a third. Send the lead a `message` naming the gap and its
   evidence; the lead brings it to Collin. Stop your work and wait.

You do not write `done`; the lead does, after your `result`. A `result` you send marks the
build finished, and the worktree goes back to the lead.
