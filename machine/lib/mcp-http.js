'use strict';
const http = require('http');
const https = require('https');
const { LINE_LIMIT } = require('./server-lines');

function request({ url, headers = {}, sessionId, protocolVersion, message, method = 'POST', signal, onHeaders = () => {}, onMessage = () => {}, onOversized = () => {} }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, value) => { if (settled) return; settled = true; err ? reject(err) : resolve(value); };
    let target; try { target = new URL(url); } catch (e) { finish(e); return; }
    const transport = target.protocol === 'https:' ? https : http;
    const requestHeaders = { ...headers, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(protocolVersion ? { 'MCP-Protocol-Version': protocolVersion } : {}), ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) };
    let req;
    try { req = transport.request(target, { method, headers: requestHeaders, signal }, res => {
      const status = res.statusCode;
      if (status >= 300 && status < 400) { res.resume(); const error = new Error(`HTTP server returned redirect (${status}); redirects are not followed`); error.status = status; finish(error); return; }
      if (status < 200 || status >= 300) { res.resume(); const error = new Error(`HTTP server returned status ${status}`); error.status = status; finish(error); return; }
      onHeaders(res.headers, status);
      if (method === 'DELETE' || status === 202) { res.resume(); finish(null, { headers: res.headers, status }); return; }
      const sse = /^text\/event-stream\b/i.test(res.headers['content-type'] || '');
      let buffer = Buffer.alloc(0), oversized = false;
      const eventData = raw => Buffer.from(raw.toString('utf8').split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n'));
      const parse = raw => { let msg; try { msg = JSON.parse(raw.toString('utf8')); } catch (e) { if (!(e instanceof SyntaxError)) finish(e); return; } try { onMessage(msg, res.headers); } catch (e) { finish(e); } };
      res.on('data', chunk => {
        if (oversized) return;
        buffer = Buffer.concat([buffer, chunk]);
        if (sse) {
          for (;;) {
            const match = /\r?\n\r?\n/.exec(buffer.toString('latin1')); if (!match) break;
            const event = buffer.subarray(0, match.index); buffer = buffer.subarray(match.index + match[0].length);
            if (event.length > LINE_LIMIT) { oversized = true; const prefixBuf = eventData(event.subarray(0, LINE_LIMIT)); onOversized(prefixBuf); res.destroy(); finish(null, { oversized: true, prefixBuf }); return; }
            const data = eventData(event);
            if (data.length) parse(data);
          }
        }
        if (buffer.length > LINE_LIMIT) { oversized = true; const prefixBuf = sse ? eventData(buffer.subarray(0, LINE_LIMIT)) : buffer.subarray(0, LINE_LIMIT); onOversized(prefixBuf); res.destroy(); finish(null, { oversized: true, prefixBuf }); }
      });
      res.on('end', () => { if (!sse && buffer.length) parse(buffer); finish(null, { headers: res.headers, status }); });
      res.on('error', e => finish(e));
    }); } catch (e) { finish(e); return; }
    req.on('error', e => finish(e));
    if (message !== undefined) req.write(JSON.stringify(message));
    req.end();
  });
}
async function deleteSession(url, headers, { timeoutMs = 1000, sessionId, protocolVersion } = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try { await request({ url, headers, sessionId, protocolVersion, method: 'DELETE', signal: controller.signal }); } catch {} finally { clearTimeout(timer); }
}
async function httpHandshake({ url, headers, timeoutMs, signal }) {
  const controller = new AbortController(); let timedOut = false, sessionId, version, serverInfo = null;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const cancel = () => controller.abort(); signal?.addEventListener('abort', cancel, { once: true }); if (signal?.aborted) cancel();
  const call = (message, capture) => new Promise((resolve, reject) => {
    let got = false;
    request({ url, headers, sessionId, protocolVersion: version, message, signal: controller.signal, onHeaders: h => { if (capture) sessionId = h['mcp-session-id']; if (message.id === undefined) { got = true; resolve(); } }, onMessage: msg => { if (!msg || typeof msg !== 'object') return; if (msg.method === 'ping' && msg.id !== undefined) { request({ url, headers, sessionId, protocolVersion: version, message: { jsonrpc: '2.0', id: msg.id, result: {} }, signal: controller.signal }).catch(() => {}); return; } if (msg.id === message.id && message.id !== undefined) { got = true; msg.error ? reject(new Error(msg.error.message || 'Server error')) : resolve(msg.result); } } }).then(() => { if (!got) reject(new Error('Server ended without a response')); }, reject);
  });
  try {
    const init = await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'wheelchair', version: '1' } } }, true);
    if (!init) throw new Error('Invalid initialize response'); serverInfo = init.serverInfo || null; version = init.protocolVersion || '2025-06-18';
    await call({ jsonrpc: '2.0', method: 'notifications/initialized' });
    let tools = null; if (init.capabilities?.tools) { const list = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' }); if (!Array.isArray(list?.tools)) throw new Error('Invalid tools/list response'); tools = list.tools.map(t => t.name); }
    return { ok: true, serverInfo, tools, error: null };
  } catch (e) { return { ok: false, serverInfo: signal?.aborted ? null : serverInfo, tools: null, error: signal?.aborted ? 'cancelled' : timedOut ? 'Server handshake timed out' : e.message }; }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); controller.abort(); if (sessionId && !signal?.aborted) await deleteSession(url, headers, { sessionId, protocolVersion: version }); }
}
module.exports = { request, deleteSession, httpHandshake };
