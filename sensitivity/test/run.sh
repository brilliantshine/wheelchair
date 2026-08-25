#!/usr/bin/env bash
# Each case owns temporary harness homes; this suite never writes the live ones.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
writer=${SENSITIVITY_SET:-"$repo/sensitivity/set.sh"}
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT

passes=0
failures=0
pass() { printf 'PASS %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
assert() {
  local description=$1
  shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}

file_state() {
  if [[ -e $1 ]]; then printf 'present:%s' "$(sha256sum "$1" | awk '{print $1}')"; else printf absent; fi
}
region() { sed -n '/^<!-- wheelchair:diagram-sensitivity start -->$/,/^<!-- wheelchair:diagram-sensitivity end -->$/p' "$1"; }
without_level() { grep -Ev '^diagram-sensitivity: (ask|default|high)$'; }
level_of() { region "$1" | sed -nE 's/^diagram-sensitivity: (ask|default|high)$/\1/p'; }

real_claude="$HOME/.claude/CLAUDE.md"
real_codex="$HOME/.codex/AGENTS.md"
real_claude_before=$(file_state "$real_claude")
real_codex_before=$(file_state "$real_codex")

declare -A claude codex output status
new_case() {
  local name=$1 base
  base=$fixture/$name
  mkdir -p "$base/claude" "$base/codex"
  claude[$name]=$base/claude
  codex[$name]=$base/codex
}
run_case() {
  local name=$1
  set +e
  output[$name]=$(WHEELCHAIR_CLAUDE_HOME="${claude[$name]}" WHEELCHAIR_CODEX_HOME="${codex[$name]}" "$writer" "${@:2}" 2>&1)
  status[$name]=$?
  set -e
}
target_claude() { printf '%s/CLAUDE.md' "${claude[$1]}"; }
target_codex() { printf '%s/AGENTS.md' "${codex[$1]}"; }
both_unchanged() {
  [[ $(file_state "$(target_claude "$1")") == "$2" && $(file_state "$(target_codex "$1")") == "$3" ]]
}

# Setup gate.  Every case below assumes the writer accepted protocol/sensitivity.md; when it
# does not -- a marker broken while editing the region, a level line lost -- the first case that
# post-processes a file it never got dies at `sed: can't read`, five cases and one confusing
# error away from the actual cause.  Say the cause here instead.
new_case source_sane
run_case source_sane
if [[ ${status[source_sane]} != 0 ]]; then
  printf 'FATAL %s\n' "the writer refuses this repo's own protocol/sensitivity.md: ${output[source_sane]}" >&2
  exit 2
fi

# Writing: existing prose, a missing target, three explicit positions, and an
# edited owned region all keep their unowned bytes intact.
new_case prose
printf 'claude prose\n' > "$(target_claude prose)"
printf 'codex prose' > "$(target_codex prose)"
run_case prose
assert 'markerless prose seeds both files' bash -c '[[ $1 == 0 && $2 == *"claude prose"* && $2 == *"codex prose"* ]]' _ "${status[prose]}" "$(cat "$(target_claude prose)")$(cat "$(target_codex prose)")"
assert 'markerless prose keeps prefixes byte-for-byte' bash -c 'head -c 13 "$1" | cmp -s - <(printf "claude prose\\n") && head -c 11 "$2" | cmp -s - <(printf "codex prose")' _ "$(target_claude prose)" "$(target_codex prose)"

new_case missing
run_case missing
assert 'missing targets are created with just the region' bash -c 'cmp -s "$1" "$2" && [[ $(head -n 1 "$1") == "<!-- wheelchair:diagram-sensitivity start -->" ]]' _ "$(target_claude missing)" "$(target_codex missing)"

for requested in ask default high; do
  name="level_$requested"
  new_case "$name"
  run_case "$name" "$requested"
  run_case "$name" --report
  assert "$requested sets and reports both files" bash -c '[[ $1 == 0 && $2 == "diagram-sensitivity: $3" && $(sed -nE "s/^diagram-sensitivity: (ask|default|high)$/\\1/p" "$4") == "$3" && $(sed -nE "s/^diagram-sensitivity: (ask|default|high)$/\\1/p" "$5") == "$3" ]]' _ "${status[$name]}" "${output[$name]}" "$requested" "$(target_claude "$name")" "$(target_codex "$name")"
done

new_case edited
run_case edited high
edited_c=$(target_claude edited); edited_d=$(target_codex edited)
sed -i 's/## Answering with a picture/## Hand edited/' "$edited_c"
printf 'before\n' > "$edited_d.tmp"
cat "$edited_d" >> "$edited_d.tmp"
printf 'after-no-newline' >> "$edited_d.tmp"
mv "$edited_d.tmp" "$edited_d"
run_case edited default
assert 'owned content is overwritten while outside bytes survive' bash -c '[[ $1 == 0 ]] && grep -q "## Answering with a picture" "$2" && ! grep -q "Hand edited" "$2" && [[ $(head -n 1 "$3") == before ]] && [[ $(tail -c 16 "$3") == after-no-newline ]]' _ "${status[edited]}" "$edited_c" "$edited_d"

# Resolve once across the pair.
new_case resolution_none
run_case resolution_none
if [[ $(level_of "$(target_claude resolution_none)") == default && $(level_of "$(target_codex resolution_none)") == default ]]; then pass 'no existing blocks resolve to default'; else fail 'no existing blocks resolve to default'; fi

new_case resolution_one
run_case resolution_one high
sed -i '/^<!-- wheelchair:diagram-sensitivity start -->$/,/^<!-- wheelchair:diagram-sensitivity end -->$/d' "$(target_codex resolution_one)"
run_case resolution_one
if [[ $(level_of "$(target_claude resolution_one)") == high && $(level_of "$(target_codex resolution_one)") == high ]]; then pass 'one high block refreshes both at high'; else fail 'one high block refreshes both at high'; fi

new_case resolution_same
run_case resolution_same high
run_case resolution_same
if [[ $(level_of "$(target_claude resolution_same)") == high && $(level_of "$(target_codex resolution_same)") == high ]]; then pass 'matching high blocks stay high'; else fail 'matching high blocks stay high'; fi

new_case divergence
run_case divergence ask
sed -i 's/^diagram-sensitivity: ask$/diagram-sensitivity: high/' "$(target_codex divergence)"
before_c=$(file_state "$(target_claude divergence)"); before_d=$(file_state "$(target_codex divergence)")
run_case divergence
assert 'unrequested divergence refuses and names both levels' bash -c '[[ $1 == 1 && $2 == *ask* && $2 == *high* && $3 == "$4" && $5 == "$6" ]]' _ "${status[divergence]}" "${output[divergence]}" "$(file_state "$(target_claude divergence)")" "$before_c" "$(file_state "$(target_codex divergence)")" "$before_d"
run_case divergence default
if [[ ${status[divergence]} == 0 && $(level_of "$(target_claude divergence)") == default && $(level_of "$(target_codex divergence)") == default ]]; then pass 'explicit level repairs divergence in both files'; else fail 'explicit level repairs divergence in both files'; fi

# Fault helper snapshots both targets immediately before a refusal.
snapshot_fault() { fault_c=$(file_state "$(target_claude "$1")"); fault_d=$(file_state "$(target_codex "$1")"); }
assert_fault() { assert "$1 changes neither target" both_unchanged "$2" "$fault_c" "$fault_d"; }

new_case double_markers
run_case double_markers
cp "$(target_claude double_markers)" "$(target_claude double_markers).again"
cat "$(target_claude double_markers).again" >> "$(target_claude double_markers)"
snapshot_fault double_markers; run_case double_markers
assert 'two marker pairs refuse' bash -c '[[ $1 == 1 && $2 == *marker* ]]' _ "${status[double_markers]}" "${output[double_markers]}"
assert_fault 'two marker pairs' double_markers

new_case broken_marker
printf '%s\n' '<!-- wheelchair:diagram-sensitivity start -->' > "$(target_claude broken_marker)"
snapshot_fault broken_marker; run_case broken_marker
assert 'unclosed marker refuses' bash -c '[[ $1 == 1 && $2 == *marker* ]]' _ "${status[broken_marker]}" "${output[broken_marker]}"
assert_fault 'unclosed marker' broken_marker

new_case unwritable
run_case unwritable
chmod a-w "$(target_codex unwritable)"
snapshot_fault unwritable; run_case unwritable default
assert 'unwritable second target refuses' bash -c '[[ $1 == 1 && $2 == *writable* ]]' _ "${status[unwritable]}" "${output[unwritable]}"
assert_fault 'unwritable second target' unwritable

new_case malformed_second
run_case malformed_second
sed -i '/^diagram-sensitivity:/d' "$(target_codex malformed_second)"
snapshot_fault malformed_second; run_case malformed_second
assert 'malformed second target refuses' bash -c '[[ $1 == 1 && $2 == *"level line"* ]]' _ "${status[malformed_second]}" "${output[malformed_second]}"
assert_fault 'malformed second target' malformed_second

new_case override
run_case override
printf 'custom override\n' > "${codex[override]}/AGENTS.override.md"
snapshot_fault override; run_case override
assert 'non-empty override refuses by name' bash -c '[[ $1 == 1 && $2 == *AGENTS.override.md* ]]' _ "${status[override]}" "${output[override]}"
assert_fault 'non-empty override' override

new_case invalid_argument
snapshot_fault invalid_argument; run_case invalid_argument nonsense
assert 'unrecognised level exits two and names every level' bash -c '[[ $1 == 2 && $2 == *ask* && $2 == *default* && $2 == *high* ]]' _ "${status[invalid_argument]}" "${output[invalid_argument]}"
assert_fault 'unrecognised level' invalid_argument

for kind in no_level two_levels; do
  name="line_$kind"
  new_case "$name"
  run_case "$name"
  if [[ $kind == no_level ]]; then
    sed -i '/^diagram-sensitivity:/d' "$(target_claude "$name")"
  else
    sed -i '/^diagram-sensitivity:/a diagram-sensitivity: high' "$(target_claude "$name")"
  fi
  snapshot_fault "$name"; run_case "$name"
  assert "$kind level lines refuse without repair" bash -c '[[ $1 == 1 && $2 == *"level line"* ]]' _ "${status[$name]}" "${output[$name]}"
  assert_fault "$kind level lines" "$name"
done

# The bare command reads and never resolves: a disagreement is reported as one, and an
# absent dial is named as absent rather than reported at some level.
new_case report_diverged
run_case report_diverged ask
sed -i 's/^diagram-sensitivity: ask$/diagram-sensitivity: high/' "$(target_codex report_diverged)"
snapshot_fault report_diverged; run_case report_diverged --report
assert 'the bare command reports a disagreement instead of picking a side' bash -c '[[ $1 == 1 && $2 == *ask* && $2 == *high* ]]' _ "${status[report_diverged]}" "${output[report_diverged]}"
assert_fault 'the bare command' report_diverged

new_case report_absent
snapshot_fault report_absent; run_case report_absent --report
assert 'the bare command names an uninstalled dial and writes nothing' bash -c '[[ $1 == 0 && $2 == *"not installed"* ]]' _ "${status[report_absent]}" "${output[report_absent]}"
assert_fault 'the bare command on an absent dial' report_absent

# Both harnesses receive the same substituted rule, except for their dial line.
new_case equality
run_case equality high
source_without=$(region "$repo/protocol/sensitivity.md" | sed "s|{{WHEELCHAIR_ROOT}}|$repo|g" | without_level)
claude_without=$(region "$(target_claude equality)" | without_level)
codex_without=$(region "$(target_codex equality)" | without_level)
assert 'landed regions match each other and substituted source apart from level' bash -c '[[ $1 == "$2" && $1 == "$3" ]]' _ "$claude_without" "$codex_without" "$source_without"
assert 'landed region is non-empty with one parseable level' bash -c '[[ -n $1 && $(printf "%s\n" "$1" | grep -Ec "^diagram-sensitivity: (ask|default|high)$") == 1 ]]' _ "$(region "$(target_claude equality)")"
# Every probe below is a phrase that carries a behaviour, matched against the region with its
# line breaks flattened away.  Both halves of that matter.  A short substring chosen for being
# easy to grep -- 'protocol/planning.md', '/diagram-sensitivity' -- survives any edit that keeps
# the words around it, so it asserts that a sentence is nearby rather than that a rule is
# present; that is how deleting two of these behaviours once left the suite green.  And matching
# raw lines makes rewrapping a paragraph a failure, which is the wrong sensitivity in the other
# direction.  Flattened, behaviour-bearing: rewrap freely, delete a rule and this goes red.
#
# Each row is numbered against the region-contents list in the Spec's section 1, because the
# failure this block guards keeps recurring as "one more item nobody wrote a probe for" -- three
# separate rounds found a different missing one.  Numbered, auditing the set is mechanical, and
# it has two halves.  COVERAGE: walk the Spec's nine items, check each has a row; an item with
# no row is the bug.  PRECISION: for each row, read its name and ask whether the phrase would
# still match with the named thing removed -- if it would, the row asserts less than it claims.
# Coverage alone is not enough, and that is not hypothetical: rows 5 and 6 were present, numbered
# and green while the floor's "at every level" and the high rule's "at `high`" could both be
# deleted, which is exactly the scope each row's name was promising to pin.
#
# What this is, and what it is not.  It is a REGRESSION TRIPWIRE keyed to the Spec's nine items,
# not a conformance test for the region.  The authority for what the region must contain is the
# Spec, read by a person when the region is edited; this catches the common way that goes wrong,
# which is a rule quietly disappearing.  Read the other way round -- as proof the region is
# correct -- it will be trusted for more than it can carry, and four review rounds each found one
# more slice of the same nine sentences precisely because a sentence has no finite property set.
# A later round finding another slice adds a row here.  That is the tripwire working, not the
# method failing.
#
# Concretely it cannot see a rule that is *qualified* rather than removed: appending "unless the
# dial is at high" to the subagent exclusion keeps every phrase below and inverts the rule.
# Nothing grep-shaped can.  The region is thirty-one lines; when you edit it, read it.
landed_flat=$(region "$(target_claude equality)" | tr '\n' ' ' | tr -s ' ')
while IFS='|' read -r behaviour phrase; do
  [[ -n $behaviour ]] || continue
  assert "landed region states $behaviour" bash -c 'case "$1" in *"$2"*) exit 0;; *) exit 1;; esac' _ "$landed_flat" "$phrase"
done <<'PROBES'
item 1, the three level names|Three levels — `ask`, `default`, `high`
item 2, that the block is the repo's and is rewritten|owned by the wheelchair repo
item 2, that it is never hand-edited|never by editing these lines
item 2, how the dial is moved instead|/diagram-sensitivity <level>
item 3, the trigger property|three or more things that relate to each other
item 3, its other two limbs|it has a branch, or the order matters
item 4, what ask draws|draw nothing unprompted
item 4, the ask carve-out's own trigger|a planning turn discussing a proposed flow
item 4, where that trigger already lives|protocol/planning.md
item 4, what default draws|the shape **is** the answer
item 4, what high draws|whenever a shape is present at all
item 5, the floor, at every level|No shape, no picture — at every level, including
item 6, the high prose rule|At `high` the prose stays complete but terse
item 7, the draw instruction|When an answer earns a picture, read
item 7, where the drawing procedure lives|protocol/graphs.md
item 8, the explanation covers what it shows|what the picture shows
item 8, and what to look at|what to look at
item 8, and what it leaves out|what it leaves out
item 9, the subagent exclusion|ignores this block
PROBES
assert 'landed region excludes PLAN.md and Spec sections' bash -c '! grep -q "PLAN.md\|Spec" "$1"' _ "$(target_claude equality)"

# The rows above pin which files the region names.  These three pin that an agent can open
# them.  A row cannot: the landed-equals-substituted-source assertion runs the same
# substitution over both sides, so dropping `{{WHEELCHAIR_ROOT}}` from the source passes it and
# every row still matches -- while the block lands telling an agent to read `protocol/graphs.md`
# from whatever directory it happens to be standing in, which resolves to nothing.  That is the
# failure install.sh exists to prevent, and it is not hypothetical: this region shipped a bare
# relative path once already, caught in plan review as finding Y3.
assert 'landed region names no path relative to nowhere' bash -c '! grep -q '"'"'`protocol/'"'"' "$1"' _ "$(target_claude equality)"
assert 'landed region has no unsubstituted placeholder' bash -c '! grep -q "{{" "$1"' _ "$(target_claude equality)"
assert 'landed region names this clone by absolute path' bash -c 'grep -Fq "$2/protocol/" "$1"' _ "$(target_claude equality)" "$repo"

assert 'real CLAUDE.md is byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_claude_before" "$(file_state "$real_claude")"
assert 'real AGENTS.md is byte-identical after suite' bash -c '[[ $1 == "$2" ]]' _ "$real_codex_before" "$(file_state "$real_codex")"

printf 'RESULT %d passed, %d failed\n' "$passes" "$failures"
(( failures == 0 ))
