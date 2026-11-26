# Map: tool keys

Checked against: `6802372cdc5c1af28742818c90732cd3a83d4f3c` (origin/main).

```text
project or shared tool declares names -> select corresponding machine-local store
  -> tool-only execution -> redact script result -> agent
```

[Folder tools and key boundaries](../../maps/folder-tool-keys.md) maps current discovery, launch, providers, Settings, existing keys, CLI, sandbox and redaction. It supersedes the feature-relevant portions of the older [project tools](../../maps/project-tools.md), [Settings](../../maps/settings-page.md), [session tokens](../../maps/session-token-flow.md), [machine lifecycle](../../maps/machine-session-lifecycle.md), and [instruction delivery](../../maps/project-instruction-delivery.md) maps: all five have changed covered files since their checked commits, so their remaining historical claims need rechecking before reuse.

- A `keys` property is currently discarded by validation; a key-aware schema must preserve it across discovery and the bridge's change check (`machine/lib/folder-tools.js:14`, `machine/lib/tool-bridge.js:10`). Project/shared selection must also account for shared-project sessions, where the shared copy is deliberately omitted (`machine/service.js:976`).
- Keeping new folder keys out of MCP configs alone is insufficient: existing `.mcp.json` project-key injection reaches the Claude and Codex agent itself, and `toolEnv` inherits that environment. The feature's boundary requires resolving the existing injection path and inherited values, not just adding a store (`machine/service.js:1065`, `machine/lib/env-launch.js:17`, `machine/lib/tool-run.js:5`). Mode 0600 protects against other users, not a process under the same account (`machine/lib/project-keys.js:64`).
- Script result and error streams are clipped without arbitrary-secret redaction. Redaction must precede clipping and handle boundaries across chunks and capture limits; the early design in easy-tools round 3 identified that failure (`machine/lib/tool-run.js:16`, `docs/plans/easy-tools/PLAN.md:397`). Server MCP output has no such intermediary redactor (`machine/lib/tool-launch.js:26`).
- `check` and `run` currently execute locally in the caller's sandbox and inherit its environment; routing keyed execution through the machine would cross the sandbox boundary. Codex omits folder MCP entries when sandboxed, while Windows run/start refuses sandboxed callers and screen launches wrap them (`viewer/app/tool-cli.js:70`, `viewer/app/tool-cli.js:92`, `connectors/codex/machine.js:168`, `machine/lib/win.js:454`, `machine/lib/screen.js:225`). Keyed check/run behavior needs an explicit design per provider and sandbox mode.
- Settings already has a Shared tools category next to Project tools; its existing picker saves a hub-wide repo choice, whereas a shared-key editor needs a machine selection and machine-local secret routes (`viewer/pages/settings.js:19`, `viewer/pages/settings.js:2398`, `viewer/app/routes.js:84`).

Not looked at: live sandbox enforcement across platforms, third-party server output behavior, all transcript and log sinks, and the unrelated historical-map claims.
