---
slug: router-spine
round: 1
date: 2026-08-24
verifiers: gpt-5.6-sol (FAIL, 5 gaps), claude (PASS, 8 observations)
---

# Remediation 1

Both families verified, per Stage 4's rule for a mixed implementation. They disagreed, and
the disagreement was settled by the lead re-running each contested claim rather than by
preferring a verdict.

## The verdicts as delivered

**GPT verifier — `VERDICT: FAIL`, verbatim:**

```
GAP: §3 JSON/path contract — legal pathnames can produce invalid JSON or the wrong target — a directory named with byte `0xff` made `python3 -m json.tool` exit 1 with `invalid start byte`, while scanning a target whose name ends in newline exited 1 and reported the newline-stripped path; the stripping originates at `spine/scan.sh:15`
GAP: §3/§5 symlink safety — the walk follows directory symlinks outside the target without marking or skipping them, allowing `/spine` to propose a new router through that link — with `vendor-link -> /tmp/.../external`, output contained ordinary unskipped rows for `vendor-link` and `vendor-link/subdir`; `spine/scan.sh:255-271` has no directory-symlink guard
GAP: §11 write-anywhere assertion — the harness only hashes its fixture tree and cannot detect writes elsewhere — a scratch scanner mutated to create an external marker still returned `RESULT 44 passed, 0 failed` with the marker present; the ineffective scope is visible at `spine/test/run.sh:281-286`
GAP: §4 completion evidence (minor) — `COMPLETION.md:55` claims the four routers name 17 immediate non-router children, but the router coverage lines name 11: root 3, protocol 1, skills 6, spine 1 — `AGENTS.md:35-37`, `protocol/AGENTS.md:34`, `skills/AGENTS.md:16-21`, `spine/AGENTS.md:24`
GAP: §8 completion evidence (minor) — `COMPLETION.md:69` claims README’s tree lists every top-level directory, but tracked top-level `docs/` is absent — `git ls-tree -d --name-only HEAD` includes `docs`, while `README.md:9-33` does not
```

**Claude verifier — `VERDICT: PASS`**, with eight observations, none called blocking. Its
substantive ones: `protocol/routers.md:81-83` now states a fact this change made false;
the root router says "two bash scripts" where there are three and "three kinds of
directory and only three" against a table listing five; the root router has no
file-to-role table though the format lists one; two wrong numbers in COMPLETION.md; a
symlinked directory pointing at an ancestor makes the walk re-descend (451 entries, 127KB
of JSON); three narrowings in the test suite; a stderr warning from the control-character
escape; and README reading order.

## Where they disagreed, and what settled it

The Claude lane cleared three things the GPT lane failed, so the lead reproduced each.

| Contested | Claude lane | GPT lane | Lead's own test | Settled |
|---|---|---|---|---|
| Can the hand-built JSON be broken? | "could not make it emit unparseable or wrong JSON" — tested quotes, backslash, newline, tab, control chars, NUL, emoji | invalid UTF-8 byte `0xff` breaks the parse at exit 0 | reproduced: `json.tool` exits 1, `invalid start byte`, scanner exits 0 | **GPT right.** The Claude lane never tried a byte that is not valid UTF-8, which is the one class that breaks it |
| Does a directory symlink escape the target? | "every dangerous case yields `writeTarget: null` plus a skip reason" | the walk descends and emits ordinary rows | reproduced both ways: with routing files out there the rows *are* skipped, so the Claude lane's test was sound as far as it went; with **no** routing file out there the rows come back unmarked and `/spine` could propose a router outside the target | **GPT right**, and its own evidence understated it — the no-candidate case is the sharp one. The Claude lane's separate ancestor-loop observation is the same root cause |
| Does the suite catch a write outside the fixture tree? | "two mutations that make it write are caught" | a mutation writing an external marker still passes 44/44 | reproduced: mutated a copy to write `$(mktemp -d)/marker`, suite returned `RESULT 44 passed, 0 failed`, marker present | **GPT right.** Both Claude-lane mutations wrote *inside* the fixture tree, which is caught; outside is not |

Where they agreed, or where only one looked, the lead re-checked before upholding:
`.gitignore` really does hold two entries now, the repo really has three shell scripts,
the root router really has no file-to-role table, the tree really holds 16 non-earning
directories of which 11 are named, and `protocol/spine.md:147` really is a blank line.

## Adjudication

Thirteen upheld. Nothing declined outright; three items were re-scoped from how a verifier
framed them.

