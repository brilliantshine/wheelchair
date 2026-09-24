# Remediation 2 — remote-viewer

Verification round 2 (closure review of remediation 1), 2026-09-23.

- gpt-5.6-sol (resumed thread `01a0d0bc-5140-74d0-a4f7-64dd6bf3e27a`), checking the
  Claude-built work: `VERDICT: PASS`.
- Claude (default reviewer model, resumed), checking the GPT-built work: `VERDICT: FAIL`, one
  gap. It confirmed its other round-1 gaps closed, and reran both suites (109/109 unit,
  192/192 browser).

## Gap, verbatim

```
GAP: Validation, "a starter that loses the freed port to another starter after a stop registers through it" — the new test doesn't force that race. It is ordinary reuse of a server that is already running, the same as the existing test "commands reuse a proven server and register without exposing its token". REMEDIATION-1.md R1-2 said to force it with the delay-relisten-after-stop hook ("same hook"). The test doesn't use the hook: it SIGTERMs the old server itself and waits for it to exit (`old.child.kill('SIGTERM'); await exit(old.child)`), starts the winner with `startServer`, and only then runs `--open` (viewer/test/lifecycle.test.js, "a starter that loses the freed port registers through the new holder", added in 4c1ac27). The `--open` never stops anything, never finds the port freed, and never has the port taken between its retries. The path the Spec means (EADDRINUSE, then `/whoami` gets nothing because the old server is closing, then a retry finds another starter holding the port and registers through it; viewer/server.js main loop, the `holder.kind === 'none'` retry followed by `ours`) is still not tested. The other items in my three round-1 gaps are closed: `--rotate-token` and service takeover now refuse an older-version holder (`allowOlderStop` is passed only from `--stop`), and the three-takeover test really drives four holders and exits 1 with "gave up after three takeovers". The remaining tests I listed have been added. I reran both suites and they pass: 109/109 unit, 192/192 browser.
```

This gap survived remediation round 1. By `protocol/verification.md` it goes to a **fresh**
lane one rung up. The lane produced nearly-right work and missed the forcing of one race, so
the rung is `xhigh` at the same tier (gpt-5.6-terra). The brief below names the exact design,
so the lane doesn't have to invent it. If it survives this round too, it goes to Collin as a
plan defect.

## Task R2-1 — force the lost-freed-port race (GPT / gpt-5.6-terra, `xhigh`, fresh lane)

- **Objective:** replace the body of the test "a starter that loses the freed port registers
  through the new holder" in `viewer/test/lifecycle.test.js` so it drives the path in
  `main()` where a starter's listen fails with `EADDRINUSE`, `/whoami` gets no valid answer
  because the holder is shutting down, the starter retries, and a retry finds another of our
  servers holding the port and registers through it. The design, using two new hook modes in
  `viewer/test/hooks/lifecycle.js`:
  1. `hang-on-sigterm`, for the old server A: on `SIGTERM`, stop answering requests (accept
     connections but never respond), keep the port bound for about 800 ms, then exit. It must
     replace the server's own `SIGTERM` handling, in the same way as `ignore-sigterm`.
  2. `delay-listen-retry`, for the command C: every `listen` attempt after the first waits
     300 ms before it runs, so a plain starter can win the port first.
  3. The test starts A with `hang-on-sigterm`, sends it `SIGTERM`, and at once starts
     `--open <graph>` (C) with `delay-listen-retry`. As soon as A has exited, it starts a
     plain server B on the same port and `--cache-root`. It then asserts: C exits 0; C is not
     the listener (`.server`'s `pid` is B's); C's graph is in `.registered` with
     `opened: true`, written by B; and C's stderr/stdout show no refusal. If the Node test can
     observe it, also assert that C saw at least one silent-holder retry, for example through
     a line the `delay-listen-retry` hook appends to a file each time it delays.
  Keep every other test unchanged and passing. Change `viewer/server.js` only if the test
  exposes a real bug, and explain any such change in the report.
- **Ownership boundary:** `viewer/test/lifecycle.test.js`, `viewer/test/hooks/lifecycle.js`,
  and `viewer/server.js` only for a real bug.
- **Validation:** `node --test viewer/test/*.test.js` (run it three times; the new test must
  pass all three, since it is a race); `npm --prefix viewer run test:browser`.
- Fails-twice guardrail; no git writes; paste validation output.
