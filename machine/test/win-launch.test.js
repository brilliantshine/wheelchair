'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { promptLines } = require('../lib/win-prompt');

test('Unity and cached bridge warnings follow loaded tools and launch context', () => {
  const base = { wsl: true, loaded: [{ name: 'unity', windows: true }], mcp: { servers: { unity: { args: ['mcp-for-unity'] } } }, copy: 'C:\\copy', cli: 'claude', health: { ok: null } };
  const lines = promptLines({ ...base, version: '2022.3', unityExists: true });
  assert.equal(lines.length, 3);
  assert.match(lines[0], /C:\\copy/);
  assert.match(lines[1], /C:\\Program Files\\Unity\\Hub\\Editor\\2022\.3\\Editor\\Unity\.exe/);
  assert.match(promptLines({ ...base, version: '2022.3' })[1], /Open Unity 2022\.3.*<Unity.exe>/);
  assert.match(promptLines(base)[1], /the project's version/);
  assert.match(promptLines({ ...base, copy: undefined })[0], /copy_windows/);
  assert.match(promptLines({ ...base, copy: undefined })[1], /<copy_windows from win info>/);
  assert.match(promptLines({ ...base, cli: 'codex', codexMode: 'sandboxed' })[1], /sandboxed session/);
  assert.deepEqual(promptLines({ ...base, loaded: [] }), []);
  assert.deepEqual(promptLines({ ...base, wsl: false }), []);
  assert.match(promptLines({ ...base, loaded: [], health: { ok: false, reason: 'broken' } })[0], /broken.*wc.js win/);
});
