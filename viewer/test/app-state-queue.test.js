'use strict';

// A refused operation inside the per-file write queue must reach its caller and nothing
// else: an unhandled rejection ends the viewer process (verification round 2).
const { makeTempSync } = require('../../test-support/run-dir');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('a failed queued operation reaches its caller and leaves the process running', () => {
  const state = path.join(__dirname, '..', 'app', 'state.js');
  const dir = makeTempSync('state-queue-');
  const script = `
    const { State } = require(${JSON.stringify(state)});
    const store = new State(${JSON.stringify(dir)});
    store.queued('x', async () => { throw new Error('refused'); })
      .catch((error) => { console.log('caught', error.message); });
    setTimeout(() => console.log('alive'), 100);
  `;
  const run = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /caught refused/);
  assert.match(run.stdout, /alive/);
});
