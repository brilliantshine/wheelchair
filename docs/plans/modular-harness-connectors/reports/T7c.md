# T7c report

- `viewer/app/sessions.js` defaults omitted `report.useHookText` to true; `viewer/test/report-default.test.js` checks a cloned manifest without `report` selects hook text.
- `connectors/contract.js` requires `stepsReady` with `steps` and documents optional model fields; `machine/test/connectors-contract.test.js` checks both directions.
- `connectors/README.md` corrects context keys, report and hook behavior, capability membership, field defaults, settings and name-guard guidance.
- `machine/service.js` renames the three methods and their calls. Only call names changed in existing service tests.

Edited test call lines: `machine/test/service.test.js:1425`, `machine/test/kimi-turns.test.js:48`, `machine/test/kimi-turns.test.js:56`, `machine/test/kimi-turns.test.js:65`, `machine/test/kimi-turns.test.js:68`, `machine/test/kimi-turns.test.js:83`, `machine/test/kimi-turns.test.js:103`, `machine/test/kimi-turns.test.js:104`, `machine/test/kimi-turns.test.js:111`, `machine/test/kimi-turns.test.js:112`, `machine/test/kimi-turns.test.js:113`, `machine/test/kimi-turns.test.js:120`, `machine/test/kimi-turns.test.js:123`, `machine/test/kimi-turns.test.js:139`, `machine/test/kimi-turns.test.js:152`, `machine/test/kimi-turns.test.js:155`, `machine/test/kimi-turns.test.js:159`, `machine/test/kimi-turns.test.js:165`, `machine/test/kimi-turns.test.js:175`, `machine/test/kimi-turns.test.js:177`, `machine/test/kimi-turns.test.js:178`, `machine/test/kimi-turns.test.js:179`, `machine/test/kimi-turns.test.js:188`, `machine/test/kimi-turns.test.js:213`, `machine/test/kimi-turns.test.js:225`, `machine/test/kimi-turns.test.js:229`, `machine/test/kimi-turns.test.js:266`, `machine/test/kimi-turns.test.js:279`, `machine/test/kimi-turns.test.js:297`, `machine/test/kimi-turns.test.js:303`, `machine/test/char-service-branches.test.js:62`.

Requested service grep (includes existing tool-named methods and properties as well as unrelated substring matches):

