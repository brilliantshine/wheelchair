# Map: harness install cancellation, deadline and failures

The current end-to-end map is [harness installation runtime](../../maps/onboarding-runtime.md), checked against `c9c6451819f00556a5d875d42f6a8e462f3eb22a`; its covered files match this worktree.

```text
Settings Install -> hub POST -> detached machine job -> recipe, setup, validation -> result
       -> GET polling -> running output / failed output / refreshed status
```

- D1 crosses both GET/POST-only route gates and the running row. The job is detached and runs synchronous subprocesses; the PID file stores its leader, while the service uses signal 0 only for liveness (`viewer/app/routes.js:97-102`; `machine/service.js:2066-2073`; `machine/lib/harness-install.js:14-18,23-44,56-72`; `viewer/pages/settings.js:1750-1764`). Stopping polling or switching a harness off does not stop the job (`viewer/pages/settings.js:1619-1627,1725-1728`).
- D2 must cover the detached job across service restarts: a service restart leaves it running, and the job itself runs the recipe and validation without a timeout (`machine/lib/harness-install.js:30-32,36-39,42-77`; `machine/test/harness-install.test.js:31-34`). If killed before writing a result, GET currently reports only the generic stopped message; a live PID overrides a result (`machine/lib/harness-install.js:15-21`).
- D3 has raw combined stdout/stderr in a 40-line tail, with exit code and state but no separate explanation (`machine/lib/harness-install.js:15-21,27-30,75-77`). The UI stores only `state` and `tail` and renders the tail in a `pre` (`viewer/pages/settings.js:1692-1698,1756-1764`). Script downloads and npm recipes produce different failure output (`machine/lib/harness-recipes.js:3-14`), so classification must account for what is actually available.
- Existing test seams and commands are in the shared map; the browser tests stub routes, while the machine test exercises a detached job and restart (`machine/test/harness-install.test.js:13-39`; `viewer/test/app-harnesses.spec.js:3-5,50-57`). The earlier plan explicitly deferred these three items and accepted a rare outage-after-failure display issue and a response-body drop race (`docs/plans/easy-onboarding/PLAN.md:420-425,437-443`).

## What I did not look at

Real installer error output, processes that escape the job's process group, platform-specific signal behavior, and unrelated onboarding or placement behavior.
