'use strict';
// Keep service instances independent of the host's WSL and interop setup.
const noWsl = { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname };
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const { startupWarning } = require('../lib/startup-warning');

async function fixture() {
  const root = await makeTemp('startup-warning-');
  const entries = [];
  async function add(role, value, opts = {}) {
    const id = String(entries.length).padStart(4, '0');
    const entry = { at: id, provider: 'claude', role, name: `wc-${id}`, thread_id: 'thread', cli_session_id: id, ...opts.entry };
    entries.push(entry);
    if (!opts.missing) {
      const file = path.join(root, 'transcripts', entry.thread_id, `${entry.name}.jsonl`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      const record = { type: 'assistant', sessionId: id, message: { model: 'opus', usage: { input_tokens: value } } };
      await fs.writeFile(file, [...(opts.prefix || []), JSON.stringify(record)].join('\n'));
    }
    return entry;
  }
  async function ledger(prefix = '') { await fs.writeFile(path.join(root, 'session-ledger.jsonl'), prefix + entries.map(e => JSON.stringify(e)).join('\n') + '\n'); }
  return { root, entries, add, ledger, scan: () => startupWarning(root, new Map()) };
}
test('medians, thresholds, outliers, both roles and ignored entries', async () => {
  const f = await fixture();
  for (let i = 0; i < 4; i++) await f.add('lead', 47200);
  await f.ledger(); assert.equal(await f.scan(), null);
  await f.add('lead', 47200); await f.ledger(); assert.match(await f.scan(), /lead sessions now start about 6,200.*47,200 vs 41,000/);
  for (let i = 0; i < 5; i++) await f.add('reviewer', 29100);
  await f.ledger(); assert.match(await f.scan(), /^Claude lead .*; reviewer sessions now start about 6,100.*29,100 vs 23,000/);
  for (let i = 0; i < 5; i++) { await f.add('lead', 46000); await f.add('reviewer', 28000); }
  await f.add('lead', 100000, { entry: { provider: 'codex' } }); await f.add('worker', 100000);
  await f.ledger(); assert.equal(await f.scan(), null);
  await f.add('lead', 100000); await f.add('lead', 100000); await f.ledger(); assert.equal(await f.scan(), null);
});
test('skips malformed records and missing copies, reads tail and caches only hits', async () => {
  const f = await fixture();
  const bad = [
    { type: 'assistant', message: { model: '<synthetic>', usage: { input_tokens: 90000 } } },
    { type: 'assistant', message: { usage: { input_tokens: 90000 } } },
    ...[0, -1, '90000', null].map(n => ({ type: 'assistant', message: { model: 'opus', usage: { input_tokens: n } } })),
    { type: 'assistant', sessionId: 'other', message: { model: 'opus', usage: { input_tokens: 90000 } } },
  ].map(JSON.stringify);
  bad.push('{"type":"assistant","message":{"model":"opus","usage":{"input_tokens":1e999}}}', 'broken');
  for (let i = 0; i < 5; i++) await f.add('lead', 47200, { prefix: bad });
  const missing = await f.add('lead', 99999, { missing: true });
  await f.ledger('x'.repeat(530000) + '\ncorrupt\n');
  const cache = new Map(); assert.match(await startupWarning(f.root, cache), /6,200/); assert.equal(cache.size, 5); assert.equal(cache.has(missing.cli_session_id), false);
  await fs.writeFile(path.join(f.root, 'transcripts', 'thread', `${missing.name}.jsonl`), JSON.stringify({ type: 'assistant', message: { model: 'opus', usage: { cache_read_input_tokens: 50000 } } }));
  await startupWarning(f.root, cache); assert.equal(cache.get(missing.cli_session_id), 50000);
});
test('refresh coalesces triggers, publishes on completion, and recovers from errors', async () => {
  const f = await fixture(); const svc = new MachineService({ win: noWsl, stateDir: f.root });
  let release; let count = 0; svc.log = () => {}; svc.startupWarning = 'old';
  svc.scanStartupWarning = async () => { count++; if (count === 1) { await new Promise(r => { release = r; }); throw Error('failed'); } return startupWarning(f.root, svc.startupSamples); };
  const running = svc.refreshStartupWarning(); svc.refreshStartupWarning(); svc.refreshStartupWarning();
  assert.equal(svc.startupWarning, 'old'); assert.equal(svc.startupWarningRerun, true);
  for (let i = 0; i < 5; i++) await f.add('lead', 47200); await f.ledger();
  release(); await running; assert.equal(count, 2); assert.match(svc.startupWarning, /6,200/);
  svc.scanStartupWarning = async () => { throw Error('failed'); }; await svc.refreshStartupWarning(); assert.equal(svc.startupWarning, null);
});
