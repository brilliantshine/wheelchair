# agy 1.5.9 live fixtures

Screens captured with `tmux capture-pane -p -J` unless named wrapped; email replaced with user@example.com and the OAuth URL removed. `login-menu.txt`, `login-link-joined.txt`, `login-link-wrapped.txt`, `login-success.txt`, and `login-bad.txt` cover login; the wrapped capture was limited to the visible pane. `idle.txt` is the signed-in idle prompt. `after-aside.txt` is the interactive pane after the headless aside. `auto-commands.txt` shows two auto-mode commands that ran without a prompt.

`help.txt` and `models-help.txt` are help output. `models-signed-out.txt` and `models-signed-in.txt` are model lists. `stop.json` is the global Stop hook's stdin, and `transcript.jsonl` is its transcriptPath file. `aside.json` is the headless JSON response against the still-running interactive conversation. `plan-output.json.txt` is the headless plan-mode output, including its permission denial.
