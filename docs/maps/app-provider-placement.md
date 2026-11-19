# Map: app provider placement

Checked against: `f3d3409471d4949874004f629b4c989cd15de0e4` (origin/main)
Files covered: `viewer/app/balancer.js`, `viewer/app/usage.js`, `viewer/app/providers.js`, `viewer/app/sessions.js`, `viewer/app/hub.js`, `viewer/app/settings.js`, `viewer/test/app-balancer.test.js`, `viewer/test/app-usage.test.js`.

```text
settings + model slots + machine account status + usage
  -> provider order -> rank accounts -> start session
                                   -> no room -> wait and retry
```

The provider registry maps provider IDs to CLI names and capabilities (`viewer/app/providers.js:3`). Defaults create an account per provider and order workers GPT, Claude, Gemini; normalization adds unseen providers (`viewer/app/settings.js:37,207-213`). Placement resolves role order and review-family policy, tests model availability and signed-in accounts, then ranks eligible accounts using usage and reserve rules (`viewer/app/balancer.js:27-81`; `viewer/app/usage.js:67-85`). If none qualifies, placement computes a waiting time (`viewer/app/balancer.js:82-95`); sessions retain a waiting start for retry (`viewer/app/sessions.js:129-139`). A single-family reviewer policy falls back if that family is unavailable (`viewer/app/balancer.js:38-46,79-80`). Gemini placement and reviewer selection have fixtures (`viewer/test/app-balancer.test.js:62-70`).

## What I did not look at

Live CLI behavior, full browser interactions, and unrelated hub state and tests.
