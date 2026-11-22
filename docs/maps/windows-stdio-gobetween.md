# Map: Windows stdio go-between

Checked against: `c797033d53bcd9e4ddbf95cf2b52debba0d74de4` (origin/main; covered files match this worktree). Files covered: `machine/lib/win-tool-proxy.js`, `machine/lib/win-tool-wrap.js`, `machine/lib/project-programs.js`, `machine/service.js`, `machine/adapters/common.js`, `machine/adapters/claude.js`, `machine/adapters/codex.js`, `machine/adapters/agy.js`, `machine/test/win-tool-proxy.test.js`, `machine/test/win-tool-wrap.test.js`, `machine/test/win-tool-service.test.js`.

```text
project MCP entries -> per-session replacements -> CLI starts proxy -> ready file
                                                     | waiting -> stand-in -> hold calls
                                                     | ready -> real tool -> list changed
```

- WSL tool-role sessions for Claude, Codex and Antigravity get replacement entries before the adapter runs; loaded entries determine the Windows and wrapped flags (`machine/service.js:837-855`). Only Windows stdio commands are wrapped, excluding `mcp-for-unity`; the proxy gets the ready path and a cache keyed by common Git directory, name, command and args (`machine/lib/win-tool-wrap.js:7-16`). Claude disables originals and writes a per-session `--mcp-config`; Codex emits replacement overrides and retains Windows environment passthrough based on the original command; Antigravity translates replacements (`machine/adapters/claude.js:63-73`; `machine/adapters/codex.js:52-57,77-85,133-145`; `machine/adapters/agy.js:31-37`).
- While waiting, the proxy answers initialize, cached or empty tools/list and ping; it holds calls with a 50-second forwarding deadline, handles cancellation, and reports a failed ready file (`machine/lib/win-tool-proxy.js:9-10,42-52,136-160`). A ready file starts the tool directly; if initialized already, the proxy initializes the tool, forwards held and queued messages and sends list_changed (`machine/lib/win-tool-proxy.js:97-106,114-140`). Its own paginated list probe caches up to 20 pages (`machine/lib/win-tool-proxy.js:74-95`).
- The proxy removes the session token from the tool environment and passes the ready file's Windows copy path (`machine/lib/win-tool-proxy.js:97-106`). stdin end/errors, stdout error/close and signals initiate shutdown; shutdown closes the direct child's stdin then escalates to TERM and KILL, with no job object or descendant wait (`machine/lib/win-tool-proxy.js:28-41,53-66`). An idle read-end-only closure has no write to trigger detection; the existing tests close the read end and then cause output (`docs/plans/win-tool-gobetween/PLAN.md:352`; `machine/test/win-tool-proxy.test.js:115-122`).
- Tests cover wrap selection and adapters, stand-in/handoff, caching, failed and timed-out calls, signals, and readiness at launch (`machine/test/win-tool-wrap.test.js:25-54`; `machine/test/win-tool-proxy.test.js:27-80,106-124`; `machine/test/win-tool-service.test.js:41`).

Not checked: live provider re-list behavior, actual Windows process lifetime, or Node's idle pipe behavior independently of the recorded design finding.
