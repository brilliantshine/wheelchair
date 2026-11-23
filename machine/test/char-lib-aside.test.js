'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeTemp } = require('../../test-support/run-dir');
const { AsideTurns } = require('../lib/aside-turns');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Pi redacts failure messages thrown before launch and returned by the assistant', async () => {
  const dir = await makeTemp('char-pi-error-'), bin = path.join(dir, 'bin'); await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, 'pi'), `#!/usr/bin/env node\nconst a=process.argv.slice(2), id=a[a.indexOf('--session-id')+1]; console.log(JSON.stringify({type:'session',id})); console.log(JSON.stringify({type:'message_end',message:{role:'assistant',stopReason:'error',content:[],errorMessage:'bad sk-or-secret'}}));\n`, { mode: 0o755 });
  const previous = process.env.PATH; process.env.PATH = `${bin}:${previous}`;
  const atomic = (file, data) => fs.writeFile(file, data);
  const base = { provider: 'openrouter', mode: 'fork', from: 'parent', new_id: crypto.randomUUID(), model: 'vendor/model', cwd: dir, prompt: 'hello', account_dir: null };
  try {
    for (const [piProblem, expected] of [[async () => { throw new Error('bad sk-or-secret'); }, 'bad [redacted key]'], [async () => null, 'bad [redacted key]']]) {
      const store = new AsideTurns(dir, atomic, x => x, { piProblem }); const input = { ...base, turn_id: crypto.randomUUID() };
      await store.start(input);
      for (let n = 0; n < 15 && store.get(input.turn_id).state === 'running'; n++) await sleep(1000);
      const result = store.result(store.get(input.turn_id)); assert.equal(result.state, 'failed'); assert.equal(result.error, expected); assert.equal(result.reply, null); assert.equal(result.limit, false); await store.writes;
    }
  } finally { process.env.PATH = previous; }
});
