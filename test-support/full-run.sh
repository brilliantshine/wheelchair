#!/usr/bin/env bash
# Runs the full verification suite set and records logs and a commit summary.
# S2 of docs/plans/faster-full-runs/PLAN.md is the spec.

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

rm -f "$log_dir/summary.txt"
export WHEELCHAIR_FULL_RUN=1
commit=$(git rev-parse HEAD)
set -m
browser_pid=
current_pid=
stop_run() {
  trap - TERM HUP
  [[ -z $browser_pid ]] || kill -TERM -- "-$browser_pid" 2>/dev/null
  [[ -z $current_pid ]] || kill -TERM -- "-$current_pid" 2>/dev/null
  [[ -z $browser_pid ]] || wait "$browser_pid" 2>/dev/null
  [[ -z $current_pid ]] || wait "$current_pid" 2>/dev/null
  exit 1
}
trap stop_run TERM HUP

names=(viewer-browser viewer-node machine test-support sensitivity codex install sudo-helper)
results=()
times=()
all_pass=0

# Record the browser's elapsed time in its own job so it is measured at completion.
( start=$SECONDS
  npm --prefix viewer run test:browser < /dev/null > "$log_dir/viewer-browser.log" 2>&1
  result=$?
  printf '%s %s\n' "$result" "$((SECONDS - start))" > "$log_dir/.browser-result.$$"
) &
browser_pid=$!

run_suite() {
  local index=$1 name=$2 start result
  shift 2
  start=$SECONDS
  "$@" < /dev/null > "$log_dir/$name.log" 2>&1 &
  current_pid=$!
  wait "$current_pid"
  result=$?
  current_pid=
  results[$index]=$result
  times[$index]=$((SECONDS - start))
  printf '%s: exit %s seconds %s\n' "$name" "$result" "${times[$index]}"
  if [[ $result -ne 0 ]]; then all_pass=1; fi
}

sudo_suite() {
  python3 -m unittest discover -s sudo-helper/test
  local python_result=$?
  bash sudo-helper/test/install-test.sh
  local install_result=$?
  if [[ $python_result -ne 0 ]]; then return "$python_result"; fi
  return "$install_result"
}

run_suite 1 viewer-node node --test viewer/test/*.test.js
run_suite 2 machine bash machine/test/run.sh
run_suite 3 test-support node --test test-support/test/*.test.js
run_suite 4 sensitivity bash sensitivity/test/run.sh
run_suite 5 codex bash codex/test/run.sh
run_suite 6 install bash install/test/run.sh
run_suite 7 sudo-helper sudo_suite
wait "$browser_pid"
browser_pid=
read -r browser_result browser_seconds < "$log_dir/.browser-result.$$" 2>/dev/null
rm -f "$log_dir/.browser-result.$$"
# A browser job killed before it recorded its result counts as a failure.
[[ $browser_result =~ ^[0-9]+$ ]] || browser_result=1
[[ $browser_seconds =~ ^[0-9]+$ ]] || browser_seconds=0
results[0]=$browser_result
times[0]=$browser_seconds
printf 'viewer-browser: exit %s seconds %s\n' "$browser_result" "$browser_seconds"
if [[ $browser_result -ne 0 ]]; then all_pass=1; fi

printf 'commit %s\n' "$commit" > "$log_dir/summary.txt"
for i in "${!names[@]}"; do
  printf 'suite %s exit %s seconds %s\n' "${names[$i]}" "${results[$i]}" "${times[$i]}" >> "$log_dir/summary.txt"
done
exit "$all_pass"
