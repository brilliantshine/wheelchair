# agy 1.5.9 live fixtures

Screens captured with `tmux capture-pane -p -J` unless named wrapped; email replaced with user@example.com and the OAuth URL removed. `login-menu.txt`, `login-link-joined.txt`, `login-link-wrapped.txt`, `login-success.txt`, and `login-bad.txt` cover login; the wrapped capture was limited to the visible pane. `idle.txt` is the signed-in idle prompt. `after-aside.txt` is the interactive pane after the headless aside. `auto-commands.txt` shows two auto-mode commands that ran without a prompt.

`help.txt` and `models-help.txt` are help output. `models-signed-out.txt` and `models-signed-in.txt` are model lists. `stop.json` is the global Stop hook's stdin, and `transcript.jsonl` is its transcriptPath file. `aside.json` is the headless JSON response against the still-running interactive conversation. `plan-output.json.txt` is the headless plan-mode output, including its permission denial.

T0b adds `trust-prompt.txt`, `trust-after.txt`, `trust-inline.txt`, and `trust-file.txt` for workspace trust and settings; `role-multiline.txt` and `turns.txt` for the pasted role and subsequent turns; `stop-role.json`, `stop-tools.json`, `stop-second.json`, and `transcript-tools.jsonl` for their hook and transcript data. `permission-prompt.txt` and `permission-after.txt` show the command approval; `plan-mode.txt`, `plan-after-escape.txt`, and `plan-skip.txt` show plan mode. `instruction-agents.txt` and `instruction-gemini.txt` show instruction discovery, and `error-model.txt` shows the unrecognized-model warning. Email addresses are redacted.

Fresh sign-in captures: `onboard-1-theme.txt` (default theme), `onboard-2-data.txt` (data sharing opt-out), and `onboard-3-trust.txt` (workspace trust). The scratch workspace path is replaced.
