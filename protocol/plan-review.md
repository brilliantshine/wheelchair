# Stage 2 — Plan review

Adversarial review of a plan produced by Stage 1, through two independent lenses.

**Input:** a plan slug. A plan written outside this workflow is brought in with
`adopt.md` first; this stage does not take document paths.

**Register the plan directory with the viewer at the start**, before anything else. You
are reading this document at `<root>/protocol/plan-review.md`, so `WHEELCHAIR` is that
path with `/protocol/plan-review.md` dropped, the same rule `graphs.md` uses:

```bash
node "$WHEELCHAIR/viewer/server.js" --register-plan <repo>/docs/plans/<slug>
```

It returns at once, never starts a server, and never fails the stage: it registers
through a running viewer if one answers, and otherwise does nothing. On any error it
prints one warning line — pass it on to Collin in your turn, including "a viewer from an
older version is running; run ./install.sh", and carry on.

**Precondition:** `docs/plans/<slug>/PLAN.md` has `status: ready-for-review` (or
`approved`, if the user explicitly wants another round). Otherwise refuse and name the
missing stage.

The reviewers report; **the lead adjudicates**. A reviewer's self-assigned severity is an
opinion, not a gate — otherwise the reviewer controls when the loop terminates, and a
lane told to "attack" always finds something to call major.

## Round N

N = 1 + the number of existing "Round" headings under Review Rounds.

Directly under this round heading, write `**Lanes:**` and name each reviewer's family and
model, followed by whether the round was cross-family. For example:
`**Lanes:** GPT / gpt-5.6-sol; Claude / default reviewer model; cross-family: yes.`
This records the gate even when both lenses return no findings.

**Scope of the round:**

- **Round 1** — the whole Spec.
- **Round 2+** — the changes since the previous round, reviewed in depth, plus one
  whole-Spec coherence pass (does it still hang together; did a fix contradict something
  elsewhere). Unchanged sections that already passed a round are not re-litigated without
  new evidence. Before launching, write a short **Changed since Round N-1** list into the
  round's section — that list is what scopes the reviewers. If the plan is committed,
  `git diff` on PLAN.md is the more reliable source for it.

Launch two **independent** reviewers — each fresh-context, each given only the plan path
and repo access, never this conversation. With both families available, launch the
cross-family pair in parallel, as today. With one family, use both reviewers from that
family: Claude reviewers may run in parallel; GPT reviewers run one after the other, as
`lanes.md` requires. Read `lanes.md`, in this same directory, for the exact lane
invocations and cautions before launching.

Both lanes are read-only here: a plan reviewer reads code and reports, it never edits.

## The brief

Both briefs carry the task, the severity ladder, and the adjudication record:

