---
slug: openrouter-solid
status: draft   # draft | confirmed
mode: proof-of-concept   # thorough | two-part | proof-of-concept
created: 2026-11-20
---

# Make OpenRouter agents solid

## What we're building

The leftovers from adding OpenRouter agents (run through the Pi coding agent): side
conversations on OpenRouter-led threads, thinking levels for OpenRouter agents, a Pi
version check, and a readable spend line on the usage view. Plus one fix for every
provider: an agent's report is not lost when reading its log briefly fails.

## Why — the problem

- On a thread whose lead runs on OpenRouter, side conversations are switched off.
- OpenRouter agents always think at the model's default; the thinking level setting that
  other providers have does nothing for them.
- When a Pi update changes its screens or log format, agents fail without a clear reason.
- OpenRouter's spend line on the usage view is squeezed into a narrow column, a word or
  two per line.
- If reading an agent's log fails for a moment when its turn ends, its report is treated
  as empty and never recovered, for any provider.

## What good looks like

- On an OpenRouter-led thread you can start a side conversation on a lead reply and get
  answers, like on Claude or GPT threads.
- Picking a thinking level for OpenRouter in Settings changes how the agents run.
- With a Pi version wheelchair does not support, Settings says so in plain words and
  OpenRouter agents do not start, instead of failing silently.
- The usage view shows OpenRouter spend on one line across the row.
- A reviewer's or verifier's report still arrives after a brief failure reading its log.

## Not doing

- OpenRouter spend per thread or per agent on the Agents screen (removed by the user).
- Limits for OpenRouter: it is pay as you go, with no 5-hour or weekly limits.
- Supporting every Pi version: one known-good range, with a clear message outside it.

## Constraints

- Live test runs use the user's OpenRouter key (a $10 credit limit): use
  deepseek/deepseek-v4.1-flash-1017 and keep live turns short.
- `./install.sh` runs only from the canonical clone, never from this worktree.
