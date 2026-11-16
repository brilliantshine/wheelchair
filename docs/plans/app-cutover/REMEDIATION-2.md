# Remediation 2

Verification attempt 2 at `9a60588`: Claude verifier (claude-opus-5-5) PASS; GPT verifier
(gpt-6.1-sol) FAIL with one gap. It is accepted. It is a new case in the same check as
Remediation 1's second gap (the old pattern had the same blind spot), not that gap
surviving its fix.

## Gaps, verbatim

GAP: Spec §2 retired-wrapper removal — wrappers rendered from absolute checkout paths containing spaces survive — install.sh:66 excludes whitespace within paths. Executing the exact cleanup function against temporary fixtures left `Read /old wheelchair/protocol/planning.md` intact while removing the equivalent `/old-wheelchair/` wrapper.

Also fixed (the Claude verifier's note, not a gap): `viewer/test/app-diagram-sensitivity.test.js:42-47`
starts the hub outside its `try`, so a failed start leaves the fake machines running and the
node suite hangs.

## Tasks

### R2-1 — match the rendered wrapper line, spaces allowed (GPT, standard; GPT built install.sh)

Background: every wrapper wheelchair ever rendered has exactly one of these line shapes (from git history, e.g. `git show 25f3a11:skills/plan/SKILL.md` and `git show 25f3a11:codex/prompts/plan.md`):
  Claude SKILL.md body:  Read `<root>/protocol/planning.md` and
  Codex prompt:          Read <root>/protocol/planning.md and follow it exactly for: $ARGUMENTS
where <root> is an absolute path that may contain spaces. Plan decision D4: a wrapper is removed when its text is "the shape wheelchair renders".

Objective:
1. install.sh:66: replace the grep pattern with one that matches the rendered line shape instead of a free-floating path: the line starts with `Read `, then an optional backtick, then `/`, then any characters (spaces allowed), then `/protocol/<file>.md`, then a backtick, whitespace or end of line. ERE: "^Read \`?/.*/protocol/${protocol}\.md(\`|[[:space:]]|$)" (quote it correctly for bash; test it). Nothing else in install.sh changes.
2. install/test/run.sh, the retired-wrapper loop (~lines 257-283): add origins `spaced` (`Read /old wheelchair/protocol/<file>.md and follow it exactly for: $ARGUMENTS`) and `spaced_quoted` (``Read `/old wheelchair/protocol/<file>.md` and``), both removed for both harnesses. Make `current` use the real Codex shape (`Read $repo/protocol/<file>.md and follow it exactly for: $ARGUMENTS`) and `quoted` the real Claude shape (``Read `/opt/w/protocol/<file>.md` and``). Keep `other`, `relative`, `short_relative`, `tilde`, `foreign`, `different` with their current expectations. Also add a kept case `mid_line`: `See /elsewhere/protocol/<file>.md for details` (not wheelchair's shape, kept).
3. Update the Remediation note in nothing else; I record it.

Ownership boundary: install.sh (line ~66 only), install/test/run.sh.

Validation (run all, paste output):
  bash install/test/run.sh

### R2-2 — the diagram-sensitivity test cleans up after a failed hub start (Claude, light; Claude built the test)

Objective: in viewer/test/app-diagram-sensitivity.test.js `withHub`, make sure every fake machine is stopped and the state is cleaned up even when startServer throws: start the fakes, then `let server; try { server = await startServer(...); await work(...); } finally { if (server) await server.stop(); for (const fake of Object.values(fakes)) await fake.stop(); }`. Change nothing else. Do not touch other test files.

Ownership boundary: viewer/test/app-diagram-sensitivity.test.js only.

Validation (run, paste output; the worktree has no viewer/node_modules — if a test needs it, create an untracked symlink to /home/collin/projects/personal/wheelchair/viewer/node_modules and say so):
  node --test viewer/test/app-diagram-sensitivity.test.js
  node --test viewer/test/*.test.js
