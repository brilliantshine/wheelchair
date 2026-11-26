# T4b — Folder tool launch wiring

The focused suites passed. The full viewer gate failed twice at `viewer/test/app-quiet.test.js:41`, so the task is blocked under the fail-twice rule. The stable-HEAD run passed the other 1,021 tests. The full machine suite also failed its connector name guard. It flagged T4’s shell-instructions CLI dispatch in `machine/service.js:1097`. The output of both gates is below.

## Changes

- `machine/service.js:976` identifies the shared project's own worktree with the same GitHub-origin matcher used to select the shared clone. The prior check used Git's rewritten URL alone. With an `insteadOf` rewrite to a local remote, the thread received the shared copy alongside its own worktree tools. The regression reproduced the wrong pin before the fix.
- `machine/service.js:985` retains the earlier T4b cleanup rule. Tests now verify that live, recovered, switching and in-progress sessions protect their copies. Records with an `ended_at` timestamp or an `ended`, `stopped` or `failed` status do not protect old copies.
- `viewer/test/app-shared-tools-setting.test.js:46` posts a machine-shaped account-switch `ready` event over HTTP. The route returns 202 for a newly accepted event. The test reads persisted cards through `Hub.thread()`, asserts both problem lines appear, then posts a clean `ready` event and checks that it closes the same card.
- `machine/test/folder-tools-run.test.js:74` already had the requested bridge test against an immutable Git copy. It ran as a non-root user, and the deliberate writable-copy mutation made it fail.

## Launch test matrix

All machine launch cases below are in `machine/test/folder-tools-launch.test.js`.

