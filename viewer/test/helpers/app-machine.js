'use strict';

// Small machine-service double; archive response matches the T2b service contract.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
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

async function startMachine(secret = 'machine-test-secret', options = {}) {
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
  const handoffReplies = {};
  const planReplies = {};
  let keptUploads;
  const projectToolsReplies = {};
  let usageReply = { status: 200, delay: 0, reading: null };
  let uploadsDir = options.uploadsDir;
  let preflightOk = true;
  let startOk = true;
  // Start the next sessions but hang up before answering, as a start slower than the hub waits.
  // A number drops that many starts in a row; true drops one.
  let dropNextStart = 0;
  let submitOk = true;
  let archiveKept = [];
  let uploadsRemoved = true;
  let resetUpload = false;
  const uploads = new Map();
  let sessionsAvailable = true;
  let projects = { found: [], folder_error: undefined, bad: {} };
  let projectsAvailable = true;
  let preview = { ok: true, text: 'Previewed message.' };
  const server = http.createServer(async (request, response) => {
    if (request.headers['x-wheelchair-machine-secret'] !== secret) {
      return send(response, 401, { error: 'machine secret required' });
    }
    const url = new URL(request.url, 'http://machine.test');
    if (request.method === 'POST' && url.pathname === '/v1/uploads') {
      if (resetUpload) {
        request.once('data', () => request.destroy());
        return;
      }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const id = url.searchParams.get('thread_id');
      const n = uploadsDir ? [...uploads.keys()].filter((key) => key.startsWith(id + '/')).length + 1 : 1;
      const name = `${n}-${url.searchParams.get('name')}`;
      const bytes = Buffer.concat(chunks);
      uploads.set(`${id}/${name}`, bytes);
      if (uploadsDir) { fs.mkdirSync(path.join(uploadsDir, id), { recursive: true }); fs.writeFileSync(path.join(uploadsDir, id, name), bytes); }
      calls.push({ method: request.method, path: url.pathname, body: Buffer.concat(chunks) });
      return send(response, 201, { path: uploadsDir ? path.join(uploadsDir, id, name) : `/fake/uploads/${id}/${name}` });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/v1/uploads/')) {
      const key = url.pathname.slice('/v1/uploads/'.length);
      const diskPath = uploadsDir && path.join(uploadsDir, key);
      const data = diskPath && fs.existsSync(diskPath) ? fs.readFileSync(diskPath) : uploads.get(key);
      if (!data) return send(response, 404, { error: 'not found' });
      response.writeHead(200, { 'content-type': 'image/png', 'x-content-type-options': 'nosniff' });
      return response.end(data);
    }
    const write = ['POST', 'PUT'].includes(request.method);
    const input = write ? await readBody(request) : {};
    calls.push({ method: request.method, path: url.pathname, body: input });
    if (request.method === 'POST' && /^\/v1\/project-tools\/(read|save|remove-key)$/.test(url.pathname)) {
      const reply = projectToolsReplies[url.pathname.split('/').pop()] || { status: 200, body: {} };
      if (reply.delay) await new Promise((resolve) => setTimeout(resolve, reply.delay));
      if (reply.raw !== undefined) { response.writeHead(reply.status || 200); return response.end(reply.raw); }
      return send(response, reply.status || 200, reply.body);
    }
    if (request.method === 'POST' && url.pathname === '/v1/plan-files') {
      let reply = planReplies[input.action] || { status: 404, body: { error: 'not found' } };
      if (typeof reply === 'function') reply = await reply(input);
      return send(response, typeof reply.status === 'number' ? reply.status : 200, reply.body === undefined ? reply : reply.body);
    }
    if (request.method === 'POST' && url.pathname === '/v1/handoff') {
      let reply = handoffReplies[input.action];
      if (Array.isArray(reply)) reply = reply.shift();
      if (typeof reply === 'function') reply = await reply(input);
      reply ||= { result: 'failed', error: 'handoff action not scripted' };
      return send(response, reply.status || 200, reply.body === undefined ? reply : reply.body);
    }
    if (request.method === 'POST' && url.pathname === '/v1/usage') {
      const reply = typeof usageReply === 'function' ? await usageReply(input) : usageReply;
      if (reply.delay) await new Promise((resolve) => setTimeout(resolve, reply.delay));
      return send(response, reply.status || 200, reply.status && reply.status !== 200 ? { error: reply.error || 'usage failed' } : { reading: reply.reading || { account: input.account, five_hour: null, week: null } });
    }
    if (request.method === 'POST' && url.pathname === '/v1/project-lead/refresh') {
      return send(response, 200, { ok: true, commit: 'a'.repeat(40) });
    }
    if (request.method === 'POST' && url.pathname === '/v1/sessions') {
      if (!startOk) return send(response, 503, { error: 'start refused' });
      if (dropNextStart > 0) {
        dropNextStart -= 1;
        startSession(null, sessions, input);
        return response.socket.destroy();
      }
      return startSession(response, sessions, input);
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
      return archive(response, sessions, input.thread_id, archiveKept, uploadsRemoved, keptUploads);
    }
    if (request.method === 'GET' && url.pathname === '/v1/projects') {
      if (!projectsAvailable) return send(response, 404, { error: 'not found' });
      return projectsReply(response, url, projects);
    }
    if (request.method === 'GET' && url.pathname === '/v1/status') {
      return send(response, 200, { ...status, accounts: status.accounts.map((a) => a.id.startsWith('default-') ? { ...a, logged_in: status[a.cli].logged_in } : a), sessions: [...sessions.values(), UNMANAGED] });
    }
    if (request.method === 'POST' && url.pathname === '/v1/preflight') {
      const ok = typeof preflightOk === 'function' ? preflightOk(input) : preflightOk;
      return send(response, ok ? 200 : 409, { ok });
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
    get usageReply() { return usageReply; },
    set usageReply(value) { usageReply = value; },
    get uploadsDir() { return uploadsDir; },
    set uploadsDir(value) { uploadsDir = value; },
    sessions,
    calls,
    handoffReplies,
    planReplies,
    get keptUploads() { return keptUploads; },
    set keptUploads(value) { keptUploads = value; },
    projectToolsReplies,
    status,
    get dropNextStart() { return dropNextStart; },
    set dropNextStart(value) { dropNextStart = value === true ? 1 : Number(value) || 0; },
    get startOk() { return startOk; },
    set startOk(value) { startOk = Boolean(value); },
    get preflightOk() { return preflightOk; },
    set preflightOk(value) { preflightOk = typeof value === 'function' ? value : Boolean(value); },
    get submitOk() { return submitOk; },
    set submitOk(value) { submitOk = Boolean(value); },
    get uploadsRemoved() { return uploadsRemoved; },
    set uploadsRemoved(value) { uploadsRemoved = value; },
    get resetUpload() { return resetUpload; },
    set resetUpload(value) { resetUpload = Boolean(value); },
    get archiveKept() { return archiveKept; },
    set archiveKept(value) { archiveKept = Array.isArray(value) ? value : []; },
    get sessionsAvailable() { return sessionsAvailable; },
    set sessionsAvailable(value) { sessionsAvailable = Boolean(value); },
    get projects() { return projects; },
    set projects(value) { projects = { ...projects, ...value }; },
    get projectsAvailable() { return projectsAvailable; },
    set projectsAvailable(value) { projectsAvailable = Boolean(value); },
    get preview() { return preview; },
    set preview(value) { preview = { ...preview, ...value }; },
    async stop() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

// Stands in for GET /v1/projects: `found` and `folder_error` answer a folder; a path in `bad`
// fails a check with its reason; `~` and `~/x` expand to /home/fake.
function projectsReply(response, url, projects) {
  const reply = {};
  if (url.searchParams.has('folder')) {
    reply.found = projects.found;
    if (projects.folder_error) reply.folder_error = projects.folder_error;
  }
  if (url.searchParams.has('check')) {
    let target = url.searchParams.get('check');
    if (target === '~' || target.startsWith('~/')) target = `/home/fake${target.slice(1)}`;
    if (!target.startsWith('/')) reply.checked = { path: target, ok: false, reason: 'must be an absolute path' };
    else if (Object.hasOwn(projects.bad, target)) reply.checked = { path: target, ok: false, reason: projects.bad[target] };
    else reply.checked = { path: target, ok: true };
  }
  return send(response, 200, reply);
}

// Like the real service, a start of a name it already runs answers with that session.
function startSession(response, sessions, input) {
  if (sessions.has(input.name)) return response && send(response, 201, sessions.get(input.name));
  const session = {
    ...input,
    status: 'ready',
    running: true,
    worktree: input.worktree || `/tmp/${input.name}`,
    default_branch: input.default_branch || 'main',
  };
  sessions.set(input.name, session);
  if (response) send(response, 201, session);
}

function submit(response, sessions, url, input, submitOk) {
  const name = decodeURIComponent(url.pathname.split('/')[3]);
  const session = sessions.get(name);
  if (!submitOk || session.submitFail) return send(response, 503, { error: 'temporarily unavailable' });
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

function archive(response, sessions, threadId, kept, uploadsRemoved, keptUploads) {
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
    uploads_removed: uploadsRemoved,
    ...(keptUploads === undefined ? {} : { kept_uploads: keptUploads }),
    ...(uploadsRemoved === false ? { uploads_error: 'permission denied' } : {}),
  });
}

module.exports = { startMachine };
