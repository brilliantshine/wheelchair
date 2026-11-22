---
slug: win-tools-solid
date: 2026-11-22
implemented-by: "standard (gpt-6.1-terra); sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Make Windows tools solid (idle reader closed)

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| 1. `--probe-ms` option, default 2000, positive integer; `wrapEntries` does not pass it | this run | `machine/lib/win-tool-proxy.js:10,14,19`; `machine/lib/win-tool-wrap.js` untouched | `machine/test/win-tool-proxy.test.js:220` (0 / non-integer rejected) |
| 1. Checks every `--probe-ms`; failure calls `stdoutLost()`; all checks stop once shutdown began | this run | `machine/lib/win-tool-proxy.js:160-166` (guard at `:161`) | tests at `:151`, `:173`, `:194` |
| 1. Socket probe: stdout `socket:[...]`, zero-length `fs.writeSync(1)`, any error fails, skipped while a write is in flight | this run | `machine/lib/win-tool-proxy.js:144,158,163-165` (`writes === 0` gate) | `:151` (socketpair reader closed, idle, stdin open); `:207` (preload logs no zero-length probe while `writableLength > 0`) |
| 1. Pipe reader check: parent's `/proc/<ppid>/fd` read end of the same `pipe:[N]`, fdinfo `(flags & 3) !== 1`; off for life if parent holds none or `/proc` unreadable at start | this run | `machine/lib/win-tool-proxy.js:142,145-157,159,162` | `:173` (python3 `os.pipe()` parent closes read end); `:185` (parent holds no read end at start → proxy stays up) |
| 1. Parent gone: `process.ppid` differs from start → `stdoutLost()` | this run | `machine/lib/win-tool-proxy.js:142,162` | `:194` (independent `sleep` holder keeps both pipe ends; python parent exits; cases: idle, pending large write, tool writing during teardown) |
| 2. Non-goals: no change to handshake, held calls, list cache, `list_changed`, wrapping, start/stop of tool, machine service | this run | diff touches only `machine/lib/win-tool-proxy.js` (+28/-3) and tests/fixtures | existing 21 proxy tests unchanged in meaning, all pass |

## Deviations from plan

None in the Spec. Test fixture additions (all under `machine/test/fixtures/win-tool/`): `pipe-parent.py` (python3 OS-pipe parent with a `sleep 30` holder), `probe-preload.js` (`--require` preload observing zero-length writes), and opt-in `KEEP_LARGE` / `WRITE_ON_END` behaviours in `server.js`. `pipe-parent.py` sets `WRITE_ON_END` for every mode, so in the OS-pipe and parent-gone tests the tool ignores stdin end and is stopped through the `--stop-ms` escalation.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

`node --test machine/test/win-tool-proxy.test.js` on the merged feature branch (commit `79dde5e4`):

```text
✔ idle socket reader closure shuts down within the probe and stop budgets
✔ OS pipe reader closure is detected and the tool stops within its budget
✔ pipe reader check stays disabled if parent has no reader initially
✔ parent loss ends proxy with held pipes, pending output, and a writing tool
✔ socket probe skips pending stdout writes
✔ probe interval must be a positive integer
ℹ tests 27
ℹ pass 27
ℹ fail 0
```

Also passed 3 consecutive runs on the worker branch (sub-lead rerun) and 5 consecutive runs (worker's report, `docs/plans/win-tools-solid/reports/T1.md`).

`bash machine/test/run.sh` on the merged branch:

```text
✖ Pi asides validate, fork, resume, settle and redact
✖ detached install routes persist through service restart and validate
✖ new login clears previous result and uses exact target
✖ plan files use committed refs and enforce input and size limits
✖ archive keeps selected regular uploads, retries and reserves numbers
ℹ tests 620
ℹ pass 615
ℹ fail 5
```

Baseline: the same command on the feature branch before T1 was merged (commit `d842c191`, no code change from `5a042f03`) gave `pass 609, fail 5` with exactly the same five failing tests. They are in `aside-turns`, `harness-install`, `kimi` ("Kimi Code is not installed") and `plan-files` (`EADDRINUSE 127.0.0.1:7374`, the live machine service's port). None of them involve the go-between. T1 adds 6 tests and 0 failures.

## Known gaps / residual risks

- The five pre-existing `machine/test/run.sh` failures above are unrelated to this change and still fail on this machine.
- A zero-length `writeSync` that throws something other than EPIPE (e.g. EAGAIN) on a socket would be read as a lost reader. The Spec says "any error fails", so this follows it.
- Test hygiene: if a parent-gone or OS-pipe test fails before the proxy exits, the fixture tool (with `WRITE_ON_END`) can be left running. The pipe-check-off test relies on python closing its own read end before the proxy's start scan. Losing that race makes the test fail; it can never make it pass falsely.
- Not checked live on Codex or Windows; tests use fakes as the IDEA's constraint says.

## Remediation rounds
