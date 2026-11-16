'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = role => fs.readFileSync(path.join(root, 'protocol/app', `${role}.md`), 'utf8');
const paragraphHas = (text, ...words) => text.split(/\n\s*\n/).some(p => words.every(word => p.includes(word)));

for (const role of ['worker', 'mapper', 'sub-lead', 'lead', 'cards']) {
  test(`${role} permits its own commands`, () => {
    assert.ok(read(role).includes('own `wc.js` and `card.js`'));
  });
}
for (const role of ['worker', 'mapper', 'sub-lead']) {
  test(`${role} reports conflicts instead of stopping silently`, () => {
    assert.ok(paragraphHas(read(role), 'blocked', 'silently'));
  });
}
for (const role of ['reviewer', 'verifier']) {
  test(`${role} reports obstacles instead of stopping silently`, () => {
    assert.ok(paragraphHas(read(role), 'report', 'silently'));
  });
}
for (const role of ['worker', 'mapper', 'sub-lead', 'reviewer', 'verifier']) {
  test(`${role} waits for background work in the foreground`, () => {
    assert.ok(paragraphHas(read(role), 'background', 'foreground'));
  });
}
