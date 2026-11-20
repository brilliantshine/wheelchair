# Map: usage readings and placement

Checked against: `dbdc97c540f8c9226a3d0762bdd6fe9b548b9ecf` (origin/main)
Files covered: `viewer/app/usage-poll.js`, `viewer/app/usage.js`, `viewer/app/hub.js`, `viewer/app/routes.js`, `viewer/app/providers.js`, `viewer/app/balancer.js`, `viewer/app/sessions.js`, `viewer/pages/settings.js`

```text
idle timer -> eligible account -> machine probe -> record -> retry waiting sessions
live event -------------------------------------> record -> retry waiting sessions
record -> forecast and rank -> Usage page and account choice
```

The hub starts polling after 30 seconds and then every minute, with one poll at a time (`viewer/app/hub.js:97-100`, `viewer/app/hub.js:184-186`). The poll selects only unpaused Claude/GPT accounts whose reading and last attempt are at least nine minutes old; it rechecks settings and excludes accounts with live sessions. It prefers the reachable signed-in hub machine, otherwise the first eligible machine by name. It posts the account, CLI and default/null or non-default account directory to `/v1/usage`; after a successful probe it rechecks account existence and live sessions, records with the probe start time, and retries waiting sessions. Failure retains the old reading (`viewer/app/usage-poll.js:7-45`).

`usage.json` stores the newest reading by account; an unexpired prior `limited_until` survives a newer reading without one (`viewer/app/usage.js:39-45`). Effective expired windows become zero. Forecast uses weighted active-account weekly usage and first future refill, and reports no `left` without a weekly reading; unread accounts still contribute capacity (`viewer/app/usage.js:10-17`, `viewer/app/usage.js:23-34`). Rank excludes paused, signed-out, limited and below-reserve accounts, then picks by weekly room/refill or last choice; a missing reading alone does not exclude an account (`viewer/app/usage.js:19-21`, `viewer/app/usage.js:78-97`). Machine sign-in status is cached for 15 seconds (`viewer/app/usage.js:48-76`).

Summary iterates all providers including Kimi, attaches rankings and raw account readings, and GET `/usage` returns the providers (`viewer/app/providers.js:3`, `viewer/app/usage.js:99-112`, `viewer/app/routes.js:95-98`). Settings refreshes immediately and every 30 seconds while Accounts or Usage is open; Usage shows “no reading yet” when active capacity exists but weekly `left` is null, and its expanded table shows five-hour and week usage/reset, with expired windows displayed as zero (`viewer/pages/settings.js:982-999`, `viewer/pages/settings.js:1303-1334`, `viewer/pages/settings.js:1359-1364`).

Placement uses forecast for held-back margin and rank for each provider; if none qualifies it waits until the earliest known blocking reset or one minute (`viewer/app/balancer.js:27-32`, `viewer/app/balancer.js:56-95`). A nonduplicate live event with a reading triggers `retryWaiting`; the minute timer also retries, in creation order (`viewer/app/hub.js:93`, `viewer/app/hub.js:174`, `viewer/app/sessions.js:846-857`). A future limit ends the turn, records and sets `limited_until`; on expiry the minute sweep clears it and queues Continue (`viewer/app/sessions.js:571-589`, `viewer/app/sessions.js:859-867`).

Not looked at: browser styling, notification UI outside Usage, and individual test cases.
