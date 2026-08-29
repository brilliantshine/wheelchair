#!/usr/bin/env bash
# Render the diagram-sensitivity block into both global harness files.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_file="$root/protocol/sensitivity.md"
start_marker='<!-- wheelchair:diagram-sensitivity start -->'
end_marker='<!-- wheelchair:diagram-sensitivity end -->'
level_pattern='^diagram-sensitivity: (ask|default|high)$'
claude_home=${WHEELCHAIR_CLAUDE_HOME:-"$HOME/.claude"}
codex_home=${WHEELCHAIR_CODEX_HOME:-"$HOME/.codex"}
claude_target="$claude_home/CLAUDE.md"
codex_target="$codex_home/AGENTS.md"

# Testing seam: when set (including to empty), this replaces PATH detection.
if [[ ${WHEELCHAIR_PRESENT+x} ]]; then
  case ",$WHEELCHAIR_PRESENT," in *,claude,*) claude_present=1 ;; *) claude_present=0 ;; esac
  case ",$WHEELCHAIR_PRESENT," in *,codex,*) codex_present=1 ;; *) codex_present=0 ;; esac
else
  command -v claude >/dev/null 2>&1 && claude_present=1 || claude_present=0
  command -v codex >/dev/null 2>&1 && codex_present=1 || codex_present=0
fi

targets=()
(( claude_present )) && targets+=("$claude_target")
(( codex_present )) && targets+=("$codex_target")

usage_refusal() {
  local given=${*:-'<none>'}
  printf '%s: unsupported argument(s): %s (levels: ask, default, high)\n' "${0##*/}" "$given" >&2
  exit 2
}

mode=write
requested=''
case $# in
  0) ;;
  1)
    case $1 in
      ask|default|high) requested=$1 ;;
      --report) mode=report ;;
      *) usage_refusal "$1" ;;
    esac
    ;;
  *) usage_refusal "$@" ;;
esac

declare -A state levels starts ends start_lines end_lines

# Set state[path] to absent, valid, or malformed.  A malformed block is never
# interpreted as a partial installation: the caller must repair it by hand.
inspect() {
  local path=$1 start_count end_count start_line end_line level_count level
  starts[$path]=0
  ends[$path]=0
  state[$path]=absent
  levels[$path]=''
  [[ -e $path ]] || return 0

  start_count=$(grep -Fxc "$start_marker" "$path" || true)
  end_count=$(grep -Fxc "$end_marker" "$path" || true)
  starts[$path]=$start_count
  ends[$path]=$end_count
  if (( start_count == 0 && end_count == 0 )); then
    return 0
  fi
  if (( start_count != 1 || end_count != 1 )); then
    state[$path]=malformed
    return 0
  fi

  start_line=$(grep -Fnx "$start_marker" "$path" | cut -d: -f1)
  end_line=$(grep -Fnx "$end_marker" "$path" | cut -d: -f1)
  start_lines[$path]=$start_line
  end_lines[$path]=$end_line
  if (( start_line >= end_line )); then
    state[$path]=malformed
    return 0
  fi

  level_count=$(awk -v first="$start_line" -v last="$end_line" \
    'NR > first && NR < last && $0 ~ /^diagram-sensitivity: (ask|default|high)$/ { count++ } END { print count + 0 }' "$path")
  if (( level_count != 1 )); then
    state[$path]=malformed
    levels[$path]="$level_count level line(s)"
    return 0
  fi
  level=$(awk -v first="$start_line" -v last="$end_line" \
    'NR > first && NR < last && $0 ~ /^diagram-sensitivity: (ask|default|high)$/ { sub(/^diagram-sensitivity: /, ""); print; exit }' "$path")
  state[$path]=valid
  levels[$path]=$level
}

describe_malformed() {
  local path=$1
  if [[ ${levels[$path]} == *' level line(s)' ]]; then
    printf '%s: malformed diagram-sensitivity block in %s: %s found\n' \
      "${0##*/}" "$path" "${levels[$path]}" >&2
  else
    printf '%s: malformed diagram-sensitivity markers in %s: %s start marker(s), %s end marker(s)\n' \
      "${0##*/}" "$path" "${starts[$path]}" "${ends[$path]}" >&2
  fi
}

for target in "${targets[@]}"; do
  inspect "$target"
done

