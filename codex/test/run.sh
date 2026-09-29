#!/usr/bin/env bash
# Fixture suite for the local GPT model pins.  Every fixture is under a fresh
# temporary directory and is selected through model.sh's two path seams.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
model=${MODEL_SH:-"$repo/codex/model.sh"}
preflight=${PREFLIGHT_SH:-"$repo/codex/preflight.sh"}
fixture=$(mktemp -d)

passes=0
failures=0
pass() { printf 'PASS %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
assert() {
  local description=$1
  shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}
contains() { [[ $1 == *"$2"* ]]; }
equals() { [[ $1 == "$2" ]]; }

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
  printf "# wheelchair's GPT model pins. Change them with codex/model.sh.\nluna = gpt-6-luna\nterra = gpt-5.6-terra\nsol = gpt-6.1-sol\nastra = gpt-6-astra\n"
}

# Reader, init, set, and skip command-table rows.
new_case
run_model luna
assert 'missing pins use Luna default' equals "$output" 'gpt-6-luna'
assert 'reader succeeds with missing pins' test "$status" -eq 0
run_model nope
assert 'unknown tier exits 2' test "$status" -eq 2

new_case
printf 'sol = custom-sol\n' > "$pins"
run_model sol
assert 'reader returns a present tier pin' equals "$output" custom-sol
run_model luna
assert 'reader defaults a missing tier' equals "$output" gpt-6-luna
printf 'this is not a pin\n' > "$pins"
run_model terra
assert 'malformed pins reader returns shipped default' equals "$output" gpt-5.6-terra
assert 'malformed pins reader warns on stderr' contains "$(<"$stderr")" 'malformed'

new_case
run_model init
assert 'init succeeds' test "$status" -eq 0
assert 'init writes shipped defaults' cmp -s <(default_pins) "$pins"
before=$(<"$pins")
run_model init
assert 'init leaves an existing pins file unchanged' equals "$(<"$pins")" "$before"
pins=/dev/null/models
run_model init
assert 'init reports a write failure' test "$status" -eq 1

new_case
run_model set sol gpt-6.2-sol
assert 'set succeeds' test "$status" -eq 0
run_model sol
assert 'set pins its requested model' equals "$output" gpt-6.2-sol
assert 'set creates the other default pins' bash -c 'grep -Fxq "luna = gpt-6-luna" "$1" && grep -Fxq "astra = gpt-6-astra" "$1"' _ "$pins"
printf 'sol = gpt-6.1-sol\nskip = gpt-6.2-sol\nskip = gpt-6.3-sol\n' > "$pins"
run_model set sol gpt-6.2-sol
assert 'set removes skips for its selected model' bash -c '! grep -Fxq "skip = gpt-6.2-sol" "$1" && grep -Fxq "skip = gpt-6.3-sol" "$1"' _ "$pins"
printf 'bad row\n' > "$pins"
before=$(<"$pins")
run_model set sol gpt-6.2-sol
assert 'set rejects malformed pins' test "$status" -eq 1
assert 'set leaves malformed pins unchanged' equals "$(<"$pins")" "$before"
run_model set wrong gpt-6.2-sol
assert 'set rejects a bad tier' test "$status" -eq 2
run_model set sol bad/model
assert 'set rejects a bad model' test "$status" -eq 2

new_case
run_model skip gpt-7-nova
assert 'skip succeeds' test "$status" -eq 0
assert 'skip adds its model' grep -Fxq 'skip = gpt-7-nova' "$pins"
run_model skip gpt-7-nova
assert 'skip does not duplicate a model' bash -c '[[ $(grep -Fxc "skip = gpt-7-nova" "$1") == 1 ]]' _ "$pins"
printf 'broken\n' > "$pins"
before=$(<"$pins")
run_model skip gpt-7-nova
assert 'skip rejects malformed pins' test "$status" -eq 1
assert 'skip leaves malformed pins unchanged' equals "$(<"$pins")" "$before"
run_model skip bad/model
assert 'skip rejects a bad model' test "$status" -eq 2

