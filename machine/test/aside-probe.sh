#!/usr/bin/env bash
# Manual integration probe. Costs three model turns; leaves all evidence in /tmp.
set -uo pipefail
case ${1:-} in claude|codex) cli=$1;; *) echo 'Usage: bash machine/test/aside-probe.sh claude|codex'; exit 2;; esac
unset CLAUDE_CONFIG_DIR CODEX_HOME
root=$(cd "$(dirname "$0")/../.." && pwd)
dir=$(mktemp -d "${TMPDIR:-/tmp}/aside-probe-${cli}-XXXXXXXX")
session="aside-probe-$(basename "$dir")"
word="word$(openssl rand -hex 5)"
marker=ENDPROBEMARKER
answer_marker=FORKANSWER
parent=$(cat /proc/sys/kernel/random/uuid)
forkid=$(cat /proc/sys/kernel/random/uuid)
server="$root/machine/test/aside-probe-mcp.js"
log="$dir/probe.log"
fail=0
printf 'temp directory: %s\nsession: %s\ncode word: %s\n' "$dir" "$session" "$word"
cleanup() { tmux kill-session -t "$session" 2>/dev/null || :; }
trap cleanup EXIT
check() { if "$@"; then printf 'PASS %s\n' "$label"; else printf 'FAIL %s\n' "$label"; fail=1; fi; }
showargv() { printf '%s argv: ' "$1"; shift; printf '%q ' "$@"; printf '\n'; }
countlog() { if test -f "$log"; then wc -l < "$log"; else printf '0\n'; fi; }
cd "$dir" || exit 1
git init -q
if [ "$cli" = claude ]; then model=claude-sonnet-5-5; else model=gpt-6.1-terra; fi
node - "$dir" "$server" <<'NODE'
const fs=require('fs'),[d,s]=process.argv.slice(2);
fs.writeFileSync(d+'/settings.json',JSON.stringify({permissions:{allow:['Bash','Write','Edit','mcp__probe__*']},enableAllProjectMcpServers:true}));
NODE
if [ "$cli" = claude ]; then
  parentargs=(claude --session-id "$parent" --model "$model" --append-system-prompt 'Reply briefly.')
else
  trust="projects={\"$dir\"={trust_level=\"trusted\"}}"
  parentargs=(codex -m "$model" -c "$trust")
fi
showargv parent "${parentargs[@]}"
printf -v parentcmd '%q ' "${parentargs[@]}"
tmux new-session -d -s "$session" -c "$dir" "$parentcmd"
ready=0
for ((i=0;i<120;i++)); do
  pane=$(tmux capture-pane -p -t "$session" 2>/dev/null || :)
  if [[ $pane == *'Yes, I trust this folder'* ]]; then tmux send-keys -t "$session" Down Enter; fi
  if [[ $cli = claude && $pane == *'auto mode on'* && $pane == *'❯'* ]] || [[ $cli = codex && $pane == *'Ask Codex to do anything'* ]]; then ready=1; break; fi
  sleep 1
done
printf 'captured readiness pane:\n%s\n' "$pane"
label='parent readiness detection from captured pane'; check test "$ready" = 1
if [ "$ready" != 1 ]; then exit 1; fi
intro="End every reply with $marker."
prompt="What was the code word? Include $answer_marker in your answer. Try creating $dir/written-by-fork.txt first with a shell command (printf x > '$dir/written-by-fork.txt'), then with a file-writing tool, then an edit tool. Try calling probe_echo by whatever tool name it has, and try any mcp__codex_apps__* or claude.ai connector tool you believe you have using a read-only listing. Briefly report attempts."
resume_prompt="What did your previous answer say about the code word? Include its answer token."
if [ "$cli" = claude ]; then
  node - "$dir" "$server" "$log" <<'NODE'
const fs=require('fs'),[d,s,l]=process.argv.slice(2);
fs.writeFileSync(d+'/.mcp.json',JSON.stringify({mcpServers:{probe:{type:'stdio',command:'node',args:[s,l]}}}));
NODE
  before_control=$(countlog)
  claude --settings "$dir/settings.json" mcp list > "$dir/mcp-list.txt" 2>&1; control_exit=$?
  cat "$dir/mcp-list.txt"
  after_control=$(countlog)
  printf 'MCP control exit=%s lines before=%s after=%s\n' "$control_exit" "$before_control" "$after_control"
  label='Claude MCP positive control listed and started'; check bash -c 'test "$1" = 0 && grep -q "^probe:" "$2" && test "$3" -gt "$4" && grep -q "^start$" "$5"' _ "$control_exit" "$dir/mcp-list.txt" "$after_control" "$before_control" "$log"
  args=(-p --output-format json --model "$model" --permission-mode dontAsk --tools Read,Grep,Glob --strict-mcp-config --append-system-prompt "$intro" --system-prompt-snapshot off --settings "$dir/settings.json")
  showargv fork claude "${args[@]}" --resume "$parent" --fork-session --session-id "$forkid"
  showargv resume claude "${args[@]}" --resume "$forkid"
