#!/bin/bash
set -euo pipefail

if [ "$(uname -s)" != Darwin ]; then
  echo 'macOS check requires Darwin' >&2
  exit 2
fi

step=1
tmp=$(mktemp -d "${TMPDIR:-/tmp}/wheelchair-macos.XXXXXXXX")
name="wc-macos-check-$$-worker"
secret=''
started=0
cleanup() {
  if [ "$started" -eq 1 ]; then
    curl -fsS --max-time 5 -X DELETE -H "x-wheelchair-machine-secret: $secret" "http://127.0.0.1:7374/v1/sessions/$name" >/dev/null 2>&1 || true
    tmux kill-session -t "$name" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp"
}
trap cleanup EXIT
fail() { echo "step $step failed" >&2; exit 1; }
ok() { echo "step $step passed"; step=$((step + 1)); }
wait_status() {
  local seconds=$1 i=0
  while [ "$i" -lt "$seconds" ]; do
    if curl -fsS --max-time 1 -H "x-wheelchair-machine-secret: $secret" http://127.0.0.1:7374/v1/status >/dev/null 2>&1; then return 0; fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}
domain="gui/$(id -u)"
launchctl print "$domain/com.wheelchair.viewer" >/dev/null 2>&1 || fail
launchctl print "$domain/com.wheelchair.machine" >/dev/null 2>&1 || fail
ok
secret_file=$(python3 -c 'import json,os; print(json.load(open(os.path.expanduser("~/.local/state/wheelchair/machine.json")))["secret_file"])') || fail
secret=$(cat "$secret_file") || fail
ready=0
for ((i=0; i<60; i++)); do
  if curl -fsS --max-time 1 http://127.0.0.1:7373/wheelchair >/dev/null 2>&1 && curl -fsS --max-time 1 -H "x-wheelchair-machine-secret: $secret" http://127.0.0.1:7374/v1/status >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || fail
ok
git init -q "$tmp/repo" || fail
python3 - "$tmp/repo" "$name" > "$tmp/request.json" <<'PY'
import json, sys
json.dump({'role': 'worker', 'cli': 'claude', 'thread_id': 'macos-check', 'token': 'macos-check', 'worktree': sys.argv[1], 'name': sys.argv[2]}, sys.stdout)
PY
started=1
curl -fsS --max-time 30 -H "x-wheelchair-machine-secret: $secret" -H 'Content-Type: application/json' --data-binary "@$tmp/request.json" http://127.0.0.1:7374/v1/sessions >/dev/null || fail
ready=0
for ((i=0; i<30; i++)); do
  if tmux has-session -t "$name" 2>/dev/null; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || fail
ok
launchctl kickstart -k "$domain/com.wheelchair.machine" >/dev/null 2>&1 || fail
wait_status 60 || fail
tmux has-session -t "$name" 2>/dev/null || fail
ok
pid=$(launchctl print "$domain/com.wheelchair.machine" | awk '$1 == "pid" && $2 == "=" {print $3; exit}') || fail
[ -n "$pid" ] || fail
kill -KILL "$pid" || fail
ready=0
for ((i=0; i<30; i++)); do
  new_pid=$(launchctl print "$domain/com.wheelchair.machine" 2>/dev/null | awk '$1 == "pid" && $2 == "=" {print $3; exit}') || true
  if [ -n "$new_pid" ] && [ "$new_pid" != "$pid" ] && curl -fsS --max-time 1 -H "x-wheelchair-machine-secret: $secret" http://127.0.0.1:7374/v1/status >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || fail
ok
curl -fsS --max-time 30 -H "x-wheelchair-machine-secret: $secret" http://127.0.0.1:7374/v1/diagram-sensitivity > "$tmp/sensitivity.json" || fail
python3 - "$tmp/sensitivity.json" > "$tmp/level.json" <<'PY' || fail
import json, sys
level = json.load(open(sys.argv[1]))['level']
if level not in ('ask', 'default', 'high'):
    sys.exit(1)
json.dump({'level': level}, sys.stdout)
PY
curl -fsS --max-time 35 -H "x-wheelchair-machine-secret: $secret" -H 'Content-Type: application/json' --data-binary "@$tmp/level.json" http://127.0.0.1:7374/v1/diagram-sensitivity >/dev/null || fail
ok
mkdir "$tmp/codex" || fail
python3 - "$tmp/codex/auth.json" <<'PY' || fail
import base64, json, sys, time
payload = base64.urlsafe_b64encode(json.dumps({'exp': int(time.time()) + 30 * 86400}).encode()).decode().rstrip('=')
with open(sys.argv[1], 'w') as f:
    json.dump({'tokens': {'access_token': 'fake.' + payload + '.fake'}}, f)
PY
CODEX_HOME="$tmp/codex" bash codex/preflight.sh > "$tmp/preflight.log" 2>&1 || fail
ok
