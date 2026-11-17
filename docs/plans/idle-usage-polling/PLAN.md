---
slug: idle-usage-polling
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-16
---

# Check usage on accounts no agent is using

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

**Map:** `MAP.md` (checked against `2007434`; `origin/main` was merged in at `969471c`
before planning, bringing the Antigravity/Gemini provider).

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | app-accounts D9 rejected polling undocumented usage endpoints | Whether this feature reverses it | yes (thread) | Settled by D1: no HTTP endpoint is called; both reads go through the provider's own CLI, which spends no quota |
| W2 | Claude OAuth access tokens last ~8 h; an idle account's token expires | Whether polling keeps working on an account idle for days | no | Settled by D1: the CLI refreshes its own login on start; the hub never touches credentials |
| W3 | MAP.md says current `hasRoom` contradicts D9 ("no reading = full") | Check | no | Waved off: D9's "full" means full room, which `hasRoom` matches (`viewer/app/usage.js:19-22`) |
| W4 | main added a third provider, `gemini` (`machine/adapters/agy.js`), with no usage source (`usageFrom() { return null; }`) | Whether to poll it | no | Not polled (IDEA "Not doing"), D8 |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Read idle usage through each provider's own CLI, never a raw HTTP endpoint. Claude: `claude -p /usage --output-format json`. Codex: `codex app-server`, JSON-RPC `initialize` then `account/rateLimits/read`. Both checked by hand on 2026-11-16: neither sends a model turn (Claude reported `num_turns: 0`, `duration_api_ms: 0`, cost 0), so no quota is spent and no limit window is started (IDEA constraint 1) | Supported CLI surfaces, the CLI handles its own login refresh (W2), and app-accounts D9's objection to undocumented endpoints does not apply | defaulted |
| D2 | Poll every 10 minutes from a hub timer; one account at a time | Idle numbers move slowly; one `claude`/`codex` process at a time keeps the machine quiet. Good enough to meet "never more than one interval old" | defaulted |
| D3 | An account is polled when: its provider is `claude` or `gpt`; it is not paused; no session in any thread has `live && account === id` (the same test the balancer uses, `viewer/app/balancer.js:60`); and it is signed in on at least one reachable machine. The poll runs on the hub's own machine if it is signed in there, otherwise the first such machine by name | Matches "not being used by agents"; one machine per account because usage is per account, not per machine | defaulted |
| D4 | The hub records a poll reading only if the account still has no live session at record time; `usage.record()`'s newer-`at`-wins rule is unchanged | A live session's numbers stay the source while it runs (IDEA constraint 2) | defaulted |
| D5 | A failed poll changes nothing stored, posts no card, and is tried again next interval | A stale reading is the status quo; noise on every failure would be worse | defaulted |
| D6 | No change to the Usage page; its existing "as of" time shows how fresh each reading is | IDEA "What good looks like" is met by the numbers themselves | defaulted |
| D7 | After a poll records any reading, run `sessions.retryWaiting(hub)` once (as `hub.event()` does for a reading) | A refilled idle account should release waiting starts without waiting for the minute timer | defaulted |
| D8 | `gemini` accounts are not polled | No usage source exists for that CLI (W4) | defaulted |

## Spec

### Behavior

Every 10 minutes (and once 30 s after the hub starts) the hub polls each eligible account
(D3), one at a time, and stores what it reads as that account's usage reading, exactly as
if a live session had sent it. The balancer, forecast and Usage page then use it with no
change of their own.

### Machine: `POST /v1/usage`

New hub-authorized route in `machine/service.js` (beside `/v1/preflight`), documented in
`machine/API.md`.

- Body `{ account, cli, dir }`: `cli` is `claude` or `codex`; `dir` follows the same rules
  as `/v1/logins` (`accountDir(dir, account)`; `null` for `default-<provider>`). Anything
  else → 400.
- Runs the adapter's new `usageProbe(dir)` **asynchronously** (child process, not the
  `spawnSync` helpers), so `/v1/status`, hooks and other sessions keep being answered
  (`machine/service.js:76`). Timeout 30 s; kill the child on timeout.
- Child environment: `process.env` plus `adapter.loginEnv(dir)`; working directory the
  machine state dir. Nothing from the credentials is read by the service or returned.
- 200 `{ reading }` where `reading` is `{ account, at, five_hour, week, plan_type?,
  limited_until? }` in the existing reading shape (`machine/API.md` "Usage events"),
  `at` = the time the probe finished. 502 `{ error }` on timeout, non-zero exit, or output
  it cannot parse.

### Claude probe (`machine/adapters/claude.js`)

Command: `claude -p /usage --output-format json --no-session-persistence
--strict-mcp-config`. Parse the JSON; require `num_turns === 0`, otherwise fail (a
changed CLI that turned `/usage` into a prompt must never be repeated every 10 minutes).
From `result` text:

- `Current session: <N>% used · resets <Mon> <D>, <h:mm><am|pm> (<IANA zone>)` → `five_hour`.
- `Current week (all models): <N>% used · resets …` → `week`.
- Other lines (per-model weeks, the "contributing" breakdown) are ignored.
- A line without a `resets` part gives `resets_at: null`. Reset times are converted from
  the named zone to an ISO UTC string (use `Intl.DateTimeFormat` with `timeZone` to find
  the offset); the year is the one that puts the reset nearest after now, within 8 days.
