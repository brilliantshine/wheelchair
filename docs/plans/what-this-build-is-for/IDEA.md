---
slug: what-this-build-is-for
status: confirmed   # draft | confirmed
created: 2026-09-19
---

# A plan says how solid its thing has to be, and review believes it

## What we're building

A plan states up front what kind of build it is: a demo that gets shown and will probably
be thrown away, or something people are going to depend on. The review that follows holds
the plan to that bar instead of always to the strictest one. And when the lower bar means
deliberately leaving something out, the thing left out gets written down somewhere a later
plan can pick it up — rather than being argued away as unimportant, or simply forgotten.

## Why — the problem

Every plan is currently reviewed as though whatever it describes has to hold up forever.
That is not a bug in the review stage so much as a consequence of what the reviewers are
told: they get the plan and are asked to attack it, with nothing anywhere saying how
durable the result needs to be. Faced with that, the only safe reading of "a worker would
build the wrong thing" is the strict one, so a gap on a path a demo would never walk comes
back as a serious finding — correctly, given what the reviewer knew.

The cost is real and it shows up in this repo's own history: the two most recent plans
landed with commit messages reading "six review rounds, and the defect a real corpus could
not find" and "six review rounds, four verification rounds." Some of that was earned. Not
all of it. Right now there is no way to ask for a rough thing without paying for a durable
one, which in practice means the workflow is unattractive for exactly the quick, scrappy
work it could most easily help with — so that work gets done outside it, with no record at
all.

The second half of the problem is what happens to the corners that get cut. There is
exactly one place today to record something real that the plan chose not to do, and it is
labelled for issues that were judged not worth fixing. "Not worth fixing" and "we will need
this if this thing survives" are different claims, and collapsing them means a rough build
either has to pretend it is complete, or it loses its own list of what it owes.

## What good looks like

- You can start a plan for something you intend to demo, and it reaches a state you can
  build from without the review loop grinding over problems that only matter if the thing
  ships.
- Reading a finished plan months later tells you which kind of build it was, plainly,
  rather than leaving you to infer it from how careful the writing sounds.
- When a rough build earns a second life, the plan that hardens it starts from a written
  list of what the first one knowingly left out — not from re-reading old review arguments
  and guessing which of them still apply.
- A plan for something people will depend on goes through exactly what it goes through
  today. Nothing about this makes the careful path less careful.
- Nothing gets rough by accident: a plan that never says which kind it is behaves the way
  plans behave now.

## How solid this has to be

**People are going to depend on this.** It changes the workflow every future plan in this
repo runs through, and a mistake here is not visible in one build — it shows up as every
later plan being reviewed against the wrong standard, quietly, with nothing flagging it.
Who depends on it: anyone running this workflow, on every plan after this one.

(This section is the thing the plan introduces, and it opens with one of the two fixed
sentences the plan requires. It is written here so the plan follows its own rule, and so
the shape can be judged against a real example rather than a template.)

## Not doing

- **Not adding a third setting for a quick hack.** Something you would just sit down and
  write does not enter this workflow at all, so a name for it here would label nothing.
- **Not letting the reviewing side choose the bar.** Whoever is adjudicating findings must
  not be able to reach for a lower standard partway through a round to end it. This is your
  call, made once, before the design questions start.
- **Not lowering any standard by default**, and not touching plans already in flight.
- **Not building a general dial with many positions.** Two kinds of build, named; not a
  sliding scale of rigor.
- **Not redefining what makes a finding serious.** The existing ladder — would a worker
  build the wrong thing, would a worker have to stop and ask — is the right question. The
  change is that reviewers finally know what "wrong" is being measured against.
- **Not promising the rough path is cheap.** It should stop being disproportionate. Whether
  it also ends up faster is an outcome, not a goal.

## Constraints

- A rule written into a stage's instructions but not into the matching template reaches
  nobody, because the stage tells the agent to write from the template
  (`protocol/AGENTS.md:46-48`).
- Nothing may end up gated twice. If a rule already has a home, other documents point at it
  rather than restating it (`protocol/AGENTS.md:43-45`).
- Both harnesses read the same instruction files, so nothing may end up telling Claude and
  Codex different things.
- Plans that already exist have no such statement in them and must stay valid and
  reviewable as they are.
