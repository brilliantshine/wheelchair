#!/usr/bin/env bash
# Fixture output stays in shell variables.  JSON is validated with python3's
# json.tool when available; the small fallback checks the outer JSON structure.
set -euo pipefail

scan="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scan.sh"
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT

passes=0
failures=0
have_python=0
command -v python3 >/dev/null 2>&1 && have_python=1
declare -A report status before_hash after_hash

pass() { printf 'PASS %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
assert() {
  local description=$1
  shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}

tree_hash() {
  local root=$1 item rel
  while IFS= read -r -d '' item; do
    rel=${item#"$root"}
    if [[ -L $item ]]; then
      printf 'L\0%s\0%s\0' "$rel" "$(readlink "$item")"
    elif [[ -f $item ]]; then
      printf 'F\0%s\0' "$rel"
      sha256sum "$item" | awk '{print $1}'
    elif [[ -d $item ]]; then
      printf 'D\0%s\0' "$rel"
    else
      printf 'O\0%s\0' "$rel"
    fi
  done < <(find "$root" -print0 | sort -z) | sha256sum | awk '{print $1}'
}

make_repo() {
  local name=$1 root
  root=$fixture/$name
  mkdir -p "$root"
  git -C "$root" init -q
  printf '__pycache__/\nnode_modules/\ndata/\n' > "$root/.gitignore"
  printf '%s' "$root"
}

run_case() {
  local name=$1 root=$2 output code
  before_hash[$name]=$(tree_hash "$root")
  set +e
  output=$("$scan" "$root")
  code=$?
  set -e
  after_hash[$name]=$(tree_hash "$root")
  report[$name]=$output
  status[$name]=$code
  if [[ ${before_hash[$name]} == "${after_hash[$name]}" ]]; then
    pass "$name fixture tree unchanged by scan"
  else
    fail "$name fixture tree unchanged by scan"
  fi
}

json_assert() {
  local description=$1 name=$2 program=$3
  if (( have_python )); then
    if printf '%s' "${report[$name]}" | python3 -c "$program"; then
      pass "$description"
    else
      fail "$description"
    fi
  else
    # python3 is absent: this is intentionally only a structural JSON check.
    if [[ ${report[$name]} == \{*\} && ${report[$name]} == *'"target"'* && ${report[$name]} == *'"directories"'* ]]; then
      pass "$description (structural fallback)"
    else
      fail "$description (structural fallback)"
    fi
  fi
}

valid_json() {
  local name=$1
  if (( have_python )); then
    if printf '%s' "${report[$name]}" | python3 -m json.tool >/dev/null; then
      pass "$name stdout is valid JSON"
    else
      fail "$name stdout is valid JSON"
    fi
  else
    assert "$name stdout has JSON outer structure" bash -c '[[ $1 == \{*\} ]]' _ "${report[$name]}"
  fi
}

# 1. A deliberately non-git workspace.  The enclosing mktemp directory is not
# initialized, so rev-parse cannot accidentally find a parent repository.
workspace=$fixture/workspace
mkdir -p "$workspace"
for child in beacon atlas-state; do
  mkdir -p "$workspace/$child"
  git -C "$workspace/$child" init -q
done
for hub in atlas-engine atlas-data; do
  mkdir -p "$workspace/$hub/.repo.git" "$workspace/$hub/development" "$workspace/$hub/main"
done

# 2. Differing real files: their first three non-blank lines are identical.
differing=$(make_repo differing)
printf '# Shared title\n## Shared section\nA shared line\n\n### AGENTS "detail"\nagent body\n' > "$differing/AGENTS.md"
printf '# Shared title\n## Shared section\nA shared line\n\n### CLAUDE detail\nclaude body\n' > "$differing/CLAUDE.md"

# 3. Two byte-identical real files.
identical=$(make_repo identical)
printf '# Same\n## Layout\nbody\n' > "$identical/AGENTS.md"
cp "$identical/AGENTS.md" "$identical/CLAUDE.md"

# 4. The scanner reports the short real pointer without attempting to classify it.
pointer=$(make_repo pointer)
printf '# Router\n## Details\nreal router\n' > "$pointer/AGENTS.md"
printf '# CLAUDE\n\nSee AGENTS.md\n' > "$pointer/CLAUDE.md"

# 5. Reachable unmanaged surfaces, including a directory name with a space.
unmanaged=$(make_repo unmanaged)
mkdir -p "$unmanaged/space dir"
printf '# Router\n' > "$unmanaged/space dir/AGENTS.md"
printf 'unmanaged\n' > "$unmanaged/space dir/GEMINI.md"
printf 'unmanaged\n' > "$unmanaged/.cursorrules"

# 6. A nested checkout must be reported once and not walked.
nested=$(make_repo nested)
mkdir -p "$nested/vendor/upstream"
git -C "$nested/vendor/upstream" init -q
printf '# Inner\n' > "$nested/vendor/upstream/AGENTS.md"

# 7 and 8. Both live symlink directions.
claude_link=$(make_repo claude-link)
printf '# Agents\n## Layout\n' > "$claude_link/AGENTS.md"
ln -s AGENTS.md "$claude_link/CLAUDE.md"
claude_link_before=$(realpath "$claude_link/CLAUDE.md")
agents_link=$(make_repo agents-link)
printf '# Claude\n## Layout\n' > "$agents_link/CLAUDE.md"
ln -s CLAUDE.md "$agents_link/AGENTS.md"
agents_link_before=$(realpath "$agents_link/AGENTS.md")

# 9. Broken candidate link.
broken=$(make_repo broken)
mkdir -p "$broken/docs"
ln -s missing-router.md "$broken/docs/CLAUDE.md"

# 10. A grouping directory contributes a normal empty directory report.
grouping=$(make_repo grouping)
mkdir -p "$grouping/group only"
printf 'ordinary file\n' > "$grouping/group only/item.txt"

# 11 and 12. All are ignored by the fixture .gitignore.
ignored=$(make_repo ignored)
mkdir -p "$ignored/__pycache__" "$ignored/node_modules" "$ignored/data"
printf '# Hidden\n' > "$ignored/__pycache__/AGENTS.md"
printf '# Hidden\n' > "$ignored/node_modules/CLAUDE.md"
printf '# Hidden\n' > "$ignored/data/AGENTS.md"

# 13. Headings carrying every character JSON has to escape.  A trailing
# backslash is the sharp case: emitted raw it escapes the closing quote and the
# whole document stops parsing while the scanner still exits 0.
escaping=$(make_repo escaping)
printf '# trailing backslash \\\n## quote "q" and back\\slash\n### tab\there\n' > "$escaping/AGENTS.md"

umbrella_before=$(tree_hash "$fixture")

run_case workspace "$workspace"
run_case differing "$differing"
run_case identical "$identical"
run_case pointer "$pointer"
run_case unmanaged "$unmanaged"
run_case nested "$nested"
run_case claude-link "$claude_link"
run_case agents-link "$agents_link"
run_case broken "$broken"
run_case grouping "$grouping"
run_case ignored "$ignored"
run_case escaping "$escaping"

assert 'workspace refusal exits non-zero' bash -c '(( $1 != 0 ))' _ "${status[workspace]}"
json_assert 'workspace names child repositories, hubs, and hub lanes' workspace '
import json, sys
d=json.load(sys.stdin); assert not d["ok"] and d["gitToplevel"] is None
assert set(d["refusal"]["repositories"]) == {"beacon", "atlas-state"}
h={x["path"]: x["lanes"] for x in d["refusal"]["hubs"]}
assert h == {"atlas-engine": ["development", "main"], "atlas-data": ["development", "main"]}
'

assert 'differing routers scan exits zero' bash -c '(( $1 == 0 ))' _ "${status[differing]}"
json_assert 'differing routers both have size, heading lists, and a positive diff count' differing '
import json, sys
d=json.load(sys.stdin); root=d["directories"][0]; c={x["name"]:x for x in root["candidates"]}
assert set(c)=={"AGENTS.md","CLAUDE.md"} and root["realCount"]==2 and root["diffLines"]>0
assert all(isinstance(x["size"],int) and x["headings"] for x in c.values())
assert c["AGENTS.md"]["headings"] != c["CLAUDE.md"]["headings"]
'
json_assert 'differing routers are not reduced to indistinguishable opening lines' differing '
import json, sys
c={x["name"]:x for x in json.load(sys.stdin)["directories"][0]["candidates"]}
assert any("AGENTS " + chr(34) + "detail" + chr(34) in h for h in c["AGENTS.md"]["headings"])
assert any("CLAUDE detail" in h for h in c["CLAUDE.md"]["headings"])
'
json_assert 'pointer case reports both real files without aborting' pointer '
import json, sys
d=json.load(sys.stdin); assert d["ok"] and len(d["directories"][0]["candidates"])==2
'
json_assert 'all write targets refer to real files, never symlink paths' claude-link '
import json, os, sys
d=json.load(sys.stdin)
for directory in d["directories"]:
    wt=directory["writeTarget"]
    if wt is not None: assert not os.path.islink(os.path.join(d["target"], wt))
'
json_assert 'nested repository is excluded and has no candidate report' nested '
import json, sys
d=json.load(sys.stdin); assert {x["path"] for x in d["excluded"] if x["reason"]=="nested repository"}=={"vendor/upstream"}
assert all(x["path"] != "vendor/upstream" for x in d["directories"])
assert all("Inner" not in str(x) for x in d["directories"])
'
json_assert 'every non-broken candidate has size and headings; broken has null and empty list' broken '
import json, sys
for directory in json.load(sys.stdin)["directories"]:
  for c in directory["candidates"]:
    if c["broken"]: assert c["size"] is None and c["headings"]==[]
    else: assert isinstance(c["size"],int) and isinstance(c["headings"],list)
'
json_assert 'CLAUDE link resolves to real AGENTS write target' claude-link '
import json, sys
d=json.load(sys.stdin); r=d["directories"][0]; assert r["writeTarget"]=="AGENTS.md" and r["candidates"][1]["isSymlink"]
'
assert 'CLAUDE symlink remains a link and resolves unchanged' bash -c 'test -L "$1" && [[ $(realpath "$1") == "$2" ]]' _ "$claude_link/CLAUDE.md" "$claude_link_before"
json_assert 'AGENTS link resolves to real CLAUDE write target' agents-link '
import json, sys
d=json.load(sys.stdin); r=d["directories"][0]; assert r["writeTarget"]=="CLAUDE.md" and r["candidates"][0]["isSymlink"]
'
assert 'AGENTS symlink remains a link and resolves unchanged' bash -c 'test -L "$1" && [[ $(realpath "$1") == "$2" ]]' _ "$agents_link/AGENTS.md" "$agents_link_before"
json_assert 'unmanaged surfaces are reported and never write targets' unmanaged '
import json, sys
d=json.load(sys.stdin); by={x["path"]:x for x in d["directories"]}
assert ".cursorrules" in by["."]["unmanagedSurfaces"] and "GEMINI.md" in by["space dir"]["unmanagedSurfaces"]
assert all(x["writeTarget"] not in {"GEMINI.md", ".cursorrules"} for x in d["directories"])
'
json_assert 'byte-identical pair has no write target and carries consolidation note' identical '
import json, sys
r=json.load(sys.stdin)["directories"][0]
assert r["realCount"]==2 and r["identical"] and r["diffLines"]==0 and r["writeTarget"] is None
assert "two byte-identical routing files — duplicate, consolidate" in r["notes"]
'
json_assert 'ignored cache, modules, and data directories are excluded once as git-ignored' ignored '
import json, sys
d=json.load(sys.stdin); got={(x["path"],x["reason"]) for x in d["excluded"]}
assert {("__pycache__","git-ignored"),("node_modules","git-ignored"),("data","git-ignored")} <= got
'
json_assert 'broken link is reported and its directory is skipped' broken '
import json, sys
d=json.load(sys.stdin); r=next(x for x in d["directories"] if x["path"]=="docs"); c=r["candidates"][0]
assert c["name"]=="CLAUDE.md" and c["broken"] and r["skipped"] and r["writeTarget"] is None
'
json_assert 'group-only directory is reported with no candidates and no inferred rule' grouping '
import json, sys
r=next(x for x in json.load(sys.stdin)["directories"] if x["path"]=="group only")
assert r["candidates"]==[] and r["realCount"]==0 and r["writeTarget"] is None
'

for name in workspace differing identical pointer unmanaged nested claude-link agents-link broken grouping ignored escaping; do
  valid_json "$name"
done

json_assert 'a backslash, a quote and a tab in a heading survive as valid JSON' escaping '
import json, sys
h=json.load(sys.stdin)["directories"][0]["candidates"][0]["headings"]
assert h == ["# trailing backslash \\", "## quote \"q\" and back\\slash", "### tab\there"], h
'

# Per-case hashes cover each scanned root.  This covers the whole fixture
# umbrella across every scan, so a write landing beside a case root -- or at the
# top of the fixture tree -- is caught too.
umbrella_after=$(tree_hash "$fixture")
assert 'nothing anywhere in the fixture tree changed across every scan' \
  bash -c '[[ $1 == "$2" ]]' _ "$umbrella_before" "$umbrella_after"

printf 'RESULT %d passed, %d failed\n' "$passes" "$failures"
(( failures == 0 ))
