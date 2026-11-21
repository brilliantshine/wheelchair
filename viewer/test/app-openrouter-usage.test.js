'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const usage = require('../app/usage.js');
const { api, close, setup } = require('./helpers/app.js');

const fake = (answers) => ({
  machines: async () => Object.fromEntries(Object.keys(answers).map((n) => [n, {}])),
  call: async (name, route) => {
    assert.equal(route, '/v1/spend');
    const a = answers[name];
    if (a instanceof Error) throw a;
    return a;
  },
});
const row = (today, w, m) => ({ account: 'x', today, last_7_days: w, last_30_days: m });

const source = fs.readFileSync(path.join(__dirname, '../pages/settings.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(`${source.match(/const usd = .*;\n/)[0]}${source.match(/const spendText = [\s\S]*?\n  \};\n/)[0]}`, ctx);
const text = (sp) => vm.runInContext(`spendText(${JSON.stringify(sp)})`, ctx);

test('spend sums every account on every machine', async () => {
  const total = await usage.spend(fake({ a: { accounts: [row(0.1, 1, 2), row(0.2, 1.5, 3)] }, b: { accounts: [row(0.12, 0.6, 6.8)] } }));
  assert.ok(Math.abs(total.today - 0.42) < 1e-9);
  assert.ok(Math.abs(total.last_7_days - 3.1) < 1e-9);
  assert.ok(Math.abs(total.last_30_days - 11.8) < 1e-9);
  assert.equal(total.incomplete, false);
  assert.equal(text(total), '$0.42 today · $3.10 last 7 days · $11.80 last 30 days');
});

test('all zero says no spend yet; unreachable and 404 machines mark it incomplete', async () => {
  const zero = await usage.spend(fake({ a: { accounts: [row(0, 0, 0)] }, b: { accounts: [] } }));
  assert.equal(text(zero), 'no spend yet');
  for (const bad of [new Error('connect refused'), Object.assign(new Error('not found'), { status: 404 }), { nope: 1 }]) {
    const r = await usage.spend(fake({ a: { accounts: [row(0, 0, 0)] }, b: bad }));
    assert.equal(r.incomplete, true);
    assert.equal(text(r), '$0.00 today · $0.00 last 7 days · $0.00 last 30 days · total may be incomplete');
    assert.ok(!text(r).includes('no spend yet'));
  }
  const some = await usage.spend(fake({ a: { accounts: [row(1, 2, 3)] }, b: new Error('down') }));
  assert.equal(text(some), '$1.00 today · $2.00 last 7 days · $3.00 last 30 days · total may be incomplete');
});

test('spend formatting', () => {
  assert.equal(text({ today: 0.004, last_7_days: 0.005, last_30_days: 12.345 }), '<$0.01 today · $0.01 last 7 days · $12.35 last 30 days');
  assert.equal(text({ today: 0, last_7_days: 0.0001, last_30_days: 0.0001 }), '$0.00 today · <$0.01 last 7 days · <$0.01 last 30 days');
});

test('OpenRouter accounts are never out of room, amber or alerting', () => {
  const now = Date.now();
  const acct = { id: 'o', provider: 'openrouter', name: 'O', weight: 1, paused: false };
  const bad = { account: 'o', at: new Date(now).toISOString(), limited_until: new Date(now + 3600000).toISOString(), week: { used: 100, resets_at: new Date(now + 86400000).toISOString() }, five_hour: { used: 100, resets_at: new Date(now + 3600000).toISOString() } };
  assert.equal(usage.hasRoom(acct, bad, { loggedIn: true, leave: 10, now }), true);
  assert.equal(usage.hasRoom({ ...acct, paused: true }, bad, { loggedIn: true, now }), false);
  assert.equal(usage.hasRoom(acct, bad, { loggedIn: false, now }), false);
  const f = usage.forecast([acct], { o: bad }, now);
  assert.equal(f.amber, false); assert.equal(f.left, null); assert.equal(usage.belowMargin(f, 100, now), false);
});

test('the usage route carries spend for OpenRouter only and a 404 machine is incomplete', async () => {
  const c = await setup();
  try {
    const r = await api(c, '/usage');
    assert.equal(r.status, 200);
    assert.equal(r.body.providers.claude.spend, undefined);
    assert.equal(r.body.providers.openrouter.spend.incomplete, true);
    assert.equal(r.body.providers.openrouter.amber, false);
    assert.equal((await api(c, '/usage/alert')).status, 200);
  } finally { await close(c); }
});
