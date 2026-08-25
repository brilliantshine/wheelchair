# `skills/` — the Claude Code wrappers

Owned by [the repo root](../AGENTS.md). One directory per command, each holding a single
`SKILL.md`. `install.sh` renders each into `~/.claude/skills/`, substituting this clone's path
for the `{{WHEELCHAIR_ROOT}}` placeholder the committed wrapper carries.

The organizing idea: **a wrapper is a pointer, not a document.** Its body names one
`protocol/` file by absolute path and says what the argument is. Everything else about
the command lives in that file.

The `description` in the frontmatter is the part that is easy to get wrong. It is not
documentation — the harness matches on it to decide whether to offer the command, so it
says when to use the command and what its argument is. The body is the pointer.

| Directory | Points at | Argument |
|---|---|---|
| `plan/` | `protocol/planning.md` | a slug to resume, or a description to start |
| `plan-review/` | `protocol/plan-review.md` | a slug |
| `implement/` | `protocol/implementation.md` | a slug |
| `verify/` | `protocol/verification.md` | a slug |
| `adopt/` | `protocol/adopt.md` | a path to a plan document |
| `spine/` | `protocol/spine.md` | a path to a working tree |
| `graph/` | `protocol/graphs.md` | a question |

## Boundaries

- **Never copy a rule out of `protocol/` into a wrapper.** The Codex prompt for the same
  command points at the same file, so a rule duplicated here gives the two harnesses
  different instructions as soon as one copy is edited.
- **The path in the body is absolute.** A command runs with a foreign repo as its working
  directory, so a relative path resolves nowhere.
- Adding a command means adding a directory here *and* a file in `codex/prompts/`.
  `install.sh` globs both and needs no edit, but a running session must restart before it
  sees the registration.

## Tests

```bash
./install.sh && ./install.sh
```

Idempotent, and the second run leaves `git status --porcelain` empty. What makes an edit in
`protocol/` take effect without reinstalling is that the rendered wrapper points back into this
working tree — not the wrapper's own contents, which are a copy and do need a re-run when changed.
