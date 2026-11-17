---
slug: idle-usage-polling
date: 2026-11-16
implemented-by: "standard (gpt-6.1-terra) for T1 and T2; sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Check usage on accounts no agent is using

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `POST /v1/usage`, hub-authorized, beside `/v1/preflight`; body `{account, cli, dir}`; 400 otherwise; `dir` via `accountDir(dir, account)` | this run | `machine/service.js:1070-1085` | `machine/test/service.test.js:1170` (401 without hub auth, 400 for `cli: agy`, 400 for a non-default account with `dir: null`) |
| Probe runs asynchronously (spawn), 30 s timeout kills the child; `/v1/status` keeps answering | this run | `machine/lib/usage-probe.js:4-39` (SIGKILL at `:8`); timeout option `machine/service.js:1079` | `machine/test/service.test.js:1190` (status 200 while probe pending; 502; child pid gone) |
| Child env `process.env` + `loginEnv(dir)`; cwd machine state dir; no credentials read | this run | `machine/adapters/claude.js:46`, `machine/adapters/codex.js:23`, cwd `machine/service.js:1079` | code reading; no file read in the route |
| 200 `{reading}` in the existing shape, `at` = finish time; `limited_until` via `limitedUntil()` when reached; 502 on timeout / non-zero exit / bad output | this run | `machine/service.js:1078-1084` | `machine/test/service.test.js:1170` (100% → `limited_until` set), `:1190` (502) |
| Claude command: `-p /usage --output-format json --no-session-persistence --strict-mcp-config --setting-sources "" --settings {env.ANTHROPIC_BASE_URL=closed port}`, plus `ANTHROPIC_BASE_URL` in env (D9, D14) | this run | `machine/adapters/claude.js:8,46` | `machine/test/service.test.js:1170` (shim records env and argv; asserts env value, `--setting-sources` followed by `''`, and the `--settings` JSON) |
| Claude parse: `num_turns === 0` required; `Current session` → five_hour, `Current week (all models)` → week; others ignored; minutes optional; missing `resets` → null; zone→UTC via `Intl.DateTimeFormat`; nearest year within 8 days; no window → fail; ≥100 → reached | this run | `machine/adapters/claude.js:9-43` | `machine/test/accounts.test.js:133` (Spec sample → `2026-11-17T02:59Z` / `2026-11-21T10:59Z`; `Jan 1, 7pm` from 31 Dec → `2027-01-02T03:00Z`; no `resets` → null; 100% → reached; `num_turns: 1` throws; no windows throws) |
| Codex probe: `codex app-server`, `initialize`, `initialized`, `account/rateLimits/read`; read to `id: 2`, ignore notifications, end stdin, kill child | this run | `machine/adapters/codex.js:23-27`, `machine/lib/usage-probe.js:15-27,35` | `machine/test/service.test.js:1170` (shim emits a notification first; records stdin; asserts exactly the three methods) |
| Codex map: 300 → five_hour, 10080 → week, `resetsAt` s → ISO, `planType` → `plan_type`, `rateLimitReachedType` → reached; error or no window → fail | this run | `machine/adapters/codex.js:8-20` | `machine/test/accounts.test.js:143` (weekly-only primary, both windows, reached, plan type, error response) |
| `machine/API.md` documents the route | this run | `machine/API.md:50` | read |
| `pollIdle(hub)`: candidates in settings order; claude/gpt; not paused; reading missing or ≥ 9 min; not probed in last 9 min (in memory) (D3, D10) | this run | `viewer/app/usage-poll.js:7,13-19,33` | `viewer/test/app-usage.test.js:346` (paused, signed-out, live, gemini skipped), `:364` (second run within 9 min makes no call), `:374` (fresh reading not probed) |
| Re-check eligibility right before each probe with fresh settings, threads, `machineAccounts` (D11) | this run | `viewer/app/usage-poll.js:22-26` | `viewer/test/app-usage.test.js:379` |
| Machine choice: hub's own machine if signed in there, else first reachable signed-in machine by name (D3) | this run | `viewer/app/usage-poll.js:27-31` | `viewer/test/app-usage.test.js:346` (records `machine: 'hub'`) |
| Call `hub.call(machine,'/v1/usage','POST',{account, cli, dir},35000)`; `cli` from `PROVIDERS`; `dir` null for `default-<provider>` else `~/.wheelchair/accounts/<id>` | this run | `viewer/app/usage-poll.js:35-38` | `viewer/test/app-usage.test.js:346` (body asserted) |
| On 200 re-load; drop if live or removed (D4); record stamped with probe start `at` and `machine` (D12) | this run | `viewer/app/usage-poll.js:32,39-42` | `viewer/test/app-usage.test.js:359` (goes live mid-probe), `:389` (removed mid-probe), `:384` (newer live reading during probe kept) |
| Error (502, 404, timeout) → nothing stored (D5) | this run | `viewer/app/usage-poll.js:43` | `viewer/test/app-usage.test.js:364` |
| `sessions.retryWaiting(hub)` once if anything recorded (D7) | this run | `viewer/app/usage-poll.js:45` | `viewer/test/app-usage.test.js:394` (waiting worker becomes ready) |
| `hub.pollIdle()` single in-flight promise | this run | `viewer/app/hub.js:137-140` | `viewer/test/app-usage.test.js:369` |
| `usageTimer` setInterval at `usagePollInterval ?? 60_000` and 30 s start timeout, both `unref()`'d; `usagePollInterval` constructor option | this run | `viewer/app/hub.js:16-17,67-70` | code reading; full node suite unaffected |
| `gemini` never polled (D8) | this run | `viewer/app/usage-poll.js:17,26`; route refuses `cli` other than claude/codex `machine/service.js:1075` | `viewer/test/app-usage.test.js:346`; `machine/test/service.test.js:1170` |

