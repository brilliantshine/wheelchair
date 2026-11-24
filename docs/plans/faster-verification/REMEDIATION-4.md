# Remediation 4 — faster-verification

Verification attempt 4 on 736bb799: Claude verifier FAIL (one minor router gap), GPT verifier FAIL. The lead said to fix all four in one commit (PLAN.md Log).

## Gaps (verbatim, merged)

- GAP (GPT): S1 rule 2 — The picker misses direct CommonJS imports that resolve to `.json` — `test-support/pick-tests.js:67–73` checks the exact path, `.js`, and `/index.js`. In a scratch repo, changing `viewer/verification-fixture.json` selected only the same-named viewer test. The omitted machine test directly required `../../viewer/verification-fixture`, passed before the change, and failed afterward.
- GAP (GPT): S5.0 — The full-run instructions still reach projects that have not opted in — `protocol/app/sub-lead.md:273–280` requires `summary.txt` before sending the result even though only the opening gate is conditional. `protocol/app/lead.md:730–734` likewise leaves the repair push gate unqualified.
- GAP (GPT): S5.6 — The small-fix push gate conflicts with Collin's explicit choice to push after two failed attempts — `protocol/app/lead.md:160–164` offers that choice, then still requires a passing or covered full run before the push.
- GAP (Claude): S3 (router kept true) — `viewer/AGENTS.md:49` still says the browser config uses a fixed `workers: 2`; COMPLETION.md's Routers section says `viewer/AGENTS.md` needed no change.

## Tasks

| Task | Gap | Lane |
|---|---|---|
| R7 | All four: `.json` import resolution plus test; opt-in qualifiers in sub-lead.md step 4 and lead.md repair; push-as-is exemption in lead.md small fix; viewer/AGENTS.md row and COMPLETION.md Routers | sub-lead, one commit |
