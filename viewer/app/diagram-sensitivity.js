'use strict';

// Spec §3 (hub): the diagram dial across every machine the hub knows. The hub stores nothing;
// each machine's own files are the truth, so both routes only fan out and collect.
const { appError } = require('./state.js');

const LEVELS = ['ask', 'default', 'high'];
const ROUTE = '/v1/diagram-sensitivity';

function timeoutMs() {
  const value = Number(process.env.WHEELCHAIR_DIAGRAM_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : 5000;
}

// One machine's answer or its failure. A machine's own 4xx keeps its text; a timeout, a refused
// connection or a 5xx is "did not answer".
async function ask(hub, name, method, body) {
  try {
    return { ok: true, value: await hub.call(name, ROUTE, method, body, timeoutMs()) };
  } catch (error) {
    const refused = error && error.status >= 400 && error.status < 500 && error.message;
    return { ok: false, value: { error: refused ? error.message : 'did not answer' } };
  }
}

async function fanOut(hub, method, body, pick) {
  const names = Object.keys(await hub.machines());
  const answers = await Promise.all(names.map((name) => ask(hub, name, method, body)));
  const machines = {};
  names.forEach((name, index) => {
    const { ok, value } = answers[index];
    machines[name] = ok ? pick(value) : value;
  });
  return { machines, ok: answers.every((answer) => answer.ok) };
}

async function read(hub) {
  const { machines } = await fanOut(hub, 'GET', undefined, (value) => ({
    level: value.level ?? null,
    files: Array.isArray(value.files) ? value.files : [],
  }));
  return { machines };
}

async function write(hub, body) {
  if (!body || !LEVELS.includes(body.level)) throw appError(400, 'level must be ask, default or high');
  const { machines, ok } = await fanOut(hub, 'POST', { level: body.level }, (value) => ({ level: value.level }));
  return { status: ok ? 200 : 502, body: { machines } };
}

module.exports = { LEVELS, read, write };
