'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { startServer } = require('./helpers/server');
test('default servers allocate independent temporary hub state', async () => {
  const one = await startServer();
  let two;
  try {
    two = await startServer();
    assert.notEqual(one.stateDir, two.stateDir);
    assert.notEqual(one.root, two.root);
    await fs.writeFile(path.join(one.stateDir, 'isolation-marker'), 'one');
    await assert.rejects(fs.access(path.join(two.stateDir, 'isolation-marker')), { code: 'ENOENT' });
  } finally {
    await one.stop();
    if (two) await two.stop();
  }
});
