#!/usr/bin/env bash
# Fixture suite for the local agent model pins.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
model=${MODEL_SH:-"$repo/codex/model.sh"}
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
passes=0
failures=0
pass() { printf 'PASS %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
assert() { local description=$1; shift; if "$@"; then pass "$description"; else fail "$description"; fi; }
equals() { [[ $1 == "$2" ]]; }
contains() { [[ $1 == *"$2"* ]]; }

new_case() {
  case_dir=$(mktemp -d "$fixture/case.XXXXXX")
  pins=$case_dir/models
  cache=$case_dir/models_cache.json
  stderr=$case_dir/stderr
}
run_model() {
  set +e
  output=$(WHEELCHAIR_MODELS="$pins" WHEELCHAIR_MODELS_CACHE="$cache" "$model" "$@" 2>"$stderr")
  status=$?
  set -e
}
write_cache() { printf '%s\n' "$1" > "$cache"; }
default_pins() {
  printf "%s\n" \
    "# wheelchair's model pins. Change them with codex/model.sh." \
    "claude.light = claude-haiku-5-5" \
    "claude.standard = claude-sonnet-5-5" \
    "claude.heavy = claude-opus-5-5" \
    "claude.critical = claude-fable-5-2" \
    "claude.lead = claude-opus-5-5" \
    "gpt.light = gpt-6-luna" \
    "gpt.standard = gpt-5.6-terra" \
    "gpt.heavy = gpt-6.1-sol" \
    "gpt.critical = gpt-6-astra" \
    "gpt.lead = gpt-6.1-sol"
}
json_assert() { python3 -c "$1" <<<"$output"; }

# New-format reading, defaults, aliases, none, effort and family.
new_case
printf '%s\n' \
  'claude.light = custom-haiku @low' \
  'claude.heavy = custom-opus @max' \
  'claude.lead = custom-lead @xhigh' \
  'gpt.light = custom-light' \
  'gpt.heavy = custom-heavy' > "$pins"
run_model claude heavy
assert 'new format reads a Claude model' equals "$output" custom-opus
run_model effort claude heavy
assert 'new format reads Claude effort' equals "$output" max
run_model gpt light
assert 'new format reads a GPT model' equals "$output" custom-light
run_model family claude heavy
assert 'family reads Claude model family' equals "$output" opus
run_model effort gpt heavy
assert 'GPT effort is empty and successful' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"

new_case
printf '%s\n' 'luna = old-light' 'terra = old-standard' 'sol = old-heavy' 'astra = old-critical' > "$pins"
run_model heavy
assert 'legacy-only file reads as GPT' equals "$output" old-heavy
run_model gpt critical
assert 'legacy aliases resolve in files' equals "$output" old-critical
run_model sol
assert 'old command alias is accepted' equals "$output" old-heavy
run_model set gpt luna replacement
assert 'old provider slot alias writes successfully' test "$status" -eq 0
assert 'old alias writes the new name' grep -Fxq 'gpt.light = replacement' "$pins"
assert 'legacy first write rewrites every provider slot' bash -c 'grep -Fxq "claude.critical = claude-fable-5-2" "$1" && grep -Fxq "gpt.lead = gpt-6.1-sol" "$1"' _ "$pins"

new_case
run_model set gpt heavy none
run_model heavy
assert 'old reader rejects a GPT none cell' bash -c '[[ $1 == 3 && $2 == *"gpt is not used at heavy"* ]]' _ "$status" "$(<"$stderr")"
run_model set claude opus none
run_model claude heavy
assert 'provider reader rejects a Claude none cell' bash -c '[[ $1 == 3 && $2 == *"claude is not used at heavy"* ]]' _ "$status" "$(<"$stderr")"
run_model family claude heavy
assert 'family rejects a none cell' test "$status" -eq 3

new_case
run_model set claude standard claude-sonnet-custom high
assert 'set accepts Claude effort' test "$status" -eq 0
run_model effort claude sonnet
assert 'Claude family alias resolves effort' equals "$output" high
run_model set gpt heavy gpt-7-heavy high
assert 'set rejects effort for GPT' test "$status" -eq 2
run_model set claude light none low
assert 'set rejects effort with none' test "$status" -eq 2
run_model set claude critical custom-model
run_model family claude critical
assert 'family rejects a model without a known family' test "$status" -eq 3

# Init, set, skip and reset all render the complete new form.
new_case
run_model init
assert 'init writes the shipped models file' cmp -s <(default_pins) "$pins"
run_model set heavy gpt-7-heavy
run_model skip gpt-8-nova
assert 'set and skip retain new rendering' bash -c 'grep -Fxq "gpt.heavy = gpt-7-heavy" "$1" && grep -Fxq "skip = gpt-8-nova" "$1"' _ "$pins"
run_model reset
assert 'reset writes defaults and drops skips' cmp -s <(default_pins) "$pins"
printf 'broken row\n' > "$pins"
run_model reset
assert 'reset repairs a malformed file' bash -c '[[ $1 == 0 ]] && cmp -s <(printf "%s\\n" "# wheelchair'"'"'s model pins. Change them with codex/model.sh." "claude.light = claude-haiku-5-5") <(head -n 2 "$2")' _ "$status" "$pins"

# Text heads-up uses renamed tiers and the provider-explicit switch command.
new_case
write_cache '{"models":[{"slug":"gpt-6.2-sol","visibility":"list"}]}'
run_model check
assert 'check text uses Heavy and the new switch form' equals "$output" "heads-up: gpt-6.2-sol is newer than Heavy's gpt-6.1-sol. Switch: $repo/codex/model.sh set gpt heavy gpt-6.2-sol (or $repo/codex/model.sh skip gpt-6.2-sol)"
run_model set gpt heavy none
run_model check
assert 'a none GPT tier is ignored by heads-up' equals "$output" ''

# JSON events cover malformed, newer, available and every tierless model.
new_case
printf 'gpt.heavy = gpt-6.1-sol\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-6.2-sol","visibility":"list"},{"slug":"gpt-9-nova","visibility":"list"},{"slug":"gpt-10-delta","visibility":"list"}]}'
run_model check --json
assert 'check JSON reports newer and all tierless models' json_assert 'import json,sys; x=json.load(sys.stdin); assert x[0] == {"kind":"newer","tier":"heavy","model":"gpt-6.2-sol","current":"gpt-6.1-sol"}; assert [e["model"] for e in x if e["kind"] == "tierless"] == ["gpt-10-delta","gpt-9-nova"]'
printf 'gpt.heavy = hand-set\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-8.2-heavy","visibility":"list"}]}'
run_model check --json
assert 'check JSON reports an available hand-set pin' json_assert 'import json,sys; assert any(e == {"kind":"available","tier":"heavy","model":"gpt-8.2-heavy","current":"hand-set"} for e in json.load(sys.stdin))'
printf 'not a models file\n' > "$pins"
run_model check --json
assert 'check JSON reports malformed files' json_assert 'import json,sys; assert json.load(sys.stdin)[0] == {"kind":"malformed","tier":None,"model":None,"current":None}'

# show is the hub-facing source of truth, including null cells and visible cache order.
new_case
printf '%s\n' 'claude.light = claude-haiku-custom @medium' 'gpt.critical = none' > "$pins"
write_cache '{"models":[{"slug":"gpt-6.1-sol","visibility":"list"},{"slug":"gpt-7-sol","visibility":"list"}]}'
run_model show --json
assert 'show JSON supplies models, effort, null cells, malformed and visible cache' json_assert 'import json,sys; x=json.load(sys.stdin); assert x["claude"]["light"] == {"model":"claude-haiku-custom","effort":"medium"}; assert x["gpt"]["critical"] is None; assert x["gpt"]["heavy"]["effort"] is None; assert x["malformed"] is False; assert x["visible"] == ["gpt-7-sol","gpt-6.1-sol"]'

printf 'RESULT %d passed, %d failed\n' "$passes" "$failures"
(( failures == 0 ))
