#!/usr/bin/env bash
# Live check of the screen code against real Xvfb, ffmpeg, xdotool and systemd --user.
# Not run by machine/test/run.sh. Usage: bash machine/test/screen-live.sh
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for tool in Xvfb xauth mcookie ffmpeg xdotool xwininfo systemd-run systemctl xmessage node; do
  command -v "$tool" >/dev/null 2>&1 || { echo "SKIP: $tool is not installed"; exit 0; }
done
systemctl --user show-environment >/dev/null 2>&1 || { echo "SKIP: systemctl --user cannot reach the user manager"; exit 0; }
chrome=$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux64/chrome 2>/dev/null | sort -V | tail -n 1)
[ -n "$chrome" ] && [ -x "$chrome" ] || { echo "SKIP: no Playwright Chromium under ~/.cache/ms-playwright"; exit 0; }
exec node "$here/screen-live.js" "$chrome"
