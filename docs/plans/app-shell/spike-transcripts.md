# Transcript spike (T1, D39)

Run 2026-11-14 with Claude Code 2.1.325, codex-cli 0.169.0 (model gpt-6-sol), tmux 3.5a.
Scratch: `/tmp/wc-spike/` (`hook.sh`, `notify.sh`, `send.sh`, `settings.json`, `hook.log`, scratch repos).
Every session started with `WHEELCHAIR_LANE=1`. Real config files were not edited.

## Summary table

| Check | Claude | Codex |
|---|---|---|
| 1 Start in tmux | PASS | PASS |
| 2 No trust prompt in a fresh path | FAIL (could not pre-trust without writing `~/.claude.json`) | PASS with one `-c` form; the form in the plan fails |
| 3 One-line message | PASS | PASS |
| 4 Multi-line = one turn | PASS | PASS |
| 5 Transcript carries chat and tool calls | PASS | PASS |
| 6 One turn-end signal per turn | PASS | PARTIAL (one extra notify per session, from an internal title turn) |
| 7 No permission prompt for `ls` and file create | PASS | PASS |

## 1. Start in tmux

Flags exist as the plan names them. Claude: `--session-id <uuid>`, `--settings <file-or-json>`, `--permission-mode <mode>`. Codex: `-c key=value`, `-s workspace-write`, `-a never`.

```
tmux new-session -d -s wc-spike-claude -x 200 -y 50 -c <cwd> \
  "WHEELCHAIR_LANE=1 claude --session-id $U --settings /tmp/wc-spike/settings.json"
tmux new-session -d -s wc-spike-codex -x 200 -y 50 -c /tmp/wc-spike/repo-codex \
  "WHEELCHAIR_LANE=1 codex -c 'projects={\"/tmp/wc-spike/repo-codex\"={trust_level=\"trusted\"}}' \
   -c 'notify=[\"/tmp/wc-spike/notify.sh\",\"codex\"]' -s workspace-write -a never"
```

`settings.json` is `{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"/tmp/wc-spike/hook.sh claude Stop"}]}],"Notification":[ ...same, "claude Notification" ]}}`. `--settings` hooks ran in addition to Collin's own `Stop` hook (`moshi-hook`); the transcript's `stop_hook_summary` lists both.

## 2. Trust prompt

**Claude: FAIL.** A fresh `/tmp/wc-spike/repo-claude` (git repo) showed:

```
 Accessing workspace: /tmp/wc-spike/repo-claude
 Quick safety check: Is this a project you created or one you trust? ...
 ❯ No, exit
   Yes, I trust this folder
```

Trust is recorded in `~/.claude.json`, `projects["<abs path>"].hasTrustDialogAccepted = true` (read-only look: `/home/collin/projects/personal/wheelchair` is `true`). It is an exact-path match: a new git repo at `/home/collin/projects/personal/wc-spike-scratch/repo-claude` showed the prompt even though its ancestors `/home/collin/projects/personal` and `/home/collin/projects` are trusted (no inheritance). No `--help` flag or `--settings` key found that pre-trusts a path; `--help` says the trust dialog is skipped only with `-p` (non-interactive). Accepting the dialog writes the config file. **Unverified, needs a write**: the service would have to add `projects."<worktree path>".hasTrustDialogAccepted = true` to `~/.claude.json` (a JSON file shared with a running `claude`, so a read-modify-write race is possible), or point `CLAUDE_CONFIG_DIR` at a private dir (needs credentials there; not tried). I stopped rather than edit it.

**Codex: PASS, but not with the plan's likely form.** Without an override, a fresh `/tmp/wc-spike/repo-codex` showed `Trust this folder? ... 1. Trust and continue`. With `-c 'projects."/tmp/wc-spike/repo-codex".trust_level="trusted"'` the prompt still appeared (tried once). With an inline table, `-c 'projects={"/tmp/wc-spike/repo-codex"={trust_level="trusted"}}'`, the TUI opened straight to the prompt box and `~/.codex/config.toml` stayed unchanged (`grep -c wc-spike` = 0). The inline-table override replaces the whole `projects` table for that process, which is fine for one worktree. Trust is otherwise stored in `~/.codex/config.toml` as `[projects."<path>"] trust_level = "trusted"`.

