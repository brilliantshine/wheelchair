#!/usr/bin/env bash
# Render the workflow entry points into both harnesses, and install the viewer's deps. Idempotent.
#
# The wrappers are rendered rather than symlinked because a wrapper has to name an ABSOLUTE path: a
# command runs with some other repo as its working directory, so a relative path resolves nowhere.
# The repo therefore cannot contain a real path — it carries the {{WHEELCHAIR_ROOT}} placeholder and
# this script substitutes wherever the clone actually is. Editing anything under protocol/ still
# takes effect immediately in both harnesses, because the rendered wrapper points back into this
# working tree. Editing a wrapper itself needs a re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p ~/.claude/skills ~/.codex/prompts

render() {  # render <source> <destination>
  sed "s|{{WHEELCHAIR_ROOT}}|$ROOT|g" "$1" > "$2"
}

for s in "$ROOT"/skills/*/; do
  name="$(basename "$s")"
  # An earlier version symlinked these. Clear the link before writing a real directory.
  [ -L ~/.claude/skills/"$name" ] && rm ~/.claude/skills/"$name"
  mkdir -p ~/.claude/skills/"$name"
  render "$s/SKILL.md" ~/.claude/skills/"$name"/SKILL.md
  echo "claude skill: /$name"
done

for p in "$ROOT"/codex/prompts/*.md; do
  name="$(basename "$p")"
  [ -L ~/.codex/prompts/"$name" ] && rm ~/.codex/prompts/"$name"
  render "$p" ~/.codex/prompts/"$name"
  echo "codex prompt: /$(basename "$name" .md)"
done

npm --prefix "$ROOT/viewer" install
echo "viewer deps: installed"

npx --prefix "$ROOT/viewer" playwright install chromium
echo "viewer chromium: installed"
