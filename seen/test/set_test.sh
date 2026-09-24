#!/usr/bin/env bash
# Fixture tests for seen/set.sh. No case touches a live harness home.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
writer=${SEEN_SET:-"$repo/seen/set.sh"}
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
passes=0 failures=0
pass() { printf 'PASS %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
assert() { local note=$1; shift; if "$@"; then pass "$note"; else fail "$note"; fi; }
state() { [[ -e $1 ]] && sha256sum "$1" | awk '{print $1}' || printf absent; }

declare -A claude codex wording present output status command
new_case() {
  local name=$1 base=$fixture/$1
  claude[$name]=$base/claude; codex[$name]=$base/codex; wording[$name]=$base/wheelchair/wording.md
  present[$name]=claude,codex; command[$name]=$writer
}
run_case() {
  local name=$1
  set +e
  output[$name]=$(WHEELCHAIR_PRESENT="${present[$name]}" WHEELCHAIR_CLAUDE_HOME="${claude[$name]}" WHEELCHAIR_CODEX_HOME="${codex[$name]}" WHEELCHAIR_WORDING="${wording[$name]}" "${command[$name]}" 2>&1)
  status[$name]=$?
  set -e
}
settings() { printf '%s/settings.json' "${claude[$1]}"; }
hooks() { printf '%s/hooks.json' "${codex[$1]}"; }
config() { printf '%s/config.toml' "${codex[$1]}"; }
check_json() { python3 - "$@" <<'PY'
import json, sys
for path in sys.argv[1:]: json.load(open(path))
PY
}
our_count() { python3 - "$1" "$repo" <<'PY'
import json, shlex, sys
d=json.load(open(sys.argv[1])); needle=sys.argv[2] + '/seen/hook.sh'
print(sum(any(isinstance(h,dict) and isinstance(h.get('command'),str) and shlex.split(h['command'])[0] == needle for h in g['hooks']) for g in d['hooks']['UserPromptSubmit']))
PY
}

new_case fresh
run_case fresh
assert 'fresh homes create every granted file' bash -c '[[ $1 == 0 && -f $2 && -f $3 && -f $4 && -d $5 ]]' _ "${status[fresh]}" "$(settings fresh)" "$(hooks fresh)" "$(config fresh)" "${wording[fresh]%/*}"
assert 'fresh groups and grants have the canonical fields' python3 - "$(settings fresh)" "$(hooks fresh)" "$(config fresh)" "${wording[fresh]%/*}" "$repo" <<'PY'
import json, sys
c, x, t, word, root = sys.argv[1:]
for path, harness in ((c, 'claude'), (x, 'codex')):
    group=json.load(open(path))['hooks']['UserPromptSubmit'][0]
    h=group['hooks'][0]
    assert h['timeout'] == 2 and 'timeoutSec' not in h
    assert h['command'].endswith('/seen/hook.sh ' + harness + ' notice')
d=json.load(open(c)); assert 'Bash(' + root + '/seen/wording.sh:*)' in d['permissions']['allow']; assert word in d['sandbox']['filesystem']['allowWrite']
assert word in open(t).read()
PY
assert 'fresh JSON parses' check_json "$(settings fresh)" "$(hooks fresh)"
assert 'a created Codex hook asks for its one-time approval' bash -c '[[ $1 == *"run /hooks in Codex once to approve the wheelchair hook"* ]]' _ "${output[fresh]}"
fresh_s=$(state "$(settings fresh)"); fresh_h=$(state "$(hooks fresh)"); fresh_t=$(state "$(config fresh)")
run_case fresh
assert 'second run is byte-identical and emits no Codex approval' bash -c '[[ $1 == 0 && $2 == "$3" && $4 == "$5" && $6 == "$7" && $8 != *"run /hooks"* ]]' _ "${status[fresh]}" "$(state "$(settings fresh)")" "$fresh_s" "$(state "$(hooks fresh)")" "$fresh_h" "$(state "$(config fresh)")" "$fresh_t" "${output[fresh]}"

new_case foreign
mkdir -p "${claude[foreign]}"
printf '%s\n' '{"hooks":{"UserPromptSubmit":[{"matcher":"*","hooks":[{"type":"command","command":"moshi-hook"}]}]}}' > "$(settings foreign)"
run_case foreign
assert 'foreign group stays beside ours' bash -c '[[ $1 == 0 && $(python3 -c "import json; print(len(json.load(open(\"$2\"))[\"hooks\"][\"UserPromptSubmit\"]))") == 2 && $(python3 -c "import json; print(json.load(open(\"$2\"))[\"hooks\"][\"UserPromptSubmit\"][0][\"hooks\"][0][\"command\"])") == moshi-hook ]]' _ "${status[foreign]}" "$(settings foreign)"

new_case changed_args
run_case changed_args
python3 - "$(hooks changed_args)" <<'PY'
import json, sys
p=sys.argv[1]; d=json.load(open(p)); d['hooks']['UserPromptSubmit'][0]['hooks'][0]['command'] += ' old-argument'; open(p,'w').write(json.dumps(d))
PY
run_case changed_args
assert 'changed hook arguments rewrite rather than duplicate' bash -c '[[ $1 == 0 && $2 == 1 ]]' _ "${status[changed_args]}" "$(our_count "$(hooks changed_args)")"

for kind in bad_json root_array hooks_array event_object; do
  new_case "$kind"; mkdir -p "${claude[$kind]}"
  case $kind in
    bad_json) printf '{broken' > "$(settings "$kind")" ;;
    root_array) printf '[]\n' > "$(settings "$kind")" ;;
    hooks_array) printf '{"hooks":[]}\n' > "$(settings "$kind")" ;;
    event_object) printf '{"hooks":{"UserPromptSubmit":{}}}\n' > "$(settings "$kind")" ;;
  esac
  before=$(state "$(settings "$kind")"); run_case "$kind"
  assert "$kind refuses without a write or wording directory" bash -c '[[ $1 == 1 && $2 == "$3" && ! -e $4 ]]' _ "${status[$kind]}" "$(state "$(settings "$kind")")" "$before" "${wording[$kind]%/*}"
