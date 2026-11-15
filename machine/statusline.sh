#!/usr/bin/env bash
# Display even when the service or its spool is unavailable.
kind=${1:-claude}
session=${2:-}
root=$(cd "$(dirname "$0")/.." && pwd)
node "$root/machine/lib/statusline.js" "$kind" "$session" || true
exit 0
