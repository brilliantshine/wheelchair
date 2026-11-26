---
slug: escaped-keys
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-26
---

# Hide keys printed in escaped form

## What we're building

Folder script tools can be given keys (passwords and tokens). When a script prints a key
exactly as stored, the agent sees `[key]` instead. This adds the same protection when a
script prints a key in a disguised, escaped form: written as JSON escapes, percent-encoded
in a web address, or escaped more than once.

## Why — the problem

Ordinary tools escape text without the author asking. .NET writes `+` as `+`, a web
address writes it as `%2B`, an address inside an address as `%252B`, and logging escaped
text as JSON escapes it again. A key printed any of these ways reaches the agent in full
today, so an agent (and anything it writes) could see the key.

## What good looks like

- A key printed with JSON or backslash escapes, or percent-encoded, never reaches the
  agent, up to three layers of escaping mixed in any order.
- This holds wherever the key sits in the output, including mid-word, beside other text,
  or at the point where long output is cut off.
- Output with no key in it, escaped or not, reaches the agent exactly as today.
- Tools with no keys behave exactly as today.
- The tool-author guide states what is caught and what is not.

## Not doing

- Base64, hashing, encryption, or a key split into pieces or printed with other text
  in between: not caught. The guide keeps telling authors never to print a key in any form.
- More than three layers of escaping.
- Server tools (they don't get keys yet).
- Any change to how keys are stored, chosen or given to tools.

## Constraints

- Builds on the merged "Keys for folder tools" work (docs/plans/tool-keys/PLAN.md, K4).
- Usable key values stay 8-4096 ASCII letters, digits and `. _ ~ + / = -`.
- Your limit from that thread (its Decision 20): common escapes, up to three layers.
