# Personal agent workflows

A four-stage feature workflow driven by one persistent plan directory per feature.
All state lives in files, never in a context window; the same protocol runs from
Claude Code and Codex through thin per-harness wrappers.

## Layout

```
protocol/        canonical stage definitions — the single source of truth
  lanes.md             how every stage spawns a subagent (codex exec / Claude)
  adopt.md             on-ramp: fast-forward an externally-written plan in
  map.md               how to explain existing code: flow first, grounded, no filler
  writing.md           how anything user-facing is written: sized by the reader, labels
                       re-grounded, above the code, no AI tells
  diagrams.md          where a diagram goes and what keeps it true: Mermaid on rendered
                       surfaces, arrow chains in terminals, redundant with its prose
  planning.md          Stage 1: map the code, set the north star, one question at a time
  plan-review.md       Stage 2: parallel GPT + Claude adversarial plan review
  implementation.md    Stage 3: lead + cheap worker lanes (Luna/Terra/Sonnet; Sol on escalation)
  verification.md      Stage 4: blind cross-family verify + remediation loop
  templates/           MAP.md, IDEA.md, PLAN.md, COMPLETION.md skeletons
skills/          Claude Code wrappers  → symlinked into ~/.claude/skills/
codex/prompts/   Codex CLI wrappers    → symlinked into ~/.codex/prompts/
install.sh       creates the symlinks (idempotent)
```

## Install

```bash
./install.sh
```

Wrappers are symlinks, so edits to `protocol/` take effect immediately in both
harnesses. Restart running sessions to pick up new skill/prompt registrations.

## Usage

From either harness, in the target project:

```
/plan <slug or description>   # build/resume the plan, one question at a time
/plan-review <slug>           # cross-model review rounds until approved
/implement <slug>             # lead + workers; ends with COMPLETION.md
/verify <slug>                # blind cross-family verify; remediate until PASS
```

**Already have a plan document?** Fast-forward it in:

```
/adopt path/to/plan.md        # normalize, report gaps, choose where it lands
```

The four stage commands take slugs only. `/adopt` is the single on-ramp for work that
didn't start here, so there's one place to look when asking how a plan arrived.

It copies the document into `docs/plans/<slug>/` (the original is never moved or
modified), synthesizes an `IDEA.md` for you to confirm, checks the tree for parts of the
plan that are **already built**, and reports what the protocol needs that the document
lacks — usually validation commands, non-goals, and edge cases.
Then it asks one question: land at `approved` (straight to `/implement`),
`ready-for-review` (run the cross-model gate), or `planning` (real holes to talk through).
The recommendation comes from the gap report rather than from your confidence, and the
landing is recorded in the Decision Log — Stage 4 otherwise can't tell "vetted elsewhere"
from "gate skipped."

Artifacts live in the target repo at `docs/plans/<slug>/`:

- **MAP.md** — how the existing code works today. End-to-end flow, a plain-text diagram,
  every claim carrying `file:line`, and an explicit list of what wasn't checked. Written
  before the idea, so decisions get made against what's actually there.
- **IDEA.md** — plain-language north star: what this is for, what good looks like, what
  it is explicitly not doing. Written and confirmed before any design question, then held
  stable while the plan churns. Every later stage reads it to check for drift.
- **PLAN.md** — the mutating work: question queue, watch list, decision log, spec,
  accepted risks, review rounds, prior work, implementation tasks.
- **COMPLETION.md**, **REMEDIATION-N.md** — implementation output and verification loops.

The `status:` field in PLAN.md frontmatter is the state machine (`planning →
ready-for-review → approved → implementing → verifying → done`); each stage refuses to
run out of order.

## Dependencies

- `codex` CLI (v0.146+) for GPT lanes — headless via `codex exec`, models `gpt-5.6-luna`,
  `gpt-5.6-terra`, and `gpt-5.6-sol`. See `protocol/lanes.md`.
- `claude` CLI for Claude lanes when driving from Codex.

This workflow deliberately does **not** use the `async-subagents`/pi runtime, even
though global guidance prefers it for general delegation — both harnesses drive the same
`codex exec` binary here so lanes stay inspectable from plain shell. `lanes.md` states
the override so agents don't drift back.
