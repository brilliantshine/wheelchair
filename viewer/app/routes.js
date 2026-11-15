'use strict';

const crypto = require('node:crypto');
// Spec "Security" and "Views": browser and machine callback HTTP routes.
const { appError } = require('./state.js');
const { publicSession } = require('./sessions.js');
const { findSlug } = require('./views.js');
const settings = require('./settings.js');

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
  if (bits[0] === 'settings') return handleSettings(hub, request, response, url, bits, body);
  if (bits[0] === 'sessions') return handleSessions(hub, request, response, bits, body);
  throw appError(404, 'route not found');
}

async function handleSettings(hub, request, response, url, bits, body) {
  if (bits.length === 1 && request.method === 'GET') return send(response, 200, await settings.describe(hub));
  if (bits[1] === 'models' && request.method === 'PUT') {
    if (!['claude', 'gpt'].includes(body.provider)) throw appError(400, 'provider must be claude or gpt');
    let slot = settings.TIER_ALIASES[body.slot] || body.slot;
    if (body.provider === 'claude') slot = ({ haiku: 'light', sonnet: 'standard', opus: 'heavy' })[slot] || slot;
    if (!['light', 'standard', 'heavy', 'critical', 'lead'].includes(slot)) throw appError(400, 'slot is invalid');
    if (body.model !== null && (typeof body.model !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(body.model))) throw appError(400, 'model is invalid');
    if (body.provider === 'gpt' && body.effort !== undefined) throw appError(400, 'GPT models do not take effort');
    if (body.effort !== undefined && !['low', 'medium', 'high', 'xhigh', 'max'].includes(body.effort)) throw appError(400, 'effort is invalid');
    try { await settings.modelCommand(hub, ['set', body.provider, slot, body.model || 'none', ...(body.effort ? [body.effort] : [])]); }
    catch (error) { throw appError(400, (error.stderr || error.message).trim()); }
    return send(response, 200, { models: await settings.models(hub) });
  }
  if (bits[1] === 'models' && bits[2] === 'heads-up' && request.method === 'POST') {
    let args;
    if (body.action === 'switch') {
      const tier = settings.TIER_ALIASES[body.tier] || body.tier;
      if (!['light', 'standard', 'heavy', 'critical'].includes(tier) || typeof body.model !== 'string') throw appError(400, 'tier and model are required to switch');
      args = ['set', 'gpt', tier, body.model];
    } else if (body.action === 'skip') {
      if (typeof body.model !== 'string') throw appError(400, 'model is required to skip');
      args = ['skip', body.model];
    } else if (body.action === 'reset') args = ['reset'];
    else throw appError(400, 'unknown heads-up action');
    try { await settings.modelCommand(hub, args); }
    catch (error) { throw appError(400, (error.stderr || error.message).trim()); }
    return send(response, 200, { models: await settings.models(hub), heads_up: await settings.headsUp(hub) });
  }
  if (bits[1] === 'preferences' && request.method === 'PUT') {
    const value = await settings.update(hub, (value) => {
      if (body.permission_mode !== undefined) {
        if (!['auto', 'bypass'].includes(body.permission_mode)) throw appError(400, 'permission_mode must be auto or bypass');
        value.permission_mode = body.permission_mode;
      }
      if (body.codex_mode !== undefined) {
        if (!['sandboxed', 'unrestricted'].includes(body.codex_mode)) throw appError(400, 'codex_mode must be sandboxed or unrestricted');
        value.codex_mode = body.codex_mode;
      }
      if (body.other_agents !== undefined) {
        if (!body.other_agents || typeof body.other_agents !== 'object' || Array.isArray(body.other_agents)) throw appError(400, 'other_agents must be an object');
        for (const role of ['reviewer', 'verifier', 'mapper']) if (body.other_agents[role] !== undefined) value.other_agents[role] = settings.tier(body.other_agents[role], `other_agents.${role}`);
      }
    });
    return send(response, 200, { permission_mode: value.permission_mode, codex_mode: value.codex_mode, other_agents: value.other_agents });
  }
  if (bits[1] === 'templates' && bits.length === 2 && request.method === 'POST') {
    let template;
    const projects = await hub.projects();
    await settings.update(hub, (value) => {
      const validated = settings.validateTemplate(body);
      if (validated.scope !== 'all' && !projects.includes(validated.scope)) throw appError(400, 'template.scope must be all or a listed project');
      template = { ...validated, id: crypto.randomUUID(), in_use: false };
      value.templates.push(template);
    });
    return send(response, 201, template);
  }
  if (bits[1] === 'templates' && bits[2]) {
    if (request.method === 'DELETE') {
      await settings.update(hub, (value) => {
        const index = value.templates.findIndex((template) => template.id === bits[2]);
        if (index < 0) throw appError(404, 'template not found');
        value.templates.splice(index, 1);
      });
      return send(response, 200, { ok: true });
    }
    if (request.method === 'PUT') {
      let updated;
      const projects = await hub.projects();
      await settings.update(hub, (value) => {
        const index = value.templates.findIndex((template) => template.id === bits[2]);
        if (index < 0) throw appError(404, 'template not found');
        const previous = value.templates[index];
        updated = { ...settings.validateTemplate({ ...previous, ...body }, { updating: true }), id: previous.id, in_use: body.in_use === undefined ? previous.in_use : body.in_use };
        if (updated.scope !== previous.scope && updated.scope !== 'all' && !projects.includes(updated.scope)) throw appError(400, 'template.scope must be all or a listed project');
        if (updated.in_use) for (const template of value.templates) if (template.id !== updated.id && template.role === updated.role && template.scope === updated.scope) template.in_use = false;
        value.templates[index] = updated;
      });
      return send(response, 200, updated);
    }
  }
  if (bits[1] === 'style' && bits.length === 2 && request.method === 'PUT') {
    const value = await settings.update(hub, (value) => {
      value.style = settings.validateStyle(body);
      value.style_version += 1;
    });
    return send(response, 200, { style: value.style, style_version: value.style_version });
  }
  if (bits[1] === 'style' && bits[2] === 'preview' && request.method === 'POST') return send(response, 200, await settings.preview(hub, body));
  if (bits[1] === 'prompt' && request.method === 'GET') {
    const role = url.searchParams.get('role');
    const project = url.searchParams.get('project') || undefined;
    return send(response, 200, { text: settings.fullPrompt(hub, await settings.load(hub), role, project) });
  }
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
