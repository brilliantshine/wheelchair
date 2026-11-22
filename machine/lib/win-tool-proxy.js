'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const argv = process.argv.slice(2);
const options = { '--hold-ms': '50000', '--poll-ms': '2000', '--init-ms': '60000', '--stop-ms': '2000,3000,1000' };
let i = 0;
while (i < argv.length && argv[i] !== '--') {
  const key = argv[i++];
  if (!['--ready-file', '--list-cache', '--name', '--hold-ms', '--poll-ms', '--init-ms', '--stop-ms'].includes(key) || i === argv.length || argv[i] === '--') {
    console.error('Invalid proxy option'); process.exit(2);
  }
  options[key] = argv[i++];
}
if (argv[i] !== '--' || !argv[i + 1] || !options['--ready-file'] || !options['--list-cache'] || !options['--name'] || !/^\d+$/.test(options['--hold-ms']) || !/^\d+$/.test(options['--poll-ms']) || !/^\d+$/.test(options['--init-ms']) || !/^\d+,\d+,\d+$/.test(options['--stop-ms'])) {
  console.error('Invalid proxy arguments'); process.exit(2);
}
const command = argv[i + 1], args = argv.slice(i + 2);
const stopTimes = options['--stop-ms'].split(',').map(Number);
let child, state = 'waiting', ready = {}, mode = 'standin', initialized = false, initParams, initId;
let held = [], queue = [], probe, initTimer, stopping = false, finishing = false, stdoutDead = false, writes = 0, finishStatus;
let cache = [];
try { const value = JSON.parse(fs.readFileSync(options['--list-cache'], 'utf8')); if (Array.isArray(value.tools)) cache = value.tools; } catch {}
function finish(status) {
  if (finishing) return;
  finishing = true; finishStatus = status;
  if (stdoutDead || writes === 0) process.exit(status);
}
function output(line) {
  if (stdoutDead || finishing) return;
  writes++;
  process.stdout.write(line + '\n', () => { writes--; if (finishing && writes === 0) process.exit(finishStatus); });
}
function send(obj) { output(JSON.stringify(obj)); }
function stdoutLost() { stdoutDead = true; if (finishing) process.exit(finishStatus); shutdown(); }
process.stdout.on('error', stdoutLost);
process.stdout.on('close', stdoutLost);
function sentence() { return state === 'failed' ? `The Windows project copy couldn't be readied: ${ready.reason || ''}. Run \`wc.js win sync\` to retry.` : "Waiting for the Windows project copy to be ready; this tool's tools work once it is."; }
function replyError(msg, reason) { if (Object.hasOwn(msg, 'id')) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: reason } }); }
function parse(line) { try { return JSON.parse(line); } catch { return null; } }
function forward(line) { if (child && !child.stdin.destroyed) child.stdin.write(line + '\n'); }
function removeItem(item) { held = held.filter(x => x !== item); queue = queue.filter(x => x !== item); clearTimeout(item.timer); }
function makeItem(line, msg) {
  const item = { line, msg };
  if (msg && msg.method === 'tools/call' && Object.hasOwn(msg, 'id')) item.timer = setTimeout(() => { removeItem(item); replyError(msg, 'The Windows project copy is not ready yet; try again shortly.'); }, Number(options['--hold-ms']));
  return item;
}
function cancel(id) { let found = false; for (const item of [...held, ...queue]) if (item.msg && item.msg.id === id && Object.hasOwn(item.msg, 'id')) { removeItem(item); found = true; } return found; }
function stopTool() {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    let done = false, timer;
    const end = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
    child.once('exit', end);
    child.stdin.end();
    timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch {} timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} timer = setTimeout(end, stopTimes[2]); }, stopTimes[1]); }, stopTimes[0]);
  });
}
async function shutdown() { if (stopping || finishing) return; stopping = true; await stopTool(); finish(0); }
for (const sig of ['SIGHUP', 'SIGTERM', 'SIGINT']) process.on(sig, shutdown);
process.stdin.on('error', shutdown);
process.stdin.on('end', shutdown);
function failure(reason) {
  if (stopping || finishing) return;
  stopping = true; clearTimeout(initTimer); console.error(reason);
  for (const item of [...held, ...queue]) { clearTimeout(item.timer); if (item.msg) replyError(item.msg, reason); }
  held = []; queue = [];
  stopTool().then(() => finish(1));
}
function probeNext(cursor) {
  const id = 'wc-go-between-list-' + crypto.randomUUID();
  probe.id = id; probe.pages++;
  const request = { jsonrpc: '2.0', id, method: 'tools/list' };
  if (cursor !== undefined) request.params = { cursor };
  forward(JSON.stringify(request));
}
function startProbe() { probe = { pages: 0, tools: [] }; probeNext(); }
function probeResult(msg) {
  if (!probe || !msg || msg.id !== probe.id) return false;
  if (msg.error || !msg.result || !Array.isArray(msg.result.tools)) { probe = null; return true; }
  probe.tools.push(...msg.result.tools);
  if (msg.result.nextCursor) { if (probe.pages >= 20) probe = null; else probeNext(msg.result.nextCursor); }
  else {
    try {
      const dir = path.dirname(options['--list-cache']); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmp = path.join(dir, `.${path.basename(options['--list-cache'])}.${crypto.randomUUID()}`);
      try { fs.writeFileSync(tmp, JSON.stringify({ tools: probe.tools, at: new Date().toISOString() }), { mode: 0o600 }); fs.renameSync(tmp, options['--list-cache']); } finally { try { fs.unlinkSync(tmp); } catch {} }
    } catch (err) { console.error(`Tool list cache: ${err.message}`); }
    probe = null;
  }
  return true;
}
function startTool(handoff) {
  mode = handoff ? 'handoff' : 'pipe';
  const env = { ...process.env };
  if (typeof ready.copy === 'string' && ready.copy.length) env.WHEELCHAIR_WINDOWS_PROJECT = ready.copy;
  else delete env.WHEELCHAIR_WINDOWS_PROJECT;
  delete env.WHEELCHAIR_SESSION_TOKEN;
  const wslenv = (env.WSLENV || '').split(':').filter(Boolean);
  if (!wslenv.some(x => x.split('/')[0] === 'WHEELCHAIR_WINDOWS_PROJECT')) wslenv.push('WHEELCHAIR_WINDOWS_PROJECT');
  env.WSLENV = wslenv.join(':');
  try { child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'], env }); } catch (err) { if (handoff) failure(err.message); else { console.error(err.message); finish(1); } return; }
  child.stdin.on('error', () => {});
  child.on('error', err => { if (mode === 'handoff') failure(err.message); else if (!stopping) { console.error(err.message); finish(1); } });
  child.on('close', (code, signal) => {
    if (stopping || finishing) return;
    if (mode === 'handoff') return failure('The Windows tool exited during initialization.');
    finish(signal ? 128 + (os.constants.signals[signal] || 0) : (code ?? 1));
  });
  readline.createInterface({ input: child.stdout }).on('line', line => {
    const msg = parse(line);
    if (mode === 'handoff' && msg && msg.id === initId) {
      if (msg.error || !msg.result) return failure('The Windows tool initialization failed.');
      clearTimeout(initTimer);
      if (msg.result.protocolVersion !== initParams.protocolVersion) console.error('Windows tool protocolVersion differs from the stand-in.');
      forward(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
      mode = 'pipe'; startProbe();
      for (const item of [...held, ...queue]) { clearTimeout(item.timer); if (!item.msg || item.msg.method !== 'notifications/initialized') forward(item.line); }
      held = []; queue = [];
      send({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
      return;
    }
    if (mode === 'handoff') return;
    if (!probeResult(msg)) output(line);
  });
  if (handoff) {
    initId = 'wc-go-between-init-' + crypto.randomUUID();
    forward(JSON.stringify({ jsonrpc: '2.0', id: initId, method: 'initialize', params: initParams }));
    initTimer = setTimeout(() => failure('The Windows tool initialization timed out.'), Number(options['--init-ms']));
  }
}
function poll() {
  if (mode !== 'standin') return;
  try { ready = JSON.parse(fs.readFileSync(options['--ready-file'], 'utf8')); state = ready.state || 'waiting'; } catch { ready = {}; state = 'waiting'; }
  if (state === 'ready') { clearInterval(poller); startTool(initialized); }
  else if (state === 'failed') { for (const item of [...held]) { removeItem(item); replyError(item.msg, sentence()); } }
}
const poller = setInterval(poll, Number(options['--poll-ms']));
poll();
readline.createInterface({ input: process.stdin }).on('line', line => {
  const msg = parse(line);
  if (mode === 'pipe') {
    if (initialized && msg && msg.method === 'notifications/initialized') return;
    forward(line);
    if (msg && msg.method === 'notifications/initialized') startProbe();
    return;
  }
  if (!msg || typeof msg !== 'object') { if (mode === 'handoff') queue.push(makeItem(line, null)); return; }
  if (msg.method === 'notifications/cancelled') { const removed = cancel(msg.params && msg.params.requestId); if (!removed && mode === 'handoff') queue.push(makeItem(line, msg)); return; }
  if (mode === 'handoff') { queue.push(makeItem(line, msg)); return; }
  if (!Object.hasOwn(msg, 'id')) return;
  if (msg.method === 'initialize') { initialized = true; initParams = msg.params || {}; send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: initParams.protocolVersion, capabilities: { tools: { listChanged: true } }, serverInfo: { name: options['--name'], version: '0' }, instructions: sentence() } }); }
  else if (msg.method === 'tools/list') send({ jsonrpc: '2.0', id: msg.id, result: { tools: cache } });
  else if (msg.method === 'ping') send({ jsonrpc: '2.0', id: msg.id, result: {} });
  else if (msg.method === 'tools/call') { if (state === 'failed') replyError(msg, sentence()); else held.push(makeItem(line, msg)); }
  else replyError(msg, sentence());
});
