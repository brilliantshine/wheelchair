#!/usr/bin/env bash
# Fixture suite for the local agent model pins.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
model=${MODEL_SH:-"$repo/codex/model.sh"}
preflight=${PREFLIGHT_SH:-"$repo/codex/preflight.sh"}
fixture=$(mktemp -d)
# Never ask the real Antigravity CLI for its models; the agy cases below point this at a fake.
export WHEELCHAIR_AGY=
trap 'rm -rf "$fixture"' EXIT
trap 'exit 130' INT; trap 'exit 143' TERM; trap 'exit 129' HUP
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
    "claude.sub-lead = claude-opus-5-5" \
    "gpt.light = gpt-6-luna" \
    "gpt.standard = gpt-5.6-terra" \
    "gpt.heavy = gpt-6.1-sol" \
    "gpt.critical = gpt-6-astra" \
    "gpt.lead = gpt-6.1-sol" \
    "gpt.sub-lead = gpt-6.1-sol" \
    "gemini.light = gemini-3.8-flash @low" \
    "gemini.standard = gemini-3.8-flash @medium" \
    "gemini.heavy = gemini-3.8-flash @high" \
    "gemini.critical = gemini-3.8-flash @high" \
    "gemini.lead = gemini-3.8-flash @high" \
    "gemini.sub-lead = gemini-3.8-flash @high" \
    "kimi.light = kimi-code/kimi-for-coding" \
    "kimi.standard = kimi-code/k3" \
    "kimi.heavy = kimi-code/k3.1-pro" \
    "kimi.critical = kimi-code/k3.1-pro" \
    "kimi.lead = kimi-code/k3.1-pro" \
    "kimi.sub-lead = kimi-code/k3.1-pro" \
    "openrouter.light = openrouter/auto" \
    "openrouter.standard = openrouter/auto" \
    "openrouter.heavy = openrouter/auto" \
    "openrouter.critical = openrouter/auto" \
    "openrouter.lead = openrouter/auto" \
    "openrouter.sub-lead = openrouter/auto"
}
json_assert() { python3 -c "$1" <<<"$output"; }

# Model IDs have a 64-character limit in writes and pins files.
new_case
model64=$(printf '%064d' 0 | tr 0 x)
model65="${model64}x"
run_model set gpt light "$model64"
assert 'set accepts a 64-character model' test "$status" -eq 0
run_model set gpt light "$model65"
assert 'set rejects a 65-character model with usage exit' test "$status" -eq 2
printf 'gpt.light = %s\n' "$model65" > "$pins"
run_model show --json
assert 'a 65-character pinned model is malformed' json_assert 'import json,sys; x=json.load(sys.stdin); assert x["malformed"] is True and x["gpt"]["light"]["model"] == "gpt-6-luna"'

# Missing sub-lead cells inherit the current lead until the next write.
new_case
printf '%s\n' 'claude.lead = custom-sonnet @high' > "$pins"
run_model claude sub-lead
assert 'missing sub-lead inherits pinned lead' equals "$output" custom-sonnet
run_model effort claude sub-lead
assert 'missing sub-lead inherits lead effort' equals "$output" high
run_model family claude sub-lead
assert 'inherited sub-lead has Claude family' equals "$output" sonnet
run_model gpt sub-lead
assert 'missing sub-lead inherits default lead' equals "$output" gpt-6.1-sol
run_model set gpt sub-lead custom-sub high
assert 'set sub-lead succeeds' equals "$status" 0
run_model gpt sub-lead
assert 'sub-lead model reads back' equals "$output" custom-sub
run_model effort gpt sub-lead
assert 'sub-lead effort reads back' equals "$output" high
run_model show --json
assert 'show includes sub-lead' json_assert 'import json,sys; assert json.load(sys.stdin)["gpt"]["sub-lead"] == {"model":"custom-sub","effort":"high"}'
assert 'save writes inherited sub-lead' bash -c '[[ $(<"$1") == *"claude.sub-lead = custom-sonnet @high"* ]]' _ "$pins"

# Gemini defaults and pins use the same effort range as Claude.
new_case
for slot in light standard heavy critical lead; do
  case $slot in light) expected=low ;; standard) expected=medium ;; *) expected=high ;; esac
  run_model gemini "$slot"
  assert "Gemini $slot uses its shipped default" bash -c '[[ $1 == 0 && $2 == "$3" ]]' _ "$status" "$output" "gemini-3.8-flash"
