#!/usr/bin/env bash
# Manual integration probe: uses real accounts and paid turns. Leaves evidence in /tmp.
set -uo pipefail
case ${1:-} in claude|codex) cli=$1;; *) echo 'Usage: bash machine/test/aside-probe.sh claude|codex'; exit 2;; esac
unset CLAUDE_CONFIG_DIR CODEX_HOME
root=$(cd "$(dirname "$0")/../.." && pwd)
dir=$(mktemp -d "${TMPDIR:-/tmp}/aside-probe-${cli}-XXXXXXXX")
session="aside-probe-$(basename "$dir")"
word="word$(openssl rand -hex 5)"
marker=ENDPROBEMARKER
parent=$(cat /proc/sys/kernel/random/uuid)
forkid=$(cat /proc/sys/kernel/random/uuid)
fail=0
printf 'temp directory: %s\nsession: %s\ncode word: %s\n' "$dir" "$session" "$word"
cleanup() { tmux kill-session -t "$session" 2>/dev/null || :; }
trap cleanup EXIT
check() { if "$@"; then printf 'PASS %s\n' "$label"; else printf 'FAIL %s\n' "$label"; fail=1; fi; }
cd "$dir" || exit 1
git init -q
model=$(/home/collin/projects/personal/wheelchair/codex/model.sh "$([ "$cli" = claude ] && printf claude || printf gpt)" standard)
server="$root/machine/test/aside-probe-mcp.js"
node - "$server" <<'NODE'
const fs=require('fs'); const server=process.argv[2];
fs.writeFileSync('.mcp.json',JSON.stringify({mcpServers:{probe:{type:'stdio',command:'node',args:[server]}}}));
fs.writeFileSync('settings.json',JSON.stringify({permissions:{allow:['Bash','Write','Edit','mcp__probe__*']},enableAllProjectMcpServers:true}));
NODE
if [ "$cli" = claude ]; then
  tmux new-session -d -s "$session" -c "$dir" "claude --session-id '$parent' --model '$model' --append-system-prompt 'Reply briefly.'"
else
  trust="projects={\"$dir\"={trust_level=\"trusted\"}}"
  tmux new-session -d -s "$session" -c "$dir" "codex -m '$model' -c '$trust'"
fi
ready=0
for ((i=0;i<120;i++)); do
  pane=$(tmux capture-pane -p -t "$session" 2>/dev/null || :)
  if [[ $pane == *'Yes, I trust this folder'* ]]; then tmux send-keys -t "$session" Down Enter; fi
  if [[ $pane == *'New MCP server found in this project'* ]]; then tmux send-keys -t "$session" Enter; fi
  if [[ $cli = claude && $pane == *'auto mode on'* && $pane == *'❯'* ]] || [[ $cli = codex && $pane == *'Ask Codex to do anything'* ]]; then ready=1; break; fi
  sleep 1
done
label='parent ready'; check test "$ready" = 1
if [ "$ready" != 1 ]; then printf 'pane:\n%s\n' "$pane"; exit 1; fi
tmux send-keys -t "$session" -l "The code word is $word. Reply only ok."
sleep 1
tmux send-keys -t "$session" Enter
transcript=''
for ((i=0;i<180;i++)); do
  if [ "$cli" = claude ]; then transcript=$(find "$HOME/.claude/projects" -name "$parent.jsonl" -print -quit 2>/dev/null); else transcript=$(find "$HOME/.codex/sessions" -name '*.jsonl' -mmin -5 -type f -print0 2>/dev/null | xargs -0 -r grep -l -F "$word" 2>/dev/null | while IFS= read -r file; do grep -qF "$dir" "$file" && printf '%s\n' "$file"; done | tail -1); fi
  if [ -n "$transcript" ] && grep -q -i '"ok"\|"ok[.!]' "$transcript"; then break; fi
  sleep 1
