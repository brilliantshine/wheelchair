# T0b: second live agy 1.5.9 check

## 1. Workspace trust

A fresh untrusted workspace displayed a trust question; Enter accepted the selected “Yes, I trust this folder”, followed by the idle screen and Auto banner. Both `agy --dangerously-skip-permissions --settings '{"trustedWorkspaces":["/tmp/t0b-agy/inline"]}'` and the same command with `--settings /tmp/t0b-agy/settings.json` (containing `{"trustedWorkspaces":["/tmp/t0b-agy/file"]}`) skipped the question; neither directory appeared in the real settings' trustedWorkspaces afterward. Evidence: `trust-prompt.txt`, `trust-after.txt`, `trust-inline.txt`, `trust-file.txt`. The manually accepted directories did appear in the real list.

## 2. Multiline first message

Pasting immediately after the idle prompt appeared, with the Auto banner visible, sent the entire role and blank-line-separated instruction as one message and yielded `ok`. Evidence: `role-multiline.txt`, `stop-role.json` (the exact `lastUserInput`).

## 3. Hook environment

The Stop hook inherited `WHEELCHAIR_SESSION_NAME=t0b-test`. Evidence: `stop-role.json`; the scratch hook recorded its stdin and environment, and checking the environment lines for that exact variable returned `True`. The environment dump was not committed. The temporary global hooks file was moved to `/tmp/t0b-agy/hooks-used.json` after the checks.

## 4. Tools and second turn

Stop fired once for each of the three main-session user messages, with the same transcriptPath throughout; the file accumulated all three turns. Evidence: `stop-role.json`, `stop-tools.json`, `stop-second.json`, `turns.txt`, `transcript-tools.jsonl`. Tool calls appear in `PLANNER_RESPONSE.tool_calls` with `name` and `args`; results appear in `GENERIC.content`; final assistant text appears in `PLANNER_RESPONSE.content`.

The hook's transcriptPath is itself `transcript_full.jsonl`. Its logs directory contained `chunks/`, `transcript_full.jsonl` (3255 bytes), and `transcript.jsonl` (3274 bytes); both JSONL files had the same 10 step indices and row types, but their bytes differed. This check does not establish whether one contains additional fields or content.

## 5. Permission prompt

`--mode accept-edits` prompted for `ls -la`. Enter approves the selected option 1; option 4 is “No, cancel” (navigate down three times and Enter), and Esc cancels. Enter was used and the command ran. Evidence: `permission-prompt.txt`, `permission-after.txt`. Default and plan modes were not needed for this item.

## 6. Interactive plan mode

`--mode plan` requested permission to run `ls -la` while preparing the plan; Esc interrupted it and `y.txt` was absent. With `--mode plan --dangerously-skip-permissions`, it ran `ls`, created an implementation plan artifact, and requested review; `y.txt` was still absent. Evidence: `plan-mode.txt`, `plan-after-escape.txt`, `plan-skip.txt`; `ls -la /tmp/t0b-agy/plan/y.txt /tmp/t0b-agy/planskip/y.txt` reported both absent. This single prompt does not prove enforcement for every plan-mode action.

## 7. Instruction files

Both `AGENTS.md` and `GEMINI.md` independently produced replies ending in PINEAPPLE in fresh repositories. Evidence: `instruction-agents.txt`, `instruction-gemini.txt`; each repo contained only its named instruction file with the specified line.

## 8. Error Stop

`--model no-such-model` warned that the model was unrecognized and fell back to Gemini 3.8 Flash (High); the subsequent turn succeeded with `NO_TOOL_CALL`, so no error Stop was obtained. Evidence: `error-model.txt`; the hook's scratch capture recorded an empty error and `NO_TOOL_CALL` for that turn.

## 9. Exit

Typing `/exit` and Enter cleanly ended the trust session: `tmux has-session -t t0b-agy-trust` returned `can't find session: t0b-agy-trust`, exit 1. Remaining test sessions were killed during cleanup.

## Files changed

Added the T0b fixtures listed in `machine/test/fixtures/agy/README.md`, updated that README, and wrote this report. No production code changed.

## Validation

The grep command below was run exactly as requested; its display uses bracket expressions to prevent the report itself matching the search.

```text
$ ls machine/test/fixtures/agy/
README.md
after-aside.txt
aside.json
auto-commands.txt
error-model.txt
help.txt
idle.txt
instruction-agents.txt
instruction-gemini.txt
login-bad.txt
login-link-joined.txt
login-link-wrapped.txt
login-menu.txt
login-success.txt
models-help.txt
models-signed-in.txt
models-signed-out.txt
permission-after.txt
permission-prompt.txt
plan-after-escape.txt
plan-mode.txt
plan-output.json.txt
plan-skip.txt
role-multiline.txt
stop-role.json
stop-second.json
stop-tools.json
stop.json
transcript-tools.jsonl
transcript.jsonl
trust-after.txt
trust-file.txt
trust-inline.txt
trust-prompt.txt
turns.txt
```

```text
$ grep -rIiE 'ya29\.|1[/][/]0|refresh[_]token|access[_]token|@gmail\.com' machine/test/fixtures/agy/ docs/plans/antigravity-cli/reports/T0b.md
```

```text
$ agy models; echo "exit=$?"
Fetching available models...
gemini-3.8-flash-high	Gemini 3.8 Flash (High)
gemini-3.8-flash-medium	Gemini 3.8 Flash (Medium)
gemini-3.8-flash-low	Gemini 3.8 Flash (Low)
claude-sonnet-4-6	Claude Sonnet 4.6 (Thinking)
claude-opus-4-6-thinking	Claude Opus 4.6 (Thinking)
gpt-oss-120b-medium	GPT-OSS 120B (Medium)
exit=0
```

```text
$ ls /home/collin/.gemini/config/
config.json
mcp_config.json
projects
```

```text
$ tmux ls | grep '^t0b-agy' || echo "no t0b sessions left"
no t0b sessions left
```

```text
$ git status --short
 M machine/test/fixtures/agy/README.md
?? docs/plans/antigravity-cli/reports/T0b.md
?? machine/test/fixtures/agy/error-model.txt
?? machine/test/fixtures/agy/instruction-agents.txt
?? machine/test/fixtures/agy/instruction-gemini.txt
?? machine/test/fixtures/agy/permission-after.txt
?? machine/test/fixtures/agy/permission-prompt.txt
?? machine/test/fixtures/agy/plan-after-escape.txt
?? machine/test/fixtures/agy/plan-mode.txt
?? machine/test/fixtures/agy/plan-skip.txt
?? machine/test/fixtures/agy/role-multiline.txt
?? machine/test/fixtures/agy/stop-role.json
?? machine/test/fixtures/agy/stop-second.json
?? machine/test/fixtures/agy/stop-tools.json
?? machine/test/fixtures/agy/transcript-tools.jsonl
?? machine/test/fixtures/agy/trust-after.txt
?? machine/test/fixtures/agy/trust-file.txt
?? machine/test/fixtures/agy/trust-inline.txt
?? machine/test/fixtures/agy/trust-prompt.txt
?? machine/test/fixtures/agy/turns.txt
```

## Choices

- `error-model.txt`: sent one small turn after the invalid-model warning to observe its Stop payload.
