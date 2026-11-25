# R2b — project lead harness discovery

## Changes

- `connectors/claude/machine.js`: project lead launches select user settings and strict MCP configuration. The adapter already receives the session record. Wheelchair only writes `--mcp-config` for replaced project servers; project leads have no project MCP data (`machine/service.js:957`), so they do not need that file.
- `connectors/codex/machine.js`: project leads mark the clone untrusted in the existing command-line project trust override. The installed Codex 0.172.0, tested in an isolated repository, returned `[]` for `codex mcp list --json` with untrusted and listed the fixture server with trusted. Ordinary launches remain trusted.
- `connectors/pi/machine.js`: project leads use `--no-approve` in place of `--approve`. Installed Pi 1.5.2's `docs/security.md:45-61` says this skips project settings, project MCP servers, extensions and packages; it notes an initial `sessionDir` lookup exception and context files remain readable. Wheelchair's explicit extension still loads.
- `machine/test/project-lead.test.js`: tests Claude with committed project settings and MCP files in the clone and compares ordinary launches; tests Codex and Pi lead-only launch controls. Removing each Claude flag separately, the Codex trust override, and the Pi flag each produced a failing targeted assertion before restoration.

## Harness investigation and limitations

- Claude 2.1.332 `claude --help` says:

```
  --setting-sources <sources>           Comma-separated list of setting sources
                                        to load (user, project, local).
  --settings <file-or-json>             Settings file or JSON string to load
                                        more settings from
  --strict-mcp-config                   Only use MCP servers from --mcp-config,
                                        ignoring all other MCP configurations
```

  The folder trust prompt can still appear on a fresh clone; these flags do not disable it. `connectors/claude/machine.js:94` and `machine/service.js:1159-1163` retain the existing acceptance handler. This is based on the unchanged trust handling and flag descriptions, not an interactive Claude launch.
