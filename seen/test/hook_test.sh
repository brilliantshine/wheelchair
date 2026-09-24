#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
hook=${SEEN_HOOK:-"$repo/seen/hook.sh"}
fixture=$(mktemp -d); trap 'rm -rf "$fixture"' EXIT
real_wording="$HOME/.wheelchair/wording.md"; real_state="$HOME/.cache/wheelchair"
fingerprint() { if [[ -f $1 ]]; then sha256sum "$1" | awk '{print $1}'; elif [[ -e $1 ]]; then find "$1" -maxdepth 2 -printf '%P %y %s\n' | sha256sum | awk '{print $1}'; else printf absent; fi; }
old_wording=$(fingerprint "$real_wording"); old_state=$(fingerprint "$real_state")
passes=0; failures=0
pass() { printf 'PASS %s\n' "$1"; passes=$((passes+1)); }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures+1)); }
assert() { local name=$1; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }
base() { printf '%s/%s' "$fixture" "$1"; }
put() { mkdir -p "$(base "$1")"; printf '%s' "$2" > "$(base "$1")/wording.md"; }
run() { local name=$1 mode=$2 json=$3 dir workdir; dir=$(base "$name"); workdir=${HOOK_CWD:-"$PWD"}; mkdir -p "$dir"; set +e; output=$(cd "$workdir" && env -u WHEELCHAIR_LANE HOME="$dir/home" WHEELCHAIR_WORDING="$dir/wording.md" WHEELCHAIR_STATE="$dir/state" "$hook" claude "$mode" <<<"$json" 2>"$dir/err"); status=$?; set -e; }
ctx() { python3 -c 'import json,sys; print(json.load(sys.stdin).get("hookSpecificOutput",{}).get("additionalContext",""))' <<<"$1"; }
msg() { python3 -c 'import json,sys; print(json.load(sys.stdin).get("systemMessage",""))' <<<"$1"; }

run empty notice '{"session_id":"one"}'
assert 'no entries and no gap print nothing' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"

put gap $'## Confirmed\n- 2026-09-24 — "jargon" — use plain words\n\n## Proposed\n\n## Struck\n'
mkdir -p "$(base gap)/state/sessions"; printf '2000-01-01T00:00:00Z' > "$(base gap)/state/sessions/one"
run gap notice '{"session_id":"one"}'; first=$output; run gap notice '{"session_id":"one"}'; second=$output
assert 'gap reports once, not on next message' bash -c '[[ $1 == *hours* && $2 != *hours* ]]' _ "$first" "$second"

put clocks $'## Confirmed\n\n## Proposed\n\n## Struck\n'; mkdir -p "$(base clocks)/state/sessions"; printf '2000-01-01T00:00:00Z' > "$(base clocks)/state/sessions/a"
run clocks notice '{"session_id":"a"}'; a=$output; run clocks notice '{"session_id":"b"}'; b=$output
assert 'separate clocks per session' bash -c '[[ $1 == *hours* && -z $2 ]]' _ "$a" "$b"

put malformed $'broken register\n- 2026-09-24 — "canary" — nope\n'; run malformed notice '{}'
assert 'malformed wording file yields no output exit zero' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"

put missing-struck $'## Confirmed\n- 2026-09-24 — "canary" — nope\n\n## Proposed\n'; run missing-struck notice '{}'
assert 'missing Struck header makes wording list empty' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"

put garbage-confirmed $'## Confirmed\n- 2026-09-24 — "canary" — nope\ngarbage\n\n## Proposed\n\n## Struck\n'; run garbage-confirmed notice '{}'
assert 'garbage inside Confirmed makes wording list empty' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"

put garbage-struck $'## Confirmed\n- 2026-09-24 — "canary" — nope\n\n## Proposed\n\n## Struck\ngarbage\n'; run garbage-struck notice '{}'
assert 'garbage inside Struck makes wording list empty' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"

