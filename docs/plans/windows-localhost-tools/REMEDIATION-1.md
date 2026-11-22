# Remediation 1 — windows-localhost-tools

Verification attempt 1 on `f3136ca1` (verifiers: claude-opus-5-5, gpt-6.2-sol). Gap list as reported (duplicates merged):

1. GAP: Routers (AGENTS.md "Maintaining routers"; COMPLETION.md "Routers" claim) — the `viewer/AGENTS.md` row for `pages/project-tools.js` naming the Runs on Windows switch is not in the checked commit; it exists only as an uncommitted change. (claude verifier)
2. GAP: Completion report — `docs/plans/windows-localhost-tools/COMPLETION.md` is not in the checked commit (untracked in the branch worktree). (claude verifier; the gpt verifier noted the same and read it from the worktree)
3. GAP: §4 relay `connect` mode — Rare path: a connection carrying more than about 1 MB both ways at once stalls. (both verifiers)
4. GAP: §6 — Rare path: a valid project with 101 distinct marked URLs gets no results on the initial status check (machine refuses the batch with 400). (gpt verifier)
5. GAP: Check once built #2 — Rare path: when a forward's private port equals its Windows target port and the Windows server is down, the relay dials back into its own listener once before the `wslrelay` refusal. (gpt verifier)

Gaps 3–5 are rare paths, recorded in PLAN.md Accepted Risks (round verification-1); they are not remediated.

## R1-1 (gaps 1 and 2)

- **Cause:** the sub-lead's commits passed several paths to `wc.js git commit --paths` separated by spaces; `--paths` takes one comma-separated value, so only the first path was committed (`305857b1` took `machine/AGENTS.md` only; `f3136ca1` took `PLAN.md` only).
- **Fix:** commit `05f14a7a` adds `docs/plans/windows-localhost-tools/COMPLETION.md` and the `viewer/AGENTS.md` row. No code change.
- **Validation:** `git ls-tree 05f14a7a docs/plans/windows-localhost-tools/` lists `COMPLETION.md`; `git show 05f14a7a:viewer/AGENTS.md` contains "the Runs on Windows switch and its status line"; `git status --short` is empty.
- **Owner:** sub-lead (documentation only; no worker needed).