| Case | Test and line |
| --- | --- |
| No `.mcp.json` on Claude | `claude launches a script bridge and standalone server without .mcp.json`, line 129. Reads the file named by `--mcp-config`. |
| No `.mcp.json` on unrestricted Codex and 260-second bridge timeout | `codex launches a script bridge and standalone server without .mcp.json`, line 129. Reads the actual tmux launch command and checks the overrides and `tool_timeout_sec=260`. |
| No `.mcp.json` on Antigravity | `agy launches a script bridge and standalone server without .mcp.json`, line 129. Reads the plugin from the actual `--add-dir`. |
| All tools invalid without `.mcp.json`, then a clean start | `all invalid folder tools are reported without .mcp.json and clear on a clean start`, line 163. Tests both lines, their reasons and a later empty folder list. The hub test at `viewer/test/app-shared-tools-setting.test.js:46` tests opening and closing the card with the machine-shaped state. |
| Codex budget preserves `.mcp.json` | `Codex keeps .mcp.json entries when folder entries exceed the launch budget`, line 182. The existing server stays, the oversized bridge is reported, and the next smaller folder entry still loads. |
| Codex sandbox entry and warning rules | `sandboxed Codex omits folder entries and warns only with a usable folder tool`, line 198. The unrestricted start loads the server, the sandboxed start warns, and the next sandboxed start with only an invalid tool clears that warning. |
| Roles and precedence | `reviewers and mappers get no folder tools`, line 216. `.mcp.json entries win over a folder server and the script bridge`, line 226. `a project tool hides a shared tool with the same name`, line 398. |
| Shell instructions with a usable script only | `shell instructions require a usable script on Kimi, Pi or sandboxed Codex and are not rewritten on resume`, line 243. Checks exact text, a missing executable, no line on unrestricted Codex and Claude, and no prompt rewrite or pending initial message on resume. |
| Pinned copies and rediscovery on resume and switch, after choosing another repository or clearing Settings | `resume and account switch reuse the saved commit and offer edited project tools`, line 273. Reads the saved session, advances the original repository, starts sessions with alternate and cleared choices, and queries both relaunches' real bridge for the offered descriptions. |
| Account-switch ready state reaches the problems card | Same machine test at line 273. Runs `runSwitch` and `checkReady`; checks `switch_id`, `created_at`, sequence and changed problem state. The matching switch event and subsequent clean event update the persisted card at `viewer/test/app-shared-tools-setting.test.js:46`. |
| Cleanup of old per-commit copies | `copy cleanup preserves live, recovered and starting pins and drops ended records`, line 350. |
| Shared project's own thread | `the shared project's own thread skips the shared copy and uses its worktree`, line 383. |
| One deadline for default branch and fetch, stalled Git killed and launch completes | `the shared refresh deadline kills a stalled git ls-remote and launch completes` and `the shared refresh deadline kills a stalled git fetch and launch completes`, line 412. The second spends part of the budget in branch discovery before stalling fetch; both verify the stalled PID is gone. |
| Failed partial build and fallback | `a partial copy never publishes and launch uses the newest complete copy if present`, line 437. Checks both early failure with no fallback and later failure with a complete old copy. |
| Simultaneous starts refresh once and later start advances pointer | `two concurrent starts share one refresh and a later refresh advances the pointer`, line 466. Counts fetches from two overlapping starts, then checks the pointer after a later commit. |
| Agent endpoint exposes the saved pin | `agent tools endpoint and wc tool list use the session pin`, line 489. Checks token authorization, response and CLI discovery. |

## Deliberate break-and-restore checks

Each test named below failed with the listed behavior broken in a scratch checkout. The production source was restored after every check. The source fix for a rewritten origin also failed against the original code in the working checkout.

- `claude launches a script bridge and standalone server without .mcp.json` and `codex launches a script bridge and standalone server without .mcp.json` and `agy launches a script bridge and standalone server without .mcp.json` failed with the `connector-input` mutation.
- `codex launches a script bridge and standalone server without .mcp.json` failed with the `bridge-timeout` mutation.
- `all invalid folder tools are reported without .mcp.json and clear on a clean start` failed with the `invalid-lines` mutation.
- `all invalid folder tools are reported without .mcp.json and clear on a clean start` failed with the `clear-lines` mutation.
- `Codex keeps .mcp.json entries when folder entries exceed the launch budget` failed with the `budget` mutation.
- `sandboxed Codex omits folder entries and warns only with a usable folder tool` failed with the `sandbox-entry` mutation.
- `sandboxed Codex omits folder entries and warns only with a usable folder tool` failed with the `sandbox-empty` mutation.
- `reviewers and mappers get no folder tools` failed with the `roles` mutation.
- `.mcp.json entries win over a folder server and the script bridge` failed with the `mcp-precedence` mutation.
- `shell instructions require a usable script on Kimi, Pi or sandboxed Codex and are not rewritten on resume` failed with the `instructions-script` mutation.
- `shell instructions require a usable script on Kimi, Pi or sandboxed Codex and are not rewritten on resume` failed with the `instructions-cli` mutation.
- `shell instructions require a usable script on Kimi, Pi or sandboxed Codex and are not rewritten on resume` failed with the `instructions-resume` mutation.
- `resume and account switch reuse the saved commit and offer edited project tools` failed with the `pin-on-resume` mutation.
- `resume and account switch reuse the saved commit and offer edited project tools` failed with the `rediscovery` mutation.
- `resume and account switch reuse the saved commit and offer edited project tools` failed with the `ready-event` mutation.
- `copy cleanup preserves live, recovered and starting pins and drops ended records` failed with the `cleanup-ended` mutation.
- `copy cleanup preserves live, recovered and starting pins and drops ended records` failed with the `cleanup-live` mutation.
- `copy cleanup preserves live, recovered and starting pins and drops ended records` failed with the `cleanup-starting` mutation.
- `the shared project's own thread skips the shared copy and uses its worktree` failed with the `own-project` mutation.
- `a project tool hides a shared tool with the same name` failed with the `shared-precedence` mutation.
- `the shared refresh deadline kills a stalled git ls-remote and launch completes` and `the shared refresh deadline kills a stalled git fetch and launch completes` failed with the `refresh-deadline` mutation.
- `the shared refresh deadline kills a stalled git fetch and launch completes` failed with the `fetch-local-deadline` mutation.
- `a partial copy never publishes and launch uses the newest complete copy if present` failed with the `copy-fallback` mutation.
- `two concurrent starts share one refresh and a later refresh advances the pointer` failed with the `refresh-lock` mutation.
- `two concurrent starts share one refresh and a later refresh advances the pointer` failed with the `pointer-advance` mutation.
- `bridge runs a shared copy without writing in its tool folder` failed with the `read-only-copy` mutation.
- `agent tools endpoint and wc tool list use the session pin` failed with the `tools-endpoint` mutation.
- `shared tools setting defaults, validates and saves` failed with the `setting-default` mutation.
- `shared tools setting defaults, validates and saves` failed with the `setting-validation` mutation.
- `shared tools setting defaults, validates and saves` failed with the `setting-clear` mutation.
- `folder problem lines appear and clear on a newer update` failed with the `card-folder-lines` mutation.
- `session start sends this machine’s saved paths in order and omits an unset choice` failed with the `start-choice` mutation.
- `ready event updates folder problem card` failed with the `hub-ready` mutation.

## Choices

- `machine/service.js` uses the existing origin matcher for the worktree and saved candidates so local Git URL rewrites get the same treatment.
- `machine/test/folder-tools-launch.test.js` drives `startIn` with a pre-created worktree, local bare Git remotes and tmux and CLI shims. It inspects the generated files and the launch command captured by fake tmux.
- `machine/test/folder-tools-launch.test.js` uses shell-escaped apostrophes to exercise the distinct 32 KiB project-file and 64 KiB Codex launch budgets.
- `machine/test/folder-tools-launch.test.js` writes a partial file in the temporary copy before forcing extraction to fail; its deadline cases shorten the existing injectable 20-second refresh limit to two seconds.

