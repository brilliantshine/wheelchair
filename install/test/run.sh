#!/usr/bin/env bash
# Each case owns temporary harness homes and command shims; this suite never writes live state.
# Each case name is a variable holding its index into the indexed arrays below (Bash 3.2 has no
# associative arrays), so shellcheck sees the names as unassigned.
# shellcheck disable=SC2004,SC2154
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
installer=${INSTALL_SH:-"$repo/install.sh"}
real_node=$(command -v node)
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
trap 'exit 130' INT; trap 'exit 143' TERM; trap 'exit 129' HUP

passes=0
failures=0
pass() { printf 'PASS %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
assert() {
  local description=$1
  shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}

hash_stream() { if command -v sha256sum >/dev/null 2>&1; then sha256sum | awk '{print $1}'; else shasum -a 256 | awk '{print $1}'; fi; }
hash_file() { hash_stream < "$1"; }
tree_state() {
  python3 - "$1" <<'PYCODE'
import hashlib, os, sys
root = sys.argv[1]
if not os.path.exists(root):
    print('absent', end='')
    sys.exit()
h = hashlib.sha256()
for base, dirs, files in os.walk(root, followlinks=False):
    dirs.sort()  # walk subdirectories in a fixed order, so the hash does not depend on listing order
    for name in sorted(dirs + files):
        path = os.path.join(base, name)
        rel = os.path.relpath(path, root)
        h.update(os.fsencode(rel))
        if os.path.islink(path): h.update(b'L' + os.fsencode(os.readlink(path)))
        elif os.path.isfile(path):
            h.update(b'F')
            with open(path, 'rb') as f: h.update(hashlib.sha256(f.read()).digest())
        else: h.update(b'D')
print(h.hexdigest(), end='')
PYCODE
}
file_state() {
  if [[ -e $1 ]]; then printf 'present:%s' "$(hash_file "$1")"; else printf absent; fi
}

# These are the lasting files install.sh and its children can write under ~/.wheelchair.
# codex/model.sh init writes models only if absent, via a short-lived .models.* file
# renamed into place, and writes .lock on every locked write. Add paths here when the
# installer gains another write. The running app's accounts, agy-models.json and
# installs/ are deliberately excluded because they change during a run.
real_wheelchair_paths=(models .lock)
real_wheelchair_state() {
  local dir=$1 path
  for path in "${real_wheelchair_paths[@]}"; do
    printf '%s %s\n' "$path" "$(file_state "$dir/$path")"
  done
}
real_wheelchair_mismatch() {
  local before=$1 after=$2 path changed=''
  for path in "${real_wheelchair_paths[@]}"; do
    if [[ $(printf '%s\n' "$before" | grep -F "$path ") != "$(printf '%s\n' "$after" | grep -F "$path ")" ]]; then
      changed="${changed:+$changed, }$path"
    fi
  done
  [[ -z $changed ]] || printf 'real wheelchair file changed during suite: %s' "$changed"
}

no_retired_wrappers() {
  local name
  for name in spine plan adopt plan-review implement verify graph diagram-sensitivity; do
    [[ ! -e $1/skills/$name && ! -L $1/skills/$name && ! -e $2/prompts/$name.md && ! -L $2/prompts/$name.md ]] || return 1
  done
}

model_overrides_ignored() { [[ ! -e $1 && ! -e $2 && -e $3 ]]; }

last_line_is() { [[ ${1##*$'\n'} == "$2" ]]; }

case_count=0
status_with_handlers() {
  printf '{"TCP":{"443":{"HTTPS":true}},"Web":{"fixture.tailnet.ts.net:443":{"Handlers":%s}}}' "$1"
}
new_case() {
  local name=$1 base
  printf -v "$name" %s "$case_count"
  case_count=$((case_count + 1))
  base=$fixture/$name
  home[$name]=$base/home
  claude[$name]=${home[$name]}/claude
  codex[$name]=${home[$name]}/codex
  shim[$name]=$base/shims
  present[$name]=claude,codex
  tty[$name]=0
  allow[$name]=1
  case_installer[$name]=$installer
  display[$name]=0
  input[$name]=''
  args[$name]=''
  dns[$name]=fixture.tailnet.ts.net.
  loginctl_status[$name]=0
  linger[$name]=no
  node_stop_status[$name]=0
  tailscale_absent[$name]=0
  detect_path[$name]=0
  restricted_path[$name]=0
  missing_tmux[$name]=0
  case_real_node[$name]=$real_node
  tailscale_ip[$name]=100.64.0.1
  tailscale_ip_status[$name]=0
  serve_status[$name]=$(status_with_handlers '{}')
  serve_status_exit[$name]=0
  mkdir -p "${home[$name]}" "${shim[$name]}" "$fixture/systemd"
  install_shims "$name"
}

install_shims() {
  local name=$1 dir=${shim[$1]}
cat > "$dir/node" <<'EOF'
#!/usr/bin/env bash
if [[ $1 == -e ]]; then
  exec "$WHEELCHAIR_REAL_NODE" "$@"
fi
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
if [[ $1 == show-user ]]; then printf '%s\n' "${WHEELCHAIR_LINGER:-no}"; exit 0; fi
exit "${WHEELCHAIR_LOGINCTL_STATUS:-0}"
EOF
  cat > "$dir/tailscale" <<'EOF'
#!/usr/bin/env bash
printf 'tailscale %s\n' "$*" >> "$WHEELCHAIR_SHIM_LOG"
if [[ $1 == status && $2 == --json ]]; then
  printf '{"Self":{"DNSName":"%s"}}\n' "${WHEELCHAIR_TAILSCALE_DNS-fixture.tailnet.ts.net.}"
elif [[ $1 == serve && $2 == status && $3 == --json ]]; then
  [[ ${WHEELCHAIR_TAILSCALE_SERVE_STATUS_EXIT:-0} == 0 ]] || exit "${WHEELCHAIR_TAILSCALE_SERVE_STATUS_EXIT}"
  printf '%s\n' "${WHEELCHAIR_TAILSCALE_SERVE_STATUS}"
elif [[ $1 == ip && $2 == -4 ]]; then
  [[ ${WHEELCHAIR_TAILSCALE_IP_STATUS:-0} == 0 ]] || exit "${WHEELCHAIR_TAILSCALE_IP_STATUS}"
  printf '%s\n' "${WHEELCHAIR_TAILSCALE_IP}"
fi
EOF
  cat > "$dir/launchctl" <<'EOF'
#!/usr/bin/env bash
printf 'launchctl %s\n' "$*" >> "$WHEELCHAIR_SHIM_LOG"
EOF
  cat > "$dir/plutil" <<'EOF'
#!/usr/bin/env bash
printf 'plutil %s\n' "$*" >> "$WHEELCHAIR_SHIM_LOG"
python3 -c 'import plistlib,sys; plistlib.load(open(sys.argv[1], "rb"))' "$2"
EOF
  cat > "$dir/hostname" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "${WHEELCHAIR_HOSTNAME:-fixture-host}"
EOF
  cat > "$dir/sudo" <<'EOF'
#!/usr/bin/env bash
printf 'sudo %s\n' "$*" >> "$WHEELCHAIR_SHIM_LOG"
"$@"
EOF
  chmod +x "$dir/node" "$dir/systemctl" "$dir/loginctl" "$dir/tailscale" "$dir/sudo" "$dir/hostname" "$dir/launchctl" "$dir/plutil"
}

run_case() {
  local name=$1
  local command_path=$PATH
  if [[ ${tailscale_absent[$name]} == 1 || ${detect_path[$name]} == 1 || ${restricted_path[$name]} == 1 ]]; then
    local tool
    for tool in awk basename bash cat chmod cp cut dirname grep head id mkdir mktemp od python3 rm sed tail tr uname; do
      ln -sf "$(command -v "$tool")" "${shim[$name]}/$tool"
    done
    for tool in npm tmux git gh curl; do
      [[ -e ${shim[$name]}/$tool || ${missing_tmux[$name]} == 1 && $tool == tmux ]] && continue
      if command -v "$tool" >/dev/null 2>&1; then
        ln -s "$(command -v "$tool")" "${shim[$name]}/$tool"
      else
        printf '#!/usr/bin/env bash\nexit 0\n' > "${shim[$name]}/$tool"
        chmod +x "${shim[$name]}/$tool"
      fi
    done
    command_path=${shim[$name]}
    [[ ${tailscale_absent[$name]} == 1 ]] && rm -f "${shim[$name]}/tailscale"
  fi
  local -a command=(env -u DISPLAY -u WAYLAND_DISPLAY -u WHEELCHAIR_MODELS -u WHEELCHAIR_MODELS_CACHE
    "HOME=${home[$name]}" "USER=fixture-user" "PATH=${shim[$name]}:$command_path"
    "WHEELCHAIR_SHIM_LOG=${home[$name]}/commands.log"
    "WHEELCHAIR_PRESENT=${present[$name]}" WHEELCHAIR_SKIP_DEPS=1
    "WHEELCHAIR_SUDO_TEST_ROOT=$fixture/$name/sudo-root"
    "WHEELCHAIR_ALLOW_WORKTREE=${allow[$name]}"
    "WHEELCHAIR_CLAUDE_HOME=${claude[$name]}" "WHEELCHAIR_CODEX_HOME=${codex[$name]}"
    "WHEELCHAIR_WORDING=${home[$name]}/wheelchair/wording.md"
    "WHEELCHAIR_TTY=${tty[$name]}" "WHEELCHAIR_TAILSCALE_DNS=${dns[$name]}"
    "WHEELCHAIR_PLATFORM=${case_platform:-Linux}" "WHEELCHAIR_SYSTEMD_RUN_DIR=$fixture/systemd"
    "WHEELCHAIR_TAILSCALE_APP=${case_tailscale_app:-/nonexistent}"
    "WHEELCHAIR_REAL_NODE=${case_real_node[$name]}"
    "WHEELCHAIR_TAILSCALE_SERVE_STATUS=${serve_status[$name]}"
    "WHEELCHAIR_TAILSCALE_SERVE_STATUS_EXIT=${serve_status_exit[$name]}"
    "WHEELCHAIR_TAILSCALE_IP=${tailscale_ip[$name]}"
    "WHEELCHAIR_TAILSCALE_IP_STATUS=${tailscale_ip_status[$name]}"
    "WHEELCHAIR_LOGINCTL_STATUS=${loginctl_status[$name]}"
    "WHEELCHAIR_LINGER=${linger[$name]}"
    "WHEELCHAIR_NODE_STOP_STATUS=${node_stop_status[$name]}")
  if [[ ${detect_path[$name]} == 1 ]]; then
    local i
    for i in "${!command[@]}"; do
      [[ ${command[$i]} == WHEELCHAIR_PRESENT=* ]] && unset 'command[i]'
    done
    command=(env -u WHEELCHAIR_PRESENT "${command[@]:1}")
  fi
  [[ ${display[$name]} == 1 ]] && command+=(DISPLAY=:fixture)
  set +e
  output[$name]=$(printf '%s' "${input[$name]}" | ${command[@]+"${command[@]}"} "${case_installer[$name]}" ${args[$name]} 2>&1)
  status[$name]=$?
  set -e
}

serving_path() { printf '%s/.cache/agent-graphs/.serving' "${home[$1]}"; }
unit_path() { printf '%s/.config/systemd/user/wheelchair-viewer.service' "${home[$1]}"; }
machine_unit_path() { printf '%s/.config/systemd/user/wheelchair-machine.service' "${home[$1]}"; }
machine_state_path() { printf '%s/.local/state/wheelchair' "${home[$1]}"; }
machine_config_path() { printf '%s/machine.json' "$(machine_state_path "$1")"; }
machines_path() { printf '%s/machines.json' "$(machine_state_path "$1")"; }
machine_secret_path() { printf '%s/machine.secret' "$(machine_state_path "$1")"; }
log_path() { printf '%s/commands.log' "${home[$1]}"; }
seed_serving() {
  local name=$1
  mkdir -p "${home[$name]}/.cache/agent-graphs"
  printf '{"serve": true, "origin": "https://fixture.tailnet.ts.net"}\n' > "$(serving_path "$name")"
}

real_claude_before=$(file_state "$HOME/.claude/CLAUDE.md")
real_codex_before=$(file_state "$HOME/.codex/AGENTS.md")
real_seen_settings_before=$(file_state "$HOME/.claude/settings.json")
real_seen_hooks_before=$(file_state "$HOME/.codex/hooks.json")
real_seen_config_before=$(file_state "$HOME/.codex/config.toml")
selfcheck_a=$fixture/real-state-selfcheck-a
selfcheck_b=$fixture/real-state-selfcheck-b
mkdir -p "$selfcheck_a" "$selfcheck_b/accounts/x"
printf 'initial\n' > "$selfcheck_a/models"
printf 'initial\n' > "$selfcheck_b/models"
selfcheck_before=$(real_wheelchair_state "$selfcheck_a")
printf 'changed\n' > "$selfcheck_a/models"
touch "$selfcheck_a/.lock"
selfcheck_after=$(real_wheelchair_state "$selfcheck_a")
assert 'real wheelchair mismatch names both changed files' test "$(real_wheelchair_mismatch "$selfcheck_before" "$selfcheck_after")" = 'real wheelchair file changed during suite: models, .lock'
selfcheck_before=$(real_wheelchair_state "$selfcheck_b")
touch "$selfcheck_b/agy-models.json" "$selfcheck_b/accounts/x/wheelchair-account.json"
assert 'real wheelchair state ignores unlisted files' test "$selfcheck_before" = "$(real_wheelchair_state "$selfcheck_b")"
real_wheelchair_before=$(real_wheelchair_state "$HOME/.wheelchair")

# A checkout the guard must refuse: install.sh and its guard copied into <dir>, which the caller
# has made a linked git worktree or placed under the app's worktree directory.
copy_installer() {
  mkdir -p "$1/install"
  cp "$installer" "$1/install.sh"
  cp "$repo/install/guard.sh" "$1/install/guard.sh"
}

new_case refuse_linked_worktree
git init -q "$fixture/guard-repo"
git -C "$fixture/guard-repo" -c user.name=fixture -c user.email=fixture@invalid commit -q --allow-empty -m init
git -C "$fixture/guard-repo" worktree add -q "$fixture/guard-worktree" 2>/dev/null
copy_installer "$fixture/guard-worktree"
case_installer[refuse_linked_worktree]=$fixture/guard-worktree/install.sh
allow[refuse_linked_worktree]=''
before=$(tree_state "${home[refuse_linked_worktree]}")
run_case refuse_linked_worktree
assert 'install.sh refuses to run from a linked worktree and touches nothing' bash -c '[[ $1 == 3 && $2 == *"linked git worktree"* && $3 == "$4" ]]' _ "${status[refuse_linked_worktree]}" "${output[refuse_linked_worktree]}" "$before" "$(tree_state "${home[refuse_linked_worktree]}")"

new_case refuse_app_worktree_dir
app_checkout=${home[refuse_app_worktree_dir]}/.local/state/wheelchair/worktrees/wheelchair/wc/fixture
copy_installer "$app_checkout"
case_installer[refuse_app_worktree_dir]=$app_checkout/install.sh
allow[refuse_app_worktree_dir]=''
before=$(tree_state "${home[refuse_app_worktree_dir]}")
run_case refuse_app_worktree_dir
assert 'install.sh refuses to run from under the app worktree directory and touches nothing' bash -c '[[ $1 == 3 && $2 == *"wheelchair/worktrees"* && $3 == "$4" ]]' _ "${status[refuse_app_worktree_dir]}" "${output[refuse_app_worktree_dir]}" "$before" "$(tree_state "${home[refuse_app_worktree_dir]}")"

new_case refuse_symlink_alias
alias_target=${home[refuse_symlink_alias]}/.local/state/wheelchair/worktrees/wheelchair/wc/aliased
copy_installer "$alias_target"
ln -s "$alias_target" "$fixture/alias-checkout"
case_installer[refuse_symlink_alias]=$fixture/alias-checkout/install.sh
allow[refuse_symlink_alias]=''
before=$(tree_state "${home[refuse_symlink_alias]}")
run_case refuse_symlink_alias
assert 'install.sh refuses through a symlink into the app worktree directory and touches nothing' bash -c '[[ $1 == 3 && $2 == *"wheelchair/worktrees"* && $3 == "$4" ]]' _ "${status[refuse_symlink_alias]}" "${output[refuse_symlink_alias]}" "$before" "$(tree_state "${home[refuse_symlink_alias]}")"

new_case claude_only
present[claude_only]=claude
run_case claude_only
assert 'claude-only install succeeds and reports Claude' bash -c '[[ $1 == 0 && $2 == *"harness found: claude"* ]]' _ "${status[claude_only]}" "${output[claude_only]}"
assert 'claude-only install creates no retired wrappers' no_retired_wrappers "${claude[claude_only]}" "${codex[claude_only]}"
assert 'claude-only install does not create the absent Codex home' test ! -e "${codex[claude_only]}"

new_case codex_only
present[codex_only]=codex
export WHEELCHAIR_MODELS=$fixture/leak/codex_only/models WHEELCHAIR_MODELS_CACHE=$fixture/leak/codex_only/models-cache
run_case codex_only
unset WHEELCHAIR_MODELS WHEELCHAIR_MODELS_CACHE
assert 'codex_only ignores model path overrides' model_overrides_ignored "$fixture/leak/codex_only/models" "$fixture/leak/codex_only/models-cache" "${home[codex_only]}/.wheelchair/models"
assert 'codex-only install succeeds and reports Codex' bash -c '[[ $1 == 0 && $2 == *"harness found: codex"* ]]' _ "${status[codex_only]}" "${output[codex_only]}"
assert 'codex-only install creates no retired wrappers' no_retired_wrappers "${claude[codex_only]}" "${codex[codex_only]}"
assert 'codex-only install does not create the absent Claude home' test ! -e "${claude[codex_only]}"
assert 'codex-only install creates the default model pins' cmp -s <(printf "# wheelchair's model pins. Change them with codex/model.sh.\nclaude.light = claude-haiku-5-5\nclaude.standard = claude-sonnet-5-5\nclaude.heavy = claude-opus-5-5\nclaude.critical = claude-fable-5-2\nclaude.lead = claude-opus-5-5\nclaude.sub-lead = claude-opus-5-5\ngpt.light = gpt-6-luna\ngpt.standard = gpt-5.6-terra\ngpt.heavy = gpt-6.1-sol\ngpt.critical = gpt-6-astra\ngpt.lead = gpt-6.1-sol\ngpt.sub-lead = gpt-6.1-sol\ngemini.light = gemini-3.8-flash-low\ngemini.standard = gemini-3.8-flash-medium\ngemini.heavy = gemini-3.8-flash-high\ngemini.critical = gemini-3.8-flash-high\ngemini.lead = gemini-3.8-flash-high\ngemini.sub-lead = gemini-3.8-flash-high\nkimi.light = kimi-code/kimi-for-coding\nkimi.standard = kimi-code/k3\nkimi.heavy = kimi-code/k3.1-pro\nkimi.critical = kimi-code/k3.1-pro\nkimi.lead = kimi-code/k3.1-pro\nkimi.sub-lead = kimi-code/k3.1-pro\nopenrouter.light = openrouter/auto\nopenrouter.standard = openrouter/auto\nopenrouter.heavy = openrouter/auto\nopenrouter.critical = openrouter/auto\nopenrouter.lead = openrouter/auto\nopenrouter.sub-lead = openrouter/auto\n") "${home[codex_only]}/.wheelchair/models"

new_case kimi_only
present[kimi_only]=kimi
run_case kimi_only
assert 'kimi-only install succeeds and initializes model pins' bash -c '[[ $1 == 0 && $2 == *"harness found: kimi"* && -f $3 ]]' _ "${status[kimi_only]}" "${output[kimi_only]}" "${home[kimi_only]}/.wheelchair/models"

new_case agy_only
present[agy_only]=agy
run_case agy_only
assert 'agy-only install succeeds and initializes model pins' bash -c '[[ $1 == 0 && $2 == *"harness found: agy"* && -f $3 ]]' _ "${status[agy_only]}" "${output[agy_only]}" "${home[agy_only]}/.wheelchair/models"

new_case pi_on_path
detect_path[pi_on_path]=1
args[pi_on_path]=--serve
printf '#!/usr/bin/env bash\nexit 0\n' > "${shim[pi_on_path]}/pi"
chmod +x "${shim[pi_on_path]}/pi"
run_case pi_on_path
assert 'pi on PATH is detected alone' bash -c '[[ $1 == 0 && $2 == *"harness found: pi"* && $2 != *"harness found: kimi"* ]]' _ "${status[pi_on_path]}" "${output[pi_on_path]}"
assert 'PATH pi directory leads the machine service PATH' grep -Fq "PATH=${shim[pi_on_path]}:" "$(machine_unit_path pi_on_path)"

new_case pi_fallback
detect_path[pi_fallback]=1
args[pi_fallback]=--serve
mkdir -p "${home[pi_fallback]}/.local/bin" "${home[pi_fallback]}/target"
printf '#!/usr/bin/env bash\nexit 0\n' > "${home[pi_fallback]}/target/pi"
chmod +x "${home[pi_fallback]}/target/pi"
ln -s "${home[pi_fallback]}/target/pi" "${home[pi_fallback]}/.local/bin/pi"
run_case pi_fallback
assert 'fallback pi symlink is detected alone' bash -c '[[ $1 == 0 && $2 == *"harness found: pi"* ]]' _ "${status[pi_fallback]}" "${output[pi_fallback]}"
assert 'fallback pi symlink directory leads the machine service PATH' grep -Fq "PATH=${home[pi_fallback]}/.local/bin:" "$(machine_unit_path pi_fallback)"

new_case pi_with_others
present[pi_with_others]=claude,codex,kimi,pi
restricted_path[pi_with_others]=1
args[pi_with_others]=--serve
mkdir -p "${home[pi_with_others]}/.local/bin"
printf '#!/usr/bin/env bash\nexit 0\n' > "${home[pi_with_others]}/.local/bin/pi"
chmod +x "${home[pi_with_others]}/.local/bin/pi"
run_case pi_with_others
assert 'presence override reports pi alongside other harnesses' bash -c '[[ $1 == 0 && $2 == *"harness found: pi"* && $2 == *"harness found: claude"* && $2 == *"harness found: codex"* && $2 == *"harness found: kimi"* ]]' _ "${status[pi_with_others]}" "${output[pi_with_others]}"
assert 'pi alongside others reaches the machine service PATH' grep -Fq "PATH=${home[pi_with_others]}/.local/bin:" "$(machine_unit_path pi_with_others)"

new_case no_pi
detect_path[no_pi]=1
args[no_pi]=--serve
printf '#!/usr/bin/env bash\nexit 0\n' > "${shim[no_pi]}/codex"
chmod +x "${shim[no_pi]}/codex"
run_case no_pi
assert 'absent pi is not reported' bash -c '[[ $1 == 0 && $2 != *"harness found: pi"* ]]' _ "${status[no_pi]}" "${output[no_pi]}"
assert 'local bin is on the machine service PATH even with pi absent' grep -Fq "${home[no_pi]}/.local/bin" "$(machine_unit_path no_pi)"

new_case kimi_fallback
detect_path[kimi_fallback]=1
args[kimi_fallback]=--serve
mkdir -p "${home[kimi_fallback]}/.kimi-code/bin"
printf '#!/usr/bin/env bash\nexit 0\n' > "${home[kimi_fallback]}/.kimi-code/bin/kimi"
chmod +x "${home[kimi_fallback]}/.kimi-code/bin/kimi"
run_case kimi_fallback
assert 'fallback kimi is detected without other providers' bash -c '[[ $1 == 0 && $2 == *"harness found: kimi"* ]]' _ "${status[kimi_fallback]}" "${output[kimi_fallback]}"
assert 'fallback kimi directory reaches the machine service PATH' grep -Fq "${home[kimi_fallback]}/.kimi-code/bin:" "$(machine_unit_path kimi_fallback)"

new_case kimi_on_path
detect_path[kimi_on_path]=1
printf '#!/usr/bin/env bash\nexit 0\n' > "${shim[kimi_on_path]}/kimi"
chmod +x "${shim[kimi_on_path]}/kimi"
export WHEELCHAIR_MODELS=$fixture/leak/kimi_on_path/models WHEELCHAIR_MODELS_CACHE=$fixture/leak/kimi_on_path/models-cache
run_case kimi_on_path
unset WHEELCHAIR_MODELS WHEELCHAIR_MODELS_CACHE
assert 'kimi_on_path ignores model path overrides' model_overrides_ignored "$fixture/leak/kimi_on_path/models" "$fixture/leak/kimi_on_path/models-cache" "${home[kimi_on_path]}/.wheelchair/models"
assert 'kimi on PATH is detected without other providers' bash -c '[[ $1 == 0 && $2 == *"harness found: kimi"* ]]' _ "${status[kimi_on_path]}" "${output[kimi_on_path]}"

new_case codex_pins_preserved
present[codex_pins_preserved]=codex
mkdir -p "${home[codex_pins_preserved]}/.wheelchair"
printf 'sol = local-model\n' > "${home[codex_pins_preserved]}/.wheelchair/models"
run_case codex_pins_preserved
assert 'codex install never overwrites existing model pins' cmp -s <(printf 'sol = local-model\n') "${home[codex_pins_preserved]}/.wheelchair/models"

names=(spine plan adopt plan-review implement verify graph diagram-sensitivity)
files=(spine planning adopt plan-review implementation verification graphs sensitivity)
for i in "${!names[@]}"; do
  name=${names[$i]} protocol=${files[$i]}
  for origin in current other quoted spaced spaced_quoted mid_line relative short_relative tilde foreign different; do
    case_name="wrapper_${i}_${origin}"
    new_case "$case_name"
    mkdir -p "${claude[$case_name]}/skills/$name" "${codex[$case_name]}/prompts"
    case $origin in
      current) text="Read $repo/protocol/$protocol.md and follow it exactly for: \$ARGUMENTS" ;;
      other) text="Read /elsewhere/protocol/$protocol.md" ;;
      quoted) text="Read \`/opt/w/protocol/$protocol.md\` and" ;;
      spaced) text="Read /old wheelchair/protocol/$protocol.md and follow it exactly for: \$ARGUMENTS" ;;
      spaced_quoted) text="Read \`/old wheelchair/protocol/$protocol.md\` and" ;;
      mid_line) text="See /elsewhere/protocol/$protocol.md for details" ;;
      relative) text="Read foo/bar/protocol/$protocol.md" ;;
      short_relative) text="Read x/protocol/$protocol.md" ;;
      tilde) text="Read ~/w/protocol/$protocol.md" ;;
      foreign) text='someone else owns this' ;;
      different) text='Read /elsewhere/protocol/unrelated.md' ;;
    esac
    printf '%s\n' "$text" > "${claude[$case_name]}/skills/$name/SKILL.md"
    printf '%s\n' "$text" > "${codex[$case_name]}/prompts/$name.md"
    run_case "$case_name"
    if [[ $origin == current || $origin == other || $origin == quoted || $origin == spaced || $origin == spaced_quoted ]]; then
      assert "$name $origin wrappers removed" no_retired_wrappers "${claude[$case_name]}" "${codex[$case_name]}"
    else
      assert "$name $origin wrappers kept" bash -c '[[ -f $1 && -f $2 ]]' _ "${claude[$case_name]}/skills/$name/SKILL.md" "${codex[$case_name]}/prompts/$name.md"
    fi
  done
