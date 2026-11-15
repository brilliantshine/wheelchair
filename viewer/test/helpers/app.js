'use strict';

// App-server test setup: an isolated hub state directory and fake local machine service.
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeDir, startServer } = require('./server.js');
const { startMachine } = require('./app-machine.js');

async function setup(options = {}) {
  const state = await makeDir('app-state-');
  const models = path.join(state, 'models');
  const modelsCache = path.join(state, 'models-cache.json');
  await fs.writeFile(modelsCache, JSON.stringify({ models: [] }));
  const machine = await startMachine();
  const machines = {
    hub: {
      name: 'hub',
      address: '127.0.0.1',
      port: machine.port,
      secret: machine.secret,
    },
  };
  await fs.writeFile(path.join(state, 'machines.json'), JSON.stringify(machines));
  const server = await startServer({ stateDir: state, env: { ...options.env, WHEELCHAIR_MODELS: models, WHEELCHAIR_MODELS_CACHE: modelsCache } });
  return { machine, server, state, models, modelsCache };
}

async function close(context) {
  await context.server.stop();
  await context.machine.stop();
}

async function api(context, route, options = {}) {
  const method = options.method || 'GET';
  const headers = {};
  if (options.secret) headers['x-wheelchair-machine-secret'] = options.secret;
  else {
    headers['x-graph-token'] = context.server.token;
    if (method !== 'GET') headers.origin = new URL(context.server.url).origin;
  }
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const url = new URL(`${context.server.url}/api${route}`);
  if (method === 'GET') url.searchParams.set('token', context.server.token);
  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function thread(context, input = {}) {
  const result = await api(context, '/threads', {
    method: 'POST',
    body: { project: '/tmp/project', cli: 'codex', ...input },
  });
  return result.body;
}

function machinePost(context, route, body) {
  return api(context, route, { method: 'POST', secret: context.machine.secret, body });
}

function event(context, threadId, session, type, extra = {}) {
  return machinePost(context, '/machine/events', {
    thread_id: threadId,
    session,
    type,
    ...extra,
  });
}

function card(context, threadId, session, value) {
  return machinePost(context, '/machine/cards', {
    thread_id: threadId,
    session,
    ...value,
  });
}

module.exports = { api, card, close, event, machinePost, setup, thread };
