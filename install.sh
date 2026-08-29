#!/usr/bin/env bash
# Render the workflow entry points into both harnesses, and install the viewer's deps. Idempotent.
#
# The wrappers are rendered rather than symlinked because a wrapper has to name an ABSOLUTE path: a
# command runs with some other repo as its working directory, so a relative path resolves nowhere.
# The repo therefore cannot contain a real path — it carries the {{WHEELCHAIR_ROOT}} placeholder and
# this script substitutes wherever the clone actually is. Editing anything under protocol/ still
# takes effect immediately in both harnesses, because the rendered wrapper points back into this
# working tree. Editing a wrapper itself needs a re-run.
#
# One thing here is rendered rather than pointed at, so editing it DOES need a re-run: the
# delimited region of protocol/sensitivity.md that the last step writes into ~/.claude/CLAUDE.md
# and ~/.codex/AGENTS.md. Those two files sit outside this tree; only the bytes between the markers
# are this repo's, and only they are overwritten. /diagram-sensitivity drives the same writer, so a
# re-run of this script is not the only way to move the dial.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

claude_home=${WHEELCHAIR_CLAUDE_HOME:-"$HOME/.claude"}
codex_home=${WHEELCHAIR_CODEX_HOME:-"$HOME/.codex"}

# Testing seam: when set (including to empty), this replaces PATH detection.
if [[ ${WHEELCHAIR_PRESENT+x} ]]; then
  case ",$WHEELCHAIR_PRESENT," in *,claude,*) claude_present=1 ;; *) claude_present=0 ;; esac
  case ",$WHEELCHAIR_PRESENT," in *,codex,*) codex_present=1 ;; *) codex_present=0 ;; esac
else
  command -v claude >/dev/null 2>&1 && claude_present=1 || claude_present=0
  command -v codex >/dev/null 2>&1 && codex_present=1 || codex_present=0
fi

if (( ! claude_present && ! codex_present )); then
  printf '%s: neither claude nor codex is on PATH; installed nothing\n' "${0##*/}" >&2
  exit 1
fi

(( claude_present )) && printf 'harness found: claude\n'
(( codex_present )) && printf 'harness found: codex\n'

render() {  # render <source> <destination>
  sed "s|{{WHEELCHAIR_ROOT}}|$ROOT|g" "$1" > "$2"
}

if (( claude_present )); then
  mkdir -p "$claude_home/skills"
  for s in "$ROOT"/skills/*/; do
    name="$(basename "$s")"
    # An earlier version symlinked these. Clear the link before writing a real directory.
    [ -L "$claude_home/skills/$name" ] && rm "$claude_home/skills/$name"
    mkdir -p "$claude_home/skills/$name"
    render "$s/SKILL.md" "$claude_home/skills/$name/SKILL.md"
    echo "claude skill: /$name"
  done
fi

if (( codex_present )); then
  mkdir -p "$codex_home/prompts"
  for p in "$ROOT"/codex/prompts/*.md; do
    name="$(basename "$p")"
    [ -L "$codex_home/prompts/$name" ] && rm "$codex_home/prompts/$name"
    render "$p" "$codex_home/prompts/$name"
    echo "codex prompt: /$(basename "$name" .md)"
  done
fi

# Testing seam: setting this to 1 skips the viewer dependency installs.
if [[ ${WHEELCHAIR_SKIP_DEPS:-} == 1 ]]; then
  echo "viewer deps: skipped"
  echo "viewer chromium: skipped"
else
  npm --prefix "$ROOT/viewer" install
  echo "viewer deps: installed"

  npx --prefix "$ROOT/viewer" playwright install chromium
  echo "viewer chromium: installed"
fi

if "$ROOT/sensitivity/set.sh"; then
  echo "diagram sensitivity: installed"
else
  echo "diagram sensitivity: warning — not installed" >&2
fi
