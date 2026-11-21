'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir.js');

// Node 20 treats .js as CommonJS here; import the extension's source as ESM.
const source = fs.readFileSync(path.join(__dirname, '../adapters/pi-guard.js'), 'utf8');
const guardPromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const protocol = path.resolve(__dirname, '../../protocol');

test('Pi read-only guard resolves and confines paths for every read tool', async () => {
  const { guardToolCall } = await guardPromise;
  const root = makeTempSync('pi-guard-');
  const cwd = path.join(root, 'work');
  const home = path.join(root, 'home');
  fs.mkdirSync(cwd); fs.mkdirSync(home);
  fs.writeFileSync(path.join(cwd, 'inside'), 'inside');
  fs.writeFileSync(path.join(root, 'auth.json'), 'fake');
  fs.writeFileSync(path.join(home, 'secret'), 'fake');
  fs.writeFileSync(path.join(cwd, 'narrow\u202fspace'), 'fake');
  fs.symlinkSync(path.join(root, 'auth.json'), path.join(cwd, 'link'));
  fs.symlinkSync(path.join(cwd, 'narrow\u202fspace'), path.join(cwd, 'narrow-link'));
  const oldHome = process.env.HOME;
  process.env.HOME = home;
  try {
    for (const toolName of ['read', 'grep', 'find', 'ls']) {
      const run = input => { const event = { toolName, input }; return { result: guardToolCall(event, { cwd }, protocol), input }; };
      for (const p of ['../auth.json', '~/secret', path.join(root, 'auth.json'), 'link', 'missing', 'narrow-link']) {
        assert.equal(run({ path: p }).result?.block, true, `${toolName}: ${p}`);
      }
      for (const [input, expected] of [
        [{ path: '@inside' }, path.join(cwd, 'inside')],
        [{ path: path.join(protocol, 'app/aside.md') }, path.join(protocol, 'app/aside.md')],
        [{}, cwd],
      ]) {
        const call = run(input);
        assert.equal(call.result, undefined);
        assert.equal(call.input.path, fs.realpathSync(expected));
      }
    }
    assert.equal(guardToolCall({ toolName: 'bash', input: {} }, { cwd }, protocol), undefined);
  } finally {
    if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome;
  }
});
