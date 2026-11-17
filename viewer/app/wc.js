#!/usr/bin/env node
'use strict';

// Spec "Machine service on the hub": agent git and session requests via the local service.
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { execFileSync } = require('node:child_process');

const RETRY_MS = 90_000;
const RETRY_DELAY_MS = 1_000;

function request(urlText, token, body) {
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
        response.on('end', () => resolve({ status: response.statusCode, output }));
      },
    );
    request.on('error', reject);
    request.end(payload);
  });
}

function flags(args) {
  const output = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '-m') output.message = args[++index];
    else if (!args[index].startsWith('--')) output._.push(args[index]);
    else output[args[index].slice(2)] = args[++index];
  }
  return output;
}

function gitRequest(operation, tail) {
  const operations = ['fetch', 'commit', 'merge', 'cherry-pick', 'revert', 'push', 'pr', 'worktree-remove'];
  if (!operations.includes(operation)) throw new Error('unsupported git operation');
  const parsed = flags(tail);
  const paths = parsed.paths ? String(parsed.paths).split(',').filter(Boolean) : [];
  if (operation === 'commit' && !paths.length) throw new Error('commit requires --paths');
  if (operation === 'commit' && !parsed.message) throw new Error('commit requires --message (or -m)');
  const commitArgs = [];
  if (operation === 'commit') {
    for (let index = 0; index < tail.length; index += 1) {
      if (tail[index] === '--paths') { index += 1; continue; }
      if (tail[index] === '-m' || tail[index] === '--message') { index += 1; continue; }
      commitArgs.push(tail[index]);
    }
  }
  return {
    path: '/git',
    // Git and gh own their flags.  Only commit's local --paths/-m controls are consumed here.
    body: { operation, args: operation === 'commit' ? commitArgs : tail, paths, message: parsed.message },
  };
}

function sessionRequest(operation, tail) {
  if (!['start', 'stop', 'list'].includes(operation)) {
    throw new Error('unsupported session operation');
  }
  const parsed = flags(tail);
  if (operation !== 'start') return { path: '/session', body: { action: operation, name: parsed._[0] } };
  if (!parsed.role || !parsed.attempt || !parsed['brief-file']) {
    throw new Error('start requires --role --brief-file --attempt');
  }
  if (parsed.cli) process.stderr.write('--cli is ignored: the hub picks the provider\n');
  return {
    path: '/session',
    body: {
      action: operation,
      role: parsed.role,
      provider: parsed.provider,
      not_provider: parsed['not-provider'],
      tier: parsed.tier || 'top',
      ...(parsed.effort !== undefined ? { effort: parsed.effort } : {}),
      attempt_id: parsed.attempt,
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      brief: fs.readFileSync(parsed['brief-file'], 'utf8'),
      replaces: parsed.replaces,
    },
  };
}

const compactFields = ['name', 'role', 'provider', 'model', 'status', 'live', 'ready', 'started_by', 'attempt_id', 'title', 'branch', 'worktree'];
function compact(session) {
  return Object.fromEntries(compactFields.filter(key => Object.hasOwn(session, key)).map(key => [key, session[key]]));
}

function diffSize(operation, args) {
  if (operation !== 'size' || args.length < 2 || args.length > 3 || args[0].startsWith('-') || args[1].startsWith('-') || (args.length === 3 && args[2] !== '--tricky')) throw new Error('usage: wc.js diff size <feature-branch> <worker-branch> [--tricky]');
  const git = (...argv) => execFileSync('git', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let top, numstat, names;
  const range = `${args[0]}...${args[1]}`;
  try {
    top = git('rev-parse', '--show-toplevel').trimEnd();
    numstat = git('-C', top, 'diff', '--numstat', range, '--', '.', ':(exclude)docs/plans');
    names = git('-C', top, '-c', 'diff.renames=false', 'diff', '--name-status', '-z', '--find-renames', range);
  } catch (error) { throw new Error(`git failed: ${String(error.stderr || error.message).trim()}`); }
  const lines = numstat.split('\n').reduce((sum, line) => {
    const [added, removed] = line.split('\t');
    return sum + (Number(added) || 0) + (Number(removed) || 0);
  }, 0);
  const tokens = names.split('\0');
  const excluded_paths = [];
  const excluded = path => path === 'docs/plans' || path.startsWith('docs/plans/');
  for (let i = 0; i < tokens.length - 1;) {
    const status = tokens[i++];
    const first = tokens[i++];
    const renamed = /^[RC]/.test(status);
    const old = renamed ? first : null;
    const next = renamed ? tokens[i++] : first;
    if (excluded(next) || (old !== null && excluded(old))) excluded_paths.push({ status, old, new: next });
  }
  const quote = value => `'${value.replace(/'/g, "'\\''")}'`;
  const branch = value => /^[A-Za-z0-9._/@-]+$/.test(value) ? value : quote(value);
  return { lines, band: args[2] === '--tricky' || lines > 800 ? 'self' : lines < 200 ? 'scout' : 'bigger-scout', excluded_paths, scout_diff: `git -C ${quote(top)} diff ${branch(args[0])}...${branch(args[1])} -- . ':(exclude)docs/plans'` };
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function postSessionWithRetry(url, token, body) {
  const deadline = Date.now() + RETRY_MS;
  while (true) {
    try {
      const result = await request(url, token, body);
      if (result.status !== 503) return result;
    } catch {
      // The specified error is shared by a stopped local service and an unavailable hub.
    }
    if (Date.now() >= deadline) throw new Error('hub unavailable');
    await wait(Math.min(RETRY_DELAY_MS, deadline - Date.now()));
  }
}

async function main(argv) {
  const [group, operation, ...tail] = argv;
  if (group === 'diff') { process.stdout.write(`${JSON.stringify(diffSize(operation, tail))}\n`); return; }
  const full = group === 'session' && ['start', 'list'].includes(operation) && tail.includes('--full');
  const requestTail = full ? tail.filter(arg => arg !== '--full') : tail;
  const token = process.env.WHEELCHAIR_SESSION_TOKEN;
  if (!token) throw new Error('WHEELCHAIR_SESSION_TOKEN is required');
  // The service listens on its tailnet address only, and names it in each session's environment.
  const origin = process.env.WHEELCHAIR_MACHINE_ORIGIN || 'http://127.0.0.1:7374';
  const base = process.env.WHEELCHAIR_MACHINE_URL || `${origin}/v1/agent`;
  const input = group === 'git'
    ? gitRequest(operation, tail)
    : group === 'session'
      ? sessionRequest(operation, requestTail)
      : null;
  if (!input) throw new Error('usage: wc.js git|session …');
  const result = group === 'session'
    ? await postSessionWithRetry(`${base}${input.path}`, token, input.body)
    : await request(`${base}${input.path}`, token, input.body);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.status === 503 ? 'hub unavailable' : result.output);
  }
  if (group === 'session' && operation === 'start') {
    const response = JSON.parse(result.output);
    if (response.note) process.stderr.write(`${response.note}\n`);
    if (response.session?.status === 'waiting') process.stdout.write(`waiting for room until ${response.session.waiting_until}\n`);
  }
  if (group === 'session' && !full && ['start', 'list'].includes(operation)) {
    const response = JSON.parse(result.output);
    const output = operation === 'list'
      ? { sessions: response.sessions.map(compact), review_families: response.review_families }
      : { session: compact(response.session), ...(Object.hasOwn(response, 'note') ? { note: response.note } : {}) };
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } else process.stdout.write(`${result.output}\n`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`wc: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { flags, gitRequest, sessionRequest };
