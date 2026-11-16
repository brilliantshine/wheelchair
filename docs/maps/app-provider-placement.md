# Map: app provider placement

Checked against: `20074341b6b1be157c09f8d248d3965645feece9` (origin/main)
Files covered: `viewer/app/balancer.js`, `viewer/app/usage.js`, `viewer/app/providers.js`, `viewer/app/sessions.js`, `viewer/app/hub.js`, `viewer/app/settings.js`, `viewer/test/app-balancer.test.js`, `viewer/test/app-usage.test.js`.

```text
settings + machine login status + account readings + live sessions
  -> choose provider and ranked account -> start session
                                    -> no room -> wait -> retry
```

A start calls `choose`, which loads settings, readings, machine account status, last selection and all threads; it checks model slots and orders providers by role and settings (`viewer/app/sessions.js:119-128`; `viewer/app/balancer.js:27-63`). It ranks accounts signed in on the target machine; paused accounts, a future limit, and either window at or above `100 - leave` are excluded. Missing windows do not exclude an account (`viewer/app/usage.js:19-22,67-85`). Machine status is cached for 15 seconds and an unreachable machine has no signed-in accounts (`viewer/app/usage.js:48-65`).

Ranking chooses soonest weekly reset, weighted weekly room, or last chosen; spread uses live-session count to break equal-room ties (`viewer/app/usage.js:79-85`). The reserve margin uses the weighted weekly forecast of unpaused accounts, including missing readings as zero usage; no weekly reading means no forecast of remaining capacity (`viewer/app/usage.js:23-37`; `viewer/app/balancer.js:60-67`). The chosen account is saved on the session and sent to the machine (`viewer/app/sessions.js:166-167,190-202`).

If none qualifies, `choose` estimates a wait from limits and exhausted windows or defaults to one minute (`viewer/app/balancer.js:81-95`). The hub keeps a live waiting session and its request, then retries it in creation order under thread locks, on startup, each minute, and after a nonduplicate reading event (`viewer/app/sessions.js:129-139,603-610`; `viewer/app/hub.js:64-68,121`). Waiting sessions are live but have no selected account until promoted (`viewer/app/sessions.js:129-135,190-194`).

The tests exercise ranking, forecasts, boundaries, waiting and reading-triggered promotion (`viewer/test/app-usage.test.js:25-49,97-141`; `viewer/test/app-balancer.test.js:35-62,109-115,131-184`).

## What I did not look at

The full provider constraint matrix, page presentation, and unrelated settings and tests. Earlier overlapping maps changed since their checked commits and were not used as current evidence.
