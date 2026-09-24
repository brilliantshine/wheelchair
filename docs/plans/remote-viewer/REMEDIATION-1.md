# Remediation 1 — remote-viewer

Verification round 1, 2026-09-23. Two verifiers, one per implementing family:

- Claude (default reviewer model) checked the GPT-built work (tasks 1, 2, 3, 6). Cross-family.
- GPT / gpt-5.6-sol (thread `01a0d0bc-5140-74d0-a4f7-64dd6bf3e27a`) checked the Claude-built
  work (tasks 4, 5, 7, 8). Cross-family.

Both returned `VERDICT: FAIL`.

## Gaps, verbatim

From the Claude verifier:

```
GAP: Becoming the server, stopping (Spec lines 283-289: "To every other command a holder with no `proof` is foreign, and the refusal says 'a viewer from an older version is running; run ./install.sh'") — `--rotate-token` stops a viewer running older code when it should refuse it with the upgrade message. The older-code exception is meant only for `--stop`, but `stopServer` always calls `identifyHolder(..., { allowOlderStop: true })`, and `--rotate-token` calls `stopServer` directly — viewer/server.js:1801 and :1972. I checked this myself: a fake older server (answers `/whoami` with only a `start_id`, and that `start_id` is in `.server`) was stopped by `--rotate-token`, which printed "Server stopped." and exited 0.
GAP: Validation, "`--service` gives up after three takeovers in a row" — no test checks the three-takeover limit, yet COMPLETION.md cites this test as covering it. The test with that name (viewer/test/lifecycle.test.js:229-240) SIGKILLs the one holder and asserts that the service ends up listening (`assert.equal(service.child.exitCode, null)`). Its own comment says it only shows "a finite failure path". Nothing drives four holders in a row, and the Spec's hook "that delays the re-listen after a stop's wait" does not exist in viewer/test/hooks/lifecycle.js. The code for the limit does exist (server.js:2032).
GAP: Validation, the unit cases the Spec lists — several have no test in viewer/test/*.test.js: "a starter that loses the freed port to another starter after a stop registers through it"; "`--rotate-token` waits for the old server to exit and leaves `.server` to it"; "a server's shutdown releases the port before removing `.server`, and never removes a lockfile holding another `start_id`"; "`--stop` leaves `.server` to the exiting server"; "after a timed-out `--rotate-token`, `--open` registers with the running server's token and succeeds". The old-version fixture is never refused by `--register-plan` (lifecycle.test.js:209 loops only over `--open`, `--show` and `--service`), is never run under `--stop --if-stale`, never checks that no token is sent, and does not answer `404` to `POST /register`. "Leave the files untouched when the `POST` is refused" is covered only by a path refused before any request is sent (registration.test.js:61-75). I ran the rotation-wait, the timed-out-rotation `--open`, and the old fixture under `--register-plan` and `--stop --if-stale` by hand, and the code behaves correctly in each. The tests the Spec requires are still missing.
```

From the GPT verifier:

```
GAP: `--register-plan` grace — a silent `/whoami` is classified as foreign after one timeout instead of retried for two seconds — `viewer/server.js:1997` passes `retrySilent: false`; `viewer/server.js:1785` immediately returns `foreign`
GAP: Required lifecycle validation — claimed tests do not exercise the specified cases — `viewer/test/lifecycle.test.js:229` kills one holder and asserts the service succeeds rather than forcing three takeovers; the old-viewer loop at `:212` omits `--register-plan`
GAP: Task 7 documentation — README still describes `viewer/` as only `index.html` and `server.js`, calls it a single HTML file, and says every route uses a token minted at start, contradicting the new pages, persistent token, and unauthenticated discovery/assets — `README.md:85`, `README.md:198`, `README.md:213`
```

The lead checked each code gap at its cited line before writing the tasks below: `stopServer`
passes `allowOlderStop: true` for every caller (`viewer/server.js:1801`), `--rotate-token` and
service takeover both go through it (`:1972`, `:2034`), and `--register-plan` calls
`identifyHolder` with `retrySilent: false` (`:1997`), which returns `foreign` on the first
timeout (`:1785`). The GPT verifier's second gap overlaps the Claude verifier's second and third.

## Tasks

### R1-1 — README (Claude / sonnet; family that built task 7)

- **Objective:** make `README.md:85`, `:198` and `:213` true for the new viewer: `viewer/`
  holds the graph viewer, the list and document pages and their scripts, the server, and the
  Playwright config; the viewer is several pages, not a single HTML file; the token is
  created once and lasts until `--rotate-token`, and `/whoami` and the two `/assets/` scripts
  need no token. Check the rest of `README.md` for any other statement the change made false,
  and fix it the same way.
- **Ownership boundary:** `README.md` only.
- **Validation:** `bash spine/test/run.sh`; `git diff --stat` touches only `README.md`.

### R1-2 — server gaps and missing tests (GPT / gpt-5.6-terra, resuming task 1's thread `01a0d06d-2827-7ab0-83c7-97c78b0be201`)

- **Objective:**
  1. `allowOlderStop` applies only when the caller is `--stop` (including `--stop --if-stale`).
     `--rotate-token` and service takeover must treat a holder with no `proof` as foreign, and
     `--rotate-token` then prints the upgrade message and exits 1 without stopping anything.
  2. `--register-plan` retries a silent holder (connection opens, no valid `/whoami` answer)
     every 100 ms for up to 2 s before treating it as foreign (Decision Log #84), the same as
     the refused-connection grace it already has.
  3. Tests, each its own `test(...)`: `--rotate-token` refuses an old-version holder with the
     upgrade message and leaves it running; `--register-plan` against a silent holder that
     starts answering within 2 s registers through it; `--service` gives up after three
     takeovers in a row, forced by a new `--require` hook that delays the re-listen after a
     stop's wait while the test starts a fresh server on the port each time (four holders in
     a row), asserting exit 1 and the "gave up after three takeovers" message; a starter that
     loses the freed port to another starter after a stop registers through it (same hook);
     `--rotate-token` waits for the old server to exit and leaves `.server` to it (the file is
     removed by the exiting server, never by the command); a server's shutdown releases the
     port before removing `.server`, and never removes a `.server` holding another
     `start_id`; `--stop` leaves `.server` to the exiting server; after a timed-out
     `--rotate-token`, `--open` registers with the running server's token and succeeds; the
     old-version fixture answers `404` to `POST /register`, is refused by `--register-plan`
     (warning, exit 0) and by `--open`/`--show`/`--service` with no request to it ever
     carrying the token (record every request the fixture receives), and is stopped by
     `--stop --if-stale`; a `POST /register` that reaches the server and is refused (for
     example a signed request for an out-of-scope path) leaves `.registered` and `.plans`
     byte-identical.
- **Ownership boundary:** `viewer/server.js`, `viewer/test/lifecycle.test.js`,
  `viewer/test/registration.test.js`, `viewer/test/hooks/*`.
- **Validation:** `node --test viewer/test/*.test.js`; `npm --prefix viewer run test:browser`.
- Fails-twice guardrail; no git writes; paste validation output.
