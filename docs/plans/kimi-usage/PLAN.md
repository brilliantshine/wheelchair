---
slug: kimi-usage
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Kimi Code weekly usage on Settings → Usage

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md`, `docs/maps/usage-readings.md`, `docs/maps/machine-usage-kimi.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Chosen by the user | user |
| 2 | Show Kimi's `limit_7d` as the week and `limit_5h` as the five-hour window, in the reading shape Claude/GPT already use (`week: {used, resets_at}`, `five_hour`), `used` = `used_ratio` × 100 | Reuses the existing reader, forecast and rank unchanged (usage.js:19-34) | defaulted |
| 3 | The reading is fetched by the machine service (which already knows each Kimi account's home, config and credential file), through the existing hub → machine `/v1/usage` route, extended to `kimi` | Keeps credentials on the machine; hub never sees a token | defaulted |
| 4 | Kimi readings are allowed while a Kimi session on that account is live (unlike Claude/GPT) | A Kimi reading is one web request and spawns nothing; a live session is when the token is surely fresh | defaulted |
| 5 | Poll interval stays the shared nine minutes | Same freshness as the other providers; under the 15-minute token life | defaulted |
| 6 | Read-only: wheelchair never renews, writes or locks Kimi's login; it reads usage only while the stored access token is unexpired, and otherwise skips without any network request | Zero sign-out risk; Kimi usage only moves while Kimi runs, which keeps the token fresh. Cost: use of the same account on another computer is not seen until Kimi runs here again | user |
| 7 | The usage URL is fixed at `https://api.kimi.ai/coding/v1/usages`; `base_url` in config.toml and `KIMI_CODE_BASE_URL` are ignored, and only accounts whose `loginStatus` is `logged_in: true` (global region) are read | The token is only ever sent to Kimi's own global host, never to an address taken from a file or env var; wheelchair already refuses China-region logins | defaulted |
| 8 | A window at `used_ratio >= 1` marks the reading `reached`, so the machine sets `limited_until` the same way it does for Codex | Reuses `limitedUntil` (machine/lib/limits.js); lets waiting sessions skip a spent Kimi account before it hits the limit | defaulted |
| 10 | On a Kimi limit hit the machine reads usage once, so the stopped session resumes at Kimi's real reset | Review round 1: otherwise it retries hourly; the key is surely fresh at that moment | review-round-1 |
| 11 | For Kimi, the poller tries each eligible machine until one reads | Review round 1: the same account may be signed in on several machines; only the one that ran Kimi lately has a fresh key | review-round-1 |
| 9 | Monthly limits and the top-up balance in the response are ignored | IDEA.md Not doing | defaulted |

## Spec

### Behaviour in one paragraph

Every Kimi account (default `~/.kimi-code` or `~/.wheelchair/accounts/<id>`) gets a weekly
and five-hour reading on Settings → Usage, through the same idle poller, `/v1/usage` machine
route, `usage.json` store, forecast, rank and retry that Claude and GPT use. The machine
gets the reading with one HTTPS GET to Kimi's usage service using the access token already
in Kimi's credential file. It never starts the Kimi CLI, never renews, writes or locks any
Kimi file, and never makes a request when the token has expired. Nothing about Claude, GPT
or Antigravity changes.

### Machine: `kimi` adapter `usageProbe(dir, { timeout })` (`machine/adapters/kimi.js`)

1. `loginStatus(dir)` must return `logged_in: true`; otherwise throw `Kimi Code is not
   signed in` (no network). This already requires the global host `auth.kimi.ai` and an
   oauth `key` of the form `oauth/<name>`.
2. Read `<home(dir)>/credentials/<name>.json` (`<name>` = key without `oauth/`). Use only
   `access_token` (non-empty string) and `expires_at` (Unix seconds, number). Missing,
   unparseable or wrong-typed → throw `Kimi Code's login can't be read`.
3. If `expires_at * 1000 <= Date.now() + 30_000`, throw `Kimi Code's login key has expired;
   it renews the next time Kimi Code runs` with no network request.
4. `GET https://api.kimi.ai/coding/v1/usages` with headers `Authorization: Bearer <token>`
   and `Accept: application/json`, using Node's global `fetch` with `redirect: 'error'` (exactly one request; a 3xx
   is a failure) and an abort timeout of `min(timeout, 10000)` ms. The URL comes only from the adapter constant; tests override it
   through a machine-service option (below), never through config.toml or the environment.
