#!/usr/bin/env bash
# Remove retired harness entries, render diagram sensitivity, install viewer dependencies,
# and optionally make the viewer a persistent, tailnet-only service. Idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Before anything else, the viewer stop included: from a worktree this script would take over the machine.
. "$ROOT/install/guard.sh"
guard_canonical_clone "$ROOT" "${0##*/}"
cache_root="$HOME/.cache/agent-graphs"
serving_file="$cache_root/.serving"
unit_file="$HOME/.config/systemd/user/wheelchair-viewer.service"
machine_unit_file="$HOME/.config/systemd/user/wheelchair-machine.service"
viewer_plist="$HOME/Library/LaunchAgents/com.wheelchair.viewer.plist"
machine_plist="$HOME/Library/LaunchAgents/com.wheelchair.machine.plist"
machine_state_dir="$HOME/.local/state/wheelchair"
machine_config_file="$machine_state_dir/machine.json"
machines_file="$machine_state_dir/machines.json"
machine_secret_file="$machine_state_dir/machine.secret"
port=7373

# Testing seams: WHEELCHAIR_PLATFORM overrides uname, WHEELCHAIR_SYSTEMD_RUN_DIR
# overrides /run/systemd/system, and WHEELCHAIR_TAILSCALE_APP overrides the Mac app path.
platform() { printf '%s\n' "${WHEELCHAIR_PLATFORM:-$(uname -s)}"; }
tailscale_cli() {
  if command -v tailscale >/dev/null 2>&1; then
    printf '%s\n' tailscale
  elif [[ $(platform) == Darwin && -x ${WHEELCHAIR_TAILSCALE_APP:-/Applications/Tailscale.app/Contents/MacOS/Tailscale} ]]; then
    printf '%s\n' "${WHEELCHAIR_TAILSCALE_APP:-/Applications/Tailscale.app/Contents/MacOS/Tailscale}"
  else
    return 1
  fi
}

claude_home=${WHEELCHAIR_CLAUDE_HOME:-"$HOME/.claude"}
codex_home=${WHEELCHAIR_CODEX_HOME:-"$HOME/.codex"}

# Testing seam: when set (including to empty), this replaces PATH detection.
if [[ ${WHEELCHAIR_PRESENT+x} ]]; then
  case ",$WHEELCHAIR_PRESENT," in *,claude,*) claude_present=1 ;; *) claude_present=0 ;; esac
  case ",$WHEELCHAIR_PRESENT," in *,codex,*) codex_present=1 ;; *) codex_present=0 ;; esac
  case ",$WHEELCHAIR_PRESENT," in *,agy,*) agy_present=1 ;; *) agy_present=0 ;; esac
  case ",$WHEELCHAIR_PRESENT," in *,kimi,*) kimi_present=1 ;; *) kimi_present=0 ;; esac
else
  command -v claude >/dev/null 2>&1 && claude_present=1 || claude_present=0
  command -v codex >/dev/null 2>&1 && codex_present=1 || codex_present=0
  command -v agy >/dev/null 2>&1 && agy_present=1 || agy_present=0
  if command -v kimi >/dev/null 2>&1 || [[ -x $HOME/.kimi-code/bin/kimi ]]; then kimi_present=1; else kimi_present=0; fi
fi

if (( ! claude_present && ! codex_present && ! agy_present && ! kimi_present )); then
  printf '%s: no claude, codex, agy or kimi found; installed nothing\n' "${0##*/}" >&2
  exit 1
fi

# This comes before every install action. The command succeeds when there is no viewer, and a
# failure must not prevent installation or a service upgrade.
node "$ROOT/viewer/server.js" --stop --if-stale || echo "viewer: warning — could not stop the running viewer" >&2

serve_flag=''
case $# in
  0) ;;
  1)
    case $1 in
      --serve) serve_flag=serve ;;
      --no-serve) serve_flag=no-serve ;;
      *) printf '%s: unsupported argument: %s\n' "${0##*/}" "$1" >&2; exit 2 ;;
    esac
    ;;
  *) printf '%s: unsupported arguments: %s\n' "${0##*/}" "$*" >&2; exit 2 ;;
esac

(( claude_present )) && printf 'harness found: claude\n'
(( codex_present )) && printf 'harness found: codex\n'
(( agy_present )) && printf 'harness found: agy\n'
(( kimi_present )) && printf 'harness found: kimi\n'
if [[ $(platform) == Darwin ]]; then
  echo "sudo helper: not available on macOS; sudo cards won't work on this machine"
