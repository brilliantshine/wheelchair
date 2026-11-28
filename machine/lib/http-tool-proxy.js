'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { debuglog } = require('util');
const { validateToolJson } = require('./folder-tools');
const { projectIdentity, readKeyStore, usableReason } = require('./project-keys');
const { readSharedKeys } = require('./shared-keys');
const { createLineChecker } = require('./server-lines');
const { request, deleteSession } = require('./mcp-http');
const args = process.argv.slice(2); let dir, projectDir, stateDir, keyStore, urlOverride; const keys = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--project-dir') projectDir = args[++i]; else if (args[i] === '--tool') dir = args[++i]; else if (args[i] === '--state-dir') stateDir = args[++i]; else if (args[i] === '--key-store') keyStore = args[++i]; else if (args[i] === '--url-override') urlOverride = args[++i]; else if (args[i] === '--key') keys.push(args[++i]); }
let tool;
try {
  if (!projectDir || projectDir.startsWith('--') || !dir) throw new Error('usage: --project-dir <dir> --tool <dir>');
  const file = path.join(dir, 'tool.json'); let stat;
  try { stat = fs.statSync(file); } catch (e) { if (e.code === 'ENOENT') throw new Error('tool.json is missing'); throw e; }
  if (!stat.isFile()) throw new Error('tool.json is not a regular file');
  if (stat.size > 32768) throw new Error('tool.json is over 32 KiB');
  let value; try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('tool.json is not JSON'); }
  const result = validateToolJson(path.basename(dir), value); if (!result.ok) throw new Error(result.reason);
  if (result.tool.kind !== 'server' || result.tool.transport !== 'http') throw new Error('tool is not an HTTP server'); tool = result.tool;
} catch (e) { console.error(`${dir ? `tool ${path.basename(dir)}: ` : ''}${e.message.replace(/[\r\n]+/g, ' ')}`); process.exit(1); }
async function start() {
  if (['child_process', 'http', 'https', 'net'].some(name => debuglog(name).enabled)) throw new Error(`tool ${tool.name}: Node debug output is on; keyed tools won't run`);
  if (keys.length !== tool.keys.length || !tool.keys.every(k => keys.includes(k))) throw new Error(`tool ${tool.name}: its keys changed; they are used from the next agent start (a new session, a resume or an account switch)`);
  const store = keyStore === 'shared' ? await readSharedKeys(stateDir) : await readKeyStore(stateDir, await projectIdentity(projectDir));
  const missing = keys.filter(k => !Object.hasOwn(store.keys, k) || usableReason(store.keys[k]));
  if (missing.length) throw new Error(`tool ${tool.name} needs ${missing.length === 1 ? 'key' : 'keys'} ${missing.join(', ')}, not set on this machine`);
  const values = keys.map(k => store.keys[k]), headers = Object.fromEntries(Object.entries(tool.headers || {}).map(([k, v]) => [k, v.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => store.keys[name])]));
  const checker = createLineChecker({ name: tool.name, values }), url = urlOverride || tool.url, controllers = new Set();
  let sessionId = null, protocolVersion = null, params, initialized = false, initGate = null, initNotice = null, recovering = null, closing = false, initStarted = 0;
  const errorReply = (id, text) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: `tool ${tool.name}: ${text}` } }) + '\n');
  const configuredDeadline = process.env.WHEELCHAIR_HTTP_INIT_DEADLINE_MS;
  const initDeadline = /^[1-9][0-9]*$/.test(configuredDeadline || '') && Number.isSafeInteger(Number(configuredDeadline)) ? Number(configuredDeadline) : 30000;
  const deadline = (promise, ms, controller) => { let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('initialization timed out')); }, ms); })]).finally(() => clearTimeout(timer)); };
  function post(msg, sid, version, forward = true, controller = new AbortController()) {
    const isRequest = typeof msg.method === 'string' && msg.id !== undefined; controllers.add(controller);
    return new Promise((resolve, reject) => {
      let done = false, responseHeaders;
      const finish = (err, value) => { if (done) return; done = true; err ? reject(err) : resolve(value); };
      const apply = result => {
        if (controller.signal.aborted || done) return null;
        if (result.note) console.error(result.note);
        if (result.toServer) { try { const injected = JSON.parse(result.toServer); request({ url, headers, sessionId: sid, protocolVersion: version, message: injected, signal: controller.signal }).catch(() => {}); } catch {} }
        if (result.out && forward) process.stdout.write(Buffer.from(result.out).toString().trimEnd() + '\n');
        if (result.out && isRequest) { try { const out = JSON.parse(result.out); if (out.id === msg.id && (Object.hasOwn(out, 'result') || Object.hasOwn(out, 'error'))) return out; } catch {} }
        return null;
      };
      request({ url, headers, sessionId: sid, protocolVersion: version, message: msg, signal: controller.signal,
        onHeaders: h => { responseHeaders = h; if (forward && msg.method === 'initialize' && h['mcp-session-id']) sessionId = h['mcp-session-id']; if (!isRequest) finish(null, { headers: h }); },
        onMessage: response => { if (!forward && response && typeof response === 'object' && response.method === 'ping' && response.id !== undefined) { request({ url, headers, sessionId: responseHeaders?.['mcp-session-id'] || sid, protocolVersion: version, message: { jsonrpc: '2.0', id: response.id, result: {} }, signal: controller.signal }).catch(() => {}); return; } const result = apply(checker.line(Buffer.from(JSON.stringify(response)))); if (result) finish(null, { message: result, headers: responseHeaders, original: response }); },
        onOversized: prefix => { const result = apply(checker.oversized(prefix)); if (result) finish(null, { message: result, headers: responseHeaders }); }
      }).then(() => { controllers.delete(controller); if (!done) finish(new Error('HTTP stream ended without a matching response')); }, e => { controllers.delete(controller); finish(e); });
    });
  }
  async function recover(expiredId) {
    if (recovering) return recovering.promise;
    const record = { expiredId, promise: null }; recovering = record;
    const controller = new AbortController();
    const work = (async () => {
      if (!params) throw new Error('initialization has not been sent');
      if (expiredId) await deleteSession(url, headers, { sessionId: expiredId, protocolVersion });
      const init = await post({ jsonrpc: '2.0', id: '__wheelchair_init__', method: 'initialize', params }, null, null, false, controller);
      if (!init.original?.result) throw new Error('initialization failed');
      const newSessionId = init.headers?.['mcp-session-id'] || null, newVersion = init.original.result.protocolVersion || '2025-06-18';
      await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, newSessionId, newVersion, false, controller);
      if (recovering !== record) throw new Error('recovery expired');
      sessionId = newSessionId; protocolVersion = newVersion; initialized = true;
    })();
    record.promise = deadline(work, initDeadline, controller).catch(e => { initialized = false; throw e; }).finally(() => { if (recovering === record) recovering = null; });
    return record.promise;
  }
  async function send(msg, retry = true, controller) {
    const sentSessionId = sessionId;
    try { return await post(msg, sentSessionId, protocolVersion, true, controller); }
    catch (e) {
      if (e.status !== 404 || !sentSessionId || !retry) throw e;
      if (recovering) await recovering.promise;
      if (sessionId === sentSessionId) await recover(sentSessionId);
      if (msg.method === 'notifications/initialized') return {};
      return send(msg, false, controller);
    }
  }
  async function handle(msg) {
    const isRequest = typeof msg.method === 'string' && msg.id !== undefined;
    try {
      if (msg.method === 'initialize') {
        sessionId = null; params = msg.params; initialized = false; initStarted = Date.now();
        const controller = new AbortController();
        const gate = deadline(send(msg, true, controller), initDeadline, controller).then(r => { if (!r.original?.result) { const e = new Error('initialization failed'); e.replied = true; throw e; } sessionId = r.headers?.['mcp-session-id'] || null; protocolVersion = r.original.result.protocolVersion || '2025-06-18'; initialized = true; return r; });
        initGate = gate; try { await gate; } finally { if (initGate === gate) initGate = null; }
      } else if (msg.method === 'notifications/initialized') {
        const controller = new AbortController();
        const notice = deadline((async () => { if (initGate) await initGate; initialized = false; await send(msg, true, controller); initialized = true; })(), Math.max(0, initDeadline - (Date.now() - initStarted)), controller);
        initNotice = notice; try { await notice; } finally { if (initNotice === notice) initNotice = null; }
      } else if (typeof msg.method !== 'string') {
        await send(msg, false);
      } else {
        if (initGate) await initGate;
        if (initNotice) await initNotice;
        if (recovering) await recovering.promise;
        if (!initialized && typeof msg.method === 'string') await recover(sessionId);
        await send(msg);
      }
    } catch (e) { if (msg.method === 'initialize' || msg.method === 'notifications/initialized') initialized = false; if (isRequest && !closing && !e.replied) errorReply(msg.id, e.status ? `HTTP status ${e.status}` : e.code ? `HTTP error ${e.code}` : 'HTTP request failed'); }
  }
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', raw => { try { const msg = JSON.parse(raw); if (msg && typeof msg === 'object' && (typeof msg.method === 'string' || (Object.hasOwn(msg, 'id') && (Object.hasOwn(msg, 'result') || Object.hasOwn(msg, 'error'))))) handle(msg); } catch {} });
  async function shutdown() { if (closing) return; closing = true; for (const controller of controllers) controller.abort(); if (sessionId) await deleteSession(url, headers, { sessionId, protocolVersion }); process.exit(0); }
  input.on('close', shutdown); for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, shutdown);
}
start().catch(e => { console.error(e.message.replace(/[\r\n]+/g, ' ')); process.exit(1); });
