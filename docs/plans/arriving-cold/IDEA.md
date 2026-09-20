---
slug: arriving-cold
status: confirmed   # draft | confirmed
created: 2026-09-19
---

# Knowing what you have actually seen

The north star. Written before any design questions, confirmed by the user, then held
stable while PLAN.md churns. Anyone — including a fresh agent mid-project — should be able
to read this alone and understand what is being built and why.

Plain language throughout. No jargon, no implementation detail, no design decisions.

## What we're building

A running record of what you have actually been shown in a piece of work, kept as a file
beside it, and a cheap check that reads it before each turn. When the agent is about to
answer with something that depends on work you never saw, the check says so first, and the
turn explains that part instead of assuming you were there. A second, smaller record holds
wording you have pushed back on, so the same phrasing does not keep coming back at you.

Neither record is ever added to the agent's standing instructions. Both are read by the
check, which reports one turn at a time.

## Why — the problem

An agent does most of its work where you cannot see it. Plan review runs two independent
reviewers a round, for up to three rounds, and every one of them is handed the plan and the
repository but never the conversation. Implementation and verification have the same shape.
All of that happens inside one long turn, and what reaches you is a summary.

So the turn that follows is written by something that just spent an hour with material you
never read, and it cannot tell the difference. Everything is equally established from
inside its own context. You get a question that references a contention from round three by
name, and you have no idea what it is talking about — not because the agent wrote it badly,
but because it had no way to know you weren't there.

The workflow already tries to fix this by telling agents to write every turn for someone
arriving cold, in six separate places. Those rules ask for a judgment that needs a fact
nobody supplies: which parts of this you have seen. No amount of rewriting them produces
that fact.

The same gap opens without any hidden work at all. Come back to a thread eight hours later
and you are cold on everything except the calls you made yourself — and nothing currently
notices, because a long silence inside one sitting looks identical to a short one.

## What good looks like

- After a stretch of work you did not watch, the next turn explains what it is leaning on,
  and you do not have to ask what it is talking about.
- A turn that depends on nothing you missed reads exactly as it does today. No preamble, no
  recap, no re-explaining things you already hold. Over-explaining is as much a failure as
  under-explaining.
- Coming back to a thread after hours away, the first turn re-grounds the material without
  reciting your own decisions back to you.
- Asking for something simpler, or asking what a word means, changes how you are written to
  later — including in other work, on other days.
- Nothing about your preferences becomes permanent without you agreeing to it, and you can
  see what is on the list and remove things from it.
- The agent's standing instructions are unchanged by all of this. If you diffed them before
  and after, nothing would have moved.
- You do not wait longer for an answer than you do today.

## How solid this has to be

**People are going to depend on this.** That is you, every working day, on the thing you
review agent work through — and, through the shared record of wording, on every project you
use these agents in rather than just this one.

What breaks if it is wrong has two shapes and they pull in opposite directions. A check that
is too quiet leaves the original problem in place, which is survivable because that is
today. A check that is too eager is worse than nothing: every turn arrives padded with
re-explanation of things you already knew, which is precisely the failure the writing rules
in this repository exist against, and it would be arriving through a mechanism you cannot
see in any prompt. The record of wording has the same edge — a wrong entry in it quietly
bends every turn afterwards, in every project, with nothing on screen saying why.

## Not doing

- **Not another revision of the agent's instructions.** Those have been through many passes
  and are at the end of what wording can do here. This adds a fact, not a rule.
- **Not a model of what you know in general.** It covers what a given piece of work put in
  front of you, and nothing about your expertise, your history, or what you know outside it.
- **Not silent learning.** Nothing observed becomes a standing preference until you have
  ruled on it.
- **Not doing any of the work.** It does not write code, review code, make decisions, or
  take part in the task. It reads and it reports.
- **Not running continuously.** It has no presence between turns and nothing to keep alive.
- **Not replacing the existing writing rules or the graph verdicts.** Both stay exactly as
  they are; this supplies the fact the writing rules were always missing.
- **Not a transcript.** A record of what landed with you, not a second copy of the
  conversation.

## Constraints

- **Nothing may be added to the main agent's standing instructions.** Non-negotiable, and
  the reason this is being built as a separate thing rather than as more prose.
- **It has to work the same from both harnesses.** Running identically from Claude Code and
  the Codex CLI is a property this repository leads with, and a feature that works in one
  and not the other breaks it.
- **The record is a file.** The documents are the state and the conversation is disposable,
  which is the whole premise of this workflow; a record held only in a context window
  vanishes at exactly the moment it was built to help.
- **It cannot make you wait.** Checking has to happen where it does not sit between your
  message and your answer.
- **One account, and quota is a hard stop.** There is a single Codex login with no fallback,
  so anything that fires on every turn has to be cheap enough to fire on every turn.
- **Both harnesses expose a per-turn mechanism, and neither has been proven to work here.**
  The map records what the Codex binary carries and what Claude Code offers; nothing has
  actually been fired. If that turns out not to hold, this idea needs revisiting before
  anything is designed.