elif [[ ! -f ${WHEELCHAIR_SUDO_TEST_ROOT:-}/etc/systemd/system/wheelchair-sudo.service || ! -f ${WHEELCHAIR_SUDO_TEST_ROOT:-}/usr/local/lib/wheelchair-sudo/helper.py ]]; then
  printf 'sudo helper not installed; to let agents ask for sudo from a card, run: sudo %s/sudo-helper/install.sh\n' "$ROOT"
fi

# Remove only retired wrappers that name their old protocol file or point to its wrapper.
remove_retired() {  # path, wrapper file, expected protocol file, symlink suffix
  local path=$1 file=$2 protocol=$3 suffix=$4 target
  if [[ -L $path ]]; then
    target=$(readlink "$path")
    [[ $target == *"$suffix" ]] || return 0
  elif [[ -f $file ]] && grep -Eq "^Read \`?/.*/protocol/${protocol}\.md(\`|[[:space:]]|$)" "$file"; then
    :
  else
    return 0
  fi
  rm -rf "$path"
  echo "removed old wrapper: $path"
}

retired_names=(spine plan adopt plan-review implement verify graph diagram-sensitivity)
retired_files=(spine planning adopt plan-review implementation verification graphs sensitivity)
for i in "${!retired_names[@]}"; do
  name=${retired_names[$i]}
  protocol=${retired_files[$i]}
  if (( claude_present )); then
    path="$claude_home/skills/$name"
    remove_retired "$path" "$path/SKILL.md" "$protocol" "/skills/$name"
  fi
  if (( codex_present )); then
    path="$codex_home/prompts/$name.md"
    remove_retired "$path" "$path" "$protocol" "/codex/prompts/$name.md"
  fi
done

if (( claude_present || codex_present || agy_present || kimi_present )); then
  if "$ROOT/codex/model.sh" init; then
    echo "codex models: initialized"
  else
    echo "codex models: warning — not initialized" >&2
  fi
fi

# Testing seam: setting this to 1 skips the viewer dependency installs.
if [[ ${WHEELCHAIR_SKIP_DEPS:-} == 1 ]]; then
  echo "viewer deps: skipped"
  echo "viewer chromium: skipped"
else
  npm --prefix "$ROOT/viewer" install
  echo "viewer deps: installed"

  npx --prefix "$ROOT/viewer" playwright install chromium firefox
  echo "viewer chromium: installed"
fi

present=''
(( claude_present )) && present+=claude,
(( codex_present )) && present+=codex,
python3 -I "$ROOT/install/unseen.py" "$ROOT" "$claude_home" "$codex_home" "$present" || echo "seen hook: warning — cleanup failed" >&2

if "$ROOT/sensitivity/set.sh"; then
  echo "diagram sensitivity: installed"
else
  echo "diagram sensitivity: warning — not installed" >&2
fi

machine_host() {
  local host
  host=$("$(tailscale_cli)" ip -4 2>/dev/null || true)
  host=${host%%$'\n'*}
  if [[ -n $host ]]; then
    printf '%s\n' "$host"
  else
    printf '%s\n' '127.0.0.1'
  fi
}

configure_machine_state() {
  local host name
  mkdir -p "$machine_state_dir"
  chmod 700 "$machine_state_dir"
  if [[ ! -e $machine_secret_file ]]; then
    (umask 077; od -An -N32 -tx1 /dev/urandom | tr -d ' \n' > "$machine_secret_file")
    chmod 600 "$machine_secret_file"
  fi
  host=$(machine_host)
  if [[ ! -e $machine_config_file ]]; then
    printf '{"hub_url":"http://127.0.0.1:7373/wheelchair","secret_file":"%s","host":"%s","port":7374}\n' \
      "$machine_secret_file" "$host" > "$machine_config_file"
    chmod 600 "$machine_config_file"
  fi
  if [[ ! -e $machines_file ]]; then
    name=$(hostname)
    printf '[{"name":"%s","host":"%s","port":7374,"secret_file":"%s"}]\n' \
      "$name" "$host" "$machine_secret_file" > "$machines_file"
    chmod 600 "$machines_file"
  fi
}

configure_machine_state

# Testing seam: WHEELCHAIR_TTY=1 or 0 replaces the terminal check. Production always uses the
# actual terminal, while DISPLAY and WAYLAND_DISPLAY remain normal environment checks.
has_terminal() {
  if [[ ${WHEELCHAIR_TTY+x} ]]; then
    [[ $WHEELCHAIR_TTY == 1 ]]
  else
    [[ -t 0 && -t 1 ]]
  fi
}

