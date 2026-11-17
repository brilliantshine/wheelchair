---
slug: lean-sessions
date: 2026-11-17
implemented-by: "standard gpt-6.1-terra (T1, T2, T4, T5); light gpt-6-luna (T3, T5b); sub-lead claude-opus-5-5 post-merge fixes"
verified-by: []
---

# Completion Report — Make wheelchair sessions leaner

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
numbers are at commit `9847739` on `wc/9b670482ba5c` unless stated.

## Spec coverage

Every item is `this run` (Prior Work was empty).

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Claude deny list in one constant beside `command()`, every role, all listed names | this run | `machine/adapters/claude.js:45`, used at `:63` | `machine/test/service.test.js:802` (asserts `--disallowedTools` equals the joined list) |
| No `--strict-mcp-config` / `--disable-slash-commands` on session argv; asides and usage probe keep their argv | this run | `machine/adapters/claude.js:63` (session argv); `asideArgv`/`usageProbe` unchanged (`:48-49`) | `service.test.js:802` (flags absent); `machine/test/aside-turns.test.js:29-31` unchanged and passing |
| Startup size: nothing captured at runtime | this run | no capture code added (diff of T1: only ledger append at `machine/service.js:550`) | read of T1 diff |
| `Role: <role>` first line, header (card / role-only variants) naming `<root>`, role file, `--- <file> ---` card files, then layers; `role_prompt` gets the Role line too | this run | `machine/service.js:125-137` | `service.test.js:802` (all six roles, header text, files, layers last, `Role: lead\ncustom prompt`) |
| Card files per role: lead cards+cards-lead; sub-lead/worker/mapper cards; reviewer/verifier none | this run | `machine/service.js:125`; preview `viewer/app/settings.js:13` | `service.test.js:802`; `viewer/test/app-settings.test.js:46` |
| Role files and `cards.md` say `<root>` is named in the starting instructions | this run | `protocol/app/lead.md:6`, `sub-lead.md:7`, `cards.md:3`, likewise worker, mapper, reviewer, verifier | `viewer/test/protocol-rules.test.js:54` |
| Briefs stop telling sessions to read their role file | this run | `protocol/app/lead.md:80`, `sub-lead.md:52-54`, `sub-lead.md:223` | `protocol-rules.test.js:49` (no obsolete read pointer); grep: no `worker.md`/`verifier.md` brief item in `sub-lead.md` |
| Fallback line (lead/sub-lead/worker/mapper with card files; reviewer/verifier `<root>` only) | this run | `protocol/app/lead.md:8`, `worker.md:6`, `mapper.md:7`, `sub-lead.md:9`; `reviewer.md:7`, `verifier.md:9` | `protocol-rules.test.js:54` |
| Settings preview: Role line, header, one line per file, layers, fixed provider caption | this run | `viewer/app/settings.js:175-182`; caption `viewer/pages/settings.js:554` | `app-settings.test.js:46`; `app-settings.spec.js:189-195` |
| Asides keep their pointer | this run (untouched) | `machine/lib/aside-turns.js:98` | `aside-turns.test.js:29` |
| Files read at start from the machine's clone | this run | `machine/service.js:131` (`ROOT`) | `service.test.js:802` |
| Role files lose "Read `cards.md` beside this file first"; lead-only cross-refs point at `cards-lead.md` | this run | e.g. `protocol/app/lead.md:35,361,416` | `protocol-rules.test.js:49` |
| Codex and Antigravity: prompt file written before the worktree, first message `[wc:role] Role: <role>` + pointer + brief | this run | `machine/adapters/codex.js:51`, `machine/adapters/agy.js:34`, `machine/service.js:520-523` | `service.test.js:830` (100 KB brief: overhead < 1 KB) |
| Claude: `--append-system-prompt-file <stateDir>/prompts/<name>.md`, written before `git worktree add`; files kept | this run | `machine/service.js:520-523`; `claude.js:63` | `service.test.js:802` (lead prompt > 30 KB, command < 8 KiB), `:841` |
| `machine/API.md` updated | this run | `machine/API.md:10` | read |
| 12,000-char cap stays on layers only | this run (unchanged) | `viewer/app/settings.js` `assertFits` unchanged | `app-settings.test.js` passing |
| `cards.md` keeps posting, kinds table, progress, message, result, markers, commands | this run | `protocol/app/cards.md` (195 lines) | `protocol-rules.test.js:38` |
| `cards-lead.md` holds the other 14 kinds verbatim | this run | `protocol/app/cards-lead.md` (267 lines) | `protocol-rules.test.js:38`; T4 scout diffed each section: verbatim |
| Card split documentation only; `card.js` unchanged; one section per schema kind | this run | `viewer/app/card.js` not in the diff | `protocol-rules.test.js:38` (kinds from `card.js` `fields`) |
| `protocol/app/AGENTS.md` names both files and who gets each; reviewer/verifier neither | this run | `protocol/app/AGENTS.md:3,6` and table | read |
| `wc.js diff size`: repo root, filtered numstat, `-z` name-status with forced renames, exact `docs/plans`, structured excluded paths, bands, `--tricky` wins, binary 0, quoted `scout_diff` | this run | `viewer/app/wc.js:103-131` | `viewer/test/wc-cli.test.js:20,26,32,42,47` |
| `sub-lead.md` step 1: run the command, pass `--tricky`, band binding, no-scout exception, scout inputs, excluded paths read with `--literal-pathspecs`, Log line names the band | this run | `protocol/app/sub-lead.md:150-151`, Log format `:166` | `protocol-rules.test.js:63` |
| `session start` compact (keeps `branch`, `worktree`, note, waiting line; no `command`); `--full` raw | this run | `viewer/app/wc.js:99,154-183` | `wc-cli.test.js:51`; `viewer/test/app-machines.test.js:164` |
| `session list` compact fields plus `review_families`; `--full` raw | this run | `viewer/app/wc.js:98-101,181` | `wc-cli.test.js:51` |
| worker.md / verifier.md test-output rule | this run | `protocol/app/worker.md:21`, `verifier.md:29` | `protocol-rules.test.js:70` |
| Chaining line in lead, sub-lead, worker, verifier, mapper | this run | e.g. `protocol/app/mapper.md:9`, `lead.md:10` | grep |
| CONTRIBUTING: cards-lead.md; edits reach only later sessions | this run | `CONTRIBUTING.md:42-43,67` | read |
| Root AGENTS.md < 6,000 bytes, every rule kept, reasons moved with a pointer | this run | `AGENTS.md` (5,683 bytes); `CONTRIBUTING.md:100` ("Why the agent rules…"); pointer at the end of `AGENTS.md` | `wc -c`; T5 and T5b scouts' rule-by-rule comparison |
| Session ledger: one line per start `{at,name,role,provider,model,account_dir,cli_session_id,thread_id}`, append-only, best-effort | this run | `machine/service.js:549-551` | `service.test.js:802` (7 lines, key order, `account_dir`; ledger path made a directory → start still succeeds) |
| Boundaries: nothing Collin sees changes; no warning, Ready or approval change | this run | no change under `viewer/app/ready.js`, cards UI or approval code | diff file list |
| Edge: missing role/card file or failed prompt write fails the start, leaves no branch or worktree, retry works | this run | `machine/service.js:520-523` | `service.test.js:841` |
| Edge: all paths under `docs/plans/` → 0, `scout`; `--tricky` → `self` | this run | `viewer/app/wc.js:130` | `wc-cli.test.js:32` |
| Measured baseline, re-measure method | n/a (plan record) | `docs/plans/lean-sessions/PLAN.md` | post-merge re-measure |

