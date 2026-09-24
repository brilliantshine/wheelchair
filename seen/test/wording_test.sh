#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
writer=${SEEN_WORDING:-"$repo/seen/wording.sh"}
fixture=$(mktemp -d); trap 'rm -rf "$fixture"' EXIT
real_wording="$HOME/.wheelchair/wording.md"; real_state="$HOME/.cache/wheelchair"
fingerprint() { if [[ -f $1 ]]; then sha256sum "$1" | awk '{print $1}'; elif [[ -e $1 ]]; then find "$1" -maxdepth 2 -printf '%P %y %s\n' | sha256sum | awk '{print $1}'; else printf absent; fi; }
old_wording=$(fingerprint "$real_wording"); old_state=$(fingerprint "$real_state")
passes=0; failures=0
pass() { printf 'PASS %s\n' "$1"; passes=$((passes+1)); }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures+1)); }
assert() { local name=$1; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }
path() { printf '%s/%s/wording.md' "$fixture" "$1"; }
run() { local name=$1; shift; mkdir -p "$fixture/$name"; set +e; output=$(HOME="$fixture/$name/home" WHEELCHAIR_WORDING="$(path "$name")" "$writer" "$@" 2>&1); status=$?; set -e; }

run create suggest alpha 'say alpha plainly'
assert 'file creation has all headers' bash -c '[[ $1 == 0 ]] && grep -qx "## Confirmed" "$2" && grep -qx "## Proposed" "$2" && grep -qx "## Struck" "$2"' _ "$status" "$(path create)"
run create suggest ' ALPHA ' again
assert 'suggest refuses phrase in any section ignoring case' bash -c '[[ $1 == 1 ]]' _ "$status"

name=move; mkdir -p "$fixture/$name"; printf '%s' $'## Confirmed\n\n## Proposed\n- 2026-09-24 — "one" — first\n- 2026-09-24 — "two" — second\n\n## Struck\n' > "$(path "$name")"
run "$name" confirm one
assert 'confirm moves exactly the named proposed row' bash -c 'awk "/## Confirmed/,/## Proposed/" "$1" | grep -q "\"one\"" && awk "/## Proposed/,/## Struck/" "$1" | grep -q "\"two\""' _ "$(path "$name")"
run "$name" strike two
assert 'strike moves exactly the named proposed row' bash -c 'awk "/## Struck/,0" "$1" | grep -q "\"two\"" && ! awk "/## Proposed/,/## Struck/" "$1" | grep -q "\"two\""' _ "$(path "$name")"
run "$name" confirm missing
assert 'confirm refuses phrase not in Proposed' bash -c '[[ $1 == 1 ]]' _ "$status"
run "$name" remove ONE
assert 'remove moves confirmed row to Struck ignoring case' bash -c 'awk "/## Struck/,0" "$1" | grep -q "\"one\"" && ! awk "/## Confirmed/,/## Proposed/" "$1" | grep -q "\"one\""' _ "$(path "$name")"
run "$name" remove absent
assert 'remove refuses phrase not in Confirmed' bash -c '[[ $1 == 1 ]]' _ "$status"
run bad suggest $'bad\nphrase' instead
assert 'invalid phrase uses exit 2 and usage' bash -c '[[ $1 == 2 && $2 == *usage:* ]]' _ "$status" "$output"

name=concurrent; mkdir -p "$fixture/$name"
for n in $(seq 1 20); do HOME="$fixture/$name/home" WHEELCHAIR_WORDING="$(path "$name")" "$writer" suggest "phrase-$n" "instead $n" >/dev/null 2>&1 & done
wait
assert 'twenty concurrent suggestions lose nothing' bash -c '[[ $(grep -c "^-" "$1") == 20 ]]' _ "$(path "$name")"
assert 'real wording unchanged' bash -c '[[ $1 == $2 ]]' _ "$old_wording" "$(fingerprint "$real_wording")"
assert 'real state unchanged' bash -c '[[ $1 == $2 ]]' _ "$old_state" "$(fingerprint "$real_state")"
printf '%s passed, %s failed\n' "$passes" "$failures"
(( failures == 0 ))