## Deviations from plan

- "Cleared wherever the other timers are cleared" (Spec, hub.js): no hub timer is cleared anywhere in the tree, so the new timers are only `unref()`'d, like the existing ones. An interim `Hub.close()` was removed (b4cf308) after the lead confirmed this.
- `viewer/app/API.md` not changed: it documents page-facing HTTP routes, not hub modules; the router row went in `viewer/AGENTS.md`.
- Service option `usageProbeTimeout` (default 30000) added for tests.

## Routers

- `machine/AGENTS.md`: new row for `lib/usage-probe.js` (asynchronous, timed CLI usage probe runner).
- `viewer/AGENTS.md`: new row for `app/usage-poll.js` (idle account usage polling and machine selection).
- `machine/API.md`: `POST /v1/usage` contract.

## Validation evidence

Run by the sub-lead on the feature branch after both merges (HEAD includes b4cf308).

`bash machine/test/run.sh`:
```
# tests 113
# suites 0
# pass 113
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 19196.031456
```

`node --test viewer/test/*.test.js` (exit 1; the three failures are pre-existing, see below):
```
# tests 460
# suites 0
# pass 457
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 33913.766094
155:    not ok 4 - three provider placement and constraints
222:not ok 20 - placement ranks accounts and respects provider policy
2081:not ok 328 - a starter that loses the freed port registers through the new holder
```

`npm --prefix viewer run test:browser` (exit 0):
```

  2 skipped
  634 passed (2.7m)
```

Pre-existing failures, not caused by this build:
- `app-balancer.test.js` "three provider placement and constraints" (and its parent "placement ranks accounts…"): `Antigravity is not used at heavy`. The lead reports it fails on 969471c (main as merged) before any build change; this build does not touch `balancer.js` or that test.
- `lifecycle.test.js` "a starter that loses the freed port registers through the new holder": fails the same way (`C retried after the silent holder`, actual `first`) on this branch at e81d612, before T2 merged, i.e. with no viewer change from this build; this build does not touch `server.js` or `lifecycle.test.js`.

The real `claude` and `codex` CLIs were not run by the build; all tests use shims.

## Known gaps / residual risks

- Per the Accepted Risks: the Claude `/usage` text and `codex app-server` can change with a CLI update; a change only stops readings (502 → D5).
- The timeout kill sends SIGKILL to the CLI process only, not to any grandchildren it might start.
- The 9-minute retry memory is in-process; a hub restart forgets it, so failing accounts are tried again at the first run 30 s after start.

## Remediation rounds
