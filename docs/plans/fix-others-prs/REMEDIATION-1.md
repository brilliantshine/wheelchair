# Remediation 1 — fix-others-prs

Verification attempt 1 on 29f939e8: claude verifier PASS; gpt verifier FAIL. Gap list verbatim:

GAP: §4, Finish — If the author converts the target PR to draft after a successful push, the foreground wait keeps polling before the lead can ask Collin what to do — `protocol/app/lead.md:785` inherits the wait at `:639–653`, and `viewer/app/pr-wait.py:26–44` has no draft stop condition. A stubbed `OPEN` / `DRAFT` response reproduced `STOP: time limit` after 600 virtual seconds.
→ Rare path; recorded in Accepted Risks (verification-1). Not remediated.

GAP: Validation, machine relay — The checked-in permit test covers unavailable-hub responses but would also pass if every permit post immediately returned 503 — `machine/test/service.test.js:327–343` never asserts that the machine waits for and returns the hub's reply. An isolated check confirmed that the implementation does wait, returns the hub's card ID or refusal, and leaves the spool empty.
→ Must-fix (Spec Validation bullet). Lead agreed. Task R1-1 below.

# Task R1-1 — machine test: the permit card is relayed synchronously

## Objective
`machine/test/service.test.js:327-344` (test `permit is never spooled when the hub is unavailable or earlier cards are waiting`) only covers 503 answers, so it would pass if every permit post returned 503. Add ONE new test right after it, named `permit is relayed synchronously and returns the hub's answer`, with two cases:
1. Hub answers 200: `const hub = await hubServer(200, { answer: { id: 'permit-card-1' } })`. POST `{ kind: 'permit', pr_url: 'https://github.com/o/r/pull/7', why: 'fix it' }` with `agentHeader('alpha')`. Assert status 200, `body.id === 'permit-card-1'`, the spool dir `path.join(env.state, 'spool', 'cards')` has 0 `.json` files (use `.catch(() => [])` on readdir in case it does not exist), and `hub.calls` has exactly one call to a path ending `/cards` whose JSON body has `kind === 'permit'`.
2. Hub answers 422: `hubServer(422, { answer: { error: 'that pull request is closed' } })`. Assert status 422, `body.error === 'that pull request is closed'`, and 0 spooled files.
Use the same `service(await temp(), { config: { hub_url: hub.url } })`, `start(env)` and `try/finally { await env.close(); await hub.close(); }` shape as the test above it.

The fake hub at `machine/test/service.test.js:44` has an `allowed` map of kinds to roles; with 200 it refuses kinds not in that map. Add `permit: ['lead']` to that map (the only other edit allowed).

Check the test can fail: temporarily change `input.kind === 'permit'` out of the condition at `machine/service.js:2263` (so permit gets spooled), run the new test, see it fail, then restore the file with `git checkout machine/service.js`. Paste both runs in the report. Do not commit any change to machine/service.js.

## Ownership boundary
`machine/test/service.test.js` only.

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
