#!/usr/bin/env bash
# Runs the full verification suite set and records logs and a commit summary.
# S2 of docs/plans/faster-verification/PLAN.md is the spec.

if [[ $# -ne 1 ]]; then
  printf 'usage: bash test-support/full-run.sh <log-dir>\n' >&2
  exit 2
fi

log_dir=$1
if [[ "$log_dir" != /* ]]; then
  log_dir="$PWD/$log_dir"
fi
mkdir -p "$log_dir"

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel) || {
  printf 'full-run: cannot find repository root\n' >&2
  exit 2
}
cd "$repo_root" || {
  printf 'full-run: cannot enter repository root\n' >&2
  exit 2
}

if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
  printf 'full-run: refusing dirty tracked worktree\n' >&2
  exit 2
fi

export WHEELCHAIR_FULL_RUN=1
commit=$(git rev-parse HEAD)
printf 'commit %s\n' "$commit" > "$log_dir/summary.txt"
all_pass=0

run_suite() {
  local name=$1
  shift
  "$@" > "$log_dir/$name.log" 2>&1
  local result=$?
  printf 'suite %s exit %s\n' "$name" "$result" >> "$log_dir/summary.txt"
  printf '%s: exit %s\n' "$name" "$result"
  if [[ $result -ne 0 ]]; then
    all_pass=1
  fi
}

run_suite viewer-browser npm --prefix viewer run test:browser
run_suite viewer-node node --test viewer/test/*.test.js
run_suite machine bash machine/test/run.sh
run_suite test-support node --test test-support/test/*.test.js
run_suite sensitivity bash sensitivity/test/run.sh
run_suite codex bash codex/test/run.sh
run_suite install bash install/test/run.sh

python3 -m unittest discover -s sudo-helper/test > "$log_dir/sudo-helper.log" 2>&1
sudo_python=$?
bash sudo-helper/test/install-test.sh >> "$log_dir/sudo-helper.log" 2>&1
sudo_install=$?
if [[ $sudo_python -ne 0 ]]; then
  sudo_result=$sudo_python
else
  sudo_result=$sudo_install
fi
printf 'suite sudo-helper exit %s\n' "$sudo_result" >> "$log_dir/summary.txt"
printf 'sudo-helper: exit %s\n' "$sudo_result"
if [[ $sudo_result -ne 0 ]]; then
  all_pass=1
fi

exit "$all_pass"
