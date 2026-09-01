---
slug: windows-support
status: confirmed   # draft | confirmed
created: 2026-08-31
---

# Wheelchair runs on Windows, from either CLI

## What we're building

Wheelchair is a workflow that holds coding agents to a plan: it installs a set of commands
into the Claude and Codex command-line tools, and those commands tell an agent to read a
rule document and follow it. Today it only works on Linux and macOS. This makes it work on
Windows too, from either tool, without asking anyone to install a Linux environment first.

The change is mostly about removing assumptions rather than adding features. Nothing about
how planning, review, implementation or verification work changes. What changes is that the
places where wheelchair reaches out to the operating system — writing files during install,
starting the graph viewer, handing work to a second agent — stop assuming they are standing
in a Unix shell.

## Why — the problem

Both command-line tools now run on Windows without a Linux environment underneath. Someone
who installs one of them and clones wheelchair gets nothing that works.

It fails at the first step and keeps failing after that. The installer will not start,
because Windows silently changes the line endings of every script file during the clone and
that makes them unrunnable. If you fix that by hand, the installer writes the wrong shape of
file path into every command it installs, so the agent is pointed at a location its own
file-reading tools cannot open. If you fix that too, the picture viewer starts but never
opens a browser, and reports success while doing nothing. And underneath all of that, the
instructions an agent follows on an ordinary turn are written as Unix shell, which is not
what either tool hands an agent on Windows.

The people this affects are anyone on Windows, and the fact that they get a clean-looking
install followed by unexplained failures is worse than getting told up front that it does
not work there.

## What good looks like

On a Windows machine with at least one of the two command-line tools installed:

- Cloning the repository and running the installer succeeds, and says which tools it found.
- Typing `/plan`, `/graph`, or any other wheelchair command in either tool starts the
  workflow, and the agent can read the rule documents it is pointed at.
- Asking a question that earns a picture draws one and opens it in a browser — or, when it
  genuinely cannot, says so instead of claiming it worked.
- Handing work to a second agent works, and the person can see the command that did it.
- The test suites run, pass, and say plainly which checks were skipped because Windows
  cannot represent what they test.

Every one of those is checked by running it on a real Windows machine with both tools
installed, not inferred from the code. Where a check has to be done by hand rather than by
a test, the plan says which hand-check it is and what its result was.

And on Linux, everything still behaves exactly as it does today. The same installer, the
same commands, the same documents. If a Windows user and a Linux user compare notes, they
are using one tool, not two.

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
- **Nothing about how Linux and macOS behave today may change.** Not the commands, not the
  documents, not the file formats. Windows support is added underneath the existing
  behavior, never by moving it.
