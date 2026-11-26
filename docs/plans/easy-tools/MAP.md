# Easy tools: current map

```text
Tool author supplies MCP server + repository .mcp.json
  -> Settings reads and edits default branch -> PR -> merge
  -> session reads its worktree -> validate -> connector translates -> agent
  -> skipped or missing entries -> Project tools problem card
```

## Connecting a project tool

The existing reusable map is `docs/maps/project-tools.md`. The contract today is a root `.mcp.json` in Claude format, committed on the branch a thread starts from; the screen instead reads the GitHub default branch and saves edits through a PR (`README.md:169`, `machine/lib/project-tools.js:61`, `machine/lib/project-tools.js:135`). It edits an existing server definition, not server implementation: stdio needs a command and optional arguments/environment; HTTP or SSE needs a URL and optional headers (`machine/lib/project-mcp.js:76`). The page's Add a tool form, keys section and Unity preset are entry points for a simpler connection experience (`viewer/pages/project-tools.js:301`, `viewer/pages/project-tools.js:348`, `viewer/pages/project-tools.js:358`). A non-GitHub origin only exposes keys in that screen (`machine/lib/project-tools.js:72`).

The reader rejects non-regular files, invalid documents and documents over 32 KiB; invalid entries are skipped individually (`machine/lib/project-mcp.js:69`, `machine/lib/project-mcp.js:86`, `machine/lib/project-mcp.js:111`). Launch checks whether stdio programs exist but does not establish that a server connects (`machine/lib/project-programs.js:24`, `README.md:179`). Connector warnings and missing-program lines become a deduplicated thread card, which closes on a clean newer state (`machine/service.js:961`, `machine/service.js:997`, `viewer/app/sessions.js:145`). New connection flows need a place in both the save path and launch diagnostics.

## Recipients and AI differences

`TOOL_ROLES` allows lead, sub-lead, worker and verifier; reviewers and mappers do not receive project tools. Personal assistants and project leads are also explicitly excluded at launch (`machine/lib/project-mcp.js:9`, `machine/service.js:954`). This is the role gate to change if new tools should reach a different audience.

- Claude reads the project file, enables valid entries, disables rejected or replaced entries, and receives replacements as a separate MCP config (`connectors/claude/machine.js:68`).
- Codex gets `project_<name>` overrides with automatic tool approval. It skips SSE, duplicate headers, names outside letters/digits/underscore/hyphen and unsupported interpolation; it drops all overrides over the 64 KiB quoted argument budget (`connectors/codex/machine.js:26`, `connectors/codex/machine.js:31`, `connectors/codex/machine.js:51`). Its default launch uses workspace-write with network access; unrestricted mode removes the sandbox, while reviewers are read-only (`connectors/codex/machine.js:157`).
- Antigravity creates a private per-session plugin and skips SSE, invalid names, duplicate headers and substitutions except matching stdio `KEY: ${KEY}`; it launches with `--dangerously-skip-permissions` (`connectors/agy/machine.js:34`, `connectors/agy/machine.js:63`).
- Kimi and Pi warn and load no project tools (`connectors/kimi/machine.js:309`, `connectors/pi/machine.js:130`). OpenRouter is the provider selected by the Pi connector, not a separate project-MCP adapter (`connectors/pi/machine.js:130`).

The machine passes a role-derived flag and validated entries to connector `command` implementations (`machine/service.js:748`, `machine/service.js:992`). A new common tool runtime still needs a compatible path for each CLI, or an explicit unsupported warning; the Settings preflight only asks connectors declaring the project-tools capability (`machine/lib/project-tools.js:8`, `machine/lib/project-tools.js:20`).

## Secrets and configuration

Project keys are stored on the selected machine under `project-keys`, keyed by the real shared Git directory, with private directory/file modes; the machine state defaults to `~/.local/state/wheelchair` (`machine/lib/project-keys.js:42`, `machine/lib/project-keys.js:48`, `machine/lib/project-keys.js:59`, `machine/service.js:45`). Only eligible `${NAME}` references in stdio environment or HTTP/SSE headers are selected; reserved names are refused and a referenced key also used in command, arguments or URL is held back (`machine/lib/project-keys.js:9`, `machine/lib/project-keys.js:15`, `machine/lib/project-keys.js:71`). Only Claude and Codex opt in to injection; keys are passed in a temporary mode-600 launcher file and deleted before launching (`connectors/claude/manifest.js:136`, `connectors/codex/manifest.js:144`, `connectors/agy/manifest.js:114`, `machine/service.js:1026`, `machine/lib/env-launch.js:6`). Each machine needs its own keys (`viewer/pages/project-tools.js:328`). The repo file is shared configuration, whereas secrets and generated session settings are machine-local (`machine/lib/project-tools.js:135`, `machine/service.js:999`).

## Windows wiring

On WSL, supported connectors replace eligible Windows `.exe` stdio entries with a per-session go-between; it waits for the Windows project copy, caches tool lists and then launches the actual server. MCP for Unity is intentionally excluded from that wrapper (`machine/service.js:964`, `machine/lib/win-tool-wrap.js:7`, `machine/lib/win-tool-proxy.js:24`, `machine/lib/win-tool-proxy.js:42`, `machine/lib/win-tool-proxy.js:97`). A `wheelchair.windows` mark applies only to HTTP localhost/127.0.0.1; the service forwards it to Windows and substitutes a private Linux port (`machine/lib/project-mcp.js:121`, `machine/lib/win-mark.js:2`, `machine/service.js:971`). Failed forwarding drops that entry from the session and logs it (`machine/service.js:985`). A new wiring format must preserve these replacement and readiness seams; Windows executables outside WSL are dropped (`machine/lib/project-mcp.js:115`).

## Built-in tools and authoring

Wheelchair exposes its own agent operations through the command-line `viewer/app/wc.js` and `viewer/app/card.js`, referenced by role instructions (`protocol/app/worker.md:13`, `protocol/app/worker.md:48`); these are distinct from project MCP registration. Pi's shipped extension forwards agent and tool events to the hook, not a project tool registry (`connectors/pi/extension.js:1`, `connectors/pi/extension.js:11`, `connectors/pi/extension.js:18`). Antigravity's generated plugin is a per-session MCP configuration bridge, not a general authoring API (`connectors/agy/machine.js:63`). The installer removes retired skill wrappers (`install.sh:159`). A source search excluding vendor, tests, plans and maps found no easel, `cc-plugin-easel`, or `$.tool.register` implementation in this checkout; their external installation or history was not checked. The checked README describes configuring existing MCP servers, provider limits and diagnostics, but supplies no general tool-writing tutorial (`README.md:169`).

Not checked: external easel/plugin installations, third-party harness implementations, live connectivity or actual sandbox enforcement by those harnesses, all form edge cases, and unrelated Windows synchronization internals.
