# Remediation 1 — drive-local-app

Verification attempt 1 at commit `2bce723`: both verifiers (claude, gpt) FAIL. Duplicates are merged (gap 2 was found by both). Gap 6 was deferred by the lead (PLAN.md Deferred row 6). Four other findings were not counted, and the lead agreed.

## Gaps, verbatim from the verifier reports

- (gpt) Window listing and autofocus — A single viewable window is omitted, so `run` leaves it unfocused and `windows` returns `[]`. On hearth, a sandboxed Codex launch visibly rendered `xmessage`, and native `xwininfo` reported `1 child:` and `Map State: IsViewable`. The parser only accepts `children:` — `machine/lib/screen-args.js:89–91`, `/tmp/wc-drive-verifier.flPBuHwa/single.log`.
- (gpt) Autofocus deadline — The six-second deadline starts after the pre-launch window scan. Eight successful queries at 0.8 seconds each took 6.451 seconds before the app could launch — `machine/lib/screen.js:183`, `machine/lib/screen-input.js:32–48,115–121`, `/tmp/wc-drive-verifier.flPBuHwa/unit-probes.log`.
- (gpt) Autofocus failure handling — The implementation skips every non-timeout per-window query failure. The completion report describes this as handling vanished windows, but a probe that returned an unexpected X server error still caused `run` to focus another window, contrary to the Spec — `machine/lib/screen-input.js:37–42`, `/tmp/wc-drive-verifier.flPBuHwa/unit-probes.log`.
- (gpt) Launch failure reporting — An executable with a missing shebang interpreter returned CLI exit `0` and `{ok:true}` even though the app never started. The launch log reported `No such file or directory` — `machine/lib/screen.js:182–195`, `/tmp/wc-drive-verifier.flPBuHwa/extra.log`. **Not counted:** this matches the Spec for a command that starts and exits at once; the lead agreed.
- (claude + gpt) Archive retention — when removing the uploads fails, archive keeps the uploads but still deletes the screens folder, so a reopened thread loses its counters and generations — `machine/service.js:876–878`.
- (gpt) Persisted screen state — App records store the number, scope unit, log and command. The app PID and process group required by the Spec are absent from `state.json` — `machine/lib/screen.js:185–192`. **Deferred** (PLAN.md Deferred row 6).
- (gpt) Machine router — The router names `lib/screen.js` and omits the two new implementation files, `lib/screen-input.js` and `lib/screen-args.js` — `machine/AGENTS.md:14`.

## Tasks (each brief in full is the session's start brief; summarised here)

| Task | Gaps | Ownership | Tier |
|---|---|---|---|
| R1 | 1 (one-window parse: match `N child:` too, plus a test), 5 (router rows for `lib/screen-input.js` and `lib/screen-args.js`) | `machine/lib/screen-args.js`, `machine/test/screen-args.test.js`, `machine/AGENTS.md` | gpt light |
| R2 | 2 (move `removeThreadDir` inside the uploads `try`; test with uploads removal failing with ENOTDIR) | `machine/service.js` (one line), `machine/test/screen.test.js` | gpt light |
| R3 | 3 (baseline scan inside the 6 s phase: `windowIds` deadline, `autoFocus` `startedAt`), 4 (skip only a window that vanished, matched by stderr `Bad Window`/`Bad Drawable`/`No such window`; any other failure ends the phase) | `machine/lib/screen-input.js`, `machine/test/screen-input.test.js`, `machine/lib/screen.js` (two calls in `launch()`) | gpt standard |

All routed to GPT, the provider that built this code. Attempt 1 sharpens the briefs at the same tiers. After merging, the sub-lead re-runs the full suites and the live check (real Chromium, for gap 4).
