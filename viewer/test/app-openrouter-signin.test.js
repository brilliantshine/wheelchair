'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../pages/settings.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(source.match(/const keyOnlySignin = .*;\n/)[0] + source.match(/const signinHint = .*;\n/)[0], ctx);
const run = (code, st) => vm.runInContext(`${code}(${JSON.stringify(st)})`, ctx);

test('a key-only waiting state shows the paste field with the key hint', () => {
  const st = { state: 'waiting', url: null, code: null, wantsCode: true, logged_in: false };
  assert.equal(run('keyOnlySignin', st), true);
  assert.equal(run('signinHint', st), 'Paste your OpenRouter key');
});

test('states with a link or without wantsCode keep the existing behaviour', () => {
  const link = { state: 'waiting', url: 'https://x.test/', wantsCode: true };
  assert.equal(run('keyOnlySignin', link), false);
  assert.equal(run('signinHint', link), 'Open the link, sign in, then paste the code it shows.');
  assert.equal(run('signinHint', { state: 'waiting', url: 'https://x.test/', wantsCode: false }), 'Open the link and sign in.');
  for (const st of [{ state: 'starting', url: null, wantsCode: true }, { state: 'waiting', url: null, wantsCode: false }]) assert.equal(run('keyOnlySignin', st), false);
});

test('the page treats key-only waiting like a link: the startup timeout stops, the key is a password field, 409 offers a restart for OpenRouter only', () => {
  assert.match(source, /if \(\(card\.hadUrl \|\| !\(st\.url \|\| keyOnly\)\) && expired\(\)\) return fail\(\);/);
  assert.match(source, /if \(st\.url \|\| keyOnly\) \{\s*if \(!card\.hadUrl\) card\.firstUrl = Date\.now\(\);\s*card\.hadUrl = true;/);
  assert.match(source, /type: 'password'[^}]*'aria-label': 'Paste your OpenRouter key'/);
  assert.match(source, /e\.status === 409 && account\.provider === 'openrouter'[\s\S]*Start again/);
});
