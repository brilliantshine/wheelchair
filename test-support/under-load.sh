#!/usr/bin/env bash

usage() { echo 'usage: under-load.sh [--cpus N] [--hogs H] [--repeat K] -- command...' >&2; exit 2; }
command -v taskset >/dev/null 2>&1 || { echo 'under-load: taskset not found' >&2; exit 2; }
cpus=2 hogs=2 repeat=5
while (($#)); do
  case $1 in
    --cpus|--hogs|--repeat)
      (($# >= 2)) || usage
      [[ $2 =~ ^[1-9][0-9]*$ ]] || usage
      case $1 in --cpus) cpus=$2;; --hogs) hogs=$2;; --repeat) repeat=$2;; esac
      shift 2;;
    --) shift; break;;
    *) usage;;
  esac
done
(($#)) || usage
allowed=$(taskset -pc $$) || exit 2
allowed=${allowed##*: }
all=()
IFS=, read -ra ranges <<< "$allowed"
for range in "${ranges[@]}"; do
  if [[ $range == *-* ]]; then
    start=${range%-*}; end=${range#*-}
    for ((i=start; i<=end; i++)); do all+=("$i"); done
  else all+=("$range"); fi
done
((cpus <= ${#all[@]})) || usage
mapfile -t chosen < <(printf '%s\n' "${all[@]}" | shuf -n "$cpus")
list=$(IFS=,; echo "${chosen[*]}")
echo "under-load: cpus $list"
taskset -pc "$list" $$ >/dev/null || exit 2
helpers=() group=
cleanup() {
  trap '' TERM HUP INT
  if [[ -n $group ]]; then
    kill -TERM -- "-$group" 2>/dev/null || :
    local deadline=$((SECONDS + 60))
    while kill -0 -- "-$group" 2>/dev/null && ((SECONDS < deadline)); do sleep 0.1; done
    kill -KILL -- "-$group" 2>/dev/null || :
    wait "$group" 2>/dev/null || :
    group=
  fi
  if ((${#helpers[@]})); then
    kill "${helpers[@]}" 2>/dev/null || :
    wait "${helpers[@]}" 2>/dev/null || :
  fi
}
on_signal() { cleanup; exit 1; }
trap cleanup EXIT
trap on_signal TERM HUP INT
for ((i=0; i<cpus*hogs; i++)); do
  (while :; do :; done) </dev/null >/dev/null 2>&1 &
  helpers+=("$!")
done
# If whatever started this script dies, stop too, so the hogs never outlive it.
starter=$PPID main=$$
(while [[ $(ps -o ppid= -p "$main" 2>/dev/null | tr -d ' ') == "$starter" ]]; do sleep 1; done
 kill -TERM "$main" 2>/dev/null) </dev/null >/dev/null 2>&1 &
helpers+=("$!")
passed=0
for ((i=0; i<repeat; i++)); do
  setsid "$@" </dev/null &
  group=$!
  if wait "$group"; then ((passed+=1)); fi
  group=
done
echo "under-load: pass $passed of $repeat"
((passed == repeat))