## 3. One-line message

Method: `tmux load-buffer -b wcb m1.txt; tmux paste-buffer -p -b wcb -t <s>; sleep 1; tmux send-keys -t <s> Enter` (`send.sh`). Message: `Reply with the single word pong.`

Claude: PASS, pane showed `❯ Reply with the single word pong.` / `● pong`. Codex: PASS, `› Reply ...` / `• pong`.

## 4. Multi-line message

Message (3 lines, no trailing newline): `Please read these three lines.\nLine two: nothing to do.\nReply with exactly: three lines received`. Both showed it as one prompt block and replied `three lines received` once. The transcripts confirm one user entry (check 5). PASS for both. The one-second sleep between paste and Enter worked; a shorter gap was not tried.

## 5. Transcript

### Claude (`~/.claude/projects/<cwd with / and . replaced by ->/<session-id>.jsonl`)

The file name is the `--session-id` we passed, so the service knows the path in advance. One JSON object per line; many `type`s are noise (`mode`, `permission-mode`, `session-owner`, `api-request*`, `file-history-snapshot`, `attachment`, `last-prompt`, `ai-title`, `tools-used`, `system`).

Chat is `type:"user"` and `type:"assistant"`, in file order, with `message.role` and `message.content`:

```
{"type":"user","message":{"role":"user","content":"Reply with the single word pong."},"promptId":"c93c7eb8-...","origin":{"kind":"human"},"promptSource":"typed","turnOrigin":"human","turnPosition":{"promptIndex":1,"turnIndex":1},"timestamp":"2026-11-14T11:52:47.674Z", ...}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"pong"}]}, ...}
{"type":"user","message":{"role":"user","content":"Please read these three lines.\nLine two: nothing to do.\nReply with exactly: three lines received"}, ...}
```

The multi-line message is one entry, with real `\n` in the string. Tool calls: an assistant entry whose content has `{"type":"tool_use","id":"toolu_015g...","name":"Bash","input":{"command":"ls",...}}`, then a `type:"user"` entry whose content is a list holding `{"tool_use_id":"toolu_015g...","type":"tool_result","content":"AGENTS.md\ncodex\n...","is_error":false}`, then the assistant `text` "done". **A tool result is a `user` entry** and must be told from a human message by its list content (or `origin.kind` / `promptSource`: typed human entries carry `origin.kind:"human"`). Prose entries have `content` of `text` blocks. Turn markers in the file: `{"type":"system","subtype":"stop_hook_summary",...}` then `{"type":"system","subtype":"turn_duration","durationMs":...}`.

PASS.

### Codex (`~/.codex/sessions/YYYY/MM/DD/rollout-<local time>-<thread-id>.jsonl`)

The file name carries the thread id but the time part is local time and the file is only created once the first turn starts, so the service finds it by `thread-id` (from `notify`) or by scanning for the newest rollout whose `session_meta.payload.cwd` matches. Each line is `{"timestamp","ordinal","type","payload"}`. First line `type:"session_meta"` with `payload.id` (thread id), `payload.cwd`.

Chat is `type:"response_item"` with `payload.type:"message"`, `payload.role` `user`/`assistant`, `payload.content` a list of `input_text` / `output_text`:

```
{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Reply with the single word pong."}]}}
{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"pong","annotations":[],"logprobs":[]}]}}
{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Please read these three lines.\nLine two: nothing to do.\nReply with exactly: three lines received"}]}}
```

