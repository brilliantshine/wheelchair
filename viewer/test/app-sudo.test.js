'use strict';

// Sudo cards on the hub: validation, lead-only, the request_id index, the sudo-outcome route,
// the single state handler with one lead message, and the Decline and Talk about it presses.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const { validate } = require('../app/card.js');
const { Hub } = require('../app/hub.js');
const { api, card, close, machinePost, setup, thread } = require('./helpers/app.js');
const { freePort } = require('./helpers/server.js');

const PASSWORD = 'hunter2-TESTPW-9f3a';
const RID = 'a'.repeat(32);
const RID2 = 'b'.repeat(32);
const base = { command: 'systemctl restart nginx', does: 'Restarts the web server.', why: 'The config changed.' };
const machineCard = (extra = {}) => ({
  kind: 'sudo', ...base, request_id: RID, url: `https://host.example.ts.net:8445/r/${RID}`, editable: [], ...extra,
});

// The fake machine double plus a front that answers /v1/sudo/<id>/cancel as the test directs.
async function withContext(work) {
  const context = await setup();
  const cancels = [];
  const front = { answer: () => ({ status: 200, body: { state: 'declined' } }) };
  const server = http.createServer(async (request, response) => {
    if (request.url.startsWith('/v1/sudo/')) {
      cancels.push({ method: request.method, path: request.url, secret: request.headers['x-wheelchair-machine-secret'] });
      const answer = front.answer();
      if (answer === 'hang') return;
      response.writeHead(answer.status, { 'content-type': 'application/json' });
      return response.end(JSON.stringify(answer.body));
    }
    const upstream = http.request({ host: '127.0.0.1', port: context.machine.port, path: request.url, method: request.method, headers: request.headers }, (reply) => {
      response.writeHead(reply.statusCode, reply.headers);
      reply.pipe(response);
    });
    request.pipe(upstream);
  });
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  await fs.writeFile(path.join(context.state, 'machines.json'), JSON.stringify({
    hub: { name: 'hub', address: '127.0.0.1', port, secret: context.machine.secret },
  }));
  context.front = front;
  context.cancels = cancels;
  context.frontPort = port;
  try {
    await work(context);
    // No test password reaches a thread file or anything else on the hub's disk.
    for (const entry of await fs.readdir(context.state, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const text = await fs.readFile(path.join(entry.parentPath || entry.path, entry.name), 'utf8').catch(() => '');
      assert.ok(!text.includes(PASSWORD), `${entry.name} holds the test password`);
    }
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    await close(context);
  }
}

async function post(context, made, value, session) {
  return card(context, made.id, session || made.sessions[0].name, value);
}

async function stored(context, made) {
  return (await api(context, `/threads/${made.id}/chat`)).body.cards.find((item) => item.kind === 'sudo');
}

// Everything the lead was told: delivered to its tmux session or still queued.
async function heard(context, made) {
  const name = made.sessions[0].name;
  const listed = (await api(context, '/threads')).body.threads.find((item) => item.id === made.id);
  const queued = (listed.queues?.[name] || []).map((item) => item.text);
  return [...(context.machine.sessions.get(name)?.submits || []), ...queued].filter((text) => text.startsWith('[card '));
}

async function sudoThread(context, extra = {}) {
  const made = await thread(context);
  const posted = await post(context, made, machineCard(extra));
  assert.equal(posted.status, 202, JSON.stringify(posted.body));
  return { made, id: posted.body.id };
}

const outcome = (context, body) => machinePost(context, '/machine/sudo-outcome', { request_id: RID, delivery_id: `d-${Math.random()}`, ...body });
const press = (context, made, id, body) => api(context, `/threads/${made.id}/cards/${id}/press`, { method: 'POST', body });

test('approval warnings are optional machine-only bounded non-empty strings', () => {
  const approval = { kind: 'approval', objections: [], ready: { ok: true, missing: [] } };
  const machine = { machine: true };
  assert.deepEqual(validate('approval', { ...approval, warnings: ['growth'] }, 'lead'),
    { ok: false, reason: 'unknown field: warnings' });
  assert.equal(validate('approval', approval, 'lead', machine).ok, true);
  for (let n = 1; n <= 10; n += 1) {
    assert.equal(validate('approval', { ...approval, warnings: Array(n).fill('growth') }, 'lead', machine).ok, true);
  }
  for (const warnings of [[], [''], ['  '], Array(11).fill('growth'), 'growth']) {
    assert.equal(validate('approval', { ...approval, warnings }, 'lead', machine).ok, false);
  }
});

test('the hub stores machine approval warnings', async () => {
  const context = await setup();
  try {
    const made = await thread(context);
    const warnings = ['Startup grew'];
    const posted = await post(context, made, { kind: 'approval', objections: [], ready: { ok: true, missing: [] }, warnings });
    assert.equal(posted.status, 202);
    const chat = await api(context, `/threads/${made.id}/chat`);
    assert.deepEqual(chat.body.cards.find((item) => item.kind === 'approval').warnings, warnings);
  } finally { await close(context); }
});

test('sudo validation: the agent sends only command, does and why', () => {
  assert.equal(validate('sudo', { kind: 'sudo', ...base }, 'lead').ok, true);
  for (const extra of [{ request_id: RID }, { url: 'https://x.test/r/1' }, { editable: [] }]) {
    const result = validate('sudo', { ...base, ...extra }, 'lead');
    assert.equal(result.ok, false);
    assert.match(result.reason, /unknown field/);
  }
  assert.equal(validate('sudo', { ...base, command: 'x'.repeat(4097) }, 'lead').ok, false);
  assert.equal(validate('sudo', { ...base, command: 'x'.repeat(4096) }, 'lead').ok, true);
  assert.equal(validate('sudo', { ...base, command: `echo a\0b` }, 'lead').ok, false);
  assert.equal(validate('sudo', { ...base, does: ' ' }, 'lead').ok, false);
  assert.equal(validate('sudo', { command: base.command, does: base.does }, 'lead').ok, false);
  // Four-byte characters count as bytes: 1025 of them are 4100 bytes.
  assert.equal(validate('sudo', { ...base, command: '😀'.repeat(1025) }, 'lead').ok, false);
});

test('sudo validation: agent-side role check refuses everyone but a lead', () => {
  for (const role of ['worker', 'sub-lead', 'mapper']) {
    const result = validate('sudo', base, role);
    assert.equal(result.ok, false);
    assert.match(result.reason, /may not post sudo/);
  }
});

test('sudo validation: a machine-posted card needs the machine-added fields', () => {
  const machine = { machine: true };
  assert.equal(validate('sudo', machineCard(), 'lead', machine).ok, true);
  assert.equal(validate('sudo', { ...base }, 'lead', machine).ok, false);
  assert.equal(validate('sudo', machineCard({ request_id: 'ABC' }), 'lead', machine).ok, false);
  assert.equal(validate('sudo', machineCard({ url: 'http://host/r/1' }), 'lead', machine).ok, false);
  assert.equal(validate('sudo', machineCard({ editable: 'x' }), 'lead', machine).ok, false);
  assert.equal(validate('sudo', machineCard({ editable: ['/home/c/run.sh'] }), 'lead', machine).ok, true);
  assert.equal(validate('sudo', machineCard({ state: 'ran' }), 'lead', machine).ok, false);
});

test('the hub stores a lead sudo card as waiting and indexes its request_id', async () => {
  await withContext(async (context) => {
    const { made, id } = await sudoThread(context, { editable: ['/home/c/run.sh'] });
    const shown = await stored(context, made);
    assert.equal(shown.id, id);
    assert.equal(shown.state, 'waiting');
    assert.equal(shown.command, base.command);
    assert.deepEqual(shown.editable, ['/home/c/run.sh']);
    const full = (await api(context, '/threads')).body.threads.find((item) => item.id === made.id);
    assert.deepEqual(full.sudo_index, { [RID]: id });
    const lean = (await api(context, '/threads?view=list')).body.threads.find((item) => item.id === made.id);
    assert.equal(lean.sudo_index, undefined);
  });
});

test('the hub refuses a sudo card from a non-lead, without machine fields, or for a repeat request', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    value.sessions.push({ name: `wc-${made.id}-worker`, role: 'worker', live: true });
    await fs.writeFile(file, JSON.stringify(value));
    const worker = await post(context, made, machineCard(), `wc-${made.id}-worker`);
    assert.equal(worker.status, 422);
    assert.match(worker.body.detail, /worker may not post sudo/);
    assert.equal((await post(context, made, { kind: 'sudo', ...base })).status, 422);
    assert.equal((await post(context, made, machineCard({ url: 'http://insecure/' }))).status, 422);
    assert.equal(await stored(context, made), undefined);
    assert.equal((await post(context, made, machineCard())).status, 202);
    const again = await post(context, made, machineCard());
    assert.equal(again.status, 422);
    const duplicate = await post(context, made, machineCard({ delivery_id: 'same' }));
    assert.equal(duplicate.status, 422);
    const cards = (await api(context, `/threads/${made.id}/chat`)).body.cards.filter((item) => item.kind === 'sudo');
    assert.equal(cards.length, 1);
  });
});

