#!/usr/bin/env bash
# Each case owns temporary harness homes; this suite never writes the live ones.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
installer=${INSTALL_SH:-"$repo/install.sh"}
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT

passes=0
failures=0
pass() { printf 'PASS %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
assert() {
  local description=$1
  shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}

tree_state() {
  local root=$1 item rel
  [[ -e $root ]] || { printf absent; return; }
  while IFS= read -r -d '' item; do
    rel=${item#"$root"}
    if [[ -L $item ]]; then
      printf 'L\0%s\0%s\0' "$rel" "$(readlink "$item")"
    elif [[ -f $item ]]; then
      printf 'F\0%s\0' "$rel"
      sha256sum "$item" | awk '{print $1}'
    elif [[ -d $item ]]; then
      printf 'D\0%s\0' "$rel"
    else
      printf 'O\0%s\0' "$rel"
    fi
  done < <(find "$root" -print0 | sort -z) | sha256sum | awk '{print $1}'
}

file_state() {
  if [[ -e $1 ]]; then printf 'present:%s' "$(sha256sum "$1" | awk '{print $1}')"; else printf absent; fi
}

claude_wrappers_landed() {
  local home=$1 source name destination
  for source in "$repo"/skills/*/SKILL.md; do
    name=$(basename "$(dirname "$source")")
    destination="$home/skills/$name/SKILL.md"
    [[ -f $destination ]] || return 1
    sed "s|{{WHEELCHAIR_ROOT}}|$repo|g" "$source" | cmp -s - "$destination" || return 1
  done
}

codex_wrappers_landed() {
  local home=$1 source name destination
  for source in "$repo"/codex/prompts/*.md; do
    name=$(basename "$source")
    destination="$home/prompts/$name"
    [[ -f $destination ]] || return 1
    sed "s|{{WHEELCHAIR_ROOT}}|$repo|g" "$source" | cmp -s - "$destination" || return 1
  done
}

both_wrappers_landed() {
  claude_wrappers_landed "$1" && codex_wrappers_landed "$2"
}

declare -A claude codex present output status
new_case() {
  local name=$1 base
  base=$fixture/$name
  claude[$name]=$base/claude
  codex[$name]=$base/codex
}
run_case() {
  local name=$1
  set +e
  output[$name]=$(HOME="$fixture/sandbox-home" WHEELCHAIR_PRESENT="${present[$name]}" WHEELCHAIR_SKIP_DEPS=1 WHEELCHAIR_CLAUDE_HOME="${claude[$name]}" WHEELCHAIR_CODEX_HOME="${codex[$name]}" "$installer" 2>&1)
  status[$name]=$?
  set -e
}

real_claude_before=$(file_state "$HOME/.claude/CLAUDE.md")
real_codex_before=$(file_state "$HOME/.codex/AGENTS.md")

new_case claude_only
present[claude_only]=claude
run_case claude_only
assert 'claude-only install succeeds and reports Claude' bash -c '[[ $1 == 0 && $2 == *"harness found: claude"* ]]' _ "${status[claude_only]}" "${output[claude_only]}"
assert 'claude-only install renders every substituted Claude wrapper' claude_wrappers_landed "${claude[claude_only]}"
assert 'claude-only install does not create the absent Codex home' test ! -e "${codex[claude_only]}"

new_case codex_only
present[codex_only]=codex
run_case codex_only
assert 'codex-only install succeeds and reports Codex' bash -c '[[ $1 == 0 && $2 == *"harness found: codex"* ]]' _ "${status[codex_only]}" "${output[codex_only]}"
assert 'codex-only install renders every substituted Codex wrapper' codex_wrappers_landed "${codex[codex_only]}"
assert 'codex-only install does not create the absent Claude home' test ! -e "${claude[codex_only]}"

new_case neither
present[neither]=''
run_case neither
assert 'neither harness exits non-zero and names both missing commands' bash -c '[[ $1 != 0 && $2 == *"neither claude nor codex is on PATH"* ]]' _ "${status[neither]}" "${output[neither]}"
assert 'neither harness writes no homes' bash -c '[[ ! -e $1 && ! -e $2 ]]' _ "${claude[neither]}" "${codex[neither]}"

new_case both_idempotent
present[both_idempotent]=claude,codex
run_case both_idempotent
first_claude=$(tree_state "${claude[both_idempotent]}")
first_codex=$(tree_state "${codex[both_idempotent]}")
run_case both_idempotent
assert 'both harnesses render every substituted wrapper' both_wrappers_landed "${claude[both_idempotent]}" "${codex[both_idempotent]}"
assert 'a second install is idempotent' bash -c '[[ $1 == 0 && $2 == "$3" && $4 == "$5" ]]' _ "${status[both_idempotent]}" "$(tree_state "${claude[both_idempotent]}")" "$first_claude" "$(tree_state "${codex[both_idempotent]}")" "$first_codex"

assert 'real CLAUDE.md is byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_claude_before" "$(file_state "$HOME/.claude/CLAUDE.md")"
assert 'real AGENTS.md is byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_codex_before" "$(file_state "$HOME/.codex/AGENTS.md")"

printf 'RESULT %d passed, %d failed\n' "$passes" "$failures"
(( failures == 0 ))
