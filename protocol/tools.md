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

Use `WHEELCHAIR_PROJECT_DIR` for the project's files, never a path climbing out of the tool folder. Reach the tool's own helper files relative to its folder. Keep state in `WHEELCHAIR_PROJECT_DIR` or a temporary folder: shared copies are read-only.

## Keys

Script and server tools can declare `keys`: an array of 1–20 unique environment-variable names. Names contain letters, digits and `_`, cannot start with a digit, and cannot be names that change how the agent runs. For example:

```json
{
  "name": "lookup",
  "description": "Look up a record",
  "kind": "script",
  "inputs": {
    "query": { "type": "string", "description": "Record to look up", "required": true }
  },
  "run": ["./run.sh"],
  "keys": ["LOOKUP_API_KEY"]
}
```

Server tools may list `keys`. Values reach only the server process and are read when it starts. Replies and error output are checked for keys using the same spellings as scripts. Only text inside a message can be replaced. A reply that cannot be cleaned this way or is over 32 MiB is usually replaced by an error reply to the same request. It is dropped if its `id` holds a key or could not be checked, or if an oversized reply's `id` comes after the cut. A server request that cannot be cleaned gets an error; other messages that cannot be cleaned are dropped. `check` runs without keys. Keyed servers have the same availability as other server tools.

A project tool uses the project's keys, set on its Tools page under Keys on this machine. A shared tool uses the machine's shared keys, set in Settings under Shared tools, Shared keys. In the shared tools project's own threads, its tools use the shared keys too. Each machine keeps its own keys. A usable value is 8–4096 characters of letters, digits and `. _ ~ + / = -`; other values count as not set.

For script tools, at each call the values are added only to the tool's own process, never to the agent's environment, MCP configs or instructions. A key also used by a `.mcp.json` server still reaches the agent that way; moving that server to a folder tool removes it. Agents run as the same OS user, so an agent that looks for key files on disk can find them.

A tool with a missing key is not offered; problems show `needs key <KEY>, not set on this machine` (or `needs keys A, B, …` for several). On Kimi and Pi the problems line is as of session start. For MCP, a key added mid-session is usable from the next agent start (a new session, resume or account switch). For script tools, a replaced value applies from the next call; a removed key makes the next call fail without running. A server gets a replaced or removed value at its next start, at the next agent start. For MCP, if a tool's `keys` change mid-session, it is refused as changed until the next agent start. For script tools on Kimi and Pi, an added key and a changed `keys` list both apply from the next `wc.js tool run`, with no refusal.

In script output, keys printed as-is or with up to three layers of common escapes are replaced with `[key]`. This covers JSON and backslash escapes such as `\u002B`, `\x2B` and `\/`, and percent-encoding such as `%2B`. Base64, hashing, splitting and web-page codes such as `&#43;` are outside this protection, and deeper escaping may leave a key visible. A backslash right before a key is hidden with it. At a cut edge, text that looks like part of an escaped key is dropped, and a cut-off stretch made entirely of key characters, percent signs and backslashes can be dropped whole. Very escape-heavy output can show `[not checked for keys]` in place of stretches of those characters. A server message replaces an echoed key with `[key]` only when it appears as written. If JSON escapes it, for example `/` as `\/`, the message is held back instead. A message is also held back as "could not be checked for keys" if it contains a stretch over 4 KiB of key characters mixed with `%` or `\`, such as a long percent-encoded URL or nested JSON with `\/`, or so many stretches that checking runs out of time. Never print or log a key in any form. Never write a key into a tool's files: they are committed. Node's child-process debug output (`NODE_DEBUG`) on in the bridge or server launcher refuses keyed tools. Claude, Antigravity and unrestricted Codex use keyed tools through MCP with no extra step. Kimi and Pi run keyed script tools through `wc.js tool run`, which asks the machine to run them with their keys and returns redacted output; key values never appear in the result. Sandboxed Codex cannot use keyed tools; set Codex to unrestricted in Settings to use them.

Tools may rely only on `PATH`, `HOME`, `WHEELCHAIR_PROJECT_DIR`, their declared keys and variables they set themselves. Keys a tool happens to find in its environment exist only on some AIs and projects.

## Project and shared tools

A project tool lives in that project's repository. Choose a shared tools project in Settings to offer its tools to other projects. Make or change shared tools in threads in that project, through a pull request; each machine offers the merged default branch from its local saved copy of that project. A session stays pinned to the shared copy it started with, including on resume or account switch. A project tool hides a shared tool of the same name. A `.mcp.json` server with the same name takes precedence over a folder entry.

A lead asked for a shared tool in another project's thread says it belongs in the shared tools project and names that project; the user or assistant opens a thread there.

## Make and test

Run `node <wheelchair-root>/viewer/app/wc.js tool` followed by these commands. In a session they use its worktree and pinned shared copy; outside a session they use the current git checkout only. `new` writes into the current worktree and refuses an existing folder. `list` shows each tool's name, kind, source and `ok` or the reason it can't be used (`--json` gives JSON). `check [name]` validates tools and checks a server's MCP handshake and advertised tool list, with a 30-second deadline. `run name --input '<json>'` runs a script, with `{}` as the default input. In a session, `list` shows each keyed tool's key names and whether each is set. `check` validates without using keys. On Kimi and Pi, `run` uses the machine for keyed script tools. If the connection is lost, the tool may already have run, so check before running it again. Otherwise, `run` runs in your own shell without folder-tool keys and says so; variables already in your environment pass as usual. On the other AIs, to try a keyed tool for real, use it through MCP in a session that offered it.

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

Claude, unrestricted Codex and Antigravity receive folder tools through MCP in roles that receive project tools. Kimi, Pi and sandboxed Codex run script tools from the shell with `wc.js tool run`; set the shell call timeout above the tool's `timeout_seconds`. Kimi and Pi run keyed script tools through the machine as above. Sandboxed Codex cannot use keyed tools; its problems and `wc.js tool list` say so, with the message `set Codex to unrestricted in Settings to use it`. They have no server tools; Codex needs unrestricted mode for those. Codex keeps `.mcp.json` entries first, then tries folder entries one at a time (bridge first, then server tools by name). Any entry that would push the launch arguments over Codex's 64 KiB budget is left out and named on the problems card; later smaller entries can still fit.

Codex sets the bridge's MCP call deadline to 260 seconds. Codex 0.172.0 defaults to 300 seconds per call for server tools. Claude Code 2.1.332 defaults to 100,000,000 ms per MCP call (it reads `MCP_TOOL_TIMEOUT`, in milliseconds), well above 260 seconds. Wheelchair sets the Antigravity bridge's `timeoutSeconds` to 260; Antigravity's default for server tools was not established.