done
new_case wrapper_links
mkdir -p "${claude[wrapper_links]}/skills" "${codex[wrapper_links]}/prompts"
ln -s /old/skills/plan "${claude[wrapper_links]}/skills/plan"
ln -s /old/codex/prompts/plan.md "${codex[wrapper_links]}/prompts/plan.md"
mkdir -p "$fixture/foreign-skill"
ln -s "$fixture/foreign-skill" "${claude[wrapper_links]}/skills/verify"
run_case wrapper_links
assert 'owned symlinks removed and foreign symlink kept' bash -c '[[ ! -L $1 && ! -L $2 && -L $3 ]]' _ "${claude[wrapper_links]}/skills/plan" "${codex[wrapper_links]}/prompts/plan.md" "${claude[wrapper_links]}/skills/verify"

new_case seen_removed
mkdir -p "${claude[seen_removed]}" "${codex[seen_removed]}" "$fixture/checkout/protocol/app"
printf x > "$fixture/checkout/protocol/app/lead.md"
python3 - "${claude[seen_removed]}" "${codex[seen_removed]}" "$fixture/checkout" "${home[seen_removed]}" <<'PYTEST'
import json, os, shlex, sys
c, x, root, home = sys.argv[1:]
for harness, path in [('claude', c+'/settings.json'), ('codex', x+'/hooks.json')]:
    hook = {'type':'command','command':f'{shlex.quote(root+"/seen/hook.sh")} {harness} notice','timeout':2}
    d={'hooks':{'UserPromptSubmit':[{'matcher':'x','hooks':[hook, {'command':'other'}]}, {'hooks':[{'command':'unrelated'}]}], 'Other': []}}
    if harness == 'claude':
        d.update(permissions={'allow':[f'Bash({root}/seen/wording.sh:*)','Bash(other:*)']}, sandbox={'filesystem':{'allowWrite':[home+'/.wheelchair']}})
    with open(path,'w') as f: json.dump(d,f)
    d['hooks']['UserPromptSubmit'][0]['hooks'].pop(0)
    if harness == 'claude': d['permissions']['allow'].pop(0)
    with open(path+'.expected','w') as f: json.dump(d,f)
