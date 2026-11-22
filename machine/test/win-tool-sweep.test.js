'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
function fixture() { const state = makeTempSync('ready-sweep-'), machine = new MachineService({ stateDir: state }); let calls = 0; machine.liveTmux = () => { calls++; return new Set(['wc-live']); }; return { state, machine, calls: () => calls }; }
function file(root, name) { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'x'); const old = new Date(Date.now() - 120000); fs.utimesSync(p, old, old); return p; }
test('sweep removes dead files and keeps starting and live files in each directory without agy-tools', () => {
  const f = fixture(); f.machine.startingNames.set('wc-starting', Promise.resolve()); f.machine.sessions['wc-live'] = { status: 'ready', created_at: new Date().toISOString() };
  for (const name of ['wc-dead', 'wc-starting', 'wc-live']) for (const p of [`settings/${name}.mcp.json`, `win-ready/${name}`]) file(f.state, p);
  const invalid = [file(f.state, 'settings/other.mcp.json'), file(f.state, 'win-ready/not-a-session'), file(f.state, 'settings/wc-live.json')];
  f.machine.sweepAgyTools(); assert.equal(f.calls(), 1);
  for (const name of ['wc-dead', 'wc-starting', 'wc-live']) for (const p of [`settings/${name}.mcp.json`, `win-ready/${name}`]) assert.equal(fs.existsSync(path.join(f.state, p)), name !== 'wc-dead', p);
  for (const p of invalid) assert.ok(fs.existsSync(p));
});
test('only ordinary settings files do not call tmux or remove anything', () => {
  const f = fixture(), p = file(f.state, 'settings/wc-old.json'); f.machine.sweepAgyTools(); assert.equal(f.calls(), 0); assert.ok(fs.existsSync(p));
});
test('sweep keeps dead session ready and MCP files younger than 60 seconds', () => {
  const f = fixture(), files = [file(f.state, 'win-ready/wc-recent'), file(f.state, 'settings/wc-recent.mcp.json')];
  for (const p of files) fs.utimesSync(p, new Date(), new Date());
  f.machine.sweepAgyTools();
  assert.equal(f.calls(), 1);
  for (const p of files) assert.ok(fs.existsSync(p), p);
});
