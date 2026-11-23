# Map: easy onboarding

Checked against `b53f4f24313cc6e46ee58e24b18e02bcc9c5283d` (origin/main and worktree HEAD). See [installation and onboarding runtime](../../maps/onboarding-runtime.md) for the traced files, line references, platform details and limits.

```text
install prerequisites and one CLI -> wheelchair services -> browser Settings
  -> install or sign in to selected harnesses -> placement -> Ready -> session
```

Today the installer refuses to install anything when none of the five CLIs is present, so a new Settings section alone cannot bootstrap a machine without a harness (`install.sh:38-56`). Existing service PATH is captured at install time and Pi resolves from PATH at runtime, so a later CLI installation must account for the service and tmux environment (`install.sh:373-390`; `machine/adapters/pi.js:16`; `machine/service.js:698-709`).

Settings keeps normal preferences on the hub, but sign-in and diagram sensitivity act on machines; each supported provider has different CLI and login behavior (`viewer/app/state.js:233-248`; `viewer/app/routes.js:201-206,412-421`; `viewer/app/providers.js:3`; `viewer/app/diagram-sensitivity.js:26-48`). Ready checks the thread's own CLI and login, while reviewer placement can fall back to another family (`viewer/app/ready.js:29-72`; `viewer/app/balancer.js:38-46,79-80`).

The optional root helper requires its own privileged Linux installation and runs approved commands with root's environment; it is unavailable on macOS (`sudo-helper/install.sh:4-6`; `sudo-helper/helper.py:175-196`; `install.sh:80-83`). The installer instead starts Linux systemd or macOS launchd user services and offers platform-specific Tailscale setup (`install.sh:281-303,321-435`).

## What I did not look at

Live harness installation instructions or login behavior, all first-run screens, package-manager policies, and unrelated service routes and tests. See the area map for the full limits.
