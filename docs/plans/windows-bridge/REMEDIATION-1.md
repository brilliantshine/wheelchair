# Remediation 1 — windows-bridge

Verification attempt 1 (commit 7f81502537754dfdd56f5086b2e241a347456f94), one verifier
(claude / claude-opus-5-5). Verdict FAIL with one gap; judged normal use (a Codex lead or worker
with a Windows-side MCP entry such as a Unity MCP), so it goes to remediation. No rare paths.

## Gap list (verbatim)

GAP: WT1 / D12 (`WHEELCHAIR_WINDOWS_PROJECT` reaches Windows-side tools), found while checking Check Once Built #1 — The variable is set in the session's tmux environment as the Spec says. But in a **Codex** session it never reaches a Windows stdio MCP server unless that `.mcp.json` entry passes through both `WHEELCHAIR_WINDOWS_PROJECT` **and** `WSLENV`. No doc says so. README only says "`WHEELCHAIR_WINDOWS_PROJECT` names the session's Windows copy". D12 says the variable is there "so Windows programs see it" and that this "works with every provider's existing stdio support". It does with Claude but not with Codex, so the letter is met and the intent is not. — Evidence: I ran `codex exec -s read-only` (codex-cli 0.171.0) with the same `-c mcp_servers.project_win.*` overrides that `machine/adapters/codex.js:58-84` builds. Command `/mnt/c/Windows/System32/cmd.exe`, args `/c powershell.exe -File <test MCP server>`, with `WHEELCHAIR_WINDOWS_PROJECT` and `WSLENV=WHEELCHAIR_WINDOWS_PROJECT` set in Codex's own environment: `env_vars=[]` (as an entry with no `env` produces): `project=[]`; `env_vars=["WHEELCHAIR_WINDOWS_PROJECT"]`: `project=[]`; `env_vars=["WHEELCHAIR_WINDOWS_PROJECT","WSLENV"]`: `project=[C:\Users\Collin\AppData\Local\Wheelchair\copies\t\k]`; Claude (`claude -p --mcp-config`, same entry, no `env`): `project=[C:\...\copies\t\k]`.

## R1 — Windows-side tools see `WHEELCHAIR_WINDOWS_PROJECT` in every provider that runs project tools

Brief: `/tmp/claude-1000/-home-gleam--local-state-wheelchair-worktrees-wheelchair-wc-c833faa8e033/b09290cb-cfd0-4a66-b14e-7ded0defa2f4/scratchpad/briefs/R1.md` (copied below in substance).

- Objective: on a WSL machine, a stdio `.mcp.json` entry whose command is a Windows program
  (`isWindowsProgram`) receives `WHEELCHAIR_WINDOWS_PROJECT` with no hand-written `env` in
  `.mcp.json`, for Codex and Antigravity as it already does for Claude. Codex: the adapter adds
  `WHEELCHAIR_WINDOWS_PROJECT` and `WSLENV` to that entry's `env_vars` passthrough (merged with any
  the entry already has, no duplicates) when the service runs on WSL. Antigravity: check how
  `machine/adapters/agy.js` passes env to stdio servers and make the same hold (test for real if
  `agy` is installed; otherwise reason from the adapter and say so). Kimi omits project tools today
  (unchanged). README "Windows bridge": one sentence that Windows-side tools get
  `WHEELCHAIR_WINDOWS_PROJECT` automatically, and that a hand-run tool outside Wheelchair needs it in
  `WSLENV`.
- Ownership: `machine/adapters/codex.js`, `machine/adapters/agy.js`, `machine/service.js` (only to
  pass the WSL flag/mount to the adapters if needed), their tests, `README.md`.
- Validation: unit tests for the Codex override (Windows entry on WSL gets both passthroughs;
  non-Windows entry unchanged; non-WSL unchanged); `bash machine/test/run.sh`;
  `node --test viewer/test/*.test.js`; a real check on this PC reproducing the verifier's
  experiment through the adapter's own overrides: `codex exec` with a Windows stdio test MCP
  server prints the copy path.
