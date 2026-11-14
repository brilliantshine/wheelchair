#!/usr/bin/env node
'use strict';

// Spec "Machine service on the hub": agent git and session requests via the local service.
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');

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
    if (!args[index].startsWith('--')) output._.push(args[index]);
    else output[args[index].slice(2)] = args[++index];
  }
  return output;
}

function gitRequest(operation, tail) {
  const operations = ['fetch', 'commit', 'merge', 'cherry-pick', 'revert', 'push', 'pr'];
  if (!operations.includes(operation)) throw new Error('unsupported git operation');
  const parsed = flags(tail);
  const paths = parsed.paths ? String(parsed.paths).split(',').filter(Boolean) : [];
  if (operation === 'commit' && !paths.length) throw new Error('commit requires --paths');
  return {
    path: '/git',
    body: { operation, args: parsed._, paths, message: parsed.message },
  };
}

function sessionRequest(operation, tail) {
  if (!['start', 'stop', 'list'].includes(operation)) {
    throw new Error('unsupported session operation');
  }
  const parsed = flags(tail);
  if (operation !== 'start') return { path: '/session', body: { action: operation, name: parsed._[0] } };
  if (!parsed.role || !parsed.cli || !parsed.attempt || !parsed['brief-file']) {
    throw new Error('start requires --role --cli --brief-file --attempt');
  }
  return {
    path: '/session',
    body: {
      action: operation,
      role: parsed.role,
      cli: parsed.cli,
      tier: parsed.tier || 'top',
      attempt_id: parsed.attempt,
      brief: fs.readFileSync(parsed['brief-file'], 'utf8'),
    },
  };
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
  const token = process.env.WHEELCHAIR_SESSION_TOKEN;
  if (!token) throw new Error('WHEELCHAIR_SESSION_TOKEN is required');
  const base = process.env.WHEELCHAIR_MACHINE_URL || 'http://127.0.0.1:7374/v1/agent';
  const input = group === 'git'
    ? gitRequest(operation, tail)
    : group === 'session'
      ? sessionRequest(operation, tail)
      : null;
  if (!input) throw new Error('usage: wc.js git|session …');
  const result = group === 'session'
    ? await postSessionWithRetry(`${base}${input.path}`, token, input.body)
    : await request(`${base}${input.path}`, token, input.body);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.status === 503 ? 'hub unavailable' : result.output);
  }
  process.stdout.write(`${result.output}\n`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`wc: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { flags, gitRequest, sessionRequest };
