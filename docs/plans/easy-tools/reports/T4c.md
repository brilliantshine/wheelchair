# T4c: move shell-tools-only decision into connectors

## Diff summary

- `connectors/kimi/machine.js`: added `shellToolsOnly() { return true; }` to the machine adapter.
- `connectors/pi/machine.js`: added `shellToolsOnly() { return true; }` to the machine adapter.
- `connectors/codex/machine.js`: added `shellToolsOnly` delegating to the adapter's `sandboxed` method.
- `machine/service.js`: replaced the CLI-name conditional with the optional adapter method; the pushed instruction text is unchanged.

## Validation

Command:

```sh
node --test machine/test/name-guard.test.js machine/test/folder-tools-launch.test.js machine/test/project-mcp-codex.test.js
```

Full output:

```text
exit 0
TAP version 13
# Subtest: claude launches a script bridge and standalone server without .mcp.json
ok 1 - claude launches a script bridge and standalone server without .mcp.json
  ---
  duration_ms: 58.062877
  type: 'test'
  ...
# Subtest: codex launches a script bridge and standalone server without .mcp.json
ok 2 - codex launches a script bridge and standalone server without .mcp.json
  ---
  duration_ms: 28.565509
  type: 'test'
  ...
# Subtest: agy launches a script bridge and standalone server without .mcp.json
ok 3 - agy launches a script bridge and standalone server without .mcp.json
  ---
  duration_ms: 27.88317
  type: 'test'
  ...
# Subtest: all invalid folder tools are reported without .mcp.json and clear on a clean start
ok 4 - all invalid folder tools are reported without .mcp.json and clear on a clean start
  ---
  duration_ms: 48.842919
  type: 'test'
  ...
# wc-test-1: project tools: tool wheelchair-tools: left out on Codex: over Codex's launch size limit
# Subtest: Codex keeps .mcp.json entries when folder entries exceed the launch budget
ok 5 - Codex keeps .mcp.json entries when folder entries exceed the launch budget
  ---
  duration_ms: 56.640548
  type: 'test'
  ...
# wc-test-2: project tools: folder tools run from the shell here (`wc.js tool run`); server tools need Codex set to unrestricted
# Subtest: sandboxed Codex omits folder entries and warns only with a usable folder tool
ok 6 - sandboxed Codex omits folder entries and warns only with a usable folder tool
  ---
  duration_ms: 69.255579
  type: 'test'
  ...
# Subtest: reviewers and mappers get no folder tools
ok 7 - reviewers and mappers get no folder tools
  ---
  duration_ms: 40.180591
  type: 'test'
  ...
# Subtest: .mcp.json entries win over a folder server and the script bridge
ok 8 - .mcp.json entries win over a folder server and the script bridge
  ---
  duration_ms: 20.815332
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
  duration_ms: 139.265664
  type: 'test'
  ...
# Subtest: resume and account switch reuse the saved commit and offer edited project tools
ok 10 - resume and account switch reuse the saved commit and offer edited project tools
  ---
  duration_ms: 506.649723
  type: 'test'
  ...
# Subtest: copy cleanup preserves live, recovered and starting pins and drops ended records
ok 11 - copy cleanup preserves live, recovered and starting pins and drops ended records
  ---
  duration_ms: 257.556399
  type: 'test'
  ...
# Subtest: the shared project's own thread skips the shared copy and uses its worktree
ok 12 - the shared project's own thread skips the shared copy and uses its worktree
  ---
  duration_ms: 147.889347
  type: 'test'
  ...
# Subtest: a project tool hides a shared tool with the same name
ok 13 - a project tool hides a shared tool with the same name
  ---
  duration_ms: 152.844222
  type: 'test'
  ...
# Subtest: the shared refresh deadline kills a stalled git ls-remote and launch completes
ok 14 - the shared refresh deadline kills a stalled git ls-remote and launch completes
  ---
  duration_ms: 2112.70759
  type: 'test'
  ...
# Subtest: the shared refresh deadline kills a stalled git fetch and launch completes
ok 15 - the shared refresh deadline kills a stalled git fetch and launch completes
  ---
  duration_ms: 2257.972214
  type: 'test'
  ...
# wc-test-3: shared tools: tar failed: fixture-extraction-failed
# Subtest: a partial copy never publishes and launch uses the newest complete copy if present
ok 16 - a partial copy never publishes and launch uses the newest complete copy if present
  ---
  duration_ms: 874.094355
  type: 'test'
  ...
# Subtest: two concurrent starts share one refresh and a later refresh advances the pointer
ok 17 - two concurrent starts share one refresh and a later refresh advances the pointer
  ---
  duration_ms: 2786.899302
  type: 'test'
  ...
# Subtest: agent tools endpoint and wc tool list use the session pin
ok 18 - agent tools endpoint and wc tool list use the session pin
  ---
  duration_ms: 518.152285
  type: 'test'
  ...
# Subtest: detector recognizes name checks across lines
ok 19 - detector recognizes name checks across lines
  ---
  duration_ms: 6.393375
  type: 'test'
  ...
# Subtest: tool names do not dispatch outside connectors
ok 20 - tool names do not dispatch outside connectors
  ---
  duration_ms: 252.120692
  type: 'test'
  ...
# Subtest: missing project tools leave the existing command unchanged
ok 21 - missing project tools leave the existing command unchanged
  ---
  duration_ms: 2.589257
  type: 'test'
  ...
# Subtest: translates stdio and http servers in order
ok 22 - translates stdio and http servers in order
  ---
  duration_ms: 1.7823
  type: 'test'
  ...
# Subtest: reviewer receives neither overrides nor warnings
ok 23 - reviewer receives neither overrides nor warnings
  ---
  duration_ms: 0.389447
  type: 'test'
  ...
# Subtest: unsupported expansions skip only their server
ok 24 - unsupported expansions skip only their server
  ---
  duration_ms: 2.406396
  type: 'test'
  ...
# Subtest: invalid names and headers are warned in priority order on one line
ok 25 - invalid names and headers are warned in priority order on one line
  ---
  duration_ms: 0.674063
  type: 'test'
  ...
# Subtest: never expands environment secrets into arguments or warnings
ok 26 - never expands environment secrets into arguments or warnings
  ---
  duration_ms: 0.551158
  type: 'test'
  ...
# Subtest: an http entry with stray stdio-shaped keys does not stop its siblings
ok 27 - an http entry with stray stdio-shaped keys does not stop its siblings
  ---
  duration_ms: 0.5735
  type: 'test'
  ...
# Subtest: control characters are escaped as TOML, not JSON
ok 28 - control characters are escaped as TOML, not JSON
  ---
  duration_ms: 0.380139
  type: 'test'
  ...
# Subtest: overrides too large for one command-line argument are dropped as a whole
ok 29 - overrides too large for one command-line argument are dropped as a whole
  ---
  duration_ms: 3.814398
  type: 'test'
  ...
# Subtest: headers translate by form and every override is redacted
ok 30 - headers translate by form and every override is redacted
  ---
  duration_ms: 1.101723
  type: 'test'
  ...
# Subtest: header and transport skips follow priority
ok 31 - header and transport skips follow priority
  ---
  duration_ms: 0.385981
  type: 'test'
  ...
# Subtest: budget counts UTF-8 bytes and names all dropped servers
ok 32 - budget counts UTF-8 bytes and names all dropped servers
  ---
  duration_ms: 0.408494
  type: 'test'
  ...
# Subtest: skips a reader-marked duplicate header without overrides
ok 33 - skips a reader-marked duplicate header without overrides
  ---
  duration_ms: 0.279646
  type: 'test'
  ...
# Subtest: exported Codex checks share the command rules
ok 34 - exported Codex checks share the command rules
  ---
  duration_ms: 0.686126
  type: 'test'
  ...
# Subtest: Windows stdio tools pass the bridge environment on WSL
ok 35 - Windows stdio tools pass the bridge environment on WSL
  ---
  duration_ms: 0.527411
  type: 'test'
  ...
# Subtest: folder entries respect sandbox, order, budget and validation
ok 36 - folder entries respect sandbox, order, budget and validation
  ---
  duration_ms: 1.946724
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
# duration_ms 10227.240521
```

## Choices

none
