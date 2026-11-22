'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
// Spec "Security" and "Views": browser and machine callback HTTP routes.
const { appError } = require('./state.js');
const { publicSession } = require('./sessions.js');
const { discoverSlug, findSlug } = require('./views.js');
const settings = require('./settings.js');
const cards = require('./cards.js');
const diagramSensitivity = require('./diagram-sensitivity.js');
const usage = require('./usage.js');
const balancer = require('./balancer.js');
const harnesses = require('./harnesses.js');
const { PROVIDERS, cliOf } = require('./providers.js');
const threadsModule = require('./threads.js');
const UPLOAD_LIMIT = 25 * 1024 * 1024;
const HTML_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox";
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'content-security-policy': HTML_CSP };


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
  if (request.method === 'POST' && bits[0] === 'threads' && bits[1] && bits[2] === 'uploads' && bits.length === 3) return upload(hub, request, response, url, bits[1]);
  if (request.method === 'POST' && bits.length === 2 && bits[0] === 'threads' && bits[1] === 'import') {
    const limit = 10 * 1024 * 1024;
    const oversized = () => {
      request.pause();
      response.setHeader('Connection', 'close');
      response.once('finish', () => request.destroy());
      return appError(413, 'file is over 10 MB');
    };
    if (Number(request.headers['content-length']) > limit) throw oversized();
    const bytes = await new Promise((resolve, reject) => {
      const chunks = []; let size = 0;
      request.on('data', (chunk) => {
        size += chunk.length;
        if (size > limit) { reject(oversized()); return; }
        chunks.push(chunk);
      });
      request.once('end', () => resolve(Buffer.concat(chunks)));
      request.once('error', reject);
    });
    return send(response, 200, await hub.importHandoff(bytes, url.searchParams.get('machine') || 'hub', url.searchParams.get('project')));
  }
  const write = ['POST', 'PUT', 'DELETE'].includes(request.method);
  const body = write ? await readBody(request) : {};
  if (request.method === 'POST' && bits.length === 2 && bits[0] === 'project-tools' &&
      ['read', 'save', 'remove-key', 'unity-prep'].includes(bits[1])) {
    if (!body || typeof body.path !== 'string') return send(response, 400, { error: 'path is required' });
    const { machine, ...input } = body;
    const name = typeof machine === 'string' && machine ? machine : 'hub';
    try {
      const result = await hub.client.passThrough(name, `/v1/project-tools/${bits[1]}`, 'POST', input, 120_000);
      return send(response, result.status, result.body);
    } catch (error) {
      if (error.status === 404 && error.message === `unknown machine: ${name}`) return send(response, 404, { error: error.message });
      return send(response, 504, { error: error.message === 'machine timeout' ? 'machine timeout' : error.message === 'machine returned invalid JSON' ? error.message : 'machine unavailable' });
    }
  }
  if (bits[0] === 'machine') {
    return handleMachine(hub, request, response, bits, body, machineAuthenticated);
  }
  if (bits[0] === 'handoff-revokes' && bits[1] === 'dismiss' && request.method === 'POST') return send(response, 200, await require('./handoff-ops.js').dismiss(hub, body));
  if (bits[0] === 'threads') return handleThreads(hub, request, response, url, bits, body);
  if (bits[0] === 'features' && request.method === 'GET') {
    return send(response, 200, await hub.features());
  }
  if (bits[0] === 'projects' && request.method === 'GET') {
    return send(response, 200, { projects: await hub.projects() });
  }
  if (bits[0] === 'new-thread' && bits.length === 1 && request.method === 'GET') {
    return send(response, 200, await newThread(hub, url.searchParams.get('machine') || 'hub'));
  }
  if (bits[0] === 'harnesses' && bits.length === 1 && request.method === 'GET') return send(response, 200, await harnesses.describe(hub, url.searchParams.get('fresh') === '1'));
  if (bits[0] === 'onboarding' && bits.length === 1 && request.method === 'GET') return send(response, 200, await harnesses.onboarding(hub));
  if (bits[0] === 'machines' && bits.length === 5 && bits[2] === 'harnesses' && bits[4] === 'install' && ['GET', 'POST'].includes(request.method)) {
    const name = bits[1], provider = bits[3];
    if (!Object.hasOwn(PROVIDERS, provider)) throw appError(404, 'provider not found');
    if (!(await hub.state.resolveMachine(await hub.machines(), name))) throw appError(404, 'machine not found');
    try { const result = await hub.client.passThrough(name, `/v1/harnesses/${provider}/install`, request.method, body); return send(response, result.status, result.body); }
    catch { return send(response, 502, { error: `${name} isn't reachable.` }); }
  }
  if (bits[0] === 'settings') return handleSettings(hub, request, response, url, bits, body);
  if (bits[0] === 'usage') {
    if (bits.length === 1 && request.method === 'GET') { const { providers } = await usage.summary(hub); return send(response, 200, { providers }); }
    if (bits[1] === 'alert' && request.method === 'GET') return send(response, 200, await usage.alert(hub));
    if (bits[1] === 'seen' && request.method === 'POST') return send(response, 200, await usage.seen(hub));
  }
  if (bits[0] === 'accounts') return handleAccounts(hub, request, response, bits, body);
  if (bits[0] === 'agents' && bits.length === 1 && request.method === 'GET') return send(response, 200, await require('./agents.js').agents(hub));
  if (bits[0] === 'sessions') return handleSessions(hub, request, response, bits, body);
  throw appError(404, 'route not found');
}

