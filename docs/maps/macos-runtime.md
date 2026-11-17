# Map: installation and platform-dependent runtime

Checked against: `40a1d23eea7961e8de747b3b1c3bef294789115a` (worktree HEAD; fetched origin/main is `165009e7fbb3fe66bb20b6fb7fd880e50c19bf69`).
Files covered: `install.sh`, `install/guard.sh`, `install/test/run.sh`, `machine/service.js`, `machine/lib/aside-turns.js`, `machine/lib/sudo.js`, `machine/adapters/claude.js`, `machine/adapters/common.js`, `codex/preflight.sh`, `viewer/app/sessions.js`, `viewer/app/providers.js`, `viewer/app/routes.js`, `viewer/app/diagram-sensitivity.js`, `viewer/pages/settings.js`, `sensitivity/set.sh`, `sudo-helper/install.sh`, `sudo-helper/helper.py`, `sensitivity/test/run.sh`, `machine/test/aside-probe.sh`, `machine/test/sudo.test.js`, `sudo-helper/test/install-test.sh`, `test-support/run-dir.js`.

## Install to running services

```text
canonical-clone guard -> detect CLIs -> stop stale viewer -> clean wrappers and initialize models
  -> install dependencies -> clean hooks -> render sensitivity -> initialize machine state
  -> choose serving -> Linux systemd units -> linger -> Tailscale mappings
```

1. The guard rejects linked worktrees or paths under the app worktrees unless explicitly overridden; it uses Git's absolute-path option and physical `pwd` (`install.sh:6-9`; `install/guard.sh:12-31`). Install refuses if neither CLI is found, requests a stale viewer stop, parses flags, removes recognized retired wrappers, initializes model pins only if Codex is present, installs npm dependencies and both browsers, and cleans old hooks (`install.sh:23-39,41-51,60-113`). Model initialization failure warns; it does not stop install (`install.sh:90-96`).
2. It invokes the sensitivity writer and warns on failure, then creates private machine state, secret and configuration only when missing. Host is the first `tailscale ip -4` line or loopback (`install.sh:115-154`). **macOS Bash dependency:** sensitivity uses associative arrays requiring Bash 4 or later, while its env-based shebang selects the Bash on PATH (`sensitivity/set.sh:1,55,244`). Failure is therefore only a warning during install (`install.sh:115-119`).
3. Explicit `--serve` calls service setup; `--no-serve` disables it. With no flag, an existing serving decision is reused; on first run Darwin is always treated as having a display and records no serving without prompting; a headless terminal is asked and a headless non-terminal gets no decision (`install.sh:156-168,379-403`). **Linux-only:** service setup returns before saving a serving decision unless `uname` is Linux, `/run/systemd/system` exists and `systemctl` is present, including for explicit `--serve` (`install.sh:210-212,280-288`).
4. On supported systems, Tailscale status must provide a DNS name. The installer writes the serving origin and systemd user units: viewer runs Node with `--service`, browser disabled and restart; machine runs Node with the installer's PATH plus CLI directories, restart, and `KillMode=process` to preserve sessions. It reloads, enables and restarts both, then checks/enables user linger and warns if refused (`install.sh:191-207,289-338`). **Linux-only:** systemd units, `systemctl --user`, `loginctl` and linger have no alternate implementation here.
5. It inspects Tailscale Serve's JSON mapping state and offers missing `/wheelchair` and root mappings, running `sudo tailscale` only after terminal consent; occupied mappings are preserved (`install.sh:216-276,339-340`). Disable stops/removes units only on supported platforms, records the decision, and prints path-specific removal commands for its own mappings (`install.sh:351-376`). Tailscale itself is a separate external dependency, not intrinsically Linux-only.
6. The installer fixture suite supplies isolated homes and systemctl, loginctl, Tailscale and other shims, and checks the Linux unit/linger sequence (`install/test/run.sh:57-80,105-137,152-168,375-376,434-443,553-554`). It assumes Bash associative arrays and GNU utilities (`install/test/run.sh:35-41,57,562`).

## Machine and GPT session

```text
hub selects provider/account -> GPT preflight -> machine validates account and creates worktree
  -> scoped tmux or plain tmux -> CLI inherits account environment -> session ready
```

The hub chooses a provider and account, checks effort and calls the machine preflight for GPT; failure marks that account unavailable, reselects and may retry, or returns 409 (with a needs card for a waiting lead). It resolves the model and sends the chosen account to start (`viewer/app/providers.js:3`; `viewer/app/sessions.js:125-168,198-203`). Machine `/v1/preflight` runs `codex/preflight.sh` with the account's `CODEX_HOME` when set and reports failure as 409 (`machine/service.js:1038`). **Linux utility dependency:** preflight takes `flock` on a file before reading `auth.json`, serializing refresh and atomic replacement; a missing `flock` fails before the token check (`codex/preflight.sh:24-36,63-75,101-115`).

Machine validates and seeds the account, fetches and creates a worktree, builds the CLI environment and tries `systemd-run --user --scope tmux`; if that fails or is absent it falls back to plain tmux (`machine/service.js:390-422,461-468,482-501`). The scope and systemd `KillMode` protect tmux from a Linux service restart; the plain fallback does not supply that systemd protection (`machine/service.js:493-498`; `install.sh:313-322`). Machine host detection also tries Tailscale IPv4 and falls back to loopback (`machine/service.js:115-117`).