put preamble $'A hand-written preamble.\n## Confirmed\n- 2026-09-24 — "carried" — keep this\n\n## Proposed\n\n## Struck\n'; run preamble notice '{}'
assert 'preamble is ignored and confirmed entry is carried' bash -c '[[ $1 == 0 && $2 == *"\"carried\""* ]]' _ "$status" "$(ctx "$output")"

put badclock $'## Confirmed\n\n## Proposed\n\n## Struck\n'; mkdir -p "$(base badclock)/state/sessions"; printf nonsense > "$(base badclock)/state/sessions/one"; run badclock notice '{"session_id":"one"}'
assert 'malformed session overwritten without a gap' bash -c '[[ -z $1 && $2 == *Z ]]' _ "$output" "$(cat "$(base badclock)/state/sessions/one")"

put notice $'## Confirmed\n- 2026-09-24 — "added" — rule\n\n## Proposed\n\n## Struck\n'; mkdir -p "$(base notice)/state"; printf '%s\n' '- 2026-09-24 — "removed" — rule' > "$(base notice)/state/confirmed.last"
run notice notice '{}'; changed=$output; run notice notice '{}'; unchanged=$output
assert 'notice names added and removed, then is absent' bash -c '[[ $1 == *"added \"added\""* && $1 == *"removed \"removed\""* && -z $2 ]]' _ "$(msg "$changed")" "$(msg "$unchanged")"
assert 'edit hint names the real wording script' bash -c '[[ $1 == *"$2 remove"* && -x $2 ]]' _ "$(ctx "$changed")" "$repo/seen/wording.sh"

put corrupt-last $'## Confirmed\n- 2026-09-24 — "healed" — rule\n\n## Proposed\n\n## Struck\n'; mkdir -p "$(base corrupt-last)/state"; printf '\xff\xfe' > "$(base corrupt-last)/state/confirmed.last"
run corrupt-last notice '{}'; corrupt_first=$output; run corrupt-last notice '{}'; corrupt_second=$output
assert 'corrupt confirmed.last announces current entries as added then heals' bash -c '[[ $1 == *"added \"healed\""* && -z $2 && $3 == *"\"healed\""* ]]' _ "$(msg "$corrupt_first")" "$(msg "$corrupt_second")" "$(cat "$(base corrupt-last)/state/confirmed.last")"

put changed-last $'## Confirmed\n- 2026-09-24 — "edited" — new instead\n\n## Proposed\n\n## Struck\n'; mkdir -p "$(base changed-last)/state"; printf '%s\n' '- 2026-09-24 — "edited" — old instead' > "$(base changed-last)/state/confirmed.last"
run changed-last notice '{}'
assert 'instead-only edit is named as changed' bash -c '[[ $1 == *"changed \"edited\""* ]]' _ "$(msg "$output")"

put silent $'## Confirmed\n- 2026-09-24 — "silent" — rule\n\n## Proposed\n\n## Struck\n'; run silent notice '{}'
assert 'missing confirmed.last seeds silently' bash -c '[[ -f $1 && -z $2 ]]' _ "$(base silent)/state/confirmed.last" "$(msg "$output")"

put nonotice $'## Confirmed\n- 2026-09-24 — "new" — rule\n\n## Proposed\n\n## Struck\n'; mkdir -p "$(base nonotice)/state"; printf '%s\n' '- 2026-09-24 — "old" — rule' > "$(base nonotice)/state/confirmed.last"; before=$(fingerprint "$(base nonotice)/state/confirmed.last")
run nonotice no-notice '{}'
assert 'no-notice leaves confirmed.last untouched' bash -c '[[ -z $1 && $2 == $3 ]]' _ "$(msg "$output")" "$before" "$(fingerprint "$(base nonotice)/state/confirmed.last")"

