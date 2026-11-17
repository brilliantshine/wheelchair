---
slug: macos-support
date: 2026-11-16
implemented-by: "standard / gpt-6.1-terra medium (T1-T6 workers, T6 asked for claude and got gpt); integration fixes by the sub-lead (claude-opus-5-5)"
verified-by: []
---

# Completion Report — Run wheelchair on a Mac

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

All rows are `this run`; Prior Work was empty.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| 1 bash 3.2 / no GNU-only flags in `install.sh` | this run | install.sh (whole file; no `declare -A`, `mapfile`, `stat -c` etc.) | Mac job run 44001663012 ran `./install.sh --serve` under `/bin/bash` 3.2.57 |
| 1 `tailscale_cli` (PATH, then Darwin app path), every call through it | this run | install.sh:25, :140, :213-218, :245, :279-283, :291-294, :458-460 | install/test/run.sh "Darwin app fallback runs serve without sudo"; Linux cases unchanged |
| 1 Darwin serve commands without `sudo`; Linux keeps `sudo tailscale` | this run | install.sh:277-283, :292-294, :458-466 | install/test/run.sh Darwin cases + existing Linux cases (187/187) |
| 1 `platform` seam, `WHEELCHAIR_SYSTEMD_RUN_DIR`, documented as test seams | this run | install.sh:22-24, :227-233 | install/test/run.sh:178 pins every existing case to Linux |
| 1 `platform_supports_serving` on Darwin = `launchctl` on PATH | this run | install.sh:227-233 | Darwin fixture cases; Mac job installed the services |
| 1 two LaunchAgent plists, exact labels, all fields, mode 644 | this run | install.sh:312-341 (paths install.sh:14-15) | install/test/run.sh "Darwin serve writes valid complete LaunchAgent plists" (plistlib-parsed, every field); Mac job `plutil` "OK" for both |
| 1 XML escaping, `plutil -lint` validation | this run | install.sh:308-310, :343-346 | fixture runs with HOME `.../home & <mac>` |
| 1 bootout then bootstrap per label; failure message, continue | this run | install.sh:347-350 | "Darwin validates and bootstraps both plists", "Darwin rerun boots out and bootstraps both agents again" |
| 1 no linger; the logged-in message | this run | install.sh:352 | "Darwin prints the sudo helper and login messages"; printed in Mac job |
| 1 then `configure_tailscale_serve` and `--url` as on Linux | this run | install.sh configure_service (Darwin branch falls through to the shared tail) | Mac job log shows the serve offers after install |
| 1 Darwin `disable_service` | this run | install.sh:431-468 | "Darwin disable boots out and removes both agents", "Darwin removal commands omit sudo" |
| 1 first-run default unchanged (Mac = display) | this run | install.sh:183-185 | existing display cases |
| 1 Darwin sudo-helper line | this run | install.sh:71-72 | fixture + Mac job log |
| 2 `tailscale ip -4` with Darwin app-path fallback | this run | machine/service.js:115-123 | Linux machine suite 105/105; Mac job step 2 (service answered) |
| 2 session start skips `systemd-run` on Darwin | this run | machine/service.js:501 | Mac job check.sh step 3 (tmux session started) and step 4 (survived `kickstart -k`) |
| 2 `aside-turns.js` `ps` backend when `/proc` is absent; never throws | this run | machine/lib/aside-turns.js:16-38 | machine/test/aside-turns.test.js:126 (Linux and Mac job, 6/6) |
| 3 preflight lock in Python `fcntl.flock`, mode 600 | this run | codex/preflight.sh:37-41 | codex/test/run.sh:326 "preflight works without flock on PATH"; Mac job 79/79; check.sh step 7 |
| 3 `model.sh`/`preflight.sh` bash 3.2 + BSD | this run | codex/ (no constructs needed changing in model.sh) | Mac job codex suite 79/79 under bash 3.2 |
| 4 `set.sh` without associative arrays; same behavior | this run | sensitivity/set.sh:55-70 (`index_of`), whole file | pre-port suite passes 67/67 against the new writer; Linux + Mac 67/67; check.sh step 6 |
| 4 `sensitivity/test/run.sh` ported | this run | sensitivity/test/run.sh:21-29, :60-71 | Linux + Mac 67/67 |
| 5 `install/test/run.sh` ported, Linux pinned, Darwin cases | this run | install/test/run.sh:25-49, :178-180, :603-643 | Linux + Mac 187/187 |
| 5 aside-turns `ps` cases with injectable switch | this run | machine/test/aside-turns.test.js:126-148 | Linux + Mac |
| 6 `test-support/macos/check.sh` steps 1-7, exits 2 off Darwin | this run | test-support/macos/check.sh:4-7, :34-93; fakes test-support/macos/fake-claude, fake-tailscale | Mac job: steps 1-7 passed; Linux: exits 2 with "macOS check requires Darwin" |
| 7 `.github/workflows/macos.yml` | this run | .github/workflows/macos.yml:1-48 | run 44001663012 green |
| 8 README "On macOS", platform line, launchd mentions | this run | README.md:20, :42-61, :177-178, :197-198 | read |
| 8 AGENTS.md, CONTRIBUTING.md mention launchd and the new paths | this run | AGENTS.md:45-46, :59; CONTRIBUTING.md:60, :71-73 | read |
| 8 MAC-CHECKLIST.md, five items | this run | docs/plans/macos-support/MAC-CHECKLIST.md:1-23 | read |