done
run_model effort gemini heavy
assert 'Gemini default effort is high' bash -c '[[ $1 == 0 && $2 == high ]]' _ "$status" "$output"
run_model set gemini standard gemini-custom max
assert 'set accepts Gemini max effort' test "$status" -eq 0
run_model gemini standard
assert 'Gemini custom model reads back' bash -c '[[ $1 == 0 && $2 == gemini-custom ]]' _ "$status" "$output"
run_model effort gemini standard
assert 'Gemini max effort reads back' bash -c '[[ $1 == 0 && $2 == max ]]' _ "$status" "$output"
run_model set gemini light none
run_model gemini light
assert 'Gemini none exits 3' bash -c '[[ $1 == 3 && $2 == *"gemini is not used at light"* ]]' _ "$status" "$(<"$stderr")"
printf 'gemini.heavy = gemini-x @xhigh\n' > "$pins"
run_model gemini heavy
assert 'Gemini pin line reads model' bash -c '[[ $1 == 0 && $2 == gemini-x ]]' _ "$status" "$output"
run_model effort gemini heavy
assert 'Gemini pin line reads effort' bash -c '[[ $1 == 0 && $2 == xhigh ]]' _ "$status" "$output"
run_model show --json
assert 'show JSON includes Gemini' json_assert 'import json,sys; assert json.load(sys.stdin)["gemini"]["heavy"] == {"model":"gemini-x","effort":"xhigh"}'

# OpenRouter model IDs and the none sentinel.
new_case
for slot in light standard heavy critical lead sub-lead; do
  run_model openrouter "$slot"
  assert "OpenRouter $slot default" bash -c '[[ $1 == 0 && $2 == openrouter/auto ]]' _ "$status" "$output"
done
or128="a/$(printf '%0126d' 0 | tr 0 x)"
for value in "$or128" 'a/b:free'; do
  run_model set openrouter light "$value"
  assert "OpenRouter accepts $value" test "$status" -eq 0
  run_model openrouter light
  assert "OpenRouter reloads $value" equals "$output" "$value"
done
for value in "${or128}x" 'ab' 'a/b/c' 'a/b:' 'a/b::c'; do
  run_model set openrouter light "$value"
  assert "OpenRouter rejects $value" test "$status" -eq 2
  printf 'openrouter.light = %s\n' "$value" > "$pins"
  run_model show --json
  assert "OpenRouter rejects pin $value" json_assert 'import json,sys; assert json.load(sys.stdin)["malformed"] is True'
  printf 'openrouter.light = openrouter/auto\n' > "$pins"
done
for level in low medium high xhigh max; do
  run_model set openrouter light a/b "$level"
  assert "OpenRouter accepts effort $level" test "$status" -eq 0
  run_model effort openrouter light
  assert "OpenRouter reloads effort $level" equals "$output" "$level"
done
run_model set openrouter light a/b bogus
assert 'OpenRouter rejects unknown effort' test "$status" -eq 2
run_model set kimi light kimi-x high
assert 'Kimi still rejects effort' test "$status" -eq 2
run_model set kimi standard kimi-code/k3 high
assert 'Kimi effort refusal uses the exact label message' bash -c '[[ $1 -eq 2 && $2 == "Kimi Code has no effort setting" ]]' _ "$status" "$(cat "$stderr")"
run_model set openrouter light none
assert 'OpenRouter saves none' test "$status" -eq 0
run_model openrouter light
assert 'OpenRouter reloads none' test "$status" -eq 3

# Kimi defaults and slashed aliases (slashes only for Kimi).
new_case
for slot in light standard heavy critical lead sub-lead; do
  case $slot in light) expected=kimi-code/kimi-for-coding ;; standard) expected=kimi-code/k3 ;; *) expected=kimi-code/k3.1-pro ;; esac
  run_model kimi "$slot"
  assert "Kimi $slot uses its shipped default" bash -c '[[ $1 == 0 && $2 == "$3" ]]' _ "$status" "$output" "$expected"
