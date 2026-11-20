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
  const downloadMode = /^\d+$/.test(process.env.FAKE_PI_DOWNLOAD_MS || '');
  let downloading = downloadMode, pending = null;
  if (downloadMode) {
    console.log('fd not found. Downloading...');
    setTimeout(() => { downloading = false; console.log('fd installed to /tmp/fake/fd'); fs.appendFileSync(`${file}.events`, 'download-done\n'); }, Number(process.env.FAKE_PI_DOWNLOAD_MS));
  }
  console.log('escape interrupt · ctrl+c/ctrl+d clear/exit · / commands\n──────\n      \n──────\nopenrouter/auto • medium');
  for await (let line of readline.createInterface({ input: process.stdin })) {
    if (downloadMode) fs.appendFileSync(`${file}.events`, `line:${line}\n`);
    if (downloading) { if (line.trim()) { pending = line; console.log('Startup is still in progress'); } continue; }
    if (downloadMode && !line.trim()) { if (pending === null) continue; line = pending; pending = null; }
    entries.push({ type: 'message', id: `u${entries.length}`, message: { role: 'user', content: line === 'hello' ? 'sk-or-v1-0000synthetic0000' : line } });
    await handlers.tool_execution_start({ toolCallId: 'tool', toolName: 'read', args: { path: 'file' } }, ctx);
    await handlers.tool_execution_end({ toolCallId: 'tool', toolName: 'read', isError: false }, ctx);
    if (line === 'abort') { await handlers.agent_settled({ aborted: true }, ctx); continue; }
    const reply = { type: 'message', id: `a${entries.length}`, message: { role: 'assistant', stopReason: 'stop' } }; entries.push(reply);
    fs.appendFileSync(file, entries.slice(-2).map(row => JSON.stringify(row)).join('\n') + '\n');
    await handlers.agent_settled({ aborted: false }, ctx);
  }
})();
