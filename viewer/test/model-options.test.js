'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const connectors = require('../../connectors');
const { options } = require('../app/settings');
const models = { visible: ['a', 'b'], gpt: { light: { model: 'b' }, heavy: { model: 'c' } }, kimi_visible: [{ value: 'x', label: 'X' }, { value: 'bad' }], kimi: { light: { model: 'x' }, heavy: { model: 'y' }, lead: { model: 'y' } } };
test('model choices preserve the current lists and pins', () => {
  assert.deepEqual(options(models), {
    claude: [['haiku','Latest Haiku'],['sonnet','Latest Sonnet'],['opus','Latest Opus'],['fable','Latest Fable'],...['claude-haiku-5-5','claude-sonnet-5-5','claude-opus-5-5','claude-fable-5-2'].map(x => [x,x])].map(([value,label]) => ({ value,label })),
    gpt: ['a','b','c'].map(value => ({ value, label: value })),
    kimi: [{ value: 'x', label: 'X' }, { value: 'y', label: 'y' }],
  });
});
test('model choices include a sixth manifest', () => {
  const original = connectors.list;
  const extra = structuredClone(original()[0]); extra.provider = 'extra'; extra.settings.modelOptions = { fixed: [['new','New']] };
  connectors.list = () => [...original(), extra];
  try { assert.deepEqual(options(models).extra, [{ value: 'new', label: 'New' }]); } finally { connectors.list = original; }
});