else
  overrides=(-c 'mcp_servers.probe.command="node"' -c "mcp_servers.probe.args=[\"$server\",\"$log\"]")
  codex "${overrides[@]}" mcp list --json > "$dir/mcp-list.json" 2> "$dir/mcp-list.err"; control_exit=$?
  cat "$dir/mcp-list.json" "$dir/mcp-list.err"
  label='Codex MCP positive control lists injected probe'; check bash -c 'test "$1" = 0 && node -e "const x=require(process.argv[1]);process.exit(Array.isArray(x)&&x.some(s=>s.name===\"probe\"&&s.enabled)?0:1)" "$2"' _ "$control_exit" "$dir/mcp-list.json"
  mapfile -t names < <(node -e 'for(const s of require(process.argv[1])) console.log(s.name)' "$dir/mcp-list.json")
  disable=(); for name in "${names[@]}"; do disable+=(-c "mcp_servers.$name.enabled=false"); done
  args=(exec -s read-only --json -m "$model" "${overrides[@]}" "${disable[@]}" --disable apps)
  showargv fork-template codex "${args[@]}" fork '<parent-thread-id>' -
  showargv resume-template codex "${args[@]}" resume '<fork-thread-id>' -
fi
if [ "$fail" != 0 ]; then echo 'Free gate failed; no paid turn started.'; exit 1; fi
printf 'parent stdin: The code word is %s. Reply only ok.\n' "$word"
printf 'fork stdin: %s\n' "$prompt"
printf 'resume stdin: %s\n' "$resume_prompt"
if [ "$cli" = codex ]; then printf 'fork stdin preamble: %s\n' "$intro"; fi
tmux send-keys -t "$session" -l "The code word is $word. Reply only ok."
sleep 1
tmux send-keys -t "$session" Enter
transcript=''
completed=0
for ((i=0;i<180;i++)); do
  if [ "$cli" = claude ]; then transcript=$(find "$HOME/.claude/projects" -name "$parent.jsonl" -print -quit 2>/dev/null); else transcript=$(find "$HOME/.codex/sessions" -name '*.jsonl' -mmin -5 -type f -print0 2>/dev/null | xargs -0 -r grep -l -F "$word" 2>/dev/null | while IFS= read -r file; do grep -qF "$dir" "$file" && printf '%s\n' "$file"; done | tail -1); fi
  if [ -n "$transcript" ] && node - "$transcript" "$cli" <<'NODE'
const fs=require('fs'),[p,cli]=process.argv.slice(2);const rows=fs.readFileSync(p,'utf8').split('\n').flatMap(x=>{try{return [JSON.parse(x)]}catch{return []}});process.exit(rows.some(x=>cli==='codex'?x.type==='event_msg'&&x.payload?.type==='task_complete':x.type==='assistant'&&x.message?.content?.some(c=>c.type==='text'&&/\bok\b/i.test(c.text)))?0:1);
NODE
  then completed=1; break; fi
  sleep 1
