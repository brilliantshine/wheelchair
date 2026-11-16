# Remediation 1

Verification attempt 1 at `70f4b99`: Claude verifier (claude-opus-5-5) PASS; GPT verifier
(gpt-6.1-sol) FAIL with two gaps. Both are accepted.

## Gaps, verbatim

GAP: Spec §3, selection requires every machine's files to agree — a missing CLI block is ignored, so Settings falsely selects a level — sensitivity/set.sh:124–133; isolated `--json` reproduction returned `level:"ask"` with Claude `"ask"` and Codex `null`; viewer/pages/settings.js:112–113 selected `"ask"`.

GAP: Spec §2, wrapper removal requires an absolute protocol path — relative references also trigger deletion — install.sh:66; executing `remove_retired` against a temporary wrapper containing `Read foo/bar/protocol/planning.md` deleted its directory.

Also folded into R1-1 (the Claude verifier's note, not a gap): `protocol/sensitivity.md:89`
still says the writer runs "after the wrappers".

## Tasks

Both route to GPT, the provider that built the affected code (T2 and T1), at Standard: a
first failure sharpens the brief rather than the model.

### R1-1 — agreed level ignores a missing block

Objective:
1. sensitivity/set.sh, `--report --json` mode (around lines 115-135): the top-level `level` is the shared level only when EVERY present harness's file holds a valid block and all those levels are equal. If any present harness's file has no block (its `files[]` entry is `null`), `level` is null. Absent harnesses (CLI not installed) are not in `files[]` and do not affect it. Do not change the plain `--report` output, the writer, or the `files[]` shape.
2. sensitivity/test/run.sh: add a case: Claude file holds `ask`, Codex present with no block → `--json` gives `"level":null` with files claude "ask", codex null. Keep the existing cases passing; if an existing case asserted the old behaviour, update it and say so in the report.
3. protocol/sensitivity.md:89: "after the wrappers, npm and Chromium" is stale (install.sh renders no wrappers now). Make it "after npm, Chromium and the seen-hook cleanup" or similar, true to install.sh's current order (check install.sh:100-120). Touch nothing else in that file.
No change in viewer/ or machine/ is needed: the machine passes `level` through and Settings already selects nothing when `level` is null.

Ownership boundary: sensitivity/set.sh, sensitivity/test/run.sh, protocol/sensitivity.md (line ~89 only).

Validation (run all, paste output):
  bash sensitivity/test/run.sh
  bash machine/test/run.sh

### R1-2 — wrapper removal must require an absolute path

Objective:
1. install.sh:66: the grep must match only an absolute path: the `/` that starts the path must be at the start of the line or follow whitespace, a backtick, a single or double quote, or `(`. Example ERE: "(^|[[:space:]\`\"'(])/[^[:space:]]*/protocol/${protocol}\.md([^[:alnum:]_.-]|$)" (quote it correctly for bash). `foo/bar/protocol/planning.md`, `x/protocol/planning.md` and `~/w/protocol/planning.md` must NOT match; `/home/a/w/protocol/planning.md`, `` `/opt/w/protocol/planning.md` `` and `"/w/protocol/planning.md"` must match. Real wrappers looked like `Read /home/collin/projects/personal/wheelchair/protocol/planning.md and follow it.` (Claude SKILL.md body line) and a one-line Codex prompt of the same shape.
2. install/test/run.sh: add cases in the existing retired-wrapper section: a same-named wrapper (both harnesses) whose only reference is the relative `foo/bar/protocol/<file>.md` is KEPT; one with a backtick- or quote-wrapped absolute path is removed. Keep all existing cases passing.
Do not change anything else in install.sh or install/unseen.py.

Ownership boundary: install.sh (line ~66 only), install/test/run.sh.

Validation (run all, paste output):
  bash install/test/run.sh
