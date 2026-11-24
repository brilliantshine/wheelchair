# Remediation 2 — fix-others-prs

Verification attempt 2 on c33620ba: claude verifier PASS; gpt verifier FAIL. Gap list verbatim:

GAP: Spec Validation, synchronous permit relay — If the machine returns 503 before contacting the hub, the new test waits forever for a hub call and never checks the response — `machine/test/service.test.js:349-353`. An in-memory mutation reproduced the hang and hit the 30-second timeout with exit 124.
→ Must-fix; second fix attempt for the machine relay test gap. Task R2-1 below.

GAP: §4 Bring it in — In a single-branch clone, the prescribed fetch puts the PR head in `FETCH_HEAD` and leaves the `origin/<head branch>` ref missing — `protocol/app/lead.md:775`. The prescribed merge failed with `origin/branch-only - not something we can merge`.
→ Rare path; Accepted Risks (verification-2).

GAP: §4 Bring it in and Push — Rare path: When a branch and tag share a name, the prescribed fetch selects the tag and leaves the tracking branch stale. The push then fails with `dst refspec collaborator matches more than one` — `protocol/app/lead.md:775-784`.
→ Rare path; Accepted Risks (verification-2).

# Task R2-1 — bound the wait in the permit relay test

## Objective
In `machine/test/service.test.js`, test `permit is relayed synchronously and returns the hub's answer`, lines ~349-353 read:
```js
    const pending = api(env, 'POST', '/v1/agent/cards', { kind: 'permit', pr_url: 'https://github.com/o/r/pull/7', why: 'fix it' }, agentHeader('alpha'));
    while (!hub.calls.some(call => call.path.endsWith('/cards'))) await new Promise(resolve => setTimeout(resolve, 1));
```
If the machine answered 503 without contacting the hub, this loop never ends and the test hangs. Replace the `while` line with exactly this (keep the `pending` line and everything after it unchanged):
```js
    let settled = false; pending.then(() => { settled = true; }, () => { settled = true; });
    const deadline = Date.now() + 5000;
    while (!hub.calls.some(call => call.path.endsWith('/cards')) && !settled && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(hub.calls.some(call => call.path.endsWith('/cards')), 'the machine must contact the hub before answering a permit card');
```
No other change to the file.

## Show it fails instead of hanging
Temporarily, in `machine/service.js` right after the line `if (behind || !this.config.hub_url) return send(response, 503, unavailable);` (near :2270), add `if (input.kind === 'permit') return send(response, 503, unavailable);`. Run
`timeout 120 node --test --test-name-pattern "relayed synchronously" machine/test/service.test.js; echo exit $?`
It must print a failing test (`not ok`) with the message above and exit 1, not 124. Then restore with `git checkout machine/service.js` and run it again: it must pass. Paste both runs. Never commit machine/service.js.

## Ownership boundary
`machine/test/service.test.js` only (that one line replaced).

## Validation
```bash
node --test --test-name-pattern "permit" machine/test/service.test.js
node --test machine/test/service.test.js
```
Guardrail: if the same gate fails twice, stop and report rather than iterating.

## Common rules
- Plan slug: `fix-others-prs`. Plan: `docs/plans/fix-others-prs/PLAN.md` (read the Spec, Accepted Risks and Deferred D1-D6; deferred items are out of scope). IDEA.md is beside it.
- The thread lead's session is `wc-426aa645964b-lead`. Questions the plan does not settle go to it as a `message` card with `asks: true`.
- Stay inside your ownership boundary. If you find you must change a file outside it, stop and ask the lead instead.
- Never delete files (no `rm`, no `git rm`, no `git clean`). Never run `./install.sh`. Never start the viewer or machine service by hand; tests start their own isolated servers.
- Your own `wc.js` and `card.js` calls are always allowed (port 7374 is fine). Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <exact paths>`.
- Every test you add must fail when its behaviour breaks: seed a starting state that differs from the result you assert, break the code once, watch the test fail, restore it.
- Write your report to `docs/plans/fix-others-prs/reports/<task>.md` on your branch and commit it. It must paste the actual output (tail) of each validation command, and list the files you changed.
- Finish with a `result` card (task id below, outcome done or blocked, report path, commit).
- Closing request: List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