> Read `docs/plans/<slug>/IDEA.md` first — the plain-language statement of what this is
> for and what it is explicitly not doing — then `docs/plans/<slug>/PLAN.md`. Attack the
> Spec: ambiguity a worker could misread, missing lifecycle and edge cases, contradictions
> with the current code (verify against source, not the plan's claims), unverifiable
> success criteria, simpler designs that meet the same goal, and any place the Spec has
> drifted from the idea — solving a different problem, or reaching past the stated
> non-goals.
>
> **Severity is defined by what it would do to an implementing worker, not by how much it
> bothers you:**
> - `blocking` — a worker following this Spec would build the wrong thing, or could not
>   implement it as written.
> - `major` — a worker would have to stop and ask before proceeding.
> - `minor` — everything else: polish, taste, optional improvement, a better-but-not-
>   necessary design.
>
> A finding you cannot tie to a concrete worker consequence is `minor`. Reporting nothing
> is an acceptable outcome; padding severity is not.
>
> The idea document's "How solid this has to be" section says what kind of build this is
> and, in the author's own words, what it has to do and for whom. Together those set **what
> the Spec has to cover** — not how hard you grade what it does cover. Inside that scope the
> ladder above applies exactly as written: ambiguity is still `major`, a Spec that could not
> be implemented is still `blocking`. Outside it, do not stay silent and do not grade it as a
> defect: report it once per distinct area, at `minor`, beginning the finding
> `OUT-OF-SCOPE:`, so it can be written down for whoever picks this up later. One line per
> area, not per unhandled case. Whether the section states a kind at all, and what to do when
> it does not, is decided by the rule in `<wheelchair-root>/protocol/planning.md` Step 2.
> Read it there.
>
> The Review Rounds table, the Accepted Risks section, and any Deferred row whose `Source` is
> a review round record findings already settled.
> Anything marked `declined`, `accepted-risk` or `deferred` was considered and closed with a
> rationale — do not re-raise it unless you have concrete evidence that rationale is
> factually wrong. If you do, prefix the line `RE-RAISE:` and cite the evidence. A Deferred
> row whose `Source` is `planning` or `adopted` is **not** settled: nobody adjudicated it, so
> it is yours to attack like anything else in the Spec.
>
> Report each finding on one line:
> `SEVERITY: blocking|major|minor — <finding> — <evidence>`

**Substitute a real absolute path for `<wheelchair-root>` when you compose the brief.** You are
reading this file at `<root>/protocol/plan-review.md`, so you already know the root — the same
derivation `graphs.md` and `spine.md` spell out. A relative `protocol/planning.md` resolves
nowhere in a reviewer lane: the lane runs with the **target** repo as its working directory, and
`protocol/` exists only in this clone. `install.sh` states the rule for every wrapper for the
same reason. A reviewer that cannot open the match rule falls back to the strict reading and
grades every demo plan as something people depend on — silently, and on exactly the path the
statement exists to serve.

Brief one reviewer for the **mechanics lens**: attack ambiguity, missing lifecycle,
contradictions with the code, and unverifiable success criteria in the Spec. Brief the
other for the **intent lens**, measured against IDEA.md: is this the right and simplest
shape for the stated problem, and does it still serve what the idea says it is for? In a
cross-family round, retain the existing slant by giving Claude the intent lens. In a
one-family round, the lens — not the family — is the whole distinction between the two
reviews. Judge GPT findings by their parsed SEVERITY lines only — its prose reads polished
regardless of depth.

`lanes.md` determines and reports when a lane returned nothing. For an ordinary dead
lane, stop the stage: do not treat missing findings as a clean review, and do not triage a
partial round. A round ended this way does not count against the cap because it produced
no triage. An announced authentication failure is different: run the one-account path and
name the login failure in the round's **Lanes:** line. If the other reviewer already
reported, retain that review as the lens it was briefed for and run one further reviewer
from the surviving family under the missing lens; do not restart the round or discard the
completed review.

## Merge and triage

Record every finding in the Review Rounds table and give each one a **lead verdict**:

| Verdict | Meaning |
|---|---|
| `upheld` | Real at the reported severity. Fix it. |
| `downgraded` | Real but over-severed. Record the true severity and why. |
| `declined` | Not a defect. Record why; future rounds must honor it. |
| `accepted-risk` | Real, not worth fixing. Promote to the Spec's Accepted Risks section. |
| `deferred` | Real, and outside what this build's stated kind has to cover. Record why; promote to the Spec's Deferred section. Future rounds must honor it. |
| `user-decision` | A genuine fork. Append to Open Questions. |

**You may not downgrade, decline, or defer a finding you have not checked** against the Spec
or the code — the verdict cites evidence the same way the finding does. Those three are how
this loop terminates, which is exactly why each needs a receipt; a round where you downgrade
most findings means either the ladder isn't landing in the brief, or you are rationalizing
your way to `approved`.

A `deferred` verdict is a ruling about **scope**, not severity: the work is real and falls
outside what this build's stated kind has to cover. The receipt says why it falls outside. A
finding a reviewer marked `OUT-OF-SCOPE:` that you judge to be *in* scope does not take
`deferred` — it takes whichever ordinary verdict fits, and if that is `upheld` the answer goes
into the Spec like any other. The reviewer's scope call is a report; yours is the ruling.

Then act on the verdicts: `upheld` findings update the Spec (real design changes also get
a Decision Log entry with source `review-round-N`); `downgraded` ones are fixed only if
cheap, otherwise left with their recorded rationale; `accepted-risk` moves to Accepted
Risks; `deferred` moves to Deferred with `Source: review-round-N`; `user-decision` findings
drain through Open Questions **one at a time** under Stage 1 loop rules.

Round summaries and `user-decision` questions shown to the user follow
`writing.md`, beside this file — finding
IDs and round numbers get re-grounded on first use, and the summary reports what would
break, not which reviewer said what.

## Exit

A round is clean when lead triage upholds **zero blocking and zero major** findings and
no `user-decision` finding is still open. A `deferred` finding does not count against the
gate, exactly as an `accepted-risk` one does not. Both lanes' output feeds one triage — the gate
is the triage, not two independently clean reports.

Before setting the status, draw or refresh the Spec's Mermaid diagram per `diagrams.md` —
if the plan has a graph under `docs/plans/<slug>/graphs/`, its "Authoring a Spec diagram
from a graph" section says how to draw from it. This is the first moment the Spec is final,
and the last moment anything is cheap to fix. Then set `status: approved`.

**Cap: three triaged rounds.** A round ended by a dead lane does not count. If round 3
does not produce a clean triage, stop and bring it to the user with the findings that keep
recurring. Review that won't converge in three rounds is signalling an unresolved fork in
the plan itself — that is a Stage 1 decision, not more review.

The cap counts rounds since the last user decision, not rounds ever. Once the user
settles the fork through Open Questions, the budget resets and reviewing may continue —
the cap exists to force escalation, not to permanently bar further rounds.