# Cache handling, numeric comparison, normal heads-ups, skips, and pin suppression.
new_case
printf 'sol = gpt-6-sol\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-6.0-sol","visibility":"list"}]}'
run_model check
assert '6 equals 6.0 numerically' equals "$output" ''
write_cache '{"models":[{"slug":"gpt-6.1-sol","visibility":"list"}]}'
run_model check
assert '6.1 beats 6 numerically' contains "$output" "gpt-6.1-sol is newer than Sol's gpt-6-sol"
printf 'sol = gpt-6.9-sol\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-6.10-sol","visibility":"list"}]}'
run_model check
assert '6.10 beats 6.9 numerically' contains "$output" "gpt-6.10-sol is newer than Sol's gpt-6.9-sol"

new_case
write_cache '{"models":[{"slug":"gpt-6.2-sol","visibility":"list"},{"slug":"gpt-6.3-sol","visibility":"list"}]}'
run_model check
assert 'normal heads-up uses the exact switch and skip form' equals "$output" "heads-up: gpt-6.3-sol is newer than Sol's gpt-6.1-sol. Switch: $repo/codex/model.sh set sol gpt-6.3-sol (or $repo/codex/model.sh skip gpt-6.3-sol)"
run_model skip gpt-6.3-sol
run_model check
assert 'skip offers the next newest model' contains "$output" 'gpt-6.2-sol is newer'

new_case
printf 'sol = gpt-7-nova\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-7-nova","visibility":"list"}]}'
run_model check
assert 'a pinned no-tier model stays quiet' equals "$output" ''
write_cache '{"models":[{"slug":"gpt-7-nova","visibility":"list"},{"slug":"gpt-7.1-nova","visibility":"list"}]}'
run_model check
assert 'a later pinned-family model is offered for that tier' equals "$output" "heads-up: gpt-7.1-nova is newer than Sol's gpt-7-nova. Switch: $repo/codex/model.sh set sol gpt-7.1-nova (or $repo/codex/model.sh skip gpt-7.1-nova)"

new_case
printf 'sol = hand-set\n' > "$pins"
write_cache '{"models":[{"slug":"gpt-8.1-sol","visibility":"list"},{"slug":"gpt-8.2-sol","visibility":"list"}]}'
run_model check
assert 'an unparseable pin uses its available-for line' equals "$output" "heads-up: gpt-8.2-sol is available for Sol, which is pinned to hand-set. Switch: $repo/codex/model.sh set sol gpt-8.2-sol (or $repo/codex/model.sh skip gpt-8.2-sol)"
run_model skip gpt-8.2-sol
run_model check
assert 'skipping the newest unparseable-pin candidate is quiet' equals "$output" ''

new_case
write_cache '{"models":[{"slug":"gpt-7-alpha","visibility":"list"},{"slug":"gpt-8-beta","visibility":"list"},{"slug":"gpt-9-gamma","visibility":"list"},{"slug":"gpt-10-delta","visibility":"list"}]}'
run_model check
expected=$(printf 'heads-up: gpt-10-delta is available and matches no tier. Pin it: %s/codex/model.sh set <tier> gpt-10-delta (or %s/codex/model.sh skip gpt-10-delta)\nheads-up: gpt-9-gamma is available and matches no tier. Pin it: %s/codex/model.sh set <tier> gpt-9-gamma (or %s/codex/model.sh skip gpt-9-gamma)\nheads-up: gpt-8-beta is available and matches no tier. Pin it: %s/codex/model.sh set <tier> gpt-8-beta (or %s/codex/model.sh skip gpt-8-beta)\nheads-up: and 1 more that match no tier' "$repo" "$repo" "$repo" "$repo" "$repo" "$repo")
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

# Keep the preflight tests offline: a local, two-request HTTP fixture replaces
# the token URL in a temporary preflight copy and returns 500 then 400.
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