Multi-line message: one entry. Gotcha: the session starts with injected `role:"user"` entries (`# AGENTS.md instructions ...`, environment) and `role:"developer"` entries before the first real message; these must be skipped, e.g. by taking user messages only after the first `event_msg` `task_started` and ignoring text starting with `# AGENTS.md`. Tool calls are separate payload types, not message roles: `{"type":"custom_tool_call","name":"exec","call_id":"call_7f11...","input":"const r = await tools.exec_command({cmd:\"ls\",workdir:\"/tmp/wc-spike/repo-codex\"}); text(r.output);\n"}` then `{"type":"custom_tool_call_output", ...}` (output items `input_text`: "Script completed ... README.md"). Prose before the call ("I'll run `ls` now.") is an ordinary assistant `message`. The tool name here is `exec` with JS source in `input`, not a `function_call` with `arguments`; a renderer must handle both `custom_tool_call` and `function_call`. Turn markers: `event_msg` `task_started` and `task_complete` (with `last_agent_message`, `duration_ms`). PASS.

## 6. Turn end

`hook.log` after five turns per CLI in total (three in the first sessions, plus two in the permission-mode runs; the numbers below are the three-turn session):

Claude `Stop` stdin (one JSON object, trimmed):
```
{"session_id":"2e64e190-...","transcript_path":"/home/collin/.claude/projects/-home-collin-projects-personal-wheelchair/2e64e190-....jsonl","cwd":"...","prompt_id":"c93c7eb8-...","permission_mode":"auto","hook_event_name":"Stop","stop_hook_active":false,"last_assistant_message":"pong","background_tasks":[],"session_crons":[]}
```
Three turns, three `Stop` lines (03:52:50, 03:53:23, 03:53:54), one per turn, each with a different `prompt_id`. It names the session (`session_id`) and gives the transcript path and the final message. `Notification` also fired once, 60 seconds after the last turn: `{"hook_event_name":"Notification","message":"Claude is waiting for your input","notification_type":"idle_prompt"}`; it does not fire per turn.

Codex `notify` argv[2] (one JSON string):
```
{"type":"agent-turn-complete","thread-id":"01a1d9e7-8cde-...","turn-id":"01a1d9e8-1ea7-...","cwd":"/tmp/wc-spike/repo-codex","client":"codex-tui","input-messages":["Reply with the single word pong."],"last-assistant-message":"pong"}
```
Three real turns gave three lines for `thread-id ...14bdbd` (03:53:22, 03:53:51, 03:54:21), matching `task_complete` turn ids in the rollout. Also, once per session, a fourth line arrived at 03:53:23 with a different thread id (`...d67bf7`) whose `input-messages` is a title-generation prompt and whose reply is `{"title":"Reply with pong"}`. The service must match `thread-id` to the session's rollout and ignore others. The payload gives the thread id, cwd and last message but no transcript path. PARTIAL for that reason only.

## 7. Permission mode

Collin's default Claude mode is already `auto` (`"permission_mode":"auto"` in the first session's hook payload). Claude with `--permission-mode auto --add-dir /tmp/wc-spike/repo-auto`, asked to run `ls` and create `/tmp/wc-spike/repo-auto/made.txt`: no prompt, replied `ok`, file created. (It ran in the wheelchair repo cwd, since a fresh `/tmp` cwd would hit the trust dialog.) Codex `-s workspace-write -a never`, asked to run `ls` and `printf 'hi' > made.txt` in its cwd: no prompt, file created, replied `ok`. PASS for both. Only in-scope writes were tried; an out-of-sandbox write under Codex was not.

## Verdict

**Yes for both on chat and turn end; no for "no trust prompt" on Claude as the plan words it.**

- Chat from transcripts works for both, with the parsing rules above (Claude tool results are `user` entries; Codex has injected leading user entries and `custom_tool_call` items).
- Turn end works for both: Claude `Stop` once per turn with `session_id`, `transcript_path` and `last_assistant_message`; Codex `notify` once per turn with `thread-id`, `turn-id`, `last-assistant-message`, plus one internal title turn per session to be filtered by thread id.
- Bracketed paste plus Enter yields one turn for multi-line text in both.
- Wrong or incomplete in the Spec:
  - Codex: `-c 'projects."<path>".trust_level="trusted"'` does not suppress the prompt in 0.169.0; the inline-table form does.
  - Claude: no way found to pre-trust a worktree without writing `projects."<path>".hasTrustDialogAccepted` into `~/.claude.json`; ancestor trust is not inherited. "Freshly trusted worktree shows no trust prompt" is therefore unproven for Claude and the plan's Open Question should be raised: either the service writes that key, or Claude sessions use another route.
  - Codex rollout files are named with local time plus thread id and appear only after the first turn; Claude's is predictable from `--session-id`.
  - `notify` does not include the rollout path.

