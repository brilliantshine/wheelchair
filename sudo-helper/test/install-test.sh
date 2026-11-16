#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/wheelchair-sudo-test.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/tree/sudo-helper/static" "$tmp/tree/install" "$tmp/bin" "$tmp/root"
cp "$repo/sudo-helper/install.sh" "$tmp/tree/sudo-helper/install.sh"
cp "$repo/install/guard.sh" "$tmp/tree/install/guard.sh"
for file in helper.py static/page.html static/page.js static/page.css; do
  if [[ -f $repo/sudo-helper/$file ]]; then cp "$repo/sudo-helper/$file" "$tmp/tree/sudo-helper/$file"; else printf 'fixture %s\n' "$file" > "$tmp/tree/sudo-helper/$file"; fi
done
cat > "$tmp/bin/systemctl" <<'SHIM'
#!/usr/bin/env bash
printf 'systemctl %s\n' "$*" >> "$SHIM_LOG"
SHIM
cat > "$tmp/bin/tailscale" <<'SHIM'
#!/usr/bin/env bash
printf 'tailscale %s\n' "$*" >> "$SHIM_LOG"
if [[ $1 == status ]]; then printf '%s\n' '{"Self":{"DNSName":"fixture.tailnet.ts.net."}}'; fi
SHIM
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH" SHIM_LOG="$tmp/calls" WHEELCHAIR_SUDO_TEST_ROOT="$tmp/root" WHEELCHAIR_ALLOW_WORKTREE=1 SUDO_USER
SUDO_USER=$(id -un)
installer=$tmp/tree/sudo-helper/install.sh
"$installer"
dir=$tmp/root/usr/local/lib/wheelchair-sudo
[[ $(stat -c %a "$dir") == 755 && $(stat -c %a "$dir/static") == 755 ]]
for file in helper.py static/page.html static/page.js static/page.css; do
  cmp "$tmp/tree/sudo-helper/$file" "$dir/$file"
  [[ $(stat -c %a "$dir/$file") == 644 ]]
done
config=$tmp/root/etc/wheelchair-sudo.conf
unit=$tmp/root/etc/systemd/system/wheelchair-sudo.service
[[ $(stat -c %a "$config") == 644 && $(stat -c %a "$unit") == 644 ]]
printf 'user=%s\nurl_base=https://fixture.tailnet.ts.net:8445\n' "$SUDO_USER" | cmp - "$config"
cat > "$tmp/expected-unit" <<'UNIT'
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
cmp "$tmp/expected-unit" "$unit"
cat > "$tmp/expected-calls" <<'CALLS'
tailscale status --json
systemctl daemon-reload
systemctl enable wheelchair-sudo.service
systemctl restart wheelchair-sudo.service
tailscale serve --bg --https=8445 unix:/run/wheelchair-sudo/page.sock
CALLS
cmp "$tmp/expected-calls" "$SHIM_LOG"
first=$(find "$tmp/root" -type f -exec sha256sum {} + | sort)
"$installer"
[[ $first == "$(find "$tmp/root" -type f -exec sha256sum {} + | sort)" ]]
cat "$tmp/expected-calls" "$tmp/expected-calls" | cmp - "$SHIM_LOG"
"$installer" --uninstall
[[ ! -e $dir && ! -e $config && ! -e $unit ]]
[[ -z $(find "$tmp/root" -type f -print) ]]
printf '%s\n' 'systemctl disable --now wheelchair-sudo.service' 'tailscale serve --https=8445 off' 'systemctl daemon-reload' > "$tmp/uninstall-calls"
tail -n 3 "$SHIM_LOG" | cmp - "$tmp/uninstall-calls"
set +e
env -u SUDO_USER "$installer" > "$tmp/refusal" 2>&1
result=$?
set -e
[[ $result == 2 ]]
set +e
env -u WHEELCHAIR_ALLOW_WORKTREE "$repo/sudo-helper/install.sh" > "$tmp/guard" 2>&1
result=$?
set -e
[[ $result == 3 ]]
if grep -R -F -q 'hunter2-TESTPW-9f3a' "$tmp"; then exit 1; fi
printf 'PASS helper installer, idempotence, uninstall and refusals\n'
