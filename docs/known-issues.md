# Known issues

Failures found and recorded but not yet fixed. Each entry says how to reproduce it and what is
already known, so an agent can be pointed straight at it.

## Viewer: "no drawn arrow's line passes through either box it connects, over every committed graph" fails

Found 2026-11-14 while building the app-shell plan. It is not caused by that work: it fails the
same way on `main` at `2715f61`, and still fails with the app-shell graphs removed from the index.

**Reproduce**

```bash
npm --prefix viewer run test:browser -- browser.spec.js -g "no drawn arrow" --project chromium
```

**What is known**

Both browsers fail with `page.evaluate: TypeError: Cannot read properties of null (reading 'map')`,
so one committed graph renders without something the test's in-page code expects. Which graph
was not narrowed down.

Still failing on 2026-11-15: reproduced identically in both browsers on `7f4c318`, the base of
the agents-screen build, and on that build's branch. Treated as out of scope for that build.

**Fixed 2026-11-15** in the remove-graph-verdicts build (remediation 1): the test parsed every
edge path as a straight `M..L` line, and run pictures (`docs/plans/app-shell/graphs/run.json`,
`docs/plans/model-pins/graphs/run.json`) draw curved wires. The check now skips run pictures
(`viewer/test/browser.spec.js:2173`). Remove this entry once that build is merged.

## Viewer: "the global write lock serializes concurrent writes and retry retains both changes" fails sometimes

Found 2026-11-14 during the app-shell validation run. It is a race in the test, not in the
server: `viewer/test/server.test.js` hasn't changed since `2554bf3`, and the test passes or
fails on the same code depending on timing (3 of 3 passed run alone, then it failed in the full
suite twice and in its own file once).

**Reproduce**

```bash
node --test viewer/test/server.test.js
```

**What is known**

The test (`viewer/test/server.test.js:536`) sends two writes from the same base: `left` sets a
note on `gather`, `right` one on `inspect`. One wins and one gets `409`. The retry then always
re-applies `right`'s change (`:553`), as if `left` had won. When `right` wins, the retry
re-sends a change that is already there, `left`'s note is never written, and `:556` fails with
`expected 'left', actual undefined`. The fix is for the retry to re-apply whichever write was
refused.

## Viewer: "approval: Start building enabled when Ready and presses; offer press" times out sometimes (Firefox, phone)

Seen once, in the app-shell final verification at 42de2e4
(`viewer/test/app-threads.spec.js:305`, Firefox, phone viewport). The test timed out waiting
for the offer button's request. Rerunning that spec file three times with
`--repeat-each=2` gave 408 passes. Nothing in that remediation changed the spec, its helpers
or the pages. The cause is not known yet.

## Viewer: the "lead waiting line" tests fail after 21:00 local time

Found 2026-11-15 by the remove-graph-verdicts verifiers at 21:09 PST. It is not caused by that
work: it fails the same way on `635c45f`, before it, and that build touched neither the test file
nor `viewer/app` or `viewer/pages`.

**Reproduce** (after 21:00 local time)

```bash
cd viewer && npx playwright test test/app-accounts.spec.js -g "lead waiting line"
```

**What is known**

Three tests in `viewer/test/app-accounts.spec.js` ("a waiting lead shows when the provider
refills", "a waiting lead pinned to a provider names it when the lead has none", "a waiting lead
with no provider anywhere says it is waiting for room") set `waiting_until` three hours ahead and
expect `#lead-wait` to match `about \d`. After 21:00 that time is past midnight, the page prints
it with a weekday ("about Mon 12:09 AM"), and the match fails, in both browsers. Before 21:00 they
pass. The fix belongs in the test (a fixed clock or a shorter wait) or in the expected pattern.

## Viewer: "app-threads.spec.js:142" fails to navigate in Firefox sometimes

Seen once, by the GPT verifier of the remove-graph-verdicts build at `7940aba`: the test at
`viewer/test/app-threads.spec.js:142` failed a page navigation in Firefox. The Claude verifier's
full browser run on the same commit did not hit it, and that build touched neither the spec nor
the app pages. The cause is not known yet.

