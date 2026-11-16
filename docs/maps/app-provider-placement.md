# Map: app provider placement

Checked against: `e8911e23e46df47f7264aacd9d8d4cc9d5af3133` (origin/main)
Files covered: `viewer/app/balancer.js`, `viewer/app/usage.js`, `viewer/app/providers.js`, `viewer/app/sessions.js`, `viewer/app/settings.js`, `viewer/app/ready.js`, `viewer/app/wc.js`, `viewer/app/API.md`, `viewer/pages/settings.js`, `viewer/test/app-balancer.test.js`, `viewer/test/app-usage.test.js`, `viewer/test/app-accounts.spec.js`, `protocol/app/lead.md`, `protocol/app/sub-lead.md`.

```text
Settings -> saved orders and reserve -> session request -> model and account eligibility -> provider choice -> machine start
                                                                | no eligible account
                                                              waiting -> retry
```

1. Defaults create an account record for each provider, lead order Claude then `any`, worker order GPT then Claude, save Claude on, margin 5%, and all four non-lead roles held back (`viewer/app/settings.js:25-27`). Normalization restores missing default records and defaults invalid balancing values; `any` is allowed only at the end of lead order (`viewer/app/settings.js:171-183,200-208`). The Usage page saves its balancing draft separately from Models' lead order; both use the balancing route (`viewer/pages/settings.js:1051-1083,1133-1149,1165-1166`; `viewer/app/API.md:87-92`).
2. `wc.js` forwards the provider flags; the session start passes them to placement (`viewer/app/wc.js:70-90`; `viewer/app/sessions.js:74-83,405-408`). New leads expand `any` using worker order; existing leads and sub-leads use the thread provider; other roles use worker order. Providers with an unused model cell are skipped (`viewer/app/balancer.js:11-18,28-41`).
3. Placement ranks accounts signed in on the target machine, excluding paused, limited and exhausted accounts; ranking supports soonest, spread and last chosen (`viewer/app/usage.js:19-21,48-85`). GPT preflight failure prompts reselection or a 409; the chosen provider and account go to the machine (`viewer/app/sessions.js:96-123,147-158`). A wait retains its request and is retried (`viewer/app/sessions.js:83-94,549`).
4. Only Claude has `saveForLeads`; that flag drives both the margin exclusion for ticked roles and the separate checkbox that moves Claude to the end of normal order (`viewer/app/providers.js:3`; `viewer/app/balancer.js:35-46`). The margin applies even when the checkbox is off (`viewer/test/app-balancer.test.js:90-98`). The forecast uses active account weights and weekly readings, and no refill or reading means it is not below margin (`viewer/app/usage.js:23-37`).
5. Constraints are allowed only for workers, reviewers and verifiers and cannot be combined. Workers' exclusions and requests are strict except a requested provider below its margin can fall back; reviewers and verifiers fall back with a note, including when their excluded provider is the only available one (`viewer/app/balancer.js:19-21,48-59`; `viewer/test/app-balancer.test.js:66-78`). A selected provider must also be in the role's order (`viewer/app/balancer.js:29-41,49`).
6. Ready requires the thread CLI installed and logged in; it skips an absent other CLI but requires it logged in if installed. It also requires the service version to match (`viewer/app/ready.js:29-60`). Thus an installed but signed-out second CLI blocks a one-family setup even though an absent CLI does not. The default account records alone do not establish login (`viewer/app/settings.js:27`; `viewer/app/ready.js:51-58`).

Tests cover placement and preferences, margin and waiting (`viewer/test/app-balancer.test.js:49-98`), normalization and validation (`viewer/test/app-usage.test.js:13-21,56-68`), and exact Usage and lead-order save payloads (`viewer/test/app-accounts.spec.js:222-252`).

## What I did not look at

Machine CLI launch internals, account sign-in implementation, unrelated settings, and test cases outside the cited placement and settings paths.

> Current risk-flow recheck at `635c45f07991f31191f2ab1443b52b4ee76559d5`: see [app-risks.md](app-risks.md). The original checked commit above still applies to the rest of this map; files have changed since then.
