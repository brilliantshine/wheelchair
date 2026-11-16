# Map: Claude reserve per role

The end-to-end placement and settings flow is in `docs/maps/app-provider-placement.md`, checked against `e9aca3d5b03c91feb80903ccb6555ae98f2543ce`.

```text
role and provider flags -> shared Claude forecast and margin -> eligible provider -> ranked account -> start
                                             | no eligible account
                                             -> wait and retry
```

- Workers, reviewers, verifiers and mappers all use the same `settings.margin`; only leads and sub-leads are exempt. A reviewer can therefore be sent away from Claude even when a worker is the role Collin wants held back (`viewer/app/balancer.js:36-45`).
- Confirmed: unticking `save_claude_for_leads` does **not** disable the margin check. The check at `viewer/app/balancer.js:40` has no checkbox condition; the checkbox only moves Claude to the end of normal selection order at `viewer/app/balancer.js:43-46`. An explicit worker request for Claude can still fall back when below margin (`viewer/app/balancer.js:49-56`).
- The current store and API have one numeric margin, validated and defaulted per balancing key; the Usage panel drafts and saves it with the checkbox. Other-agent tier settings are a separate model-slot preference, not reserve thresholds (`viewer/app/settings.js:25-27,182-203`; `viewer/app/routes.js:176-179,235-240`; `viewer/pages/settings.js:192-205,1043-1047,1124-1134`).
- Lead and sub-lead provider-flag guidance assumes the existing preference, fallback and margin behavior (`protocol/app/lead.md:176-180`; `protocol/app/sub-lead.md:67-69`). Existing tests exercise worker margin and lead exemption, but the cited margin test does not set the checkbox false or compare other roles (`viewer/test/app-balancer.test.js:90-95`); the browser asserts the exact saved key list (`viewer/test/app-accounts.spec.js:225-235`).

## What I did not look at

Machine-side CLI launch and reading collection, account sign-in internals, unrelated settings panels, and tests outside the placement, usage, settings and provider-constraint paths.
