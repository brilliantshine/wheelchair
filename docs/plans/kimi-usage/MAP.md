# Map: Kimi weekly usage

```text
Kimi account config and credentials -> usage probe -> account reading
                                                -> weekly forecast -> Settings Usage
                                                -> account rank -> waiting sessions
```

Today Kimi appears in provider summaries but idle polling and the machine probe route both allow only Claude/GPT; the Kimi adapter has no probe and returns no live usage reading (`viewer/app/providers.js:3`, `viewer/app/usage-poll.js:17-26`, `machine/service.js:1907-1916`, `machine/adapters/kimi.js:120-146`). The shared reader expects `week: { used, resets_at }` in percentage units, and optionally `five_hour`; the same reading changes forecast, selection and retry behavior, not just the display (`viewer/app/usage.js:19-34`, `viewer/app/usage.js:78-110`, `viewer/app/balancer.js:58-63`, `viewer/app/usage-poll.js:39-45`). Settings shows “no reading yet” until an active account has a weekly reading (`viewer/pages/settings.js:1303-1307`, `viewer/app/usage.js:23-32`). See `docs/maps/usage-readings.md` and `docs/maps/machine-usage-kimi.md` for the full flows and account discovery.

## External facts supplied by the lead

Kimi CLI 2.6.3 fetches `GET <base_url>/usages`, with `base_url` from `config.toml` (for example `https://api.kimi.ai/coding/v1` or `https://api.kimi.com/coding/v1`) and `Authorization: Bearer <access_token>`. The response `usages` contains `limit_5h`, `limit_7d`, `limit_month_total`, and `limit_month_code`, each with `used_ratio` and `reset_time`. Access tokens are in `~/.kimi-code/credentials/<oauth key basename>.json`, with `expires_at` and `expires_in` 900 seconds. Refresh uses `POST <oauth_host>/api/oauth/token` with `grant_type=refresh_token`, rotates the refresh token, and the CLI guards refresh with a lock; `~/.kimi-code/locks` exists.

A cheap inspection of strings in the installed `/home/collin/.kimi-code/bin/kimi` found a bundled OAuth manager describing `proper-lockfile`: it creates a sentinel at `{configDir}/oauth/{providerName}` and a directory `{configDir}/oauth/{providerName}.lock`; it disables that lock on Windows, with no config directory, or with `KIMI_DISABLE_OAUTH_LOCK=1`. This does not establish that this particular bundled manager is the one used by Kimi Code's credential refresh or how its `configDir` relates to `~/.kimi-code/locks`; verify before relying on it.

Not looked at: Kimi endpoints, credential values, a running Kimi CLI, or the full bundled CLI implementation.
