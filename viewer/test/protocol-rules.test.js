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

const roles = ['lead', 'sub-lead', 'worker', 'mapper', 'reviewer', 'verifier'];
const leadKinds = ['offer', 'idea', 'deferred', 'question', 'approval', 'needs', 'resolve', 'done', 'merged', 'diagram', 'image', 'stub', 'sudo', 'retract', 'title'];
const sharedKinds = ['progress', 'message', 'result'];
const sections = text => [...text.matchAll(/^### `([^`]+)`$/gm)].map(match => match[1]);

test('each schema kind has one card section, in its intended file', () => {
  const shared = sections(read('cards'));
  const lead = sections(read('cards-lead'));
  for (const kind of Object.keys(require('../app/card.js').fields)) {
    assert.equal([...shared, ...lead].filter(item => item === kind).length, 1, kind);
  }
  assert.deepEqual([...shared].sort(), [...sharedKinds].sort());
  assert.deepEqual([...lead].sort(), [...leadKinds].sort());
});

for (const role of [...roles, 'cards']) {
  test(`${role} has no obsolete read pointer`, () => {
    assert.ok(!read(role).includes('beside this file, first'));
  });
}
for (const role of roles) {
  test(`${role} has the direct pointer fallback`, () => {
    const text = read(role);
    const fallback = text.split('\n').find(line => line.startsWith(`If you opened \`protocol/app/${role}.md\` itself by its path`));
    assert.ok(fallback && fallback.includes(`/protocol/app/${role}.md`) && fallback.includes('dropped'));
    assert.equal(fallback.includes('read `cards.md`'), !['reviewer', 'verifier'].includes(role));
    assert.equal(fallback.includes('`cards-lead.md`'), role === 'lead');
  });
}

test('sub-lead uses the binding sizing command and no-scout fallback', () => {
  const text = read('sub-lead');
  assert.ok(text.includes('wc.js diff size'));
  assert.ok(text.includes('--tricky'));
  assert.match(text, /with no scout model may read a `scout`-band diff itself/);
});
test('sub-lead briefs say role rules are in starting instructions', () => {
  const text = read('sub-lead');
  assert.ok(text.includes('starting instructions, so a brief never tells it to read its role file'));
  assert.ok(text.includes('starting instructions, so the brief never tells it to read its role file'));
});
for (const role of ['worker', 'verifier']) {
  test(`${role} preserves suite exit status`, () => {
    assert.ok(read(role).includes('echo "exit $?"'));
    assert.ok(!read(role).includes('| tail'));
  });
}

test('lead finishing steps point to mergeability before done', () => {
  const text = read('lead');
  assert.ok(text.includes('## Making the pull request mergeable'));
  for (const step of [1, 8, 9]) {
    const section = text.match(new RegExp(`^### ${step}\\. [^\\n]*\\n([\\s\\S]*?)(?=^### |^## |(?![\\s\\S]))`, 'm'));
    assert.ok(section, `step ${step}`);
    assert.ok(section[1].includes('Making the pull request mergeable'), `step ${step}`);
  }
});
test('done card table lists the pushed head', () => {
  const section = read('cards-lead').split('### `done`')[1].split('### `merged`')[0];
  assert.match(section, /^\| `head` \| string \| yes \|/m);
});
