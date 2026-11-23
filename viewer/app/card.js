#!/usr/bin/env node
'use strict';

// Spec "How the app reads and drives a session" and protocol/app/cards.md.
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PROVIDERS } = require('./providers.js');

const shown = new Set([
  'lesson',
  'offer',
  'idea',
  'deferred',
  'question',
  'reach',
  'approval',
  'progress',
  'needs',
  'done',
  'check',
  'diagram',
  'image',
  'file',
  'stub',
  'sudo',
]);

const roles = {
  lesson: ['lead', 'sub-lead', 'worker', 'mapper'],
  offer: ['lead'],
  idea: ['lead'],
  deferred: ['lead'],
  question: ['lead'],
  reach: ['lead'],
  approval: ['lead'],
  progress: ['lead', 'sub-lead'],
  needs: ['lead'],
  done: ['lead'],
  check: ['lead'],
  diagram: ['lead'],
  image: ['lead', 'sub-lead'],
  file: ['lead'],
  stub: ['lead'],
  sudo: ['lead'],
  title: ['lead'],
  resolve: ['lead'],
  retract: ['lead'],
  message: ['lead', 'sub-lead', 'worker', 'mapper', 'designer'],
  result: ['worker', 'mapper', 'sub-lead', 'designer'],
};

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const dimension = (value) => Number.isInteger(value) && value >= 200 && value <= 2560;
const line = (value) => text(value) && !/[\n\r]/.test(value);
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

// A sudo card's agent-side fields. The machine service adds request_id, url and editable from
// the helper's answer; an agent may not send them, so only the hub's own acceptance of a
// machine-posted card uses `sudoMachineFields`.
const sudoFields = {
  command: (value) => text(value) && Buffer.byteLength(value, 'utf8') <= 4096 && !value.includes('\0'),
  does: text,
  why: text,
};
const sudoMachineFields = {
  ...sudoFields,
  request_id: (value) => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value),
  url: (value) => typeof value === 'string' && value.startsWith('https://') && value.length > 'https://'.length,
  editable: (value) => array(value, (item) => typeof item === 'string'),
};

const fields = {
  lesson: {
    action: (v) => ['add', 'replace', 'remove'].includes(v),
    for: (v) => ['lead', 'sub-lead', 'worker', 'reviewer', 'verifier', 'mapper', 'designer'].includes(v),
    why: (v) => line(v) && !/[\v\f\u0085\u2028\u2029]/.test(v),
    text: (v) => v === undefined || (line(v) && v.length <= 300 && !/[\v\f\u0085\u2028\u2029]/.test(v)),
    lesson: (v) => v === undefined || (typeof v === 'string' && /^L[0-9a-f]{6}$/.test(v)),
    only_ai: (v) => v === undefined || v === 'any' || (typeof v === 'string' && Object.hasOwn(PROVIDERS, v)),
    only_project: (v) => v === undefined || typeof v === 'boolean',
  },
  offer: { summary: text },
  idea: {
    bullets: (value) => array(value, (item) => object(item) && text(item.id) && text(item.text), 1),
  },
  deferred: {
    mode: (value) => ['two-part', 'proof-of-concept'].includes(value),
    bullets: (value) => array(value, (item) => object(item) && text(item.id) && text(item.text))
      && new Set(value.map((item) => item.id)).size === value.length
      && new Set(value.map((item) => item.text)).size === value.length,
    locked: (value) => value === undefined || typeof value === 'boolean',
  },
  question: {
    fits: text,
    about_thread: (value) => value === undefined || (typeof value === 'string' && /^[0-9a-f]{12}$/.test(value)),
    question: text,
    options: (value) => (
      array(value, (item) => (
        object(item) && text(item.id) && text(item.label) && text(item.consequence)
      ), 2) && value.length <= 4
    ),
    leaning: text,
    why: text,
    progress: (value) => value === undefined || text(value),
    passes_on: (value) => value === undefined || text(value),
    doc: (value) => value === undefined || ['MAP.md', 'IDEA.md', 'PLAN.md'].includes(value),
  },
  reach: { thread: text, why: line },
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
    stage: (value) => value === undefined || ['build', 'review', 'verify'].includes(value),
    done: (value) => value === undefined || Number.isInteger(value),
    total: (value) => value === undefined || Number.isInteger(value),
    pass: (value) => value === undefined || (Number.isInteger(value) && value >= 1),
    phase: (value) => value === undefined || ['checking', 'fixing', 'clean'].includes(value),
    found: (value) => value === undefined || Number.isInteger(value),
    fixed: (value) => value === undefined || Number.isInteger(value),
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
    head: (value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value),
    note: (value) => value === undefined || text(value),
    verified: (value) => value === undefined || typeof value === 'boolean',
  },
  check: {
    head: (value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value),
    update: (value) => text(value) && value.length <= 300,
    steps: (value) => array(value, (step) => object(step)
      && Object.keys(step).every((key) => ['where', 'do', 'see', 'command', 'agent', 'note'].includes(key))
      && ['app', 'machine'].includes(step.where)
      && text(step.do) && step.do.length <= 300 && text(step.see) && step.see.length <= 300
      && (step.command === undefined || (step.where === 'machine' && text(step.command) && step.command.length <= 1000))
      && ['matched', 'not-tried', 'broken'].includes(step.agent)
      && (step.agent === 'matched' ? step.note === undefined
        : text(step.note) && step.note.length <= 300 && !/[\n\v\f\r\u0085\u2028\u2029]/.test(step.note)), 1) && value.length <= 6,
  },
  diagram: { plan: text, graph: text, title: text, format: (value) => value === undefined || ['graph', 'form', 'html', 'mockup'].includes(value), width: (value) => value === undefined || dimension(value), height: (value) => value === undefined || dimension(value) },
  image: { path: (value) => text(value) && path.isAbsolute(value), title: text, mockup: (value) => value === undefined || (object(value) && Object.keys(value).length === 3 && text(value.graph) && dimension(value.width) && dimension(value.height)) },
  file: { path: (value) => text(value) && path.isAbsolute(value), title: text },
  stub: {
    title: text,
    summary: text,
    depends_on_parent: (value) => typeof value === 'boolean',
    commits: (value) => value === undefined || array(value, text),
    adds_to: (value) => value === undefined || (typeof value === 'string' && /^[0-9a-f]{12}$/.test(value)),
    duplicate: (value) => value === undefined || typeof value === 'boolean',
  },
  sudo: sudoFields,
  title: { title: text },
  resolve: { card: text, note: text },
  retract: { card: text, note: (value) => text(value) && !/[\r\n]/.test(value) },
  message: { to: text, text, asks: (value) => value === undefined || typeof value === 'boolean', passes_on: (value) => value === undefined || text(value) },
  result: {
    task: text,
    outcome: (value) => ['done', 'blocked'].includes(value),
    summary: text,
    report: (value) => value === undefined || text(value),
    commit: (value) => value === undefined || text(value),
  },
};

