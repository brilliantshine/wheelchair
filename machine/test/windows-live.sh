#!/usr/bin/env bash
# Real WSL bridge check; this is deliberately not part of the isolated suite.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null || { [ ! -e /proc/sys/fs/binfmt_misc/WSLInterop ] && [ ! -e /proc/sys/fs/binfmt_misc/WSLInterop-late ]; }; then
  echo 'SKIP: Windows bridge live check requires WSL with interop enabled'
  exit 77
fi
exec node "$here/windows-live.js"
