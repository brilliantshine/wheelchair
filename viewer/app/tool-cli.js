'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { NAME_RE, RESERVED, discover } = require('../../machine/lib/folder-tools');
const { toolEnv, runScript, installExitHandlers } = require('../../machine/lib/tool-run');
const { handshake } = require('../../machine/lib/mcp-stdio');

async function roots(request) {
  const token = process.env.WHEELCHAIR_SESSION_TOKEN;
  if (!token) {
    try { return { worktree: execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(), shared: null, keyed_unavailable: null }; }
    catch { throw new Error('not inside a git checkout'); }
  }
  const origin = process.env.WHEELCHAIR_MACHINE_ORIGIN || 'http://127.0.0.1:7374';
  const base = process.env.WHEELCHAIR_MACHINE_URL || `${origin}/v1/agent`;
  const response = await request(`${base}/tools`, token, {});
  if (response.status < 200 || response.status >= 300) throw new Error(response.output || `machine request failed (${response.status})`);
  const value = JSON.parse(response.output);
  if (typeof value.worktree !== 'string' || !(value.shared_copy === null || typeof value.shared_copy === 'string')) throw new Error('invalid machine tools response');
  return { worktree: value.worktree, shared: value.shared_copy, keyed_unavailable: value.keyed_unavailable ?? null };
}
async function main(args, io = {}) {
  const out = io.stdout || process.stdout;
  const [command, ...tail] = args;
  const override = Number(process.env.WHEELCHAIR_TOOL_CHECK_DEADLINE_MS);
  const deadline = Date.now() + (Number.isFinite(override) && override > 0 ? override : 30000);
  if (!['new', 'list', 'check', 'run'].includes(command)) throw new Error('usage: wc.js tool <new|list|check|run>');
  const { worktree, shared, keyed_unavailable } = await roots(io.request);
  if (command === 'new') {
    const [name, flag, kind] = tail;
    if (tail.length !== 3 || flag !== '--kind' || !['script', 'server'].includes(kind)) throw new Error('usage: wc.js tool new <name> --kind script|server');
    if (!NAME_RE.test(name || '') || name === RESERVED) throw new Error('invalid or reserved tool name');
    const dest = path.join(worktree, '.wheelchair', 'tools', name);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    try { await fs.promises.mkdir(dest); } catch (e) { if (e.code === 'EEXIST') throw new Error(`tool folder already exists: ${dest}`); throw e; }
    const template = path.join(__dirname, '../../machine/templates/tools', kind);
    for (const file of await fs.promises.readdir(template)) {
      const source = path.join(template, file), content = (await fs.promises.readFile(source, 'utf8')).replaceAll('__NAME__', name);
      await fs.promises.writeFile(path.join(dest, file), content, { mode: (await fs.promises.stat(source)).mode });
    }
    if (kind === 'server') await fs.promises.copyFile(path.join(__dirname, '../../machine/lib/mcp-stdio.js'), path.join(dest, 'mcp-stdio.js'));
    out.write(`${dest}\nNext: wc.js tool check ${name}\n`); return;
  }
  const found = await discover({ worktree, shared, path: process.env.PATH });
  if (command === 'list') {
    if (tail.length && (tail.length !== 1 || tail[0] !== '--json')) throw new Error('usage: wc.js tool list [--json]');
    const token = process.env.WHEELCHAIR_SESSION_TOKEN;
    let statuses = [], error = null;
    if (token && found.rows.some(row => row.tool?.keys.length)) {
      try {
        const origin = process.env.WHEELCHAIR_MACHINE_ORIGIN || 'http://127.0.0.1:7374';
        const base = process.env.WHEELCHAIR_MACHINE_URL || `${origin}/v1/agent`;
        const response = await io.request(`${base}/tool-keys`, token, {});
        if (response.status < 200 || response.status >= 300) throw new Error(response.output || `machine request failed (${response.status})`);
        const value = JSON.parse(response.output);
        if (!Array.isArray(value.tools)) throw new Error('invalid machine tool keys response');
        statuses = value.tools;
      } catch (e) { error = e.message; }
    }
    const rows = found.rows.map(row => {
      const status = statuses.find(item => item.name === row.name && item.source === row.source) || null;
      return { ...row, key_status: status, ...(row.tool?.keys.length ? { keyed_unavailable } : {}) };
    });
    if (tail.length) out.write(`${JSON.stringify(rows)}\n`);
    else for (const row of rows) {
      let suffix = '';
      if (row.tool?.keys.length) {
        if (keyed_unavailable) suffix = `needs keys, which ${keyed_unavailable}`;
        else if (!token) suffix = `keys: ${row.tool.keys.join(', ')} (key status unknown outside a session)`;
        else if (error || !row.key_status) suffix = `key status unavailable: ${error || 'tool missing from machine response'}`;
        else suffix = `keys: ${row.key_status.keys.map(key => `${key.name} ${key.set ? 'set' : key.reason && key.reason !== 'not set on this machine' ? key.reason : 'not set'}`).join(', ')}`;
      }
      out.write(`${row.name}\t${row.kind || '-'}\t${row.source}\t${row.status === 'ok' ? 'ok' : row.reason}${suffix ? `\t${suffix}` : ''}\n`);
    }
    return;
  }
  if (command === 'check') {
    if (tail.length > 1 || tail[0]?.startsWith('-')) throw new Error('usage: wc.js tool check [<name>]');
    const rows = tail.length ? found.rows.filter(row => row.name === tail[0] && row.status !== 'hidden') : found.rows;
    if (tail.length && !rows.length) throw new Error(`unknown tool: ${tail[0]}`);
    const controller = new AbortController();
    const abort = () => controller.abort();
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
    const handlers = new Map(signals.map(sig => [sig, () => { abort(); process.removeListener(sig, handlers.get(sig)); process.kill(process.pid, sig); }]));
    process.on('exit', abort);
    for (const sig of signals) process.on(sig, handlers.get(sig));
    const timer = setTimeout(abort, Math.max(0, deadline - Date.now()));
    let failed = false;
    try {
      for (const row of rows) {
        if (row.status !== 'ok') { out.write(`${row.name}: ${row.reason}\n`); failed = true; continue; }
        if (row.kind !== 'server') { out.write(`${row.name}: ok${row.tool.keys.length ? ' (validated without using keys)' : ''}\n`); continue; }
        const remaining = deadline - Date.now();
        if (remaining <= 0) { out.write(`${row.name}: check deadline exceeded\n`); failed = true; continue; }
        const [program, ...argv] = row.tool.start;
        const result = await handshake({ command: program.includes('/') ? path.resolve(row.dir, program) : program, args: argv, cwd: row.dir, env: toolEnv(process.env, worktree), timeoutMs: remaining, signal: controller.signal });
        if (!result.ok) { out.write(`${row.name}: ${result.error}\n`); failed = true; }
        else out.write(`${row.name}: ${result.serverInfo?.name || '(unnamed server)'}${result.tools === null ? '' : ` tools: ${result.tools.join(', ')}`}\n`);
      }
    } finally {
      clearTimeout(timer);
      process.removeListener('exit', abort);
      for (const sig of signals) process.removeListener(sig, handlers.get(sig));
    }
    if (failed) throw new Error('tool check failed');
    return;
  }
  const [name, flag, raw] = tail;
  if (!name || (tail.length !== 1 && (tail.length !== 3 || flag !== '--input'))) throw new Error('usage: wc.js tool run <name> [--input <json>]');
  let input; try { input = raw === undefined ? {} : JSON.parse(raw); } catch { throw new Error('--input must be a JSON object'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('--input must be a JSON object');
  const row = found.rows.find(r => r.name === name && r.status !== 'hidden');
  if (!row) throw new Error(`unknown tool: ${name}`);
  if (row.status !== 'ok') throw new Error(`${name}: ${row.reason}`);
  if (row.kind !== 'script') throw new Error('server tools must be used through MCP or check');
  if (row.tool.keys.length) out.write('Ran without folder-tool keys; variables already in your environment were passed as usual. Keyed tools get their keys through MCP, from the next call in a session that offered them.\n');
  installExitHandlers();
  const result = await runScript({ dir: row.dir, tool: row.tool, input, env: toolEnv(process.env, worktree) });
  if (!result.ok) throw new Error(`tool failed (exit code ${result.code}, signal ${result.signal}${result.timedOut ? ', timed out' : ''})${result.stderr ? `: ${result.stderr}` : ''}`);
  out.write(result.text);
}
module.exports = { main };
