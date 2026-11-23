# Windows bridge map

Checked against `dbdc97c540f8c9226a3d0762bdd6fe9b548b9ecf` (origin/main and worktree HEAD). Detailed current evidence and covered files: [Windows bridge runtime](../../maps/windows-bridge-runtime.md).

```text
thread machine and project -> Linux worktree and session
  -> agent CLI -> authenticated machine service
  -> Linux screen or project tool -> screenshot upload -> thread image
```

The chosen thread machine owns its Linux worktree and every session start (`viewer/app/threads.js:43-78`; `viewer/app/sessions.js:357-383`; `machine/service.js:554-589`). A bridge would need to associate a Windows target and a local Windows copy with the relevant session worktree, including distinct worker and verifier worktrees; no such association is in this start flow. Agent-facing commands go through `wc.js` and session-token `/v1/agent/*` routes, while the hub uses a separate machine secret (`viewer/app/wc.js:99-103,163-179`; `machine/service.js:501-514,2043-2046`).

Today's screen is a per-session Linux Xvfb/systemd screen with validated input, app handover and PNG screenshots; its status does not return app exit codes (`machine/lib/screen.js:140-160,209-239,249-267`). Image cards require a readable absolute path on the Linux machine and copy that file into thread uploads (`machine/service.js:353-370,1991-2005`). A Windows screenshot must cross that file boundary before using the existing card path.

Project MCP configuration is read per worktree, then translated differently for each provider: Claude, Codex and Antigravity have distinct mechanisms and limitations; Kimi currently warns and omits project tools (`machine/service.js:776-783`; `machine/adapters/claude.js:63-74`; `machine/adapters/codex.js:31-93`; `machine/adapters/agy.js:31-67`; `machine/adapters/kimi.js:127-128`). Program discovery uses Linux worktree paths and tmux PATH (`machine/lib/project-programs.js:15-31`; `machine/service.js:670-681`). A Windows MCP endpoint or stdio transport therefore needs to fit each provider's supported configuration and the target's lifetime.

README's WSL route is explicitly untested and places repos in Linux home, not `/mnt/c`; it calls for systemd and Tailscale inside WSL (`README.md:63-87`). No WSL interop or path conversion was found in the inspected runtime and installer paths. Separate-machine transport and synchronization are not implemented by the described machine registry or screen routes (`viewer/app/machine-client.js:62-75`; `machine/lib/screen.js:233-239`).

For validation, use `bash machine/test/run.sh`, `node --test viewer/test/*.test.js`, and `bash install/test/run.sh`, plus browser tests when changing pages; see the detailed map for targeted tests and the separate live screen check (`machine/test/run.sh:1-3`; `viewer/AGENTS.md:45-50`; `install/test/run.sh:1-12`).

Not checked: live WSL/Windows or Unity, vendor MCP behavior, network security and actual synchronization semantics, or exhaustive tests and failure paths.
