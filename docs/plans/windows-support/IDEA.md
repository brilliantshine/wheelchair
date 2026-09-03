---
slug: windows-support
status: confirmed   # draft | confirmed
created: 2026-08-31
---

# Wheelchair runs on Windows, from Claude Code

## What we're building

Wheelchair is a workflow that holds coding agents to a plan: it installs a set of commands into
the Claude and Codex command-line tools, and those commands tell an agent to read a rule document
and follow it. Today it only works on Linux. This makes the existing code work on Windows.

It is deliberately the first of two. This plan repairs what is already there — how files are
written, what paths they carry, whether a browser opens, whether the suites can run. It does not
change how an agent is instructed to do anything. The instructions themselves reach for a shell in four rule
documents — two spell out pipelines and two invoke a script — and rewriting those is a separate, larger change that alters how
every agent turn works on every platform, so it gets its own plan rather than riding along here.

## Why — the problem

Both command-line tools now run on Windows without a Linux environment underneath. Someone
who installs one of them and clones wheelchair gets nothing that works.

It fails at the first step and keeps failing after that. The installer will not start,
because Windows silently changes the line endings of every script file during the clone and
that makes them unrunnable. If you fix that by hand, the installer writes a shape of file path that
one of the two tools cannot follow — Claude reads it either way, Codex does not — so from Codex the
agent is pointed at a location it cannot open. If you fix that too, the picture viewer starts but never
opens a browser, and reports success while doing nothing. And underneath all of that, the
instructions an agent follows on an ordinary turn are written as Unix shell, which is not
what either tool hands an agent on Windows.

The people this affects are anyone on Windows, and the fact that they get a clean-looking
install followed by unexplained failures is worse than getting told up front that it does
not work there.

## What good looks like

On a Windows machine with Git for Windows installed, and Claude Code able to reach it:

- Cloning the repository and running the installer succeeds, and says which tools it found.
- Every wheelchair command works from Claude Code: the workflow starts, the agent reads the rule
  documents it is pointed at, a question that earns a picture draws one and opens it in a browser
  — or says plainly that it could not.
- The test suites run, pass, and say plainly which checks were skipped because Windows cannot
  represent what they test.
- One carve-out, granted here rather than by the Spec: on Windows, on a clone under a directory
  whose name carries a non-ASCII character, the setting that governs unprompted drawing is not
  installed at all, so nothing is drawn unless asked for. Whether anything else survives such a
  clone is unknown, and the acceptance run establishes it.
- If Claude Code cannot reach Git Bash, the installer says so and names the setting that fixes
  it, rather than letting the failure surface an hour later somewhere unrelated. That precondition
  is load-bearing, though not as costly as Codex's gap: without Git Bash, Claude Code runs commands
  through PowerShell and loses at least four — `/graph`, `/plan`, `/spine` and
  `/diagram-sensitivity`. Review, implement and verify should still reach a Claude lane, which
  needs no shell, but the protocol has no stated behaviour for a family that is installed while
  its invocation needs a shell it cannot get, so what those three actually do is recorded by the
  acceptance run rather than asserted here.

**Codex on Windows is not delivered here, and the honest number is seven of eight.** The install
lands and the prompts register, and `/adopt` works. Every other command reaches for a shell
somewhere — `/plan` must write a graph through a bash recipe on any shape-bearing turn, `/graph`
is that recipe, `/plan-review`, `/implement` and `/verify` all dispatch lanes through another, and
`/spine` and `/diagram-sensitivity` run shell scripts directly. Replacing those recipes is
`docs/plans/shell-free-recipes/`, and until it lands Codex on Windows is installable rather than
usable. This is a smaller promise kept fully, not the whole promise kept partly — nothing here is
half-built or bridged with scaffolding.

Every one of those is checked by running it on a real Windows machine, not inferred from the code.
Where a check has to be done by hand rather than by a test, the plan says which hand-check it is
and what its result was.

On Linux, no user loses anything. Every command keeps its name and its output, and nothing a
person relies on stops working. Four things change and are named here rather than carved out by
the Spec, and all four are repairs. A browser launch that fails now says so instead of reporting
success. A clone path containing `&` stops silently corrupting every installed command, and one
containing a backslash or a `|` stops breaking the install — the `|` case aborts it outright
today rather than corrupting quietly. The installer starts honouring `CLAUDE_CONFIG_DIR`, which it
ignores. And it warns when `CODEX_HOME` is set and ignored, which adds a line of output on any
install where that is true — including this repo's own GPT lanes, which set it. Nothing is
removed.

## Not doing

- **Not supporting Windows through a Linux environment.** Running everything inside WSL
  already works and needs no code. This is about the native Windows tools.
- **Not writing a second copy of anything for Windows.** No PowerShell version of a script
  that already exists as a shell script, no Windows branch of a rule document. A rule that
  exists twice is a rule that will disagree with itself.
- **Not removing the shell requirement for installing.** Setting wheelchair up on Windows
  will still ask for Git for Windows, which supplies a Unix-like shell. That is a one-time
  install of a thing most developers on Windows already have.
- **Not changing what any stage does.** Planning, review, implementation and verification
  keep their current rules, gates, and documents.
- **Not rewriting the recipes inside the rule documents.** `protocol/graphs.md` and
  `protocol/lanes.md` spell out shell pipelines an agent retypes every turn. Replacing them with
  single commands changes how every agent turn works on both harnesses and on every platform,
  which is a bigger and more interesting change than this one and is scoped as its own plan at
  `docs/plans/shell-free-recipes/`. Deferring it is what costs Codex the seven commands named above.
- **Not making macOS work.** Wheelchair has never run there, and this plan does not change
  that. The scripts use several things macOS does not ship — a way of resolving paths, a
  way of reading a file's size, an edit-in-place flag, a checksum command, and two shell
  features that need a newer shell than macOS includes by default. Windows sidesteps every
  one of those, because the shell it will use is the same one Linux uses. So the two ports
  share almost no work, and doing them together would double what a reviewer has to hold
  for one shared line. It should be its own plan, and it needs a Mac in the loop the same
  way this one needs a Windows PC.
- **Not promising the two platforms are equally protected.** Windows offers weaker
  isolation for both tools than Linux does, and some file-permission guards stop applying
  there. Where that is true it gets written down, not fixed.

## Constraints

- **Exactly one of the two tools may be present.** Everything must work with only Claude
  installed, only Codex installed, or both — the same rule that already governs the
  installer today.
- **The graph viewer's dependency stays Node.** It is already required, and adding a second
  runtime to make Windows work would be a worse trade than any problem it solved.
- **A rule document is the only place a rule lives.** Wheelchair's own layout rule says a
  command wrapper carries a pointer and nothing else, and that two harnesses must never be
  given different instructions. Any fix that makes Windows work by duplicating guidance
  breaks the thing being ported.
- **The Windows checks run on the Windows machine, not from here.** There is a Windows PC
  with both tools installed, and agents on it — so a check can be a written brief that an
  agent there works through and reports back on, rather than a command someone types by
  hand. What it cannot be is a step that assumes this side can reach that machine.
- **No Linux user loses anything.** Every command keeps its name and its output, nothing a
  person relies on stops working, and no behaviour gets worse. The four things that do change on
  Linux are named in "What good looks like" rather than carved out by the Spec, and all four are
  repairs to behaviour that is wrong today.

  Earlier wordings of this were defective and are recorded rather than overwritten: one was so
  literal the Spec granted itself an exception in its own text, and one was loosened to permit a
  change since abandoned. Review found the promise stated in two places and only one of them
  maintained; there is now one statement, and this is a pointer to it.
