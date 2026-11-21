'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { detectWsl, interopEnv, createWinEnv, worktreeKey } = require('../lib/win-env');
test('detects WSL and its mount root', () => {
  const root = makeTempSync('win-env-'); const procRoot = path.join(root, 'proc'), etcRoot = path.join(root, 'etc');
  fs.mkdirSync(path.join(procRoot,'sys/kernel'),{recursive:true}); fs.mkdirSync(path.join(procRoot,'sys/fs/binfmt_misc'),{recursive:true}); fs.mkdirSync(etcRoot);
  fs.writeFileSync(path.join(procRoot,'sys/kernel/osrelease'),'5.15-Microsoft');
  assert.equal(detectWsl({procRoot,etcRoot}).wsl,false);
  fs.writeFileSync(path.join(procRoot,'sys/fs/binfmt_misc/WSLInterop-late'),''); fs.writeFileSync(path.join(etcRoot,'wsl.conf'),'[automount]\nroot = /drives/\n');
  assert.deepEqual(detectWsl({procRoot,etcRoot}),{wsl:true,mount:'/drives'});
});
test('repairs interop without leaking token or mutating the input', () => {
  const root = makeTempSync('win-env-'); fs.mkdirSync(path.join(root,'WSL'));
  const a = path.join(root,'WSL','1_interop'), b = path.join(root,'WSL','2_interop'); fs.writeFileSync(a,''); fs.writeFileSync(b,''); fs.utimesSync(a,1,1); fs.utimesSync(b,2,2);
  const original = { WSL_INTEROP:'/missing', WHEELCHAIR_SESSION_TOKEN:'secret' };
  assert.deepEqual(interopEnv(original,{runRoot:root}),{WSL_INTEROP:b}); assert.equal(original.WHEELCHAIR_SESSION_TOKEN,'secret');
});
test('PowerShell startup failure includes interop guidance', async () => {
  const root = makeTempSync('win-env-'); const env = createWinEnv({mount:root,env:{}});
  await assert.rejects(env.ps('# wc:test e30=\n'), e => e.status === 422 && /WSL_INTEROP/.test(e.message) && /wsl --shutdown/.test(e.message));
  assert.match(worktreeKey('/x'),/^[a-f0-9]{12}$/);
});