**Linux-only `/proc`:** aside turns record process start time, scan process environments for their marker and read process groups from `/proc`; restart recovery scans and kills prior running turns (`machine/lib/aside-turns.js:10-14,19-33`). On a system without `/proc`, a saved running aside causes the unguarded directory scan to throw during recovery; start-time lookup returns null and the stop/timeout kill cannot identify a process group (`machine/lib/aside-turns.js:11-14,24-26,61-68,77-86`).

## Accounts and sensitivity

```text
account sign-in or session -> isolated account directory -> CLI login environment -> CLI credentials
Settings Diagrams -> hub fan-out -> machine writer -> global instruction files
```

Non-default accounts use `~/.wheelchair/accounts/<id>` and the machine validates that exact path; default uses no override (`viewer/app/routes.js:341`; `viewer/app/sessions.js:198-203`; `machine/service.js:47-53`). Sign-in seeds the directory and runs the CLI with its account environment; session and aside paths do likewise (`machine/service.js:461-468,490,884-900`; `machine/lib/aside-turns.js:71-79`). Claude sets `CLAUDE_CONFIG_DIR` for non-default accounts, otherwise uses the inherited environment/default `~/.claude`; its seed links `CLAUDE.md` and writes account metadata, not credentials. Login status is delegated to `claude auth status` and transcript lookup searches the selected directory's `projects` (`machine/adapters/claude.js:5-6,27,30-31`; `machine/adapters/common.js:9-17`). Code does not select a credential backend or prove isolation of macOS Keychain entries; verify actual Claude behavior before relying on directory separation. Codex's seed explicitly requests file-based credentials (`machine/adapters/common.js:13`).

Settings reads and writes the hub route, which fans out to every machine; the machine executes `set.sh --json`/`--report` or the requested level, reporting failures to the hub (`viewer/pages/settings.js:133-142`; `viewer/app/routes.js:151-153`; `viewer/app/diagram-sensitivity.js:17-48`; `machine/service.js:1013-1034`). The writer checks the canonical clone for writes, inspects the source and target blocks, refuses malformed blocks and conflicting levels, renders to temporary files and replaces targets with rollback on failure (`sensitivity/set.sh:49-55,180-215,240-285`). **macOS Bash dependency:** both reports and writes reach `declare -A`, so a system Bash 3 invocation fails even for Settings reads (`sensitivity/set.sh:1,34-55,244`).

## Sudo card path

```text
separate root install -> system unit and Tailscale socket proxy -> machine intake socket
  -> helper checks user's password -> root command -> machine polls outcome
```

The separate installer requires a non-root `SUDO_USER`, Tailscale DNS and a canonical clone; it copies the helper into `/usr/local/lib`, writes `/etc` configuration and a root systemd unit, sets `root:root` ownership, enables/restarts the unit and serves its Unix page socket via Tailscale HTTPS 8445 (`sudo-helper/install.sh:3-8,15-18,27-65`). **Linux-only:** systemd unit and runtime directory, `systemctl`, `/run`, `root:root`, and fixed `/usr/bin/python3` are platform assumptions (`sudo-helper/install.sh:18,43-65`).

The helper defaults to `/run/wheelchair-sudo`, `/usr/sbin/runuser` and `/usr/bin/sudo`; it invokes `runuser` as the configured user for the password check and executes the approved command with root's `HOME=/root` and a fixed PATH (`sudo-helper/helper.py:22,113,196`). It creates a 0600 page socket and a 0660 intake socket assigned the configured user's primary group (`sudo-helper/helper.py:327-345`). Machine defaults to the intake socket and registers requests over HTTP on it, persisting and polling outcomes (`machine/lib/sudo.js:9-18,20-55,86-90`). **Linux-only:** `runuser`, `/run` and root home are explicit assumptions; Unix sockets and permission bits themselves are not Linux-specific.

## Test portability landmarks

- GNU `sha256sum`, `sort -z` and `stat -c` appear in installer fixtures (`install/test/run.sh:35-41,562`); GNU-style `sed -i` appears in sensitivity fixtures (`sensitivity/test/run.sh:110,125`). Sudo installer tests also use `stat -c` and `sha256sum` (`sudo-helper/test/install-test.sh:27-34,60-62`).
- The aside live probe reads Linux `/proc/sys/kernel/random/uuid` and uses Bash 4 `mapfile` (`machine/test/aside-probe.sh:12-13,72`); shared test temp management checks for `/proc` availability (`test-support/run-dir.js:8,17`).
- Sudo tests place Unix sockets beneath temporary roots (`machine/test/sudo.test.js:28,44`); test temp roots come from `os.tmpdir()` (`test-support/run-dir.js:104`). Unix socket path length limits make longer macOS temp paths a portability concern; no limit or mitigation was established from these lines.

## Not checked

Actual macOS execution, launchd design, Tailscale's macOS CLI and Unix-socket support, Claude Keychain behavior, dependency installation versions, and all other platform-specific code and test suites were not checked. Existing maps for sessions, provider placement, serving and test temp directories differ from fetched origin/main in their covered files; this map independently checks the scoped paths above rather than treating those older maps as current.