## T1b live checks (2026-11-14)

Scratch: `/tmp/wc-t1b/`. Claude Code v2.1.325, Codex v0.169.0. Panes were 200x50, tmux sessions `wc-t1b-*`, all started with `WHEELCHAIR_LANE=1`.

### 1. Claude trust dialog: PASS

Commands: `git init` + one empty commit in `/tmp/wc-t1b/claude-repo`; `tmux new-session -d -s wc-t1b-claude -x 200 -y 50 -c /tmp/wc-t1b/claude-repo -e WHEELCHAIR_LANE=1 "claude --session-id <uuid> --permission-mode auto"`; poll `tmux capture-pane -p` every 0.5 s. The dialog was in the pane on the 3rd poll (about 1.5 s). Full dialog text (the dialog opens with "No, exit" highlighted by `❯`):
```
──────────────────────────────────────────────────────────
 Accessing workspace:

 /tmp/wc-t1b/claude-repo

 Quick safety check: Is this a project you created or one
 you trust? (Like your own code, a well-known open
 source project, or work from your team). If not, take a
 moment to review what's in this folder first.

 Claude Code'll be able to read, edit, and execute files
 here.

 Security guide

 ❯ No, exit
   Yes, I trust this folder

 Enter to confirm · Esc to cancel
```
Keys: `tmux send-keys -t wc-t1b-claude Down`, then `tmux send-keys -t wc-t1b-claude Enter`. Down+Enter selected "Yes": the dialog was gone by the second poll after Enter and the session did not exit. A later capture contained no "trust this folder" and no "No, exit" (count 0). Ready screen:
```
 ▐▛███▛█   Claude Code v2.1.325
▝▜██████▀  Opus 5.5 with medium effort · Claude Team
 ▝▝   ▝▝   /tmp/wc-t1b/claude-repo
                                      ◐ medium · /effort
──────────────────────────────────────────────────────────
❯ Try "create a util logging.py that..."
──────────────────────────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle) · ← for agents
```
The input line is `❯ ` followed by a rotating `Try "..."` placeholder, so the placeholder text must not be matched; `auto mode on` and the `❯` line are stable. Message: `printf 'Reply with the single word pong.' | tmux load-buffer -`, `tmux paste-buffer -p -t wc-t1b-claude`, `tmux send-keys Enter`. Result after 12 s: `❯ Reply with the single word pong.` then `● pong`, then an empty `❯ ` prompt. Answered.

### 2. Claude already-trusted start: PASS

Killed the session and started a new one in the same repo with a new `--session-id`. No dialog appeared (no "trust this folder" or "No, exit" in any poll). Time from `tmux new-session` to `auto mode on` showing: 559 ms and 558 ms in two timed runs (0.1 s polling). One earlier timed run that waited for the exact string `❯ Try "` took 12.9 s; the pane was not captured, so the cause is unknown (a slow start or a placeholder that did not match). The ready test should use `auto mode on` plus a `❯` line, not the placeholder.

### 3. Codex ready screen: PASS

Commands: `/tmp/wc-t1b/notify.sh` appends `date +%T` and its second argument (the JSON) to `/tmp/wc-t1b/notify.log`; `tmux new-session -d -s wc-t1b-codex -x 200 -y 50 -c /tmp/wc-t1b/codex-repo -e WHEELCHAIR_LANE=1 "codex -s workspace-write -a never -c 'projects={\"/tmp/wc-t1b/codex-repo\"={trust_level=\"trusted\"}}' -c 'notify=[\"/tmp/wc-t1b/notify.sh\",\"codex\"]'"`. No trust menu. Ready screen after 8 s (banner art omitted):
```
  >_ OpenAI Codex (v0.169.0)
     /tmp/wc-t1b/codex-repo
...
› Ask Codex to do anything
  GPT-6-Sol high · /tmp/wc-t1b/codex-repo
  ← for agents                  ⚠ 2 warnings · f2 to view
```
Input box line: `› Ask Codex to do anything`. The `⚠ 2 warnings` line is a banner that waits for nothing.

