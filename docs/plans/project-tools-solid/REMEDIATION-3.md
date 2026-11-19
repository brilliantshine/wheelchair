# Remediation 3 — project-tools-solid

Verification attempt 3 on `a856aa8`: Claude verifier PASS; GPT verifier FAIL with two gaps. The duplicate-header fix (R3) held under both.

## Gaps (verbatim)

1. GAP: §4, Antigravity plugin cleanup — The sweep can delete the plugin directory of a live session. The machine accepts `wc-dot.name-worker`, but tmux lists it as `wc-dot_name-worker`. With the directory aged past 60 seconds, the sweep deleted it while the pane stayed live.
2. GAP: §8, initial thread state — A successful handoff import can create and save a thread without the required `project_tools` default. In an isolated hub fixture, the import returned `outcome: 'created'` while the machine was unavailable to start the lead, and the saved record lacked the field.

Gap 2 is the same gap as remediation 2's gap 2 (second fix attempt). Gap 1 is new.

Not counted as gaps: the Claude verifier saw `viewer/test/app-uploads-archive.test.js` "archive through the hub cancels a stalled upload" fail in 2 of 5 full viewer runs (0 of 30 isolated runs; neither this branch nor main touches it; the base passed 2 full runs), `app-quiet` "6 message clears debt" (already known flaky) and a `routes.test.js:284` port collision. Recorded as a residual risk to watch.

## Tasks

### R5

# Task R5 (remediation 3) — the Antigravity sweep must match tmux's spelling of session names

Gap from verification attempt 3 (verbatim): "§4, Antigravity plugin cleanup — The sweep can delete the plugin directory of a live session. The machine accepts `wc-dot.name-worker`, but tmux lists it as `wc-dot_name-worker`. With the directory aged past 60 seconds, the sweep deleted it while the pane stayed live."

tmux replaces `.` and `:` in session names with `_` (and the machine's `safeName` allows `.`), so `liveTmux()` returns the tmux spelling while the directory decodes to the machine's spelling.

Ownership boundary: `machine/service.js` (only `sweepAgyTools`), `machine/test/project-tools-service.test.js`, your report (`docs/plans/project-tools-solid/reports/R5.md`). Touch nothing else.

## Exactly what to build
- In `sweepAgyTools`, a decoded valid name counts as live when `live.has(name) || live.has(name.replace(/[.:]/g, '_'))`. The `startingNames` check stays on the machine spelling. Nothing else changes (still fully synchronous, no `await`, same 60 s rule, same removal path built only from directory entries).
- Add a one-line comment saying why (tmux rewrites `.` and `:` to `_`).

## Tests (in `machine/test/project-tools-service.test.js`)
With `service.liveTmux = () => new Set(['wc-dot_name-worker'])` and an old-mtime dir `encodeURIComponent('wc-dot.name-worker')` under `<stateDir>/agy-tools`, the sweep keeps it; a dir for `wc-other.name-worker` (not live in either spelling, old mtime) is removed. The existing `assert.doesNotMatch(... /await/)` check still passes.

## Validation
```
node --test machine/test/project-tools-service.test.js
bash machine/test/run.sh
```

### R6

# Task R6 (remediation 3) — imported threads also carry the default project_tools record

Gap from verification attempt 3 (verbatim): "§8, initial thread state — A successful handoff import can create and save a thread without the required `project_tools` default. In an isolated hub fixture, the import returned `outcome: 'created'` while the machine was unavailable to start the lead, and the saved record lacked the field."

Spec §8: "Thread record gains `project_tools = { boot: null, seq: 0, created_at: null, state: null, card: null, card_names: [] }`." Remediation 2 added it only in `viewer/app/threads.js` `emptyThread`; `viewer/app/handoff-ops.js` `createLocked` (line ~127) builds its own thread object. These two are the only thread constructors in `viewer/app` (both contain `archived: false`).

Ownership boundary: `viewer/app/threads.js`, `viewer/app/handoff-ops.js` (only `createLocked`'s thread object and an import), `viewer/test/app-project-tools.test.js`, your report (`docs/plans/project-tools-solid/reports/R6.md`). Touch nothing else.

## Exactly what to build
1. In `viewer/app/threads.js`, add and export `function defaultProjectTools() { return { boot: null, seq: 0, created_at: null, state: null, card: null, card_names: [] }; }` and use it in `emptyThread` (`project_tools: defaultProjectTools()`).
2. In `viewer/app/handoff-ops.js` `createLocked`, add `project_tools: defaultProjectTools()` to the thread object (after `archived: false`). Import it from `./threads.js` only if that creates no circular-require problem at load time; if `threads.js` already requires `handoff-ops.js` (directly or indirectly) and the import would be undefined at load, require it lazily inside `createLocked` (`require('./threads.js').defaultProjectTools()`), as `viewer/app/sessions.js` does for `./handoff.js`.
3. Test in `viewer/test/app-project-tools.test.js`: a handoff import that creates a thread (reuse the fake-hub style in `viewer/test/app-handoff-import.test.js` or the real path in `viewer/test/app-handoff-ops.test.js`, whichever reaches `createLocked`) saves a thread whose `project_tools` deep-equals the default, also when the lead start fails or the machine is unavailable.

## Validation
```
node --test viewer/test/app-project-tools.test.js viewer/test/app-handoff-import.test.js viewer/test/app-handoff-ops.test.js
node --test viewer/test/*.test.js
```
(leave the glob unquoted)