open(x+'/config.toml','w').write('[sandbox_workspace_write]\nwritable_roots = ["'+home+'/.wheelchair"]\n')
PYTEST
cp "${codex[seen_removed]}/config.toml" "$fixture/config.expected"
run_case seen_removed
assert 'seen hooks and permission removed while unrelated JSON and grants survive' python3 - "${claude[seen_removed]}/settings.json" "${codex[seen_removed]}/hooks.json" <<'PYTEST'
import json, sys
for p in sys.argv[1:]:
    assert json.load(open(p)) == json.load(open(p+'.expected'))
PYTEST
assert 'Codex config grant is byte-identical' cmp -s "${codex[seen_removed]}/config.toml" "$fixture/config.expected"
assert 'seen removal reports once' bash -c '[[ $(grep -c "^seen hook: removed$" <<< "$1") == 1 ]]' _ "${output[seen_removed]}"
new_case seen_foreign
mkdir -p "${claude[seen_foreign]}" "$fixture/foreign/seen"
printf '{"hooks":{"UserPromptSubmit":[{"hooks":[{"command":"%s/foreign/seen/hook.sh claude notice"}]}]},"permissions":{"allow":["Bash(%s/foreign/seen/wording.sh:*)"]}}\n' "$fixture" "$fixture" > "${claude[seen_foreign]}/settings.json"
cp "${claude[seen_foreign]}/settings.json" "$fixture/foreign.expected"
run_case seen_foreign
assert 'foreign seen entries survive unchanged' cmp -s "${claude[seen_foreign]}/settings.json" "$fixture/foreign.expected"
new_case seen_malformed
mkdir -p "${claude[seen_malformed]}"
printf '{bad json' > "${claude[seen_malformed]}/settings.json"
run_case seen_malformed
assert 'malformed settings survive with warning and successful install' bash -c '[[ $1 == 0 && $2 == *"warning:"* && $2 == *"settings.json"* && $(cat "$3") == "{bad json" ]]' _ "${status[seen_malformed]}" "${output[seen_malformed]}" "${claude[seen_malformed]}/settings.json"

