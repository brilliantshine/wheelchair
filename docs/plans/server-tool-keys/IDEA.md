---
slug: server-tool-keys
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-27
---

# Keys for server tools

## What we're building

Server tools (tools that run as a long-lived program the agent talks to) can list keys in
their tool.json, just as folder script tools can today. When wheelchair starts such a tool
it hands the program the keys it listed, and it hides the key values in everything the
program sends back, so the agent never sees a key.

## Why — the problem

Today a server tool that lists keys is not connected at all and says "keys for server
tools aren't supported yet". So any tool that needs a login or API key and works best as a
server (keeps a connection open, answers many calls) can't be used.

## What good looks like

- A server tool that lists keys connects and works, using the project's or the shared keys
  the same way a folder tool does.
- If the program echoes a key back in a reply or its error output, the agent sees it hidden,
  never the value.
- Replies still arrive promptly and still match the requests they answer; ids and numbers
  in replies are unchanged.
- The "not supported yet" message is gone.

## Not doing

- Changing how keys are stored or edited (the project keys and Settings shared keys stay
  as they are).
- Keys for any other kind of tool.

## Constraints

- Keys never reach the agent, as in the folder-tool keys thread.
- Usable key values are the same as for folder tools: 8 to 4096 characters of letters,
  digits and . _ ~ + / = -.
