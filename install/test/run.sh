#!/usr/bin/env bash
# Each case owns temporary harness homes and command shims; this suite never writes live state.
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

last_line_is() { [[ ${1##*$'\n'} == "$2" ]]; }

declare -A home claude codex shim present output status tty display input args dns loginctl_status node_stop_status tailscale_absent
new_case() {
  local name=$1 base
  base=$fixture/$name
  home[$name]=$base/home
  claude[$name]=${home[$name]}/claude
  codex[$name]=${home[$name]}/codex
  shim[$name]=$base/shims
  present[$name]=claude,codex
  tty[$name]=0
  display[$name]=0
  input[$name]=''
  args[$name]=''
  dns[$name]=fixture.tailnet.ts.net.
  loginctl_status[$name]=0
  node_stop_status[$name]=0
  tailscale_absent[$name]=0
  mkdir -p "${home[$name]}" "${shim[$name]}"
  install_shims "$name"
}

install_shims() {
  local name=$1 dir=${shim[$1]}
cat > "$dir/node" <<'EOF'
#!/usr/bin/env bash
printf 'node %s\n' "$*" >> "$WHEELCHAIR_SHIM_LOG"
stop=0 stale=0 url=0
for argument in "$@"; do
  [[ $argument == --stop ]] && stop=1
  [[ $argument == --if-stale ]] && stale=1
  [[ $argument == --url ]] && url=1
done
(( stop && stale )) && exit "${WHEELCHAIR_NODE_STOP_STATUS:-0}"
(( url )) && printf '%s\n' 'https://fixture.tailnet.ts.net/?token=fixture'
EOF
  cat > "$dir/systemctl" <<'EOF'
#!/usr/bin/env bash
printf 'systemctl %s\n' "$*" >> "$WHEELCHAIR_SHIM_LOG"
EOF
  cat > "$dir/loginctl" <<'EOF'
#!/usr/bin/env bash
printf 'loginctl %s\n' "$*" >> "$WHEELCHAIR_SHIM_LOG"
exit "${WHEELCHAIR_LOGINCTL_STATUS:-0}"
EOF
  cat > "$dir/tailscale" <<'EOF'
#!/usr/bin/env bash
printf 'tailscale %s\n' "$*" >> "$WHEELCHAIR_SHIM_LOG"
if [[ $1 == status && $2 == --json ]]; then
  printf '{"Self":{"DNSName":"%s"}}\n' "${WHEELCHAIR_TAILSCALE_DNS-fixture.tailnet.ts.net.}"
elif [[ $1 == serve && $2 == status ]]; then
  [[ ${WHEELCHAIR_TAILSCALE_SERVING:-0} == 1 ]] && printf 'https://fixture/ proxy http://127.0.0.1:7373\n'
fi
EOF
  cat > "$dir/sudo" <<'EOF'
#!/usr/bin/env bash
printf 'sudo %s\n' "$*" >> "$WHEELCHAIR_SHIM_LOG"
"$@"
EOF
  chmod +x "$dir/node" "$dir/systemctl" "$dir/loginctl" "$dir/tailscale" "$dir/sudo"
}

run_case() {
  local name=$1
  local command_path=$PATH
  if [[ ${tailscale_absent[$name]} == 1 ]]; then
    local tool
    for tool in awk basename bash cat cp cut dirname grep head mkdir mktemp od rm sed tail uname; do
      ln -sf "/usr/bin/$tool" "${shim[$name]}/$tool"
    done
    command_path=${shim[$name]}
    rm -f "${shim[$name]}/tailscale"
  fi
  local -a command=(env -u DISPLAY -u WAYLAND_DISPLAY
    "HOME=${home[$name]}" "USER=fixture-user" "PATH=${shim[$name]}:$command_path"
    "WHEELCHAIR_SHIM_LOG=${home[$name]}/commands.log"
    "WHEELCHAIR_PRESENT=${present[$name]}" WHEELCHAIR_SKIP_DEPS=1
    "WHEELCHAIR_CLAUDE_HOME=${claude[$name]}" "WHEELCHAIR_CODEX_HOME=${codex[$name]}"
    "WHEELCHAIR_TTY=${tty[$name]}" "WHEELCHAIR_TAILSCALE_DNS=${dns[$name]}"
    "WHEELCHAIR_LOGINCTL_STATUS=${loginctl_status[$name]}"
    "WHEELCHAIR_NODE_STOP_STATUS=${node_stop_status[$name]}")
  [[ ${display[$name]} == 1 ]] && command+=(DISPLAY=:fixture)
  set +e
  output[$name]=$(printf '%s' "${input[$name]}" | "${command[@]}" "$installer" ${args[$name]} 2>&1)
  status[$name]=$?
  set -e
}

serving_path() { printf '%s/.cache/agent-graphs/.serving' "${home[$1]}"; }
unit_path() { printf '%s/.config/systemd/user/wheelchair-viewer.service' "${home[$1]}"; }
log_path() { printf '%s/commands.log' "${home[$1]}"; }
seed_serving() {
  local name=$1
  mkdir -p "${home[$name]}/.cache/agent-graphs"
  printf '{"serve": true, "origin": "https://fixture.tailnet.ts.net"}\n' > "$(serving_path "$name")"
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
assert 'neither harness does not run the stale-viewer check' test ! -e "$(log_path neither)"

new_case both_idempotent
run_case both_idempotent
first_claude=$(tree_state "${claude[both_idempotent]}")
first_codex=$(tree_state "${codex[both_idempotent]}")
run_case both_idempotent
assert 'both harnesses render every substituted wrapper' both_wrappers_landed "${claude[both_idempotent]}" "${codex[both_idempotent]}"
assert 'a second install is idempotent' bash -c '[[ $1 == 0 && $2 == "$3" && $4 == "$5" ]]' _ "${status[both_idempotent]}" "$(tree_state "${claude[both_idempotent]}")" "$first_claude" "$(tree_state "${codex[both_idempotent]}")" "$first_codex"

new_case headless_yes
tty[headless_yes]=1
input[headless_yes]=$'y\nn\n'
run_case headless_yes
assert 'headless yes records a served origin' cmp -s <(printf '{"serve": true, "origin": "https://fixture.tailnet.ts.net"}\n') "$(serving_path headless_yes)"
assert 'headless yes asks before opting in' bash -c '[[ $1 == *"set up this machine as an always-on viewer?"* ]]' _ "${output[headless_yes]}"

new_case headless_no
tty[headless_no]=1
input[headless_no]=$'n\n'
run_case headless_no
run_case headless_no
assert 'headless no records a persistent decline' cmp -s <(printf '{"serve": false}\n') "$(serving_path headless_no)"
assert 'headless no does not ask again' bash -c '[[ $1 != *"set up this machine as an always-on viewer?"* ]]' _ "${output[headless_no]}"

new_case no_terminal
run_case no_terminal
assert 'headless non-terminal run leaves the choice open' test ! -e "$(serving_path no_terminal)"
assert 'headless non-terminal run says why' bash -c '[[ $1 == *"no display and no terminal"* ]]' _ "${output[no_terminal]}"

new_case explicit_serve
args[explicit_serve]=--serve
run_case explicit_serve
assert '--serve sets up serving without the opt-in prompt' bash -c '[[ $1 == 0 && $2 != *"set up this machine"* ]]' _ "${status[explicit_serve]}" "${output[explicit_serve]}"
assert '--serve calls the systemd reload enable and restart sequence' bash -c 'grep -Fxq "systemctl --user daemon-reload" "$1" && grep -Fxq "systemctl --user enable --now wheelchair-viewer.service" "$1" && grep -Fxq "systemctl --user restart wheelchair-viewer.service" "$1"' _ "$(log_path explicit_serve)"

new_case no_serve
args[no_serve]=--no-serve
seed_serving no_serve
mkdir -p "${home[no_serve]}/.config/systemd/user" "${home[no_serve]}/.cache/agent-graphs"
printf 'unit\n' > "$(unit_path no_serve)"
printf 'kept\n' > "${home[no_serve]}/.cache/agent-graphs/.token"
run_case no_serve
assert '--no-serve records false instead of removing the choice' cmp -s <(printf '{"serve": false}\n') "$(serving_path no_serve)"
assert '--no-serve stops and removes the user unit but keeps the token' bash -c '[[ ! -e $1 && -f $2 ]] && grep -Fxq "systemctl --user disable --now wheelchair-viewer.service" "$3"' _ "$(unit_path no_serve)" "${home[no_serve]}/.cache/agent-graphs/.token" "$(log_path no_serve)"
assert '--no-serve tells the person how to disable Tailscale Serve' bash -c '[[ $1 == *"sudo tailscale serve --https=443 off"* ]]' _ "${output[no_serve]}"

new_case serving_rerun
seed_serving serving_rerun
run_case serving_rerun
assert 'a serving re-run asks nothing' bash -c '[[ $1 != *"set up this machine"* ]]' _ "${output[serving_rerun]}"
assert 'a serving re-run keeps its served origin' cmp -s <(printf '%s\n' '{"serve": true, "origin": "https://fixture.tailnet.ts.net"}') "$(serving_path serving_rerun)"
assert 'a serving re-run restarts the service' grep -Fxq 'systemctl --user restart wheelchair-viewer.service' "$(log_path serving_rerun)"

new_case stop_order
display[stop_order]=1
run_case stop_order
assert 'every successful harness check runs stale-viewer stop first' bash -c '[[ $(head -n 1 "$1") == "node $2/viewer/server.js --stop --if-stale" ]]' _ "$(log_path stop_order)" "$repo"

new_case stop_failure
display[stop_failure]=1
node_stop_status[stop_failure]=1
run_case stop_failure
assert 'a stale-viewer stop failure warns and installation finishes' bash -c '[[ $1 == 0 && $2 == *"viewer: warning — could not stop the running viewer"* ]]' _ "${status[stop_failure]}" "${output[stop_failure]}"

new_case display_present
display[display_present]=1
run_case display_present
assert 'a display records a declined serving choice' cmp -s <(printf '%s\n' '{"serve": false}') "$(serving_path display_present)"
assert 'a display declines serving without asking' bash -c '[[ $1 != *"set up this machine"* ]]' _ "${output[display_present]}"

new_case tailscale_missing
args[tailscale_missing]=--serve
tailscale_absent[tailscale_missing]=1
run_case tailscale_missing
assert 'missing tailscale writes no serving decision' test ! -e "$(serving_path tailscale_missing)"
assert 'missing tailscale explains why setup was skipped' bash -c '[[ $1 == *"tailscale is not installed"* ]]' _ "${output[tailscale_missing]}"

new_case tailscale_empty_name
args[tailscale_empty_name]=--serve
dns[tailscale_empty_name]=''
run_case tailscale_empty_name
assert 'an empty tailscale DNS name writes no serving decision' test ! -e "$(serving_path tailscale_empty_name)"
assert 'an empty tailscale DNS name explains why setup was skipped' bash -c '[[ $1 == *"tailscale has no DNS name"* ]]' _ "${output[tailscale_empty_name]}"

new_case linger_refused
args[linger_refused]=--serve
loginctl_status[linger_refused]=1
run_case linger_refused
assert 'a refused linger request prints the visible sudo recovery command' bash -c '[[ $1 == *"sudo loginctl enable-linger fixture-user"* && $1 == *"will stop at logout"* ]]' _ "${output[linger_refused]}"

new_case tailscale_declined
args[tailscale_declined]=--serve
tty[tailscale_declined]=1
input[tailscale_declined]=$'n\n'
run_case tailscale_declined
assert 'a declined tailscale serve prompt prints the command for later' bash -c '[[ $1 == *"run later: sudo tailscale serve --bg 7373"* ]]' _ "${output[tailscale_declined]}"
assert 'a declined tailscale serve prompt never runs sudo' bash -c '! grep -q "^sudo " "$1"' _ "$(log_path tailscale_declined)"

assert 'the rendered service unit has the specified exact contents' cmp -s <(printf '[Unit]\nDescription=Wheelchair graph viewer\n\n[Service]\nExecStart=%s/node %s/viewer/server.js --service\nEnvironment=WHEELCHAIR_NO_BROWSER=1\nRestart=always\nRestartSec=2\n\n[Install]\nWantedBy=default.target\n' "${shim[explicit_serve]}" "$repo") "$(unit_path explicit_serve)"
assert 'serving setup prints the bookmark last' last_line_is "${output[explicit_serve]}" 'https://fixture.tailnet.ts.net/?token=fixture'
assert 'dependency installation requests both browser engines' grep -Fq 'playwright install chromium firefox' "$repo/install.sh"

assert 'real CLAUDE.md is byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_claude_before" "$(file_state "$HOME/.claude/CLAUDE.md")"
assert 'real AGENTS.md is byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_codex_before" "$(file_state "$HOME/.codex/AGENTS.md")"

printf 'RESULT %d passed, %d failed\n' "$passes" "$failures"
(( failures == 0 ))