new_case neither
present[neither]=''
args[neither]=--serve
run_case neither
assert 'no provider succeeds and explains setup' bash -c '[[ $1 == 0 && $2 == *"No agent CLI yet. After install, open the app: its setup checklist installs them from Settings."* ]]' _ "${status[neither]}" "${output[neither]}"
assert 'neither harness writes no homes' bash -c '[[ ! -e $1 && ! -e $2 ]]' _ "${claude[neither]}" "${codex[neither]}"
assert 'neither harness runs the stale-viewer check' grep -Fq "node $repo/viewer/server.js --stop --if-stale" "$(log_path neither)"
assert 'neither harness service PATH includes both install directories' bash -c 'grep -Fq "$2/.local/bin" "$1" && grep -Fq "$2/.kimi-code/bin" "$1"' _ "$(machine_unit_path neither)" "${home[neither]}"

new_case missing_tmux_case
restricted_path[missing_tmux_case]=1
missing_tmux[missing_tmux_case]=1
run_case missing_tmux_case
assert 'missing tmux fails before writing state' bash -c '[[ $1 == 1 && $2 == *tmux* && -z $(ls -A "$3") ]]' _ "${status[missing_tmux_case]}" "${output[missing_tmux_case]}" "${home[missing_tmux_case]}"

new_case old_node
printf '#!/usr/bin/env bash\nprintf 18.0.0\n' > "$fixture/node18"
chmod +x "$fixture/node18"
case_real_node[old_node]=$fixture/node18
run_case old_node
assert 'Node 18 fails with Node 20 requirement' bash -c '[[ $1 == 1 && $2 == *"Node 20"* && $2 == *18.0.0* ]]' _ "${status[old_node]}" "${output[old_node]}"

