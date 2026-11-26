# Folder tools

A tool is a folder in `.wheelchair/tools/<name>/` with `tool.json` and any files it needs. A script tool starts a fresh program for each call; a server tool runs a stdio MCP server for the session. Wheelchair connects valid folder tools automatically for supported agents; no `.mcp.json` edit is needed. HTTP MCP servers stay in `.mcp.json`.

## Describe a tool

The folder name and `name` must match, contain 1–40 letters, digits, underscores or hyphens, and cannot be `wheelchair-tools`. `description` is a nonempty single line. Unknown fields are ignored. `tool.json` must be a regular JSON file of at most 32 KiB.

A complete script description:

```json
{
  "name": "demo",
  "description": "Echo text",
  "kind": "script",
  "inputs": {
    "text": { "type": "string", "description": "Text to echo", "required": false }
  },
  "run": ["./run.sh"],
  "timeout_seconds": 120
}
```

`inputs` maps names to a type (`string`, `number`, `boolean`, `object` or `array`), a nonempty description and a boolean `required`. `run` is a nonempty argument array: its first item is an executable on PATH or a path relative to the tool folder. The script receives a JSON object on stdin and returns text on stdout. `timeout_seconds` is an integer from 1 to 240, default 120; the cap leaves time for cleanup within the bridge's Codex call deadline. Failed calls return an error; stdout is capped at 1 MiB and stderr keeps its last 4 KiB.

A complete server description:

```json
{
  "name": "search",
  "description": "Search the project",
  "kind": "server",
  "start": ["node", "server.js"]
}
```

`start` is a nonempty argument array, with the same program lookup as `run`. For an existing stdio server that needs the project as its working directory and argument, use:

```json
"start": ["sh", "-c", "cd \"$WHEELCHAIR_PROJECT_DIR\" && exec some-server \"$WHEELCHAIR_PROJECT_DIR\""]
```

Folder tools do not support keys yet. Never put a key in `tool.json` or any file in the tool folder: those files are committed. A tool that needs a token must wait for key support or be listed in `.mcp.json` with project keys as today. Tools may rely only on `PATH`, `HOME`, `WHEELCHAIR_PROJECT_DIR` and variables they set themselves. Keys a tool happens to find in its environment exist only on some AIs and projects.

Use `WHEELCHAIR_PROJECT_DIR` for the project's files, never a path climbing out of the tool folder. Reach the tool's own helper files relative to its folder. Keep state in `WHEELCHAIR_PROJECT_DIR` or a temporary folder: shared copies are read-only.

## Project and shared tools

A project tool lives in that project's repository. Choose a shared tools project in Settings to offer its tools to other projects. Make or change shared tools in threads in that project, through a pull request; each machine offers the merged default branch from its local saved copy of that project. A session stays pinned to the shared copy it started with, including on resume or account switch. A project tool hides a shared tool of the same name. A `.mcp.json` server with the same name takes precedence over a folder entry.

A lead asked for a shared tool in another project's thread says it belongs in the shared tools project and names that project; the user or assistant opens a thread there.

## Make and test

Run `node <wheelchair-root>/viewer/app/wc.js tool` followed by these commands. In a session they use its worktree and pinned shared copy; outside a session they use the current git checkout only. `new` writes into the current worktree and refuses an existing folder. `list` shows each tool's name, kind, source and `ok` or the reason it can't be used (`--json` gives JSON). `check [name]` validates tools and checks a server's MCP handshake and advertised tool list, with a 30-second deadline. `run name --input '<json>'` runs a script, with `{}` as the default input.

For example, in a scratch checkout:

```text
$ wc.js tool new demo --kind script
/tmp/wc-t7-demo.480ZI9/.wheelchair/tools/demo
Next: wc.js tool check demo
$ wc.js tool list
demo	script	project	ok
$ wc.js tool check demo
demo: ok
$ wc.js tool run demo --input '{"text":"hi"}'
Input: {"text":"hi"}
```

Create a template with `new`, edit it, run `check` and `run` with representative input, then commit before asking for review. Use `--kind server` for the Node server template; server tools are tested with `check`, not `run`. A changed `tool.json` reaches MCP at the next agent start: a new session, resume or account switch. Script files themselves run live. If the description changes during a session, the bridge asks you to run it from the shell or wait for the next start.

## AI limits

Claude, unrestricted Codex and Antigravity receive folder tools through MCP in roles that receive project tools. Kimi, Pi and sandboxed Codex run script tools from the shell with `wc.js tool run`; set the shell call timeout above the tool's `timeout_seconds`. They have no server tools; Codex needs unrestricted mode for those. Codex keeps `.mcp.json` entries first, then tries folder entries one at a time (bridge first, then server tools by name). Any entry that would push the launch arguments over Codex's 64 KiB budget is left out and named on the problems card; later smaller entries can still fit.

Codex sets the bridge's MCP call deadline to 260 seconds. Codex 0.172.0 defaults to 300 seconds per call for server tools. Claude Code reads a per-call MCP timeout from the `MCP_TOOL_TIMEOUT` environment variable (milliseconds); its default was not checked. Claude's and Antigravity's MCP call deadlines are unchecked, including whether they allow 260 seconds; a long script may therefore time out earlier on those clients.
