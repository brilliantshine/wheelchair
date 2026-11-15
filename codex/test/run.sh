#!/usr/bin/env bash
# Fixture suite for the local agent model pins.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
model=${MODEL_SH:-"$repo/codex/model.sh"}
preflight=${PREFLIGHT_SH:-"$repo/codex/preflight.sh"}
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
coproc STUB { python3 - <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
class Stub(BaseHTTPRequestHandler):
    def do_POST(self):
        code = 500 if self.path == '/500' else 400
        self.send_response(code); self.end_headers(); self.wfile.write(b'fixture')
    def log_message(self, *args): pass
server = HTTPServer(('127.0.0.1', 0), Stub)
print(server.server_port, flush=True)
server.handle_request()
server.handle_request()
PY
}
read -r stub_port <&"${STUB[0]}"
stub_pid=$STUB_PID
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
printf '{"tokens":{}}\n' > "$case_dir/codex-home/auth.json"
run_preflight "$case_dir/preflight/preflight-500.sh"
assert 'preflight keeps exit 0 with a heads-up' bash -c '[[ $1 == 0 && $2 == *"heads-up: gpt-6.2-sol"* ]]' _ "$preflight_status" "$preflight_output"
printf '{"tokens":{"access_token":"x.eyJleHAiOjB9.x","refresh_token":"fixture"}}\n' > "$case_dir/codex-home/auth.json"
run_preflight "$case_dir/preflight/preflight-500.sh"
assert 'preflight keeps exit 1 with a heads-up' bash -c '[[ $1 == 1 && $2 == *"heads-up: gpt-6.2-sol"* ]]' _ "$preflight_status" "$preflight_output"
printf '{"tokens":{"access_token":"x.eyJleHAiOjB9.x","refresh_token":"fixture"}}\n' > "$case_dir/codex-home/auth.json"
run_preflight "$case_dir/preflight/preflight-400.sh"
assert 'preflight keeps exit 2 with a heads-up' bash -c '[[ $1 == 2 && $2 == *"heads-up: gpt-6.2-sol"* ]]' _ "$preflight_status" "$preflight_output"
wait "$stub_pid"

printf 'RESULT %d passed, %d failed\n' "$passes" "$failures"
(( failures == 0 ))
