---
slug: install-real-home-check
date: 2026-11-26
implemented-by: "standard, gpt-6.1-terra (T1); sub-lead: claude-opus-5-5"
verified-by:
  - round: 1
    lane: verifier, claude-opus-5-5
    checks: standard, gpt-6.1-terra
---

# Completion Report — Install tests: only check wheelchair's own files in the real folder

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 real-folder list (`models`, `.lock`) with the explanatory comment | this run | `install/test/run.sh:53-58` | Read; S4 self-check uses the same list |
| S2 `real_wheelchair_state <dir>`, one `<path> <file_state>` line per listed path, via `file_state` | this run | `install/test/run.sh:59-64` (`file_state` unchanged at `:49-51`) | S4 asserts at `:265`, `:268` |
| S3 before-copy replaced (still before first case) | this run | `install/test/run.sh:269` | `bash install/test/run.sh` |
| S3 old whole-tree assert removed | this run | formerly run.sh:705; gone | `grep -n 'real wheelchair directory is byte-identical' install/test/run.sh` prints nothing |
| S3 after-check after last case, right before `RESULT`; pass message per Spec; fail names each changed path | this run | `install/test/run.sh:841-847` (RESULT at `:849`), message built by `real_wheelchair_mismatch` `:65-73` | `PASS real wheelchair files the installer writes are byte-identical after suite` on this machine with the real HOME |
| S3 five harness-file checks unchanged | this run (untouched) | `install/test/run.sh:741-745` | diff shows no change to those lines |
| S3 `tree_state` keeps behaviour; unused skip argument removed (no caller passes it) | this run | `install/test/run.sh:27-48` | refusal (`:286-307`) and idempotence asserts still pass |
| S4 self-check: (a)+(b) together reported, message names `models` and `.lock`; (c) on a fresh dir leaves state equal; same mismatch code as S3 | this run | `install/test/run.sh:256-268` | PASS lines `real wheelchair mismatch names both changed files`, `real wheelchair state ignores unlisted files`; negative checks in `reports/T1.md` |
| S5 `run_case` drops `WHEELCHAIR_MODELS` / `WHEELCHAIR_MODELS_CACHE`, both command forms | this run | `install/test/run.sh:204`; detect_path form keeps the flags via `"${command[@]:1}"` (`:223-228`) | S5 asserts below |
| S5 test: ordinary case (`codex_only`) and detect_path case (`kimi_on_path`), overrides exported only around that `run_case`, leak paths absent, case's own `models` present | this run | `install/test/run.sh:318-321`, `:391-394` (`model_overrides_ignored` `:82`) | PASS `codex_only ignores model path overrides`, `kimi_on_path ignores model path overrides`; removing the `-u` flags makes both FAIL (`reports/T1.md`) |

## Deviations from plan

None. Small choices not set by the Spec are in PLAN.md Log (shared predicate `model_overrides_ignored`; unanchored `grep -F "<path> "` in the mismatch helper, correct for the two current names; `, ` separator).

## Routers

None — this change moved no ownership and no router named a file it touched in a way that became false.

## Validation evidence

Re-run by the sub-lead on the worker commit `e2f807d6`, real HOME, live hub, machine service and AI sessions running on this machine:

```text
$ bash install/test/run.sh   # exit 0
PASS real wheelchair mismatch names both changed files
PASS real wheelchair state ignores unlisted files
PASS codex_only ignores model path overrides
PASS kimi_on_path ignores model path overrides
PASS real wheelchair files the installer writes are byte-identical after suite
RESULT 217 passed, 0 failed
$ grep -n 'real wheelchair directory is byte-identical' install/test/run.sh
(no output, exit 1)
```

Negative checks (the worker's, pasted in `docs/plans/install-real-home-check/reports/T1.md`): with the `-u` flags removed, `FAIL codex_only ignores model path overrides` and `FAIL kimi_on_path ignores model path overrides`; with `.lock` dropped from the list, `FAIL real wheelchair mismatch names both changed files`; with `agy-models.json` added to the list, `FAIL real wheelchair state ignores unlisted files`. ShellCheck: 90 SC2016 + 1 SC2086 notes vs 91 + 1 on the base (no new warnings; scout-checked).

### Verification attempt 1 (commit db73471b)

Verifier (claude-opus-5-5): VERDICT PASS, no gaps. It ran `bash install/test/run.sh` with the real HOME (217 passed, 0 failed) and the old-assert grep (no output), and ran its own leak test on a scratch HOME: changing `models`, creating `.lock` and adding `agy-models.json` before the Darwin cases gave `FAIL real wheelchair file changed during suite: models, .lock`.

Full run (`bash test-support/full-run.sh`), `summary.txt`:

```text
commit db73471b6aa6c5b7a845dcf7dc1927519f64e3b4
suite viewer-browser exit 1 seconds 419
suite viewer-node exit 0 seconds 108
suite machine exit 0 seconds 146
suite test-support exit 0 seconds 27
suite sensitivity exit 0 seconds 4
suite codex exit 0 seconds 12
suite install exit 0 seconds 37
suite sudo-helper exit 0 seconds 9
```

`viewer-browser` exit 1 is already on main: four chromium tests in `viewer/test/app-accounts.spec.js:576,584,591,599` ("lead waiting line") fail with the same error, e.g. `Expected pattern: /^Waiting for GPT to refill, about \d/`, `Received string: "Waiting for GPT to refill, about Fri 02:55 AM"`. The test adds 3 hours to now, and the suite ran just before midnight (Thu Nov 26 11:55 PM PST), so the label shows a weekday. The `viewer/` tree at this commit is identical to the comparison commit 0b5e05cf (`git diff --quiet 0b5e05cf HEAD -- viewer` exits 0), and a rerun of those tests alone failed the same way. Not caused by this change; it does not fail the gate.

## Known gaps / residual risks

- As in PLAN.md Accepted Risks: a model pin changed in Settings during a suite run, or the machine's first-ever `.lock`, fails the check (false failure, rerun); `file_state` blind spots for directories/unreadable files/symlinks.
- Pre-existing on main: the "lead waiting line" browser tests fail when now + 3h crosses midnight (above).
- `real_wheelchair_mismatch` matches with an unanchored `grep -F "<path> "`; a future listed name that is a suffix of another (e.g. `lock` beside `.lock`) would need anchoring.

## Remediation rounds
