# `spine/` — the scanner behind `/spine`

Owned by [the repo root](../AGENTS.md). One script and its fixture harness.
`protocol/spine.md` is the command that calls it; `protocol/routers.md` is the format it
serves.

The organizing idea: **`scan.sh` resolves and reports; it never decides and never
writes.** Writing through a symlink and truncating a real router is the only irreversible
mistake `/spine` can make, so that one operation is code with assertions behind it and
everything else is left to the prompt and the person confirming its proposal.

## What a run does

```
path in → refuse if outside a git repo → walk, skipping ignored, dotted and nested-repo
        dirs → resolve each AGENTS.md/CLAUDE.md through its symlinks → JSON to stdout
```

| File | Role |
|---|---|
| `scan.sh` | The scanner. One path argument; JSON on stdout, exit 1 on refusal, exit 2 on misuse. Writes nothing |
| `test/run.sh` | The assertions. Builds a fresh fixture tree under the system temp directory and gates on exit code |

`test/` holds that harness and nothing else.

## Boundaries

- **`scan.sh` writes nothing, anywhere.** No temp files, no caches, no edits to the
  target. The harness proves it by hashing the whole fixture tree before and after every
  scan, so a change that needs scratch space is a change that needs a different design.
- **A link path is never emitted as a write target.** Both symlink directions are live on
  this machine, so a write target is always the `realpath` result.
- **The script classifies structure, never content.** Which of two real routing files is
  the router, and what filename a new router takes, are judgements for the prompt.
  Encoding either was tried twice and both attempts refused to run on the reference repo.
- **No fixture is ever written inside this repo.** Both harnesses load `AGENTS.md` and
  `CLAUDE.md` hierarchically, so a committed fixture router becomes live guidance for any
  agent working in that subtree.

## Tests

```bash
bash spine/test/run.sh
```

One scan per case, each case its own target root — a rule scoped to the target root
cannot be asserted on a directory that is merely a child of a shared fixture tree.
