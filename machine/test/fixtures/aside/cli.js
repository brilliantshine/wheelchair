#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2), cli = path.basename(process.argv[1]);
let input = ''; process.stdin.on('data', x => input += x); process.stdin.on('end', () => {
  fs.appendFileSync(process.env.ASIDE_LOG, JSON.stringify({ cli, args, input, marker: process.env.WHEELCHAIR_ASIDE_TURN, before: JSON.parse(fs.readFileSync(process.env.ASIDE_STORE, 'utf8')) }) + '\n');
  if (args[0] === 'mcp') { if (process.env.ASIDE_MCP_FAIL) { console.error('mcp failed'); process.exitCode = 1; } else console.log(JSON.stringify([{ name: 'linear' }, { name: 'probe' }])); return; }
  if (input.includes('WAIT')) return setInterval(() => {}, 1000);
  if (input.includes('FAIL')) { console.error('last failure'); process.exitCode = 1; return; }
  if (cli === 'claude') console.log(JSON.stringify(input.includes('LIMIT') ? { is_error: true, result: 'rate_limit' } : { is_error: false, result: 'claude reply' }));
  else { console.log(JSON.stringify({ type: 'thread.started', thread_id: 'codex-id' })); console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'codex reply' } })); if (input.includes('LIMIT')) { console.log(JSON.stringify({ type: 'error', message: 'usage limit' })); process.exitCode = 1; } }
});
