#!/usr/bin/env bash
# Read-only router-document scanner.  It intentionally has no write operations.
set -euo pipefail

if (( $# != 1 )); then
  printf 'usage: %s <directory>\n' "${0##*/}" >&2
  exit 2
fi

if [[ ! -e $1 || ! -d $1 ]]; then
  printf '%s: not an existing directory: %s\n' "${0##*/}" "$1" >&2
  exit 2
fi

target=$(realpath "$1")

# Print a shell string as a JSON string.  Work byte-wise so every JSON control
# character is escaped; ordinary UTF-8 bytes remain unchanged.
json_string() {
  local value=$1 char code escaped='' i
  LC_ALL=C
  for ((i = 0; i < ${#value}; i++)); do
    char=${value:i:1}
    printf -v code '%d' "'$char"
    case $char in
      '"') escaped+='\"' ;;
      \\) escaped+='\\' ;;
      $'\b') escaped+='\b' ;;
      $'\t') escaped+='\t' ;;
      $'\n') escaped+='\n' ;;
      $'\f') escaped+='\f' ;;
      $'\r') escaped+='\r' ;;
      *)
        if (( code < 32 )); then
          printf -v char '\u%04x' "$code"
          escaped+=$char
        else
          escaped+=$char
        fi
        ;;
    esac
  done
  printf '"%s"' "$escaped"
}

json_array_strings() {
  local first=1 value
  printf '['
  for value in "$@"; do
    (( first )) || printf ','
    json_string "$value"
    first=0
  done
  printf ']'
}

