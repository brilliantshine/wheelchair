'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { makeTempSync } = require('../run-dir.js');

(async () => {
  let executable;
  try { executable = execFileSync('which', ['pi'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { console.log('skipped: Pi not installed'); return; }
  const packageDir = path.resolve(path.dirname(fs.realpathSync(executable)), '../..');
  const load = p => import(pathToFileURL(path.join(packageDir, p)).href);
  const { loadExtensions } = await load('dist/core/extensions/loader.js');
  const { ExtensionRunner } = await load('dist/core/extensions/runner.js');
  const { createReadTool, createLsTool } = await load('dist/core/tools/index.js');
  const root = makeTempSync('pi-guard-smoke-');
  const cwd = path.join(root, 'work');
  const home = path.join(root, 'home');
  fs.mkdirSync(cwd); fs.mkdirSync(home);
  fs.writeFileSync(path.join(cwd, 'inside'), 'inside fixture');
  fs.writeFileSync(path.join(root, 'auth.json'), 'fake secret');
  fs.writeFileSync(path.join(home, 'secret'), 'fake secret');
  fs.writeFileSync(path.join(cwd, 'narrow\u202fspace'), 'fake secret');
  fs.symlinkSync(path.join(root, 'auth.json'), path.join(cwd, 'link'));
  fs.symlinkSync(path.join(cwd, 'narrow\u202fspace'), path.join(cwd, 'narrow-link'));
  process.env.HOME = home;
  const extension = path.resolve(__dirname, '../../connectors/pi/guard.js');
  const loaded = await loadExtensions([extension], cwd);
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.extensions.length, 1);
  const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, cwd, {}, {});
  const tools = { read: createReadTool(cwd), ls: createLsTool(cwd) };
  async function call(name, input, blocked, expected) {
    const event = { type: 'tool_call', toolName: name, toolCallId: 'fixture', input };
    const decision = await runner.emitToolCall(event);
    assert.equal(!!decision?.block, blocked, JSON.stringify(input));
    if (!blocked) {
      const result = await tools[name].execute('fixture', event.input);
      const output = result.content.map(item => item.text || '').join('\n');
      assert.ok(output.includes(expected), `Pi ${name} output did not contain ${expected}`);
      assert.equal(event.input.path, fs.realpathSync(name === 'ls' ? cwd : expected === 'inside fixture' ? path.join(cwd, 'inside') : path.resolve(__dirname, '../../protocol/app/aside.md')));
    }
  }
  for (const p of ['../auth.json', '~/secret', path.join(root, 'auth.json'), 'link', 'missing', 'narrow-link']) await call('read', { path: p }, true);
  await call('read', { path: '@inside' }, false, 'inside fixture');
  await call('read', { path: path.resolve(__dirname, '../../protocol/app/aside.md') }, false, 'aside');
  await call('ls', {}, false, 'inside');
  console.log('Pi guard offline check passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