put lane $'## Confirmed\n- 2026-09-24 — "lane" — rule\n\n## Proposed\n\n## Struck\n'; dir=$(base lane); mkdir -p "$dir/state"; before=$(fingerprint "$dir/state")
set +e; laneout=$(HOME="$dir/home" WHEELCHAIR_WORDING="$dir/wording.md" WHEELCHAIR_STATE="$dir/state" WHEELCHAIR_LANE=1 "$hook" claude notice <<< '{}'); lanerc=$?; set -e
assert 'lane makes no output or state change' bash -c '[[ $1 == 0 && -z $2 && $3 == $4 ]]' _ "$lanerc" "$laneout" "$before" "$(fingerprint "$dir/state")"

put agent $'## Confirmed\n- 2026-09-24 — "agent" — rule\n\n## Proposed\n\n## Struck\n'; dir=$(base agent); mkdir -p "$dir/state"; before=$(fingerprint "$dir/state"); run agent notice '{"agent_id":"x"}'
assert 'agent_id makes no output or state change' bash -c '[[ $1 == 0 && -z $2 && $3 == $4 ]]' _ "$status" "$output" "$before" "$(fingerprint "$dir/state")"

dir=$(base cap); mkdir -p "$dir"; { printf '## Confirmed\n'; for n in $(seq 1 80); do printf -- '- 2026-09-24 — "phrase %s" — %s\n' "$n" "$(printf 'x%.0s' $(seq 1 60))"; done; printf '\n## Proposed\n\n## Struck\n'; } > "$dir/wording.md"; run cap notice '{}'; capped=$(ctx "$output")
assert 'context cap reports omitted entries' bash -c '[[ ${#1} -le 2000 && $1 == *"older entries left out"* ]]' _ "$capped"

dir=$(base canary); mkdir -p "$dir/repo/docs/plans/x"; printf '%s\n' '- "canary" — never read' > "$dir/repo/docs/plans/x/SEEN.md"; put canary $'## Confirmed\n\n## Proposed\n\n## Struck\n'
set +e; canary=$(cd "$dir/repo" && env -u WHEELCHAIR_LANE HOME="$dir/home" WHEELCHAIR_WORDING="$dir/wording.md" WHEELCHAIR_STATE="$dir/state" "$hook" claude notice <<< '{}'); canaryrc=$?; set -e
assert 'cwd repository canary never appears' bash -c '[[ $1 == 0 && $2 != *canary* ]]' _ "$canaryrc" "$canary"

clean_cwd=$(base import-clean); poison_cwd=$(base import-poison); mkdir -p "$clean_cwd" "$poison_cwd"
printf 'open("json.marker", "w").write("pwned")\n' > "$poison_cwd/json.py"
printf 'open("datetime.marker", "w").write("pwned")\n' > "$poison_cwd/datetime.py"
printf 'raise RuntimeError("pwned")\n' > "$poison_cwd/re.py"
put import-control $'## Confirmed\n- 2026-09-24 — "isolated" — rule\n\n## Proposed\n\n## Struck\n'; HOOK_CWD=$clean_cwd run import-control notice '{}'; control_output=$output; control_status=$status
put import-poison $'## Confirmed\n- 2026-09-24 — "isolated" — rule\n\n## Proposed\n\n## Struck\n'; HOOK_CWD=$poison_cwd run import-poison notice '{}'; poison_output=$output; poison_status=$status
assert 'hook ignores cwd Python modules' bash -c '[[ $1 == 0 && ! -e $2/json.marker && ! -e $2/datetime.marker && $3 == "$4" ]]' _ "$poison_status" "$poison_cwd" "$poison_output" "$control_output"

put speed $'## Confirmed\n\n## Proposed\n\n## Struck\n'; start=$(date +%s%N); run speed notice '{}'; elapsed=$((($(date +%s%N)-start)/1000000))
assert 'hook finishes under 200 ms' bash -c '[[ $1 -lt 200 ]]' _ "$elapsed"
assert 'real wording unchanged' bash -c '[[ $1 == $2 ]]' _ "$old_wording" "$(fingerprint "$real_wording")"
assert 'real state unchanged' bash -c '[[ $1 == $2 ]]' _ "$old_state" "$(fingerprint "$real_state")"
printf '%s passed, %s failed\n' "$passes" "$failures"
(( failures == 0 ))
