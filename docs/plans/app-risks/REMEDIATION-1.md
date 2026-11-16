# Remediation 1: app-risks

Verification attempt 1 (verifier `wc-0958e89051d8-verifier`, claude / claude-opus-5-5, commit `d258bd8`): FAIL with one gap.

## Gap list (verbatim)

GAP: Shared harness, startup assertion ("every state, cache and spool path it uses (including each process's effective default, not just the paths it passes) is inside the run folder") — the harness checks only paths it builds itself, so the check can never fail, and it never looks at what the hub or machine service will actually use. The builder admits this in COMPLETION.md ("weaker than the Spec's wording"), but no Decision Log entry or Accepted Risks row accepts it. — `test-support/smoke/harness.js:55-56` builds `effectivePaths` from `path.join(dir, …)` and then asserts each one starts with `dir`. Line 57 repeats the port check that line 49 already guarantees. Nothing reads back the hub's resolved `--state-dir`/`--cache-root` (`viewer/server.js:1079-1084`, default at `:2241`) or the machine's resolved `stateDir` (`machine/service.js:144`, default `~/.local/state/wheelchair` at `:26`). This matters most in live mode, where `HOME` is real. There are two ways to close it: make the assertion check the paths each process will really resolve, or add a Decision Log entry that accepts the weaker form.

## Verifier notes (not gaps) and what was done

- The recorded run 2 output was missing its header and slow-start row. That was the sub-lead's copy error (`sed -n '3,$p'`). Fixed: `reports/live-run.md` and COMPLETION.md now carry the full output, including `slow-start | PASS | request succeeded; 12.93 s; 1 start requests`.
- `card.js` exits 0 on the 202 but prints nothing. The aim (the agent does not resend) is met; noted in COMPLETION.md, no change.

## Tasks

### R1-T1: make the harness's path assertion real

Route: GPT (every builder was GPT), Standard. Attempt 1 sharpens the brief rather than the model: the original T2 brief repeated the Spec's sentence without saying how to derive each process's effective paths, so the worker checked its own constants.

# Worker brief — app-risks R1-T1: make the harness's path assertion real

Read first: /home/collin/projects/personal/wheelchair/protocol/app/worker.md (your role rules).
Plan slug: app-risks. Task id: R1-T1. Lead session (send questions here with a `message` card): wc-0958e89051d8-lead.
Context: docs/plans/app-risks/PLAN.md Spec "Shared harness" (the paragraph after step 8), docs/plans/app-risks/REMEDIATION-1.md (the gap, verbatim). The file to change is `test-support/smoke/harness.js`.

## Hard rules
- The port/state ban covers only what the harness and scripts point at and write to. Your own wc.js and card.js commands go through this machine's service on 7374; that is expected and required.
- Never delete files: no `rm`, no `git rm`, no `git clean`.
- Never run ./install.sh. Never point anything at port 7374/7373 or write ~/.local/state/wheelchair. Never restart the wheelchair-viewer or wheelchair-machine services. Never kill the user's default tmux server.
- **Never run `test-support/smoke/live.sh`** (it costs real model turns). The smoke suite and `--check-live` are free; run them as often as you like.
- Do not change `viewer/` or `machine/` code.
- If the same gate fails twice, stop and report rather than iterating.

## The gap
Today `harness.js:53-57` builds `effectivePaths` from `path.join(dir, …)` and then asserts each one starts with `dir`, so the check can never fail. It never looks at what the hub or machine service will actually resolve.

## What to build (all in harness.js, plus one unit test file)
1. **A pure, exported function** `effectivePaths({ hubArgv, machineArgv, env })` that returns the state, cache and spool paths each process will resolve **from the exact argv arrays and env the harness is about to spawn**, using each process's own documented resolution:
   - hub (`viewer/server.js`): state dir = the value after `--state-dir`, else `<HOME>/.local/state/wheelchair` (`viewer/server.js:2241`); cache root = the value after `--cache-root`, else `<HOME>/.cache/agent-graphs` (`:1112`). Values go through `path.resolve`, as `configFromArgs` does (`:1079-1084`).
   - machine (`machine/service.js`): state dir = the value after `--stateDir`, else `<HOME>/.local/state/wheelchair` (`:26,144`); spool = `<stateDir>/spool`; worktrees = `<stateDir>/worktrees`; settings = `<stateDir>/settings`.
   - `<HOME>` is `env.HOME` of that child's env, not `process.env`.
   - Also return each process's port (hub `--port`, machine `--port`).
2. **Restructure `createHarness`** so the hub and machine argv arrays and the child env are built **before** the assertion, and the assertion runs on `effectivePaths(...)`'s output: every path must be inside the run folder and no port may be 7373 or 7374. It must still run before anything starts (before the proxy listens and before any spawn). The spawns must use those same argv arrays, not rebuilt copies. Remove the duplicate port line (57) or fold it into this check.
3. **Read-back after start** (before `createHarness` returns): assert `<hub cache root>/.token` exists (it is read today), `<machine state dir>/machine.json` exists and its `port` equals the machine port and its `hub_url` equals the harness hub URL, and in live mode the seeded sub-lead is visible through `agent({ action: 'list' })`. On a mismatch, tear down and throw with what differed.
4. **Unit test** `test-support/test/smoke-harness.test.js` (pure, no processes): with argv like the harness's, `effectivePaths` returns in-folder paths; dropping `--state-dir` from the hub argv yields `<HOME>/.local/state/wheelchair`, dropping `--cache-root` yields `<HOME>/.cache/agent-graphs`, and dropping `--stateDir` from the machine argv yields `<HOME>/.local/state/wheelchair` for the machine. Also test the assertion helper you use (export it, e.g. `assertIsolated(paths, ports, dir)`): it throws for each of those dropped-flag cases and for a port of 7374, and passes for the harness's real argv. Requiring `harness.js` must not start anything; it already starts nothing unless run as main.

## Ownership boundary
- `test-support/smoke/harness.js`
- `test-support/test/smoke-harness.test.js` (new)
- `docs/plans/app-risks/reports/R1-T1.md`
Not yours: live.js, smoke.js, COMPLETION.md, PLAN.md, anything under viewer/ or machine/.

## Validation (paste output in the report)
```bash
node --test test-support/test/*.test.js
bash test-support/smoke/run.sh
node test-support/smoke/harness.js --check-live
node --check test-support/smoke/live.js
```
Also show, once, the assertion firing on the real code path: temporarily delete `'--state-dir', paths.hubState` from the hub argv in your worktree, run `bash test-support/smoke/run.sh`, paste the error, then restore it exactly (`git diff test-support/smoke/harness.js` must show only your intended change) and never commit the broken version.

## Deliverable
Commit via `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit --paths <exact paths> --message "..."`. Report at `docs/plans/app-risks/reports/R1-T1.md` with the pasted outputs and the diff summary, then post a `result` card (task R1-T1).

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
