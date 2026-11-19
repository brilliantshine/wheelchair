# Map: project tools screen

Checked against: `207c02f5e0b56cfbcc96046cca10a8df92002a9c` (origin/main).
Files covered: see [project tools map](../../maps/project-tools.md); the MCP portion of [local project runtime](../../maps/local-project-runtime.md) was rechecked at the same commit.

```text
machine + project path -> fetch origin default branch -> thread worktree
  -> read .mcp.json -> validate per server -> role and CLI adapter -> tools or warnings
```

A thread starts from the fetched remote default branch, so editing a checkout alone will not make tools available to new threads (`machine/service.js:529-542,554-560`). Project records are path strings; machine and default branch live on thread records, while saved directories are machine-specific (`viewer/app/state.js:171-173,196-203`; `viewer/app/threads.js:20-25`; `viewer/app/routes.js:125-151,163-178`; `viewer/app/sessions.js:360-365`). There is no existing project page in the page allowlist; Settings and New thread provide patterns for a machine and repo selector (`viewer/server.js:1707`; `viewer/pages/settings.js:7-8`; `viewer/app/routes.js:125-152`).

The machine checks the worktree file on every session start; lead, sub-lead, worker and verifier get supported entries. Claude enables accepted file entries; Codex translates them to overrides with additional restrictions; Antigravity does not support them. Warnings go to machine-service stderr, not a surfaced screen (`machine/lib/project-mcp.js:6-42`; `machine/service.js:612-615`; `machine/adapters/claude.js:69-74`; `machine/adapters/codex.js:63-102`; `machine/adapters/agy.js:30-32`). See the shared map for validation and the whole-file Claude caveat.

The existing project endpoint only discovers and checks repos; agent Git writes run in session worktrees, while archive and handoff have separate thread-scoped writes. None of these inspected flows edits project tools or makes a default-branch commit or PR (`machine/service.js:1198-1234,1042-1067,813-841,1248-1286,1321-1344`). A new write flow must therefore decide how to deliver changes to the branch threads actually start from, including dirty checkout and remote changes.

There is no per-project MCP secret store or injection in the inspected startup path. Codex supports same-name environment passthrough from the CLI environment, but literal values become command arguments and persisted session data; Claude expansion and actual inherited tmux variables were not verified (`machine/adapters/codex.js:73-92`; `machine/service.js:401,612-629`). Hub-machine authentication secrets and CLI login homes serve different purposes (`install.sh:149-166`; `machine/adapters/common.js:9-14`).

Pages call the hub JSON API; the server applies cookie/token authentication and write-origin checks, and the hub uses the selected machine's secret to call its service (`viewer/pages/settings.js:64-74`; `viewer/server.js:1286-1298,2090-2111`; `viewer/app/machine-client.js:53-77`).

## What I did not look at

CLI vendor implementations or live MCP startup, actual inherited service/tmux environment, external credential managers, every unrelated API route, hosting permissions, or browser tests.
