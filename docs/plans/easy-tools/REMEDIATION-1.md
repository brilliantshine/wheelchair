# Remediation 1 — easy-tools

Verification attempt 1 (verifier `wc-7fac691ef321-verifier`, claude-opus-5-5) checked commit
`1a5669bd4345cd0d49c2660bb7475e7b8c1ec6ce`: FAIL. The lead answered: fix both, defer nothing.

## Gaps (verbatim)

GAP: Check once built #1 — Antigravity's MCP call deadline was not shown to be at least 260 s, and the guide does not state a lower limit, so neither condition in the row holds. — `protocol/tools.md:77` only says "Claude's and Antigravity's MCP call deadlines are unchecked … a long script may therefore time out earlier". The installed `agy` 1.5.17 binary has a per-server `timeoutSeconds` field in `mcp_config.json`: its changelog string reads "Fixed the `/mcp` panel dropping `enabledTools`, `timeoutSeconds`, …", and it has the symbol `mcpcore.(*McpClientSessionInstance).callToolTimeout`. I could not pull its default value out of the Go binary. The bridge entry built in `connectors/agy/machine.js:37-38` sets no `timeoutSeconds`, unlike Codex's `tool_timeout_sec=260` at `connectors/codex/machine.js:176`. Claude is fine: in `claude` 2.1.332 the per-call default is `Sh=1e8` ms and the stdio idle default is `Dh=1800000` ms (`yu()`/`Ti()` in the binary), both well over 260 s. So only the guide's "unchecked" wording for Claude is out of date there; that part is not a gap.

GAP: Mockups (mockup-tools-mixed-phone 390x844, mockup-tools-mixed-desktop 1280x900) — the text for a hidden shared tool is different. The mockup says "hidden: this project has its own tool with the same name"; the built page says "hidden by the project tool of the same name". — `machine/lib/project-tools.js:138` and `machine/lib/folder-tools.js:64`. Compared `.../scratchpad/shots/mockup-tools-mixed-phone.png` against `.../scratchpad/shots/tools-mixed-phone.png`, and `mockup-tools-mixed-desktop.png` against `tools-mixed-desktop.png`. The meaning is the same, so this is a minor wording fix.

## Task R1a: Antigravity bridge deadline and the guide

- `connectors/agy/machine.js` `command`: when the translated server is the folder bridge (the extra entry
  with `folder: 'bridge'`, name `wheelchair-tools`), add `timeoutSeconds: 260` to its entry in the plugin's
  `mcp_config.json` (`mcpServers['wheelchair-tools']`). No other entry changes.
- `machine/test/project-mcp-agy.test.js:70` ("folder entries alone create the plugin and are loaded"):
  the expected bridge entry gains `timeoutSeconds: 260`; add a server-tool extra (`folder: 'server'`) and
  assert it has no `timeoutSeconds`. Break the change once, watch it fail, restore.
- `protocol/tools.md:77`: replace the Claude/Antigravity sentences with: Claude Code 2.1.332 defaults to
  100,000,000 ms per MCP call (it reads `MCP_TOOL_TIMEOUT`, in milliseconds), well above 260 s; wheelchair
  sets the Antigravity bridge's `timeoutSeconds` to 260; Antigravity's default for server tools was not
  established. Keep the Codex sentences.

## Task R1b: hidden-tool wording from the mockup

- `machine/lib/folder-tools.js:64` and `machine/lib/project-tools.js:138`: reason text becomes exactly
  `hidden: this project has its own tool with the same name` (the problems-card line built from it keeps
  whatever tool-name prefix it has today).
- Update every test asserting the old text: `viewer/test/app-project-tools.spec.js:1510`, `:1520`,
  `:1535`, and any in `machine/test/` (search for `hidden by the project tool`).

Validation for both:
```
node --test machine/test/project-mcp-agy.test.js machine/test/folder-tools.test.js machine/test/folder-tools-launch.test.js machine/test/project-tools.test.js
npm --prefix viewer run test:browser -- app-project-tools.spec.js
grep -rn "hidden by the project tool" machine viewer protocol   # no output
```