```text
17: * "Machine service on the hub"; transcript copies and worktrees are
29:const { pipeline } = require('node:stream/promises');
117:  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
151:    try { child = spawn(program, args, { ...spawnOptions, stdio: ['ignore', 'pipe', 'pipe'] }); }
215:  const codexMode = input.codex_mode === undefined ? 'sandboxed' : input.codex_mode;
216:  if (!CODEX_MODES.includes(codexMode)) die('codex_mode must be sandboxed or unrestricted');
219:  return { permission_mode: mode, codex_mode: codexMode, effort: input.effort || null };
287:    this.codexStepChunkSize = options.codexStepChunkSize || 8 * 1024 * 1024;
401:        await pipeline(fs.createReadStream(input.path), file.createWriteStream());
427:        await pipeline(fs.createReadStream(input.path), file.createWriteStream());
463:    this.kimiTimer = setInterval(() => this.pollTurns().catch(error => this.log(error)), 1000);
464:    this.kimiTimer.unref();
469:    this.agyToolsTimer = setInterval(() => this.sweepAgyTools(), 60000);
470:    this.agyToolsTimer.unref();
483:  sweepAgyTools() {
734:    return adapter.command(input, session, worktree, { stateDir: this.stateDir, promptPath, rolePrompt, mcp, tools: TOOL_ROLES.has(input.role), accountDir: session.account_dir, kimiExecutable: context.kimiExecutable, wsl: context.wsl, mount: context.mount, replaceEntries: context.replaceEntries, resume: context.resume });
800:    try { return publicSession(await starting); } finally { this.startingNames.delete(name); this.sweepAgyTools(); this.cancelledStarts.delete(name); }
1033:      const lines = require('./lib/win-prompt').promptLines({ health: this.win?.bridgeHealth(), wsl, loaded, mcp, copy: extra.WHEELCHAIR_WINDOWS_PROJECT, cli: session.cli, codexMode: session.codex_mode, version, unityExists });
1102:          const length = Math.min(size - start, this.codexStepChunkSize);
1109:            if (bytesRead === this.codexStepChunkSize) {
1192:  retryPiStartupEnter(session) {
1193:    this.piStartupRetries ||= new Map();
1194:    const previous = this.piStartupRetries.get(session.name);
1197:    this.piStartupRetries.set(session.name, retry);
1199:      if (this.piStartupRetries.get(session.name) !== retry) return;
1200:      if (this.sessions[session.name] !== session || session.status !== 'ready' || session.end_reason || Date.now() >= retry.deadline) { this.piStartupRetries.delete(session.name); return; }
1201:      let pane; try { pane = this.pane(session.name); } catch { this.piStartupRetries.delete(session.name); return; }
1202:      if (/Working\s*[─-]/.test(pane)) { this.piStartupRetries.delete(session.name); return; }
1220:    if (adapters[session.cli]?.retryStartupEnter) this.retryPiStartupEnter(session);
1244:    this.sweepAgyTools();
1377:  // One copy at a time per session: two overlapping copies read the same offset and the
1378:  // same copied file, so both would append the same new lines.
1412:      // file's inode and size match what this copier last left there.  Anything else
1420:        let copied = '';
1421:        try { copied = await fsp.readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
1422:        if (copied && !copied.endsWith('\n')) { copied = copied.slice(0, copied.lastIndexOf('\n') + 1); await fsp.truncate(target, Buffer.byteLength(copied)); }
1423:        kept = { target, ino: keptStat?.ino, size: Buffer.byteLength(copied), hashes: new Set(copied.split('\n').filter(Boolean).map(line => crypto.createHash('sha256').update(line).digest('hex'))) };
1465:      // Forgotten archived sessions have no copier, but retain their transcript.
1588:    const allowed = new Set(['fetch', 'commit', 'merge', 'cherry-pick', 'revert', 'push', 'pr', 'worktree-remove']);
1607:    if (operation === 'cherry-pick') result = run('git', [...gitIdentityArgs(cwd), 'cherry-pick', ...args]);
1724:  async reconcilePiExits() {
1758:      try { child = spawn(previewCli, adapters[previewCli].stylePreviewArgv(model), { env: { ...process.env, WHEELCHAIR_LANE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] }); }
1888:      let picked_up_at = null;
1891:        if (commits) picked_up_at = await run('show', '-s', '--format=%cI', commits.split('\n')[0]);
1893:      return { result: 'moved', remote_tip: tip, picked_up_at };
2003:      let picked_up_at = null;
2006:        if (commits) picked_up_at = await run('show', '-s', '--format=%cI', commits.split('\n')[0]);
2018:      return { repository: await repository(), ...remote, remote_contains_head: !!contains, picked_up_at, local_head, worktree_exists, relation, ...await statuses(head, slug) };
2060:      if (request.method === 'GET' && url.pathname === '/v1/status') { await this.authorize(request, 'hub'); await this.reconcilePiExits(); return send(response, 200, this.status()); }
2163:      if (request.method === 'GET' && url.pathname === '/v1/sessions') { await this.authorize(request, 'hub'); await this.reconcilePiExits(); return send(response, 200, this.sessionList()); }
2181:        file.createReadStream().on('error', () => response.destroy()).pipe(response); return;
2303:    this.server.once('close', () => { clearInterval(this.spoolTimer); clearInterval(this.pollTimer); clearInterval(this.stepsTimer); clearInterval(this.kimiTimer); clearInterval(this.trustTimer); clearInterval(this.sudoTimer); clearInterval(this.screenTimer); clearInterval(this.winTimer); clearInterval(this.win.healthTimer); clearInterval(this.agyToolsTimer); clearInterval(this.copyHashesTimer); this.screens.stopTimers(); });
```

## Validation

### `node --test machine/test/connectors-contract.test.js machine/test/char-*.test.js machine/test/name-guard.test.js`

```text
exit 0
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 66.525634
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 27.673084
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 9.866531
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 28.208926
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 11.561517
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 79.365513
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 82.880936
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 13.497374
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 50.149394
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 4.293509
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.770101
  type: 'test'
  ...
# Subtest: tool names do not dispatch outside connectors
ok 34 - tool names do not dispatch outside connectors
  ---
  duration_ms: 41.688126
  type: 'test'
  ...
1..34
# tests 34
# suites 0
# pass 34
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9565.351757
```

### `timeout 600 bash machine/test/run.sh (first run; stalled in win-tool-proxy.test.js, terminated after starting retry)`

