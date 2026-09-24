---
slug: shell-free-recipes
status: draft   # draft | confirmed
created: 2026-09-01
---

# The instructions an agent follows stop being shell

## What we're building

Two of wheelchair's rule documents don't describe what to do — they spell out commands, in Unix
shell, that an agent retypes on every turn. Drawing a picture means backgrounding a process and
polling a log file until a URL appears, then calling out to a separate HTTP tool. Handing work to
a second agent means three temporary files, a command assembled in a shell array, and finding a
session identifier by searching a log.

This replaces that wrapping with programs the documents call in one line each. The tools
underneath are already single commands; all of the shell is scaffolding around them.

## Why — the problem

Two reasons, and only one of them is about Windows.

Codex hands its agent PowerShell, which none of this scaffolding survives, so Codex on Windows can
run exactly one of the eight commands. `docs/plans/windows-support/` deliberately shipped without
this work: a Windows user there installs wheelchair, registers the prompts, runs `/adopt`, and
stops. The other seven all reach a shell recipe somewhere — including `/plan`, which must write a
graph through one on any shape-bearing turn.

The other reason applies everywhere, including the machine this was written on. The polling loop
exists because one command sometimes blocks forever and sometimes returns instantly with nothing
saying which; the log search exists because the only handle for resuming a lane is buried in an
event stream. Both are worked around in prose that every agent has to re-execute correctly, every
turn, and `protocol/graphs.md` spends roughly twenty lines explaining how to survive them.

## What good looks like

To be written with the user. The shape it should take: every recipe in those two documents is one
command with no shell syntax; nothing an agent can do today becomes impossible; a lane is still
resumable and still inspectable — a person can see the exact command that ran; and both harnesses
get the identical instructions they get now.

## Not doing

To be written with the user.

## Constraints

To be written with the user. Two are known already:

- **A rule lives in exactly one place.** Whatever replaces the recipes must not give the two
  harnesses different instructions, and must not leave a second copy of a lane command outside
  `protocol/lanes.md`.
- **Nothing a person relies on may stop working.** This changes Linux behaviour as much as Windows,
  because the documents are shared. macOS has never run this at all.