## Validation

### `node --test machine/test/folder-tools-launch.test.js machine/test/folder-tools-run.test.js`

```text
exit 0
TAP version 13
# Subtest: claude launches a script bridge and standalone server without .mcp.json
ok 1 - claude launches a script bridge and standalone server without .mcp.json
  ---
  duration_ms: 39.183851
  type: 'test'
  ...
# Subtest: codex launches a script bridge and standalone server without .mcp.json
ok 2 - codex launches a script bridge and standalone server without .mcp.json
  ---
  duration_ms: 22.197085
  type: 'test'
  ...
# Subtest: agy launches a script bridge and standalone server without .mcp.json
ok 3 - agy launches a script bridge and standalone server without .mcp.json
  ---
  duration_ms: 21.479436
  type: 'test'
  ...
# Subtest: all invalid folder tools are reported without .mcp.json and clear on a clean start
ok 4 - all invalid folder tools are reported without .mcp.json and clear on a clean start
  ---
  duration_ms: 34.867449
  type: 'test'
  ...
# wc-test-1: project tools: tool wheelchair-tools: left out on Codex: over Codex's launch size limit
# Subtest: Codex keeps .mcp.json entries when folder entries exceed the launch budget
ok 5 - Codex keeps .mcp.json entries when folder entries exceed the launch budget
  ---
  duration_ms: 35.675611
  type: 'test'
  ...
# wc-test-2: project tools: folder tools run from the shell here (`wc.js tool run`); server tools need Codex set to unrestricted
# Subtest: sandboxed Codex omits folder entries and warns only with a usable folder tool
ok 6 - sandboxed Codex omits folder entries and warns only with a usable folder tool
  ---
  duration_ms: 44.334636
  type: 'test'
  ...
# Subtest: reviewers and mappers get no folder tools
ok 7 - reviewers and mappers get no folder tools
  ---
  duration_ms: 30.210671
  type: 'test'
  ...
# Subtest: .mcp.json entries win over a folder server and the script bridge
ok 8 - .mcp.json entries win over a folder server and the script bridge
  ---
  duration_ms: 19.415492
  type: 'test'
  ...
# wc-test-1: project tools: server tools don't work on Kimi Code: server
# wc-test-2: project tools: server tools don't work on Pi: server
# wc-test-3: project tools: folder tools run from the shell here (`wc.js tool run`); server tools need Codex set to unrestricted
# wc-test-4: project tools: server tools don't work on Kimi Code: server
# wc-test-4: project tools: server tools don't work on Kimi Code: server
# wc-test-5: project tools: server tools don't work on Pi: server
# wc-test-5: project tools: server tools don't work on Pi: server
# wc-test-6: project tools: folder tools run from the shell here (`wc.js tool run`); server tools need Codex set to unrestricted
# wc-test-6: project tools: folder tools run from the shell here (`wc.js tool run`); server tools need Codex set to unrestricted
# Subtest: shell instructions require a usable script on Kimi, Pi or sandboxed Codex and are not rewritten on resume
ok 9 - shell instructions require a usable script on Kimi, Pi or sandboxed Codex and are not rewritten on resume
  ---
  duration_ms: 148.891865
  type: 'test'
  ...
# Subtest: resume and account switch reuse the saved commit and offer edited project tools
ok 10 - resume and account switch reuse the saved commit and offer edited project tools
  ---
  duration_ms: 414.086632
  type: 'test'
  ...
# Subtest: copy cleanup preserves live, recovered and starting pins and drops ended records
ok 11 - copy cleanup preserves live, recovered and starting pins and drops ended records
  ---
  duration_ms: 202.321234
  type: 'test'
  ...
# Subtest: the shared project's own thread skips the shared copy and uses its worktree
ok 12 - the shared project's own thread skips the shared copy and uses its worktree
  ---
  duration_ms: 135.978254
  type: 'test'
  ...
# Subtest: a project tool hides a shared tool with the same name
ok 13 - a project tool hides a shared tool with the same name
  ---
  duration_ms: 131.502775
  type: 'test'
  ...
# Subtest: the shared refresh deadline kills a stalled git ls-remote and launch completes
ok 14 - the shared refresh deadline kills a stalled git ls-remote and launch completes
  ---
  duration_ms: 2085.251869
  type: 'test'
  ...
# Subtest: the shared refresh deadline kills a stalled git fetch and launch completes
ok 15 - the shared refresh deadline kills a stalled git fetch and launch completes
  ---
  duration_ms: 2086.929977
  type: 'test'
  ...
# wc-test-3: shared tools: tar failed: fixture-extraction-failed
# Subtest: a partial copy never publishes and launch uses the newest complete copy if present
ok 16 - a partial copy never publishes and launch uses the newest complete copy if present
  ---
  duration_ms: 274.179999
  type: 'test'
  ...
# Subtest: two concurrent starts share one refresh and a later refresh advances the pointer
ok 17 - two concurrent starts share one refresh and a later refresh advances the pointer
  ---
  duration_ms: 2232.362676
  type: 'test'
  ...
# Subtest: agent tools endpoint and wc tool list use the session pin
ok 18 - agent tools endpoint and wc tool list use the session pin
  ---
  duration_ms: 185.996828
  type: 'test'
  ...
# Subtest: bridge schema, call, environment and changed description
ok 19 - bridge schema, call, environment and changed description
  ---
  duration_ms: 64.688692
  type: 'test'
  ...
# Subtest: runner errors, stderr tail and output cap
ok 20 - runner errors, stderr tail and output cap
  ---
  duration_ms: 58.262756
  type: 'test'
  ...
# Subtest: handshake lists tools and times out on silent server
ok 21 - handshake lists tools and times out on silent server
  ---
  duration_ms: 1026.375604
  type: 'test'
  ...
# Subtest: timeout kills the script process group
ok 22 - timeout kills the script process group
  ---
  duration_ms: 1006.907463
  type: 'test'
  ...
# Subtest: bridge stdin stops tool group
ok 23 - bridge stdin stops tool group
  ---
  duration_ms: 106.154735
  type: 'test'
  ...
# Subtest: bridge signal stops tool group
ok 24 - bridge signal stops tool group
  ---
  duration_ms: 105.900928
  type: 'test'
  ...
# Subtest: launcher stdin close stops server group
ok 25 - launcher stdin close stops server group
  ---
  duration_ms: 104.511067
  type: 'test'
  ...
# Subtest: bridge reports exit code and stderr
ok 26 - bridge reports exit code and stderr
  ---
  duration_ms: 54.318116
  type: 'test'
  ...
# Subtest: handshake deadline kills server descendants
ok 27 - handshake deadline kills server descendants
  ---
  duration_ms: 1006.376081
  type: 'test'
  ...
# Subtest: launcher SIGTERM stops server group
ok 28 - launcher SIGTERM stops server group
  ---
  duration_ms: 106.457786
  type: 'test'
  ...
# Subtest: launcher errors and required project directory
ok 29 - launcher errors and required project directory
  ---
  duration_ms: 132.36522
  type: 'test'
  ...
# Subtest: launcher drains output and propagates child exit
ok 30 - launcher drains output and propagates child exit
  ---
  duration_ms: 55.443006
  type: 'test'
  ...
# Subtest: launcher serves MCP round trip and stdio methods
ok 31 - launcher serves MCP round trip and stdio methods
  ---
  duration_ms: 43.71226
  type: 'test'
  ...
# Subtest: parallel bridge calls complete
ok 32 - parallel bridge calls complete
  ---
  duration_ms: 249.854339
  type: 'test'
  ...
# Subtest: exited script cannot leave pipes open
ok 33 - exited script cannot leave pipes open
  ---
  duration_ms: 2030.618048
  type: 'test'
  ...
# Subtest: timeout stays active while exited script leaves pipes open
ok 34 - timeout stays active while exited script leaves pipes open
  ---
  duration_ms: 1005.790826
  type: 'test'
  ...
# Subtest: SIGKILL follows timeout when script ignores SIGTERM
ok 35 - SIGKILL follows timeout when script ignores SIGTERM
  ---
  duration_ms: 6030.420858
  type: 'test'
  ...
# Subtest: launcher waits for stdout after child exit
ok 36 - launcher waits for stdout after child exit
  ---
  duration_ms: 2028.890155
  type: 'test'
  ...
# Subtest: handshake returns cancelled for an already aborted signal without starting
ok 37 - handshake returns cancelled for an already aborted signal without starting
  ---
  duration_ms: 0.647504
  type: 'test'
  ...
# Subtest: handshake abort stops an unresponsive server and its grandchild
ok 38 - handshake abort stops an unresponsive server and its grandchild
  ---
  duration_ms: 55.254099
  type: 'test'
  ...
# Subtest: handshake abort discards a partial initialize response
ok 39 - handshake abort discards a partial initialize response
  ---
  duration_ms: 54.982376
  type: 'test'
  ...
# Subtest: bridge runs a shared copy without writing in its tool folder
ok 40 - bridge runs a shared copy without writing in its tool folder
  ---
  duration_ms: 133.910896
  type: 'test'
  ...
1..40
# tests 40
# suites 0
# pass 40
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15518.89287
```

