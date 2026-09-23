#!/usr/bin/env bash
# Render workflow entry points into present harnesses, install the viewer's deps, and optionally
# make the viewer a persistent, tailnet-only service. Idempotent.
#
# The wrappers are rendered rather than symlinked because a wrapper has to name an ABSOLUTE path: a
# command runs with some other repo as its working directory, so a relative path resolves nowhere.
# The repo therefore cannot contain a real path — it carries the {{WHEELCHAIR_ROOT}} placeholder and
# this script substitutes wherever the clone actually is. Editing anything under protocol/ still
# takes effect immediately in each rendered harness, because the wrapper points back into this
# working tree. Editing a wrapper itself needs a re-run.
#
# One thing here is rendered rather than pointed at, so editing it DOES need a re-run: the
# delimited region of protocol/sensitivity.md that the last normal-install step writes into each
# present global harness file. Those files sit outside this tree; only the bytes between the markers
# are this repo's, and only they are overwritten. /diagram-sensitivity drives the same writer, so a
# re-run of this script is not the only way to move the dial.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cache_root="$HOME/.cache/agent-graphs"
serving_file="$cache_root/.serving"
unit_file="$HOME/.config/systemd/user/wheelchair-viewer.service"
port=7373

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

# This comes before every install action. The command succeeds when there is no viewer, and a
# failure must not prevent wrapper installation or a service upgrade.
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

  npx --prefix "$ROOT/viewer" playwright install chromium firefox
  echo "viewer chromium: installed"
fi

if "$ROOT/sensitivity/set.sh"; then
  echo "diagram sensitivity: installed"
else
  echo "diagram sensitivity: warning — not installed" >&2
fi

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
  [[ $(uname -s) == Darwin || -n ${DISPLAY:-} || -n ${WAYLAND_DISPLAY:-} ]]
}

is_serving() {
  [[ -f $serving_file ]] && grep -Eq '"serve"[[:space:]]*:[[:space:]]*true' "$serving_file" &&
    grep -Eq '"origin"[[:space:]]*:[[:space:]]*"[^"[:space:]]+"' "$serving_file"
}

write_not_serving() {
  mkdir -p "$cache_root"
  printf '{"serve": false}\n' > "$serving_file"
}

ask_yes() {  # ask_yes <prompt>; answers yes only for y or yes
  local answer
  printf '%s [y/N] ' "$1" >&2
  IFS= read -r answer || answer=''
  [[ $answer == y || $answer == Y || $answer == yes || $answer == YES || $answer == Yes ]]
}

served_origin() {
  local status dns_name
  if ! command -v tailscale >/dev/null 2>&1; then
    echo 'viewer: tailscale is not installed; serving was not configured' >&2
    return 1
  fi
  if ! status=$(tailscale status --json); then
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
  [[ $(uname -s) == Linux && -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1
}

configure_tailscale_serve() {
  local command_text="sudo tailscale serve --bg $port"
  if tailscale serve status 2>/dev/null | grep -Fq "$port"; then
    return
  fi
  printf 'viewer: %s\n' "$command_text"
  if has_terminal && ask_yes 'viewer: run that command now?'; then
    sudo tailscale serve --bg "$port"
  else
    printf 'viewer: run later: %s\n' "$command_text"
  fi
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
  mkdir -p "$cache_root" "${unit_file%/*}"
  printf '{"serve": true, "origin": "%s"}\n' "$origin" > "$serving_file"
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
  systemctl --user daemon-reload
  systemctl --user enable --now wheelchair-viewer.service
  systemctl --user restart wheelchair-viewer.service
  if ! loginctl enable-linger "$USER"; then
    printf 'viewer: run later: sudo loginctl enable-linger %s\n' "$USER" >&2
    echo 'viewer: warning — the viewer service will stop at logout until lingering is enabled' >&2
  fi
  configure_tailscale_serve
  node "$ROOT/viewer/server.js" --url
}

disable_service() {
  if platform_supports_serving; then
    systemctl --user disable --now wheelchair-viewer.service || true
    rm -f "$unit_file"
    systemctl --user daemon-reload
  fi
  write_not_serving
  echo "viewer: run later: sudo tailscale serve --https=443 off"
}

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
