'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { WinBridge } = require('../lib/win');

function fixture(wsl = true) {
  const root = makeTempSync('win-bridge-');
  const procRoot = path.join(root, 'proc');
  const etcRoot = path.join(root, 'etc');
  fs.mkdirSync(path.join(procRoot, 'sys/kernel'), { recursive: true });
  fs.mkdirSync(path.join(procRoot, 'sys/fs/binfmt_misc'), { recursive: true });
  fs.mkdirSync(etcRoot);
  fs.writeFileSync(path.join(procRoot, 'sys/kernel/osrelease'), wsl ? 'microsoft' : 'linux');
  if (wsl) fs.writeFileSync(path.join(procRoot, 'sys/fs/binfmt_misc/WSLInterop'), '');
  const session = { name: 'wc-test-lead', thread_id: 'test', role: 'lead', cli: 'claude', worktree: path.join(root, 'work'), status: 'ready' };
  const service = { stateDir: path.join(root, 'state'), sessions: { [session.name]: session }, liveTmux: () => new Set([session.name]), archivingThreads: new Set(), archivedThreads: new Set(), closingThreads: new Set(), log() {} };
  const winEnv = { localAppData: async () => 'C:\\Users\\Test', toLinux: p => path.join(root, 'drive', p.replace(/[:\\]/g, '/')), toWindows: p => `W:${p}`, versions: async () => ({ ok: true }) };
  const bridge = new WinBridge(service, { procRoot, etcRoot, winEnv, apps: {} });
  return { root, session, service, bridge };
}

test('availability, role, session and argument checks are ordered', async () => {
  const off = fixture(false);
  await assert.rejects(off.bridge.handle(off.session, { op: 'info', args: [] }), { status: 422, message: 'the Windows bridge only works when Wheelchair runs in WSL' });
  const { bridge, session } = fixture();
  session.role = 'reviewer';
  await assert.rejects(bridge.handle(session, { op: 'info', args: [] }), { status: 403 });
  session.role = 'mapper';
  await assert.rejects(bridge.handle(session, { op: 'info', args: [] }), { status: 403 });
  session.role = 'lead';
  session.status = 'stopped';
  await assert.rejects(bridge.handle(session, { op: 'bogus', args: [] }), { status: 409 });
  session.status = 'ready';
  await assert.rejects(bridge.handle(session, { op: 'bogus', args: [] }), { status: 400 });
  session.cli = 'codex';
  await assert.rejects(bridge.handle(session, { op: 'run', args: ['--', 'cmd.exe'] }), { status: 403 });
  assert.equal((await bridge.handle(session, { op: 'info', args: [] })).sandboxed, true);
});

test('session environment applies to tool roles without creating state', async () => {
  const { bridge, session, root } = fixture();
  const env = await bridge.sessionEnv(session, { WSLENV: 'OTHER/p' });
  assert.match(env.WHEELCHAIR_WINDOWS_PROJECT, /Wheelchair/);
  assert.equal(env.WSLENV, 'OTHER/p:WHEELCHAIR_WINDOWS_PROJECT');
  assert.equal(fs.existsSync(path.join(root, 'state')), false);
  session.role = 'mapper';
  assert.deepEqual(await bridge.sessionEnv(session), {});
  assert.deepEqual(await fixture(false).bridge.sessionEnv(session), {});
});
