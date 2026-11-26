---
slug: tool-keys
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-25
---

# Keys for folder tools

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md` and `docs/maps/folder-tool-keys.md`.
**Starting point:** the earlier key design in `docs/plans/easy-tools/PLAN.md` at commit
`a8211e9e` (S4, S9, S10) and that plan's Review Rounds 1-3 key findings, all of which this
plan carries forward unless a decision below changes them.

## Open Questions

### Q2: Keyed tools for sandboxed Codex agents
- **Context:** Codex usually runs sandboxed (workspace-write) and gets no folder MCP entries
  there (easy-tools Decision 25). Running a keyed tool for it through the machine service
  would run that tool outside the sandbox.
- **Options:** (a) Keyed tools are not available to sandboxed Codex (status says so).
  (b) The machine runs keyed script tools on its behalf, outside its sandbox.
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | Collin picked it | user |
| 2 | No designer: the Shared keys section and "needs key" status were already drawn and agreed in easy-tools (its Decision 19); copied here as `graphs/mockup-shared-chosen-phone.html` and `graphs/mockup-tools-mixed-phone.html` | The visible part is small and already agreed | defaulted |
| 3 | Carry forward the earlier design: `keys` list in `tool.json`; bridge and server launcher read the key store themselves at spawn; keys never in agent env, generated MCP configs or instructions; project tools use project keys, shared tools a machine-local shared key set with the same private file modes | Settled in easy-tools rounds 1-3 | defaulted |
| 4 | Script output redaction as easy-tools round 3 left it: streaming redaction with hold-back before every cut and capture limit; `[key <NAME>]` replacement | Secret leaks are always fixed | defaulted |
| 5 | Server tools' stdout (newline-delimited MCP JSON) is redacted line by line in the launcher, matching both the raw and JSON-escaped key value | Closes the server-output leak the earlier design left to authors; cheap since the launcher already pipes it | defaulted |
| 6 | `check`/`run` as in easy-tools round 3: `check` never has keys and says a keyed server's failure may be that; keyless `run` in the caller's process on Claude, Codex and Antigravity, saying it ran without keys | Never crosses a sandbox; settled earlier | defaulted |
| 7 | A tool whose key is not set does not run and shows "needs key X, not set on this machine" on the Tools page, as in the mockup | Agreed mockup | defaulted |
| 8 | `.mcp.json` project-key injection into the agent's environment (Claude, Codex) stays as it is. Folder tools never add a key to the agent; a key also used by a `.mcp.json` server stays visible to the agent through that path, and the guide says so (moving that server to a folder tool removes it) | Collin: leave it; avoids breaking working setups | user |

## Spec

(Grown as decisions land.)

### Mockups

| File | Screen / state | Size |
|------|----------------|------|
| graphs/mockup-shared-chosen-phone.html | Settings, Shared tools, project chosen, Shared keys (two keys, one missing) | 390x844 |
| graphs/mockup-tools-mixed-phone.html | Tools page, mixed statuses incl. "needs key X, not set on this machine" | 390x844 |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| An agent that reads the key store files on disk can find key values | Same OS account; IDEA.md Not doing | planning |

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
