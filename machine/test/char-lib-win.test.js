'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const { WinBridge } = require('../lib/win');

test('Windows bridge denies sandboxed Codex and reports status for new and recovered sessions', async () => {
  const root = makeTempSync('char-win-');
  const service = new MachineService({ stateDir: root, win: { procRoot: root, etcRoot: root, runRoot: root } });
  service.archivingThreads = new Set(); service.archivedThreads = new Set(); service.closingThreads = new Set();
  service.liveTmux = () => new Set(Object.keys(service.sessions));
  service.persistSessions = async () => {};
  const bridge = new WinBridge(service, { procRoot: root, etcRoot: root, apps: {} });
  bridge.detected.wsl = true;
  bridge.winEnv = { versions: async () => ({ ok: true }) };
  bridge.disk = { info: async () => ({}) };
  bridge.exists = () => false;
  bridge.context = async () => ({ key: 'key', copy: { windows: 'C:\\copy', linux: path.join(root, 'copy') } });
  bridge.create = async () => {}; bridge.sync = async () => ({ ok: true });
  bridge.apps = { run: async () => ({ value: 'run' }), start: async () => ({ value: 'start' }) };
  for (const recovered of [false, true]) {
    for (const [cli, mode, sandboxed] of [['claude', undefined, false], ['codex', 'sandboxed', true], ['codex', 'unrestricted', false], ['agy', undefined, false], ['kimi', undefined, false], ['pi', undefined, false]]) {
      const name = `wc-example-${recovered ? 'lead' : 'worker'}`;
      let session;
      if (recovered) {
        service.sessions = {}; service.liveTmux = () => new Set([name]);
        const panes = { claude: 'Claude', codex: 'Codex', agy: 'Antigravity CLI', kimi: 'Never Ask\ncontext: 20%', pi: 'escape interrupt\nctrl+c/ctrl+d clear/exit' };
        service.tmux = args => ({ ok: true, stdout: args[0] === 'capture-pane' ? panes[cli] : root });
        service.stopFatal = async () => {};
        await service.recoverFromTmux(); session = service.sessions[name]; assert.equal(session.cli, cli); assert.equal(session.recovered, true);
        // Recovery does not persist a Codex mode; an absent mode remains sandboxed.
        if (mode === 'unrestricted') session.codex_mode = mode;
      } else {
        service.sessions = {}; session = service.sessions[name] = { name, thread_id: 'example', role: 'worker', status: 'ready', worktree: root, cli, codex_mode: mode };
        service.liveTmux = () => new Set([name]);
      }
      assert.equal((await bridge.handle(session, { op: 'info', args: [] })).sandboxed, sandboxed, `${cli} ${mode} recovered=${recovered}`);
      for (const op of ['run', 'start']) {
        if (sandboxed) await assert.rejects(bridge.handle(session, { op, args: ['--', 'cmd.exe'] }), { status: 403, message: "Windows programs would run outside your sandbox; the bridge can't run them in this session" });
        else assert.equal((await bridge.handle(session, { op, args: ['--', 'cmd.exe'] })).value, op);
      }
      bridge.context = async () => { throw new Error('copy unavailable'); };
      const failed = await bridge.handle(session, { op: 'info', args: [] });
      assert.deepEqual(failed, { wsl: true, ok: false, ready: false, reason: 'copy unavailable', copy_windows: null, copy_linux: null, sandboxed });
      bridge.context = async () => ({ key: 'key', copy: { windows: 'C:\\copy', linux: path.join(root, 'copy') } });
    }
  }
});
