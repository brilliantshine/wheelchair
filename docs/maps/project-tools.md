# Map: project tools

Checked against: `02027a6c8f3c88bbc10000cf067886f4547f9c97` (origin/main).
Files covered: `viewer/pages/project-tools.js`, `viewer/app/routes.js`, `machine/lib/project-tools.js`, `machine/lib/project-mcp.js`, `machine/lib/project-keys.js`, `machine/service.js`, `machine/adapters/claude.js`, `machine/adapters/codex.js`, `machine/adapters/agy.js`, `machine/adapters/kimi.js`.

```text
Settings form -> hub -> machine reads default branch .mcp.json
  -> edit tools and keys -> validate and open PR -> merge
  -> session worktree reads .mcp.json -> provider configuration -> CLI
```

The page reads the chosen machine and project through the hub and keeps editable `tools` and `sourceTools`; dirty detection compares those objects, and save sends `tools` plus keys (`viewer/pages/project-tools.js:239-263,677-714,735-741`; `viewer/app/routes.js:67-73`). SSE is not an editable form kind (`viewer/pages/project-tools.js:84-108,443-455,536`). Machine read fetches the GitHub default branch and returns the whole document, baseline blob identity and key-store revision; save rechecks both revisions, preserves other top-level document keys, replaces `mcpServers`, validates, commits in a temporary worktree, pushes and opens a PR (`machine/lib/project-tools.js:50-87,90-105,108-141`). A switch stored separately from `mcpServers` therefore needs page state, rename/delete handling, dirty comparison and save payload plus machine-side validation, comparison and candidate construction; merely changing the preserved top-level object will currently be treated as no tool change (`viewer/pages/project-tools.js:418-424,595-602,677-714`; `machine/lib/project-tools.js:98-115`).

At start, the worktree reader checks document and entries, retains valid servers and warnings, and drops Windows executable entries outside WSL (`machine/lib/project-mcp.js:8-128`; `machine/service.js:832-851`). Only lead, sub-lead, worker and verifier get project tools (`machine/lib/project-mcp.js:8`; `machine/service.js:843-850`). Claude reads `.mcp.json` itself; settings enable accepted entries and disable rejected names (`machine/adapters/claude.js:63-68`). Codex emits `project_` TOML command overrides, supports HTTP headers including environment references, rejects SSE, and drops the override set if over budget (`machine/adapters/codex.js:32-100`). Antigravity/Gemini builds a per-session plugin with HTTP or stdio entries, rejects SSE and some substitutions (`machine/adapters/agy.js:31-67`). Kimi emits a warning and loads no project tools (`machine/adapters/kimi.js:158-166`). Claude withholding needs its disabled-name list; other supported adapters need the entry removed before rendering. Project keys for Claude and Codex enter through a temporary mode-600 launcher file (`machine/service.js:871-885`; `machine/lib/env-launch.js:1-20`).

Not checked: provider vendor implementation or live CLI behavior, Pi rendering, all form edge cases and tests.
