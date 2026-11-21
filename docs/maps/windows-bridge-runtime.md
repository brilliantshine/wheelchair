# Map: Windows bridge runtime

Checked against: `02027a6c8f3c88bbc10000cf067886f4547f9c97` (origin/main).
Files covered: `machine/lib/win-env.js`, `machine/lib/win.js`, `machine/lib/win-sync.js`, `machine/lib/win-apps.js`, `machine/service.js`, `machine/adapters/codex.js`.

```text
service starts -> detect WSL and interop -> session reads project tools
  -> Windows executable tool or existing copy -> ready Windows worktree
  -> pass Windows project environment -> interop and Windows app lifecycle
```

Detection requires both a Microsoft kernel release and registered WSL interop; `/etc/wsl.conf` supplies an optional automount root. Interop selects an existing `WSL_INTEROP` socket or the newest `/run/WSL/*_interop` and strips the session token (`machine/lib/win-env.js:8-44`). The bridge tracks and reconciles Windows copies, starts Windows apps and sweeps them on startup and every 60 seconds (`machine/lib/win.js:129-155,204-223,291-305`; `machine/service.js:446-450`). Session startup currently identifies Windows tools by executable command, prepares the copy and passes bridge environment; Codex passes Windows project variables through for those commands (`machine/service.js:839-848,888-900`; `machine/adapters/codex.js:81-86`).

The inspected production machine code has no networking-mode detection, Windows host-address discovery, localhost MCP forwarding or port reservation; the existing HTTP listener is the machine API (`machine/service.js:2264-2265`; `machine/lib/win-env.js:8-44`). PR #140 is on main at merge `cb736689`; the parent follow-up is `697a8505` and `13da4289`, handling empty copy-folder cleanup after archive/worktree removal (`machine/lib/win.js:226-240,268-288`). These do not implement the split-off forwarding design.

Not checked: live WSL, Windows network configuration, vendor networking behavior, or all Windows app and sync edge cases.