done
run_model set kimi standard kimi-code/k3-custom
assert 'set accepts a slashed Kimi alias' test "$status" -eq 0
run_model kimi standard
assert 'Kimi slashed alias reads back' equals "$output" kimi-code/k3-custom
run_model effort kimi standard
assert 'Kimi has no effort to read back' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"
run_model show --json
assert 'show JSON includes Kimi' json_assert 'import json,sys; x=json.load(sys.stdin); assert x["kimi"]["standard"] == {"model":"kimi-code/k3-custom","effort":None} and x["malformed"] is False'
run_model set gemini standard a/b
assert 'set rejects a slashed non-Kimi model' test "$status" -eq 2
run_model set kimi standard a/b/c
assert 'set rejects two slashes for Kimi' test "$status" -eq 2
printf 'gpt.light = a/b\n' > "$pins"
run_model show --json
assert 'a slashed non-Kimi pin is malformed' json_assert 'import json,sys; assert json.load(sys.stdin)["malformed"] is True'
printf 'kimi.heavy = kimi-code/x\n' > "$pins"
run_model kimi heavy
assert 'Kimi pin line reads a slashed model' equals "$output" kimi-code/x
printf 'kimi.heavy = kimi-code/x\n' > "$pins"
before=$(cat "$pins")
run_model set kimi heavy kimi-code/y high
assert 'set kimi with an effort is refused' test "$status" -ne 0
assert 'the refusal says Kimi has no effort setting' bash -c '[[ $1 == *"Kimi Code has no effort setting"* ]]' _ "$(cat "$stderr")"
assert 'the pin file is unchanged after the refusal' equals "$(cat "$pins")" "$before"
printf 'kimi.heavy = kimi-code/x @high\n' > "$pins"
run_model show --json
assert 'a Kimi pin with an effort is malformed' json_assert 'import json,sys; assert json.load(sys.stdin)["malformed"] is True'
run_model effort kimi light
assert 'effort kimi light prints nothing and succeeds' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"

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
run_model set gpt heavy gpt-7-heavy xhigh
assert 'set accepts GPT effort' test "$status" -eq 0
assert 'GPT effort is written to the pins file' grep -Fxq 'gpt.heavy = gpt-7-heavy @xhigh' "$pins"
run_model effort gpt heavy
assert 'GPT effort reads back' bash -c '[[ $1 == 0 && $2 == xhigh ]]' _ "$status" "$output"
run_model show --json
assert 'show JSON reports GPT effort' json_assert 'import json,sys; assert json.load(sys.stdin)["gpt"]["heavy"] == {"model":"gpt-7-heavy","effort":"xhigh"}'
run_model set gpt heavy gpt-7-heavy max
assert 'set rejects GPT max and names allowed efforts' bash -c '[[ $1 == 2 && $2 == *"low, medium, high, xhigh"* ]]' _ "$status" "$(<"$stderr")"
run_model set claude light none low
assert 'set rejects effort with none' test "$status" -eq 2
run_model set gpt light none low
assert 'set rejects GPT effort with none' test "$status" -eq 2
run_model set claude critical custom-model
run_model family claude critical
assert 'family rejects a model without a known family' test "$status" -eq 3

new_case
printf 'gpt.heavy = gpt-7-heavy @max\n' > "$pins"
run_model show --json
assert 'GPT max in a pins file is malformed' json_assert 'import json,sys; assert json.load(sys.stdin)["malformed"] is True'

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
write_cache '{"models":[{"slug":"gpt-8.2-sol","visibility":"list"}]}'
run_model check --json
assert 'check JSON reports an available hand-set pin' json_assert 'import json,sys; assert any(e == {"kind":"available","tier":"heavy","model":"gpt-8.2-sol","current":"hand-set"} for e in json.load(sys.stdin))'
printf 'not a models file\n' > "$pins"
run_model check --json
assert 'check JSON reports malformed files' json_assert 'import json,sys; assert json.load(sys.stdin)[0] == {"kind":"malformed","tier":None,"model":None,"current":None}'

# show is the hub-facing source of truth, including null cells and visible cache order.
new_case
printf '%s\n' 'claude.light = claude-haiku-custom @medium' 'gpt.critical = none' > "$pins"
write_cache '{"models":[{"slug":"gpt-6.1-sol","visibility":"list"},{"slug":"gpt-7-sol","visibility":"list"}]}'
run_model show --json
assert 'show JSON supplies models, effort, null cells, malformed and visible cache' json_assert 'import json,sys; x=json.load(sys.stdin); assert x["claude"]["light"] == {"model":"claude-haiku-custom","effort":"medium"}; assert x["gpt"]["critical"] is None; assert x["gpt"]["heavy"]["effort"] is None; assert x["malformed"] is False; assert x["visible"] == ["gpt-7-sol","gpt-6.1-sol"]'

new_case
write_cache '{"models":[{"slug":"gpt-7","visibility":"list"},{"slug":"gpt-7-nova","visibility":"list"},{"slug":"gpt-8","visibility":"hide"}]}'
run_model show --json
assert 'show JSON includes listed unparsed models after parsed models' json_assert 'import json,sys; assert json.load(sys.stdin)["visible"] == ["gpt-7-nova","gpt-7"]'
run_model check
assert 'check heads-up stays filtered for the same cache' equals "$output" "heads-up: gpt-7-nova is available and matches no tier. Pin it: $repo/codex/model.sh set gpt <tier> gpt-7-nova (or $repo/codex/model.sh skip gpt-7-nova)"

# show lists Kimi Code's configured model aliases, with display names, and [] when the config is missing.
new_case
printf '%s\n' 'default_model = "kimi-code/k3"' '[models."kimi-code/k3"]  # the usual one' 'model = "k3"' 'display_name = "K3" # shown name' '[models."kimi-code/k3.1-pro"]' 'model = "k3.1-pro"' '[models."Bad Alias"]' 'display_name = "x"' '[models.none]' '[models."kimi-code/k3\n"]' > "$case_dir/kimi.toml"
output=$(WHEELCHAIR_MODELS="$pins" WHEELCHAIR_MODELS_CACHE="$cache" WHEELCHAIR_KIMI_CONFIG="$case_dir/kimi.toml" "$model" show --json)
assert 'show JSON lists Kimi aliases from the Kimi config' json_assert 'import json,sys; assert json.load(sys.stdin)["kimi_visible"] == [{"value":"kimi-code/k3","label":"K3 (kimi-code/k3)"},{"value":"kimi-code/k3.1-pro","label":"kimi-code/k3.1-pro"}]'
output=$(WHEELCHAIR_MODELS="$pins" WHEELCHAIR_MODELS_CACHE="$cache" WHEELCHAIR_KIMI_CONFIG="$case_dir/missing.toml" "$model" show --json)
assert 'show JSON gives no Kimi aliases without a Kimi config' json_assert 'import json,sys; assert json.load(sys.stdin)["kimi_visible"] == []'

