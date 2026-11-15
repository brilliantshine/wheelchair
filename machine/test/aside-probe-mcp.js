'use strict';
const readline = require('readline');
readline.createInterface({ input: process.stdin }).on('line', line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return;
  let result = {};
  if (m.method === 'initialize') result = { protocolVersion: m.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'probe', version: '1' } };
  if (m.method === 'tools/list') result = { tools: [{ name: 'probe_echo', description: 'Echo text', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }] };
  if (m.method === 'tools/call') result = { content: [{ type: 'text', text: m.params.arguments?.text || 'ok' }] };
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }) + '\n');
});
