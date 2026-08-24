---
slug: router-spine
round: 2
date: 2026-08-24
verifier: gpt-5.6-sol (closure review, resumed session 01a0358e)
---

# Remediation 2

The closure review confirmed all five round-1 gaps closed, both calibrations reproducing,
the JSON schema unchanged, no source-text assertion reintroduced, and every targeted
mutation triggering its assertion. It then found three defects in the remediation itself.

## Verdict verbatim

```
VERDICT: FAIL
GAP: §3 JSON contract — UTF-8 validation covers pathnames but not heading content, so stdout is still breakable at exit 0 — writing `printf '# bad \xff heading\n' > AGENTS.md`, scanning, then running `python3 -m json.tool` produced `scan_rc=0`, `parse_rc=1`, `invalid start byte`; `spine/scan.sh:170-179` passes headings directly to `json_string` without validation
GAP: §11 no-write coverage and router truth — the claimed repository coverage misses writes to ignored paths, and the `spine/` router still falsely says the fixture hash proves "writes nothing, anywhere" — a scratch scanner writing `graphify-out/repo-marker` inside its test repository left the marker present while the suite returned `RESULT 83 passed, 0 failed`; compare `COMPLETION.md:409-414`, `spine/test/run.sh:370-383`, and the contradictory `spine/AGENTS.md:28-30`
GAP: §11 assertion validity — 15 of the 17 new per-report link-target assertions are vacuous because those fixtures contain no routing-file symlink capable of becoming a link write target — after deliberately restoring link-path emission, only `claude-link` and `agents-link` failed while the other 15 checks still passed; the parameterized assertions are at `spine/test/run.sh:258-266`, with only the two relevant fixtures at `spine/test/run.sh:134-142`
```

## Adjudication — all three upheld, each reproduced

| # | Gap | Verdict | Lead's own evidence |
|---|-----|---------|---------------------|
| S1 | Invalid UTF-8 in a **heading** still breaks the document at exit 0 | `upheld` | `printf '# bad \xff heading\n' > AGENTS.md` → scan exits 0, `json.tool` fails `invalid start byte` at position 269 |
| S2 | The repo-status check cannot see a write into a git-ignored path, and `spine/AGENTS.md` overclaims what the fixture hash proves | `upheld` | Wrote `graphify-out/repo-marker`: `git status --porcelain` shows nothing, `--ignored` shows `!! graphify-out/`. `spine/AGENTS.md:28-30` says the fixture hash proves the scanner "writes nothing, anywhere" — it proves nothing outside the fixture tree |
| S3 | 15 of 17 broadened link-target assertions cannot fail | `upheld` | Only four fixtures contain a routing-file symlink (`run.sh:137`, `:141`, `:147`, `:181`); two directory-symlink lines are not candidates. The rest of the parameterised instances pass regardless |

## Why each happened, and what that says about the tier

None of these is the lane failing to do what it was told. All three trace to the brief.

**S1 is the round-1 gap surviving, at a second input site.** My round-1 brief said "a
directory whose path is not valid UTF-8 is excluded" and "apply the same guard to the target
path itself." It never mentioned headings, which are the other string that reaches the
serializer. The lane implemented the scope it was given, exactly. This is the third time an
"invalid bytes break the JSON" defect has appeared in this work — first backslashes during
implementation, then paths in round 1, now headings — and each fix patched the site rather
than the class.

So the fix this round is **architectural, not another site patch**: validation moves inside
`json_string`, the single function every emitted string already passes through. After that,
no call site can forget it, and a new field added later inherits the guard for free. If a
site-by-site fix were attempted again and a fourth site turned up, that would be a plan
defect rather than an implementation one.

**S2 is half a brief defect and half mine.** I specified `git status --porcelain` as the
repo check and never considered that it is blind to ignored paths — the very paths a cache or
a graph would land in, which is exactly what a scanner would plausibly write. Separately,
`spine/AGENTS.md` is a router I wrote, and it claims the fixture hash proves more than it
does. That is a router that lies, in the change whose whole thesis is that a router which
lies is worse than none — the same defect class the round-1 review found in
`protocol/routers.md`. Twice now, which is a pattern worth naming: the documents asserting
this discipline are the ones drifting from it.

**S3 is caused by my own instruction.** I told the lane to run the link-target check "over
every case's report, not one." Broadening a check to fixtures that cannot exercise it
manufactures assertions that cannot fail — 15 of them — which is the precise failure this
suite already shipped once, in the source-text grep removed during implementation. The
instruction was wrong; the lane followed it.

**Rung: `xhigh` at the same tier, fresh lane.** Stage 4's rule is that a gap surviving
round 1 buys one rung and the failure mode picks which: "a lane that produced nearly-right
work and missed an edge case gets `xhigh` at the same tier." That is S1 exactly — it
validated paths and missed headings. Not a tier change, because nothing here suggests the
lane misread the task; it read three briefs that were each narrower than the defect. A fresh
lane rather than a resume, so the rung is not handed a context full of the last attempt's
scoping.

**Stop condition.** S1 has now survived one remediation round. If it survives this one, the
loop stops and the question goes to the user as a plan defect, per Stage 4.

## Tasks

| # | Objective | Ownership boundary | Lane | Validation | Status |
|---|-----------|--------------------|------|------------|--------|
| ST1 | S1: move UTF-8 validation into `json_string` so every emitted string is guarded at the chokepoint, not per call site. S2: extend the repo check to see ignored paths, and state honestly what it covers. S3: make the link-target assertion non-vacuous — run it only where a routing symlink exists and fail if that set is empty | `spine/` only, worktree `spine-fix2` | terra, `xhigh` | `bash spine/test/run.sh`; each changed assertion proven able to fail; a heading and a path each carrying an invalid byte | |
| ST2 | S2's documentation half: correct `spine/AGENTS.md`'s overclaim and the matching sentence in COMPLETION.md | `spine/AGENTS.md`, `docs/plans/router-spine/COMPLETION.md` | lead | re-read against what the suite actually asserts | |
