#!/usr/bin/env node
'use strict';

// Spec "How the app reads and drives a session" and protocol/app/cards.md.
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');

const shown = new Set([
  'offer',
  'idea',
  'question',
  'approval',
  'progress',
  'needs',
  'done',
  'diagram',
  'stub',
]);

const roles = {
  offer: ['lead'],
  idea: ['lead'],
  question: ['lead'],
  approval: ['lead'],
  progress: ['lead', 'sub-lead'],
  needs: ['lead'],
  done: ['lead'],
  diagram: ['lead'],
  stub: ['lead'],
  title: ['lead'],
  resolve: ['lead'],
  message: ['lead', 'sub-lead', 'worker', 'mapper'],
  result: ['worker', 'mapper', 'sub-lead'],
};

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const array = (value, check, minimum = 0) => (
  Array.isArray(value) && value.length >= minimum && value.every(check)
);

function truncateTitle(value, limit) {
  const title = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (title.length <= limit) return title;
  const space = title.lastIndexOf(' ', limit);
  return `${title.slice(0, space === -1 ? limit : space)}…`;
}

const fields = {
  offer: { summary: text },
  idea: {
    bullets: (value) => array(value, (item) => object(item) && text(item.id) && text(item.text), 1),
  },
  question: {
    fits: text,
    question: text,
    options: (value) => (
      array(value, (item) => (
        object(item) && text(item.id) && text(item.label) && text(item.consequence)
      ), 2) && value.length <= 4
    ),
    leaning: text,
    why: text,
    progress: (value) => value === undefined || text(value),
    doc: (value) => value === undefined || ['MAP.md', 'IDEA.md', 'PLAN.md'].includes(value),
  },
  approval: {
    objections: (value) => array(value, (item) => (
      object(item)
      && text(item.id)
      && text(item.finding)
      && ['blocking', 'major'].includes(item.severity)
      && text(item.reason)
    )),
    ready: (value) => object(value) && typeof value.ok === 'boolean' && array(value.missing, text),
  },
  progress: {
    done: Number.isInteger,
    total: Number.isInteger,
    machines: (value) => array(value, text),
    choice_waiting: (value) => typeof value === 'boolean',
  },
  needs: {
    title: text,
    body: text,
    items: (value) => value === undefined || array(value, text),
  },
  done: {
    title: text,
    can_do: (value) => array(value, text),
    left_as_is: (value) => array(value, text),
    pr_url: text,
    note: (value) => value === undefined || text(value),
  },
  diagram: { plan: text, graph: text, title: text },
  stub: {
    title: text,
    summary: text,
    depends_on_parent: (value) => typeof value === 'boolean',
    commits: (value) => value === undefined || array(value, text),
  },
  title: { title: text },
  resolve: { card: text, note: text },
  message: { to: text, text },
  result: {
    task: text,
    outcome: (value) => ['done', 'blocked'].includes(value),
    summary: text,
    report: (value) => value === undefined || text(value),
    commit: (value) => value === undefined || text(value),
  },
};

function validate(kind, card, role) {
  if (!fields[kind]) return { ok: false, reason: `unknown card kind: ${kind}` };
  if (!object(card)) return { ok: false, reason: 'card must be one JSON object' };
  if (card.kind !== undefined && card.kind !== kind) {
    return { ok: false, reason: 'kind must equal the command-line kind' };
  }
  const allowed = new Set([...Object.keys(fields[kind]), 'kind']);
  for (const key of Object.keys(card)) {
    if (!allowed.has(key)) return { ok: false, reason: `unknown field: ${key}` };
  }
  for (const [key, check] of Object.entries(fields[kind])) {
    if (!check(card[key])) return { ok: false, reason: `invalid or missing field: ${key}` };
  }
  if (kind === 'question' && !card.options.some((option) => option.id === card.leaning)) {
    return { ok: false, reason: 'leaning must name an option' };
  }
  if (kind === 'progress' && (card.done < 0 || card.total < card.done)) {
    return { ok: false, reason: 'progress counts are invalid' };
  }
  if (role && !roles[kind].includes(role)) {
    return { ok: false, reason: `${role} may not post ${kind}` };
  }
  return { ok: true, card: { ...card, kind } };
}

// Which card a resolve may close: an open needs card a lead posted in this thread, or, for a
// lead, an open question. The hub's own needs cards (system) close themselves or have their
// own button.
function resolvable(thread, cardId, mode) {
  const target = (thread.cards || []).find((item) => item.id === cardId && !item.replaced);
  if (!target) return { ok: false, reason: 'no such card in this thread' };
  if (target.kind !== 'needs' && !(mode === 'lead' && target.kind === 'question')) {
    return { ok: false, reason: mode === 'lead' ? 'only a needs or question card can be resolved' : 'only a needs card can be resolved' };
  }
  if (target.kind === 'needs' && target.system) return { ok: false, reason: 'a system needs card closes itself' };
  if (target.answered) return { ok: false, reason: 'card is already answered' };
  return { ok: true, card: target };
}

function post(urlText, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const payload = JSON.stringify(body);
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          'x-wheelchair-session-token': token,
        },
      },
      (response) => {
        let output = '';
        response.on('data', (chunk) => { output += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body: output }));
      },
    );
    request.on('error', reject);
    request.end(payload);
  });
}

async function main(argv) {
  const [kind, file] = argv;
  if (!kind || !file) throw new Error('usage: card.js <kind> <json-file>');
  let card;
  try {
    card = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error('card file is not valid JSON');
  }
  const checked = validate(kind, card);
  if (!checked.ok) throw new Error(checked.reason);
  const token = process.env.WHEELCHAIR_SESSION_TOKEN;
  if (!token) throw new Error('WHEELCHAIR_SESSION_TOKEN is required');
  // The service listens on its tailnet address only, and names it in each session's environment.
  const origin = process.env.WHEELCHAIR_MACHINE_ORIGIN || 'http://127.0.0.1:7374';
  const endpoint = process.env.WHEELCHAIR_MACHINE_URL || `${origin}/v1/agent/cards`;
  const result = await post(endpoint, token, checked.card);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`machine refused card (${result.status}): ${result.body}`);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`card: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { fields, resolvable, roles, shown, truncateTitle, validate };
