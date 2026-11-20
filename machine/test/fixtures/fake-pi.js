#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { pathToFileURL } = require('node:url');
(async () => {
  const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
  const dir = process.env.PI_CODING_AGENT_DIR || path.join(require('node:os').homedir(), '.pi/agent');
  const file = path.join(dir, 'sessions', 'fake-work', `2026-01-01_${value('--session-id')}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ type: 'session', id: value('--session-id') }) + '\n');
  const handlers = {}, entries = [];
  (await import(pathToFileURL(value('-e')).href)).default({ on: (name, handler) => { handlers[name] = handler; } });
  const ctx = { sessionManager: { getEntries: () => entries } };
  console.log('escape interrupt · ctrl+c/ctrl+d clear/exit · / commands\n│  │\nopenrouter/auto • medium');
  for await (const line of readline.createInterface({ input: process.stdin })) {
    entries.push({ type: 'message', id: `u${entries.length}`, message: { role: 'user', content: line } });
    await handlers.tool_execution_start({ toolCallId: 'tool', toolName: 'read', args: { path: 'file' } }, ctx);
    await handlers.tool_execution_end({ toolCallId: 'tool', toolName: 'read', isError: false }, ctx);
    const reply = { type: 'message', id: `a${entries.length}`, message: { role: 'assistant', stopReason: 'stop' } }; entries.push(reply);
    fs.appendFileSync(file, entries.slice(-2).map(row => JSON.stringify(row)).join('\n') + '\n');
    await handlers.agent_settled({ aborted: false }, ctx);
  }
})();
