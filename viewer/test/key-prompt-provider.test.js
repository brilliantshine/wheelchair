'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../pages/settings.js'), 'utf8');
test('sign-in hint uses the account tool prompt', () => {
  const context = vm.createContext({ TOOLS: [{ settings: { signInKind: 'key', keyPrompt: 'first' } }] });
  vm.runInContext(source.match(/const signinHint = .*;\n/)[0] + '\nthis.hint = signinHint;', context);
  assert.equal(context.hint({ url: null }, { settings: { keyPrompt: 'second' } }), 'second');
  assert.equal(context.hint({ url: null }), 'first');
  assert.match(source, /signinHint\(st, toolOf\(account\.provider\)\)/);
});