new_case both_idempotent
run_case both_idempotent
first_claude=$(tree_state "${claude[both_idempotent]}")
first_codex=$(tree_state "${codex[both_idempotent]}")
run_case both_idempotent
assert 'both harnesses have no retired wrappers' no_retired_wrappers "${claude[both_idempotent]}" "${codex[both_idempotent]}"
assert 'a second install is idempotent' bash -c '[[ $1 == 0 && $2 == "$3" && $4 == "$5" ]]' _ "${status[both_idempotent]}" "$(tree_state "${claude[both_idempotent]}")" "$first_claude" "$(tree_state "${codex[both_idempotent]}")" "$first_codex"
assert 'second install reports nothing to remove' bash -c '[[ $1 == *"seen hook: nothing to remove"* ]]' _ "${output[both_idempotent]}"
assert 'no UserPromptSubmit seen handler is installed' bash -c '[[ ! -e $1 && ! -e $2 ]]' _ "${claude[both_idempotent]}/settings.json" "${codex[both_idempotent]}/hooks.json"

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
assert '--serve enables and restarts the machine service with the viewer' bash -c 'grep -Fxq "systemctl --user enable --now wheelchair-machine.service" "$1" && grep -Fxq "systemctl --user restart wheelchair-machine.service" "$1"' _ "$(log_path explicit_serve)"

new_case no_serve
args[no_serve]=--no-serve
seed_serving no_serve
mkdir -p "${home[no_serve]}/.config/systemd/user" "${home[no_serve]}/.cache/agent-graphs"
printf 'unit\n' > "$(unit_path no_serve)"
printf 'kept\n' > "${home[no_serve]}/.cache/agent-graphs/.token"
run_case no_serve
assert '--no-serve records false and keeps the origin for a retry' cmp -s <(printf '{"serve": false, "origin": "https://fixture.tailnet.ts.net"}\n') "$(serving_path no_serve)"
assert '--no-serve stops and removes the user unit but keeps the token' bash -c '[[ ! -e $1 && -f $2 ]] && grep -Fxq "systemctl --user disable --now wheelchair-viewer.service" "$3"' _ "$(unit_path no_serve)" "${home[no_serve]}/.cache/agent-graphs/.token" "$(log_path no_serve)"
assert '--no-serve stops and removes the machine unit too' bash -c '[[ ! -e $1 ]] && grep -Fxq "systemctl --user disable --now wheelchair-machine.service" "$2"' _ "$(machine_unit_path no_serve)" "$(log_path no_serve)"
assert '--no-serve never suggests disabling every HTTPS mapping' bash -c '[[ $1 != *"sudo tailscale serve --https=443 off"* ]]' _ "${output[no_serve]}"

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
assert 'an absent tailscale falls back to localhost in machine.json' python3 - "$(machine_config_path tailscale_missing)" <<'PY'
import json, sys
assert json.load(open(sys.argv[1]))['host'] == '127.0.0.1'
PY

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

