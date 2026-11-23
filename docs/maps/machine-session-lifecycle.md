# Map: machine session lifecycle and listeners

Checked against: `02027a6c8f3c88bbc10000cf067886f4547f9c97` (origin/main).
Files covered: `machine/service.js`, `machine/lib/win.js`, `machine/lib/win-apps.js`, `machine/lib/screen.js`, `machine/lib/win-env.js`.

```text
start request -> reserve name and worktree -> build config -> launch tmux
  -> persist sessions.json -> stop or tmux disappears -> cleanup sweep
  -> service restart -> reload records and discover live tmux -> bridge startup sweep
```

Repeated starts join `startingNames`; start builds a worktree and CLI config, starts tmux in a scope that survives service restart, then persists the session (`machine/service.js:790-827,832-850,902-916`). Normal stop issues `kill-session` but does not check its result before setting stopped and calling screen and Windows cleanup (`machine/service.js:1180-1194`). Fatal stop instead checks `liveTmux()` and returns pending if absent cannot be confirmed (`machine/service.js:936-942`). `liveTmux()` distinguishes an empty tmux server from an unknown error; the bridge sweep skips cleanup if the result is unknown (`machine/service.js:468-475`; `machine/lib/win.js:291-300`). Starting names must also be protected from sweeps; the existing Antigravity file sweep does so (`machine/service.js:477-484,790-799`).

On startup the service reads `sessions.json`, recovers unrecorded live `wc-*` sessions without tokens, then starts screen and Windows cleanup; persisted records and tmux survive but in-memory maps do not (`machine/service.js:440-451,538-556`). The service's own HTTP server binds its configured host and port (`machine/service.js:433-434,2264-2265`); screen management launches Xvfb and tracks screen processes (`machine/lib/screen.js:140-160,186-203`). A search of production `machine/` found no general tool-port allocator or TCP proxy/relay; test fixtures temporarily bind port 0, e.g. `machine/test/win-service.test.js:17`.

Not checked: every indirect handoff or archive stop path, kernel socket behavior, or live restart behavior.
