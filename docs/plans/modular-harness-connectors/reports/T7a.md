# T7a — blocked

The draft `machine/test/name-guard.test.js` is uncommitted and incomplete. The brief requires the guard to pass and be committed before fixing the real hit in `viewer/pages/settings.js`, but none of the allowed tags truthfully covers that hit. Asked the lead whether to combine the guard and fix in one commit or temporarily allowlist the real hit. The remaining parts and validations were not run because the brief requires them in order. No existing test lines were edited.

## Validation

`node --test machine/test/name-guard.test.js` (first attempt): exit 1

```text
TAP version 13
# /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:17
#   new RegExp(`(?:\\\\?|:|\\\\|\\\\||&&)\\\\s*${literal}\\\\b?`),
#   ^
# SyntaxError: Invalid regular expression: /(?:\\?|:|\\|\\||&&)\\s*['"`](?:claude|codex|gpt|agy|gemini|kimi|pi|openrouter)['"`]\\b?/: Nothing to repeat
#     at new RegExp (<anonymous>)
#     at Object.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:17:3)
#     at Module._compile (node:internal/modules/cjs/loader:1781:14)
#     at Object..js (node:internal/modules/cjs/loader:1913:10)
#     at Module.load (node:internal/modules/cjs/loader:1505:32)
#     at Function._load (node:internal/modules/cjs/loader:1309:12)
#     at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
#     at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)
#     at node:internal/main/run_main_module:36:49
# Node.js v22.23.5
# Subtest: machine/test/name-guard.test.js
not ok 1 - machine/test/name-guard.test.js
  ---
  duration_ms: 33.248967
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 39.047828
```

`node --test machine/test/name-guard.test.js` (after fixing the syntax error): exit 1

```text
    +   "viewer/app/settings.js:423: return execFileAsync(path.join(hub.root, 'codex', 'model.sh'), args, { encoding: 'utf8' });",
    +   "viewer/pages/settings.js:180: const select = h('select', { 'aria-label': label, class: provider === 'claude' ? '' : 'mono' },",
    +   "viewer/pages/settings.js:487: const body = PROVIDERS.filter(([provider]) => harnessOn(provider)).map(([provider, name, cli]) => h('tr', { class: toolOf(provider).settings.modelHeadsUp ? 'gpt' : '', 'data-provider': provider },",
    +   "viewer/server.js:1337: !['claude', 'codex', 'other'].includes(body.harness) ||",
    +   "viewer/server.js:1610: const graph = { path: graphPath, title, harness: ['claude', 'codex', 'other'].includes(entry.harness) ? entry.harness : 'other', modified: info.mtimeMs };",
    +   "viewer/server.js:1645: harness: ['claude', 'codex', 'other'].includes(entry?.harness) ? entry.harness : 'other',",
    +   "viewer/server.js:1940: return process.env.CLAUDECODE === '1' ? 'claude' : 'other';",
    +   "viewer/server.js:1948: if (name === 'claude' || name === 'codex') return name;",
    +   'install.sh:102: claude) claude_present=${tool_present[$i]} ;;',
    +   'install.sh:103: codex) codex_present=${tool_present[$i]} ;;',
    +   'codex/model.sh:29: VALUE = FORMATS["gpt"]',
    +   'codex/model.sh:30: KIMI_VALUE = FORMATS["kimi"]',
    +   'codex/model.sh:57: if provider == "claude" and name in CLAUDE_ALIASES:',
    +   'codex/model.sh:106: pins["gpt"][slot] = model, None',
    +   'codex/model.sh:276: active = {slot: cell(pins, "gpt", slot)[0] for slot in WORK_TIERS}',
    +   'codex/model.sh:282: words = {slot: (model_parts(model) or model_parts(DEFAULTS["gpt"][slot][0]))[1] for slot, model in active.items()}',
    +   'codex/model.sh:286: fallback = model_parts(DEFAULTS["gpt"][slot][0])',
    +   'codex/model.sh:308: command, tierless = os.path.join(root, "codex", "model.sh"), 0',
    +   'codex/model.sh:361: if len(argv) == 1 and (slot := slot_for("gpt", argv[0])) in WORK_TIERS:',
    +   'codex/model.sh:362: model, _ = read_cell(pin_path, "gpt", slot)',
    +   'codex/model.sh:380: if len(argv) == 3 and argv[:2] == ["family", "claude"] and (slot := slot_for("claude", argv[2])) is not None:',
    +   'codex/model.sh:381: model, _ = read_cell(pin_path, "claude", slot)',
    +   'codex/model.sh:418: if len(argv) == 3 and argv[0] == "set" and (slot := slot_for("gpt", argv[1])) in WORK_TIERS:',
    +   'codex/model.sh:422: write_pin(pin_path, "gpt", slot, model, None)',
    +   'codex/model.sh:431: if provider == "gpt" and effort is not None and effort not in EFFORTS[provider]:'
    + ]
    - []
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual:
    0: "viewer/app/balancer.js:81: try { await exec(path.join(hub.root, 'codex', 'model.sh'), [family, slot]); }"
    1: "viewer/app/balancer.js:93: try { await exec(path.join(hub.root, 'codex', 'model.sh'), [provider, slot]); }"
    2: "viewer/app/balancer.js:99: try { await exec(path.join(hub.root, 'codex', 'model.sh'), [p, slot]); } catch (e) { if (e.code === 3) continue; throw e; }"
    3: "viewer/app/sessions.js:107: const model = (await execFileAsync(path.join(hub.root, 'codex', 'model.sh'), [provider, slot])).stdout.trim();"
    4: "viewer/app/sessions.js:109: if (PROVIDERS[provider].effort) effort = (await execFileAsync(path.join(hub.root, 'codex', 'model.sh'), ['effort', provider, slot])).stdout.trim() || undefined;"
    5: "viewer/app/sessions.js:120: const model = (await execFileAsync(path.join(hub.root, 'codex', 'model.sh'), args)).stdout.trim();"
    6: "viewer/app/settings.js:423: return execFileAsync(path.join(hub.root, 'codex', 'model.sh'), args, { encoding: 'utf8' });"
    7: "viewer/pages/settings.js:180: const select = h('select', { 'aria-label': label, class: provider === 'claude' ? '' : 'mono' },"
    8: "viewer/pages/settings.js:487: const body = PROVIDERS.filter(([provider]) => harnessOn(provider)).map(([provider, name, cli]) => h('tr', { class: toolOf(provider).settings.modelHeadsUp ? 'gpt' : '', 'data-provider': provider },"
    9: "viewer/server.js:1337: !['claude', 'codex', 'other'].includes(body.harness) ||"
    10: "viewer/server.js:1610: const graph = { path: graphPath, title, harness: ['claude', 'codex', 'other'].includes(entry.harness) ? entry.harness : 'other', modified: info.mtimeMs };"
    11: "viewer/server.js:1645: harness: ['claude', 'codex', 'other'].includes(entry?.harness) ? entry.harness : 'other',"
    12: "viewer/server.js:1940: return process.env.CLAUDECODE === '1' ? 'claude' : 'other';"
    13: "viewer/server.js:1948: if (name === 'claude' || name === 'codex') return name;"
    14: 'install.sh:102: claude) claude_present=${tool_present[$i]} ;;'
    15: 'install.sh:103: codex) codex_present=${tool_present[$i]} ;;'
    16: 'codex/model.sh:29: VALUE = FORMATS["gpt"]'
    17: 'codex/model.sh:30: KIMI_VALUE = FORMATS["kimi"]'
    18: 'codex/model.sh:57: if provider == "claude" and name in CLAUDE_ALIASES:'
    19: 'codex/model.sh:106: pins["gpt"][slot] = model, None'
    20: 'codex/model.sh:276: active = {slot: cell(pins, "gpt", slot)[0] for slot in WORK_TIERS}'
    21: 'codex/model.sh:282: words = {slot: (model_parts(model) or model_parts(DEFAULTS["gpt"][slot][0]))[1] for slot, model in active.items()}'
    22: 'codex/model.sh:286: fallback = model_parts(DEFAULTS["gpt"][slot][0])'
    23: 'codex/model.sh:308: command, tierless = os.path.join(root, "codex", "model.sh"), 0'
    24: 'codex/model.sh:361: if len(argv) == 1 and (slot := slot_for("gpt", argv[0])) in WORK_TIERS:'
    25: 'codex/model.sh:362: model, _ = read_cell(pin_path, "gpt", slot)'
    26: 'codex/model.sh:380: if len(argv) == 3 and argv[:2] == ["family", "claude"] and (slot := slot_for("claude", argv[2])) is not None:'
    27: 'codex/model.sh:381: model, _ = read_cell(pin_path, "claude", slot)'
    28: 'codex/model.sh:418: if len(argv) == 3 and argv[0] == "set" and (slot := slot_for("gpt", argv[1])) in WORK_TIERS:'
    29: 'codex/model.sh:422: write_pin(pin_path, "gpt", slot, model, None)'
    30: 'codex/model.sh:431: if provider == "gpt" and effort is not None and effort not in EFFORTS[provider]:'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:41:10)
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
# duration_ms 69.555579
```

## Choices

none
