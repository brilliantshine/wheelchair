'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const connectors = require('../../connectors');
const slots = ['light', 'standard', 'heavy', 'critical', 'lead', 'sub-lead'];

function roundTrip(tools) {
  const dir = makeTempSync('model-roundtrip-');
  const registry = path.join(dir, 'registry.json');
  fs.writeFileSync(registry, JSON.stringify({ tools }));
  const env = { ...process.env, HOME: dir, CODEX_HOME: dir, WHEELCHAIR_REGISTRY: registry,
    WHEELCHAIR_MODELS: path.join(dir, 'models'), WHEELCHAIR_MODELS_CACHE: path.join(dir, 'cache'), WHEELCHAIR_KIMI_CONFIG: path.join(dir, 'kimi.toml') };
  let context = 'init';
  function runExpected(expected, ...args) {
    const result = spawnSync(path.resolve(__dirname, '../../codex/model.sh'), args, { env, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, expected, `${context}: ${args.join(' ')}: exit ${result.status}: ${result.error || ''} ${result.stderr}`);
    assert.doesNotMatch(result.stdout + result.stderr, /Traceback|malformed pins file|is malformed/i, `${context}: ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  }
  function run(...args) { return runExpected(0, ...args); }
  function read(provider, slot, model, effort) {
    assert.equal(runExpected(model === 'none' ? 3 : 0, provider, slot), model === 'none' ? '' : model, `${context}: model`);
    assert.equal(run('effort', provider, slot), effort || '', `${context}: effort`);
    const shown = JSON.parse(run('show', '--json'));
    assert.equal(shown.malformed, false, `${context}: malformed`);
    assert.deepEqual(shown[provider][slot], model === 'none' ? null : { model, effort: effort || null }, `${context}: show`);
  }
  run('init');
  for (const tool of tools) for (const slot of slots) {
    const pin = tool.models.pins[slot] || (slot === 'sub-lead' ? tool.models.pins.lead : undefined);
    assert.ok(pin, `${tool.cli} ${slot}: missing default`);
    context = `init default ${tool.cli} ${slot} ${JSON.stringify(pin)}`;
    assert.equal(runExpected(pin.model === 'none' ? 3 : 0, tool.provider, slot), pin.model === 'none' ? '' : pin.model, `${context}: model`);
    assert.equal(run('effort', tool.provider, slot), pin.effort || '', `${context}: effort`);
  }
  for (const tool of tools) {
    const other = tools.find(t => t.provider === 'gpt' && t.provider !== tool.provider) || tools.find(t => t.provider === 'claude' && t.provider !== tool.provider);
    const sentinel = other.provider === 'gpt' ? 'gpt-roundtrip-sentinel' : 'claude-roundtrip-sentinel';
    context = `${tool.provider}: other ${other.provider} standard ${sentinel}`;
    run('set', other.provider, 'standard', sentinel);
    for (const slot of slots) {
      const pin = tool.models.pins[slot] || (slot === 'sub-lead' ? tool.models.pins.lead : undefined);
      assert.ok(pin, `${tool.provider} ${slot}: missing default`);
      context = `${tool.provider} ${slot} ${JSON.stringify(pin)}`;
      run('set', tool.provider, slot, pin.model, ...(pin.effort ? [pin.effort] : []));
      read(tool.provider, slot, pin.model, pin.effort);
      read(other.provider, 'standard', sentinel, null);
    }
    const effortSlot = slots.find(slot => tool.models.pins[slot]?.model !== 'none' && tool.models.pins[slot]) || slots.find(slot => tool.models.pins[slot]);
    const defaultModel = tool.models.pins[effortSlot].model;
    const effortModel = defaultModel === 'none' ? `${tool.provider}-roundtrip-model` : defaultModel;
    if (defaultModel === 'none' && (!new RegExp(tool.models.format).test(effortModel) || !/^[a-z0-9][a-z0-9._/:-]*$/.test(effortModel))) {
      assert.fail(`${tool.provider}: no candidate model ${effortModel} fits models.format and the pin-file rule; provide a sample model for the effort round trip`);
    }
    if (defaultModel === 'none') context = `${tool.provider}: effort loop uses generated sample model ${effortModel}`;
    for (const effort of tool.models.efforts) {
      context = `${tool.provider} ${effortSlot} ${effortModel} @${effort}`;
      run('set', tool.provider, effortSlot, effortModel, effort);
      read(tool.provider, effortSlot, effortModel, effort);
      read(other.provider, 'standard', sentinel, null);
    }
    // Exercise values accepted by a format without anchors through the write path.
    if (!tool.models.format.startsWith('^') || !tool.models.format.endsWith('$')) {
      context = `${tool.provider} light invalid model with capitals`;
      run('set', tool.provider, 'light', 'INVALID');
      read(tool.provider, 'light', 'INVALID', null);
    }
  }
}

test('real model pin round trip for every connector', { timeout: 120000 }, () => roundTrip(connectors.list()));
test('model round trip rejects invalid sixth connectors', { timeout: 120000 }, () => {
  const cases = [
    [t => { t.models.pins.light.effort = 'unlisted'; }, /malformed/i],
    [t => { t.models.efforts.push('very-high'); }, /sixth light .*very-high.*(?:malformed|exit)/i],
    [t => { t.models.pins['sub-lead'] = { model: 'sixth-sublead-model', effort: 'high' }; }, /init default sixth sub-lead .*sixth-sublead-model/i],
    [t => { t.models.format = '[A-Za-z0-9][A-Za-z0-9._-]*'; }, /sixth light invalid model with capitals.*exit/i],
    [t => { delete t.models.pins.light; }, /(?:Traceback|KeyError).*light/s],
    [t => { t.models.pins.light.model = 'Capital'; }, /malformed/i],
  ];
  for (const [mutate, reason] of cases) {
    const extra = structuredClone(connectors.list().find(t => t.provider === 'claude'));
    extra.provider = 'sixth'; extra.cli = 'sixth'; mutate(extra);
    assert.throws(() => roundTrip([...connectors.list(), extra]), reason);
  }
});

test('sixth connector and none default round trip', { timeout: 120000 }, () => {
  const extra = structuredClone(connectors.list().find(t => t.provider === 'claude'));
  extra.provider = 'sixth'; extra.cli = 'sixth';
  roundTrip([...connectors.list(), extra]);
  for (const slot of ['light', 'standard', 'heavy', 'critical', 'lead']) extra.models.pins[slot] = { model: 'none' };
  roundTrip([...connectors.list(), extra]);
});