test('a redelivered sudo card with the same delivery_id answers 200 and makes no second card', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const first = await post(context, made, machineCard({ delivery_id: 'deliver-1' }));
    assert.equal(first.status, 202);
    const second = await post(context, made, machineCard({ delivery_id: 'deliver-1' }));
    assert.equal(second.status, 200);
    const cards = (await api(context, `/threads/${made.id}/chat`)).body.cards.filter((item) => item.kind === 'sudo');
    assert.equal(cards.length, 1);
  });
});

test('sudo-outcome: unknown request is 409, a bad body 400, and the machine secret is required', async () => {
  await withContext(async (context) => {
    await sudoThread(context);
    assert.equal((await outcome(context, { request_id: RID2, state: 'ran', exit_code: 0 })).status, 409);
    assert.equal((await outcome(context, { state: 'bogus' })).status, 400);
    assert.equal((await outcome(context, { state: 'waiting' })).status, 400);
    assert.equal((await outcome(context, { state: 'ran' })).status, 400);
    assert.equal((await outcome(context, { state: 'ran', exit_code: 'zero' })).status, 400);
    assert.equal((await outcome(context, { request_id: 'short', state: 'ran', exit_code: 0 })).status, 400);
    assert.equal((await outcome(context, { delivery_id: '', state: 'ran', exit_code: 0 })).status, 400);
    const noSecret = await api(context, '/machine/sudo-outcome', { method: 'POST', body: { request_id: RID, state: 'ran', exit_code: 0, delivery_id: 'x' }, secret: 'wrong' });
    assert.equal(noSecret.status, 401);
  });
});

