# Map: project tools

Checked against: `fb3205ae4542439a43574a42853082b9db60b172` (origin/main; covered files match this worktree). Files covered: `viewer/pages/project-tools.js`, `viewer/app/routes.js`, `viewer/app/sessions.js`, `machine/lib/project-tools.js`, `machine/lib/project-mcp.js`, `machine/lib/project-keys.js`, `machine/lib/project-programs.js`, `machine/lib/env-launch.js`, `machine/service.js`, `connectors/claude/machine.js`, `connectors/codex/machine.js`, `connectors/agy/machine.js`, `connectors/kimi/machine.js`, `connectors/pi/machine.js`.

```text
Settings form -> hub -> machine reads default-branch .mcp.json
  -> save keys locally and open tool-change PR -> merge
  -> session worktree reads .mcp.json -> connector translates -> agent
  -> skipped entries and missing programs -> thread problem card
```

The Settings screen selects machine and project and edits MCP entries and local keys (`viewer/pages/project-tools.js:125`, `viewer/pages/project-tools.js:252`, `viewer/pages/project-tools.js:348`); hub forwards to the machine (`viewer/app/routes.js:84`). Machine fetches the GitHub default branch; without a GitHub origin the screen is keys-only. It rechecks blob and key revisions, preserves other top-level fields, writes tool changes in a temporary worktree, pushes and opens a PR; a key-only save does not open a PR (`machine/lib/project-tools.js:61`, `machine/lib/project-tools.js:72`, `machine/lib/project-tools.js:91`, `machine/lib/project-tools.js:113`, `machine/lib/project-tools.js:135`).

At launch, the worktree reader accepts stdio, HTTP and SSE entries, limits the document to 32 KiB, reports malformed entries and excludes Windows executables outside WSL (`machine/lib/project-mcp.js:69`, `machine/lib/project-mcp.js:86`, `machine/lib/project-mcp.js:111`). Only lead, sub-lead, worker and verifier get project tools, excluding personal assistants and project leads (`machine/lib/project-mcp.js:9`, `machine/service.js:954`). Claude enables valid project entries; Codex renders preapproved `project_` overrides with transport, substitution, name and size limits; Antigravity makes a private per-session plugin with its own limits; Kimi and Pi report unsupported (`connectors/claude/machine.js:68`, `connectors/codex/machine.js:31`, `connectors/codex/machine.js:51`, `connectors/agy/machine.js:34`, `connectors/kimi/machine.js:309`, `connectors/pi/machine.js:130`).

Keys are separate per-machine files keyed by the shared Git directory, mode 600; reserved names are refused and a key also referenced in a command, argument or URL is held back (`machine/lib/project-keys.js:9`, `machine/lib/project-keys.js:15`, `machine/lib/project-keys.js:42`, `machine/lib/project-keys.js:59`, `machine/lib/project-keys.js:71`). Only manifests opting into injection get a private temporary launcher file, deleted before launching the CLI (`machine/service.js:1026`, `machine/lib/env-launch.js:6`). Missing executables and connector warnings feed the thread's deduplicated problem card (`machine/lib/project-programs.js:24`, `machine/service.js:961`, `viewer/app/sessions.js:145`).

Not checked: provider vendor implementations or live CLI behavior; every settings-form edge case; the Windows proxy internals beyond the launch seam.
