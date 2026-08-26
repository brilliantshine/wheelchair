# Map — how the workflow picks a lane, and how it gets installed, today

Written before any design question, so the decisions get made against what is actually in
the tree rather than against a memory of it.

## Flow 1 — what happens when a stage needs work done by somebody else

You type `/verify checkout` in Claude Code. The wrapper at
`skills/verify/SKILL.md:7` is a pointer and nothing else: it says read
`protocol/verification.md` and do what it says. The stage then reads `implemented-by` out
of the completion report's frontmatter (`protocol/verification.md:11`,
`protocol/templates/COMPLETION.md:4`) and looks up the family that did **not** build the
work: GPT built it, a Claude agent checks it; Claude built it, a `codex exec` lane checks
it (`protocol/verification.md:14-18`).

Before it launches anything it is told to go read `protocol/lanes.md`. That file is where
every stage learns how to actually invoke a lane, and it is the only place the invocations
live — the three stages that spawn work all defer to it rather than repeating the command.

```
you type a command
   → wrapper (one line, points at a protocol file)
   → the stage doc
   → lanes.md  ← the single place that knows how to launch anything
        ├→ codex exec ...   (GPT)
        └→ Agent tool / claude -p   (Claude)
```

Two other stages take the same route. Plan review launches two reviewers at once, one per
family, and reads each GPT verdict out of a file rather than off stdout
(`protocol/plan-review.md:30-36`, `:76`). Implementation names three lanes — a GPT
workhorse, a cheaper GPT transcription lane, and a Claude workhorse that owns all interface
and taste-sensitive work (`protocol/implementation.md:57-64`).

## Flow 2 — what `./install.sh` does

It makes both harness directories whether or not you use both (`install.sh:20`), renders
each Claude skill into `~/.claude/skills/` (`install.sh:26-33`), renders each Codex prompt
into `~/.codex/prompts/` (`install.sh:35-39`), installs the viewer's npm dependencies and a
pinned Chromium (`install.sh:42`, `:45`), and last calls `sensitivity/set.sh`
(`install.sh:48`), which writes the diagram-sensitivity block into `~/.claude/CLAUDE.md`
**and** `~/.codex/AGENTS.md` — both or neither, by design, with a restore if the second
write fails. Those two paths come from `sensitivity/set.sh:10-13`, and each already honours
an env override (`WHEELCHAIR_CLAUDE_HOME`, `WHEELCHAIR_CODEX_HOME`) that exists so the test
suite can point them at fixtures.

```
./install.sh
   → mkdir both harness homes (unconditional)
   → render skills/*     → ~/.claude/skills/
   → render codex/prompts/* → ~/.codex/prompts/
   → npm install + chromium
   → sensitivity/set.sh  → ~/.claude/CLAUDE.md AND ~/.codex/AGENTS.md (both or neither)
```

## The three things that matter for this change

**Every GPT lane points at a credential store that exists on one machine.**
`protocol/lanes.md:20` sets `SLOT=~/.bravo/codex-auth-balancer/accounts/1` and
`:22` runs `CODEX_HOME="$SLOT" codex exec`. The Credentials section
(`protocol/lanes.md:133-159`) is an account of that one setup — one ChatGPT account, a
single-use refresh token, a balancer holding a lock around it. On a machine without the
balancer, `CODEX_HOME` names a directory that does not exist. This breaks somebody who has
**both** accounts, not just somebody with one, so it is not really part of the
single-account question at all — it is the thing that stops the repo working anywhere else.

It also drags a second rule with it: because the balancer's slot has no `config.toml`, every
lane must pass `-c model_reasoning_effort=high` explicitly or silently fall back to the
model's default (`protocol/lanes.md:49-56`). Off the balancer, `~/.codex/config.toml` is read
normally — so the reason that flag is mandatory disappears exactly when the balancer does.
`protocol/implementation.md:66-69` still asserts the opposite ("needs no flag at dispatch"),
which already contradicts lanes.md today.

**Two stages have no defined behaviour when only one family exists.** Plan review launches
one lane per family. Verification looks up the opposite family and would find nothing.
Neither says what to do instead.

**The user-facing text promises the cross-family property in six places.** The README leads
with "a **different model family**" (`README.md:5-6`), lists the stages that way
(`:68`, `:116`, `:118`, `:140`), and names the `codex` CLI and `claude` CLI as dependencies
without saying either is optional (`README.md:205-207`). Three skill descriptions say it too
— `/plan-review` promises "parallel GPT + Claude reviewers", `/verify` promises "a verifier
from the opposite model family", `/implement` names Terra, Luna and Sonnet by name. Those
descriptions are how a harness decides whether to fire a skill at all, so they are not
inert prose.

## What I did not check

- Whether `codex exec` actually works with an unset `CODEX_HOME` on a fresh login — I read
  the protocol's claims about it and did not run a lane against a non-balancer home.
- Whether Claude Code registers a skill whose `description` has gone stale relative to its
  body — I am assuming the description is only used for selection.
- `protocol/spine.md`, `protocol/adopt.md`, `protocol/graphs.md`, `protocol/map.md` and
  `protocol/planning.md` for lane references: I grepped them for `codex`, `claude`, `GPT`,
  `sonnet` and `lane` and found none, but I did not read them end to end.
- `viewer/`, `spine/scan.sh`, and the two shell test suites — nothing in them touches lane
  selection, and I did not read them for this.
