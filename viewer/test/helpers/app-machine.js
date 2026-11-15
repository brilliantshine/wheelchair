'use strict';

// Small machine-service double; archive response matches the T2b service contract.
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { freePort } = require('./server.js');

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function send(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

// Another tmux session on the machine, which the real service lists as unmanaged.
const UNMANAGED = { name: 'other-shell', managed: false };

async function startMachine(secret = 'machine-test-secret') {
  const port = await freePort();
  const sessions = new Map();
  const calls = [];
  const status = {
    // The hub's own commit: this repo, the same checkout the test server runs from.
    version: execFileSync('git', ['-C', __dirname, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    claude: { installed: true, logged_in: true },
    codex: { installed: true, logged_in: true },
    accounts: [{ id: 'default-claude', cli: 'claude', logged_in: true }, { id: 'default-gpt', cli: 'codex', logged_in: true }],
  };
  let preflightOk = true;
  let startOk = true;
  let submitOk = true;
  let archiveKept = [];
  let sessionsAvailable = true;
  let preview = { ok: true, text: 'Previewed message.' };
  const server = http.createServer(async (request, response) => {
    if (request.headers['x-wheelchair-machine-secret'] !== secret) {
      return send(response, 401, { error: 'machine secret required' });
    }
    const url = new URL(request.url, 'http://machine.test');
    const write = ['POST', 'PUT'].includes(request.method);
    const input = write ? await readBody(request) : {};
    calls.push({ method: request.method, path: url.pathname, body: input });
    if (request.method === 'POST' && url.pathname === '/v1/sessions') {
      return startOk ? startSession(response, sessions, input) : send(response, 503, { error: 'start refused' });
    }
    if (request.method === 'POST' && url.pathname === '/v1/preview') {
      return send(response, preview.ok ? 200 : 503, preview.ok ? { text: preview.text } : { error: preview.error || 'preview unavailable' });
    }
    if (request.method === 'GET' && url.pathname === '/v1/sessions') {
      if (!sessionsAvailable) return send(response, 503, { error: 'machine unavailable' });
      return send(response, 200, [...sessions.values(), UNMANAGED]);
    }
    if (request.method === 'POST' && /\/submit$/.test(url.pathname)) {
      return submit(response, sessions, url, input, submitOk);
    }
    if (request.method === 'POST' && /\/keys$/.test(url.pathname)) {
      return send(response, 200, { ok: true });
    }
    if (request.method === 'GET' && /\/transcript$/.test(url.pathname)) {
      const found = sessions.get(decodeURIComponent(url.pathname.split('/')[3]));
      if (!found) return send(response, 404, { error: 'unknown session' });
      const data = found.transcript || '';
      return send(response, 200, { offset: Buffer.byteLength(data), data });
    }
    if (request.method === 'GET' && /\/pane$/.test(url.pathname)) {
      return send(response, 200, { pane: 'fake pane' });
    }
    if (request.method === 'DELETE' && url.pathname.startsWith('/v1/sessions/')) {
      return stopSession(response, sessions, url);
    }
    if (request.method === 'POST' && url.pathname === '/v1/archive') {
      return archive(response, sessions, input.thread_id, archiveKept);
    }
    if (request.method === 'GET' && url.pathname === '/v1/status') {
      return send(response, 200, { ...status, accounts: status.accounts.map((a) => a.id.startsWith('default-') ? { ...a, logged_in: status[a.cli].logged_in } : a), sessions: [...sessions.values(), UNMANAGED] });
    }
    if (request.method === 'POST' && url.pathname === '/v1/preflight') {
      return send(response, preflightOk ? 200 : 409, { ok: preflightOk });
    }
    return send(response, 404, { error: 'not found' });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    port,
    secret,
    sessions,
    calls,
    status,
    get startOk() { return startOk; },
    set startOk(value) { startOk = Boolean(value); },
    get preflightOk() { return preflightOk; },
    set preflightOk(value) { preflightOk = Boolean(value); },
    get submitOk() { return submitOk; },
    set submitOk(value) { submitOk = Boolean(value); },
    get archiveKept() { return archiveKept; },
    set archiveKept(value) { archiveKept = Array.isArray(value) ? value : []; },
    get sessionsAvailable() { return sessionsAvailable; },
    set sessionsAvailable(value) { sessionsAvailable = Boolean(value); },
    get preview() { return preview; },
    set preview(value) { preview = { ...preview, ...value }; },
    async stop() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function startSession(response, sessions, input) {
  const session = {
    ...input,
    status: 'ready',
    running: true,
    worktree: input.worktree || `/tmp/${input.name}`,
    default_branch: input.default_branch || 'main',
  };
  sessions.set(input.name, session);
  return send(response, 201, session);
}

function submit(response, sessions, url, input, submitOk) {
  if (!submitOk) return send(response, 503, { error: 'temporarily unavailable' });
  const name = decodeURIComponent(url.pathname.split('/')[3]);
  const session = sessions.get(name);
  session.submits ||= [];
  session.submits.push(input.text);
  return send(response, 200, { ok: true });
}

function stopSession(response, sessions, url) {
  const name = decodeURIComponent(url.pathname.split('/')[3]);
  const session = sessions.get(name);
  if (session) {
    session.running = false;
    session.status = 'stopped';
  }
  return send(response, 200, { ok: true });
}

function archive(response, sessions, threadId, kept) {
  const stopped = [...sessions.values()]
    .filter((session) => session.thread_id === threadId)
    .map((session) => {
      session.running = false;
      session.status = 'stopped';
      return session.name;
    });
  return send(response, 200, {
    stopped,
    committed: [],
    removed: stopped.map((name) => `/tmp/${name}`),
    kept,
  });
}

module.exports = { startMachine };