# show lists Antigravity's models from `agy models`, caches them beside the pins, and keeps the cache when a listing fails.
new_case
fake_agy=$case_dir/agy
printf '%s\n' '#!/bin/sh' 'echo "Fetching available models..." >&2' 'printf "gemini-3.8-flash-high\tGemini 3.8 Flash (High)\nclaude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)\nBad Model\tx\nnone\tNone\ngpt-oss-120b\n"' > "$fake_agy"
chmod +x "$fake_agy"
output=$(WHEELCHAIR_AGY="$fake_agy" WHEELCHAIR_MODELS="$pins" WHEELCHAIR_MODELS_CACHE="$cache" "$model" show --json)
assert 'show JSON lists Antigravity models from agy models' json_assert 'import json,sys; assert json.load(sys.stdin)["agy_visible"] == [{"value":"gemini-3.8-flash-high","label":"Gemini 3.8 Flash (High) · gemini-3.8-flash-high","efforts":[]},{"value":"claude-opus-4-6-thinking","label":"Claude Opus 4.6 (Thinking) · claude-opus-4-6-thinking","efforts":[]},{"value":"gpt-oss-120b","label":"gpt-oss-120b","efforts":[]}]'
assert 'show caches the Antigravity list beside the pins' test -s "$case_dir/agy-models.json"
printf '%s\n' '#!/bin/sh' 'exit 1' > "$fake_agy"
python3 -c 'import json,sys; p=sys.argv[1]; d=json.load(open(p)); d["at"]=0; json.dump(d,open(p,"w"))' "$case_dir/agy-models.json"
output=$(WHEELCHAIR_AGY="$fake_agy" WHEELCHAIR_MODELS="$pins" WHEELCHAIR_MODELS_CACHE="$cache" "$model" show --json)
assert 'show keeps the stale Antigravity list when agy models fails' json_assert 'import json,sys; assert [m["value"] for m in json.load(sys.stdin)["agy_visible"]] == ["gemini-3.8-flash-high","claude-opus-4-6-thinking","gpt-oss-120b"]'
new_case
output=$(WHEELCHAIR_AGY="$case_dir/missing" WHEELCHAIR_MODELS="$pins" WHEELCHAIR_MODELS_CACHE="$cache" "$model" show --json)
assert 'show gives no Antigravity models without the CLI' json_assert 'import json,sys; assert json.load(sys.stdin)["agy_visible"] == []'

# Level grouping, catalog reuse, migration, and launch fix-up use only a fake CLI.
new_case
fake_agy=$case_dir/agy
listing=$case_dir/listing
for family in hydrogen neon carbon argon flash; do
  case $family in hydrogen|neon) levels='low medium high xhigh'; base="gemini-4-$family" ;; carbon|argon) levels='low medium high'; base="gemini-4-$family" ;; *) levels='low medium high'; base=gemini-3.8-flash ;; esac
  for level in $levels; do
    title="${level^}"
    printf '%s\t%s (%s)\n' "$base-$level" "$family" "$title" >> "$listing"
  done
