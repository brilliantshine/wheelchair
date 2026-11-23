'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const root = path.resolve(__dirname, '../..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('install jobs use provider binaries, versions, cleanup and sensitivity', async () => {
  const home = makeTempSync('char-install-'), bin = path.join(home, 'bin'), log = path.join(home, 'calls');
  fs.mkdirSync(bin);
  const logScript = '#!/bin/sh\nprintf "%s" "$(basename "$0")" >> "$INSTALL_LOG"\nfor x in "$@"; do printf "\\t%s" "$x" >> "$INSTALL_LOG"; done\nprintf "\\n" >> "$INSTALL_LOG"\n';
  for (const cli of ['claude', 'codex', 'agy', 'kimi', 'pi', 'python3']) fs.writeFileSync(path.join(bin, cli), logScript, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\nprintf 24.0.0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'bash'), '#!/bin/sh\nprintf "dial\\t%s\\t%s\\n" "$WHEELCHAIR_PRESENT" "$2" >> "$INSTALL_LOG"\n[ "$2" = --json ] && echo \'{"level":"high"}\'\nexit 0\n', { mode: 0o755 });
  const recipes = path.join(home, 'recipes.json');
  const rows = [['claude','claude'],['gpt','codex'],['gemini','agy'],['kimi','kimi'],['openrouter','pi']];
  fs.writeFileSync(recipes, JSON.stringify(Object.fromEntries(rows.map(([p]) => [p, 'true']))));
  const env = { ...process.env, HOME: home, PATH: `${bin}:/usr/bin:/bin`, INSTALL_LOG: log, WHEELCHAIR_HARNESS_RECIPES: recipes, WHEELCHAIR_CLAUDE_HOME: path.join(home, 'custom-claude'), WHEELCHAIR_CODEX_HOME: path.join(home, 'custom-codex') };
  for (const [provider, cli] of rows) {
    fs.writeFileSync(log, '');
    const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(root, 'machine/lib/harness-install'))}).start(${JSON.stringify(provider)})`], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const file = path.join(home, '.wheelchair/installs', `${provider}.result`);
    for (let n = 0; n < 15 && !fs.existsSync(file); n++) await sleep(1000);
    assert.ok(fs.existsSync(file), `${provider} did not finish`);
    assert.equal(JSON.parse(fs.readFileSync(file)).state, 'succeeded', fs.readFileSync(path.join(home, '.wheelchair/installs', `${provider}.log`), 'utf8'));
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => line.split('\t'));
    const expected = [];
    if (['claude', 'gpt'].includes(provider)) {
      const other = provider === 'gpt' ? 'claude' : 'codex';
      expected.push(['python3', '-I', path.join(root, 'install/unseen.py'), root, env.WHEELCHAIR_CLAUDE_HOME, env.WHEELCHAIR_CODEX_HOME, `${cli},`], ['dial', other, '--json'], ['dial', cli, 'high']);
    }
    if (cli !== 'pi') expected.push([cli, '--version']);
    assert.deepEqual(calls, expected, provider);
  }
});

test('Node version errors use each npm provider label', async () => {
  const home = makeTempSync('char-install-label-'), bin = path.join(home, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\nprintf 1.0.0\n', { mode: 0o755 });
  const recipes = path.join(home, 'recipes.json'); fs.writeFileSync(recipes, JSON.stringify({ gpt: 'true', openrouter: 'true' }));
  const env = { ...process.env, HOME: home, PATH: `${bin}:/usr/bin:/bin`, WHEELCHAIR_HARNESS_RECIPES: recipes };
  for (const [provider, label, version] of [['gpt','Codex','16.0.0'],['openrouter','Pi (OpenRouter)','22.19.0']]) {
    const child = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(root, 'machine/lib/harness-install'))}).start(${JSON.stringify(provider)})`], { env, encoding: 'utf8' }); assert.equal(child.status, 0, child.stderr);
    const dir = path.join(home, '.wheelchair/installs'), result = path.join(dir, `${provider}.result`);
    for (let n = 0; n < 15 && !fs.existsSync(result); n++) await sleep(1000);
    assert.ok(fs.existsSync(result)); assert.equal(JSON.parse(fs.readFileSync(result)).state, 'failed');
    assert.equal(fs.readFileSync(path.join(dir, `${provider}.log`), 'utf8').trim(), `${label} needs Node ${version} or newer; this machine has 1.0.0. Update Node, then try again.`);
  }
});

test('failed Claude and Codex recipes do not run cleanup or sensitivity', async () => {
  const home = makeTempSync('char-install-failed-'), bin = path.join(home, 'bin'), log = path.join(home, 'calls'); fs.mkdirSync(bin);
  fs.writeFileSync(log, '');
  fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\nprintf 24.0.0\n', { mode: 0o755 });
  for (const name of ['python3', 'bash']) fs.writeFileSync(path.join(bin, name), '#!/bin/sh\necho unexpected >> "$INSTALL_LOG"\n', { mode: 0o755 });
  const recipes = path.join(home, 'recipes.json'); fs.writeFileSync(recipes, JSON.stringify({ claude: 'exit 17', gpt: 'exit 17' }));
  const env = { ...process.env, HOME: home, PATH: `${bin}:/usr/bin:/bin`, INSTALL_LOG: log, WHEELCHAIR_HARNESS_RECIPES: recipes };
  for (const provider of ['claude', 'gpt']) {
    const child = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(root, 'machine/lib/harness-install'))}).start(${JSON.stringify(provider)})`], { env, encoding: 'utf8' }); assert.equal(child.status, 0, child.stderr);
    const result = path.join(home, '.wheelchair/installs', `${provider}.result`);
    for (let n = 0; n < 15 && !fs.existsSync(result); n++) await sleep(1000);
    assert.ok(fs.existsSync(result)); assert.equal(JSON.parse(fs.readFileSync(result)).exit_code, 17); assert.equal(fs.readFileSync(log, 'utf8'), '');
  }
});
