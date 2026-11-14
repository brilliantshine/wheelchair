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
  let event;
  if (kind === 'claude') {
    if (raw.hook_event_name === 'Stop') event = { type: 'turn-ended', transcript_path: raw.transcript_path, payload: raw };
    else if (raw.hook_event_name === 'Notification' && raw.notification_type === 'permission_prompt') event = { type: 'prompt', notification_type: raw.notification_type, payload: raw };
    else return;
  } else {
    if (raw.type !== 'agent-turn-complete') return;
    // Codex's own payload carries type: 'agent-turn-complete'; ours must win.
    event = { ...raw, type: 'turn-ended' };
  }
  const config = JSON.parse(await fs.readFile(path.join(state, 'machine.json'), 'utf8'));
  const body = JSON.stringify(event);
  const posted = await new Promise(resolve => {
    const request = http.request({ host: config.host, port: config.port, method: 'POST', path: '/v1/agent/hooks', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), 'x-wheelchair-session-token': token } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode >= 200 && response.statusCode < 300)); });
    request.on('error', () => resolve(false)); request.end(body);
  });
  if (posted) return;
  const directory = path.join(state, 'spool', 'events');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = `${String(Date.now()).padStart(15, '0')}-${crypto.randomUUID()}.json`;
  const temporary = path.join(directory, `.${filename}.tmp`);
  await fs.writeFile(temporary, JSON.stringify({ ...event, session }) + '\n', { mode: 0o600 });
  await fs.rename(temporary, path.join(directory, filename));
}
main().catch(() => { process.exitCode = 0; });