new_case linger_already_on
args[linger_already_on]=--serve
loginctl_status[linger_already_on]=1
linger[linger_already_on]=yes
run_case linger_already_on
assert 'lingering already on prints no linger warning' bash -c '[[ $1 != *"will stop at logout"* && $1 != *"sudo loginctl enable-linger"* ]]' _ "${output[linger_already_on]}"
assert 'lingering already on is not requested again' bash -c '! grep -q "loginctl enable-linger" "$1"' _ "${home[linger_already_on]}/commands.log"

new_case tailscale_declined
args[tailscale_declined]=--serve
tty[tailscale_declined]=1
input[tailscale_declined]=$'n\n'
run_case tailscale_declined
assert 'a declined tailscale serve prompt prints the prefix command for later' bash -c '[[ $1 == *"run later: sudo tailscale serve --bg --set-path /wheelchair http://127.0.0.1:7373/wheelchair"* ]]' _ "${output[tailscale_declined]}"
assert 'a declined tailscale serve prompt never runs sudo' bash -c '! grep -q "^sudo " "$1"' _ "$(log_path tailscale_declined)"

new_case prefix_mapping_missing
args[prefix_mapping_missing]=--serve
run_case prefix_mapping_missing
assert 'serving setup offers the /wheelchair mapping when it is missing' bash -c '[[ $1 == *"sudo tailscale serve --bg --set-path /wheelchair http://127.0.0.1:7373/wheelchair"* ]]' _ "${output[prefix_mapping_missing]}"
assert 'the offered /wheelchair mapping command uses the viewer port' bash -c '[[ $1 == *"http://127.0.0.1:7373/wheelchair"* ]]' _ "${output[prefix_mapping_missing]}"

new_case prefix_mapping_present
args[prefix_mapping_present]=--serve
serve_status[prefix_mapping_present]=$(status_with_handlers '{"/wheelchair":{"Proxy":"http://127.0.0.1:7373/wheelchair"}}')
run_case prefix_mapping_present
assert 'serving setup does not offer the /wheelchair mapping when it already points at the viewer' bash -c '[[ $1 != *"--set-path /wheelchair http://127.0.0.1:7373/wheelchair"* ]]' _ "${output[prefix_mapping_present]}"

new_case root_mapping_missing
args[root_mapping_missing]=--serve
serve_status[root_mapping_missing]=$(status_with_handlers '{"/wheelchair":{"Proxy":"http://127.0.0.1:7373/wheelchair"}}')
run_case root_mapping_missing
assert 'serving setup offers the root mapping only when it is unmapped' bash -c '[[ $1 == *"sudo tailscale serve --bg 7373"* ]]' _ "${output[root_mapping_missing]}"

new_case root_mapping_other
args[root_mapping_other]=--serve
serve_status[root_mapping_other]=$(status_with_handlers '{"/":{"Proxy":"http://127.0.0.1:9999"}}')
run_case root_mapping_other
assert 'serving setup never offers to replace a root mapping at another port' bash -c '[[ $1 != *"sudo tailscale serve --bg 7373"* ]]' _ "${output[root_mapping_other]}"

new_case trailing_prefix_mapping
args[trailing_prefix_mapping]=--serve
serve_status[trailing_prefix_mapping]=$(status_with_handlers '{"/wheelchair/":{"Proxy":"http://127.0.0.1:7373/wheelchair"}}')
run_case trailing_prefix_mapping
assert 'a /wheelchair/ Handlers key counts as the existing prefix mapping' bash -c '[[ $1 != *"--set-path /wheelchair http://127.0.0.1:7373/wheelchair"* ]]' _ "${output[trailing_prefix_mapping]}"

new_case proxy_with_path
args[proxy_with_path]=--serve
serve_status[proxy_with_path]=$(status_with_handlers '{"/wheelchair":{"Proxy":"http://127.0.0.1:7373/another-path"},"/":{"Proxy":"http://127.0.0.1:7373/another-path"}}')
run_case proxy_with_path
assert 'a proxy beginning with the viewer port counts as the existing prefix mapping' bash -c '[[ $1 != *"--set-path /wheelchair http://127.0.0.1:7373/wheelchair"* ]]' _ "${output[proxy_with_path]}"
assert 'a root proxy beginning with the viewer port is not replaced' bash -c '[[ $1 != *"sudo tailscale serve --bg 7373"* ]]' _ "${output[proxy_with_path]}"

new_case no_serve_prefix_mapping
args[no_serve_prefix_mapping]=--no-serve
seed_serving no_serve_prefix_mapping
serve_status[no_serve_prefix_mapping]=$(status_with_handlers '{"/wheelchair":{"Proxy":"http://127.0.0.1:7373/wheelchair"},"/":{"Proxy":"http://127.0.0.1:9999"}}')
run_case no_serve_prefix_mapping
assert '--no-serve prints the path-specific /wheelchair removal for the viewer mapping' bash -c '[[ $1 == *"sudo tailscale serve --https=443 --set-path /wheelchair off"* ]]' _ "${output[no_serve_prefix_mapping]}"
assert '--no-serve never prints the global HTTPS removal command' bash -c '[[ $1 != *"sudo tailscale serve --https=443 off"* ]]' _ "${output[no_serve_prefix_mapping]}"

new_case no_serve_root_mapping
args[no_serve_root_mapping]=--no-serve
seed_serving no_serve_root_mapping
serve_status[no_serve_root_mapping]=$(status_with_handlers '{"/":{"Proxy":"http://127.0.0.1:7373"}}')
run_case no_serve_root_mapping
assert '--no-serve prints the root removal only when root points at the viewer port' bash -c '[[ $1 == *"sudo tailscale serve --https=443 --set-path / off"* ]]' _ "${output[no_serve_root_mapping]}"

new_case no_serve_root_other
args[no_serve_root_other]=--no-serve
seed_serving no_serve_root_other
serve_status[no_serve_root_other]=$(status_with_handlers '{"/":{"Proxy":"http://127.0.0.1:9999"}}')
run_case no_serve_root_other
assert '--no-serve does not print the root removal for another service' bash -c '[[ $1 != *"--set-path / off"* ]]' _ "${output[no_serve_root_other]}"

new_case no_serve_tailscale_missing
args[no_serve_tailscale_missing]=--no-serve
seed_serving no_serve_tailscale_missing
tailscale_absent[no_serve_tailscale_missing]=1
run_case no_serve_tailscale_missing
assert '--no-serve with tailscale missing prints no removal command' bash -c '[[ $1 != *"sudo tailscale serve"* ]]' _ "${output[no_serve_tailscale_missing]}"
assert '--no-serve with tailscale missing says why' bash -c '[[ $1 == *"tailscale is not installed"* ]]' _ "${output[no_serve_tailscale_missing]}"

