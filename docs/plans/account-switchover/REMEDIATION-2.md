# Remediation 2 — account-switchover

## Gap list (verification attempt 2, verbatim)

From the GPT verifier (`wc-71bee3e28391-verifier-4`), commit 23e99161cdebe18101fd492c40a9db893ea6c21b. The Claude verifier (`wc-71bee3e28391-verifier-3`) passed.

- GAP: §3 machine step 6 and §4 — Rare path: If the first tmux stop fails after a relaunch times out, the machine drops the active switch, emits `stuck` on the next poll, and never retries the stop — `machine/service.js:922–926, 1038–1043, 1193–1218` — **rare path, Accepted Risks verification-2**
- GAP: §3 switch acceptance and fallback — Rare path: A failed acceptance write leaves the old CLI marked `switching` even after storage recovers. The machine ignores its hooks and rejects `Continue.` with HTTP 409 — `machine/service.js:877–882, 1269–1272, 1585–1587` — **rare path, Accepted Risks verification-2**
- GAP: Validation, machine relaunch inputs — The build forwards `project_dir`, but all nine switch tests still passed when a scratch-only mutation removed it from the launch inputs — `machine/service.js:907`, `machine/test/switch.test.js:69`

## Tasks

- R3 (gap 3): `machine/test/switch.test.js` — the stubbed `prepareLaunch` also asserts `input.project_dir` equals the request's `project_dir`; mutation check. Brief `briefs/R3.md` (scratch).