- Codex discovers trusted `.codex/config.toml`, including MCP servers. `connectors/codex/machine.js:158` previously explicitly trusted the folder. The isolated CLI comparison above verifies the new override. User-scope configuration remains available.
- Antigravity 1.5.16 discovers workspace `.agents/mcp_config.json` ([upstream issue](https://github.com/google-antigravity/antigravity-cli/issues/60)); `connectors/agy/machine.js:72` supplies trusted workspace settings and its command has no discovery suppression flag. Installed `agy --help` offers `--settings`, but no option to exclude workspace settings or MCP discovery. No change invented; workspace tools may load.
- Kimi Code 2.6.3 discovers `.kimi-code/mcp.json` and `.kimi-code/local.toml` ([MCP docs](https://moonshotai.github.io/kimi-code/en/customization/mcp), [configuration docs](https://moonshotai.github.io/kimi-code/en/configuration/config-files)). `connectors/kimi/machine.js:309,313` launches without a discovery override and accepts trust. Installed `kimi --help` exposes no switch to suppress those project inputs. No change invented; workspace tools may load.
- Pi discovers `.pi/settings.json` and `.pi/mcp.json`; its installed security documentation and `pi --help` identify the `--no-approve` control. Its initial session directory lookup exception is noted above.

No screenshots: this changes CLI launch arguments, not a visible screen.

## Validation

`node --check connectors/claude/machine.js machine/service.js machine/test/project-lead.test.js`

```
exit 0

```

`node --test machine/test/project-lead.test.js`

```
exit 0
  duration_ms: 152.393198
  type: 'test'
  ...
# machine service listening on 127.0.0.1:37645
# Subtest: start reuses and cleans clone and blocks pushing
ok 9 - start reuses and cleans clone and blocks pushing
  ---
  duration_ms: 210.295053
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43113
# Subtest: start survives unreachable origin and missing remote default
ok 10 - start survives unreachable origin and missing remote default
  ---
  duration_ms: 134.161435
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46501
# Subtest: start rejects unborn project and forbidden fields and root path
ok 11 - start rejects unborn project and forbidden fields and root path
  ---
  duration_ms: 80.706634
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40681
# Subtest: project lead relay and agent fence use the authenticated session
ok 12 - project lead relay and agent fence use the authenticated session
  ---
  duration_ms: 122.592801
  type: 'test'
  ...
# machine service listening on 127.0.0.1:44611
# Subtest: project lead records sandboxed Codex mode
ok 13 - project lead records sandboxed Codex mode
  ---
  duration_ms: 135.712722
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43631
# Subtest: account switch relaunches in the clone without project tools
ok 14 - account switch relaunches in the clone without project tools
  ---
  duration_ms: 153.346022
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43277
# Subtest: remote lacking the default branch uses the local default
ok 15 - remote lacking the default branch uses the local default
  ---
  duration_ms: 120.251245
  type: 'test'
  ...
# machine service listening on 127.0.0.1:35287
# Subtest: Claude project lead excludes project settings and MCP discovery
ok 16 - Claude project lead excludes project settings and MCP discovery
  ---
  duration_ms: 123.091365
  type: 'test'
  ...
# Subtest: Codex project lead disables project config by marking the clone untrusted
ok 17 - Codex project lead disables project config by marking the clone untrusted
  ---
  duration_ms: 0.22477
  type: 'test'
  ...
# Subtest: Pi project lead ignores project inputs
ok 18 - Pi project lead ignores project inputs
  ---
  duration_ms: 3.635862
  type: 'test'
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2724.805994
```

`bash machine/test/run.sh`

```
exit 0
ok 746 - archive waits once for a final sync and retains a failed copy
  ---
  duration_ms: 589.921746
  type: 'test'
  ...
# Subtest: sweep reconciles a dead lead with no apps
ok 747 - sweep reconciles a dead lead with no apps
  ---
  duration_ms: 916.906253
  type: 'test'
  ...
# Subtest: sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
ok 748 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
  ---
  duration_ms: 1268.559499
  type: 'test'
  ...
# Subtest: tracker close callback marks the copy used
ok 749 - tracker close callback marks the copy used
  ---
  duration_ms: 541.180034
  type: 'test'
  ...
# Subtest: sessions sharing a worktree share the copy and Windows tool use triggers stop sync
ok 750 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
  ---
  duration_ms: 944.304856
  type: 'test'
  ...
# Subtest: archive deletes copies while retaining conflict refs
ok 751 - archive deletes copies while retaining conflict refs
  ---
  duration_ms: 1062.669463
  type: 'test'
  ...
# Subtest: cleanup removes a vanished linked worktree copy without a reconcile
ok 752 - cleanup removes a vanished linked worktree copy without a reconcile
  ---
  duration_ms: 639.394726
  type: 'test'
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 753 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.705028
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 754 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 6.211369
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
ok 755 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 916.512009
  type: 'test'
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 756 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 547.581556
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
ok 757 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 926.997113
  type: 'test'
  ...
1..757
# tests 757
# suites 0
# pass 755
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 311608.182703
```

`node --test machine/test/codex-steps.test.js machine/test/project-mcp-codex.test.js machine/test/pi.test.js machine/test/pi-login.test.js machine/test/pi-turns.test.js machine/test/pi-guard.test.js machine/test/pi-spend.test.js`

```
exit 0
ok 49 - unsupported expansions skip only their server
  ---
  duration_ms: 2.020217
  type: 'test'
  ...
# Subtest: invalid names and headers are warned in priority order on one line
ok 50 - invalid names and headers are warned in priority order on one line
  ---
  duration_ms: 0.359559
  type: 'test'
  ...
# Subtest: never expands environment secrets into arguments or warnings
ok 51 - never expands environment secrets into arguments or warnings
  ---
  duration_ms: 0.263093
  type: 'test'
  ...
# Subtest: an http entry with stray stdio-shaped keys does not stop its siblings
ok 52 - an http entry with stray stdio-shaped keys does not stop its siblings
  ---
  duration_ms: 0.291498
  type: 'test'
  ...
# Subtest: control characters are escaped as TOML, not JSON
ok 53 - control characters are escaped as TOML, not JSON
  ---
  duration_ms: 0.336063
  type: 'test'
  ...
# Subtest: overrides too large for one command-line argument are dropped as a whole
ok 54 - overrides too large for one command-line argument are dropped as a whole
  ---
  duration_ms: 4.258232
  type: 'test'
  ...
# Subtest: headers translate by form and every override is redacted
ok 55 - headers translate by form and every override is redacted
  ---
  duration_ms: 1.220547
  type: 'test'
  ...
# Subtest: header and transport skips follow priority
ok 56 - header and transport skips follow priority
  ---
  duration_ms: 0.341383
  type: 'test'
  ...
# Subtest: budget counts UTF-8 bytes and names all dropped servers
ok 57 - budget counts UTF-8 bytes and names all dropped servers
  ---
  duration_ms: 0.37101
  type: 'test'
  ...
# Subtest: skips a reader-marked duplicate header without overrides
ok 58 - skips a reader-marked duplicate header without overrides
  ---
  duration_ms: 0.265859
  type: 'test'
  ...
# Subtest: exported Codex checks share the command rules
ok 59 - exported Codex checks share the command rules
  ---
  duration_ms: 0.769123
  type: 'test'
  ...
# Subtest: Windows stdio tools pass the bridge environment on WSL
ok 60 - Windows stdio tools pass the bridge environment on WSL
  ---
  duration_ms: 0.440463
  type: 'test'
  ...
1..60
# tests 60
# suites 0
# pass 60
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4690.853299
```

Mutation checks: each command below ran with the named control removed, exited 1, and was followed by restoring the code.

`break-claude`: `node --test --test-name-pattern='Claude project lead excludes' machine/test/project-lead.test.js`

```
exit 1
  name: 'AssertionError'
  expected:
    0: '--setting-sources'
    1: 'user'
  actual:
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-df22283a57e1-w15/machine/test/project-lead.test.js:267:12)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 249.143495
```

`break-strict`: `node --test --test-name-pattern='Claude project lead excludes' machine/test/project-lead.test.js`

```
exit 1
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-df22283a57e1-w15/machine/test/project-lead.test.js:268:12)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 249.676268
```

`break-codex`: `node --test --test-name-pattern='Codex project lead disables' machine/test/project-lead.test.js`

```
exit 1
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-df22283a57e1-w15/machine/test/project-lead.test.js:277:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 67.254321
```

`break-pi`: `node --test --test-name-pattern='Pi project lead ignores' machine/test/project-lead.test.js`

```
exit 1
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-df22283a57e1-w15/machine/test/project-lead.test.js:286:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 73.940957
```

## Choices

- `connectors/codex/machine.js`: use the existing per-project trust override with `untrusted` to suppress project configuration; the installed CLI confirmed this works.
- `connectors/pi/machine.js`: use `--no-approve`, preserving the explicit Wheelchair extension while declining project inputs.