test('sudo-outcome ran: sets the result and tells the lead once, with the output', async () => {
  await withContext(async (context) => {
    const { made, id } = await sudoThread(context);
    assert.equal((await outcome(context, { state: 'running' })).status, 200);
    assert.equal((await stored(context, made)).state, 'running');
    assert.deepEqual(await heard(context, made), []);
    const done = await outcome(context, { state: 'ran', exit_code: 3, output: `line1\nline2 ${'x'.repeat(5000)}`, truncated: true });
    assert.equal(done.status, 200);
    const shown = await stored(context, made);
    assert.equal(shown.state, 'ran');
    assert.equal(shown.exit_code, 3);
    assert.equal(shown.truncated, true);
    assert.ok(shown.output.startsWith('line1\nline2 '));
    const messages = await heard(context, made);
    assert.equal(messages.length, 1);
    assert.ok(messages[0].startsWith(`[card ${id}] sudo ran: exit 3\nline1\nline2 `));
    // Repeats, the same delivery again, older states and another terminal state change nothing.
    assert.equal((await machinePost(context, '/machine/sudo-outcome', { request_id: RID, state: 'ran', exit_code: 3, output: 'other', delivery_id: 'dup' })).status, 200);
    assert.equal((await machinePost(context, '/machine/sudo-outcome', { request_id: RID, state: 'ran', exit_code: 3, output: 'other', delivery_id: 'dup' })).status, 200);
    assert.equal((await outcome(context, { state: 'running' })).status, 200);
    assert.equal((await outcome(context, { state: 'expired' })).status, 200);
    assert.equal((await outcome(context, { state: 'declined' })).status, 200);
    const after = await stored(context, made);
    assert.equal(after.state, 'ran');
    assert.ok(after.output.startsWith('line1'));
    assert.equal((await heard(context, made)).length, 1);
  });
});

test('sudo-outcome: each terminal state reaches the lead with its exact text', async () => {
  const cases = [
    [{ state: 'declined' }, 'declined'],
    [{ state: 'expired' }, 'sudo expired'],
    [{ state: 'failed', reason: 'wrong password 3 times' }, 'sudo failed: wrong password 3 times'],
  ];
  for (const [body, text] of cases) {
    await withContext(async (context) => {
      const { made, id } = await sudoThread(context);
      assert.equal((await outcome(context, body)).status, 200);
      assert.deepEqual(await heard(context, made), [`[card ${id}] ${text}`]);
      const shown = await stored(context, made);
      assert.equal(shown.state, body.state);
      assert.equal(shown.reason, body.reason);
    });
  }
});

