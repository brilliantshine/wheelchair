---
slug: model-pins
status: confirmed   # draft | confirmed
created: 2026-09-29
---

# Switch GPT models without editing wheelchair

## What we're building

Wheelchair's rules will stop naming GPT models and name only the tiers: Luna, Terra, Sol and
Astra. Each machine keeps a small local record of which GPT model each tier uses right now,
set up by the installer. When Codex knows about a newer model for a tier than the one pinned,
wheelchair says so in one line, once a session, with the one command that switches to it.
Nothing switches unless Collin runs it.

## Why — the problem

Every time OpenAI ships a GPT model, using it means editing the model names in four rule
documents and merging a PR. That happened on 2026-09-29 with PR #20. Collin also has to notice
the new model exists and remember which tier it should go to. Letting wheelchair always grab
the newest model would fix the effort but take the choice away, and the choice matters. Astra
burns quota very fast. A newer Sol isn't always worth the change. Terra stays on 5.6 because,
with a complete plan, it doesn't need escalating.

## What good looks like

- A new GPT model ships. The next time a stage is about to use a GPT lane, Collin sees one line
  saying which tier it could replace, and the exact command to switch. He runs it or ignores
  it, and no wheelchair PR is involved either way.
- After switching, every stage uses the new model for that tier, including follow-up messages
  to a lane that is already running.
- If he ignores the heads-up, nothing changes, and the line doesn't nag more than once a
  session.
- The rule documents read the same whatever models a machine has pinned. They describe what
  each tier is for, not which model fills it.
- A machine with nothing pinned yet, or that has never run Codex, still works as it does today.
  It is never blocked by any of this.

## Not doing

- Claude lanes. They keep using the `sonnet` and `opus` aliases, which already move to each new
  model on their own.
- Switching automatically. Wheelchair only points out a newer model, never picks it.
- Deciding which tier a brand-new model family belongs to. If a model appears with a tier name
  wheelchair doesn't know, the choice of where it fits stays Collin's.
- Changing what each tier is for, or how escalation works.

## Constraints

- The heads-up can't change the login check's exit codes, which decide how lanes are
  dispatched.
- `codex exec resume` doesn't accept a profile, so a resumed lane has to be able to name its
  model directly.
- Anything written outside this repo, in Codex's settings, follows the same rule as the rest of
  the installer. Only wheelchair's own entries are touched, and it refuses rather than guesses on
  a file it doesn't understand.