5. A non-2xx status → throw `Kimi usage request failed (HTTP <status>)`; a timeout,
   redirect or network error → throw `Kimi usage request failed`; a body that is not JSON
   or has no `usages` object → throw `invalid usage response`. Every thrown message is one
   of the fixed strings in this section (plus the status number); never wrap or forward an
   underlying error's message. Error text never contains the token,
   the response body or headers.
6. Parse the JSON body's `usages` object: `limit_7d` → `week`, `limit_5h` → `five_hour`.
   Each entry `{used_ratio, reset_time}`: `used_ratio` is a number or numeric string;
   `used = used_ratio * 100` (not clamped below; clamp to at most 100). `reset_time` must be
   a non-empty string parseable by `Date.parse`, giving `resets_at` as an ISO string. An
   entry that is missing, has a non-numeric `used_ratio` or has no parseable `reset_time`
   gives `null` for that window (a window with no reset could never age out of a reading). If both
   are `null`, throw `no usage windows`. Ignore every other field.
7. Return `{ five_hour, week, ...(any window used >= 100 ? { reached: true } : {}) }`, the
   same shape Codex's probe returns (`machine/adapters/codex.js:11-20`).
8. The token is held only in a local variable for the request. It is never logged, put in
   an error, a reading, a response, a state file or a test snapshot.

### Machine: `/v1/usage` route (`machine/service.js:1907-1921`)

- Accept `cli: 'kimi'` alongside `claude` and `codex`; the account and directory checks are
  unchanged (`default-kimi` with `dir: null`, or `~/.wheelchair/accounts/<id>`).
- Pass the probe a test-only URL override from `this.options.kimiUsageUrl` when set (the
  service tests set it to a local fake server); in production the option is unset.
- Reading construction, `reached` → `limited_until`, 200 and 502 handling stay as they are.
- `agy` stays refused with 400.

### Machine: Kimi limit hit (`machine/service.js` `hook`, around line 1379)

When a `limit-hit` event arrives for a session whose `cli` is `kimi`, the machine first
calls the kimi `usageProbe` for that session's account home (the same `dir` the session
runs with: `null` for `default-kimi`, else `~/.wheelchair/accounts/<id>` expanded), with a
10-second timeout. The key is fresh at that moment because the session has just run. On
success it builds the reading as the `/v1/usage` route does (account, `at`, windows,
`limited_until` from `limitedUntil(reading)` when `reached`), stores it as the session's
`last_reading`, and puts it on the forwarded event as `reading`, so the hub records it.
The event's `limited_until` is then `limitedUntil(reading)` computed from that fresh
reading even when no window is reached (`machine/lib/limits.js`: earliest future reset
among windows ≥ 95%, else the earliest future reset). On any probe failure it falls back
to today's `limitedUntil(current.last_reading)` (one hour). Claude, Codex and Antigravity
limit hits are unchanged. Effect: a running Kimi session stopped by its limit resumes at
Kimi's real reset time instead of retrying every hour.

### Hub: idle poller (`viewer/app/usage-poll.js`)

- Candidates include `kimi` accounts alongside `claude` and `gpt` (same unpaused,
  nine-minute reading and attempt rules, CLI from `PROVIDERS.kimi.cli` = `kimi`).
- Machine choice for `kimi`: the same eligible list and order as today (the hub machine
  first if eligible, then the rest by name), but on a failed probe try the next eligible
  machine, stopping at the first reading. The same Kimi account can be signed in on more
  than one machine, and only the one where Kimi ran lately has a fresh key; a failed Kimi
  probe with an expired key costs no network request. Claude and GPT keep today's single
  machine choice.
- For `kimi` accounts only, a live session on the account does **not** skip the poll, in
  either the pre-call or post-call check. Claude and GPT keep today's live-session skips.
