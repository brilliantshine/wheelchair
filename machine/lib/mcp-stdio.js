'use strict';
const readline = require('readline');
const { spawn } = require('child_process');
function serve({ name, version, tools, onClose }) {
  const line = readline.createInterface({ input: process.stdin });
  const send = value => process.stdout.write(JSON.stringify(value) + '\n');
  line.on('line', async raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.method !== 'string') return;
    if (msg.id === undefined) return;
    const reply = result => send({ jsonrpc: '2.0', id: msg.id, result });
    try {
      const list = () => typeof tools === 'function' ? tools() : tools;
      if (msg.method === 'initialize') reply({ protocolVersion: typeof msg.params?.protocolVersion === 'string' ? msg.params.protocolVersion : '2025-06-18', capabilities: { tools: {} }, serverInfo: { name, version } });
      else if (msg.method === 'ping') reply({});
      else if (msg.method === 'tools/list') reply({ tools: list().map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      else if (msg.method === 'tools/call') { const tool = list().find(t => t.name === msg.params?.name); if (!tool) throw new Error('Tool not found'); const result = await tool.call(msg.params?.arguments || {}); reply({ content: [{ type: 'text', text: result.text }], isError: !!result.isError }); }
      else send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } });
    } catch (e) { send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e.message } }); }
  });
  line.on('close', () => { if (onClose) onClose(); });
}
function handshake({ command, args = [], cwd, env, timeoutMs, signal }) {
  return new Promise(resolve => {
    let child, done = false, serverInfo = null, buffer = '', stage = 0;
    const finish = (ok, tools, error) => { if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); if (child?.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} const reaper = spawn(process.execPath, ['-e', "setTimeout(() => { try { process.kill(-Number(process.argv[1]), 'SIGKILL'); } catch {} }, 5000)", String(child.pid)], { detached: true, stdio: 'ignore' }); reaper.on('error', () => {}); reaper.unref(); } resolve({ ok, serverInfo, tools, error }); };
    const timer = setTimeout(() => finish(false, null, 'Server handshake timed out'), timeoutMs);
    const cancel = () => { serverInfo = null; finish(false, null, 'cancelled'); };
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    try { child = spawn(command, args, { cwd, env, detached: true, stdio: ['pipe','pipe','pipe'] }); } catch (e) { finish(false, null, e.message); return; }
    child.stderr.resume(); child.stdin.on('error', () => {}); child.on('error', e => finish(false, null, e.message)); child.on('exit', () => finish(false, null, 'Server exited during handshake'));
    const send = x => child.stdin.write(JSON.stringify(x) + '\n');
    child.stdout.on('data', b => { buffer += b.toString(); let pos; while ((pos = buffer.indexOf('\n')) >= 0) { const raw = buffer.slice(0,pos); buffer = buffer.slice(pos+1); let msg; try { msg = JSON.parse(raw); } catch { continue; } if (msg.error) { finish(false, null, msg.error.message || 'Server error'); return; } if (stage === 0 && msg.id === 1) { if (!msg.result) { finish(false, null, 'Invalid initialize response'); return; } serverInfo = msg.result.serverInfo || null; send({ jsonrpc:'2.0', method:'notifications/initialized' }); if (msg.result.capabilities?.tools) { stage = 1; send({ jsonrpc:'2.0', id:2, method:'tools/list' }); } else finish(true, null, null); } else if (stage === 1 && msg.id === 2) { if (!Array.isArray(msg.result?.tools)) finish(false, null, 'Invalid tools/list response'); else finish(true, msg.result.tools.map(t => t.name), null); } } });
    send({ jsonrpc:'2.0', id:1, method:'initialize', params:{ protocolVersion:'2025-06-18', capabilities:{}, clientInfo:{ name:'wheelchair', version:'1' } } });
  });
}
module.exports = { serve, handshake };
