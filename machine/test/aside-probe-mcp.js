'use strict';
const fs = require('fs');
const readline = require('readline');
const log = process.argv[2];
if (!log) throw new Error('log path required');
const record = line => fs.appendFileSync(log, line + '\n');
record('start');
readline.createInterface({ input: process.stdin }).on('line', line => {
  let message; try { message = JSON.parse(line); } catch { return; }
  if (message.method === 'tools/call') record('call ' + (message.params?.name || 'unknown'));
  if (message.id === undefined) return;
  let result = {};
  if (message.method === 'initialize') result = { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'probe', version: '1' } };
  if (message.method === 'tools/list') result = { tools: [{ name: 'probe_echo', description: 'Echo text', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }] };
  if (message.method === 'tools/call') result = { content: [{ type: 'text', text: message.params.arguments?.text || 'ok' }] };
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\n');
});