done
label='parent transcript and completed turn'; check bash -c 'test -n "$1" && test -f "$1" && test "$2" = 1' _ "$transcript" "$completed"
if [ "$fail" != 0 ]; then tmux capture-pane -p -t "$session"; exit 1; fi
if [ "$cli" = codex ]; then parent=$(basename "$transcript" .jsonl | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'); fi
printf 'parent id: %s\nparent transcript: %s\n' "$parent" "$transcript"
sha=$(sha256sum "$transcript"); size=$(wc -c < "$transcript")
printf 'parent before: sha256=%s size=%s\n' "$sha" "$size"
label='parent alive before fork'; check tmux has-session -t "$session"
if [ "$fail" != 0 ]; then exit 1; fi
before=$(countlog)
printf 'MCP log lines before fork: %s\n' "$before"
if [ "$cli" = claude ]; then
  showargv fork claude "${args[@]}" --resume "$parent" --fork-session --session-id "$forkid"
  printf '%s\n' "$prompt" | claude "${args[@]}" --resume "$parent" --fork-session --session-id "$forkid" > "$dir/fork.out" 2> "$dir/fork.err"; fork_exit=$?
  showargv resume claude "${args[@]}" --resume "$forkid"
  printf '%s\n' "$resume_prompt" | claude "${args[@]}" --resume "$forkid" > "$dir/resume.out" 2> "$dir/resume.err"; resume_exit=$?
else
  showargv fork codex "${args[@]}" fork "$parent" -
  printf '%s\n\n%s\n' "$intro" "$prompt" | codex "${args[@]}" fork "$parent" - > "$dir/fork.out" 2> "$dir/fork.err"; fork_exit=$?
  forkid=$(node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").split("\n")){try{const x=JSON.parse(l);if(x.type==="thread.started"){console.log(x.thread_id);break}}catch{}}' "$dir/fork.out")
  showargv resume codex "${args[@]}" resume "$forkid" -
  if [ -n "$forkid" ]; then printf '%s\n' "$resume_prompt" | codex "${args[@]}" resume "$forkid" - > "$dir/resume.out" 2> "$dir/resume.err"; resume_exit=$?; else : > "$dir/resume.out"; : > "$dir/resume.err"; resume_exit=1; fi
fi
after=$(countlog)
printf 'fork exit: %s\nresume exit: %s\nMCP log lines after resume: %s\n' "$fork_exit" "$resume_exit" "$after"
printf 'fork stdout:\n'; cat "$dir/fork.out"; printf '\nfork stderr:\n'; cat "$dir/fork.err"
printf '\nresume stdout:\n'; cat "$dir/resume.out"; printf '\nresume stderr:\n'; cat "$dir/resume.err"
extract='const fs=require("fs"),s=fs.readFileSync(process.argv[1],"utf8");try{if(process.argv[2]==="claude")console.log(JSON.parse(s).result||"");else {let a=s.trim().split("\n").map(x=>JSON.parse(x)).filter(x=>x.type==="item.completed"&&x.item?.type==="agent_message");console.log(a.at(-1)?.item.text||"")}}catch{}'
reply=$(node -e "$extract" "$dir/fork.out" "$cli"); resumed=$(node -e "$extract" "$dir/resume.out" "$cli")
printf '\nfork id: %s\nfork reply: %s\nresume reply: %s\n' "$forkid" "$reply" "$resumed"
printf 'parent after: sha256=%s size=%s\n' "$(sha256sum "$transcript")" "$(wc -c < "$transcript")"
label='fork and resume exit zero'; check bash -c 'test "$1" = 0 && test "$2" = 0' _ "$fork_exit" "$resume_exit"
label='fork remembers code word'; check grep -qiF "$word" <<< "$reply"
label='resume remembers fork answer'; check bash -c 'grep -qiF "$1" <<< "$3" && grep -qiF "$2" <<< "$3"' _ "$word" "$answer_marker" "$resumed"
label='parent hash unchanged'; check test "$(sha256sum "$transcript")" = "$sha"
label='parent size unchanged'; check test "$(wc -c < "$transcript")" = "$size"
label='parent alive after fork and resume'; check tmux has-session -t "$session"
label='reply and distinct fork id parsed'; check bash -c 'test -n "$1" && test -n "$2" && test -n "$3" && test "$3" != "$4"' _ "$reply" "$resumed" "$forkid" "$parent"
if [ "$cli" = claude ]; then
  label='Claude result JSON and session ids match passed ids'; check node -e 'const fs=require("fs");try{let a=JSON.parse(fs.readFileSync(process.argv[1])),b=JSON.parse(fs.readFileSync(process.argv[2]));process.exit(typeof a.result==="string"&&typeof b.result==="string"&&a.session_id===process.argv[3]&&b.session_id===process.argv[3]?0:1)}catch{process.exit(1)}' "$dir/fork.out" "$dir/resume.out" "$forkid"
else
  label='Codex event thread ids match on fork and resume'; check node -e 'const fs=require("fs");try{let ids=process.argv.slice(1,3).map(p=>fs.readFileSync(p,"utf8").trim().split("\n").map(JSON.parse).find(x=>x.type==="thread.started")?.thread_id);process.exit(ids.every(x=>x===process.argv[3])?0:1)}catch{process.exit(1)}' "$dir/fork.out" "$dir/resume.out" "$forkid"
fi
label='aside marker present'; check grep -qF "$marker" <<< "$reply"
label='write attempt file absent'; check test ! -e "$dir/written-by-fork.txt"
printf 'MCP log lines before=%s after=%s\n' "$before" "$after"
label='MCP log unchanged during fork and resume'; check test "$before" -eq "$after"
if [ "$cli" = codex ]; then
  node - "$dir/fork.out" "$dir/resume.out" <<'NODE'
const fs=require('fs');for(const f of process.argv.slice(2)){for(const line of fs.readFileSync(f,'utf8').split('\n')){try{const x=JSON.parse(line);if(x.type==='item.completed'&&['command_execution','mcp_tool_call'].includes(x.item?.type))console.log(f+' '+JSON.stringify(x.item))}catch{}}}
NODE
  label='Codex no successful MCP tool call events'; check node -e 'const fs=require("fs");try{let rows=process.argv.slice(1).flatMap(p=>fs.readFileSync(p,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse));process.exit(rows.some(x=>x.type==="item.completed"&&x.item?.type==="mcp_tool_call"&&x.item.status==="completed")?1:0)}catch{process.exit(1)}' "$dir/fork.out" "$dir/resume.out"
  label='Codex shell write refused by read-only sandbox (event and file absent)'; check node -e 'const fs=require("fs");try{let r=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);process.exit(!fs.existsSync(process.argv[2])&&r.some(x=>x.type==="item.completed"&&x.item?.type==="command_execution"&&x.item.command?.includes("written-by-fork.txt")&&x.item.exit_code!==0&&/read.only|permission denied|operation not permitted/i.test(x.item.aggregated_output||""))?0:1)}catch{process.exit(1)}' "$dir/fork.out" "$dir/written-by-fork.txt"
fi
forktrans=$(find "$HOME/.$([ "$cli" = claude ] && printf claude/projects || printf codex/sessions)" -name "*$forkid.jsonl" -print -quit 2>/dev/null)
printf 'fork transcript: %s\n' "${forktrans:-not found}"
exit "$fail"
