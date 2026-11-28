# Map: project tools

Checked against: `0cfa47421c626c2c34d2f895c4230791cd3856d2` (origin/main). Files covered: `viewer/pages/project-tools.js`, `viewer/app/routes.js`, `viewer/app/sessions.js`, `machine/lib/project-tools.js`, `machine/lib/project-mcp.js`, `machine/lib/project-keys.js`, `machine/lib/project-programs.js`, `machine/lib/env-launch.js`, `machine/service.js`, `connectors/claude/machine.js`, `connectors/codex/machine.js`, `connectors/agy/machine.js`, `connectors/kimi/machine.js`, `connectors/pi/machine.js`.

```text
Tools page -> hub -> machine reads tools and keys -> status and edits
session start -> discovery -> connector configuration -> agent -> problem card
```

The Tools page renders each folder row's status and key lines (`viewer/pages/project-tools.js:308`); the machine decorates rows with their chosen store and missing keys (`machine/lib/project-tools.js:159`). Folder discovery results and their problems feed session launch; project `.mcp.json` entries take precedence over same-name folder entries (`machine/service.js:1002`, `machine/service.js:1025`). Project MCP keys follow a separate agent-environment injection path and are held back when referenced in a command, argument or URL (`machine/lib/project-keys.js:22`, `machine/lib/project-keys.js:78`, `machine/lib/env-launch.js:6`).

Claude receives folder entries in an MCP config, Codex renders them as launch overrides, and Antigravity builds tool files (`connectors/claude/machine.js:77`, `connectors/codex/machine.js:167`, `connectors/agy/machine.js:35`). Kimi and Pi use shell tools and report server names as unsupported; sandboxed Codex is also shell-only (`connectors/kimi/machine.js:249`, `connectors/kimi/machine.js:313`, `connectors/pi/machine.js:19`, `connectors/pi/machine.js:140`, `connectors/codex/machine.js:124`). The Tools page key line still says keys are unavailable to Kimi and Pi, although those connectors can run keyed scripts on the machine (`machine/lib/project-tools.js:160`, `protocol/tools.md:102`). Gemini is the provider for the `agy` connector, not a separate connector (`connectors/README.md:11`).

Not looked at: provider vendor implementations or live CLI behavior, every settings edge case, Windows proxy internals.
