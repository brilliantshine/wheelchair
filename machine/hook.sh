#!/usr/bin/env bash
# The CLI hook bridge.  See PLAN.md "Machine service on the hub": it carries a
# session token, never the machine secret, and spools if its local service is down.
set -euo pipefail

kind=${1:?usage: hook.sh claude\|codex\|agy [session-name] [codex-notify-json]}
root=$(cd "$(dirname "$0")/.." && pwd)
state=${WHEELCHAIR_STATE_DIR:-"$HOME/.local/state/wheelchair"}
token=${WHEELCHAIR_SESSION_TOKEN:-}

if [[ -z "$token" ]]; then
  exit 0
fi

case "$kind" in
  claude|pi)
    session=${2:?usage: hook.sh claude session-name}
    payload=$(cat)
    ;;
  codex)
    session=${2:?usage: hook.sh codex session-name [codex-notify-json]}
    # Codex appends the notify JSON after configured arguments.  The Spec's
    # configured [hook, codex, session-name] form therefore puts it last ($3).
    payload=${!#}
    ;;
  agy)
    session=${2:-${WHEELCHAIR_SESSION_NAME:-}}
    [[ -n "$session" ]] || exit 0
    payload=$(cat)
    ;;
  *)
    exit 64
    ;;
esac

printf '%s' "$payload" | node "$root/machine/lib/hook-post.js" "$state" "$token" "$kind" "$session"