done
printf '%s\n' $'orchestrator-one\tOrchestrator One' $'orchestrator-two\tOrchestrator Two' $'orchestrator-three\tOrchestrator Three' $'claude-sonnet-4-6\tClaude Sonnet' $'claude-opus-4-6-thinking\tClaude Opus' $'gpt-oss-120b-medium\tGPT OSS' $'lone-low\tLone (Low)' >> "$listing"
printf '#!/bin/sh\necho call >> "%s"\ncat "%s"\n' "$case_dir/calls" "$listing" > "$fake_agy"
chmod +x "$fake_agy"
export WHEELCHAIR_AGY=$fake_agy
run_model show --json
assert 'groups level models in first-member order and keeps singles' json_assert 'import json,sys; a=json.load(sys.stdin)["agy_visible"]; assert [x["value"] for x in a]==["gemini-4-hydrogen","gemini-4-neon","gemini-4-carbon","gemini-4-argon","gemini-3.8-flash","orchestrator-one","orchestrator-two","orchestrator-three","claude-sonnet-4-6","claude-opus-4-6-thinking","gpt-oss-120b-medium","lone-low"]; assert a[0]=={"value":"gemini-4-hydrogen","label":"hydrogen · gemini-4-hydrogen","efforts":["low","medium","high","xhigh"]} and a[2]["efforts"]==["low","medium","high"] and a[-1]["efforts"]==[]'
run_model show --json
assert 'fresh list reused for 30 seconds' bash -c '[[ $(wc -l < "$1") == 1 ]]' _ "$case_dir/calls"
run_model levels gemini gemini-4-hydrogen
assert 'levels returns ordered levels' equals "$output" $'low\nmedium\nhigh\nxhigh'
run_model levels gemini lone-low
assert 'single has no levels' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"
run_model levels gemini missing
assert 'missing model levels exit 4' equals "$status" 4
printf 'gemini.light = gemini-4-hydrogen-low\ngemini.standard = gemini-4-hydrogen-low @max\n' > "$pins"
run_model gemini light
assert 'suffixed pin reads base' equals "$output" gemini-4-hydrogen
run_model effort gemini light
assert 'suffix becomes pin effort' equals "$output" low
run_model effort gemini standard
assert 'explicit pin effort wins without capping' equals "$output" max
run_model show --json
assert 'Settings caps the explicit effort' json_assert 'import json,sys; x=json.load(sys.stdin); assert x["gemini"]["standard"]=={"model":"gemini-4-hydrogen","effort":"xhigh"}'
run_model agy-launch gemini-4-hydrogen-low high
assert 'launch normalizes suffix and preserves explicit effort' equals "$output" $'gemini-4-hydrogen\thigh'
run_model agy-launch gemini-4-carbon max
assert 'launch rounds down' equals "$output" $'gemini-4-carbon\thigh'
run_model agy-launch lone-low max
assert 'launch drops effort on single' equals "$output" $'lone-low\t'
run_model agy-launch missing max
assert 'launch preserves unknown model' equals "$output" $'missing\tmax'
run_model agy-launch gemini-4-carbon
assert 'launch preserves CLI default' equals "$output" $'gemini-4-carbon\t'
# Old format is refreshed even when fresh; failure leaves unknown levels and backs off.
python3 -c 'import json,sys,time; json.dump({"at":time.time(),"models":[{"value":"old","label":"Old"}]},open(sys.argv[1],"w"))' "$case_dir/agy-models.json"
run_model levels gemini gemini-4-carbon
assert 'fresh old-format cache refreshes' equals "$output" $'low\nmedium\nhigh'
python3 -c 'import json,sys,time; json.dump({"at":time.time(),"models":[{"value":"old","label":"Old"}]},open(sys.argv[1],"w"))' "$case_dir/agy-models.json"
printf '#!/bin/sh\necho fail >> "%s"\nexit 1\n' "$case_dir/calls" > "$fake_agy"
run_model levels gemini old
assert 'unknown old-format levels exit 4' equals "$status" 4
run_model agy-launch old high
assert 'old-format launch keeps effort on failure' equals "$output" $'old\thigh'
assert 'failure backoff avoids second invocation' bash -c '[[ $(grep -c fail "$1") == 1 ]]' _ "$case_dir/calls"
python3 -c 'import json,sys; p=sys.argv[1]; d=json.load(open(p)); d["failed_at"]=0; json.dump(d,open(p,"w"))' "$case_dir/agy-models.json"
printf '#!/bin/sh\necho call >> "%s"\ncat "%s"\n' "$case_dir/calls" "$listing" > "$fake_agy"
run_model levels gemini gemini-4-carbon
assert 'success clears failure' bash -c '[[ $1 == 0 ]] && ! grep -q failed_at "$2"' _ "$status" "$case_dir/agy-models.json"
python3 -c 'import json,sys; p=sys.argv[1]; d=json.load(open(p)); d["at"]=0; json.dump(d,open(p,"w"))' "$case_dir/agy-models.json"
printf '#!/bin/sh\nsleep 8\n' > "$fake_agy"
start=$SECONDS
run_model agy-launch gemini-4-carbon max
assert 'stalled launch refresh times out and uses saved list' bash -c '[[ $1 == 0 && $2 == $'"'"'gemini-4-carbon\thigh'"'"' && $3 -le 6 ]]' _ "$status" "$output" "$((SECONDS-start))"
assert 'timeout records failure' grep -q failed_at "$case_dir/agy-models.json"
# Missing list fetches on demand, and a failed first fetch uses a sibling backoff file.
new_case
fake_agy=$case_dir/agy
printf '#!/bin/sh\necho call >> "%s"\nexit 1\n' "$case_dir/calls" > "$fake_agy"
chmod +x "$fake_agy"
export WHEELCHAIR_AGY=$fake_agy
printf 'gemini.light = gemini-4-carbon-low\n' > "$pins"
run_model gemini light
assert 'without a list a suffix stays unchanged' equals "$output" gemini-4-carbon-low
run_model effort gemini light
assert 'without a list a suffix does not invent effort' bash -c '[[ $1 == 0 && -z $2 ]]' _ "$status" "$output"
assert 'missing-list failure backs off in sibling file' bash -c '[[ $(wc -l < "$1") == 1 && -s $2 ]]' _ "$case_dir/calls" "$case_dir/agy-models.json.failed"
printf '0\n' > "$case_dir/agy-models.json.failed"
printf '#!/bin/sh\necho call >> "%s"\nprintf "gemini-4-carbon-low\\tCarbon (Low)\\ngemini-4-carbon-high\\tCarbon (High)\\n"\n' "$case_dir/calls" > "$fake_agy"
run_model effort gemini light
assert 'missing list fetch normalizes pin on demand' equals "$output" low
assert 'success removes sibling failure marker' test ! -e "$case_dir/agy-models.json.failed"
run_model agy-launch gemini-4-carbon medium
assert 'launch rounds down across a gap' equals "$output" $'gemini-4-carbon\tlow'
python3 -c 'import json,sys; p=sys.argv[1]; d=json.load(open(p)); d["models"][0]["efforts"]=["high","xhigh"]; json.dump(d,open(p,"w"))' "$case_dir/agy-models.json"
run_model agy-launch gemini-4-carbon low
assert 'launch uses lowest level if none is below request' equals "$output" $'gemini-4-carbon\thigh'
export WHEELCHAIR_AGY=