## Deviations from plan

- The Spec's machine validation line lists "`wc.js diff size` lists both rename ends with
  `diff.renames=false`". It is tested in `viewer/test/wc-cli.test.js:42` beside the command,
  not in `machine/test/`.
- Codex/Antigravity pointer sentence says "your role rules and card rules" for reviewer and
  verifier too (no card files). The Spec gives one sentence; the brief kept it unchanged.
- `diff size` git calls get a 256 MiB `maxBuffer` (not in the Spec; avoids a large diff
  failing on Node's 1 MiB default).
- The "Live" validation lines (start a Claude lead and worker in real tmux and read
  `startup_tokens`) and the re-measure need the canonical clone after merge and an install;
  they were not run here.

## Routers

- `protocol/app/AGENTS.md`: lists `cards.md` and `cards-lead.md` with who gets each, says
  the machine puts role and card files into starting instructions (Claude) or a composed file
  read once (GPT, Antigravity), asides keep their pointer.
- Root `AGENTS.md`: shortened under 6,000 bytes; reasons moved to `CONTRIBUTING.md`.
- `machine/API.md`: start contract describes the prompt file, Claude flags, the pointer
  message and the ledger. `machine/AGENTS.md` unchanged (no line named the old pointer).
- `viewer/app/API.md`: compact `session` output, `--full`, and `wc.js diff size`.

## Validation evidence

On the merged feature branch (`9847739`), each run as `<cmd> > log 2>&1; echo exit`:

```text
sensitivity exit 0
codex exit 0
install exit 0          RESULT 187 passed, 0 failed
machine exit 0          # pass 133 # fail 0
sudo exit 0             Ran 9 tests ... OK
sudoinst exit 0
testsupport exit 0      # pass 9 # fail 0
viewer exit 0           # pass 528 # fail 0
browser exit 0          696 passed (3.0m), 28 skipped
```

Smoke (`bash test-support/smoke/run.sh`, free, on hearth):

```text
smoke exit 1
FAIL readiness through hub: Timed out waiting for condition
PASS start
PASS stop
PASS clean: run folder absent after 5s ...
```

The same command on an untouched copy of `main` (`git archive main`) gives the identical
`FAIL readiness through hub` and exit 1, so it predates this change.

Claude CLI flag check: `claude -p hi --append-system-prompt-file /nonexistent/x.md
--disallowedTools Artifact,Workflow` → `Error: Append system prompt file not found:
/nonexistent/x.md` (flag recognised); `claude --help` lists `--disallowedTools,
--disallowed-tools <tools...>`.

`node viewer/app/wc.js diff size main HEAD` (repository root) returns one JSON line with
`band: "self"` and the plan documents in `excluded_paths`.

## Known gaps / residual risks

- Smoke "readiness through hub" fails on this machine, before and after this change.
- `wc-cli.test.js`: the "`--full` is not sent" assertion is vacuous (the request body never
  copies flags); no tests for a non-repository, a missing branch, or `'` in the top path.
- Live startup numbers (lead under 32k, worker under 25k) are unmeasured until after merge
  and install.
- A Claude Code release that renames a denied tool silently drops that entry (Spec edge case).
- Sessions running at merge keep their old pointer instructions; the role files' fallback
  line covers them.
- Known flaky tests not seen this run: `lifecycle.test.js` freed-port test; clock-dependent
  `app-accounts.spec.js` "lead waiting line".

## Remediation rounds
