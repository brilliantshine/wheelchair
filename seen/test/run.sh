#!/usr/bin/env bash
# Runs every seen/ suite, plus the one check that spans them: the hook's gap constant must
# equal the threshold protocol/seen.md states. Exit non-zero if anything failed.
set -uo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
status=0
for suite in hook_test wording_test set_test; do
  printf '== %s\n' "$suite"
  bash "$repo/seen/test/$suite.sh" || status=1
done

printf '== cross-file\n'
doc=$(sed -nE 's/^gap-threshold: ([0-9]+)h$/\1/p' "$repo/protocol/seen.md")
code=$(sed -nE 's/^GAP_HOURS = ([0-9]+).*/\1/p' "$repo/seen/hook.sh")
if [[ -n $doc && $doc == "$code" ]]; then
  printf 'PASS hook GAP_HOURS (%s) equals protocol/seen.md gap-threshold\n' "$code"
else
  printf 'FAIL hook GAP_HOURS (%s) differs from protocol/seen.md gap-threshold (%s)\n' "$code" "$doc"
  status=1
fi
for stage in planning plan-review implementation verification; do
  if grep -q 'seen\.md' "$repo/protocol/$stage.md"; then
    printf 'PASS protocol/%s.md points at seen.md\n' "$stage"
  else
    printf 'FAIL protocol/%s.md does not point at seen.md\n' "$stage"; status=1
  fi
done
if grep -nE '^\s*(codex exec|claude .*-p)' "$repo/protocol/lanes.md" | grep -v WHEELCHAIR_LANE=1 | grep -q .; then
  printf 'FAIL a lane invocation in protocol/lanes.md lacks WHEELCHAIR_LANE=1\n'; status=1
else
  printf 'PASS every lane invocation in protocol/lanes.md carries WHEELCHAIR_LANE=1\n'
fi
exit $status