# Legacy behavior coverage ported to the new tier names and models-file format.
new_case
run_model light
assert 'missing pins use Light default' equals "$output" 'gpt-6-luna'
assert 'reader succeeds with missing pins' test "$status" -eq 0
run_model nope
assert 'unknown tier exits 2' test "$status" -eq 2

new_case
run_model gpt standard
assert 'reader defaults a missing tier' equals "$output" 'gpt-5.6-terra'
printf 'this is not a pin\n' > "$pins"
run_model gpt standard
assert 'malformed pins reader returns shipped default' equals "$output" 'gpt-5.6-terra'
assert 'malformed pins reader warns on stderr' contains "$(<"$stderr")" 'malformed'

new_case
run_model init
before=$(<"$pins")
run_model init
assert 'init leaves an existing pins file unchanged' equals "$(<"$pins")" "$before"
pins=/dev/null/models
run_model init
assert 'init reports a write failure' test "$status" -eq 1

new_case
run_model set gpt heavy gpt-6.2-sol
assert 'set succeeds' test "$status" -eq 0
assert 'set creates the other default pins' bash -c 'grep -Fxq "gpt.light = gpt-6-luna" "$1" && grep -Fxq "gpt.critical = gpt-6-astra" "$1"' _ "$pins"
printf 'gpt.heavy = gpt-6.1-sol\nskip = gpt-6.2-sol\nskip = gpt-6.3-sol\n' > "$pins"
run_model set gpt heavy gpt-6.2-sol
assert 'set removes skips for its selected model' bash -c '! grep -Fxq "skip = gpt-6.2-sol" "$1" && grep -Fxq "skip = gpt-6.3-sol" "$1"' _ "$pins"
printf 'bad row\n' > "$pins"
before=$(<"$pins")
run_model set gpt heavy gpt-6.2-sol
assert 'set rejects malformed pins' test "$status" -eq 1
assert 'set leaves malformed pins unchanged' equals "$(<"$pins")" "$before"
run_model set gpt wrong gpt-6.2-sol
assert 'set rejects a bad tier' test "$status" -eq 2
run_model set gpt heavy bad/model
assert 'set rejects a bad model' test "$status" -eq 2

new_case
run_model skip gpt-7-nova
assert 'skip succeeds' test "$status" -eq 0
assert 'skip adds its model' grep -Fxq 'skip = gpt-7-nova' "$pins"
run_model skip gpt-7-nova
assert 'skip does not duplicate a model' bash -c '[[ $(grep -Fxc "skip = gpt-7-nova" "$1") == 1 ]]' _ "$pins"
printf 'broken row\n' > "$pins"
before=$(<"$pins")
run_model skip gpt-7-nova
assert 'skip rejects malformed pins' test "$status" -eq 1
assert 'skip leaves malformed pins unchanged' equals "$(<"$pins")" "$before"
run_model skip bad/model
assert 'skip rejects a bad model' test "$status" -eq 2

new_case
printf 'gpt.heavy = gpt-6-sol\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-6.0-sol","visibility":"list"}]}'
run_model check
assert '6 equals 6.0 numerically' equals "$output" ''
write_cache '{"models":[{"slug":"gpt-6.1-sol","visibility":"list"}]}'
run_model check
assert '6.1 beats 6 numerically' contains "$output" "gpt-6.1-sol is newer than Heavy's gpt-6-sol"
printf 'gpt.heavy = gpt-6.9-sol\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-6.10-sol","visibility":"list"}]}'
run_model check
assert '6.10 beats 6.9 numerically' contains "$output" "gpt-6.10-sol is newer than Heavy's gpt-6.9-sol"

