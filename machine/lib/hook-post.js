#!/usr/bin/env node
'use strict';

// Kept standalone so a hook can spool while machine/service.js is not running.
const fs = require('node:fs/promises');
const http = require('node:http');
const crypto = require('node:crypto');
const path = require('node:path');

async function main() {
  const [state, token, kind, session] = process.argv.slice(2);
  const text = await new Promise(resolve => { let value = ''; process.stdin.on('data', chunk => { value += chunk; }); process.stdin.on('end', () => resolve(value)); });
  let raw;
  try { raw = JSON.parse(text); } catch { process.exitCode = 0; return; }
  const connectors = require('../../connectors');
  const adapter = connectors.manifest(kind) && connectors.machine(kind);
  const event = adapter?.hookEvent(raw);
  if (!event) return;
  const config = await fs.readFile(path.join(state, 'machine.json'), 'utf8').then(JSON.parse).catch(() => ({}));
  for (const item of Array.isArray(event) ? event : [event]) {
  const body = JSON.stringify(item);
  const posted = await new Promise(resolve => {
    const request = http.request({ host: config.host, port: config.port, method: 'POST', path: '/v1/agent/hooks', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), 'x-wheelchair-session-token': token } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode >= 200 && response.statusCode < 300)); });
    request.on('error', () => resolve(false)); request.end(body);
  });
  if (posted) continue;
  const directory = path.join(state, 'spool', 'events');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = `${String(Date.now()).padStart(15, '0')}-${crypto.randomUUID()}.json`;
  const temporary = path.join(directory, `.${filename}.tmp`);
  await fs.writeFile(temporary, JSON.stringify({ ...item, session }) + '\n', { mode: 0o600 });
  await fs.rename(temporary, path.join(directory, filename));
  }
}
main().catch(() => { process.exitCode = 0; });