if [[ $mode == report ]]; then
  (( claude_present )) || printf 'diagram-sensitivity: claude is not on this machine\n'
  (( codex_present )) || printf 'diagram-sensitivity: codex is not on this machine\n'
  for target in "${targets[@]}"; do
    if [[ ${state[$target]} == malformed ]]; then
      describe_malformed "$target"
      exit 1
    fi
  done
  if (( ${#targets[@]} == 0 )); then
    exit 0
  fi
  dial_installed=0
  for target in "${targets[@]}"; do
    [[ ${state[$target]} == valid ]] && dial_installed=1
  done
  if (( ! dial_installed )); then
    printf 'diagram-sensitivity dial is not installed; run ./install.sh\n'
    exit 0
  fi
  if (( ${#targets[@]} == 2 )) && [[ ${state[$claude_target]} == valid && ${state[$codex_target]} == valid && ${levels[$claude_target]} != "${levels[$codex_target]}" ]]; then
    printf '%s: diagram-sensitivity levels disagree: %s is %s; %s is %s\n' \
      "${0##*/}" "$claude_target" "${levels[$claude_target]}" "$codex_target" "${levels[$codex_target]}" >&2
    exit 1
  fi
  for target in "${targets[@]}"; do
    if [[ ${state[$target]} == valid ]]; then
      printf 'diagram-sensitivity: %s\n' "${levels[$target]}"
      exit 0
    fi
  done
fi

if (( ${#targets[@]} == 0 )); then
  printf 'diagram-sensitivity: neither claude nor codex is on this machine; nothing written\n'
  exit 0
fi

# Validate the source before anything is created.  Its own level line is part of
# the same fixed format as the installed copies.
if [[ ! -f $source_file ]]; then
  printf '%s: missing source region: %s\n' "${0##*/}" "$source_file" >&2
  exit 1
fi
inspect "$source_file"
if [[ ${state[$source_file]} != valid ]]; then
  describe_malformed "$source_file"
  exit 1
fi

for target in "${targets[@]}"; do
  if [[ ${state[$target]} == malformed ]]; then
    describe_malformed "$target"
    exit 1
  fi
done

override="$codex_home/AGENTS.override.md"
if (( codex_present )) && [[ -s $override ]]; then
  printf '%s: refusing while non-empty override exists: %s\n' "${0##*/}" "$override" >&2
  exit 1
fi

if [[ -n $requested ]]; then
  resolved=$requested
else
  resolved=''
  for target in "${targets[@]}"; do
    if [[ ${state[$target]} == valid ]]; then
      if [[ -n $resolved && $resolved != "${levels[$target]}" ]]; then
        printf '%s: diagram-sensitivity levels disagree: %s is %s; %s is %s; pass ask, default, or high explicitly\n' \
          "${0##*/}" "${targets[0]}" "${levels[${targets[0]}]}" "$target" "${levels[$target]}" >&2
        exit 1
      fi
      resolved=${levels[$target]}
    fi
  done
  [[ -n $resolved ]] || resolved=default
fi

# Do not touch either file until every condition common to the pair is known.
for target in "${targets[@]}"; do
  if [[ -e $target && ! -w $target ]]; then
    printf '%s: target is not writable: %s\n' "${0##*/}" "$target" >&2
    exit 1
  fi
done
for target in "${targets[@]}"; do
  directory=${target%/*}
  if ! mkdir -p -- "$directory" || [[ ! -w $directory ]]; then
    printf '%s: target directory cannot be created or written: %s\n' "${0##*/}" "$directory" >&2
    exit 1
  fi
done

rendered=$(mktemp)
cleanup_paths=("$rendered")
cleanup() { rm -f -- "${cleanup_paths[@]}"; }
trap cleanup EXIT

sed -n "${start_lines[$source_file]},${end_lines[$source_file]}p" "$source_file" |
  sed "s|{{WHEELCHAIR_ROOT}}|$root|g" |
  sed -E "s/^diagram-sensitivity: (ask|default|high)$/diagram-sensitivity: $resolved/" > "$rendered"

declare -A output backup existed
for target in "${targets[@]}"; do
  directory=${target%/*}
  output[$target]=$(mktemp "$directory/.wheelchair-sensitivity.XXXXXX")
  cleanup_paths+=("${output[$target]}")
  if [[ -e $target ]]; then existed[$target]=1; else existed[$target]=0; fi
  if [[ ${state[$target]} == valid ]]; then
    head -n "$(( ${start_lines[$target]} - 1 ))" "$target" > "${output[$target]}"
    cat "$rendered" >> "${output[$target]}"
    tail -n "+$(( ${end_lines[$target]} + 1 ))" "$target" >> "${output[$target]}"
  elif [[ -e $target && -s $target ]]; then
    cat "$target" > "${output[$target]}"
    if [[ $(tail -c 1 "$target" | od -An -t x1) == *0a* ]]; then
      printf '\n' >> "${output[$target]}"
    else
      printf '\n\n' >> "${output[$target]}"
    fi
    cat "$rendered" >> "${output[$target]}"
  else
    cat "$rendered" > "${output[$target]}"
  fi
  if [[ ${existed[$target]} == 1 ]]; then
    backup[$target]=$(mktemp "$directory/.wheelchair-sensitivity-backup.XXXXXX")
    cleanup_paths+=("${backup[$target]}")
    cp -p -- "$target" "${backup[$target]}"
  fi
done

restore() {
  local target=$1
  if [[ ${existed[$target]} == 1 ]]; then
    mv -f -- "${backup[$target]}" "$target" || true
  else
    rm -f -- "$target"
  fi
}

written=()
for target in "${targets[@]}"; do
  if ! mv -f -- "${output[$target]}" "$target"; then
    for restored in "${written[@]}"; do restore "$restored"; done
    printf '%s: could not write %s; restored prior target(s)\n' "${0##*/}" "$target" >&2
    exit 1
  fi
  written+=("$target")
done

if (( ${#targets[@]} == 1 )); then
  printf 'diagram-sensitivity: set %s in %s\n' "$resolved" "${targets[0]}"
else
  printf 'diagram-sensitivity: set %s in %s and %s\n' "$resolved" "${targets[0]}" "${targets[1]}"
fi