test('sudo-outcome waiting is ignored and a card never moves back', async () => {
  await withContext(async (context) => {
    const { made } = await sudoThread(context);
    assert.equal((await outcome(context, { state: 'running' })).status, 200);
    assert.equal((await outcome(context, { state: 'running' })).status, 200);
    const result = await machinePost(context, '/machine/sudo-outcome', { request_id: RID, state: 'waiting', delivery_id: 'w' });
    assert.equal(result.status, 400);
    assert.equal((await stored(context, made)).state, 'running');
  });
});

test('Talk about it tells the lead and leaves the card waiting and unanswered', async () => {
  await withContext(async (context) => {
    const { made, id } = await sudoThread(context);
    const talked = await press(context, made, id, { action: 'talk', value: 'sudo request' });
    assert.equal(talked.status, 202);
    assert.deepEqual(await heard(context, made), [`[card ${id}] talk about: sudo request`]);
    const shown = await stored(context, made);
    assert.equal(shown.state, 'waiting');
    assert.equal(shown.answered, false);
    // It can be pressed again, and Decline still works afterwards.
    assert.equal((await press(context, made, id, { action: 'talk', value: 'sudo request' })).status, 202);
    assert.equal((await press(context, made, id, { action: 'decline' })).status, 202);
  });
});

test('Decline: the machine answers declined, the card closes and the lead hears it once', async () => {
  await withContext(async (context) => {
    const { made, id } = await sudoThread(context);
    const declined = await press(context, made, id, { action: 'decline' });
    assert.equal(declined.status, 202);
    assert.equal((await stored(context, made)).state, 'declined');
    assert.deepEqual(await heard(context, made), [`[card ${id}] declined`]);
    assert.deepEqual(context.cancels.map((item) => [item.method, item.path]), [['POST', `/v1/sudo/${RID}/cancel`]]);
    assert.equal(context.cancels[0].secret, context.machine.secret);
    // The machine's later outcome post for the same request is a no-op.
    assert.equal((await outcome(context, { state: 'declined' })).status, 200);
    assert.equal((await heard(context, made)).length, 1);
    // A second Decline on a closed card is refused.
    assert.equal((await press(context, made, id, { action: 'decline' })).status, 409);
  });
});

test('Decline that lost the race shows the run result, not declined', async () => {
  await withContext(async (context) => {
    const { made, id } = await sudoThread(context);
    context.front.answer = () => ({ status: 200, body: { state: 'ran', exit_code: 0, output: 'restarted\n' } });
    assert.equal((await press(context, made, id, { action: 'decline' })).status, 202);
    const shown = await stored(context, made);
    assert.equal(shown.state, 'ran');
    assert.equal(shown.output, 'restarted\n');
    assert.deepEqual(await heard(context, made), [`[card ${id}] sudo ran: exit 0\nrestarted\n`]);
    assert.equal((await outcome(context, { state: 'ran', exit_code: 0, output: 'restarted\n' })).status, 200);
    assert.equal((await heard(context, made)).length, 1);
  });
});

test('Decline answered with running keeps the card running and tells nobody yet', async () => {
  await withContext(async (context) => {
    const { made, id } = await sudoThread(context);
    context.front.answer = () => ({ status: 200, body: { state: 'running' } });
    assert.equal((await press(context, made, id, { action: 'decline' })).status, 202);
    assert.equal((await stored(context, made)).state, 'running');
    assert.deepEqual(await heard(context, made), []);
    assert.equal((await outcome(context, { state: 'ran', exit_code: 0, output: 'ok' })).status, 200);
    assert.equal((await heard(context, made)).length, 1);
  });
});

