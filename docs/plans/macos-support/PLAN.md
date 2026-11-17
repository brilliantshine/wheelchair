---
slug: macos-support
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-16
---

# Run wheelchair on a Mac

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: How does the Mac build get tried without Collin owning a Mac?
- **Context:** This build machine is Linux, and Collin has no Mac; the user is a friend who does. Everything Mac-specific (launchd, BSD tools, bash 3.2, Tailscale's Mac CLI, Keychain) can only be shown working on a Mac. The repo is public (`brilliantshine/wheelchair`), so GitHub's hosted macOS runners are free; it has no `.github/workflows/` today.
- **Options:** (a) A GitHub Actions macOS job runs install and the relevant checks on every PR, and the friend then tries only Tailscale and phone access; (b) the friend runs a written checklist; (c) pause until a Mac is available.
- **Recommendation:** (a).

### Q2: What happens with more than one Claude account on a Mac?
- **Context:** Machines here use separate Claude accounts (`~/.wheelchair/accounts/personal`, `work1`) via `CLAUDE_CONFIG_DIR` (`machine/adapters/claude.js:5-6`). On macOS Claude Code keeps its login in the Keychain; public reports disagree on whether the Keychain entry is per config directory. If shared, two accounts overwrite each other's login.
- **Options:** (a) Assume separation works, check it on the Mac, and fix in a follow-up thread if not; (b) on a Mac, allow only the default Claude account until checked; (c) on a Mac, refuse a second Claude account when a probe shows the entries are shared.
- **Recommendation:** (a), with the check as a required step of the Mac trial.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Tailscale's Mac app ships a CLI inside the app bundle, not on PATH | Whether `tailscale serve` with the HTTPS mappings the installer writes works from the Mac app variants | no | |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Scope: the Mac runs sessions and serves the app over Tailscale; no sudo helper on the Mac | Collin's pick; the root helper is the hardest port and can be its own thread | user |
| 2 | Services on macOS are launchd LaunchAgents in `~/Library/LaunchAgents`, loaded with `launchctl bootstrap gui/<uid>`, `KeepAlive` and `RunAtLoad` on | The macOS equivalent of systemd user units; runs under the logged-in user per IDEA "Not doing" | defaulted |
| 3 | The machine LaunchAgent sets `AbandonProcessGroup` so a service restart leaves tmux sessions alone | Same guarantee `KillMode=process` gives on Linux (`install.sh:313-322`) | defaulted |
| 4 | `codex/preflight.sh` takes its lock in Python `fcntl.flock`, on every platform | `flock` is missing on macOS; `codex/model.sh` already does this; one code path | defaulted |
| 5 | `sensitivity/set.sh` is rewritten to run on bash 3.2 (no associative arrays) | Adds no Homebrew dependency for the service's PATH | defaulted |
| 6 | `machine/lib/aside-turns.js` uses `ps` where `/proc` is absent; Linux keeps `/proc` | Smallest change; Linux behavior untouched | defaulted |
| 7 | With no flag, a Mac keeps today's behavior: not serving unless `--serve` is passed | A Mac usually has a display, like a desktop; the README tells Mac servers to pass `--serve` | defaulted |
| 8 | The installer finds Tailscale's CLI on PATH or inside `/Applications/Tailscale.app` | The Mac app does not put it on PATH by default | defaulted |
| 9 | The installer does not change power settings; the README covers keeping the Mac awake | Changing sleep needs sudo and is the owner's call | defaulted |

## Spec

(Grows as decisions land.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
