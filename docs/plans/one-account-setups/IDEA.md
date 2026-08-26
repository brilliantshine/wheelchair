---
slug: one-account-setups
status: confirmed   # draft | confirmed
created: 2026-08-25
---

# Make this workflow run on somebody else's machine, with whichever one account they have

## What we're building

Right now this workflow assumes you have two paid AI accounts and a particular credential
setup that exists on exactly one laptop. Most people have one account, and nobody else has
that credential setup. This change makes the whole thing work for a person who has only a
Claude subscription, or only a ChatGPT one — every command runs, nothing silently points at
a tool they don't own — while being straight with them about the one thing they're giving
up by having one instead of two.

## Why — the problem

A friend wants to use this and can't. Three separate reasons, and only the third is about
having one account:

Every time the workflow farms work out to a ChatGPT lane, it points that lane at a
credential directory that lives on one specific machine and nowhere else. Somebody who has
*both* accounts still can't run it. That is the flat blocker.

The installer writes configuration into the home directories of both tools regardless of
which ones are installed. Someone who has never installed the ChatGPT command-line tool
ends up with a settings file for it anyway.

And two of the stages — the one that attacks a plan before it gets built, and the one that
checks the finished work — are defined entirely in terms of "the other family": one
reviewer from each of the two, and a checker from whichever side didn't do the building.
With one account there is no other side, and neither stage says what to do instead. They
don't degrade; they have no defined behaviour at all.

## What good looks like

Someone with one account clones this, runs the installer, and every command works. Nothing
gets written into a directory for a tool they don't have. No lane points at a credential
store that isn't there.

They can run a plan through review and a build through checking, and both stages do real
work rather than refusing or quietly doing nothing.

They are told plainly, once, what having one account costs them — not buried, not
apologised for, and not oversold as equivalent.

When a plan gets the thinner version of a gate, the plan document itself records that. A
person reading it six months later can tell "this got the one-account review" apart from
"somebody skipped review", without having to reconstruct which machine it ran on.

Somebody who has both accounts sees no change in behaviour whatsoever.

The written description of this workflow stops promising something it can't always deliver,
and starts saying what it actually does in each situation.

## Not doing

**Not claiming the one-account version is as good.** Two different families of model fail
in different ways, and that is most of why the checking stages are worth running. One
account loses that and nothing gets it back. Any design that papers over this is wrong.

**Not supporting a third tool, or any other AI provider.** The two that exist are the two.

**Not making a person configure this by hand** — no settings file to fill in, no flag to
remember, no "tell it which accounts you have."

**Not changing what happens when both accounts are present.** That path is the one in use
today and it stays exactly as it is.

**Not supporting somebody with neither account.** They have nothing to run.

**Not making the picture viewer optional.** It needs a JavaScript runtime, that stays a
requirement, and it is unrelated to which AI account you have.

**Not building a way to test this workflow's own stages automatically.** There is no test
suite for the protocol documents today and this change does not invent one.

## Constraints

The command wrappers registered with each tool carry no instructions of their own — each is
a single pointer at one rules document. Two copies of a rule means the two tools start
disagreeing the moment one copy is edited. This is the repo's own standing rule and it
holds here.

The documents are the state. A fresh session, in either tool, has to be able to pick a
half-finished plan up from the files alone.

The two tools have to stay in lockstep: one source for any shared setting, one thing that
writes it, nothing kept in sync by hand.

Whatever decides which accounts are available has to be right without being told, because
the point above rules out asking.
