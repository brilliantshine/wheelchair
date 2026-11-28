# Map: server tool keys

Checked against: `0cfa47421c626c2c34d2f895c4230791cd3856d2` (origin/main). See `docs/maps/server-tool-launch.md`, `docs/maps/folder-tool-keys.md`, and `docs/maps/project-tools.md` for the detailed flow and test seams.

```text
validated folder server -> harness launches wrapper -> server process
  -> stdout MCP messages and stderr -> harness
```

Today keyed servers are invalid at discovery and on launcher revalidation; the wrapper has no store information, directly pipes stdout and inherits stderr (`machine/lib/folder-tools.js:17`, `machine/lib/folder-tools.js:79`, `machine/lib/tool-launch.js:19`, `machine/lib/tool-launch.js:26`). Script tools already bind a store and names, read values from the current store, and redact completed captures; that helper does not preserve JSON-RPC structure (`machine/lib/tool-bridge.js:10`, `machine/lib/tool-bridge.js:18`, `machine/lib/tool-run.js:35`, `machine/lib/key-redact.js:53`).

The parent plan's server-output proposals evolved from line-by-line matching to preserving unchanged bytes or withholding unsafe messages; they were deferred, not implemented (`docs/plans/tool-keys/PLAN.md:31`, `docs/plans/tool-keys/PLAN.md:36`, `docs/plans/tool-keys/PLAN.md:39`, `docs/plans/tool-keys/PLAN.md:41`). Prior findings include secret-bearing IDs, large IDs rounded by JSON parsing, and multiline keys across stderr lines; the current value rule disallows newline, but matching and request/reply behavior still require a design (`docs/plans/tool-keys/PLAN.md:42`, `docs/plans/tool-keys/PLAN.md:408`). A withheld server-originated request can leave the server waiting or misroute an error (`docs/plans/tool-keys/PLAN.md:345`).

Not looked at: live harness behavior, third-party server implementations, and sinks beyond launcher stdout and stderr.
