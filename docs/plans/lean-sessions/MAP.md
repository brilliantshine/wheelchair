# Lean sessions: current flow

```text
start -> provider CLI + role pointer -> role and cards reads -> work
  -> result summary queued to starter -> starter checks report and stops session
```

The detailed reusable map is `docs/maps/session-token-flow.md`, checked against `4251f4607c4565c6164227015baa8dbf7c22cee4`. It records the three complete launch argument patterns, settings, role composition, role/card usage, CLI output, scout bands and result handoff with source lines.

- Ordinary launches do not explicitly suppress MCP, skills or instruction files; actual loaded contents depend on provider configuration. Claude receives the role pointer and layers as an appended system prompt; Codex and Gemini receive them as a first message (`machine/adapters/claude.js:56-64`; `machine/adapters/codex.js:50-51`; `machine/adapters/agy.js:30-34`). Reviewer and verifier do not have a `cards.md` read instruction even though the router claims every role reads it (`protocol/app/AGENTS.md:16-17`; `protocol/app/reviewer.md:3-10`; `protocol/app/verifier.md:3-17`).
- `cards.md` is 24,421 bytes; `session list` returns all public session fields, including command, queue and steps, with no output-size cap in the CLI. One live two-session list measured 10,694 bytes. `session stop` returns 12 bytes on success, while start returns a public session and possibly a waiting line or note; `card.js` is silent on success (`viewer/app/sessions.js:144-146,587-591,627,657-672`; `viewer/app/wc.js:134-139`; `viewer/app/card.js:261-265`).
- The sub-lead uses the scout under 200 changed lines, the bigger scout for 200–800, and reads over 800 or `tricky` itself, with fallback when scouts are unavailable (`protocol/app/sub-lead.md:142-157`). A posted result delivers only its summary to the starter, while reviewer/verifier final text is delivered in full; the lead stops a mapper and reads MAP.md on receipt (`viewer/app/cards.js:130-136`; `viewer/app/sessions.js:370-393`; `protocol/app/lead.md:153-158`).

Not checked: CLI internals, actual configured startup payloads or token counts; live start/stop output; full aside and probe behavior.
