# Remediation 1 — verification round 1

Both verifiers returned `VERDICT: FAIL`. They agree on two gaps; the Claude lane found a third.
All three were confirmed against the tree by the lead before routing.

## Gap list, verbatim

**GPT verifier** (`gpt-5.6-sol`, thread `01a04f5f-f4ef-7492-8f4d-288c310a6837`, cross-family to
the Sonnet-built README):

```
GAP: §7 Installation — README never says to rerun the installer after installing the other
harness — required by `docs/plans/one-account-setups/PLAN.md:330-331`; `README.md:93-111`
mentions reruns only for edited wrappers or sensitivity rules
GAP: §10 Written description — README still says the sensitivity region is rendered into both
harnesses' files, contradicting present-only behavior — `README.md:60-61`; correct contract at
`protocol/sensitivity.md:10-12`
```

**Claude verifier** (default reviewer model, cross-family to the Terra/Luna-built scripts and
protocol documents):

```
GAP: §7 (installing a harness afterwards needs a re-run) — the Spec requires "a line saying so,
not a mechanism"; no such line exists anywhere in the repo, and COMPLETION.md's Spec-coverage
table has no row for it despite the template's "one row per spec item, no omissions"

GAP: §10 (the correction rule, not the table, is the contract) — `README.md:60-61` still
describes the dial writer unconditionally: "the region rendered into both / harnesses' always-on
files", which is exactly the flagged class; the identical sentence in `protocol/AGENTS.md:33` was
corrected to "present harnesses' always-on files", so the pair now disagrees. The §10 search
misses it because "both" ends line 60 and "harnesses'" begins line 61

GAP: COMPLETION.md "Routers" section — the change created a new top-level directory `install/`
that appears in no router's directory index: root `AGENTS.md:42-50`'s "Where to go" table omits
it, and `AGENTS.md:24-29`'s Kind table names the executables while claiming "everything here is
one of four things". Only the Verification list at `AGENTS.md:94` was updated. `README.md:49-85`'s
Layout block likewise omits `install/` while listing the other two suites under their parents
```

## Why these were missed

All three are defects in the Stage 3 briefs rather than in the lanes, which is what
`verification.md` says a first FAIL usually is.

**The re-run line** fell between two briefs. §7 was split — task 1 took the installer's code, task
6 took the README prose — and the sentence belongs to neither half as I wrote them.

**`README.md:60-61`** was not in the Spec's §10 table, and my task-6 brief leaned on that table
rather than on §10's rule. The Spec says in terms that the rule is the contract and the table is a
starting point; the brief inverted that emphasis. The same lane found two other unlisted claims on
its own, so this is a brief that under-weighted the rule, not a lane that ignored it.

**The `install/` router entry** was in no brief at all. Task 1 created the directory and task 5
owned the routers, and neither was told that a new top-level directory obliges an index entry —
even though `protocol/implementation.md`'s own integration step requires a router update when a
change alters what a directory owns.

## Tasks

Routed to the family that built each file, per `verification.md`. Sequenced, not parallel: one
checkout.

### R1.1 — README (gaps 1, 2, and the README half of 3) — Claude lane, sonnet

**Objective.** Three corrections to `README.md`, which Sonnet wrote in Stage 3 task 6.

1. Add the line §7 requires: installing a harness after the fact needs an `install.sh` re-run.
   `README.md:93-111` already discusses re-runs for edited wrappers and for the dial; this belongs
   with them. One sentence, not a mechanism and not a section.
2. `README.md:60-61` — "the region rendered into both / harnesses' always-on files" becomes
   present-harnesses wording. `protocol/AGENTS.md:33` and `protocol/sensitivity.md:10-12` carry the
   corrected phrasing; match them rather than inventing a third.
3. The Layout block at `README.md:49-85` lists `spine/test/run.sh` and `sensitivity/test/run.sh`
   under their parents but omits `install/` entirely. Add it in the same shape.

**Ownership boundary.** `README.md` only.

**Validation.**
```bash
grep -n 'both$' README.md | sed -n '1,5p'          # the split-line claim must be gone
grep -rniE 'install(ing)? (a|the|another) harness' --include=*.md . | grep -v docs/plans/
grep -n 'install/' README.md
```

### R1.2 — root router (the `AGENTS.md` half of gap 3) — GPT lane, terra

**Objective.** `install/` is a new top-level directory holding `install/test/run.sh` and it appears
in no index in the root `AGENTS.md`. Task 5 added it to the Verification list at `:94` only.

Add it to the "Where to go" table alongside the other top-level directories, and to the Kind table
at `:24-29`, which claims everything in the repo is one of four things and currently names
`spine/`, `sensitivity/`, `viewer/` and `install.sh` as the executables.

**Ownership boundary.** `AGENTS.md` only. Not `README.md` — that is R1.1's.

**Validation.**
```bash
grep -n 'install/' AGENTS.md            # expect the two new rows plus the existing :94
bash install/test/run.sh
```

## Outcome

**R1.1** — landed. `README.md:100` carries the re-run line inside the existing wrapper paragraph;
`:60-61` matches `protocol/AGENTS.md:33` verbatim; `:77-78` adds `install/` to the Layout block
beside `spine/` and `sensitivity/`. The lane additionally swept the rest of the README against
§10's rule and reported the two mentions it deliberately left — the graph format "read by both
harnesses" and "both harnesses drive the same binaries" — as statements about a harness-agnostic
design rather than claims that both are installed. That matches the reasoning the Stage 3 lane gave
for the same two lines, independently.

**R1.2** — landed. `AGENTS.md:29` adds `install/` to the Kind table's executables, and `:48` adds
its row to "Where to go" with an em-dash in the router column, matching the other directories that
have no router of their own.

Full validation green after both. Handed back to the two round-1 verifiers for closure review,
resumed rather than replaced, per `verification.md`.