async function upload(hub, request, response, url, id) {
  const length = request.headers['content-length'];
  if (typeof length !== 'string' || !/^\d+$/.test(length) || Number(length) > UPLOAD_LIMIT) throw appError(413, 'missing or oversized content-length');
  const thread = await hub.withThread(id, async () => {
    const current = await hub.thread(id);
    require('./handoff.js').refuseFrozen(hub, current);
    const lead = current.sessions.find((session) => session.role === 'lead' && session.live);
    if (current.archived || !lead) throw appError(409, 'no live lead or thread is archived');
    hub.uploadsInFlight.set(id, (hub.uploadsInFlight.get(id) || 0) + 1);
    return current;
  });
  const query = new URLSearchParams({ thread_id: id, name: url.searchParams.get('name') || '', vouched: '1' });
  try {
    const result = await hub.client.stream(thread.machine, `/v1/uploads?${query}`, 'POST', request);
    response.writeHead(result.status, { 'content-type': result.headers['content-type'] || 'application/json' });
    await new Promise((resolve) => {
      response.once('finish', resolve);
      response.once('close', resolve);
      result.body.on('error', () => { response.destroy(); resolve(); });
      result.body.pipe(response);
    });
  } catch (error) {
    if (error.status || !error.machineConnection) throw error;
    if (response.headersSent) response.destroy();
    else if (response.writable && !response.destroyed) send(response, 409, { error: 'upload cancelled by the machine' });
  } finally {
    await hub.withThread(id, () => {
      const remaining = (hub.uploadsInFlight.get(id) || 1) - 1;
      if (remaining) hub.uploadsInFlight.set(id, remaining);
      else hub.uploadsInFlight.delete(id);
    });
  }
}

// Spec "Hub", Routes: everything the New thread screen needs for one machine in one answer.
async function newThread(hub, machine) {
  const machines = await hub.state.machines();
  const resolved = await hub.state.resolveMachine(machines, 'hub');
  const known = await hub.state.resolveMachine(machines, machine);
  if (!known) throw appError(404, `unknown machine: ${machine}`);
  const names = ['hub', ...Object.keys(machines).filter((name) => !resolved || machines[name] !== resolved)];
  const value = await settings.load(hub);
  const result = { machines: [...new Set(names)], machine, default_folder: value.default_project_folder };
  result.saved = value.saved_dirs.filter((entry) => entry.machine === machine);
  result.found = [];
  if (value.default_project_folder) {
    try {
      const listed = await hub.call(machine, `/v1/projects?folder=${encodeURIComponent(value.default_project_folder)}`, 'GET');
      result.found = Array.isArray(listed.found) ? listed.found : [];
      if (listed.folder_error) result.found_error = listed.folder_error;
    } catch (error) {
      result.found_error = error.status === 404 ? `${machine} needs updating` : `${machine} is not reachable`;
    }
  }
  const matching = [];
  for (const thread of await hub.allThreads()) {
    const entry = thread.machine === machine ? known : await hub.state.resolveMachine(machines, thread.machine);
    if (entry === known) matching.push(thread);
  }
  matching.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  result.previous = [...new Set(matching.map((thread) => thread.project))];
  return result;
}

function validFolder(value) {
  const folder = value.trim();
  if (folder && !folder.startsWith('/') && folder !== '~' && !folder.startsWith('~/')) {
    throw appError(400, 'default_project_folder must be an absolute path, ~, or start with ~/');
  }
  return folder;
}

async function addSavedDir(hub, body) {
  if (typeof body.name !== 'string' || !body.name.trim()) throw appError(400, 'name is required');
  const name = body.name.trim();
  if (name === '.' || name === '..') throw appError(400, "name can't be . or ..");
  if (name.length > 60) throw appError(400, 'name is too long (maximum 60 characters)');
  if (typeof body.path !== 'string' || !body.path.trim()) throw appError(400, 'path is required');
  const machine = typeof body.machine === 'string' && body.machine ? body.machine : 'hub';
  const duplicate = (value) => value.saved_dirs.some((entry) => entry.name === name && entry.machine === machine);
  if (duplicate(await settings.load(hub))) throw appError(409, `${name} is already saved for ${machine}`);
  const checked = await threadsModule.checkProject(hub, machine, body.path.trim());
  if (!checked.ok) throw appError(400, `${checked.path || body.path.trim()} ${checked.reason || 'is not usable'} on ${machine}`);
  const value = await settings.update(hub, (current) => {
    if (duplicate(current)) throw appError(409, `${name} is already saved for ${machine}`);
    current.saved_dirs.push({ name, path: checked.path, machine });
  });
  return { saved: value.saved_dirs.filter((entry) => entry.machine === machine) };
}

async function reservedLabel(hub, value) {
  const provider = balancer.reservedProvider(value, await usage.machineAccounts(hub), null);
  return provider ? PROVIDERS[provider].label : null;
}

