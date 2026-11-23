'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { makeTempSync } = require('../../test-support/run-dir');
const { AsideTurns } = require('../lib/aside-turns');
const { loadRecipes, providers } = require('../lib/harness-recipes');
const { classify } = require('../lib/steps');

test('aside provider eligibility and model validation', () => {
  const dir = makeTempSync('aside-validation-');
  const store = new AsideTurns(dir, async () => {}, x => x);
  const base = { turn_id: crypto.randomUUID(), new_id: crypto.randomUUID(), mode: 'fork', from: 'parent', cwd: dir, prompt: 'hello', account_dir: null };
  for (const provider of ['claude', 'gpt', 'openrouter']) {
    const valid = provider === 'openrouter' ? 'vendor/model:variant' : 'Model-1.2:[test]';
    assert.equal(store.validate({ ...base, provider, model: valid }), null);
    for (const model of ['', 'space model', 'UPPER/model']) assert.throws(() => store.validate({ ...base, provider, model }), { status: 400, message: 'model is required' });
    if (provider !== 'openrouter') assert.throws(() => store.validate({ ...base, provider, model: 'vendor/model' }), { status: 400, message: 'model is required' });
    else assert.throws(() => store.validate({ ...base, provider, model: 'model' }), { status: 400, message: 'model is required' });
  }
  for (const provider of ['gemini', 'kimi']) assert.throws(() => store.validate({ ...base, provider, model: 'model' }), { status: 400, message: 'invalid provider' });
});

test('recipes and Node requirements for all providers', () => {
  assert.deepEqual(providers, ['claude', 'gpt', 'gemini', 'kimi', 'openrouter']);
  assert.deepEqual(loadRecipes(), {
    claude: { command: 't=$(mktemp) && curl -fsSL https://claude.ai/install.sh -o "$t" && bash "$t"; r=$?; rm -f "$t"; exit $r' },
    gpt: { command: 'npm install -g --prefix "$HOME/.local" @openai/codex@latest', node: '16.0.0' },
    gemini: { command: 't=$(mktemp) && curl -fsSL https://antigravity.google/cli/install.sh -o "$t" && bash "$t"; r=$?; rm -f "$t"; exit $r' },
    kimi: { command: 't=$(mktemp) && curl -fsSL https://code.kimi.com/kimi-code/install.sh -o "$t" && bash "$t"; r=$?; rm -f "$t"; exit $r' },
    openrouter: { command: 'npm install -g --prefix "$HOME/.local" @earendil-works/pi-coding-agent@latest', node: '22.19.0' },
  });
});

test('step classification uses Claude names only for Claude', () => {
  for (const cli of ['claude', 'codex', 'agy', 'kimi', 'pi']) {
    assert.deepEqual(classify(cli, 'Agent', { description: 'inspect' }), cli === 'claude'
      ? { kind: 'helpers', label: 'Asked a helper: inspect', key: 'helpers:helpers' }
      : { kind: 'shell', label: 'Used Agent', key: 'shell:Agent' });
    assert.deepEqual(classify(cli, 'spawn_agent', { description: 'inspect' }), cli === 'claude'
      ? { kind: 'shell', label: 'Used spawn_agent', key: 'shell:spawn_agent' }
      : { kind: 'helpers', label: 'Asked a helper: inspect', key: 'helpers:helpers' });
  }
});
