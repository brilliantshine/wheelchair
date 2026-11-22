'use strict';
const fs = require('node:fs');
const readline = require('node:readline');
const record = process.env.RECORD;
function log(value) { if (record) fs.appendFileSync(record, JSON.stringify(value) + '\n'); }
log({ env: { token: process.env.WHEELCHAIR_SESSION_TOKEN, copy: process.env.WHEELCHAIR_WINDOWS_PROJECT, wslenv: process.env.WSLENV } });
if (process.env.IGNORE_TERM) process.on('SIGTERM', () => log({ signal: 'SIGTERM' }));
process.stdin.on('end', () => { log({ event: 'stdin-end' }); if (process.env.IGNORE_END) setInterval(() => {}, 1000); });
function send(value) { process.stdout.write(JSON.stringify(value) + '\n'); }
readline.createInterface({ input: process.stdin }).on('line', line => {
  let msg; try { msg = JSON.parse(line); } catch { process.stdout.write(line + '\n'); return; }
  log(msg);
  if (msg.method === 'initialize') {
    if (process.env.INIT === 'exit') return process.exit(0);
    if (process.env.INIT === 'absent') return;
    return setTimeout(() => send(process.env.INIT === 'fail' ? { jsonrpc: '2.0', id: msg.id, error: { code: -1, message: 'bad' } } : { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: msg.params.protocolVersion } }), Number(process.env.DELAY || 0));
  }
  if (msg.method === 'die') return process.exit(9);
  if (msg.method === 'signal') return process.kill(process.pid, 'SIGTERM');
  if (msg.method === 'tools/list') {
    const cursor = msg.params && msg.params.cursor;
    if (cursor && process.env.FAIL_PAGE) return send({ jsonrpc: '2.0', id: msg.id, error: { code: -1, message: 'bad page' } });
    return send({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: cursor || 'first' }], ...(process.env.PAGES && !cursor ? { nextCursor: 'second' } : {}) } });
  }
  if (msg.method === 'tools/call' || msg.method === 'ping' || msg.method === 'large' || msg.method === 'exit') {
    send({ jsonrpc: '2.0', id: msg.id, result: msg.method === 'large' ? 'x'.repeat(1024 * 1024) : { ok: true } });
    if (msg.method === 'exit' || msg.method === 'large') process.exitCode = 7, process.stdin.destroy();
  }
});
