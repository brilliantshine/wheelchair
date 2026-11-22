'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeDir } = require('./helpers/server.js');
const { Hub } = require('../app/hub.js');
const { listLeads } = require('../app/peers.js');

test('lead listing respects machine, project, reachability, links and summaries', async () => {
  const dir = await makeDir('lead-list-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  await fs.writeFile(path.join(dir, 'machines.json'), JSON.stringify({ host: { address: 'local', port: 7374 }, other: { address: 'remote' } }));
  await fs.writeFile(path.join(dir, 'machine.json'), JSON.stringify({ host: 'local', port: 7374 }));
  const make = (id, extra = {}) => ({ id: id.repeat(12), machine: 'hub', project: '/one', title: id, sessions: [{ name: id, role: 'lead', live: true }], pinned: {}, cards: [], ...extra });
  const caller = make('a', { sessions: [{ name: 'caller', role: 'lead', live: true }, { name: 'worker', role: 'worker', live: true }], lead_links: ['e'.repeat(12)] });
  const records = [caller, make('b', { machine: 'host', last_status: 'building', branch: 'branch', pinned: { idea: { bullets: Array.from({ length: 7 }, (_, i) => ({ text: String(i) })) }, progress: { stage: 'verify', phase: 'fixing', pass: 2, found: 3, fixed: 1, machines: ['host'], choice_waiting: true } }, cards: [{ kind: 'done', pr_url: 'old' }, { kind: 'done', pr_url: 'new' }, { kind: 'done', pr_url: 'retracted', retracted_at: 'now' }] }), make('c', { slug: 'plan', sessions: [{ name: 'dead', role: 'lead', live: false }] }), make('d', { project: '/two', slug: 'fallback-slug', title: undefined }), make('e', { project: '/two', sessions: [] }), make('f', { project: '/three', lead_links: [caller.id] }), make('1', { archived: true }), make('2', { handed_off: {} }), make('3', { machine: 'other' }), make('4', { sessions: [{ role: 'worker' }] })];
  for (const record of records) await hub.state.save(record);
  const result = await listLeads(hub, caller, {});
  const byId = Object.fromEntries(result.leads.map(e => [e.thread[0], e]));
  assert.deepEqual(Object.keys(byId).sort(), ['b', 'c', 'e', 'f']);
  assert.deepEqual(byId.b, { thread: 'b'.repeat(12), lead: 'b', project: '/one', title: 'b', linked: false, stage: 'building', idea: ['0', '1', '2', '3', '4', '5'], progress: 'Verifying · attempt 2 · 3 gaps, 1 fixed · host: choice for you', branch: 'branch', pr_url: 'new' });
  assert.equal(byId.c.lead, null); assert.equal(byId.c.stage, 'unknown'); assert.equal(byId.e.stage, 'no plan');
  assert.equal(byId.e.linked, true); assert.equal(byId.f.linked, true);
  const all = await listLeads(hub, caller, { allProjects: true });
  assert.equal(all.leads.length, 5);
  assert.deepEqual(all.leads.find(e => e.thread === 'd'.repeat(12)), { thread: 'd'.repeat(12), lead: 'd', project: '/two', title: 'fallback-slug', linked: false });
  assert.deepEqual(all.leads.filter(e => e.linked).length, 2);
  assert.deepEqual(all.leads.map(e => e.thread), (await hub.state.allThreads()).filter(t => all.leads.some(e => e.thread === t.id)).map(t => t.id));
  await assert.rejects(hub.sessionRequest({ action: 'leads', calling_session: 'worker' }), e => e.status === 403 && e.message === 'only a lead may list other leads');
  assert.deepEqual(await hub.sessionRequest({ action: 'leads', calling_session: 'caller', all_projects: true }), all);
});

test('discovers only candidate stubs with addition and dependency details', async () => {
  const dir = await makeDir('stub-list-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  await fs.writeFile(path.join(dir, 'machine.json'), JSON.stringify({ host: 'local', port: 7374 }));
  const make = (id, extra = {}) => ({ id: id.repeat(12), machine: 'hub', project: '/one', title: id, stub: true, context: 'Existing context', sessions: [], cards: [], pinned: {}, ...extra });
  const caller = make('a', { stub: false, sessions: [{ role: 'lead' }] });
  const records = [caller, make('b', { depends_on_parent: true }), make('c', { sessions: [{ role: 'lead', name: 'lead', live: true }], depends_on_parent: true, ready: true }), make('d', { archived: true }), make('e', { handed_off: {} }), make('f', { cards: [{ kind: 'done' }] }), make('1', { cards: [{ kind: 'merged' }] }), make('2', { project: '/two' }), make('3', { stub: false, sessions: [{ role: 'lead' }] }), make('4', { stub: true, cards: [{ kind: 'done' }], sessions: [{ role: 'lead' }] })];
  for (const record of records) await hub.state.save(record);
  const entries = (await listLeads(hub, caller, { allProjects: true })).leads;
  const get = id => entries.find(entry => entry.thread === id.repeat(12));
  assert.deepEqual([get('b').lead, get('b').stub, get('b').summary, get('b').takes_additions, get('b').waits_on_parent], [null, true, 'Existing context', true, true]);
  assert.equal(get('c').takes_additions, false); assert.equal(get('c').waits_on_parent, false);
  for (const id of ['d', 'e', 'f', '1', '2']) assert.equal(get(id), undefined);
  assert.equal(Object.hasOwn(get('3'), 'stub'), false); assert.equal(Object.hasOwn(get('4'), 'stub'), false);
});