new_case no_serve_no_origin
args[no_serve_no_origin]=--no-serve
run_case no_serve_no_origin
assert '--no-serve without a recorded origin prints no removal command' bash -c '[[ $1 != *"sudo tailscale serve"* ]]' _ "${output[no_serve_no_origin]}"
assert '--no-serve without a recorded origin says there is nothing to remove' bash -c '[[ $1 == *"there is nothing to remove"* ]]' _ "${output[no_serve_no_origin]}"

new_case no_serve_status_fails
args[no_serve_status_fails]=--no-serve
seed_serving no_serve_status_fails
serve_status_exit[no_serve_status_fails]=1
run_case no_serve_status_fails
assert '--no-serve with unreadable status prints no removal command' bash -c '[[ $1 != *"sudo tailscale serve"* ]]' _ "${output[no_serve_status_fails]}"
assert '--no-serve with unreadable status says why' bash -c '[[ $1 == *"could not read tailscale serve status"* ]]' _ "${output[no_serve_status_fails]}"

new_case no_serve_status_malformed
args[no_serve_status_malformed]=--no-serve
seed_serving no_serve_status_malformed
serve_status[no_serve_status_malformed]='not JSON'
run_case no_serve_status_malformed
assert '--no-serve with malformed status prints no removal command' bash -c '[[ $1 != *"sudo tailscale serve"* ]]' _ "${output[no_serve_status_malformed]}"
assert '--no-serve with malformed status says why' bash -c '[[ $1 == *"returned malformed JSON"* ]]' _ "${output[no_serve_status_malformed]}"

new_case no_serve_false_record
args[no_serve_false_record]=--no-serve
mkdir -p "${home[no_serve_false_record]}/.cache/agent-graphs"
printf '{"serve": false, "origin": "https://fixture.tailnet.ts.net"}\n' > "$(serving_path no_serve_false_record)"
serve_status[no_serve_false_record]=$(status_with_handlers '{"/wheelchair":{"Proxy":"http://127.0.0.1:7373/wheelchair"}}')
run_case no_serve_false_record
assert '--no-serve uses an origin kept in an already-false serving record' bash -c '[[ $1 == *"--set-path /wheelchair off"* ]]' _ "${output[no_serve_false_record]}"
assert '--no-serve keeps that origin after the retry' cmp -s <(printf '{"serve": false, "origin": "https://fixture.tailnet.ts.net"}\n') "$(serving_path no_serve_false_record)"

assert 'the rendered service unit has the specified exact contents' cmp -s <(printf '[Unit]\nDescription=Wheelchair graph viewer\n\n[Service]\nExecStart=%s/node %s/viewer/server.js --service\nEnvironment=WHEELCHAIR_NO_BROWSER=1\nRestart=always\nRestartSec=2\n\n[Install]\nWantedBy=default.target\n' "${shim[explicit_serve]}" "$repo") "$(unit_path explicit_serve)"
assert 'the machine unit preserves sessions across service restarts' bash -c 'grep -Fxq "Restart=always" "$1" && grep -Fxq "KillMode=process" "$1"' _ "$(machine_unit_path explicit_serve)"
assert 'the machine unit gives agent sessions the installing PATH' bash -c 'grep -q "^Environment=\"PATH=.*$2" "$1"' _ "$(machine_unit_path explicit_serve)" "${shim[explicit_serve]}"
assert 'serving setup prints the bookmark last' last_line_is "${output[explicit_serve]}" 'https://fixture.tailnet.ts.net/?token=fixture'
assert 'dependency installation requests both browser engines' grep -Fq 'playwright install chromium firefox' "$repo/install.sh"

new_case machine_state_idempotent
run_case machine_state_idempotent
first_machine_state=$(tree_state "$(machine_state_path machine_state_idempotent)")
first_secret=$(hash_file "$(machine_secret_path machine_state_idempotent)")
assert 'machine state directory and files have private modes' python3 -c 'import os,stat,sys; assert [stat.S_IMODE(os.stat(p).st_mode) for p in sys.argv[1:]] == [0o700,0o600,0o600,0o600]' "$(machine_state_path machine_state_idempotent)" "$(machine_secret_path machine_state_idempotent)" "$(machine_config_path machine_state_idempotent)" "$(machines_path machine_state_idempotent)"
assert 'machine state files contain the hub and this machine' python3 - "$(machine_config_path machine_state_idempotent)" "$(machines_path machine_state_idempotent)" "$(machine_secret_path machine_state_idempotent)" <<'PY'
import json, sys
config, machines, secret = map(lambda p: p, sys.argv[1:])
assert json.load(open(config)) == {
    'hub_url': 'http://127.0.0.1:7373/wheelchair',
    'secret_file': secret, 'host': '100.64.0.1', 'port': 7374,
}
assert json.load(open(machines)) == [{
    'name': 'fixture-host', 'host': '100.64.0.1', 'port': 7374, 'secret_file': secret,
}]
PY
run_case machine_state_idempotent
assert 'a rerun leaves the machine secret unchanged' bash -c '[[ $1 == "$2" ]]' _ "$first_secret" "$(hash_file "$(machine_secret_path machine_state_idempotent)")"
assert 'a rerun writes byte-identical machine state files' bash -c '[[ $1 == "$2" ]]' _ "$first_machine_state" "$(tree_state "$(machine_state_path machine_state_idempotent)")"

assert 'real CLAUDE.md is byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_claude_before" "$(file_state "$HOME/.claude/CLAUDE.md")"
assert 'real AGENTS.md is byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_codex_before" "$(file_state "$HOME/.codex/AGENTS.md")"
assert 'real Claude settings are byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_seen_settings_before" "$(file_state "$HOME/.claude/settings.json")"
assert 'real Codex hooks are byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_seen_hooks_before" "$(file_state "$HOME/.codex/hooks.json")"
assert 'real Codex config is byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_seen_config_before" "$(file_state "$HOME/.codex/config.toml")"

# Exercise Darwin with XML-sensitive HOME and a Tailscale app fallback.
case_platform=Darwin
new_case darwin
args[darwin]=--serve
home[darwin]="$fixture/darwin/home & <mac>"
mkdir -p "${home[darwin]}"
tty[darwin]=1
input[darwin]=$'y\ny\n'
case_tailscale_app="$fixture/tailscale app"
cp "${shim[darwin]}/tailscale" "$case_tailscale_app"
tailscale_absent[darwin]=1
run_case darwin
viewer_plist="${home[darwin]}/Library/LaunchAgents/com.wheelchair.viewer.plist"
machine_plist="${home[darwin]}/Library/LaunchAgents/com.wheelchair.machine.plist"
assert 'Darwin serve writes valid complete LaunchAgent plists' python3 - "$viewer_plist" "$machine_plist" "$repo" "${home[darwin]}" "${shim[darwin]}" <<'PYCODE'
import os, plistlib, stat, sys
viewer, machine, root, home, shim = sys.argv[1:]
for path, label in [(viewer, 'viewer'), (machine, 'machine')]:
    with open(path, 'rb') as f: p = plistlib.load(f)
    assert stat.S_IMODE(os.stat(path).st_mode) == 0o644
    assert p['Label'] == 'com.wheelchair.' + label
    assert p['ProgramArguments'] == [shim + '/node', root + ('/viewer/server.js' if label == 'viewer' else '/machine/service.js')] + (['--service'] if label == 'viewer' else [])
    assert p['RunAtLoad'] and p['KeepAlive'] and p['ThrottleInterval'] == 5
    assert p['WorkingDirectory'] == home
    assert p['StandardOutPath'] == p['StandardErrorPath'] == home + '/Library/Logs/wheelchair/' + label + '.log'
    assert p['EnvironmentVariables']['HOME'] == home and shim in p['EnvironmentVariables']['PATH']
    if label == 'viewer': assert p['EnvironmentVariables']['WHEELCHAIR_NO_BROWSER'] == '1'
    else: assert p['AbandonProcessGroup']
