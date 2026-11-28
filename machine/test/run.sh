#!/usr/bin/env bash
set -euo pipefail
hooks_file="$HOME/.gemini/config/hooks.json"
hooks_state() {
  if [[ -e "$hooks_file" || -L "$hooks_file" ]]; then
    printf 'present:'
    node -e 'const fs = require("node:fs"), crypto = require("node:crypto"); process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"));' "$hooks_file"
  else
    printf 'absent'
  fi
}
before=$(hooks_state)
node --test "$(dirname "$0")"/*.test.js
after=$(hooks_state)
if [[ "$before" != "$after" ]]; then
  printf 'machine test suite modified %s (%s -> %s)\n' "$hooks_file" "$before" "$after" >&2
  exit 1
fi