| # | Gap | Verdict | Note |
|---|---|---|---|
| R1 | The walk descends into a directory symlink, so a link pointing outside the target yields unmarked candidate rows out there and an ancestor link makes it re-descend | `upheld` | Both verifiers found this from different angles. §10's binding non-goal is no walking into a container, and §3's nested-repo exclusion exists for exactly this reason — proposing routers in a tree the person did not name |
| R2 | A path byte that is not valid UTF-8 makes the whole document undecodable while the scanner exits 0 | `upheld` | §11 requires valid JSON on stdout. Same failure shape as the backslash defect this run already fixed: confident, wrong, exit 0 |
| R3 | §11's "nothing outside the fixture tree was written" is not actually asserted | `upheld` | Coverage the lead dropped when removing the lane's source-text grep, and COMPLETION.md then described the umbrella hash as if it covered more than it does. That sentence is a lead defect, not a lane defect |
| R4 | A target whose name ends in a newline is reported with the name mangled | `upheld` (minor) | Fails closed — exit 1, no write target — so this is a reporting defect on an exotic input, not a safety one |
| R5 | `printf -v char '\u%04x'` writes `printf: missing unicode digit` to stderr while emitting the correct escape | `upheld` (minor) | Correct only by accident, and a caller merging stderr into stdout would corrupt the document |
| R6 | `stat -c %s` leaves its newline inside the JSON | `upheld` (cosmetic) | Legal whitespace, parses everywhere. Fixed because the file is open anyway |
| R7 | `protocol/routers.md:81-83` states "this repo's `.gitignore` holds only `node_modules/`", which the §7 run falsified by adding `graphify-out/` | `upheld` | The sharpest finding of the round. A false illustration inside the file whose thesis is that a document which lies is worse than none. The rule it illustrates is stated correctly; only the example is stale |
| R8 | Root router says "markdown plus two bash scripts"; there are three, plus a JS file | `upheld` | A router that lies about its own directory |
| R9 | Root router says "three kinds of directory here and only three", then tables five, including `spine/` — executable code, which is none of the three | `upheld` | The organizing idea contradicts its own table. Either the idea or the table is wrong; the idea is |
| R10 | Root router has no file-to-role table, which `protocol/routers.md:38-42` lists for a created router, so `README.md` is never named | `upheld` | A created router measured against the format it was created under — legitimate, unlike measuring a pre-existing one |
| R11 | COMPLETION.md: "17 non-earning directories" (11 named, 16 exist), a citation to a blank line, and a pasted gate showing 6 commits when committing the report made it 7 | `upheld` | Lead defects in the lead's own document |
| R12 | README's new `/spine` block sits between `/adopt`'s code block and its explanation, so "It copies the document into `docs/plans/<slug>/`" now reads as describing `/spine` | `upheld` | Caused by the lead's brief naming that insertion point |
| R13 | README's Layout tree omits `docs/`, `protocol/AGENTS.md`, and all four routers | `upheld` | §8 only required `spine/` and `spike/`, so the Spec is met; the COMPLETION claim that the tree lists every top-level directory is what was false. Fixing the tree makes both true |
| — | Test-suite narrowings: `os.path.islink` rather than `! test -L`, run against one report; no fixture for "resolves outside the target tree"; `json_assert`'s fallback silently degrading ~20 assertions when `python3` is absent | `re-scoped` | The Claude lane confirmed a link-path mutation is still caught, so intent holds and this is not a gap in behaviour. Folded into R1/R3 as improvements: broaden the check to every report, add the missing fixture, and make a missing `python3` fail loudly instead of quietly weakening the suite |
| — | The symlinked-ancestor loop is "unspecified rather than violated" | `re-scoped` | Correct that §9 has no row for it, but the fix for R1 removes it as a side effect, and §9 gains a row so it stops being unspecified |

No gap here is evidence for a model escalation. Stage 4's rule is that round 1 sharpens
the brief, and every one of these was a case the original brief did not name: it demanded
valid JSON for "backslash, double quote, and control characters" without saying anything
about bytes that are not UTF-8, it never mentioned directory symlinks at all, and it asked
for "nothing is written outside the fixture tree" without saying how that could be
observed. The code tasks go back to the same GPT workhorse tier that built `spine/`, on a
brief that now names all three.

## Tasks

| # | Objective | Ownership boundary | Lane | Validation | Status |
|---|-----------|--------------------|------|------------|--------|
| RT1 | R1–R6: never descend into a directory symlink and report it excluded; exclude a path that is not valid UTF-8; preserve exotic path names through a NUL-delimited read; build control-character escapes without the malformed `printf`; keep `stat`'s newline out of the JSON. Then close R3 by sandboxing `HOME` and `TMPDIR` per scan and asserting both stay empty, asserting this repo's `git status` is unchanged across the suite, broadening the link check to every report, adding the missing outside-the-target fixture, and making a missing `python3` fail loudly | `spine/` only, in worktree `spine-fix` | terra | `bash spine/test/run.sh`; each new assertion proven to fail against the unfixed code | |
| RT2 | R7–R13: correct the falsified illustration in the format document, fix the root router's two false statements and give it the file-to-role table the format requires, restore README's reading order and complete its Layout tree, and correct every wrong number and citation in COMPLETION.md | `protocol/routers.md`, `AGENTS.md`, `README.md`, `docs/plans/router-spine/COMPLETION.md`, `protocol/spine.md` (§9 row) | lead | re-read; every corrected number re-derived from the tree rather than restated | |

RT1 and RT2 touch disjoint paths and run concurrently across separate worktrees, as
`lanes.md` requires.
