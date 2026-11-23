# Map: Windows localhost project tools

```text
Project tools switch -> .mcp.json metadata -> session worktree reader
  -> determine provider-loaded tools -> claim safe port -> launch CLI
  -> confirmed session exit or restart -> release or recover ownership
```

The current configuration and provider paths are in [project tools](../../maps/project-tools.md); WSL detection and the existing bridge are in [Windows bridge runtime](../../maps/windows-bridge-runtime.md); start, stop, recovery and existing listeners are in [machine session lifecycle](../../maps/machine-session-lifecycle.md). The switch, networking-mode probe, forwarding and port ownership do not exist on current main. Claude reads the original file while Codex and Antigravity construct their own config, and Kimi loads no tools (`machine/adapters/claude.js:63-68`; `machine/adapters/codex.js:32-100`; `machine/adapters/agy.js:31-67`; `machine/adapters/kimi.js:158-166`).

The previous plan is background, not current implementation: `wc/d5233e17e73d:docs/plans/windows-bridge-solid/PLAN.md` Decision Log D2, D6, D7, D9, D10 and D13 proposes an opt-in top-level `wheelchair.windows` list, IPv4 localhost HTTP/SSE, a Windows loopback relay for NAT, mirrored detection by `wslinfo`, and withholding when a Linux port is occupied. D20 splits that work off; D15 changes Unity to stdio. The removed detailed Spec is preserved at `d861dbb2:docs/plans/windows-bridge-solid/PLAN.md` §1 (lines 71-190).

Its review established that port meaning must be owned across projects and concurrent starts, including unmarked Linux tools, and that a tool whose port cannot be safely claimed must be withheld before its CLI can send headers to an unrelated Linux process (prior plan Review Rounds 1, 3 and 4; removed Spec §1 Port reservations and Port taken on Linux). Keep ownership until tmux is confirmed gone, including externally killed sessions; skip starts still in progress and destroy open SSE connections before releasing (Rounds 6–8). Persist launch ownership before tmux and rebuild it after service restart because tmux survives; the earlier plan explicitly accepted a restart gap in which an unrelated process can bind the port and receive headers (D13; Accepted Risks; removed Spec §1 Machine service restart). Default WSL localhostForwarding can reflect the Linux listener onto Windows and cause a relay loop while the Windows server is absent; the old proposal checked the Windows listener owner and Check Once Built C3 required live verification. Mirrored mode has its own Linux-listener collision and later-binding accepted risk (Rounds 6–8; Accepted Risks). These are prior decisions and risks for renewed design, not proof a proposed fix works.

The separate Windows bridge work from PR #140 and its copy-folder follow-up is on main (`cb736689`, `697a8505`, `13da4289`). The later `windows-bridge-solid` branch itself is not merged: its merge base with current main is current main `02027a6c8f3c88bbc10000cf067886f4547f9c97`, while its tip is `c51c9a8de48360830ddfe8aaf41d92c94440729f`; its plan says verifying rather than merged (`wc/d5233e17e73d:docs/plans/windows-bridge-solid/PLAN.md`, implementation log).

Not checked: live WSL networking, external provider source, and every prior branch implementation detail outside the requested decisions and review findings.
