# wheelchair

Agents are good at writing code and bad at being held to a plan. This is the harness that holds
them to one: map how the code works, agree what good looks like, plan against it one question at a
time, have a **different model family** try to tear the plan apart, build it with cheap worker
lanes, then have the other family try to prove the result wrong.

The documents are the state. Not a context window, not a conversation — a directory per feature
holding the map, the north star, the decision log, the spec, every review round, and what actually
got built. A stage refuses to run out of order, so you can close the laptop mid-plan and pick it up
a week later.

It runs the same from Claude Code and from the Codex CLI, through wrappers that are pointers and
nothing else.

## Answering with a picture

Prose is a bad medium for a shape. Ask how something works, or let a plan propose a flow, and an
agent draws it and opens it:

![The viewer: a flow with approved, unruled and struck entries](docs/viewer.png)

You drag the boxes until it reads, then **approve or strike in bulk** — select a region, one
gesture. Green is approved, dashed red struck, grey not yet ruled on. The next agent turn reads
your verdicts before it asks its next question, and at the end of planning the spec has to account
in prose for everything you struck.

The rules that make that safe to share with an agent: it can restructure a graph freely, but it can
never alter something you struck, never reuse its id, and never mark its own work approved. It
*can* supersede something you approved when the design moves — but only by resetting it to unruled
and saying so, and the reset is recorded in the file, so a resumed session can tell "you reset
this" from "nobody has looked at this yet."

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
skills/          Claude Code wrappers  → rendered into ~/.claude/skills/
codex/prompts/   Codex CLI wrappers    → rendered into ~/.codex/prompts/
docs/plans/      one directory per feature; the only mutable state
viewer/          index.html and server.js — the browser viewer a graph opens in
install.sh       renders the wrappers and installs viewer/'s dependencies (idempotent)
AGENTS.md        this repo's own routers, one per directory that owns a rule —
                 also protocol/, skills/ and spine/
```

## Install

```bash
./install.sh
```

A wrapper has to name an absolute path, because a command runs with your target repo as its
working directory and a relative path would resolve nowhere. The repo therefore cannot hold
one: wrappers carry a `{{WHEELCHAIR_ROOT}}` placeholder and `install.sh` substitutes wherever
you cloned it. Edits to `protocol/` still take effect immediately in both harnesses, because
the rendered wrapper points back into your working tree; editing a wrapper itself needs a
re-run. Restart running sessions to pick up new skill/prompt registrations. The same
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

## The viewer

The graph viewer is a single HTML file and a Node server with no runtime dependencies. Start it and
show a graph:

```bash
node viewer/server.js --show path/to/graph.json    # open it in a browser
node viewer/server.js --open path/to/graph.json    # start/register only, no browser
node viewer/server.js --stop                       # shut it down
```

`--show` is separate from `--open` on purpose: `--open` runs *before* a graph is written, so
opening a browser there would show an empty page. `--show` runs after. It opens nothing when a tab
is already on that graph, so an agent redrawing every turn will not stack up windows — the open tab
picks the new version up on its own poll. `--no-browser`, or `WHEELCHAIR_NO_BROWSER=1`, suppresses
the launch on a headless box.

It binds `127.0.0.1` only, and every route needs a token minted at start. `protocol/graphs.md` is
the format and the full producer sequence.

## Dependencies

- `codex` CLI (v0.146+) for GPT lanes — headless via `codex exec`, models `gpt-5.6-luna`,
  `gpt-5.6-terra`, and `gpt-5.6-sol`. See `protocol/lanes.md`.
- `claude` CLI for Claude lanes when driving from Codex.
- Node and npm — `viewer/`'s runtime (developed against Node 26); `install.sh` runs
  `npm --prefix viewer install`.
- Playwright, pinned in `viewer/package.json` and installed by `install.sh`'s
  `playwright install chromium` step — the viewer's one dev dependency, and the only way
  to run its browser test.

Delegation deliberately goes through `codex exec` and the Claude CLI rather than any other
subagent runtime, so both harnesses drive the same binaries and every lane is inspectable from a
plain shell. `protocol/lanes.md` states that as an explicit override, because an agent reading
other guidance will otherwise drift back.