new_case
write_cache '{"models":[{"slug":"gpt-6.2-sol","visibility":"list"},{"slug":"gpt-6.3-sol","visibility":"list"}]}'
run_model check
assert 'normal heads-up uses the exact switch and skip form' equals "$output" "heads-up: gpt-6.3-sol is newer than Heavy's gpt-6.1-sol. Switch: $repo/codex/model.sh set gpt heavy gpt-6.3-sol (or $repo/codex/model.sh skip gpt-6.3-sol)"
run_model skip gpt-6.3-sol
run_model check
assert 'skip offers the next newest model' contains "$output" 'gpt-6.2-sol is newer'

new_case
printf 'gpt.heavy = gpt-7-nova\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-7-nova","visibility":"list"}]}'
run_model check
assert 'a pinned no-tier model stays quiet' equals "$output" ''
write_cache '{"models":[{"slug":"gpt-7-nova","visibility":"list"},{"slug":"gpt-7.1-nova","visibility":"list"}]}'
run_model check
assert 'a later pinned-family model is offered for that tier' equals "$output" "heads-up: gpt-7.1-nova is newer than Heavy's gpt-7-nova. Switch: $repo/codex/model.sh set gpt heavy gpt-7.1-nova (or $repo/codex/model.sh skip gpt-7.1-nova)"

new_case
printf 'gpt.heavy = hand-set\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-8.1-sol","visibility":"list"},{"slug":"gpt-8.2-sol","visibility":"list"}]}'
run_model check
assert 'an unparseable pin uses its available-for line' equals "$output" "heads-up: gpt-8.2-sol is available for Heavy, which is pinned to hand-set. Switch: $repo/codex/model.sh set gpt heavy gpt-8.2-sol (or $repo/codex/model.sh skip gpt-8.2-sol)"
run_model skip gpt-8.2-sol
run_model check
assert 'skipping the newest unparseable-pin candidate is quiet' equals "$output" ''

new_case
write_cache '{"models":[{"slug":"gpt-7-alpha","visibility":"list"},{"slug":"gpt-8-beta","visibility":"list"},{"slug":"gpt-9-gamma","visibility":"list"},{"slug":"gpt-10-delta","visibility":"list"}]}'
run_model check
expected=$(printf 'heads-up: gpt-10-delta is available and matches no tier. Pin it: %s/codex/model.sh set gpt <tier> gpt-10-delta (or %s/codex/model.sh skip gpt-10-delta)\nheads-up: gpt-9-gamma is available and matches no tier. Pin it: %s/codex/model.sh set gpt <tier> gpt-9-gamma (or %s/codex/model.sh skip gpt-9-gamma)\nheads-up: gpt-8-beta is available and matches no tier. Pin it: %s/codex/model.sh set gpt <tier> gpt-8-beta (or %s/codex/model.sh skip gpt-8-beta)\nheads-up: and 1 more that match no tier' "$repo" "$repo" "$repo" "$repo" "$repo" "$repo")
assert 'tierless models use three newest lines and the remainder line' equals "$output" "$expected"

