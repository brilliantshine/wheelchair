# Remediation 1 — shell-tool-keys

Verifier (claude-opus-5-5) verdict on d81671ee: PASS, no gaps. The full run on the same commit failed one suite:

## Gaps (verbatim)

GAP: full run, suite `machine` exit 1 at d81671eec26ecdf9658dcea48b0165755e75a847. Seven tests fail with `Cannot read properties of undefined (reading 'get')`: kimi-turns.test.js:62, :70, :88, :168, :201 ("incompatible marker and missing binding stop with a reason", "protocol versions must be well formed and respect the full minimum", "fatal stop refuses input and waits for confirmed absence", "missing log requires continuous failures and delivery failures never start the clock", "recovery stops Kimi while leaving Claude and marker-priority panes alone"), pi.test.js:34 ("orphaned Pi pane is marked lost after restart"), switch.test.js:45 ("relaunch readiness reports the matching switch and timeout ends it"). Cause: these tests build the service with `Object.create(MachineService.prototype)` (e.g. kimi-turns.test.js:13), so the constructor's `this.toolRuns = new Map()` never runs, and `abortToolRuns` (machine/service.js:1152), now called from `stop` and `stopFatal`, reads `this.toolRuns.get`. Not on main: these tests pass at the comparison commit, where `abortToolRuns` did not exist.

## R1-1 (light)

In machine/service.js:1152 change `this.toolRuns.get(name)` to `this.toolRuns?.get(name)`. Nothing else. Copy the `?.` pattern already used on that line's neighbours (e.g. `this.win?.onStop`).

Ownership boundary: machine/service.js line 1152 only; report docs/plans/shell-tool-keys/reports/R1-1.md.

Validation:
node --test machine/test/kimi-turns.test.js machine/test/pi.test.js machine/test/switch.test.js machine/test/tool-machine-run.test.js
