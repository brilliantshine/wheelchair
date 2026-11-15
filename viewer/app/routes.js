'use strict';

// Spec "Security" and "Views": browser and machine callback HTTP routes.
const { appError } = require('./state.js');
const { publicSession } = require('./sessions.js');
const { findSlug } = require('./views.js');

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw appError(400, 'body is not JSON');
  }
}

function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function handle(hub, request, response, url, machineAuthenticated) {
  const suffix = url.pathname.slice('/wheelchair/api/'.length);
  const bits = suffix.split('/').filter(Boolean);
  const write = ['POST', 'PUT', 'DELETE'].includes(request.method);
  const body = write ? await readBody(request) : {};
  if (bits[0] === 'machine') {
    return handleMachine(hub, request, response, bits, body, machineAuthenticated);
  }
  if (bits[0] === 'threads') return handleThreads(hub, request, response, url, bits, body);
  if (bits[0] === 'features' && request.method === 'GET') {
    return send(response, 200, await hub.features());
  }
  if (bits[0] === 'projects' && request.method === 'GET') {
    return send(response, 200, { projects: await hub.projects() });
  }
  if (bits[0] === 'sessions') return handleSessions(hub, request, response, bits, body);
  throw appError(404, 'route not found');
}

async function handleMachine(hub, request, response, bits, body, authenticated) {
  if (!authenticated) throw appError(401, 'machine secret required');
  if (bits[1] === 'cards' && request.method === 'POST') {
    const result = await hub.acceptCard(body);
    return send(response, result.duplicate ? 200 : 202, result);
  }
  if (bits[1] === 'events' && request.method === 'POST') {
    const result = await hub.event(body);
    return send(response, result.duplicate ? 200 : 202, result);
  }
  if (bits[1] === 'session' && request.method === 'POST') {
    return send(response, 200, await hub.sessionRequest(body));
  }
  throw appError(404, 'route not found');
}

async function handleThreads(hub, request, response, url, bits, body) {
  if (bits.length === 1 && request.method === 'GET') {
    const all = await hub.allThreads();
    await Promise.all(all.map((thread) => hub.withThread(thread.id, async () => {
      const current = await hub.thread(thread.id);
      await findSlug(hub, current);
      Object.assign(thread, current);
    })));
    const threads = all.map((thread) => ({
      ...thread,
      sessions: thread.sessions.map(publicSession),
    }));
    return send(response, 200, { threads });
  }
  if (bits.length === 1 && request.method === 'POST') {
    const thread = await hub.createThread(body);
    return send(response, 201, { ...thread, sessions: thread.sessions.map(publicSession) });
  }
  if (!bits[1]) throw appError(404, 'route not found');
  const id = bits[1];
  if (request.method === 'GET' && bits[2] === 'chat') {
    return send(response, 200, await hub.chat(id));
  }
  if (request.method === 'GET' && bits[2] === 'doc') {
    const content = await hub.archivedDocument(id, url.searchParams.get('file'));
    return send(response, 200, { content });
  }
  if (request.method === 'GET' && bits[2] === 'graph') {
    return send(response, 200, await require('./threads.js').archivedGraph(hub, id, url.searchParams.get('file')));
  }
  if (request.method === 'POST' && bits[2] === 'messages') {
    await hub.withThread(id, async () => {
      const thread = await hub.thread(id);
      const lead = [...thread.sessions].reverse().find((item) => item.role === 'lead' && item.live);
      if (!lead) throw appError(409, 'no live lead');
      await hub.enqueue(thread, lead.name, String(body.text || ''), 'collin');
    });
    return send(response, 202, { queued: true });
  }
  if (request.method === 'POST' && bits[2] === 'cards' && bits[3] && bits[4] === 'press') {
    return send(response, 202, await hub.press(id, bits[3], body));
  }
  if (request.method === 'POST' && bits[2] === 'cards' && bits[3] && bits[4] === 'dismiss') {
    return send(response, 200, await hub.dismiss(id, bits[3]));
  }
  if (request.method === 'POST' && bits[2] === 'open') {
    return send(response, 200, await hub.openStub(id, body));
  }
  if (request.method === 'POST' && bits[2] === 'restart') {
    return send(response, 201, await hub.restartLead(id));
  }
  if (request.method === 'POST' && bits[2] === 'archive') {
    return send(response, 200, await hub.archive(id));
  }
  throw appError(404, 'route not found');
}

async function handleSessions(hub, request, response, bits, body) {
  if (bits.length === 1 && request.method === 'GET') {
    return send(response, 200, await hub.sessions());
  }
  if (!bits[1]) throw appError(404, 'route not found');
  const encoded = encodeURIComponent(bits[1]);
  if (bits[2] === 'pane' && request.method === 'GET') {
    const machine = await hub.findSessionMachine(bits[1]);
    if (!machine) throw appError(404, 'session not found');
    return send(response, 200, await hub.call(machine, `/v1/sessions/${encoded}/pane`, 'GET'));
  }
  if (bits[2] === 'keys' && request.method === 'POST') {
    if (!bits[1].startsWith('wc-')) throw appError(403, 'session is read-only');
    let thread;
    try {
      thread = await hub.threadBySession(bits[1]);
    } catch (error) {
      if (error.status === 404) throw appError(403, 'session is read-only');
      throw error;
    }
    const result = await hub.withThread(thread.id, async () => {
      const current = await hub.thread(thread.id);
      const sent = await hub.call(
        current.machine,
        `/v1/sessions/${encoded}/keys`,
        'POST',
        { keys: String(body.keys || '') },
      );
      if (String(body.keys || '') === 'Enter' || String(body.keys || '') === 'C-m') {
        const target = hub.session(current, bits[1]);
        target.turn_ended = false;
        await hub.save(current);
      }
      return sent;
    });
    return send(response, 200, result);
  }
  throw appError(404, 'route not found');
}

module.exports = { handle, readBody, send };