const fileMachineFields = { ...fields.file, name: text, size: (value) => Number.isSafeInteger(value) && value >= 0 };

const approvalMachineFields = {
  ...fields.approval,
  warnings: (value) => value === undefined || (array(value, text, 1) && value.length <= 10),
};

// `options.machine` is true only where the hub accepts a card the machine service posted.
function validate(kind, card, role, options = {}) {
  if (!fields[kind]) return { ok: false, reason: `unknown card kind: ${kind}` };
  if (!object(card)) return { ok: false, reason: 'card must be one JSON object' };
  if (card.kind !== undefined && card.kind !== kind) {
    return { ok: false, reason: 'kind must equal the command-line kind' };
  }
  const spec = options.machine && kind === 'file' ? fileMachineFields
    : options.machine && kind === 'sudo' ? sudoMachineFields
    : options.machine && kind === 'approval' ? approvalMachineFields : fields[kind];
  const allowed = new Set([...Object.keys(spec), 'kind']);
  for (const key of Object.keys(card)) {
    if (!allowed.has(key)) return { ok: false, reason: `unknown field: ${key}` };
  }
  for (const [key, check] of Object.entries(spec)) {
    if (!check(card[key])) return { ok: false, reason: `invalid or missing field: ${key}` };
  }
  if (kind === 'diagram' && (card.format === 'mockup' ? !dimension(card.width) || !dimension(card.height) : card.width !== undefined || card.height !== undefined)) return { ok: false, reason: 'width and height are required only for mockup diagrams' };
  if (kind === 'stub' && card.duplicate !== undefined && card.adds_to === undefined) return { ok: false, reason: 'duplicate requires adds_to' };
  if (kind === 'stub' && card.adds_to !== undefined && (card.depends_on_parent || card.commits !== undefined)) return { ok: false, reason: "an addition can't depend on this thread's unmerged work; post your own stub" };
  if (kind === 'lesson' && ((card.action !== 'remove' && card.text === undefined) || (card.action !== 'add' && card.lesson === undefined) || (card.action === 'add' && card.lesson !== undefined) || (card.action === 'remove' && (card.text !== undefined || card.only_ai !== undefined || card.only_project !== undefined)))) return { ok: false, reason: 'invalid fields for lesson action' };
  if (kind === 'question' && !card.options.some((option) => option.id === card.leaning)) {
    return { ok: false, reason: 'leaning must name an option' };
  }
  if (kind === 'progress' && (card.done < 0 || card.total < card.done)) {
    return { ok: false, reason: 'progress counts are invalid' };
  }
  if (kind === 'progress') {
    const build = card.stage === undefined || card.stage === 'build';
    const required = build ? ['done', 'total'] : ['pass', 'phase'];
    const forbidden = build ? ['pass', 'phase', 'found', 'fixed'] : ['done', 'total'];
    if (!build && card.phase === 'fixing') required.push('found', 'fixed');
    else if (!build && (card.phase === 'checking' || card.stage === 'verify')) forbidden.push('found', 'fixed');
    else if (!build && card.phase === 'clean') {
      if (card.found !== undefined && card.fixed === undefined) required.push('fixed');
      if (card.fixed !== undefined && card.found === undefined) required.push('found');
    }
    for (const key of required) {
      if (card[key] === undefined) return { ok: false, reason: `invalid or missing field: ${key}` };
    }
    for (const key of forbidden) {
      if (card[key] !== undefined) return { ok: false, reason: `invalid or missing field: ${key}` };
    }
    if (card.found < 0 || card.fixed < 0 || card.fixed > card.found
        || (card.phase === 'fixing' && card.found < 1)
        || (card.phase === 'clean' && card.found !== undefined && card.fixed !== card.found)) {
      return { ok: false, reason: 'progress counts are invalid' };
    }
  }
  if (role && !roles[kind].includes(role)) {
    return { ok: false, reason: `${role} may not post ${kind}` };
  }
  return { ok: true, card: { ...card, kind } };
}