### `node --test machine/test/project-mcp.test.js machine/test/project-mcp-codex.test.js machine/test/project-mcp-agy.test.js machine/test/project-tools-service.test.js`

```text
exit 0
TAP version 13
# Subtest: translates only transport fields into private plugin file descriptions
ok 1 - translates only transport fields into private plugin file descriptions
  ---
  duration_ms: 3.345247
  type: 'test'
  ...
# Subtest: skips unsupported entries in precedence order without exposing values
ok 2 - skips unsupported entries in precedence order without exposing values
  ---
  duration_ms: 0.830054
  type: 'test'
  ...
# Subtest: skips a reader-marked duplicate header without a plugin
ok 3 - skips a reader-marked duplicate header without a plugin
  ---
  duration_ms: 0.360323
  type: 'test'
  ...
# Subtest: folder entries alone create the plugin and are loaded
ok 4 - folder entries alone create the plugin and are loaded
  ---
  duration_ms: 0.500912
  type: 'test'
  ...
# Subtest: missing project tools leave the existing command unchanged
ok 5 - missing project tools leave the existing command unchanged
  ---
  duration_ms: 2.01458
  type: 'test'
  ...
# Subtest: translates stdio and http servers in order
ok 6 - translates stdio and http servers in order
  ---
  duration_ms: 1.251945
  type: 'test'
  ...
# Subtest: reviewer receives neither overrides nor warnings
ok 7 - reviewer receives neither overrides nor warnings
  ---
  duration_ms: 0.30185
  type: 'test'
  ...
# Subtest: unsupported expansions skip only their server
ok 8 - unsupported expansions skip only their server
  ---
  duration_ms: 1.89471
  type: 'test'
  ...
# Subtest: invalid names and headers are warned in priority order on one line
ok 9 - invalid names and headers are warned in priority order on one line
  ---
  duration_ms: 0.349952
  type: 'test'
  ...
# Subtest: never expands environment secrets into arguments or warnings
ok 10 - never expands environment secrets into arguments or warnings
  ---
  duration_ms: 0.257555
  type: 'test'
  ...
# Subtest: an http entry with stray stdio-shaped keys does not stop its siblings
ok 11 - an http entry with stray stdio-shaped keys does not stop its siblings
  ---
  duration_ms: 0.27078
  type: 'test'
  ...
# Subtest: control characters are escaped as TOML, not JSON
ok 12 - control characters are escaped as TOML, not JSON
  ---
  duration_ms: 0.268266
  type: 'test'
  ...
# Subtest: overrides too large for one command-line argument are dropped as a whole
ok 13 - overrides too large for one command-line argument are dropped as a whole
  ---
  duration_ms: 3.040973
  type: 'test'
  ...
# Subtest: headers translate by form and every override is redacted
ok 14 - headers translate by form and every override is redacted
  ---
  duration_ms: 0.901021
  type: 'test'
  ...
# Subtest: header and transport skips follow priority
ok 15 - header and transport skips follow priority
  ---
  duration_ms: 0.356766
  type: 'test'
  ...
# Subtest: budget counts UTF-8 bytes and names all dropped servers
ok 16 - budget counts UTF-8 bytes and names all dropped servers
  ---
  duration_ms: 0.355182
  type: 'test'
  ...
# Subtest: skips a reader-marked duplicate header without overrides
ok 17 - skips a reader-marked duplicate header without overrides
  ---
  duration_ms: 0.227677
  type: 'test'
  ...
# Subtest: exported Codex checks share the command rules
ok 18 - exported Codex checks share the command rules
  ---
  duration_ms: 0.800628
  type: 'test'
  ...
# Subtest: Windows stdio tools pass the bridge environment on WSL
ok 19 - Windows stdio tools pass the bridge environment on WSL
  ---
  duration_ms: 0.488719
  type: 'test'
  ...
# Subtest: folder entries respect sandbox, order, budget and validation
ok 20 - folder entries respect sandbox, order, budget and validation
  ---
  duration_ms: 1.904489
  type: 'test'
  ...
# Subtest: missing file preserves both adapters and roles
ok 21 - missing file preserves both adapters and roles
  ---
  duration_ms: 14.648051
  type: 'test'
  ...
# Subtest: valid servers enabled for worker and disabled for reviewer
ok 22 - valid servers enabled for worker and disabled for reviewer
  ---
  duration_ms: 2.872508
  type: 'test'
  ...
# Subtest: broken documents leave settings unchanged
ok 23 - broken documents leave settings unchanged
  ---
  duration_ms: 1.605615
  type: 'test'
  ...
# Subtest: invalid entries are disabled independently, including when all are invalid
ok 24 - invalid entries are disabled independently, including when all are invalid
  ---
  duration_ms: 1.97291
  type: 'test'
  ...
# Subtest: non-regular and oversized files are rejected without opening
ok 25 - non-regular and oversized files are rejected without opening
  ---
  duration_ms: 4.181282
  type: 'test'
  ...
# Subtest: service start logs warnings only for tool roles
ok 26 - service start logs warnings only for tool roles
  ---
  duration_ms: 80.449005
  type: 'test'
  ...
# Subtest: shared document and entry validators report the reader reasons
ok 27 - shared document and entry validators report the reader reasons
  ---
  duration_ms: 0.492747
  type: 'test'
  ...
# Subtest: Claude adds folder entries alone and beside replacements only when tools are enabled
ok 28 - Claude adds folder entries alone and beside replacements only when tools are enabled
  ---
  duration_ms: 1.195517
  type: 'test'
  ...
# Subtest: Kimi and Pi warn only for folder servers when tools are enabled
ok 29 - Kimi and Pi warn only for folder servers when tools are enabled
  ---
  duration_ms: 29.286103
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-228895a4ce07.slice
# Subtest: project tools launch privately and stale Antigravity files are swept
ok 30 - project tools launch privately and stale Antigravity files are swept
  ---
  duration_ms: 179.899905
  type: 'test'
  ...
# Subtest: sweep protects the live underscore record over a stopped dot record
ok 31 - sweep protects the live underscore record over a stopped dot record
  ---
  duration_ms: 6.159082
  type: 'test'
  ...
# Subtest: sweep protects the live dot record over a stopped underscore record
ok 32 - sweep protects the live dot record over a stopped underscore record
  ---
  duration_ms: 6.015757
  type: 'test'
  ...
# Subtest: a refused start is retained only for the grace period
ok 33 - a refused start is retained only for the grace period
  ---
  duration_ms: 4.462123
  type: 'test'
  ...
# Subtest: the newest non-stopped record wins a collision
ok 34 - the newest non-stopped record wins a collision
  ---
  duration_ms: 4.230407
  type: 'test'
  ...
# Subtest: without records the exact spelling wins, or a lone rewritten name survives
ok 35 - without records the exact spelling wins, or a lone rewritten name survives
  ---
  duration_ms: 8.148916
  type: 'test'
  ...
# Subtest: non-live entries respect grace and an unknown tmux state removes nothing
ok 36 - non-live entries respect grace and an unknown tmux state removes nothing
  ---
  duration_ms: 5.940583
  type: 'test'
  ...
1..36
# tests 36
# suites 0
# pass 36
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 652.902938
```