done
label='parent transcript and completed turn'; check bash -c 'test -n "$1" && grep -qi "\"ok\"\|\"ok[.!]" "$1"' _ "$transcript"
if [ "$fail" != 0 ]; then tmux capture-pane -p -t "$session"; exit 1; fi
if [ "$cli" = codex ]; then parent=$(basename "$transcript" .jsonl | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'); fi
printf 'parent id: %s\nparent transcript: %s\n' "$parent" "$transcript"
sha=$(sha256sum "$transcript"); size=$(wc -c < "$transcript")
label='parent alive before fork'; check tmux has-session -t "$session"
intro="End every reply with $marker."
prompt="What was the code word? Then try to create the file $dir/written-by-fork.txt with any tool you have. List the names of every tool you have, including MCP tools."
if [ "$cli" = claude ]; then
  claude --settings "$dir/settings.json" mcp list > "$dir/mcp-list.txt" 2>&1 || :
  cat "$dir/mcp-list.txt"
  args=(-p --output-format json --model "$model" --permission-mode dontAsk --tools Read,Grep,Glob --strict-mcp-config --append-system-prompt "$intro" --settings "$dir/settings.json")
  printf 'fork argv: '; printf '%q ' claude "${args[@]}" --resume "$parent" --fork-session --session-id "$forkid"; printf '\n'
  printf '%s\n' "$prompt" | claude "${args[@]}" --resume "$parent" --fork-session --session-id "$forkid" > "$dir/fork.out" 2> "$dir/fork.err"; echo "fork exit: $?"
  printf '%s\n' 'What did you answer in your previous reply about the code word?' | claude "${args[@]}" --resume "$forkid" > "$dir/resume.out" 2> "$dir/resume.err"; echo "resume exit: $?"
else
  overrides=(-c 'mcp_servers.probe.command="node"' -c "mcp_servers.probe.args=[\"$server\"]")
  codex "${overrides[@]}" mcp list --json > "$dir/mcp-list.json" 2> "$dir/mcp-list.err"
  cat "$dir/mcp-list.json" "$dir/mcp-list.err"
  if ! node -e 'const x=require(process.argv[1]);process.exit(Array.isArray(x)&&x.some(s=>s.name==="probe")?0:1)' "$dir/mcp-list.json"; then echo 'FAIL injected MCP server is not listed; stop and contact lead'; exit 1; fi
  mapfile -t names < <(node -e 'for(const s of require(process.argv[1])) console.log(s.name)' "$dir/mcp-list.json")
  disable=(); for name in "${names[@]}"; do disable+=(-c "mcp_servers.$name.enabled=false"); done
  args=(exec -s read-only --json -m "$model" "${overrides[@]}" "${disable[@]}")
  printf 'fork argv: '; printf '%q ' codex "${args[@]}" fork "$parent" -; printf '\n'
  printf '%s\n\n%s\n' "$intro" "$prompt" | codex "${args[@]}" fork "$parent" - > "$dir/fork.out" 2> "$dir/fork.err"; echo "fork exit: $?"
  printf '%s\n' 'What did you answer in your previous reply about the code word?' | codex "${args[@]}" resume "$(node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").trim().split("\n")){try{const x=JSON.parse(l);if(x.type==="thread.started")console.log(x.thread_id)}catch{}}' "$dir/fork.out")" - > "$dir/resume.out" 2> "$dir/resume.err"; echo "resume exit: $?"
  forkid=$(node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").trim().split("\n")){try{const x=JSON.parse(l);if(x.type==="thread.started")console.log(x.thread_id)}catch{}}' "$dir/fork.out")
fi
printf 'fork stdout:\n'; cat "$dir/fork.out"; printf '\nfork stderr:\n'; cat "$dir/fork.err"
printf '\nresume stdout:\n'; cat "$dir/resume.out"; printf '\nresume stderr:\n'; cat "$dir/resume.err"
extract='const fs=require("fs"),s=fs.readFileSync(process.argv[1],"utf8");try{if(process.argv[2]==="claude")console.log(JSON.parse(s).result||"");else {let a=s.trim().split("\n").map(x=>JSON.parse(x)).filter(x=>x.type==="item.completed"&&x.item?.type==="agent_message");console.log(a.at(-1)?.item.text||"")}}catch{}'
reply=$(node -e "$extract" "$dir/fork.out" "$cli"); resumed=$(node -e "$extract" "$dir/resume.out" "$cli")
printf '\nfork id: %s\nfork reply: %s\nresume reply: %s\n' "$forkid" "$reply" "$resumed"
label='fork remembers code word'; check grep -qiF "$word" <<< "$reply"
label='resume remembers fork answer'; check grep -qiF "$word" <<< "$resumed"
label='parent hash unchanged'; check test "$(sha256sum "$transcript")" = "$sha"
label='parent size unchanged'; check test "$(wc -c < "$transcript")" = "$size"
label='parent alive after fork and resume'; check tmux has-session -t "$session"
label='reply and distinct fork id extracted'; check test -n "$reply" -a -n "$resumed" -a -n "$forkid" -a "$forkid" != "$parent"
label='aside marker present'; check grep -qF "$marker" <<< "$reply"
label='write file absent'; check test ! -e "$dir/written-by-fork.txt"
label='no MCP tool named in reply'; check bash -c '! grep -Eqi "mcp__|probe_echo" <<< "$1"' _ "$reply"
if [ "$cli" = claude ]; then
  label='no forbidden built-in tools in reply'; check bash -c '! grep -Eqi "(^|[^a-z])(bash|write|edit)([^a-z]|$)" <<< "$1"' _ "$reply"
  label='project MCP control listed'; check grep -qi 'probe' "$dir/mcp-list.txt"
else
  label='sandbox refused write (explicit evidence)'; check grep -Eqi 'permission denied|read.only|operation not permitted' "$dir/fork.out"
fi
forktrans=$(find "$HOME/.$([ "$cli" = claude ] && printf claude/projects || printf codex/sessions)" -name "*$forkid.jsonl" -print -quit 2>/dev/null)
printf 'fork transcript: %s\n' "$forktrans"
exit "$fail"
