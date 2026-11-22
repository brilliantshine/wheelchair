# Remediation 1 — harness-install-solid

Verification attempt 1 at d6d1d01e. The Claude verifier passed it; the GPT verifier (gpt-6.2-sol) failed it. Its gaps, verbatim:

GAP: Machine job steps and timeout — Kimi and Pi still resolve their CLIs with `spawnSync`, which blocks the job leader’s timer and SIGTERM handler — a 2-second Kimi lookup exceeded a 500 ms limit and returned a CLI lookup failure with no timeout reason. `machine/lib/harness-install.js:116`, `machine/adapters/kimi.js:9`, `machine/adapters/pi.js:16`.
GAP: Hub switch-off — Rare path: a pending POST can reach the machine after the switch-off DELETE finds it idle, leaving an install running while Use is off — an isolated test observed DELETE on an idle machine, then POST 202 with Use still off. `viewer/app/routes.js:101–102,222–225`.
GAP: Settings cancellation errors — A Cancel error follows the provider to another machine and can remain as an alert after GET confirms cancellation — Chromium showed the `hub` error on `node-2`, then still showed it beside “Install cancelled” on `hub`. `viewer/pages/settings.js:1704,1724,1827`.
GAP: Machine completion and DELETE status — Rare path: when a poll overlaps result publication, GET can return “The install stopped before finishing” and the page stops polling. When DELETE overlaps PID removal, it can return 500 — isolated fixtures reproduced both outcomes. `machine/lib/harness-install.js:15–21,35–37`, `viewer/pages/settings.js:1702–1704`.
GAP: Machine job timeout during startup — Rare path: if PID publication fails after spawn, the detached leader waits indefinitely — injecting `ENOSPC` for the PID write left the leader alive 600 ms after startup with a 100 ms limit. `machine/lib/harness-install.js:47–49,57–60,89–90`.
GAP: Machine step exit codes — The async runner changes the reported code when a subprocess fails to start — with `python3` missing from PATH, the pre-build commit returned `exit_code: 1` and this build returned `exit_code: -2`. `machine/lib/harness-install.js:82–84,105–106`.

Judged rare (recorded in PLAN.md Accepted Risks, round verification-1): gaps 2, 4 and 5. Sent to remediation: gaps 1, 3 and 6.

## Tasks

- **R1-1** (gaps 1 and 6), machine/lib/harness-install.js and machine/test/harness-install.test.js, light, routed to gpt (built T1). Brief: replace the Kimi/Pi `resolveCli()` call with an async `command -v` through the job's `run()`, keeping the adapters' exact semantics (Kimi's `~/.kimi-code/bin/kimi` fallback and X_OK check). `run()` resolves `status: null` when the child emitted 'error'. Tests: a slow fake `sh` with a 500 ms limit gives `reason: "timeout"`; `python3` absent from PATH gives `exit_code: 1`. Validation: `node --test machine/test/harness-install.test.js`, and the new tests shown failing before the fix.
- **R1-3** (gap 3), viewer/pages/settings.js and viewer/test/app-harnesses.spec.js, light, routed to claude (built T2/T3). Brief: the Cancel error moves from `hz.rowErr[provider]` to the job record (`cancelErr`). It is carried across running polls, dropped on terminal states, and rendered only on a running row. Tests: the alert is gone after GET `cancelled`; the alert is absent on another machine's row. Validation: `npm --prefix viewer run test:browser -- app-harnesses.spec.js`, and the new tests shown failing before the fix.
