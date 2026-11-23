#!/usr/bin/env bash
# CLI hook bridge: retain stdin for the manifest-directed transport.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
state=${WHEELCHAIR_STATE_DIR:-"$HOME/.local/state/wheelchair"}
token=${WHEELCHAIR_SESSION_TOKEN:-}
[[ -n "$token" ]] || exit 0
exec node "$root/machine/lib/hook-in.js" "$state" "$token" "$@"