- Neither window found → fail. `N` at or above 100 for either window sets `reached`, so
  the machine fills `limited_until` with `limitedUntil(reading)` (`machine/lib/limits.js`),
  as the turn-ended path does (`machine/service.js:803-807`).

Sample output to use as a fixture (captured 2026-11-16):
`Current session: 42% used · resets Nov 16, 6:59pm (America/Los_Angeles)` /
`Current week (all models): 52% used · resets Nov 21, 2:59am (America/Los_Angeles)`.

### Codex probe (`machine/adapters/codex.js`)

Command: `codex app-server`. Write to stdin, one JSON line each:
`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"wheelchair","version":"1"}}}`,
`{"jsonrpc":"2.0","method":"initialized"}`,
`{"jsonrpc":"2.0","id":2,"method":"account/rateLimits/read"}`. Read stdout lines until the
response with `id: 2`, then end stdin and kill the child. Ignore notifications. Map
`result.rateLimits`: for each of `primary` and `secondary`, `windowDurationMins` 300 →
`five_hour`, 10080 → `week`, as `{ used: usedPercent, resets_at: ISO(resetsAt seconds) }`;
`planType` → `plan_type`; `rateLimitReachedType` non-null → `reached`. An `error` response
or no window → fail.

### Hub: `viewer/app/usage-poll.js` (new)

- `pollIdle(hub)`: load settings, threads, `usage.machineAccounts(hub)`, `hub.machines()`.
  Pick eligible accounts (D3). For each, in settings order: `hub.call(machine,
  '/v1/usage', 'POST', { account: id, cli, dir }, 35000)` where `cli` comes from
  `PROVIDERS[provider].cli` and `dir` is `null` for `default-<provider>` and
  `~/.wheelchair/accounts/<id>` otherwise (as `viewer/app/sessions.js:190-202` builds it).
  On 200, re-load threads; if the account now has a live session skip it (D4); else
  `usage.record(hub, { ...reading, machine })`. On error, skip (D5). If anything was
  recorded, `await sessions.retryWaiting(hub)` once at the end (D7).
- One run at a time: `hub.pollIdle()` keeps a single in-flight promise, like
  `hub.pollDead()` (`viewer/app/hub.js:126-129`).
- `viewer/app/hub.js`: `this.usageTimer = setInterval(() => this.pollIdle().catch(() =>
  {}), this.usagePollInterval ?? 600_000)`, `unref()`'d, plus one `setTimeout` of 30 s
  (also `unref()`'d) after start. Cleared wherever the other timers are cleared.
  `usagePollInterval` is a constructor option so tests can shorten it.

### Boundaries and edge cases

- Paused, signed-out, `gemini`, or in-use accounts: never probed.
- Machine unreachable: its accounts count as not signed in there (`machineAccounts`
  already reports `reachable: false`).
- An account becomes in use during a probe: the reading is dropped (D4).
- A live reading newer than the poll's `at` is kept by `record()`'s rule.
- An account removed from settings during a run: its result is dropped (check it is
  still in settings before recording).
- Old machine service without `/v1/usage` (404): treated as a failure (D5).

### Non-goals

Ranking or choice changes; Usage page changes; touching or refreshing any credentials;
polling `gemini`; per-model weekly windows.

### Validation

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

Tests to add:

- `machine/test/accounts.test.js`: Claude parser on the sample above (correct UTC times
  for `America/Los_Angeles`, year rollover near 31 Dec, missing `resets`, ≥100% →
  `reached`, `num_turns: 1` → fail, no windows → fail); Codex mapper on a
  `account/rateLimits/read` result with only a weekly primary, with both windows, with
  `rateLimitReachedType` set, and with an `error` response.
- `machine/test/service.test.js`: `/v1/usage` with shim `claude` and `codex` executables on
  `PATH` (200 with a reading; timeout → 502 and child killed; bad `cli` → 400; hub auth
  required).
- `viewer/test/app-usage.test.js` (fake machine `/v1/usage` route in
  `viewer/test/helpers/app-machine.js`): only eligible accounts probed (paused,
  signed-out, live-session and `gemini` skipped); reading recorded with its machine;
  account gone live mid-probe → not recorded; 502 → stored reading unchanged; a waiting
  start promoted after a poll frees room; overlapping `pollIdle` calls run once.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| The Claude `/usage` text format and `codex app-server` (marked experimental) can change with a CLI update | Both fail closed (D5, and the `num_turns` guard); the cost of a break is today's behavior | planning |

## Review Rounds

### Round 1 — 2026-11-16

**Lanes:** intent — gpt; mechanics — gpt (Claude unavailable at start); cross-family: no.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

None.

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-16: merged `origin/main` (`969471c`) before planning.
- 2026-11-16: probed by hand on hearth. `claude -p /usage --output-format json` (2.1.326):
  `num_turns 0`, cost 0, text as in the Spec. `codex app-server` (0.169.0)
  `account/rateLimits/read`: `primary {usedPercent 72, windowDurationMins 10080, resetsAt
  <epoch s>}`, `secondary null`, `planType "prolite"`.