has_display() {
  [[ $(platform) == Darwin || -n ${DISPLAY:-} || -n ${WAYLAND_DISPLAY:-} ]]
}

is_serving() {
  [[ -f $serving_file ]] && grep -Eq '"serve"[[:space:]]*:[[:space:]]*true' "$serving_file" &&
    grep -Eq '"origin"[[:space:]]*:[[:space:]]*"[^"[:space:]]+"' "$serving_file"
}

write_not_serving() {  # write_not_serving [origin]
  mkdir -p "$cache_root"
  if [[ -n ${1:-} ]]; then
    printf '{"serve": false, "origin": "%s"}\n' "$1" > "$serving_file"
  else
    printf '{"serve": false}\n' > "$serving_file"
  fi
}

ask_yes() {  # ask_yes <prompt>; answers yes only for y or yes
  local answer
  printf '%s [y/N] ' "$1" >&2
  IFS= read -r answer || answer=''
  [[ $answer == y || $answer == Y || $answer == yes || $answer == YES || $answer == Yes ]]
}

served_origin() {
  local status dns_name ts
  if ! ts=$(tailscale_cli); then
    echo 'viewer: tailscale is not installed; serving was not configured' >&2
    return 1
  fi
  if ! status=$("$ts" status --json); then
    echo 'viewer: could not read tailscale status; serving was not configured' >&2
    return 1
  fi
  dns_name=$(sed -n 's/.*"DNSName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<<"$status" | head -n 1)
  dns_name=${dns_name%.}
  if [[ -z $dns_name ]]; then
    echo 'viewer: tailscale has no DNS name; serving was not configured' >&2
    return 1
  fi
  printf 'https://%s\n' "$dns_name"
}

platform_supports_serving() {
  if [[ $(platform) == Darwin ]]; then
    command -v launchctl >/dev/null 2>&1
  else
    [[ $(platform) == Linux && -d ${WHEELCHAIR_SYSTEMD_RUN_DIR:-/run/systemd/system} ]] && command -v systemctl >/dev/null 2>&1
  fi
}

# Prints the state of the two mappings, one per line: missing, viewer, or other.
# Tailscale's text status is deliberately not used: its shape is presentation, not an API.
tailscale_mapping_states() {  # tailscale_mapping_states <origin>
  local status host states ts
  host=${1#https://}
  host=${host%%/*}

  if ! ts=$(tailscale_cli); then
    echo 'viewer: tailscale is not installed; Tailscale Serve was not changed' >&2
    return 1
  fi
  if ! status=$("$ts" serve status --json); then
    echo 'viewer: could not read tailscale serve status; Tailscale Serve was not changed' >&2
    return 1
  fi
  if ! states=$(node -e '
    const [text, host, port] = process.argv.slice(1);
    const status = JSON.parse(text);
    if (status === null || typeof status !== "object" || Array.isArray(status)) throw new Error("invalid status");
    if (status.Web !== undefined && (status.Web === null || typeof status.Web !== "object" || Array.isArray(status.Web))) throw new Error("invalid Web");
    const handlers = status.Web?.[`${host}:443`]?.Handlers;
    if (handlers !== undefined && (handlers === null || typeof handlers !== "object" || Array.isArray(handlers))) throw new Error("invalid Handlers");
    const has = (path) => Object.prototype.hasOwnProperty.call(handlers || {}, path);
    const pointsAtViewer = (handler) => typeof handler?.Proxy === "string" &&
      (handler.Proxy === `http://127.0.0.1:${port}` || handler.Proxy.startsWith(`http://127.0.0.1:${port}/`));
    const prefix = ["/wheelchair", "/wheelchair/"];
    const prefixState = prefix.some((path) => pointsAtViewer(handlers?.[path])) ? "viewer" :
      prefix.some(has) ? "other" : "missing";
    const rootState = !has("/") ? "missing" : pointsAtViewer(handlers["/"]) ? "viewer" : "other";
    process.stdout.write(`${prefixState}\n${rootState}\n`);
  ' "$status" "$host" "$port" 2>/dev/null); then
    echo 'viewer: tailscale serve status returned malformed JSON; Tailscale Serve was not changed' >&2
    return 1
  fi
  printf '%s\n' "$states"
}

offer_tailscale_serve() {  # offer_tailscale_serve <display command> <tailscale arguments...>
  local command_text=$1
  shift
  printf 'viewer: %s\n' "$command_text"
  if has_terminal && ask_yes 'viewer: run that command now?'; then
    if [[ $(platform) == Darwin ]]; then
      "$(tailscale_cli)" "$@"
    else
      sudo "$(tailscale_cli)" "$@"
    fi
  else
    printf 'viewer: run later: %s\n' "$command_text"
  fi
}

configure_tailscale_serve() {  # configure_tailscale_serve <origin>
  local states wheelchair_state root_state prefix ts
  if ! states=$(tailscale_mapping_states "$1"); then
    return
  fi
  ts=$(tailscale_cli) || return
  prefix="sudo $ts"
  [[ $(platform) == Darwin ]] && prefix=$ts
  wheelchair_state=${states%%$'\n'*}
  root_state=${states##*$'\n'}

  if [[ $wheelchair_state == missing ]]; then
    offer_tailscale_serve \
      "$prefix serve --bg --set-path /wheelchair http://127.0.0.1:$port/wheelchair" \
      serve --bg --set-path /wheelchair "http://127.0.0.1:$port/wheelchair"
  fi
  if [[ $root_state == missing ]]; then
    offer_tailscale_serve "$prefix serve --bg $port" serve --bg "$port"
  fi
}

xml_escape() {
  printf '%s' "$1" | sed -e 's/\&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

configure_launch_agents() {
  local node_path=$1 service_path=$2 label plist script extra env_extra log domain result
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/wheelchair"
  domain="gui/$(id -u)"
  for label in viewer machine; do
    if [[ $label == viewer ]]; then plist=$viewer_plist; else plist=$machine_plist; fi
    script="$ROOT/$label/service.js"
    extra=''
    env_extra=''
    if [[ $label == viewer ]]; then
      script="$ROOT/viewer/server.js"
      extra='<string>--service</string>'
      env_extra='<key>WHEELCHAIR_NO_BROWSER</key><string>1</string>'
    else
      extra=''
    fi
    log="$HOME/Library/Logs/wheelchair/$label.log"
    cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.wheelchair.$label</string>
<key>ProgramArguments</key><array><string>$(xml_escape "$node_path")</string><string>$(xml_escape "$script")</string>$extra</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>5</integer>
<key>WorkingDirectory</key><string>$(xml_escape "$HOME")</string>
<key>StandardOutPath</key><string>$(xml_escape "$log")</string><key>StandardErrorPath</key><string>$(xml_escape "$log")</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>$(xml_escape "$service_path")</string><key>HOME</key><string>$(xml_escape "$HOME")</string>$env_extra</dict>
$([[ $label == machine ]] && printf '%s' '<key>AbandonProcessGroup</key><true/>')
</dict></plist>
EOF
    chmod 644 "$plist"
    if ! plutil -lint "$plist"; then
      printf 'viewer: invalid plist: %s\n' "$plist" >&2
      return 1
    fi
    launchctl bootout "$domain/com.wheelchair.$label" >/dev/null 2>&1 || true
    if ! result=$(launchctl bootstrap "$domain" "$plist" 2>&1); then
      printf 'viewer: could not start com.wheelchair.%s: %s\n' "$label" "$result" >&2
    fi
  done
  echo 'viewer: on macOS the services run while you are logged in; to keep this Mac serving, turn on automatic login and stop it sleeping (see README, "On macOS")'
}

configure_service() {
  local origin node_path
  if ! platform_supports_serving; then
    echo "viewer: serving isn't supported on this platform; installed everything else" >&2
    return
  fi
  if ! origin=$(served_origin); then
    return
  fi
  node_path=$(command -v node)
  mkdir -p "$cache_root"
  printf '{"serve": true, "origin": "%s"}\n' "$origin" > "$serving_file"
  # systemd starts user services with a bare PATH, and every agent session inherits the
  # service's PATH through tmux. Give it this login's PATH, led by the CLI directories.
  service_path=$PATH
  for cli in codex claude agy kimi; do
    cli_path=$(command -v "$cli" 2>/dev/null) || {
      [[ $cli == kimi && -x $HOME/.kimi-code/bin/kimi ]] || continue
      cli_path=$HOME/.kimi-code/bin/kimi
    }
    service_path="${cli_path%/*}:$service_path"
  done
  if [[ $(platform) == Darwin ]]; then
    configure_launch_agents "$node_path" "$service_path"
  else
  mkdir -p "${unit_file%/*}"
  cat > "$unit_file" <<EOF
[Unit]
Description=Wheelchair graph viewer

[Service]
ExecStart=$node_path $ROOT/viewer/server.js --service
Environment=WHEELCHAIR_NO_BROWSER=1
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
EOF
  cat > "$machine_unit_file" <<EOF
[Unit]
Description=Wheelchair machine service

[Service]
ExecStart=$node_path $ROOT/machine/service.js
Environment="PATH=$service_path"
Restart=always
RestartSec=2
KillMode=process

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now wheelchair-viewer.service
  systemctl --user enable --now wheelchair-machine.service
  systemctl --user restart wheelchair-viewer.service
  systemctl --user restart wheelchair-machine.service
  # Ask first: without a terminal an unneeded enable-linger is refused, which would warn
  # about a setting that is already on.
  if [[ $(loginctl show-user "$USER" -p Linger --value 2>/dev/null) != yes ]] &&
      ! loginctl enable-linger "$USER"; then
    printf 'viewer: run later: sudo loginctl enable-linger %s\n' "$USER" >&2
    echo 'viewer: warning — the viewer service will stop at logout until lingering is enabled' >&2
  fi
  fi
  configure_tailscale_serve "$origin"
  node "$ROOT/viewer/server.js" --url
}

recorded_origin() {
  local origin
  [[ -f $serving_file ]] || return 1
  origin=$(sed -n 's/.*"origin"[[:space:]]*:[[:space:]]*"\([^"[:space:]]*\)".*/\1/p' "$serving_file" | head -n 1)
  [[ -n $origin ]] || return 1
  printf '%s\n' "$origin"
}

disable_service() {
  local origin states wheelchair_state root_state prefix ts label
  origin=$(recorded_origin || true)
  if platform_supports_serving; then
    if [[ $(platform) == Darwin ]]; then
      for label in viewer machine; do
        launchctl bootout "gui/$(id -u)/com.wheelchair.$label" >/dev/null 2>&1 || true
        if [[ $label == viewer ]]; then rm -f "$viewer_plist"; else rm -f "$machine_plist"; fi
      done
    else
    systemctl --user disable --now wheelchair-viewer.service || true
    systemctl --user disable --now wheelchair-machine.service || true
    rm -f "$unit_file"
    rm -f "$machine_unit_file"
    systemctl --user daemon-reload
    fi
  fi
  write_not_serving "$origin"
  if [[ -z $origin ]]; then
    echo "viewer: this machine isn't set up to serve the viewer; there is nothing to remove" >&2
    return
  fi
  if ! states=$(tailscale_mapping_states "$origin"); then
    return
  fi
  wheelchair_state=${states%%$'\n'*}
  root_state=${states##*$'\n'}
  ts=$(tailscale_cli) || return
  prefix="sudo $ts"
  [[ $(platform) == Darwin ]] && prefix=$ts
  if [[ $wheelchair_state == viewer ]]; then
    echo "viewer: run later: $prefix serve --https=443 --set-path /wheelchair off"
  fi
  if [[ $root_state == viewer ]]; then
    echo "viewer: run later: $prefix serve --https=443 --set-path / off"
  fi
}

if [[ $(platform) == Linux ]]; then
  # Keep these tools in step with TOOLS in machine/lib/screen.js.
  missing_tools=() missing_packages=()
  for tool in Xvfb xauth mcookie ffmpeg xdotool xwininfo systemd-run systemctl; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      missing_tools+=("$tool")
      case $tool in
        Xvfb) package=xvfb ;; xauth) package=xauth ;; mcookie) package=util-linux ;;
        ffmpeg) package=ffmpeg ;; xdotool) package=xdotool ;; xwininfo) package=x11-utils ;;
        systemd-run|systemctl) package=systemd ;;
      esac
      seen=0
      for existing in "${missing_packages[@]}"; do [[ $existing == "$package" ]] && seen=1; done
      [[ $seen == 1 ]] || missing_packages+=("$package")
    fi
  done
  if (( ${#missing_tools[@]} )); then
    names=$(printf ', %s' "${missing_tools[@]}")
    printf "screens: warning — missing %s; agents can't use screens until they're installed (Debian: sudo apt install %s)\n" "${names:2}" "${missing_packages[*]}" >&2
  fi
fi

case $serve_flag in
  no-serve)
    disable_service
    ;;
  serve)
    configure_service
    ;;
  '')
    if is_serving; then
      configure_service
    elif [[ ! -e $serving_file ]]; then
      if has_display; then
        write_not_serving
      elif has_terminal; then
        if ask_yes 'viewer: set up this machine as an always-on viewer?'; then
          configure_service
        else
          write_not_serving
        fi
      else
        echo 'viewer: no display and no terminal; serving was not configured' >&2
      fi
    fi
    ;;
esac
