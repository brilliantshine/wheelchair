# Sourced, never run. Refuses an install-time write from anywhere but the canonical clone.
#
# Every writer that install.sh calls renders this checkout's absolute path into machine-wide state
# (harness instruction files, skills, prompts, hook entries, systemd units). Run from a worktree, it
# re-points the whole machine at code that is about to be deleted. A checkout counts as a worktree
# when git says it is a linked worktree, or when it sits under the app's worktree directory.
#
# WHEELCHAIR_ALLOW_WORKTREE=1 forces it. The fixture suites set it, because they run from whatever
# checkout holds them and write only temporary homes.
#
# guard_canonical_clone <root> <who>   # exits 3 with the reason when <root> is not the clone
guard_canonical_clone() {
  local root=$1 who=$2 why='' git_dir common_dir worktrees
  [[ ${WHEELCHAIR_ALLOW_WORKTREE:-} == 1 ]] && return 0
  if git_dir=$(git -C "$root" rev-parse --path-format=absolute --git-dir 2>/dev/null) &&
     common_dir=$(git -C "$root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) &&
     [[ $git_dir != "$common_dir" ]]; then
    why="it is a linked git worktree of $(dirname "$common_dir")"
  fi
  worktrees="$HOME/.local/state/wheelchair/worktrees"
  if [[ -z $why ]]; then
    case "$root/" in "$worktrees"/*) why="it is under $worktrees" ;; esac
  fi
  [[ -z $why ]] && return 0
  printf '%s: refusing to run from %s: %s.\n' "$who" "$root" "$why" >&2
  printf '%s: this writes machine-wide paths; run it from the canonical clone, or set WHEELCHAIR_ALLOW_WORKTREE=1 to force it. To test the installer, run install/test/run.sh.\n' "$who" >&2
  exit 3
}