```text
exit 143
  type: 'test'
  ...
# Subtest: refuses after two changes during apply without losing edits
ok 648 - refuses after two changes during apply without losing edits
  ---
  duration_ms: 1496.563254
  type: 'test'
  ...
# Subtest: interrupted Windows apply is resumed after another Linux edit
ok 649 - interrupted Windows apply is resumed after another Linux edit
  ---
  duration_ms: 1354.938933
  type: 'test'
  ...
# Subtest: raw bytes, executable mode, force-added and newly ignored files
ok 650 - raw bytes, executable mode, force-added and newly ignored files
  ---
  duration_ms: 1213.639102
  type: 'test'
  ...
# Subtest: seeding copies only ignored paths accepted by the new worktree
ok 651 - seeding copies only ignored paths accepted by the new worktree
  ---
  duration_ms: 700.014712
  type: 'test'
  ...
# Subtest: seeding accepts robocopy success code 1 and reports failure code 8
ok 652 - seeding accepts robocopy success code 1 and reports failure code 8
  ---
  duration_ms: 946.997093
  type: 'test'
  ...
# Subtest: first and second reconciles preserve seeded ignored files outside both indexes and base
ok 653 - first and second reconciles preserve seeded ignored files outside both indexes and base
  ---
  duration_ms: 1245.187462
  type: 'test'
  ...
# Subtest: seeding collapses a large ignored folder and keeps the command short
ok 654 - seeding collapses a large ignored folder and keeps the command short
  ---
  duration_ms: 770.637096
  type: 'test'
  ...
# Subtest: deleting unresolved copies saves the Windows snapshot and removes copy refs
ok 655 - deleting unresolved copies saves the Windows snapshot and removes copy refs
  ---
  duration_ms: 811.519429
  type: 'test'
  ...
# Subtest: concurrent reconciles for the same copy are serialized
ok 656 - concurrent reconciles for the same copy are serialized
  ---
  duration_ms: 833.843322
  type: 'test'
  ...
# Subtest: interrupted conflict application retains marker masking on the next sync
ok 657 - interrupted conflict application retains marker masking on the next sync
  ---
  duration_ms: 1106.746282
  type: 'test'
  ...
# Subtest: later force-add, repeated tracked deletion, and successive Windows edits sync
ok 658 - later force-add, repeated tracked deletion, and successive Windows edits sync
  ---
  duration_ms: 1690.635227
  type: 'test'
  ...
# Subtest: clean checkout LFS and eol attributes do not transform bridge bytes
ok 659 - clean checkout LFS and eol attributes do not transform bridge bytes
  ---
  duration_ms: 434.84536
  type: 'test'
  ...
# Subtest: a force-tracked ignored file survives repeated syncs and edits in both directions
ok 660 - a force-tracked ignored file survives repeated syncs and edits in both directions
  ---
  duration_ms: 2565.156512
  type: 'test'
  ...
```

### `timeout 600 bash machine/test/run.sh (retry; 18 known wslpath failures match T3b)`

```text
exit 1
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w18/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w18/machine/lib/win.js:109:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w18/machine/lib/win.js:472:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w18/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 719 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.911152
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 720 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 6.796441
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 721 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 43.558704
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w18/machine/test/win.test.js:373:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    0 !== 1
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 1
  actual: 0
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w18/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 722 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 41.593227
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 723 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 37.756484
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w18/machine/test/win.test.js:402:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    false !== true
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w18/machine/test/win.test.js:414:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..723
# tests 723
# suites 0
# pass 703
# fail 18
# cancelled 0
# skipped 2
# todo 0
# duration_ms 64188.586976
```

### `(cd viewer && npm test)`

```text
exit 0
ok 885 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 76.881258
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 886 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 63.695923
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 887 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 68.155672
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 888 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 65.144681
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 889 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 66.137647
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 890 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 75.383519
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 891 - unknown win op fails without sending a request
  ---
  duration_ms: 52.671225
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 892 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.560902
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 893 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 57.398014
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 894 - the page eligibility regex equals the machine one
  ---
  duration_ms: 1.541875
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 895 - the page eligibility function
  ---
  duration_ms: 0.478784
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 896 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 50.047674
  type: 'test'
  ...
1..896
# tests 912
# suites 0
# pass 912
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 63048.677556
```

### `node connectors/export.js --check`

```text
exit 0

```

### `node -e "const c=require('./connectors/contract');const t=require('fs').readFileSync('connectors/README.md','utf8');const miss=[...c.REQUIRED.machine,...c.REQUIRED.hub,...Object.keys(c.CAPABILITIES),...Object.values(c.CAPABILITIES).flatMap(x=>[...x.machine,...x.hub]),...c.OPTIONAL.machine,...c.OPTIONAL.hub].filter(n=>!t.includes(n));console.log(miss.length?'missing: '+miss.join(', '):'all members documented');process.exitCode=miss.length?1:0"`

```text
exit 0
all members documented
```

## Choices

- `viewer/test/report-default.test.js`: used a cloned Codex manifest and a minimal event fixture to exercise hook-first delivery.