### `node --test viewer/test/app-shared-tools-setting.test.js viewer/test/app-project-tools-card.test.js`

```text
exit 0
TAP version 13
# Subtest: card opens, keeps id on same names, replaces on different names, closes on reset
ok 1 - card opens, keeps id on same names, replaces on different names, closes on reset
  ---
  duration_ms: 1304.450399
  type: 'test'
  ...
# Subtest: per-CLI and program lines are kept apart; a file line uses the name file
ok 2 - per-CLI and program lines are kept apart; a file line uses the name file
  ---
  duration_ms: 595.665656
  type: 'test'
  ...
# Subtest: more than 20 lines shows and N more; duplicates by text drop
ok 3 - more than 20 lines shows and N more; duplicates by text drop
  ---
  duration_ms: 566.966462
  type: 'test'
  ...
# Subtest: a line with underscores is kept byte-for-byte in items
ok 4 - a line with underscores is kept byte-for-byte in items
  ---
  duration_ms: 535.934838
  type: 'test'
  ...
# Subtest: seq and boot ordering
ok 5 - seq and boot ordering
  ---
  duration_ms: 1312.147669
  type: 'test'
  ...
# Subtest: project_tools is not left on the session record
ok 6 - project_tools is not left on the session record
  ---
  duration_ms: 881.45196
  type: 'test'
  ...
# Subtest: applied in a queued promotion and in resumeUnanswered, without re-taking the lock
ok 7 - applied in a queued promotion and in resumeUnanswered, without re-taking the lock
  ---
  duration_ms: 633.316563
  type: 'test'
  ...
# Subtest: default wc.js session list shows project_tools on the lead entry
ok 8 - default wc.js session list shows project_tools on the lead entry
  ---
  duration_ms: 50.937487
  type: 'test'
  ...
# Subtest: with two lead sessions only the newest lead carries project_tools in the hub list
ok 9 - with two lead sessions only the newest lead carries project_tools in the hub list
  ---
  duration_ms: 629.256733
  type: 'test'
  ...
# Subtest: a new thread gets the default project_tools record when the machine start answer has none
ok 10 - a new thread gets the default project_tools record when the machine start answer has none
  ---
  duration_ms: 393.294122
  type: 'test'
  ...
# Subtest: a handoff import creates a thread with the default project_tools, even when the lead cannot start
ok 11 - a handoff import creates a thread with the default project_tools, even when the lead cannot start
  ---
  duration_ms: 11.886236
  type: 'test'
  ...
# Subtest: dismissed project tools card stays closed until problem names change
ok 12 - dismissed project tools card stays closed until problem names change
  ---
  duration_ms: 1034.271945
  type: 'test'
  ...
# Subtest: shared tools setting defaults, validates and saves
ok 13 - shared tools setting defaults, validates and saves
  ---
  duration_ms: 373.599923
  type: 'test'
  ...
# Subtest: folder problem lines appear and clear on a newer update
ok 14 - folder problem lines appear and clear on a newer update
  ---
  duration_ms: 1.358874
  type: 'test'
  ...
# Subtest: session start sends this machine’s saved paths in order and omits an unset choice
ok 15 - session start sends this machine’s saved paths in order and omits an unset choice
  ---
  duration_ms: 456.578968
  type: 'test'
  ...
# Subtest: ready event updates folder problem card
ok 16 - ready event updates folder problem card
  ---
  duration_ms: 284.582226
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10791.648839
```