async function handleSettings(hub, request, response, url, bits, body) {
  if (bits[1] === 'diagram-sensitivity' && bits.length === 2) {
    if (request.method === 'GET') return send(response, 200, await diagramSensitivity.read(hub));
    if (request.method === 'POST') { const result = await diagramSensitivity.write(hub, body); return send(response, result.status, result.body); }
  }
  if (bits.length === 1 && request.method === 'GET') return send(response, 200, { ...await settings.describe(hub), reserved_provider: await reservedLabel(hub, await settings.load(hub)) });
  if (bits[1] === 'harnesses' && bits.length === 3 && request.method === 'PUT') {
    const provider = bits[2];
    if (!Object.hasOwn(PROVIDERS, provider)) throw appError(404, 'provider not found');
    if (typeof body.enabled !== 'boolean') throw appError(400, 'enabled must be a boolean');
    await settings.update(hub, (value) => { value.harnesses[provider] = body.enabled; if (!body.enabled && !harnesses.enabledLeadOrder(value).length) throw appError(409, 'Lead order would have no harness left. Add another to Lead order first.'); });
    return send(response, 200, await settings.describe(hub));
  }
  if (bits[1] === 'lessons' && bits.length === 3 && request.method === 'PUT') {
    const role = bits[2];
    if (!settings.ROLES.has(role) || !body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['edits', 'removals'].includes(key)) || !Array.isArray(body.edits) || !Array.isArray(body.removals) || body.edits.some((edit) => !edit || typeof edit !== 'object' || Array.isArray(edit) || Object.keys(edit).some((key) => !['id', 'text'].includes(key)) || typeof edit.id !== 'string' || !settings.validLessonText(edit.text)) || body.removals.some((id) => typeof id !== 'string')) throw appError(400, 'invalid lesson edits');
    const value = await settings.update(hub, (current) => {
      const list = current.lessons[role];
      if (body.edits.some((edit) => !list.some((item) => item.id === edit.id))) throw appError(409, 'an agent removed a lesson you edited; reload to see the current list');
      for (const edit of body.edits) { const item = list.find((entry) => entry.id === edit.id); item.text = edit.text; item.saved_by = 'user'; item.saved_at = new Date().toISOString(); }
      current.lessons[role] = list.filter((item) => !body.removals.includes(item.id));
    });
    return send(response, 200, { lessons: value.lessons[role] });
  }
  if (bits[1] === 'accounts') {
    if (bits.length === 2 && request.method === 'POST') {
      let account;
      await settings.update(hub, (value) => {
        if (!Object.hasOwn(PROVIDERS, body.provider) || typeof body.name !== 'string' || !body.name.trim() || !Object.hasOwn(settings.PLANS[body.provider], body.plan)) throw appError(400, 'invalid account');
        if (PROVIDERS[body.provider].singleAccount) throw appError(400, `${PROVIDERS[body.provider].label} supports one account per machine`);
        const base = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'account';
        let id = base, n = 2;
        while (id.startsWith('default-') || (value.accounts.some((a) => a.id === id) || value.retired_accounts.includes(id))) { const suffix = `-${n++}`; id = base.slice(0, 40 - suffix.length) + suffix; if (id.startsWith('default-')) id = `account${suffix}`; }
        account = { id, provider: body.provider, name: body.name.trim(), plan: body.plan, weight: settings.PLANS[body.provider][body.plan], paused: false };
        value.accounts.push(account);
      });
      return send(response, 201, account);
    }
    if (bits.length === 4 && bits[3] === 'restore' && request.method === 'POST') {
      let account;
      await settings.update(hub, (value) => {
        const provider = Object.keys(PROVIDERS).find((p) => bits[2] === `default-${p}`);
        if (!provider) throw appError(404, 'account not found');
        if (value.accounts.some((a) => a.id === bits[2])) throw appError(400, 'default account is already there');
        if (PROVIDERS[provider].singleAccount && value.accounts.some((a) => a.provider === provider)) throw appError(400, `${PROVIDERS[provider].label} supports one account per machine`);
        account = { id: bits[2], provider, name: 'default', plan: 'unknown', weight: settings.PLANS[provider].unknown, paused: false };
        value.accounts.push(account);
        value.retired_accounts = value.retired_accounts.filter((id) => id !== bits[2]);
      });
      return send(response, 201, account);
    }
    if (bits.length === 3 && ['PUT', 'DELETE'].includes(request.method)) {
      let account;
      await settings.update(hub, (value) => {
        const index = value.accounts.findIndex((a) => a.id === bits[2]);
        if (index < 0) throw appError(404, 'account not found');
        account = value.accounts[index];
        if (request.method === 'DELETE') { value.accounts.splice(index, 1); value.retired_accounts.push(account.id); return; }
        if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) throw appError(400, 'invalid name');
        if (body.plan !== undefined && !Object.hasOwn(settings.PLANS[account.provider], body.plan)) throw appError(400, 'invalid plan');
        if (body.weight !== undefined && (typeof body.weight !== 'number' || !Number.isFinite(body.weight) || body.weight <= 0)) throw appError(400, 'invalid weight');
        if (body.paused !== undefined && typeof body.paused !== 'boolean') throw appError(400, 'invalid paused');
        if (body.name !== undefined) account.name = body.name.trim();
        if (body.plan !== undefined) { account.plan = body.plan; if (body.weight === undefined) account.weight = settings.PLANS[account.provider][body.plan]; }
        if (body.weight !== undefined) account.weight = body.weight;
        if (body.paused !== undefined) account.paused = body.paused;
      });
      return send(response, 200, request.method === 'DELETE' ? { ok: true } : account);
    }
  }
  if (bits[1] === 'balancing' && bits.length === 2 && request.method === 'PUT') {
    const value = await settings.update(hub, (value) => { for (const [key, v] of Object.entries(body)) { if (!settings.BALANCING.includes(key) || !settings.validBalancing(key, v)) throw appError(400, `invalid ${key}`); value[key] = v; } if (!harnesses.enabledLeadOrder(value).length) throw appError(409, 'Lead order would have no harness left. Add another to Lead order first.'); });
    return send(response, 200, { ...Object.fromEntries(settings.BALANCING.map((key) => [key, value[key]])), reserved_provider: await reservedLabel(hub, value) });
  }
  if (bits[1] === 'models' && request.method === 'PUT') {
    if (!Object.hasOwn(PROVIDERS, body.provider)) throw appError(400, 'provider must be claude, gpt, gemini, kimi or openrouter');
    let slot = settings.TIER_ALIASES[body.slot] || body.slot;
    if (body.provider === 'claude') slot = ({ haiku: 'light', sonnet: 'standard', opus: 'heavy' })[slot] || slot;
    if (!['light', 'standard', 'heavy', 'critical', 'lead', 'sub-lead'].includes(slot)) throw appError(400, 'slot is invalid');
    if (body.model !== null && (typeof body.model !== 'string' || !(body.provider === 'openrouter' ? /^(?=.{1,128}$)[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)?$/ : body.provider === 'kimi' ? /^[a-z0-9][a-z0-9._-]{0,63}(\/[a-z0-9][a-z0-9._-]{0,63})?$/ : /^[a-z0-9][a-z0-9._-]{0,63}$/).test(body.model))) throw appError(400, 'model is invalid');
    if (!PROVIDERS[body.provider].effort && body.effort !== undefined) throw appError(400, `${PROVIDERS[body.provider].label} has no effort setting`);
    if (body.provider === 'gpt' && body.effort !== undefined && !['low', 'medium', 'high', 'xhigh'].includes(body.effort)) throw appError(400, 'effort for GPT must be one of low, medium, high, xhigh');
    if (['claude', 'gemini', 'openrouter'].includes(body.provider) && body.effort !== undefined && !['low', 'medium', 'high', 'xhigh', 'max'].includes(body.effort)) throw appError(400, 'effort is invalid');
    try { await settings.modelCommand(hub, ['set', body.provider, slot, body.model || 'none', ...(body.effort ? [body.effort] : [])]); }
    catch (error) { throw appError(400, (error.stderr || error.message).trim()); }
    return send(response, 200, { models: await settings.models(hub) });
  }
  if (bits[1] === 'models' && bits[2] === 'heads-up' && request.method === 'POST') {
    let args;
    if (body.action === 'switch') {
      const tier = settings.TIER_ALIASES[body.tier] || body.tier;
      if (!['light', 'standard', 'heavy', 'critical'].includes(tier) || typeof body.model !== 'string') throw appError(400, 'tier and model are required to switch');
      const effort = (await settings.modelCommand(hub, ['effort', 'gpt', tier])).stdout.trim();
      args = ['set', 'gpt', tier, body.model, ...(effort ? [effort] : [])];
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
      if (body.lead_names !== undefined) {
        if (!Array.isArray(body.lead_names) || body.lead_names.some((name) => typeof name !== 'string')) throw appError(400, 'lead_names must be an array of names');
        const names = body.lead_names.map((name) => name.trim()).filter(Boolean);
        if (names.length > 1000 || names.some((name) => name.length > 40) || new Set(names.map((name) => name.toLowerCase())).size !== names.length) throw appError(400, 'lead_names must have at most 1000 unique names of 1–40 characters');
        value.lead_names = names;
        // Names sent without a list choice keep the old meaning: names mean use them,
        // an empty list means Greek letters.
        if (body.lead_name_list === undefined) value.lead_name_list = names.length ? 'custom' : value.lead_name_list === 'custom' ? 'greek' : value.lead_name_list;
      }
      if (body.lead_name_list !== undefined) {
        const keys = require('./names.js').LIST_KEYS;
        if (!keys.includes(body.lead_name_list)) throw appError(400, `lead_name_list must be one of ${keys.join(', ')}`);
        value.lead_name_list = body.lead_name_list;
      }
      if (body.permission_mode !== undefined) {
        if (!['auto', 'bypass'].includes(body.permission_mode)) throw appError(400, 'permission_mode must be auto or bypass');
        value.permission_mode = body.permission_mode;
      }
      if (body.codex_mode !== undefined) {
        if (!['sandboxed', 'unrestricted'].includes(body.codex_mode)) throw appError(400, 'codex_mode must be sandboxed or unrestricted');
        value.codex_mode = body.codex_mode;
      }
      if (body.aside_access !== undefined) {
        if (!['read-only', 'full'].includes(body.aside_access)) throw appError(400, 'aside_access must be read-only or full');
        value.aside_access = body.aside_access;
      }
      if (body.auto_merge !== undefined) {
        if (!['off', 'on'].includes(body.auto_merge)) throw appError(400, 'auto_merge must be off or on');
        value.auto_merge = body.auto_merge;
      }
      if (body.review_families !== undefined) {
        if (!['both', 'claude', 'gpt', 'gemini', 'kimi', 'openrouter'].includes(body.review_families)) throw appError(400, 'review_families must be both, claude, gpt, gemini, kimi or openrouter');
        value.review_families = body.review_families;
      }
      if (body.tool_steps !== undefined) {
        if (!['show', 'hide'].includes(body.tool_steps)) throw appError(400, 'tool_steps must be show or hide');
        value.tool_steps = body.tool_steps;
      }
      if (body.escalation !== undefined) {
        if (!body.escalation || typeof body.escalation !== 'object' || Array.isArray(body.escalation)) throw appError(400, 'escalation must be an object');
        for (const [key, entry] of Object.entries(body.escalation)) {
          const allowed = settings.ESCALATION_VALUES[key];
          if (!allowed || !Object.hasOwn(settings.ESCALATION_VALUES, key)) throw appError(400, `escalation.${key} is not a setting`);
          if (!allowed.includes(entry)) throw appError(400, `escalation.${key} must be one of ${allowed.join(', ')}`);
          value.escalation[key] = entry;
        }
      }
      if (body.default_project_folder !== undefined) {
        if (typeof body.default_project_folder !== 'string') throw appError(400, 'default_project_folder must be text');
        value.default_project_folder = validFolder(body.default_project_folder);
      }
      if (body.user_name !== undefined) {
        value.user_name = settings.validUserName(body.user_name);
      }
      if (body.other_agents !== undefined) {
        if (!body.other_agents || typeof body.other_agents !== 'object' || Array.isArray(body.other_agents)) throw appError(400, 'other_agents must be an object');
        for (const role of ['reviewer', 'verifier', 'mapper', 'scout', 'scout-heavy']) if (body.other_agents[role] !== undefined) value.other_agents[role] = settings.tier(body.other_agents[role], `other_agents.${role}`);
      }
    });
    return send(response, 200, { lead_name_list: value.lead_name_list, lead_names: value.lead_names, permission_mode: value.permission_mode, codex_mode: value.codex_mode, aside_access: value.aside_access, auto_merge: value.auto_merge, tool_steps: value.tool_steps, review_families: value.review_families, other_agents: value.other_agents, default_project_folder: value.default_project_folder, user_name: value.user_name, escalation: value.escalation, escalation_text: settings.escalationSentences(value.escalation).join('\n') });
  }
  if (bits[1] === 'saved-dirs' && bits.length === 2 && request.method === 'POST') {
    return send(response, 201, await addSavedDir(hub, body));
  }
  if (bits[1] === 'saved-dirs' && bits[2] && bits.length === 3 && request.method === 'DELETE') {
    const machine = url.searchParams.get('machine') || 'hub';
    let name;
    try { name = decodeURIComponent(bits[2]); } catch { throw appError(404, 'saved directory not found'); }
    const value = await settings.update(hub, (value) => {
      const index = value.saved_dirs.findIndex((entry) => entry.name === name && entry.machine === machine);
      if (index < 0) throw appError(404, 'saved directory not found');
      value.saved_dirs.splice(index, 1);
    });
    return send(response, 200, { saved: value.saved_dirs.filter((entry) => entry.machine === machine) });
  }
  if (bits[1] === 'templates' && bits.length === 2 && request.method === 'POST') {
    let template;
    const projectList = await hub.projects();
    await settings.update(hub, (value) => {
      const projects = settings.knownProjects(projectList, value);
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
      const projectList = await hub.projects();
      await settings.update(hub, (value) => {
        const projects = settings.knownProjects(projectList, value);
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

async function handleAccounts(hub, request, response, bits, body) {
  const account = (await settings.load(hub)).accounts.find((a) => a.id === bits[1]);
  if (!account || bits[2] !== 'signin') throw appError(404, 'account not found');
  const machine = bits[3] || body.machine;
  if (typeof machine !== 'string' || !(await hub.state.resolveMachine(await hub.machines(), machine))) throw appError(404, 'machine not found');
  const id = encodeURIComponent(account.id);
  if (bits.length === 3 && request.method === 'POST') return send(response, 201, await hub.call(machine, '/v1/logins', 'POST', { account: account.id, cli: cliOf(account.provider), dir: account.id === `default-${account.provider}` ? null : `~/.wheelchair/accounts/${account.id}` }));
  if (bits.length === 4 && request.method === 'GET') return send(response, 200, await hub.call(machine, `/v1/logins/${id}`, 'GET'));
  if (bits.length === 5 && bits[4] === 'pane' && request.method === 'GET') return send(response, 200, await hub.call(machine, `/v1/logins/${id}/pane`, 'GET'));
  if (bits.length === 5 && ['code', 'keys'].includes(bits[4]) && request.method === 'POST') return send(response, 200, await hub.call(machine, `/v1/logins/${id}/${bits[4]}`, 'POST', body));
  throw appError(404, 'route not found');
}

async function handleMachine(hub, request, response, bits, body, authenticated) {
  if (!authenticated) throw appError(401, 'machine secret required');
  if (bits[1] === 'cards' && request.method === 'POST') {
    const result = await hub.acceptCard(body);
    return send(response, result[cards.REPLAY] ? 200 : 202, result);
  }
  if (bits[1] === 'events' && request.method === 'POST') {
    const result = await hub.event(body);
    return send(response, result.duplicate ? 200 : 202, result);
  }
  if (bits[1] === 'sudo-outcome' && request.method === 'POST') {
    return send(response, 200, await require('./cards.js').sudoOutcome(hub, body));
  }
  if (bits[1] === 'session' && request.method === 'POST') {
    return send(response, 200, await hub.sessionRequest(body));
  }
  throw appError(404, 'route not found');
}

async function handleThreads(hub, request, response, url, bits, body) {
  if (bits.length === 1 && request.method === 'GET') {
    const listed = await hub.allThreads();
    const all = await Promise.all(listed.map((thread) => hub.withThread(thread.id, async () => {
      let current = await hub.readSnapshot(thread.id);
      if (await discoverSlug(current, hub)) {
        current = await hub.thread(thread.id);
        await findSlug(hub, current);
      }
      return { ...thread, ...current };
    })));
    for (const thread of all) require('./remote-plan.js').refresh(hub, thread);
    // `?view=list` is what the pages poll: each thread's summary without its history
    // (cards, sent messages, briefs), which is most of the bytes and none of the list.
    const lean = url.searchParams.get('view') === 'list';
    const threads = all.map((thread) => {
      if (!lean) return { ...thread, handed_off: thread.handed_off || null, sessions: thread.sessions.map(publicSession) };
      const { cards, sent, delivered_ids, context, pinned, archive, queues, sudo_index, ...summary } = thread;
      // A small fix writes no plan, so it has no stage; its done card is what says it finished.
      const doneCard = (cards || []).some((card) => card.kind === 'done' && !card.replaced);
      // Before that, its pinned progress line says where it is: building, verifying or verified.
      // A planned thread (it has a slug) takes its stage from PLAN.md, even archived.
      const progress = !summary.slug && pinned && pinned.progress;
      const progressStage = !progress ? null
        : (progress.stage || 'build') === 'build' ? 'building'
          : progress.stage === 'verify' ? (progress.phase === 'clean' ? 'verified' : 'verifying') : null;
      return { ...summary, handed_off: thread.handed_off || null, done_card: doneCard, progress_stage: progressStage, sessions: thread.sessions.map(({ name, role, live, ready, turn_ended, created_at }) => ({ name, role, live, ready, turn_ended, created_at })) };
    });
    const revoke_notices = (await require('./handoff-ops.js').revokes(hub)).filter((entry) => entry.last_result === 'failed').map((entry) => ({ thread_id: entry.thread_id, sha: entry.sha, text: `Couldn't take back a cancelled pick-up on ${entry.repository || entry.project} ${entry.branch}: ${entry.error}` }));
    return send(response, 200, { threads, revoke_notices });
  }
  if (bits.length === 1 && request.method === 'POST') {
    const thread = await hub.createThread(body);
    return send(response, 201, { ...thread, sessions: thread.sessions.map(publicSession) });
  }
  if (!bits[1]) throw appError(404, 'route not found');
  const id = bits[1];
  if (bits[2] === 'try' && bits.length === 3 && ['GET', 'POST'].includes(request.method)) {
    const thread = await hub.thread(id);
    const machines = await hub.state.machines();
    const local = await hub.state.resolveMachine(machines, 'hub');
    const target = await hub.state.resolveMachine(machines, thread.machine);
    let ownRoot = false;
    if (local && target && local === target) {
      try {
        const [project, root] = await Promise.all([fs.realpath(thread.project), fs.realpath(hub.root)]);
        const relative = path.relative(project, root);
        ownRoot = relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
      } catch { /* The machine reports invalid folders. */ }
    }
    const refusal = 'This folder runs wheelchair itself; switching it would swap the running app for untested code.';
    const statusWithTitle = async (status) => ({
      ...status,
      ...(ownRoot ? { refused: refusal } : {}),
      active_thread_title: (await hub.allThreads()).find((item) => item.id === status.active_thread_id)?.title ?? null,
    });
    const base = { thread_id: id, project: thread.project };
    const call = async (input) => {
      try { return await hub.client.tryCheckout(thread.machine, input); }
      catch (error) {
        if (error.status === 422 || error.status === 502) {
          send(response, error.status, { error: error.message });
          return null;
        }
        throw error;
      }
    };
    if (request.method === 'GET' || (ownRoot && ['try', 'back'].includes(body.action))) {
      const result = await call({ action: 'status', ...base });
      if (!result) return;
      const status = await statusWithTitle(result);
      return send(response, 200, request.method === 'GET' ? status : { accepted: false, reason: refusal, status });
    }
    const input = { action: body.action, ...base };
    for (const field of ['version', 'kept']) if (Object.hasOwn(body, field)) input[field] = body[field];
    const answer = await call(input);
    if (!answer) return;
    return send(response, 200, { ...answer, status: await statusWithTitle(answer.status) });
  }
  if (request.method === 'GET' && bits[2] === 'handoff' && bits.length === 3) return send(response, 200, await hub.handoffBanner(id));
  if (request.method === 'GET' && bits[2] === 'handoff-file' && bits.length === 3) {
    const file = await hub.handoffFile(id);
    response.writeHead(200, { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${file.filename}"` });
    return response.end(file.bytes);
  }
  if (request.method === 'POST' && bits[2] === 'export' && bits.length === 3) {
    const file = await hub.exportThread(id);
    response.writeHead(200, { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${file.filename}"` });
    return response.end(file.bytes);
  }
  if (bits[2] === 'asides') {
    const asides = require('./asides.js');
    const lock = bits.length === 3 && request.method === 'POST' ? hub.withChatThread.bind(hub) : hub.withThread.bind(hub);
    const result = await lock(id, async () => {
      const thread = await hub.thread(id);
      if (request.method !== 'GET') require('./handoff.js').refuseFrozen(hub, thread);
      if (request.method !== 'GET' && thread.archived) throw appError(409, 'this thread is archived');
      if (bits.length === 3 && request.method === 'POST') return { status: 201, body: asides.brief(await asides.create(hub, thread, body)) };
      if (!bits[3]) throw appError(404, 'route not found');
      const aside = asides.find(thread, bits[3]);
      if (bits.length === 4 && request.method === 'GET') {
        for (const entry of aside.history) if (entry.graph && hub.registerGraph) await hub.registerGraph(entry.graph);
        return { status: 200, body: { ...aside, heavy_usable: !!(await asides.model(hub, aside.provider, 'heavy')) } };
      }
      if (bits.length !== 5 || request.method !== 'POST') throw appError(404, 'route not found');
      await asides.change(hub, thread, aside, bits[4], body);
      return { status: bits[4] === 'messages' ? 202 : 200, body: { ok: true } };
    });
    if (request.method !== 'GET') asides.pump(hub, id).catch(() => {});
    return send(response, result.status, result.body);
  }
  if (request.method === 'GET' && bits[2] === 'files' && bits.length === 4) {
    const file = bits[3];
    if (!/^[0-9]+-[A-Za-z0-9._-]+$/.test(file)) throw appError(400, 'invalid file name');
    const thread = await hub.thread(id);
    const result = await hub.client.stream(thread.machine, `/v1/uploads/${encodeURIComponent(id)}/${encodeURIComponent(file)}`, 'GET');
    const headers = {};
    for (const key of ['content-type', 'content-disposition', 'x-content-type-options']) if (result.headers[key]) headers[key] = result.headers[key];
    response.writeHead(result.status, headers);
    result.body.on('error', () => response.destroy());
    result.body.pipe(response);
    return;
  }
  if (request.method === 'GET' && bits[2] === 'diagram-html' && bits.length === 3) {
    const html = await threadsModule.archivedHtml(hub, id, url.searchParams.get('file'));
    const download = url.searchParams.get('download') === '1';
    response.writeHead(200, download ? { ...HTML_HEADERS, 'content-disposition': `attachment; filename="${url.searchParams.get('file')}"` } : HTML_HEADERS);
    response.end(download ? require('./html-download.js').htmlDownload(html) : html);
    return;
  }
  if (request.method === 'GET' && bits[2] === 'chat') {
    return send(response, 200, await hub.chat(id));
  }
  if (request.method === 'GET' && bits[2] === 'docs.zip' && bits.length === 3) {
    const thread = await hub.thread(id), documents = require('./documents.js'), remote = require('./remote-plan.js');
    if (!documents.validSlug(thread.slug)) throw appError(404, 'document not found');
    const isRemote = await remote.isRemote(hub, thread);
    let files;
    if (isRemote) {
      try { files = (await remote.call(hub, thread, 'list', { slug: thread.slug })).files; if (!Array.isArray(files)) throw new Error('invalid list'); }
      catch { throw appError(502, `Couldn't reach ${thread.machine}`); }
      files = files.filter((file) => documents.FILES.includes(file));
    } else files = await documents.list(thread, hub);
    const entries = [];
    for (const file of files) {
      try {
        const content = isRemote ? (await remote.call(hub, thread, 'read', { slug: thread.slug, file })).content : thread.archived ? await hub.archivedDocument(id, file) : await documents.readLive(thread, file);
        if (typeof content !== 'string' && !Buffer.isBuffer(content)) throw new Error('invalid content');
        entries.push({ name: `${thread.slug}/${file}`, data: content });
      } catch { if (isRemote) throw appError(502, `Couldn't reach ${thread.machine}`); }
    }
    if (!entries.length) throw appError(404, 'document not found');
    response.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${thread.slug}-documents.zip"`, 'cache-control': 'no-store' });
    return response.end(require('./zip.js').zip(entries));
  }
  if (request.method === 'GET' && bits[2] === 'doc') {
    const file = url.searchParams.get('file');
    const thread = await hub.thread(id);
    const documents = require('./documents.js');
    if (!documents.validSlug(thread.slug) || !documents.FILES.includes(file)) throw appError(404, 'document not found');
    const remote = require('./remote-plan.js');
    const content = await remote.isRemote(hub, thread) ? await remote.read(hub, thread, file) : thread.archived ? await hub.archivedDocument(id, file) : await documents.readLive(thread, file);
    if (url.searchParams.get('download') === '1') {
      response.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'x-content-type-options': 'nosniff', 'content-disposition': `attachment; filename="${thread.slug}-${file}"`, 'cache-control': 'no-store' });
      return response.end(content);
    }
    return send(response, 200, { content: content.toString('utf8') });
  }
  if (request.method === 'GET' && bits[2] === 'graph') {
    return send(response, 200, await require('./threads.js').archivedGraph(hub, id, url.searchParams.get('file')));
  }
  if (request.method === 'POST' && bits[2] === 'messages') {
    await hub.withThread(id, async () => {
      const thread = await hub.thread(id);
      require('./handoff.js').refuseFrozen(hub, thread);
      const lead = [...thread.sessions].reverse().find((item) => item.role === 'lead' && item.live);
      if (!lead) throw appError(409, 'no live lead');
      await hub.enqueue(thread, lead.name, String(body.text || ''), 'user');
    });
    return send(response, 202, { queued: true });
  }
  if (request.method === 'POST' && bits[2] === 'send-now') {
    return send(response, 202, { sent: await hub.sendNow(id, body.at) });
  }
  if (request.method === 'POST' && bits[2] === 'cards' && bits[3] && bits[4] === 'press') {
    return send(response, 202, await hub.press(id, bits[3], body));
  }
  if (request.method === 'POST' && bits[2] === 'cards' && bits[3] && bits[4] === 'dismiss') {
    return send(response, 200, await hub.dismiss(id, bits[3]));
  }
  if (request.method === 'POST' && bits[2] === 'open') {
    const result = await hub.openStub(id, body);
    const clean = (thread) => ({ ...thread, sessions: thread.sessions.map(publicSession) });
    return send(response, 200, result.waiting ? { ...result, thread: clean(result.thread) } : clean(result));
  }
  if (request.method === 'POST' && bits.length === 3 && bits[2] === 'undo-handoff') return send(response, 200, await hub.undoHandoff(id));
  if (request.method === 'POST' && bits.length === 3 && bits[2] === 'retry-handoff') return send(response, 200, await hub.runHandoffOperation(id));
  if (request.method === 'POST' && bits.length === 3 && bits[2] === 'cancel-handoff') return send(response, 200, await hub.cancelHandoff(id));
  if (request.method === 'POST' && bits[2] === 'restart') {
    return send(response, 201, publicSession(await hub.restartLead(id)));
  }
  if (request.method === 'POST' && bits[2] === 'archive') {
    return send(response, 200, await hub.archive(id));
  }
  throw appError(404, 'route not found');
}

async function handleSessions(hub, request, response, bits, body) {
  if (bits.length === 1 && request.method === 'GET') {
    const groups = await hub.sessions();
    return send(response, 200, groups.map((group) => ({ ...group, sessions: group.sessions.map(publicSession) })));
  }
  if (!bits[1]) throw appError(404, 'route not found');
  const encoded = encodeURIComponent(bits[1]);
  if (bits[2] === 'brief' && request.method === 'GET') {
    if (!bits[1].startsWith('wc-')) throw appError(404, 'session not found');
    const thread = await hub.threadBySession(bits[1]);
    const target = hub.session(thread, bits[1]);
    if (typeof target.brief !== 'string' || !target.brief) throw appError(404, 'brief not found');
    return send(response, 200, { brief: target.brief });
  }
  if (bits[2] === 'pane' && request.method === 'GET') {
    const query = new URL(request.url, 'http://localhost').searchParams;
    const history = query.get('history');
    if (history !== null && (!/^\d+$/.test(history) || Number(history) > 2000)) throw appError(400, 'invalid history');
    const machine = await hub.findSessionMachine(bits[1]);
    if (!machine) throw appError(404, 'session not found');
    return send(response, 200, await hub.call(machine, `/v1/sessions/${encoded}/pane${history === null ? '' : `?history=${history}`}`, 'GET'));
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
      require('./handoff.js').refuseFrozen(hub, current);
      const sent = await hub.call(
        current.machine,
        `/v1/sessions/${encoded}/keys`,
        'POST',
        { keys: String(body.keys || '') },
      );
      if (String(body.keys || '') === 'Enter' || String(body.keys || '') === 'C-m') {
        const target = hub.session(current, bits[1]);
        target.turn_ended = false;
        target.turn_started_at = new Date().toISOString();
        await hub.save(current);
      }
      return sent;
    });
    return send(response, 200, result);
  }
  throw appError(404, 'route not found');
}

module.exports = { handle, readBody, send, HTML_HEADERS, UPLOAD_LIMIT };