new_case
run_model check
assert 'a missing cache prints no model lines' equals "$output" ''
write_cache 'not json'
run_model check
assert 'a malformed cache prints no model lines' equals "$output" ''
printf -v huge_number '%*s' 5000 ''
huge_number=${huge_number// /9}
printf '{"models": [{"slug": "gpt-6.2-sol", "visibility": "list", "n": %s}]}' "$huge_number" > "$cache"
run_model check
assert 'a cache with an oversized integer prints no model lines' equals "$output" ''
assert 'a cache with an oversized integer keeps check successful' test "$status" -eq 0
write_cache '{"models":[{"slug":"gpt-9-sol","visibility":"hide"}]}'
run_model check
assert 'a hidden-only cache prints no model lines' equals "$output" ''
printf 'malformed\n' > "$pins"
run_model check
assert 'malformed pins line prints even without a useful cache' equals "$output" "heads-up: $pins is malformed, so every GPT lane is using the shipped defaults. Fix or delete it"
assert 'check is always successful' test "$status" -eq 0

new_case
write_cache '{"models":[{"slug":"gpt-6.2-sol","visibility":"list"}]}'
mkdir -p "$case_dir/codex-home" "$case_dir/preflight"
ln -s "$model" "$case_dir/preflight/model.sh"
mkfifo "$case_dir/stub-port"
python3 - <<'PY' > "$case_dir/stub-port" &
from http.server import BaseHTTPRequestHandler, HTTPServer
class Stub(BaseHTTPRequestHandler):
    def do_POST(self):
        # Read the body: closing a socket with unread data sends a reset, which macOS's
        # client sees before it can read the error body.
        self.rfile.read(int(self.headers.get('Content-Length') or 0))
        code = 500 if self.path == '/500' else 400
        self.send_response(code); self.send_header('Content-Length', '7'); self.end_headers(); self.wfile.write(b'fixture')
    def log_message(self, *args): pass
server = HTTPServer(('127.0.0.1', 0), Stub)
print(server.server_port, flush=True)
server.handle_request()
server.handle_request()
PY
stub_pid=$!
read -r stub_port < "$case_dir/stub-port"
sed "s|https://auth.openai.com/oauth/token|http://127.0.0.1:$stub_port/500|" "$preflight" > "$case_dir/preflight/preflight-500.sh"
sed "s|https://auth.openai.com/oauth/token|http://127.0.0.1:$stub_port/400|" "$preflight" > "$case_dir/preflight/preflight-400.sh"
chmod +x "$case_dir/preflight/preflight-500.sh" "$case_dir/preflight/preflight-400.sh"
run_preflight() {
  local script=$1
  set +e
  preflight_output=$(CODEX_HOME="$case_dir/codex-home" WHEELCHAIR_MODELS="$pins" WHEELCHAIR_MODELS_CACHE="$cache" "$script" 2>&1)
  preflight_status=$?
  set -e
}
mkdir "$case_dir/no-flock"
for command in bash python3 dirname; do
  ln -s "$(command -v "$command")" "$case_dir/no-flock/$command"
done
printf '{"tokens":{}}\n' > "$case_dir/codex-home/auth.json"
PATH="$case_dir/no-flock" run_preflight "$case_dir/preflight/preflight-500.sh"
assert 'preflight works without flock on PATH' test "$preflight_status" -eq 0
assert 'preflight keeps exit 0 with a heads-up' bash -c '[[ $1 == 0 && $2 == *"heads-up: gpt-6.2-sol"* ]]' _ "$preflight_status" "$preflight_output"
printf '{"tokens":{"access_token":"x.eyJleHAiOjB9.x","refresh_token":"fixture"}}\n' > "$case_dir/codex-home/auth.json"
run_preflight "$case_dir/preflight/preflight-500.sh"
assert 'preflight keeps exit 1 with a heads-up' bash -c '[[ $1 == 1 && $2 == *"heads-up: gpt-6.2-sol"* ]]' _ "$preflight_status" "$preflight_output"
printf '{"tokens":{"access_token":"x.eyJleHAiOjB9.x","refresh_token":"fixture"}}\n' > "$case_dir/codex-home/auth.json"
run_preflight "$case_dir/preflight/preflight-400.sh"
assert 'preflight keeps exit 2 with a heads-up' bash -c '[[ $1 == 2 && $2 == *"heads-up: gpt-6.2-sol"* ]]' _ "$preflight_status" "$preflight_output"
[[ $preflight_status == 2 ]] || printf 'exit-2 case got status %s, output:\n%s\n' "$preflight_status" "$preflight_output"
wait "$stub_pid"

new_case
python3 - "$repo/connectors/registry.json" "$case_dir/registry.json" <<'PYREG'
import copy, json, sys
with open(sys.argv[1]) as handle:
    registry = json.load(handle)
tool = copy.deepcopy(registry["tools"][0])
tool["cli"] = tool["provider"] = "newtool"
tool["models"]["format"] = "^[A-Za-z0-9][A-Za-z0-9._/:-]*$"
registry["tools"].append(tool)
with open(sys.argv[2], "w") as handle:
    json.dump(registry, handle)
PYREG
export WHEELCHAIR_REGISTRY="$case_dir/registry.json"
run_model init
assert 'registry extension initializes' test "$status" -eq 0
for provider in claude gpt gemini kimi openrouter; do
  for slot in light standard heavy critical lead sub-lead; do
    run_model "$provider" "$slot"
    printf '%s\n' "$output" >> "$case_dir/before"
  done
done
run_model set newtool standard new-model
assert 'registry extension accepts a new provider pin' test "$status" -eq 0
run_model newtool standard
assert 'registry extension reads its pin' equals "$output" 'new-model'
for provider in claude gpt gemini kimi openrouter; do
  for slot in light standard heavy critical lead sub-lead; do
    run_model "$provider" "$slot"
    printf '%s\n' "$output" >> "$case_dir/after"
  done
done
assert 'registry extension leaves other providers unchanged' cmp -s "$case_dir/before" "$case_dir/after"
run_model set gpt standard gpt-override
assert 'registry extension seeds GPT override' test "$status" -eq 0
run_model set newtool standard Model-V2
assert 'registry extension rejects uppercase pin with usage exit' test "$status" -eq 2
run_model show --json
assert 'rejected uppercase pin preserves GPT override' json_assert 'import json,sys; x=json.load(sys.stdin); assert x["malformed"] is False and x["gpt"]["standard"]["model"] == "gpt-override"'
unset WHEELCHAIR_REGISTRY

printf 'RESULT %d passed, %d failed\n' "$passes" "$failures"
(( failures == 0 ))
