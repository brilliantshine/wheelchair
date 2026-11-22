---
slug: harness-install-solid
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Make agent installs solid

## What we're building

Three finishing touches to installing an agent from Settings → Harnesses: a Cancel button
for an install that is running, an automatic stop for an install stuck for 15 minutes, and
a plain one-line reason shown above the error output when an install fails for a common cause.

## Why — the problem

Today an install, once started, cannot be stopped from the app. If it hangs (a slow or
dead network, a prompt nobody can answer), the row stays "installing" forever. When it
fails, Collin sees only the raw tail of the installer's output, which for common causes
(no network, a full disk, npm not allowed to write its folder) does not say what to do.

## What good looks like

- While an install runs, its row shows Cancel. Pressing it stops the install within a few
  seconds, and the row no longer says installing; Install / Try again works again.
- An install still running after 15 minutes stops on its own and the row says it failed
  because it took too long.
- A failed install caused by no network, a full disk or a non-writable npm folder shows one
  plain sentence saying so above the raw output. Other failures show the raw output as today.

## Not doing

- Undoing a half-finished install (removing files it already wrote).
- Changing what gets installed or how (the recipes).
- Explaining every possible failure; only the common ones listed.

## Constraints

- Builds on easy onboarding (PR #155), already merged into main.
