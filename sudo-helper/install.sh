#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../install/guard.sh
. "$ROOT/install/guard.sh"
guard_canonical_clone "$ROOT" sudo-helper/install.sh
if [[ ! ${WHEELCHAIR_SUDO_TEST_ROOT+x} && $EUID -ne 0 ]] || [[ -z ${SUDO_USER:-} || ${SUDO_USER:-} == root ]]; then
  echo 'Run with sudo as a non-root user.' >&2
  exit 2
fi
if (( $# > 1 )) || { (( $# == 1 )) && [[ $1 != --uninstall ]]; }; then
  echo 'Usage: sudo-helper/install.sh [--uninstall]' >&2
  exit 2
fi
R=${WHEELCHAIR_SUDO_TEST_ROOT:-}
dir=$R/usr/local/lib/wheelchair-sudo
config=$R/etc/wheelchair-sudo.conf
unit=$R/etc/systemd/system/wheelchair-sudo.service
if [[ ${1:-} == --uninstall ]]; then
  systemctl disable --now wheelchair-sudo.service
  rm -f "$unit" "$config"
  rm -rf "$dir"
  tailscale serve --https=8445 off
  systemctl daemon-reload
  exit 0
fi
if ! status=$(tailscale status --json 2>/dev/null) || ! dns=$(printf '%s' "$status" | /usr/bin/python3 -c 'import json,sys
try:
    value = json.load(sys.stdin)["Self"]["DNSName"]
    assert isinstance(value, str) and value.rstrip(".")
    print(value.rstrip("."))
except (ValueError, KeyError, TypeError, AssertionError):
    sys.exit(1)' 2>/dev/null); then
  echo 'Tailscale is not up or has no DNS name.' >&2
  exit 1
fi
install -d -m 0755 "$dir/static" "${config%/*}" "${unit%/*}"
install -m 0644 "$ROOT/sudo-helper/helper.py" "$dir/helper.py"
for file in page.html page.js page.css; do
  install -m 0644 "$ROOT/sudo-helper/static/$file" "$dir/static/$file"
done
printf 'user=%s\nurl_base=https://%s:8445\n' "$SUDO_USER" "$dns" > "$config"
cat > "$unit" <<'UNIT'
[Unit]
Description=wheelchair sudo helper
After=network.target

[Service]
User=root
ExecStart=/usr/bin/python3 /usr/local/lib/wheelchair-sudo/helper.py --config /etc/wheelchair-sudo.conf
RuntimeDirectory=wheelchair-sudo
RuntimeDirectoryMode=0755
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
chmod 0644 "$config" "$unit"
if [[ ! ${WHEELCHAIR_SUDO_TEST_ROOT+x} ]]; then
  chown root:root "$dir" "$dir/static" "$dir/helper.py" "$dir/static/"* "$config" "$unit"
fi
systemctl daemon-reload
systemctl enable wheelchair-sudo.service
systemctl restart wheelchair-sudo.service
tailscale serve --bg --https=8445 unix:/run/wheelchair-sudo/page.sock