PYCODE
assert 'Darwin validates and bootstraps both plists' bash -c '[[ $(grep -c "^plutil -lint " "$1") == 2 && $(grep -c "^launchctl bootstrap " "$1") == 2 && $(grep -c "^launchctl bootout " "$1") == 2 ]]' _ "$(log_path darwin)"
assert 'Darwin app fallback runs serve without sudo' bash -c '[[ $(grep -c "^tailscale serve --bg" "$1") == 2 ]] && ! grep -q "^sudo " "$1"' _ "$(log_path darwin)"
assert 'Darwin prints the sudo helper and login messages' bash -c '[[ $1 == *"sudo helper: not available on macOS"* && $1 == *"services run while you are logged in"* ]]' _ "${output[darwin]}"
# Preserve the app shim when run_case removes the PATH shim on subsequent runs.
input[darwin]=''
run_case darwin
assert 'Darwin rerun boots out and bootstraps both agents again' bash -c '[[ $(grep -c "^launchctl bootout " "$1") == 4 && $(grep -c "^launchctl bootstrap " "$1") == 4 ]]' _ "$(log_path darwin)"
args[darwin]=--no-serve
serve_status[darwin]=$(status_with_handlers '{"/wheelchair":{"Proxy":"http://127.0.0.1:7373/wheelchair"},"/":{"Proxy":"http://127.0.0.1:7373"}}')
run_case darwin
assert 'Darwin disable boots out and removes both agents' bash -c '[[ ! -e $1 && ! -e $2 && $(grep -c "^launchctl bootout " "$3") == 6 ]]' _ "$viewer_plist" "$machine_plist" "$(log_path darwin)"
assert 'Darwin removal commands omit sudo' bash -c '[[ $1 == *"serve --https=443 --set-path /wheelchair off"* && $1 == *"serve --https=443 --set-path / off"* && $1 != *"sudo tailscale serve"* ]]' _ "${output[darwin]}"
unset case_platform case_tailscale_app

new_case screen_missing
restricted_path[screen_missing]=1
args[screen_missing]=--serve
run_case screen_missing
expected_screen_warning="screens: warning — missing Xvfb, xauth, mcookie, ffmpeg, xdotool, xwininfo, systemd-run; agents can't use screens until they're installed (Debian: sudo apt install xvfb xauth util-linux ffmpeg xdotool x11-utils systemd)"
assert 'Linux screen warning lists missing tools and unique packages' bash -c '[[ $1 == *"$2"* ]]' _ "${output[screen_missing]}" "$expected_screen_warning"
assert 'missing screen tools do not print optional window manager hint' bash -c '[[ $1 != *"screens: optional"* ]]' _ "${output[screen_missing]}"
assert 'screen warning leaves bookmark last' last_line_is "${output[screen_missing]}" 'https://fixture.tailnet.ts.net/?token=fixture'
assert 'screen warning leaves the exit status at 0' bash -c '[[ $1 == 0 ]]' _ "${status[screen_missing]}"
new_case screen_partial
restricted_path[screen_partial]=1
args[screen_partial]=--serve
for tool in Xvfb xauth mcookie ffmpeg; do
  printf '#!/usr/bin/env bash\nexit 0\n' > "${shim[screen_partial]}/$tool"
  chmod +x "${shim[screen_partial]}/$tool"
done
run_case screen_partial
assert 'Linux screen warning names only the missing tools and their packages' bash -c '[[ $1 == *"$2"* && $3 == 0 ]]' _ "${output[screen_partial]}" "screens: warning — missing xdotool, xwininfo, systemd-run; agents can't use screens until they're installed (Debian: sudo apt install xdotool x11-utils systemd)" "${status[screen_partial]}"
assert 'partially missing screen tools do not print optional window manager hint' bash -c '[[ $1 != *"screens: optional"* ]]' _ "${output[screen_partial]}"
new_case screen_present
restricted_path[screen_present]=1
args[screen_present]=--serve
for tool in Xvfb xauth mcookie ffmpeg xdotool xwininfo systemd-run systemctl; do
  printf '#!/usr/bin/env bash\nexit 0\n' > "${shim[screen_present]}/$tool"
  chmod +x "${shim[screen_present]}/$tool"
done
run_case screen_present
assert 'Linux with screen tools prints optional window manager hint only' bash -c '[[ $1 == *"screens: optional — no window manager; for apps that need one: sudo apt install openbox"* && $1 != *"screens: warning"* && $2 == 0 ]]' _ "${output[screen_present]}" "${status[screen_present]}"
assert 'optional screen hint leaves bookmark last' last_line_is "${output[screen_present]}" 'https://fixture.tailnet.ts.net/?token=fixture'
new_case screen_wm
restricted_path[screen_wm]=1
args[screen_wm]=--serve
for tool in Xvfb xauth mcookie ffmpeg xdotool xwininfo systemd-run systemctl openbox xprop; do
  printf '#!/usr/bin/env bash\nexit 0\n' > "${shim[screen_wm]}/$tool"
  chmod +x "${shim[screen_wm]}/$tool"
done
run_case screen_wm
assert 'Linux with screen tools and openbox prints no screen message' bash -c '[[ $1 != *"screens:"* && $2 == 0 ]]' _ "${output[screen_wm]}" "${status[screen_wm]}"
case_platform=Darwin
new_case screen_darwin
restricted_path[screen_darwin]=1
run_case screen_darwin
assert 'Darwin prints no screen warning' bash -c '[[ $1 != *"screens:"* && $2 == 0 ]]' _ "${output[screen_darwin]}" "${status[screen_darwin]}"
unset case_platform

new_case sudo_hint
run_case sudo_hint
assert 'missing sudo helper prints install hint and no test password' bash -c '[[ $1 == *"sudo helper not installed; to let agents ask for sudo from a card, run: sudo $2/sudo-helper/install.sh"* ]] && [[ $1 != *hunter2-TESTPW-9f3a* ]]' _ "${output[sudo_hint]}" "$repo"
for captured in ${output[@]+"${output[@]}"}; do [[ $captured != *hunter2-TESTPW-9f3a* ]] || fail "test password appeared in output"; done
if grep -R -F -q "hunter2-TESTPW-9f3a" "$fixture"; then fail "test password appeared in fixture"; fi

real_wheelchair_after=$(real_wheelchair_state "$HOME/.wheelchair")
real_wheelchair_error=$(real_wheelchair_mismatch "$real_wheelchair_before" "$real_wheelchair_after")
if [[ -z $real_wheelchair_error ]]; then
  pass 'real wheelchair files the installer writes are byte-identical after suite'
else
  fail "$real_wheelchair_error"
fi

printf 'RESULT %d passed, %d failed\n' "$passes" "$failures"
(( failures == 0 ))
