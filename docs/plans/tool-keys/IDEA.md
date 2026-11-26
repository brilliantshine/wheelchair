---
slug: tool-keys
status: confirmed  # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-25
---

# Keys for folder tools

## What we're building

Folder tools (a small described tool in a project's `.wheelchair/tools/`, or in the shared
tools repo) can say which API keys they need. When an agent uses the tool, the tool gets
those keys: a project tool gets the project's keys, a shared tool gets a new set of shared
keys kept on this machine and edited in Settings. The agent that uses the tool never sees
the keys.

## Why — the problem

Folder tools shipped without keys, so any tool that calls a paid or private service
(search, email, a company API) cannot be built as a folder tool. Today the only way to give
something a key is the project's keys, which go into the agent's own environment, where the
agent can read them.

## What good looks like

- A tool that names a key it needs works for agents once that key is set, without the
  agent ever being able to print or read the key.
- A tool whose key is missing shows "needs key X, not set on this machine" on the Tools
  page and does not run.
- Collin can add, change and remove shared keys in a Shared keys section of Settings.
- A key's value never shows up in tool output an agent receives.

## Not doing

- Keys for server tools (folder tools that run as an MCP server). They moved to their own
  thread, "Keys for server tools"; here only script tools get keys.

- Stopping an agent that deliberately goes looking for the key files on disk. Agents run
  under the same user account as wheelchair, so file permissions cannot hide the files from
  them. "Never sees" means the key is never handed to the agent: not in its environment,
  its tool settings, or any output it gets back.
- Syncing shared keys between machines. Each machine keeps its own set.
- Outside secret stores (password managers, cloud vaults), key expiry or rotation.

## Constraints

- Only the tool sees its keys, never the agent (Collin's decision in the easy-tools plan).
- Builds on the merged easy-tools work (PR #196); its folder layout and commands stay as
  they are.
