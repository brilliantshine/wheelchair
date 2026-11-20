---
slug: kimi-usage
date: 2026-11-19
implemented-by: "codex standard / gpt-6.1-terra (T1 machine, T2 hub); sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: claude / claude-opus-5-5 (top)
    checks: codex standard / gpt-6.1-terra
---

# Completion Report — Kimi Code weekly usage on Settings → Usage

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Adapter 1: `loginStatus` must be `logged_in`, else `Kimi Code is not signed in`, no network | this run | `machine/adapters/kimi.js:63` | `machine/test/service.test.js:1832` (not signed in, China region, zero requests) |
| Adapter 2: read `credentials/<name>.json`, `access_token` string, `expires_at` number, else `Kimi Code's login can't be read` | this run | `machine/adapters/kimi.js:64-71` | `machine/test/kimi.test.js:510` |
| Adapter 3: expiry within 30 s → fixed error, no request | this run | `machine/adapters/kimi.js:72` | `machine/test/kimi.test.js:510`, `machine/test/service.test.js:1832` (zero requests) |
| Adapter 4: one GET to fixed URL, Bearer + Accept, `redirect: 'error'`, timeout `min(timeout, 10000)` covering body read | this run | `machine/adapters/kimi.js:61`, `:73-83` | `machine/test/kimi.test.js:510` (header), `machine/test/service.test.js:1832` (302 → 502, one request) |
| Adapter 5: fixed error strings; no token/body/headers in errors | this run | `machine/adapters/kimi.js:78-86` | `machine/test/service.test.js:1832` (401 no token; non-JSON body with secret) |
| Adapter 6: parse `limit_7d`→week, `limit_5h`→five_hour; ratio number or numeric string ×100 clamped ≤100; parseable `reset_time` → ISO; null windows; `no usage windows` | this run | `machine/adapters/kimi.js:87-96` | `machine/test/kimi.test.js:510` (string ratio, clamp, week null, no windows) |
| Adapter 7: return shape with `reached` when any window ≥100 | this run | `machine/adapters/kimi.js:97` | `machine/test/kimi.test.js:510`; `limited_until` on route reading `machine/test/service.test.js:1832` |
| Adapter 8: token only in a local variable | this run | `machine/adapters/kimi.js:64-77` | `machine/test/service.test.js:1832` (401 response and error contain no token) |
| Credential files untouched: bytes, mtimes and recursive entry list unchanged (success, expired, HTTP error) | this run | (read-only code) | `machine/test/kimi.test.js:510` wrapper around every probe |
| Route: accept `kimi`; `kimiUsageUrl` override only for kimi; `agy` still 400; reading/`limited_until`/502 unchanged | this run | `machine/service.js:1912`, `:1916` | `machine/test/service.test.js:1832` |
| `machine/API.md` `POST /v1/usage` paragraph | this run | `machine/API.md:94` | read |
| Poller: kimi candidates | this run | `viewer/app/usage-poll.js:17`, `:26` | `viewer/test/app-usage.test.js:359` (cli `kimi`, dir null / `~/.wheelchair/accounts/<id>`, stored in usage.json) |
| Poller: no live-session skip for kimi, pre- and post-call; Claude/GPT keep skips | this run | `viewer/app/usage-poll.js:26`, `:42` | `viewer/test/app-usage.test.js:377` (live kimi polled and stored), `:414` (live claude not called) |
| Poller: kimi tries eligible machines hub-first then by name until one reads; Claude/GPT single machine | this run | `viewer/app/usage-poll.js:29-47` | `viewer/test/app-usage.test.js:390` (first 502, read from second, stored machine second) |
| Poller: all fail → previous reading kept; attempt time gates retry | this run | `viewer/app/usage-poll.js:34`, `:46` | existing `viewer/test/app-usage.test.js` "idle poll keeps stored usage on failure and throttles retries" |
| Hub and page: no change to usage.js, balancer.js, sessions.js, settings page | this run (no change) | `git diff 34226f4a -- viewer/app` touches only `usage-poll.js` | diff |
| Non-goal: Kimi limit-hit behaviour untouched | this run (no change) | no diff in limit-hit handling | diff |

## Deviations from plan

- `usageProbe` takes an optional `url` in its options (`machine/adapters/kimi.js:62`), defaulting to the constant. The sub-lead's brief asked for it; the only caller that passes it is the route, from the constructor option `kimiUsageUrl` (`machine/service.js:1916`), never config.toml or the environment. Matches the Spec's intent ("tests override it through a machine-service option").
- Worker choices beyond the Spec are listed in PLAN.md's Log (blank/non-finite values rejected; record failure moves on to the next machine).

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

Run by the sub-lead on the merged feature branch (d00e6807):

```
$ bash machine/test/run.sh
# tests 446
# pass 446
# fail 0

$ node --test viewer/test/*.test.js
# tests 706
# pass 706
# fail 0
```

An earlier full viewer run on the same tip had 1 failure, `viewer/test/server.test.js` "the global write lock serializes concurrent writes and retry retains both changes" (a file this build did not touch). That file then passed 50/50 three times in a row, and the full suite re-run above passed.

## Known gaps / residual risks

- Machines are tried one after another for Kimi; a hung machine delays that poll by up to 35 s per machine (the hub call timeout). The poll is single-flight, so this only delays readings.
- Accepted Risk in PLAN.md (pending poll on a dropped connection) still applies.

## Remediation rounds