Note: `notify` is called as `notify.sh codex '<json>'`, so the JSON is `$2`. My first script logged `$1` (`codex`) and lost the payloads (kept in `/tmp/wc-t1b/notify-bad.log`); I fixed the script and reran check 4 once with a new session.

### 4. Codex binding: PASS

Into a fresh `wc-t1b-codex` session: `printf '[wc:role] Reply with the single word ok.' | tmux load-buffer -`, `paste-buffer -p`, `send-keys Enter`, then 25 s. The pane showed `› [wc:role] Reply with the single word ok.` and `• ok`. `/tmp/wc-t1b/notify.log`:
```
05:18:31 {"type":"agent-turn-complete","thread-id":"01a1da35-84c6-7483-8e21-fdc4e62e0de8","turn-id":"01a1da35-a340-7fe1-9bde-7cf1d8142c29","cwd":"/tmp/wc-t1b/codex-repo","client":"codex-tui","input-messages":["[wc:role] Reply with the single word ok."],"last-assistant-message":"ok"}
05:18:32 {"type":"agent-turn-complete","thread-id":"01a1da35-a481-7003-8c2f-8d46782e8c7c","turn-id":"01a1da35-a49e-7bc2-898c-e8aa39f584cb","cwd":"/tmp/wc-t1b/codex-repo","client":"codex-tui","input-messages":["Generate a concise, single-line task title of at most 36 characters and under five words where possible. Start with ...
```
| thread-id | input-messages[0] starts | rollout file |
|---|---|---|
| `01a1da35-84c6-7483-8e21-fdc4e62e0de8` | `[wc:role] Reply with the single word ok.` | yes: `~/.codex/sessions/2026/11/14/rollout-2026-11-14T05-18-22-01a1da35-84c6-7483-8e21-fdc4e62e0de8.jsonl` |
| `01a1da35-a481-7003-8c2f-8d46782e8c7c` | `Generate a concise, single-line task title ...` | no (glob finds nothing) |

Exactly one notify satisfies both conditions; the title-turn notify fails both. The role-marked notify arrived one second before the title notify, and the rollout file existed once the first notify arrived. The matching `task_complete` turn id was not separately checked in the rollout.

### 5. Codex trust menu hides the input box: PASS

`/tmp/wc-t1b/codex-untrusted`, started with `codex -s workspace-write -a never` (no projects override) in `wc-t1b-codex2`. After 8 s the pane showed:
```
  Folder access
  /tmp/wc-t1b/codex-untrusted

  Trust this folder? Codex can read, edit, and run files here, subject to your permission settings. Folder settings can run code automatically, even without a model request. Continue only if you
  trust these files. Your trust decision will be saved.
› 1. Trust and continue
  2. Back to Agent Command Center

  enter continue · esc back
```
`› Ask Codex to do anything` was absent (grep count 0). Menu not answered; session killed. Note the menu's first line also begins with `›`, so a ready test must match the `Ask Codex to do anything` text, not the glyph.

### Verdict

Yes: D63 (`Down`, `Enter` on seeing "Yes, I trust this folder") and the Codex binding rule both work as the Spec says. Differences to note: (a) the Claude input line carries a rotating `Try "..."` placeholder, so "ready" must key on the absence of the dialog strings plus `auto mode on` / a `❯` line; (b) Codex's ready text is `Ask Codex to do anything` and its trust menu also starts with `›`; (c) `notify` receives the JSON as the second argument after the configured `codex`; (d) the title notify arrived one second after the role notify here.
