# Adopt — fast-forward an external plan into the workflow

Take a plan document that did not come from Stage 1 — written by hand, by another agent,
or by someone else — normalize it into the workflow's shape, and land it at the right
point in the state machine.

This is a **transform, not a conversation.** It reads, normalizes, reports gaps, and asks
exactly one question: where does this land. Discussion of the gaps happens afterward in
Stage 1 if it's needed. Adoption that turns into a planning session has overstepped.

Input: a path to a document. The other stages take slugs only — adoption is the single
on-ramp for outside work, so there is one place to look when asking how a plan got here.

## Steps

**1. Read the source in full** before writing anything.

**2. Derive the slug** from the document's title or filename, kebab-cased. State the slug
you chose rather than asking. If `docs/plans/<slug>/` already exists, stop — that is a
collision the user has to resolve.

**3. Copy the source in.** Never move or modify the original; record its path in PLAN.md
frontmatter as `adopted-from:`.

**4. Synthesize `IDEA.md`** from `templates/IDEA.md`. External docs are written as design,
not intent, so most of this is inference: pull out what is being built, why, what good
looks like, and the non-goals. **Mark every inferred line** — the user is confirming your
reading of their document, and they can only correct what is visibly a guess.

**5. Build `PLAN.md`** from `templates/PLAN.md`:

- The document's design content goes under `## Spec`, restructured only as much as the
  template requires. Do not rewrite it into your own words — you would launder away the
  vagueness you are supposed to be reporting.
- Decisions the document already made go into the Decision Log with source `adopted`.
- Anything the document raises but leaves unresolved goes into Open Questions.
- Anything you noticed that needs looking into goes on the Watch List.

**6. Check what already exists.** A plan brought in from outside is often partly built —
someone ran step 1 before switching to this workflow. Walk each item of the Spec and look
for it in the tree: the modules, functions, tests, and behavior the item describes. Record
findings in PLAN.md's Prior Work section with `file:line` evidence and your confidence.

**When the evidence is ambiguous, mark it not done.** A wrong "done" is silent — the item
never gets built and never gets verified, and nothing surfaces the hole. A wrong "not done"
is noisy — a worker looks, finds it already there, and says so. Take the noisy failure
every time.

Partially-built items are **not done**. Record what exists so the implementing brief can
tell the worker to complete it rather than restart it.

**7. Write the gap report** — what the protocol needs that the document does not have.
External plans most often lack: concrete validation commands, explicit non-goals, edge
cases and failure behavior, and success criteria you could verify rather than assert.

## Where it lands

Present the synthesized `IDEA.md`, the prior-work findings, and the gap report together
(written under
`writing.md`, beside this file), then ask
the **one** question: where should this land? The findings are awareness — the
user corrects any you got wrong in the same reply.

| Landing | When | Next |
|---|---|---|
| `approved` | Already reviewed to your satisfaction; gaps are minor or absent. | `/implement <slug>` |
| `ready-for-review` | Not yet adversarially reviewed, or you want the adversarial pass anyway. | `/plan-review <slug>` |
| `planning` | Real holes — the Spec would not survive contact with a worker. | `/plan <slug>` |

**Recommend a landing from the gap report, not from the user's confidence.** If the
document has no validation commands and no stated non-goals, "I already reviewed it" does
not fix that — an implementer will still guess, and Stage 4 will still have nothing
concrete to verify against. Say that plainly and recommend `ready-for-review` or
`planning` anyway. The user can overrule; the point is that they do it knowingly.

Record the landing in the Decision Log with source `adopted` and the user's reasoning as
the rationale. This matters most for `approved`: Stage 4's verifier reads a plan whose
Review Rounds section is empty, and without that entry it cannot tell "vetted elsewhere"
from "gate skipped."

## The bar

If the Spec would not let a fresh agent implement without coming back to ask questions, it
does not land at `approved`, whatever the user's confidence. Adopting a thin document into
`approved` produces exactly the failure this workflow exists to prevent: workers guessing
at intent and reporting success.
