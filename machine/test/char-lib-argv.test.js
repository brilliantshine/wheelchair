'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeTemp } = require('../../test-support/run-dir');
const { AsideTurns } = require('../lib/aside-turns');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Pi aside launches with complete fork and resume argument lists', async () => {
  const dir = await makeTemp('char-pi-argv-'), bin = path.join(dir, 'bin'), log = path.join(dir, 'args'); await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, 'pi'), `#!/usr/bin/env node\nconst fs=require('fs'),a=process.argv.slice(2),get=k=>a[a.indexOf(k)+1]; fs.writeFileSync(process.env.PI_ARG_LOG, JSON.stringify(a)); const id=a.includes('--fork')?get('--session-id'):get('--session'); console.log(JSON.stringify({type:'session',id})); console.log(JSON.stringify({type:'message_end',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'ok'}]}}));\n`, { mode: 0o755 });
  const previous = { PATH: process.env.PATH, PI_ARG_LOG: process.env.PI_ARG_LOG }; process.env.PATH = `${bin}:${previous.PATH}`; process.env.PI_ARG_LOG = log;
  const store = new AsideTurns(dir, (file, data) => fs.writeFile(file, data), x => x);
  const pointer = `Read ${path.resolve(__dirname, '../../protocol/app/aside.md')} before responding. It is wheelchair's built-in rules for your role.`;
  try {
    for (const [mode, access] of [['fork', 'read-only'], ['resume', 'full']]) {
      const input = { turn_id: crypto.randomUUID(), provider: 'openrouter', from: crypto.randomUUID(), new_id: crypto.randomUUID(), mode, access, model: 'vendor/model', effort: 'high', cwd: dir, prompt: 'hello', account_dir: null };
      await fs.writeFile(log, '[]'); await store.start(input);
      for (let n = 0; n < 15 && store.get(input.turn_id).state === 'running'; n++) await sleep(1000);
      assert.equal(store.get(input.turn_id).state, 'ok');
      assert.deepEqual(JSON.parse(await fs.readFile(log, 'utf8')), ['--provider', 'openrouter', '--model', 'vendor/model', '--mode', 'json', '-p', ...(mode === 'fork' ? ['--fork', input.from, '--session-id', input.new_id] : ['--session', input.from]), '--append-system-prompt', pointer, '--no-extensions', '--thinking', 'high', '--tools', access === 'full' ? 'read,bash,edit,write,grep,find,ls' : 'read,grep,find,ls', ...(access === 'full' ? [] : ['-e', path.resolve(__dirname, '../adapters/pi-guard.js')])]);
      await store.writes;
    }
  } finally { if (previous.PI_ARG_LOG === undefined) delete process.env.PI_ARG_LOG; else process.env.PI_ARG_LOG = previous.PI_ARG_LOG; process.env.PATH = previous.PATH; }
});
