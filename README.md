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
  graphs.md            the graph format read by both harnesses: schema, verdicts,
                       preservation, how the viewer starts
  routers.md           the router document format: what a directory owns, what must never
                       happen there, where to go next — guidance for creation, not a test
  spine.md             /spine: propose routers for a repo that has none, list every write
                       first, and write nothing until a person confirms
  planning.md          Stage 1: map the code, set the north star, one question at a time
  plan-review.md       Stage 2: parallel GPT + Claude adversarial plan review
  implementation.md    Stage 3: lead + cheap worker lanes (Luna/Terra/Sonnet; Sol on escalation)
  verification.md      Stage 4: blind cross-family verify + remediation loop
  templates/           MAP.md, IDEA.md, PLAN.md, COMPLETION.md skeletons
spine/           scan.sh: resolves routing documents through symlinks, read-only, JSON out
  test/run.sh          fixture assertions; builds its tree under the system temp directory
skills/          Claude Code wrappers  → symlinked into ~/.claude/skills/
codex/prompts/   Codex CLI wrappers    → symlinked into ~/.codex/prompts/
docs/plans/      one directory per feature; the only mutable state
viewer/          index.html and server.js — the browser viewer a graph opens in
install.sh       creates the symlinks and installs viewer/'s dependencies (idempotent)
AGENTS.md        this repo's own routers, one per directory that owns a rule —
                 also protocol/, skills/ and spine/
```

## Install

```bash
./install.sh
```

Wrappers are symlinks, so edits to `protocol/` take effect immediately in both
harnesses. Restart running sessions to pick up new skill/prompt registrations. The same
run also installs `viewer/`'s npm dependencies and its pinned Chromium via Playwright.
`spine/scan.sh`, `spine/test/run.sh`, and `install.sh` itself are shell, not markdown —
`viewer/` is the one piece with its own package dependencies and a long-running server.

## Usage

From either harness, in the target project:

```
/plan <slug or description>   # build/resume the plan, one question at a time
/plan-review <slug>           # cross-model review rounds until approved
/implement <slug>             # lead + workers; ends with COMPLETION.md
/verify <slug>                # blind cross-family verify; remediate until PASS
/graph <question>             # answer a question with a picture instead of just prose
```

**Already have a plan document?** Fast-forward it in:

```
/adopt path/to/plan.md        # normalize, report gaps, choose where it lands
```

It copies the document into `docs/plans/<slug>/` (the original is never moved or
modified), synthesizes an `IDEA.md` for you to confirm, checks the tree for parts of the
plan that are **already built**, and reports what the protocol needs that the document
lacks — usually validation commands, non-goals, and edge cases.
Then it asks one question: land at `approved` (straight to `/implement`),
`ready-for-review` (run the cross-model gate), or `planning` (real holes to talk through).
The recommendation comes from the gap report rather than from your confidence, and the
landing is recorded in the Decision Log — Stage 4 otherwise can't tell "vetted elsewhere"
from "gate skipped."

The stage commands take slugs only. `/graph` takes a question, and `/adopt` and `/spine`
take a path — none of the three is a stage: `/graph` answers on the spot without touching
`status:`, `/adopt` is the on-ramp into the state machine, so there's one place to look
when asking how a plan arrived, and `/spine` sits outside it entirely.

**Repo has no router documents?** Back-fill them:

```
/spine path/to/working/tree     # propose a router per directory that owns a rule
```

`/spine` takes a path to a working tree, not a slug, and is outside the plan state machine —
it writes documentation, so there is no plan and no review gate. It lists every file it would
create or extend, and what changes in each, then writes nothing until you confirm. It refuses
a target outside a git repository and names the repositories and worktree hubs it found
instead, so the next command is obvious. Existing routing documents are extended and
corrected, never reformatted. `protocol/routers.md` is the format;
`protocol/spine.md` is the run sequence.

Artifacts live in the target repo at `docs/plans/<slug>/`:

- **MAP.md** — how the existing code works today. End-to-end flow, a plain-text diagram,
  every claim carrying `file:line`, and an explicit list of what wasn't checked. Written
  before the idea, so decisions get made against what's actually there.
- **IDEA.md** — plain-language north star: what this is for, what good looks like, what
  it is explicitly not doing. Written and confirmed before any design question, then held
  stable while the plan churns. Every later stage reads it to check for drift.
- **PLAN.md** — the mutating work: question queue, watch list, decision log, spec,
  accepted risks, review rounds, prior work, implementation tasks.
- **`graphs/`** — one JSON file per flow discussed in Stage 1, opened in the browser
  viewer; disposable, never a contract once the plan is done.
- **COMPLETION.md**, **REMEDIATION-N.md** — implementation output and verification loops.

The `status:` field in PLAN.md frontmatter is the state machine (`planning →
ready-for-review → approved → implementing → verifying → done`); each stage refuses to
run out of order.

## Dependencies

- `codex` CLI (v0.146+) for GPT lanes — headless via `codex exec`, models `gpt-5.6-luna`,
  `gpt-5.6-terra`, and `gpt-5.6-sol`. See `protocol/lanes.md`.
- `claude` CLI for Claude lanes when driving from Codex.
- Node (26.7.0 here) and npm — `viewer/`'s runtime; `install.sh` runs
  `npm --prefix viewer install`.
- Playwright, pinned in `viewer/package.json` and installed by `install.sh`'s
  `playwright install chromium` step — the viewer's one dev dependency, and the only way
  to run its browser test.

This workflow deliberately does **not** use the `async-subagents`/pi runtime, even
though global guidance prefers it for general delegation — both harnesses drive the same
`codex exec` binary here so lanes stay inspectable from plain shell. `lanes.md` states
the override so agents don't drift back.
