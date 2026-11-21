'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');

test('card CLI prints only a receipt for delivered and spooled cards and instructions', async () => {
  let responseBody; let status;
  const server = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(responseBody)); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const dir = await makeTemp('card-receipt-');
    const cases = [
      [{ kind: 'message', to: 'lead', text: 'secret text' }, 200, { id: 'delivered', text: 'secret text' }, { id: 'delivered', kind: 'message' }],
      [{ kind: 'message', to: 'lead', text: 'secret text' }, 202, { ok: true, spooled: true, id: 'queued' }, { id: 'queued', kind: 'message', queued: true }],
      [{ kind: 'message', to: 'lead', text: 'secret text' }, 202, { id: 'delivered-202', kind: 'message', text: 'secret text', answered: false }, { id: 'delivered-202', kind: 'message' }],
      [{ kind: 'message', to: 'lead', text: 'secret text' }, 202, { ok: true, duplicate: true, id: 'duplicate' }, { id: 'duplicate', kind: 'message' }],
      [{ kind: 'lesson', action: 'add', for: 'lead', text: 'secret lesson', why: 'secret why' }, 200, { id: 'saved', kind: 'lesson', lesson: 'L2094a1', text: 'secret lesson' }, { id: 'saved', kind: 'lesson', lesson: 'L2094a1' }],
      [{ kind: 'lesson', action: 'add', for: 'lead', text: 'secret lesson', why: 'secret why' }, 200, { ok: true, lesson: 'L2094a1' }, { kind: 'lesson', lesson: 'L2094a1' }],
      ...['title', 'resolve', 'retract'].flatMap(kind => [false, true].map(queued => [kind === 'title' ? { kind, title: 'secret title' } : { kind, card: 'target', note: 'secret note' }, queued ? 202 : 200, queued ? { ok: true, spooled: true, id: 'queued' } : { ok: true, title: 'secret title' }, queued ? { ok: true, queued: true } : { ok: true }])),
    ];
    for (const [card, code, body, expected] of cases) {
      status = code; responseBody = body;
      const file = path.join(dir, 'card.json'); await fs.writeFile(file, JSON.stringify(card));
      const child = spawn(process.execPath, [path.join(__dirname, '../app/card.js'), card.kind, file], { env: { ...process.env, WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}/cards`, WHEELCHAIR_SESSION_TOKEN: 'test' } });
      let stdout = ''; let stderr = ''; child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
      const exit = await new Promise(resolve => child.on('close', resolve));
      assert.equal(exit, 0, stderr); assert.equal(stdout, `${JSON.stringify(expected)}\n`);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
