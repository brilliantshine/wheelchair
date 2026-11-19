# Map: making project tools solid

Checked against: `207c02f5e0b56cfbcc96046cca10a8df92002a9c` (origin/main). Detailed runtime and test evidence: [project tools map](../../maps/project-tools.md).

```text
start or retry -> worktree .mcp.json -> validate -> adapter overrides -> tmux CLI
                                      -> warnings -> machine log
hub response -> session state -> existing system needs card lifecycle
```

- Antigravity currently uses the machine home for its hook, no account environment override, and per-session trusted-workspace settings; it logs that project tools are unsupported (`machine/adapters/agy.js:9-32`). A session-specific home or plugin directory is not established by the code; preserving authentication and hook lookup needs investigation. The prior plan records the `--settings` rejection and candidate locations (`docs/plans/local-projects/PLAN.md`, Decision 7 and Deferred D1).
- Codex supports stdio and HTTP project overrides but skips headers and most `${...}`; exact same-key env references become `env_vars`. Reader validation rejects other transports (`machine/adapters/codex.js:65-96`; `machine/lib/project-mcp.js:34-39`). No `http_headers` or `bearer_token_env_var` translation exists in this builder. The 64 KiB quoted override budget counts UTF-16 units instead of bytes (`machine/adapters/codex.js:24-28,98-100`). Its argv is stored on the session, so secret expansion into it would persist (`machine/service.js:616-617`).
- Reader and adapter warnings are logged only for tools-getting roles and are absent from the returned session (`machine/service.js:608-617,628-634`). A hub notice needs handling on normal starts and queued promotion through `startSession`, and separately on `resumeUnanswered`; retries can return an already-created machine session (`viewer/app/sessions.js:185-210,329-365,766-775`; `machine/service.js:568-579`). Existing system needs cards open with `addCard`, close when their owning condition marks them answered, and cannot be closed by a user press (`viewer/app/cards.js:11-34`; `viewer/app/sessions.js:560-586`; `viewer/app/threads.js:360-361`). The earlier plan's review rounds and Decisions 10–16 explain why warning-only, per-CLI state, clean starts and all three paths mattered; Decision 16 deferred that design (`docs/plans/local-projects/PLAN.md`, Decision Log, Review Rounds 1–4 and Deferred D4).
- Existing Codex MCP listing is for disabling aside tools, not a connection health probe (`machine/lib/aside-turns.js:109-120`); a live test also exercises Claude and Codex list commands (`machine/test/aside-probe.sh:53-73`). No project-program PATH check or tmux `show-environment` call was found in the searched machine and hub code. Linux sets service PATH, while session launch does not explicitly set PATH (`install.sh:392-399`; `machine/service.js:616-625`); the prior plan notes tmux environment and restart gaps (Deferred D4).
- Focused coverage is in `machine/test/project-mcp.test.js:18-80`, `machine/test/project-mcp-codex.test.js:16-90`, and `machine/test/accounts.test.js:104-119`; the size test uses ASCII, leaving the byte-count issue uncovered.

Not looked at: upstream CLI implementation or live per-session Antigravity isolation, all card rendering paths, and real tmux PATH behavior across platforms. No health checks or tests were run for this map.
