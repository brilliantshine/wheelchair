---
slug: router-spine
---

> **Redacted for publication.** Repository and directory names in this document are stand-ins:
> the reference repo appears as `almanac`, and one employer's repositories as `atlas-*`,
> `beacon` and `dev-tooling` under `~/src/work`. Absolute paths were rewritten to `~/src/...`.
> This includes names inside pasted command output and `file:line` citations, so a path here is
> a redaction rather than a result. Every observation, count and verdict is otherwise unchanged.

# How this works today

## End to end

```
agent opens a directory
        ↓
  is there an AGENTS.md / CLAUDE.md?
        ↓ yes                              ↓ no
  read it, know the rules            grep, or read everything,
                                     or ask graphify (7k nodes, gitignored, may be stale)
```

Which branch you get depends entirely on which repo you happen to be in.

## What happens

1. Both harnesses load `AGENTS.md` and `CLAUDE.md` hierarchically. A file in a subdirectory is
   picked up as live instructions when an agent works in that subtree. That is the mechanism the
   whole pattern rides on, and it is also why a fixture router committed anywhere in a repo
   becomes real guidance.
2. almanac is the reference implementation: 20 `AGENTS.md` files, one per source
   package plus `tests/` and `tests/invariants/`, a 133-line root router, and a 3-line
   `CLAUDE.md` that only points at it. Leaf routers run 22–96 lines.
3. A leaf router's shape, from `src/almanac/records/timeline/AGENTS.md`: title
   naming the directory, `Owned by [records/](../AGENTS.md)`, one organizing idea stated
   as a rule, a **Pipeline order** section holding a plain arrow chain, a file-to-role table with
   one line per file, a **Boundaries** section of things that must never happen, and test
   pointers.
4. The root router additionally carries the one concept that explains the layout, a
   directory-to-router table, a navigation order, a graphify policy, verification commands, and
   a section on maintaining the routers.
5. This workflow's four stages produce `MAP.md`, `IDEA.md`, `PLAN.md`, `COMPLETION.md` and
   nothing else. No stage reads or writes a router.

## What matters for this change

**Filenames are not consistent, and two of the variants are symlinks.**
`work/atlas-engine/CLAUDE.md` is a symlink to `AGENTS.md` in the same directory, so the real
file is `AGENTS.md`. `src/work/AGENTS.md` is a symlink to `CLAUDE.md` — the inverse, real
file `CLAUDE.md`. almanac has a real 199-byte `CLAUDE.md` at its root that points to a
real `AGENTS.md`. A command that writes to a hardcoded filename will, in `src/work`,
truncate the real router through the link.

**"Which directories own decisions" is the whole difficulty.** almanac's `tests/` tree
is 33 directories and carries exactly 2 routers. Any rule that reduces to a blocklist of build
output and caches produces about 31 routers there — the router-per-directory outcome the idea
rules out. The distinction that repo actually draws is between a directory with a rule of its
own and a directory that merely groups files.

**Coverage today is partial and uneven.** Counting only the top three levels: atlas-engine
11, almanac 4 (20 at full depth), atlas-infra 3, atlas-api 3,
atlas-data 2, and one each in beacon, atlas-state, dev-tooling,
bravo-pi-mono and bravo-pi-mono-setup. This repo has none.

## Problems found

**This repo is not under git.** `git rev-parse` fails from the root and finds no parent repo.
Nothing here has history or a revert path. This plan is markdown-only so the exposure is small,
but it is the same gap the sibling plan (`editable-node-graphs`) has to close before landing
code.

**The graphify skill's default contradicts the pattern.** Its own instruction is to treat any
codebase question as a graphify query first. almanac overrides that inside its root
router. Every repo that gets a root router needs the same override written into it, because
there is nowhere else it currently lands.

## Not checked

- Whether the routers in the atlas repos follow almanac's internal shape or a
  different one. I counted them and inspected the symlinks; I did not read their contents.
- `protocol/implementation.md`. The upkeep rule attaches to its pre-PR documentation sweep and I
  have read only the README's description of that stage, not the file.
- Whether any repo has routing documents under a third name (`.cursorrules`, `GEMINI.md`,
  `.github/copilot-instructions.md`). graphify's CLI can write several of those, so they may
  exist.