- When every eligible machine fails (502, including the expired-key case), the previous
  reading stays as it is, as today; the attempt time still gates the next try to nine minutes.

### Hub and page

No change to `viewer/app/usage.js`, `balancer.js`, `sessions.js` or `viewer/pages/settings.js`.
They already handle this reading shape for every provider without a provider check (Kimi is
special-cased only for CLI problems, `viewer/app/usage.js:62-69`), so a Kimi reading flows
into the page, forecast and rank as is. Do not add Kimi-specific display.

### Edge cases

- Kimi idle more than ~15 minutes: no request, previous reading kept; reset times passing
  still show as zero through `effective()` (unchanged).
- Never read an account: page keeps "no reading yet" until Kimi runs on it.
- Signed out or China region: no request; "no reading yet" or the old reading.
- Kimi's service returns 401/403/5xx or times out: old reading kept, retried after nine
  minutes.
- Response missing `limit_7d` but with `limit_5h`: recorded with `week: null`; page treats it
  like any reading without a week.

### Non-goals

Renewing tokens; Kimi monthly limits or top-up balance; usage for Antigravity; any change to
Claude/GPT behaviour or to how the page looks.

### Validation

- New machine tests in `machine/test/kimi.test.js` (adapter) and `machine/test/service.test.js`
  (route), using a temp Kimi home with `config.toml` and a credential file and a local HTTP
  fake for the usage URL, covering: a good response → week/five_hour in percent with ISO
  resets; `used_ratio` as string; `used_ratio >= 1` → `limited_until` set on the reading; an
  expired `expires_at` → 502 and the fake received **no** request; not signed in / China
  region → 502, no request; fake returns 401 → 502 and the error text and response contain
  no token; the request carried `Authorization: Bearer <token>`; `agy` still 400.
- Machine test for the limit hit: a kimi session's `limit-hit` with the fake usage server
  returning a 100% week resetting at time T forwards `limited_until` = T and a `reading`; with
  the fake returning 500 it forwards the one-hour fallback. A malformed 2xx body containing a
  dummy secret string gives a 502 whose error text does not contain that string. A 302 from
  the fake gives a 502 and the fake sees exactly one request.
- New hub tests in `viewer/test/app-usage.test.js`: an idle `kimi` account is polled with
  `cli: 'kimi'` and its reading is stored in `usage.json`; a `kimi` account with a live
  session is still polled **and its reading is stored**; a `kimi` account signed in on two
  machines whose first machine fails is read from the second; a `claude` account with a live
  session is still skipped.
- A grep check that no Kimi credential path or token is written by the change:
  `git diff main -- machine viewer | grep -nE 'writeFile|atomicWrite' ` shows nothing new in
  `machine/adapters/kimi.js`.
- Commands, all must pass:
  - `bash machine/test/run.sh`
  - `node --test viewer/test/*.test.js`

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-19

**Lanes:** claude / claude-opus-5-5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics (gpt) | blocking | Poller always picks the same machine; a stale key there blocks readings although another machine running Kimi has a fresh one | downgraded (major) | Real but the rest works; Spec now tries each eligible machine for Kimi until one reads |
| mechanics (gpt) | blocking | A 100% window with no reset never ages out of a reading and blocks placement | downgraded (minor) | Kimi always sends `reset_time` per its CLI parser; still, windows without a parseable reset are now dropped |
| mechanics (gpt) | major | A running Kimi session stopped by its limit still waits the one-hour fallback; poll readings never reach its `last_reading` | upheld | New Spec section: on a Kimi limit hit the machine probes usage once and uses the real reset |
| mechanics (gpt) | minor | Redirects not specified; fetch follows them | upheld | `redirect: 'error'` |
| mechanics (gpt) | minor | Check once built: a parse error could quote the response body into the forwarded error | upheld | Fixed error strings only, plus a malformed-body test |
| mechanics (gpt) | minor | Live-Kimi poll test should assert the reading is stored | upheld | Test now asserts storage |
| intent (claude) | minor | "Hub and page" asks the worker to hunt for a Kimi special case that doesn't exist | upheld | Section now says plainly nothing changes there, with evidence |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
