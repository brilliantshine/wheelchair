#!/usr/bin/env bash
set -u
for tool in tmux git claude codex; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'missing required tool: %s\n' "$tool" >&2
    exit 2
  fi
done
exec node "$(dirname "$0")/live.js" "$@"
