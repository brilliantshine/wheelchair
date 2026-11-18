# Map: local projects

Checked against `4cfa20cd5aafa0418afabb829c9a4c73430a435f` (origin/main and worktree HEAD). The detailed flow and limits are in [local-project-runtime](../../maps/local-project-runtime.md).

```text
choose machine and project -> start session in worktree -> CLI and local app
  -> image or verification evidence -> push branch and open PR
```

- The hub's project list holds paths, Settings already has machine-scoped saved directories and project-scoped templates, and the machine start payload has no MCP field (`viewer/app/state.js:196-203`; `viewer/app/routes.js:133-138,170-178,340-348`; `viewer/app/sessions.js:304-330`). Normal adapter commands do not explicitly disable MCP; Claude asides and usage probes do use `--strict-mcp-config`, and Codex asides disable discovered servers (`machine/adapters/claude.js:54-55,63-69`; `machine/adapters/codex.js:28,50`; `machine/adapters/agy.js:30-32`). Actual CLI discovery of repo and global settings remains unverified; non-default accounts use separate config homes (`machine/adapters/common.js:9-17`; `machine/service.js:580-588,611-616`).
- Sessions run in tmux, normally in a Linux user scope or macOS launch-agent environment; neither session launch nor installed units explicitly supply display variables (`machine/service.js:611-624`; `install.sh:312-352,392-405`). GUI access depends on the actual environment and permissions. Image cards copy an existing image, and Playwright browsers are installed, but neither establishes a desktop screenshot path (`protocol/app/cards-lead.md:178-189`; `machine/service.js:328-345`; `install.sh:115-125`).
- Worktrees start from fetched origin default branch, with workers and detached verifiers using the thread branch (`machine/service.js:471-492,529-541`; `viewer/app/sessions.js:625-630`). Finishing pushes and opens a PR; the exposed agent git operations act in its own worktree, not the user's checkout (`protocol/app/lead.md:312-325`; `machine/service.js:1040-1063`). Named machines come from `machines.json`, initially populated for the installing host (`install.sh:149-167`; `viewer/app/state.js:146-162`).

## What I did not look at

Live CLI MCP behavior, actual display access and screenshot utilities, all checkout UI and handoff cases, remote machine setup beyond the registry, and credentials.