## Deviations from plan

- **Temporary CI trigger, now removed.** While iterating, `macos.yml` also ran on pushes to `wc/**`, so the job could run before a pull request existed. It is removed in the final commit; the triggers are exactly the Spec's (`pull_request`, `push` to `main`). The green Mac run (44001663012, commit b57c3e0) differs from the final tree only in that trigger and in the plan documents.
- **`preflight.sh` reads the HTTP error body defensively.** Not in the Spec. On macOS a connection reset while reading a 400 response body raised inside the `except HTTPError` handler and turned exit 2 into exit 1. The read is now wrapped so a 400/401/403 still exits 2; exit codes and messages are otherwise as before (codex/preflight.sh:85-89).
- **`set.sh` uses `awk 'NR < first'` instead of `head -n <start-1>`.** BSD `head` refuses `-n 0`, which a block on line 1 asks for; on a Mac every second Diagrams write would have failed. The bytes written are identical (sensitivity/set.sh:264-265).
- **Extra test seam `WHEELCHAIR_TAILSCALE_APP`** in install.sh for the app-path fallback, documented beside the Spec's two seams.

## Routers

- `AGENTS.md` (root): `test-support/` row now lists `macos/`; a new row names `.github/workflows/macos.yml`; the `install.sh` row says "systemd or launchd".
- `CONTRIBUTING.md`: install paragraph says "systemd or launchd"; a paragraph names the Mac CI job and `test-support/macos/`.
- No ownership moved between directories; `machine/AGENTS.md`, `sensitivity/AGENTS.md` and `codex/AGENTS.md` name no file whose role changed.

## Validation evidence

Linux (this machine), final tree:

```
$ bash sensitivity/test/run.sh        → RESULT 67 passed, 0 failed     (exit 0)
$ bash codex/test/run.sh              → RESULT 79 passed, 0 failed     (exit 0)
$ bash install/test/run.sh            → RESULT 187 passed, 0 failed    (exit 0)
$ bash machine/test/run.sh            → # tests 105 # pass 105 # fail 0 (exit 0)
$ node --test test-support/test/*.test.js → # tests 9 # pass 9 # fail 0 (exit 0)
$ node --test viewer/test/*.test.js   → # tests 439 # pass 437 # fail 2 (exit 1)
    not ok — a starter that loses the freed port registers through the new holder
    not ok — an app page carries font-src self and the font route serves only the allowlist
```

The two viewer failures are pre-existing and unrelated: this branch changes no file under
`viewer/`, and both fail identically on an untouched `git archive main` tree run the same way
(`node --test --test-name-pattern 'freed port registers|font-src self' viewer/test/*.test.js`
→ `# pass 25 # fail 2`). The first is already in `docs/known-issues.md:6`.

`bash -n` on every changed shell file (codex/preflight.sh, codex/test/run.sh, install.sh,
install/test/run.sh, sensitivity/set.sh, sensitivity/test/run.sh, test-support/macos/check.sh,
fake-claude, fake-tailscale): no output, exit 0. `shellcheck -S warning` on the same set: only
SC2034 (`level_pattern`) and SC2209 (`mode=write`) in sensitivity/set.sh, both present on
`main` unchanged.

macOS, GitHub Actions run 44001663012 (`macos-latest`, commit b57c3e0), success:

```
Use macOS Bash and BSD tools| GNU bash, version 3.2.57(1)-release (arm64-apple-darwin25)
Run portable suites| RESULT 67 passed, 0 failed
Run portable suites| RESULT 79 passed, 0 failed
Run portable suites| RESULT 187 passed, 0 failed
Run portable suites| # pass 6
Run portable suites| # fail 0
Install services| harness found: claude
Install services| sudo helper: not available on macOS; sudo cards won't work on this machine
Install services| /Users/runner/Library/LaunchAgents/com.wheelchair.viewer.plist: OK
Install services| /Users/runner/Library/LaunchAgents/com.wheelchair.machine.plist: OK
Install services| viewer: on macOS the services run while you are logged in; to keep this Mac serving, turn on automatic login and stop it sleeping (see README, "On macOS")
Install services| viewer: run later: tailscale serve --bg --set-path /wheelchair http://127.0.0.1:7373/wheelchair
Install services| viewer: run later: tailscale serve --bg 7373
Check services| step 1 passed … step 7 passed
```

Earlier Mac runs, each fixed before the green one: 44000639772 and 44000823620 (sensitivity
`head -n 0`, then the preflight reset), 44001051926 (preflight diagnostic), 44001264562
(installer suite awaiting T1).

## Known gaps / residual risks

- The plan's three Accepted Risks stand: Claude Keychain sharing across accounts, `tailscale
  serve` from the Mac app untested until the friend's checklist (CI uses a fake `tailscale`),
  sudo cards unavailable on a Mac.
- CI proves launchd install, restart survival and KeepAlive on a runner with a fake `claude`;
  real Claude and Codex sessions on a Mac, phone access and reboot/login are covered only by
  MAC-CHECKLIST.md.
- The final commit (trigger removed) has not itself had a Mac run; it will run on the pull request.
- `install/test/run.sh`'s account-tmp skip in `tree_state` is slightly broader than the old regex
  (any path under `accounts/` containing `/tmp`), which only narrows what that equality check sees.

## Remediation rounds