### `node test-support/pick-tests.js --base 8440ad7204dd9bd3448473043d396a011b554f3d`

```text
exit 0
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
bash machine/test/run.sh
node --test test-support/test/*.test.js
bash sensitivity/test/run.sh
bash codex/test/run.sh
bash install/test/run.sh
python3 -m unittest discover -s sudo-helper/test
bash sudo-helper/test/install-test.sh
```

### `bash machine/test/run.sh`

The broad machine run started before the final test-only change to seed the sandbox warning. The focused machine suite above ran with that change.

```text
exit 1
1..823
# tests 823
# suites 0
# pass 820
# fail 1
# cancelled 0
# skipped 2
# todo 0
# duration_ms 351503.971231
```

Failure output

```text
not ok 188 - tool names do not dispatch outside connectors
  ---
  duration_ms: 893.774763
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/machine/test/name-guard.test.js:143:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected

    + [
    +   "machine/service.js:1097: if (!resume && scriptRows.length && (['kimi', 'pi'].includes(session.cli) || (session.cli === 'codex' && adapters.codex.sandboxed(session)))) lines.push(`Folder tools: this session can't call them through MCP. Run \\`node ${ROOT}/viewer/app/wc.js tool list\\` to see them and \\`node ${ROOT}/viewer/app/wc.js tool run <name> --input '<json>'\\` to run a script tool; give that shell command a timeout longer than the tool's timeout_seconds (default 120 s).`);",
    +   "machine/service.js:1097: if (!resume && scriptRows.length && (['kimi', 'pi'].includes(session.cli) || (session.cli === 'codex' && adapters.codex.sandboxed(session)))) lines.push(`Folder tools: this session can't call them through MCP. Run \\`node ${ROOT}/viewer/app/wc.js tool list\\` to see them and \\`node ${ROOT}/viewer/app/wc.js tool run <name> --input '<json>'\\` to run a script tool; give that shell command a timeout longer than the tool's timeout_seconds (default 120 s).`);",
    +   "machine/service.js:1097: if (!resume && scriptRows.length && (['kimi', 'pi'].includes(session.cli) || (session.cli === 'codex' && adapters.codex.sandboxed(session)))) lines.push(`Folder tools: this session can't call them through MCP. Run \\`node ${ROOT}/viewer/app/wc.js tool list\\` to see them and \\`node ${ROOT}/viewer/app/wc.js tool run <name> --input '<json>'\\` to run a script tool; give that shell command a timeout longer than the tool's timeout_seconds (default 120 s).`);",
    +   "machine/service.js:1097: if (!resume && scriptRows.length && (['kimi', 'pi'].includes(session.cli) || (session.cli === 'codex' && adapters.codex.sandboxed(session)))) lines.push(`Folder tools: this session can't call them through MCP. Run \\`node ${ROOT}/viewer/app/wc.js tool list\\` to see them and \\`node ${ROOT}/viewer/app/wc.js tool run <name> --input '<json>'\\` to run a script tool; give that shell command a timeout longer than the tool's timeout_seconds (default 120 s).`);"
    + ]
    - []

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual:
    0: "machine/service.js:1097: if (!resume && scriptRows.length && (['kimi', 'pi'].includes(session.cli) || (session.cli === 'codex' && adapters.codex.sandboxed(session)))) lines.push(`Folder tools: this session can't call them through MCP. Run \\`node ${ROOT}/viewer/app/wc.js tool list\\` to see them and \\`node ${ROOT}/viewer/app/wc.js tool run <name> --input '<json>'\\` to run a script tool; give that shell command a timeout longer than the tool's timeout_seconds (default 120 s).`);"
    1: "machine/service.js:1097: if (!resume && scriptRows.length && (['kimi', 'pi'].includes(session.cli) || (session.cli === 'codex' && adapters.codex.sandboxed(session)))) lines.push(`Folder tools: this session can't call them through MCP. Run \\`node ${ROOT}/viewer/app/wc.js tool list\\` to see them and \\`node ${ROOT}/viewer/app/wc.js tool run <name> --input '<json>'\\` to run a script tool; give that shell command a timeout longer than the tool's timeout_seconds (default 120 s).`);"
    2: "machine/service.js:1097: if (!resume && scriptRows.length && (['kimi', 'pi'].includes(session.cli) || (session.cli === 'codex' && adapters.codex.sandboxed(session)))) lines.push(`Folder tools: this session can't call them through MCP. Run \\`node ${ROOT}/viewer/app/wc.js tool list\\` to see them and \\`node ${ROOT}/viewer/app/wc.js tool run <name> --input '<json>'\\` to run a script tool; give that shell command a timeout longer than the tool's timeout_seconds (default 120 s).`);"
    3: "machine/service.js:1097: if (!resume && scriptRows.length && (['kimi', 'pi'].includes(session.cli) || (session.cli === 'codex' && adapters.codex.sandboxed(session)))) lines.push(`Folder tools: this session can't call them through MCP. Run \\`node ${ROOT}/viewer/app/wc.js tool list\\` to see them and \\`node ${ROOT}/viewer/app/wc.js tool run <name> --input '<json>'\\` to run a script tool; give that shell command a timeout longer than the tool's timeout_seconds (default 120 s).`);"
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/machine/test/name-guard.test.js:147:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
```