relative_to_target() {
  local path=$1
  if [[ $path == "$target" ]]; then
    printf '.'
  elif [[ $path == "$target"/* ]]; then
    printf '%s' "${path#"$target"/}"
  else
    printf '%s' "$path"
  fi
}

inside_target() {
  [[ $1 == "$target" || $1 == "$target"/* ]]
}

git_toplevel=''
if git_toplevel=$(git -C "$target" rev-parse --show-toplevel 2>/dev/null); then
  git_toplevel=$(realpath "$git_toplevel")
else
  # A refusal is still useful JSON.  Only immediate child directories can be
  # repositories or worktree hubs for this report.
  repositories=()
  hubs_json=()
  shopt -s nullglob dotglob
  for child in "$target"/*; do
    [[ -d $child ]] || continue
    base=${child##*/}
    [[ $base == . || $base == .. ]] && continue
    child_real=$(realpath "$child")
    child_top=''
    if child_top=$(git -C "$child" rev-parse --show-toplevel 2>/dev/null) && [[ $(realpath "$child_top") == "$child_real" ]]; then
      repositories+=("$base")
    fi
    if [[ -e $child/.repo.git || -L $child/.repo.git ]]; then
      lanes=()
      for lane in "$child"/*; do
        [[ -d $lane ]] || continue
        lane_base=${lane##*/}
        [[ $lane_base == . || $lane_base == .. || $lane_base == .repo.git || $lane_base == .* ]] && continue
        lanes+=("$lane_base")
      done
      hub_entry=$(printf '{"path":'; json_string "$base"; printf ',"lanes":'; json_array_strings "${lanes[@]}"; printf '}')
      hubs_json+=("$hub_entry")
    fi
  done
  shopt -u nullglob dotglob

  printf '{"target":'
  json_string "$target"
  printf ',"gitToplevel":null,"ok":false,"refusal":{"reason":"target is not inside a git repository","repositories":'
  json_array_strings "${repositories[@]}"
  printf ',"hubs":['
  for ((i = 0; i < ${#hubs_json[@]}; i++)); do
    (( i == 0 )) || printf ','
    printf '%s' "${hubs_json[i]}"
  done
  printf ']},"directories":[],"excluded":[]}\n'
  exit 1
fi

directories_json=''
excluded_json=''

emit_headings() {
  local file=$1 line first=1
  printf '['
  while IFS= read -r line || [[ -n $line ]]; do
    if [[ $line =~ ^#{1,6}\  ]]; then
      (( first )) || printf ','
      json_string "$line"
      first=0
    fi
  done < "$file"
  printf ']'
}

emit_directory() {
  local dir=$1 rel candidate name resolved='' broken outside=0 skip='' first=1
  local -a names=() resolves=() broken_flags=() outside_flags=()
  local -A seen=()
  local real_count=0 identical=false diff_lines=null write_target=null
  local -a unmanaged=() notes=()

  rel=$(relative_to_target "$dir")
  for name in AGENTS.md CLAUDE.md; do
    candidate=$dir/$name
    [[ -e $candidate || -L $candidate ]] || continue
    names+=("$name")
    resolved=''
    broken=false
    outside=false
    if [[ -L $candidate && ! -f $candidate ]]; then
      broken=true
      skip=${skip:-"$name is a broken symlink"}
    elif resolved=$(realpath "$candidate" 2>/dev/null) && [[ -f $resolved ]]; then
      if ! inside_target "$resolved"; then
        outside=true
        skip=${skip:-"$name resolves outside target"}
      fi
      if [[ -z ${seen[$resolved]+yes} ]]; then
        seen[$resolved]=1
        resolves+=("$resolved")
      fi
    else
      broken=true
      [[ -L $candidate ]] && skip=${skip:-"$name is a broken symlink"}
    fi
    broken_flags+=("$broken")
    outside_flags+=("$outside")
  done
  real_count=${#resolves[@]}

  for name in GEMINI.md .cursorrules; do
    [[ -e $dir/$name || -L $dir/$name ]] && unmanaged+=("$name")
  done

  # Do not read an external link target.  Resolution is enough to identify the
  # unsafe condition, and the directory is skipped before any possible write.
  if [[ -z $skip && $real_count -eq 1 ]]; then
    write_target=$(relative_to_target "${resolves[0]}")
  elif [[ -z $skip && $real_count -eq 2 ]]; then
    if cmp -s "${resolves[0]}" "${resolves[1]}"; then
      identical=true
      notes+=("two byte-identical routing files — duplicate, consolidate")
      diff_lines=0
    else
      identical=false
      diff_lines=0
      while IFS= read -r line || [[ -n $line ]]; do
        [[ $line == +++* || $line == ---* ]] && continue
        [[ $line == +* || $line == -* ]] && diff_lines=$((diff_lines + 1))
      done < <(diff -u "${resolves[0]}" "${resolves[1]}" || true)
      notes+=("two real routing files differ — the prompt must propose which is the router")
    fi
  fi
  [[ -n $skip ]] && notes+=("$skip")

  printf '{"path":'
  json_string "$rel"
  printf ',"candidates":['
  for ((i = 0; i < ${#names[@]}; i++)); do
    (( i == 0 )) || printf ','
    name=${names[i]}
    candidate=$dir/$name
    printf '{"name":'
    json_string "$name"
    printf ',"isSymlink":%s,"resolves":' "$([[ -L $candidate ]] && printf true || printf false)"
    if [[ ${broken_flags[i]} == true ]]; then
      printf 'null'
    else
      resolved=$(realpath "$candidate")
      json_string "$(relative_to_target "$resolved")"
    fi
    printf ',"broken":%s,"resolvesOutsideTarget":%s,"size":' "${broken_flags[i]}" "${outside_flags[i]}"
    if [[ ${broken_flags[i]} == true || ${outside_flags[i]} == true ]]; then
      printf 'null'
    else
      resolved=$(realpath "$candidate")
      stat -c %s "$resolved"
    fi
    printf ',"headings":'
    if [[ ${broken_flags[i]} == true || ${outside_flags[i]} == true ]]; then
      printf '[]'
    else
      resolved=$(realpath "$candidate")
      emit_headings "$resolved"
    fi
    printf '}'
  done
  printf '],"realCount":%d,"writeTarget":' "$real_count"
  if [[ $write_target == null ]]; then printf 'null'; else json_string "$write_target"; fi
  printf ',"identical":%s,"diffLines":' "$identical"
  [[ $diff_lines == null ]] && printf null || printf '%s' "$diff_lines"
  printf ',"skipped":'
  [[ -n $skip ]] && json_string "$skip" || printf null
  printf ',"unmanagedSurfaces":'
  json_array_strings "${unmanaged[@]}"
  printf ',"notes":'
  json_array_strings "${notes[@]}"
  printf '}'
}

emit_excluded() {
  local dir=$1 reason=$2
  printf '{"path":'
  json_string "$(relative_to_target "$dir")"
  printf ',"reason":'
  json_string "$reason"
  printf '}'
}

walk() {
  local dir=$1 child base child_top entry
  entry=$(emit_directory "$dir")
  if [[ -n $directories_json ]]; then directories_json+=','; fi
  directories_json+=$entry
  shopt -s nullglob dotglob
  for child in "$dir"/*; do
    [[ -d $child ]] || continue
    base=${child##*/}
    [[ $base == . || $base == .. ]] && continue
    if git -C "$target" check-ignore -q -- "$child" 2>/dev/null; then
      entry=$(emit_excluded "$child" git-ignored)
      if [[ -n $excluded_json ]]; then excluded_json+=','; fi
      excluded_json+=$entry
    elif [[ $base == .* ]]; then
      entry=$(emit_excluded "$child" dotted)
      if [[ -n $excluded_json ]]; then excluded_json+=','; fi
      excluded_json+=$entry
    elif child_top=$(git -C "$child" rev-parse --show-toplevel 2>/dev/null) && [[ $(realpath "$child_top") != "$git_toplevel" ]]; then
      entry=$(emit_excluded "$child" 'nested repository')
      if [[ -n $excluded_json ]]; then excluded_json+=','; fi
      excluded_json+=$entry
    else
      walk "$child"
    fi
  done
  shopt -u nullglob dotglob
}

printf '{"target":'
json_string "$target"
printf ',"gitToplevel":'
json_string "$git_toplevel"
printf ',"ok":true,"refusal":null,"directories":['
walk "$target"
printf '%s],"excluded":[%s]}' "$directories_json" "$excluded_json"
printf '\n'
