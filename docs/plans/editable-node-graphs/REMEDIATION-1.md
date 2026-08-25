---
slug: editable-node-graphs
round: 1
date: 2026-08-24
verifiers: gpt-5.6-sol, claude opus
---

# Remediation 1

Both verifiers returned `VERDICT: FAIL`. They ran blind and independently; the most serious gap was
found by both, with separate live evidence.

The GPT verifier's sandbox refused loopback binds, browser launches and symlink creation, so all four
of its suite runs failed on environment grounds and it verified by reading. The Claude verifier's
suites ran clean — `install.sh` twice idempotent, 80/80, 21/21, 13/13 — and it additionally confirmed
the never-skip requirement the hard way, by pointing Playwright at a nonexistent browser path and
watching all 13 fail loudly rather than skip.

**Every gap below was reproduced by the lead before being written down.**

## Gap list, verbatim from the verifiers

### From both

`GAP: §6 bulk verdicts / §13 "Bulk verdicts are additive" — the page's bulk approve/reject fans across
entries that already carry a verdict, so on any graph holding two or more of them the gesture is
refused and nothing at all is ruled; the test that should catch this hand-builds a correct payload
instead of driving the gesture — viewer/index.html:374-385 sets origin unconditionally;
viewer/server.js:628-631 refuses; live on the 12-node demo graph (17 proposed / 6 agreed / 2
rejected), select-all + approve produced exactly ["422 .../view"], banner 422 bulk-not-additive, and
after-counts identical to before; viewer/test/server.test.js:175-186 moves only origin === 'proposed'
entries itself, and browser test 5 starts from an all-proposed fixture`

`GAP: §13 "One write per action" — the assertion does not exist in either suite and is not among the
deviations COMPLETION records — the behaviour itself is correct (one PUT /view observed for a 25-item
select-all approve), so this is a missing guard, not a broken one`

### From the GPT verifier

`GAP: L2 / §6 agent verdict authority — an agent can grant verdicts while creating a graph —
checkAgentWrite contains the L2 protection at server.js:247, but server.js:643 invokes it only when
the file already exists; the create branch at server.js:651 accepts new agreed or rejected entries`

`GAP: §3 graph schema — the closed node/edge kind domains are not validated and the canonical fixture
is itself outside the Spec — server.js:124 and server.js:156 accept arbitrary kinds; graphs.md:101
explicitly admits this deviation, while canonical.json:23 uses invalid node kinds and
canonical.json:117 uses invalid edge kind reference`

`GAP: §8 discovery — the lockfile is not atomically claimed while holding its identity payload —
server.js:792 creates and closes an empty O_EXCL file, then server.js:807 rewrites it
non-exclusively; a simultaneous starter treats the empty claim as corrupt at server.js:747 and
deletes it, defeating the Spec's simultaneous-start exclusivity`

`GAP: §13 atomicity validation — the required mid-write process-kill assertion was replaced with an
ordinary completed write — server.test.js:293 explicitly says mid-write kill is not injected and only
parses the file after a normal successful request, so it cannot falsify truncation or replacement
failure during interruption`

`GAP: §1 documentation sweep — MAP.md and README.md still describe the pre-change repository —
MAP.md:14 says the planning loop is "markdown only", MAP.md:19 says nothing produces a picture, and
MAP.md:44 says index.html remains unfinished; README.md:49 also calls the viewer the only
non-markdown component despite spine/scan.sh and its test harness`

### From the Claude verifier

`GAP: §3 producer sequence / decision 87 — step 1 of the only document that tells an agent how to
write its first graph is a blocking command with no instruction to background it, so a cold agent
stalls before step 2 — protocol/graphs.md:260-263; running it verbatim printed the URL and then never
returned (killed at 120s), while a second --open against a running server returned in 0.110s; no
mention of &, nohup or backgrounding in protocol/graphs.md, skills/graph/SKILL.md or
codex/prompts/graph.md`

## Lead reproduction

| Gap | Reproduced how | Result |
|---|---|---|
| Bulk verdicts | Drove the real page against a purpose-built graph holding two struck entries | `PUT /view` → `[422]`, origins unchanged, banner `bulk-not-additive`. The gesture does nothing |
| Verdicts on create | Read `viewer/server.js:643-657` | `checkAgentWrite` is inside `if (current)`. The create branch runs cycle-check and layout only |
| `kind` domains | Parsed `viewer/test/fixtures/canonical.json` against §3's sets | node kinds `outcome`, `action`, `artifact`, `container` and edge kind `reference` are all outside the Spec |
| Producer hangs | Ran the documented step 1 verbatim with no server up, 15s timeout | exit 124 (blocked). With a server already up, exit 0 |
| One write per action | Read `viewer/test/browser.spec.js:96-101,120…` | A response collector exists but every assertion is `.some(status === 200)`; nothing counts |

## What actually failed

**These are brief defects, not lane defects**, which is what round 1 is expected to surface. Each traces
to something the lead's integration contract said, or failed to say:

- The additive-only rule was written into the contract as a **server check** and never as a **page
  behaviour**. The page did exactly what it was told and the rule it exists to permit was never
  implemented.
- The contract's agent-write checks were given as an ordered list for a write against an existing
  file; nothing said which of them still apply when there is no existing file.
- The contract's error table has no `bad-kind`, so the format document then documented the absence as
  a deliberate design choice.
- Neither the Spec nor the contract said `--open` must return when it is the process that becomes the
  server.
- The stdlib brief said to skip one-write-per-action as browser-only; the browser brief listed §13's
  bullets but never said to count requests. It fell between two briefs.

No lane is escalated. Same tiers, same families, rewritten briefs.

## Tasks

| # | Objective | Ownership | Lane | Validation |
|---|-----------|-----------|------|------------|
| R1 | A bulk verdict rules only on the unruled; a deliberate single reversal still works. Also: stop dropping a write that starts while another is in flight, and show that an agent reset an entry | `viewer/index.html` | Claude Sonnet | new browser assertions in R5, plus 13/13 |
| R2 | Run the agent-write checks on create, not only on update | `viewer/server.js` | GPT Terra | new stdlib assertion in R4 |
| R3 | Validate `kind` against §3's closed sets with a `bad-kind` refusal; bring every fixture inside the Spec | `viewer/server.js`, `viewer/test/fixtures/` | GPT Terra | 21/21 |
| R4 | Claim the lockfile atomically with its payload; assert atomicity under a real mid-write kill; assert an agent cannot create a graph carrying verdicts | `viewer/server.js`, `viewer/test/server.test.js` | GPT Terra | 21/21 + new cases |
| R5 | Drive the bulk gesture through the UI on a graph that already holds verdicts; count writes per action | `viewer/test/browser.spec.js` | Claude Sonnet | 13/13 + new cases |
| R6 | The producer sequence must not stall a cold agent; correct MAP.md and README; document the `kind` refusal | `protocol/graphs.md`, `docs/plans/editable-node-graphs/MAP.md`, `README.md` | Claude Sonnet | run the documented sequence verbatim from a cold start |

## Non-blocking observations, recorded

| Observation | Standing |
|---|---|
| The detail panel for an edge lands two rows away and darkens an unrelated node | For Collin's eye. Bounded deliberately in the last implementation pass; the alternative was worse |
| `spine/test/run.sh` compares gitignored scratch before and after, so it fails if another suite runs concurrently | Only matters if the four validation commands are ever parallelized. They are documented in sequence |
| COMPLETION records two of three §13 corrections; the atomicity one appears only in its gaps table | Fixed by R4 landing the assertion |