### `node --test viewer/test/*.test.js — first run`

This run overlapped commits. It reported six failures. I terminated the isolated remote-plan fixture and its test server after the fixture failed to create a thread and left the server running. The runner then emitted its final summary.

```text
exit 1
1..1006
# tests 1022
# suites 0
# pass 1016
# fail 6
# cancelled 0
# skipped 0
# todo 0
# duration_ms 163703.028197
```

Failure output

```text
not ok 205 - held peer messages follow context in normal and imported restart
  ---
  duration_ms: 2120.398478
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-handoff-restart.test.js:238:1'
  failureType: 'testCodeFailure'
  error: 'machine service out of date'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    appError (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/app/state.js:14:17)
    startSession (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/app/sessions.js:349:55)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Object.restartLead (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/app/threads.js:187:16)
  ...
not ok 510 - seq and boot ordering
  ---
  duration_ms: 1480.404418
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-project-tools-card.test.js:101:1'
  failureType: 'testCodeFailure'
  error: 'thread not found'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    appError (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/app/state.js:14:17)
    State.thread (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/app/state.js:138:24)
    async Hub.thread (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/app/hub.js:128:37)
    async /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-project-tools-card.test.js:38:22
  ...
not ok 537 - 6 message clears debt
  ---
  duration_ms: 2593.887663
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-quiet.test.js:41:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:

    1 !== 0

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 0
  actual: 1
  operator: 'strictEqual'
  stack: |-
    /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-quiet.test.js:41:164
    async run (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-quiet.test.js:31:77)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
not ok 562 - real plan-file callers do not start or await machine requests under a thread lock
  ---
  duration_ms: 7517.166584
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-remote-plan.test.js:66:1'
  failureType: 'testCodeFailure'
  error: "ENOENT: no such file or directory, open '/tmp/wheelchair-test-run-1307039-XsCWWF/app-state-tQS8kF/threads/undefined.json'"
  code: 'ENOENT'
  stack: |-
    async open (node:internal/fs/promises:639:25)
    async Object.readFile (node:internal/fs/promises:1252:14)
    async remoteContext (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-remote-plan.test.js:13:29)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-remote-plan.test.js:71:27)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
not ok 658 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 4368.803521
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-uploads-archive.test.js:65:1'
  failureType: 'testCodeFailure'
  error: |-
    The expression evaluated to a falsy value:

      assert.ok(Object.values(context.instance.sessions).some(session => session.thread_id === made.id && session.role === 'lead'))

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-uploads-archive.test.js:72:12)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
not ok 699 - assistant actions authenticate, list, send, press, restart and archive
  ---
  duration_ms: 1025.938889
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/assistant.test.js:89:1'
  failureType: 'testCodeFailure'
  error: "Cannot read properties of undefined (reading '0')"
  code: 'ERR_TEST_FAILURE'
  name: 'TypeError'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/assistant.test.js:94:45)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
```

### `node --test viewer/test/*.test.js — stable-HEAD rerun`

The same `6 message clears debt` assertion failed again. I stopped retrying this suite under the fail-twice rule.

```text
exit 1
1..1006
# tests 1022
# suites 0
# pass 1021
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 72231.556194
```

Failure output

```text
not ok 537 - 6 message clears debt
  ---
  duration_ms: 1876.782629
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-quiet.test.js:41:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:

    1 !== 0

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 0
  actual: 1
  operator: 'strictEqual'
  stack: |-
    /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-quiet.test.js:41:164
    async run (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-quiet.test.js:31:77)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
```
