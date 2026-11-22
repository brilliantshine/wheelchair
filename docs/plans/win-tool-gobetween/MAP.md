# Map: Windows tool go-between

Checked against `87923e582b9b68a125ec2c34cbdcb321bd45a23d` (origin/main and HEAD). Detailed flow, evidence and tests: `docs/maps/windows-stdio-gobetween.md`.

```text
provider config -> go-between handshake -> empty tools while copy readies
                                        -> real Windows tool -> list_changed
```

Today the CLI can start after the 45-second wait while copy creation and reconciliation continue; readiness and errors are in the machine process, with no separate-process ready signal (`machine/lib/win.js:133-143,171-198,373-380`; `machine/service.js:889-923`). A signal must represent successful reconciliation after the session starts, not merely an existing `.git` (`machine/lib/win.js:58-60,173-177`). Claude reads the project file itself, Codex uses command overrides, Antigravity uses a generated plugin, and Pi loads no project tools (`machine/adapters/claude.js:63-68`; `machine/adapters/codex.js:75-90,131-143`; `machine/adapters/agy.js:44-67`; `machine/adapters/pi.js:61`).

The shutdown boundary is material: the existing Job Object and stop wait apply to bridge-launched apps, not the CLI's MCP processes; stop, sweep and archive can reconcile or remove copies without waiting for a Windows MCP process tree to finish (`machine/lib/win.js:216-235,261-289,303-312`; `machine/lib/win-apps.js:59-84`). A copy can be shared across sessions (`machine/lib/win.js:200-203`). The old `win-sessions.json` and copy-wide shutdown gate were split out before implementation; restart tracking currently reconstructs from live sessions and existing copies (`docs/plans/windows-bridge-solid/PLAN.md:48,190-210`; `machine/lib/win.js:339-358`).

The parent records Codex's roughly 10-second deadline but leaves real-provider `list_changed` and Claude same-name configuration behavior unverified (`docs/plans/windows-bridge-solid/PLAN.md:44,321-322`). D16 excludes the Unity entry; D18 and D19 replace the earlier restart design (`docs/plans/windows-bridge-solid/PLAN.md:43-46`).

Not checked: live provider behavior, provider source, real Windows process termination, MCP vendor behavior, or other provider deadlines.
