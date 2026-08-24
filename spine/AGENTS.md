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

- **`scan.sh` writes nothing.** No temp files, no caches, no edits to the target. A
  change that needs scratch space is a change that needs a different design. What the
  harness checks is narrower than the rule: it hashes the fixture tree, compares this
  repository's status including ignored paths, and runs each scan with `HOME` and `TMPDIR`
  pointed at empty directories it then asserts are still empty. A write to some other
  absolute path would pass. Proving the rule outright needs syscall tracing, which does not
  belong in a shell harness — so the rule is the contract and those checks are evidence
  for it, not a proof of it.
- **A link path is never emitted as a write target.** Both symlink directions are live on
  this machine, so a write target is always the `realpath` result.
- **A heading list is a summary, not a byte-faithful channel.** It exists to tell a real
  router from a pointer beside it, both ordinary markdown. Two files carrying
  unrepresentable bytes may render alike; such a file is flagged in its directory's notes
  instead. Do not add an encoding meant to make the rendering collision-free — that was
  tried twice and both attempts were claimed collision-free and were not.
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