test('Decline with an unreachable or refusing machine saves nothing and says so', async () => {
  const failures = [
    () => ({ status: 503, body: { error: 'sudo helper not installed' } }),
    () => ({ status: 200, body: { raw: 'not json' } }),
    () => ({ status: 200, body: { state: 'waiting' } }),
  ];
  for (const answer of failures) {
    await withContext(async (context) => {
      const { made, id } = await sudoThread(context);
      context.front.answer = answer;
      const result = await press(context, made, id, { action: 'decline' });
      assert.equal(result.status, 502);
      assert.equal(result.body.detail, "Couldn't reach hub to decline. Try again.");
      const shown = await stored(context, made);
      assert.equal(shown.state, 'waiting');
      assert.equal(shown.answered, false);
      assert.deepEqual(await heard(context, made), []);
      // The buttons still work: a retry that gets through declines it.
      context.front.answer = () => ({ status: 200, body: { state: 'declined' } });
      assert.equal((await press(context, made, id, { action: 'decline' })).status, 202);
      assert.equal((await stored(context, made)).state, 'declined');
    });
  }
});

test('Decline with a machine that never answers gives up after the limit and saves nothing', async () => {
  await withContext(async (context) => {
    const { made, id } = await sudoThread(context);
    context.front.answer = () => 'hang';
    const hub = new Hub({ stateDir: context.state });
    hub.client.sudoCancelTimeout = 150;
    const started = Date.now();
    await assert.rejects(hub.press(made.id, id, { action: 'decline' }), (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.message, "Couldn't reach hub to decline. Try again.");
      return true;
    });
    assert.ok(Date.now() - started < 3000);
    assert.equal((await stored(context, made)).state, 'waiting');
    assert.deepEqual(await heard(context, made), []);
  });
});

test('a press on a sudo card other than talk or decline is refused', async () => {
  await withContext(async (context) => {
    const { made, id } = await sudoThread(context);
    assert.equal((await press(context, made, id, { action: 'keep-going' })).status, 400);
    assert.equal((await press(context, made, id, { action: 'picked', value: 'x' })).status, 400);
    assert.equal((await stored(context, made)).state, 'waiting');
  });
});

test('the chat bubble for a sudo result keeps only its first line', () => {
  const { cardBubble } = require('../app/chat.js');
  assert.equal(cardBubble('[card c1] sudo ran: exit 0\nlots\nof output'), 'sudo ran: exit 0');
  assert.equal(cardBubble('[card c1] declined'), 'declined');
});

test('retracting a waiting sudo cancels without deadlock or a lead message', async () => {
  await withContext(async (context) => {
    const { made, id } = await sudoThread(context);
    const result = await Promise.race([post(context, made, { kind: 'retract', card: id, note: 'No longer needed' }), new Promise((_, reject) => setTimeout(() => reject(new Error('retraction timed out')), 3000))]);
    assert.equal(result.status, 202); assert.equal(context.cancels.length, 1);
    const closed = await stored(context, made); assert.equal(closed.state, 'declined'); assert.equal(closed.answered, true); assert.equal(closed.retracted_by, made.sessions[0].name); assert.equal(closed.retracted_note, 'No longer needed'); assert.ok(closed.retracted_at);
    for (const action of ['decline', 'talk']) { const response = await press(context, made, id, { action }); assert.equal(response.status, 422); assert.equal(response.body.detail, 'this card was withdrawn'); }
    assert.equal((await outcome(context, { state: 'declined' })).body.changed, false); assert.deepEqual(await heard(context, made), []);
    assert.equal((await post(context, made, { kind: 'retract', card: id, note: 'Again' })).body.detail, 'the sudo request is already declined');
  });
});

test('sudo retraction refusal preserves the card and later outcomes are delivered', async () => {
  for (const status of [{ state: 'running' }, { state: 'ran', exit_code: 0, output: 'done' }, null, { state: 'bogus' }]) {
    await withContext(async (context) => {
      const { made, id } = await sudoThread(context);
      context.front.answer = () => status ? { status: 200, body: status } : { status: 503, body: {} };
      const result = await post(context, made, { kind: 'retract', card: id, note: 'No longer needed' });
      assert.equal(result.status, 422); assert.match(result.body.detail, status && status.state !== 'bogus' ? new RegExp(`already ${status.state}`) : /couldn't reach/);
      const before = await stored(context, made); assert.equal(before.state, 'waiting'); assert.equal(before.answered, false); assert.equal(before.retracted_at, undefined);
      if (status && ['running', 'ran'].includes(status.state)) {
        await outcome(context, status); assert.equal((await stored(context, made)).state, status.state);
        if (status.state === 'ran') assert.match((await heard(context, made))[0], /sudo ran: exit 0/);
      }
    });
  }
});