// Which card a resolve may close: an open needs card a lead posted in this thread, or, for a
// lead, an open question. The hub's own needs cards (system) close themselves or have their
// own button.
function blockingNeeds(thread, cardId) {
  return (thread.sessions || []).some((session) => session.live && session.needs_card === cardId && session.needs_open);
}

function resolvable(thread, cardId, mode) {
  const target = (thread.cards || []).find((item) => item.id === cardId && !item.replaced);
  if (!target) return { ok: false, reason: 'no such card in this thread' };
  if (target.kind !== 'needs' && !(mode === 'lead' && target.kind === 'question')) {
    return { ok: false, reason: mode === 'lead' ? 'only a needs or question card can be resolved' : 'only a needs card can be resolved' };
  }
  if (target.kind === 'needs' && target.system && !(target.auto_merge === true && mode !== 'lead')) return { ok: false, reason: 'a system needs card closes itself' };
  if (target.answered) return { ok: false, reason: 'card is already answered' };
  return { ok: true, card: target };
}

function retractable(thread, cardId) {
  const target = (thread.cards || []).find((item) => item.id === cardId && !item.replaced);
  if (!target) return { ok: false, reason: 'no such card in this thread' };
  if (!['question', 'offer', 'approval', 'needs', 'sudo', 'deferred', 'reach'].includes(target.kind)) {
    return { ok: false, reason: 'only a question, offer, approval, needs, sudo, deferred or reach card can be retracted' };
  }
  if (target.kind === 'needs' && target.system) return { ok: false, reason: 'a system needs card closes itself' };
  if (target.kind !== 'sudo' && target.answered) return { ok: false, reason: 'card is already answered' };
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
  if (kind === 'diagram' && card.format === 'mockup') {
    let top;
    try { top = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { top = process.cwd(); }
    const filePath = path.join(top, 'docs', 'plans', card.plan, 'graphs', `${card.graph}.html`);
    let stat;
    try { stat = fs.statSync(filePath); } catch { throw new Error('mockup file does not exist'); }
    if (!stat.isFile()) throw new Error('mockup file is not a regular file');
    if (stat.size > 2 * 1024 * 1024) throw new Error('mockup file exceeds 2 MiB');
  }
  const token = process.env.WHEELCHAIR_SESSION_TOKEN;
  if (!token) throw new Error('WHEELCHAIR_SESSION_TOKEN is required');
  // The service listens on its tailnet address only, and names it in each session's environment.
  const origin = process.env.WHEELCHAIR_MACHINE_ORIGIN || 'http://127.0.0.1:7374';
  const endpoint = process.env.WHEELCHAIR_MACHINE_URL || `${origin}/v1/agent/cards`;
  const result = await post(endpoint, token, checked.card);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`machine refused card (${result.status}): ${result.body}`);
  }
  const body = JSON.parse(result.body);
  const receipt = ['title', 'resolve', 'retract'].includes(kind) ? { ok: true } : { id: body.id, kind };
  // A lesson's receipt names the lesson, including a repeat the hub saved earlier (no new card id then).
  if (kind === 'lesson' && typeof body.lesson === 'string') receipt.lesson = body.lesson;
  if (body.spooled === true) receipt.queued = true;
  if (body.held === true) receipt.held = true;
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`card: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { blockingNeeds, fields, resolvable, retractable, roles, shown, truncateTitle, validate };