done

new_case config_extend
mkdir -p "${codex[config_extend]}"
printf '# kept\n[sandbox_workspace_write]\nwritable_roots = ["/already"]\n[other]\nvalue = 1\n' > "$(config config_extend)"
run_case config_extend
assert 'one-line writable_roots extends and preserves every other config byte' cmp -s <(printf '# kept\n[sandbox_workspace_write]\nwritable_roots = ["/already", "%s"]\n[other]\nvalue = 1\n' "${wording[config_extend]%/*}") "$(config config_extend)"

for kind in config_multiline config_bad; do
  new_case "$kind"; mkdir -p "${codex[$kind]}"
  if [[ $kind == config_multiline ]]; then printf '[sandbox_workspace_write]\nwritable_roots = [\n  "/already"\n]\n' > "$(config "$kind")"; else printf '[broken\n' > "$(config "$kind")"; fi
  before=$(state "$(config "$kind")"); run_case "$kind"
  assert "$kind refuses before creating wording or changing config" bash -c '[[ $1 == 1 && $2 == "$3" && ! -e $4 ]]' _ "${status[$kind]}" "$(state "$(config "$kind")")" "$before" "${wording[$kind]%/*}"
done

new_case no_codex_notice
cp "$writer" "$fixture/no-notice-set.sh"
sed -i 's/"codex": "notice"/"codex": "no-notice"/' "$fixture/no-notice-set.sh"
chmod +x "$fixture/no-notice-set.sh"; command[no_codex_notice]=$fixture/no-notice-set.sh; present[no_codex_notice]=codex
run_case no_codex_notice
assert 'no-notice still installs its hook without grant files' bash -c '[[ $1 == 0 && -f $2 && ! -e $3 && ! -e $4 ]]' _ "${status[no_codex_notice]}" "$(hooks no_codex_notice)" "$(config no_codex_notice)" "${wording[no_codex_notice]%/*}"

new_case none
present[none]=''; run_case none
assert 'empty present seam succeeds and writes nothing' bash -c '[[ $1 == 0 && $2 == *"nothing written"* && ! -e $3 && ! -e $4 ]]' _ "${status[none]}" "${output[none]}" "${claude[none]}" "${codex[none]}"

printf 'RESULT %d passed, %d failed\n' "$passes" "$failures"
(( failures == 0 ))
