'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, close, api } = require('./helpers/app');
const sessions = require('../app/sessions');

test('shared tools setting defaults, validates and saves', async () => {
  const c = await setup();
  try {
    assert.equal((await api(c, '/settings')).body.shared_tools_repo, null);
    assert.equal((await api(c, '/settings/preferences', { method: 'PUT', body: { shared_tools_repo: 'owner/tools' } })).status, 200);
    assert.equal((await api(c, '/settings')).body.shared_tools_repo, 'owner/tools');
    assert.equal((await api(c, '/settings/preferences', { method: 'PUT', body: { shared_tools_repo: 'owner/bad/name' } })).status, 400);
    assert.equal((await api(c, '/settings/preferences', { method: 'PUT', body: { shared_tools_repo: null } })).status, 200);
  } finally { await close(c); }
});

test('folder problem lines appear and clear on a newer update', () => {
  const thread = { cards: [] };
  const created_at = '2026-01-01T00:00:00Z';
  sessions.applyProjectTools(thread, { created_at, project_tools: { boot: 'a', seq: 1, folder: [{ names: ['x'], text: 'x is invalid' }] } });
  assert.deepEqual(thread.cards[0].items, ['x is invalid']);
  sessions.applyProjectTools(thread, { created_at, project_tools: { boot: 'a', seq: 2 } });
  assert.equal(thread.cards[0].answered, true);
});

test('session start sends this machine’s saved paths in order and omits an unset choice', async () => {
  const { thread } = require('./helpers/app'); const fs = require('node:fs/promises'); const path = require('node:path');
  const c = await setup();
  try {
    await api(c, '/settings/preferences', { method: 'PUT', body: { shared_tools_repo: 'owner/tools' } });
    const file = path.join(c.state, 'settings.json'); const data = JSON.parse(await fs.readFile(file, 'utf8'));
    data.saved_dirs = [{name:'one',machine:'hub',path:'/one'},{name:'other',machine:'else',path:'/other'},{name:'two',machine:'hub',path:'/two'}]; await fs.writeFile(file, JSON.stringify(data));
    await thread(c, { project: '/tmp/one' });
    let starts = c.machine.calls.filter(call => call.path === '/v1/sessions' && call.method === 'POST');
    assert.deepEqual(starts.at(-1).body.shared_tools, {repo:'owner/tools',candidates:['/one','/two']});
    await api(c, '/settings/preferences', { method: 'PUT', body: { shared_tools_repo: null } });
    await thread(c, { project: '/tmp/two' }); starts = c.machine.calls.filter(call => call.path === '/v1/sessions' && call.method === 'POST');
    assert.equal(Object.hasOwn(starts.at(-1).body, 'shared_tools'), false);
  } finally { await close(c); }
});

test('ready event updates folder problem card', async () => {
  const { thread, event } = require('./helpers/app'); const c = await setup();
  try {
    const made = await thread(c); const session = made.sessions[0];
    const result = await event(c, made.id, session.name, 'ready', { created_at: '2026-01-01T00:00:00Z', project_tools: {boot:'b',seq:1,folder:[{names:['bad'],text:'bad tool'}]} });
    assert.equal(result.status, 202);
    const saved = (await api(c, `/threads/${made.id}`)).body;
    assert.ok(saved.cards.some(card => card.items?.includes('bad tool')));
  } finally { await close(c); }
});
