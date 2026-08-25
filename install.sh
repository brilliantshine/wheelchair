#!/usr/bin/env bash
# Symlink the workflow entry points into both harnesses. Idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p ~/.claude/skills ~/.codex/prompts

for s in "$ROOT"/skills/*/; do
  name="$(basename "$s")"
  ln -sfn "${s%/}" ~/.claude/skills/"$name"
  echo "claude skill: /$name"
done

for p in "$ROOT"/codex/prompts/*.md; do
  ln -sfn "$p" ~/.codex/prompts/"$(basename "$p")"
  echo "codex prompt: /$(basename "$p" .md)"
done

npm --prefix "$ROOT/viewer" install
echo "viewer deps: installed"

npx --prefix "$ROOT/viewer" playwright install chromium
echo "viewer chromium: installed"
