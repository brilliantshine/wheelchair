'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { promptLines } = require('../lib/win-prompt');

test('Unity launch guidance restricts only sandboxed Codex across all five CLIs', () => {
  const base = { health: { ok: true }, wsl: true, loaded: [{ name: 'unity', windows: true }], mcp: { servers: { unity: { args: ['mcp-for-unity'] } } }, copy: 'C:\\work', version: '2022.3', unityExists: true };
  const sandbox = "You can't start Windows programs from this sandboxed session; ask whoever started you to have Unity opened on that path.";
  const open = 'Open Unity on it yourself (`wc.js win start -- "C:\\Program Files\\Unity\\Hub\\Editor\\2022.3\\Editor\\Unity.exe" -projectPath "C:\\work"`), never on another path.';
  for (const cli of ['claude', 'codex', 'agy', 'kimi', 'pi']) {
    assert.equal(promptLines({ ...base, cli, codexMode: 'sandboxed' })[1], cli === 'codex' ? sandbox : open, cli);
    assert.equal(promptLines({ ...base, cli, codexMode: 'unrestricted' })[1], open, cli);
  }
});
