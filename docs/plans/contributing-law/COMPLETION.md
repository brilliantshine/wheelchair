---
slug: contributing-law
date: 2026-11-24
implemented-by: "T1 standard, gpt / gpt-6.1-terra (Claude held back); T2 light, gpt / gpt-6-luna"
verified-by: []
---

# Completion Report — Follow a project's CONTRIBUTING.md as repo law

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 one source `repo-law.md`: three paths in order, no-op without one, read it yourself, precedence and the three wheelchair-owned areas, boundary edits to the sub-lead, clashes named and not gaps, PR note, steps-only skip, no waivers / base law at merge-base as amended | this run | `protocol/app/repo-law.md:1-25` | `viewer/test/protocol-rules.test.js:65-72` (paths in order; one source) |
| S1 composed into seven roles after `realism.md`, not for `role_prompt` | this run | `machine/service.js:200,209` | `machine/test/service.test.js:926,934-940,952` |
| S1 `protocol/app/AGENTS.md` lists the file and its delivery | this run | `protocol/app/AGENTS.md:3,19` | read |
| S1 seven fallback lines name `repo-law.md` | this run | `protocol/app/{lead,sub-lead,verifier}.md:8/8/9`, `{worker,designer}.md:6`, `{mapper,reviewer}.md:7` | `viewer/test/protocol-rules.test.js:58` |
| S1 Settings "See it in full" preview lists `repo-law.md` after `realism.md`'s place | this run | `viewer/app/settings.js:25,257` | `viewer/test/app-settings.test.js:65,98,110,114,117-127` |
| S2 lead: planning (no break unless the Spec edits the rule; required commands into the Spec) | this run | `protocol/app/lead.md:196` | read |
| S2 lead: small fix follows it; rule change goes to planning unless requested | this run | `protocol/app/lead.md:120` | read |
| S2 lead: verifier briefs outside a planned build add required commands | this run | `protocol/app/lead.md:104` | read |
| S3 reviewer finding | this run | `protocol/app/reviewer.md:41` | read |
| S4 sub-lead and worker: no change beyond delivery | this run | fallback lines only | `git diff` shows only line 8 / line 6 changed |
| S5 verifier check, merge-base range, GAP form, not for steps-only | this run | `protocol/app/verifier.md:124-130` | `viewer/test/protocol-rules.test.js:73-76` (`GAP: repo law `, `merge-base`) |
| S6 realism always-fixed | this run | `protocol/app/realism.md:14-16` | `viewer/test/protocol-rules.test.js:77-80` |
| S7 mapper and designer: no change beyond delivery | this run | fallback lines only | `git diff` shows only the fallback line changed |
| S8 tests | this run | as above; `aside.md` free of CONTRIBUTING.md at `viewer/test/protocol-rules.test.js:81` | suites below |

## Deviations from plan

None in behaviour. Wording choices logged in PLAN.md's Log: `reviewer.md:41` cites "the law file line" (S3 says "the CONTRIBUTING.md line") because the law may be `.github/` or `docs/CONTRIBUTING.md`, matching S5's GAP form.

## Routers

`protocol/app/AGENTS.md`: the delivery sentence (line 3) and a new `repo-law.md` row (line 19) say the machine loads it into all seven roles. `machine/AGENTS.md` and `viewer/AGENTS.md` do not describe which protocol files are composed, so they are unchanged. No existing router was reformatted.

## Validation evidence

Run on the feature branch at the merge of T1 and T2 (`78929b1b`), on a machine shared with other threads' test runs:

```
protocol exit 0      node --test viewer/test/protocol-rules.test.js
sensitivity exit 0   bash sensitivity/test/run.sh
codex exit 0         bash codex/test/run.sh
install exit 0       bash install/test/run.sh
machine exit 1       bash machine/test/run.sh        # pass 716, fail 19
sudo exit 0          python3 -m unittest discover -s sudo-helper/test
sudoinst exit 0      bash sudo-helper/test/install-test.sh
viewer exit 1        node --test viewer/test/*.test.js   # pass 958, fail 2
browser exit 0       npm --prefix viewer run test:browser  # 1498 passed, 34 skipped (23.8m)
```

Machine failures: 18 are the Windows copy / readying / archive tests (e.g. "existing copy remains waiting until a post-start reconcile completes", "restart recovery tracks a live lead and reconciles on stop"; `wslpath ENOENT` on this Linux host). The same 18 names fail on the feature branch at `c3eb0862` (before T1 and T2): `comm -23` of the two sorted failure lists is empty except the 19th. The 19th, "stand-in hands held calls to tool, caches paginated list and sets environment" (`machine/test/win-tool-proxy.test.js`), hung at 0% CPU for 47 minutes under load and I killed it; run alone it passes: `# pass 27 # fail 0`. `machine/test/service.test.js` alone: `# pass 132 # fail 0`.

Viewer failures: "switching a harness off cancels its install on every known machine, without waiting" (`viewer/test/app-harnesses.test.js:298`, a `< 1000 ms` timing assertion) failed, then failed and passed on two single re-runs; "6 message clears debt" (`viewer/test/app-quiet.test.js:41`) passed on re-run. Neither touches code this change edits (`git diff c3eb0862..78929b1b --stat` lists only `protocol/app/`, `machine/service.js`, `viewer/app/settings.js` and the three test files).

Manual check (Spec Validation): composing the verifier prompt with this worktree's `composeRolePrompt` prints section headers `--- realism.md ---` then `--- repo-law.md ---`; the new GAP line (`protocol/app/verifier.md:130`) starts `GAP: `, the prefix the sub-lead's GAP merge (`protocol/app/sub-lead.md:254`) reads.

## Known gaps / residual risks

- The 18 Windows-copy machine tests fail on this Linux host independent of this change; they were not re-checked on a host with `wslpath`.
- Two timing-sensitive viewer tests are flaky under heavy machine load.
- `ROLE_REPO_LAW` is duplicated in `machine/service.js:200` and `viewer/app/settings.js:25`, as `ROLE_REALISM` already is; the two tests pin each list.

## Remediation rounds
