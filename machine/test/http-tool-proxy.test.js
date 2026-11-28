'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { request, httpHandshake } = require('../lib/mcp-http');

async function server(handler) {
  const s = http.createServer(handler); await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  return { s, url: `http://127.0.0.1:${s.address().port}/mcp` };
}
test('SSE delivers multiline events before EOF', async () => {
  let end; const fixture = await server((req, res) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(': comment\ndata: {"id":1,\ndata: "result":{}}\n\n'); end = () => res.end(); });
  try { let received; const message = new Promise(resolve => { received = resolve; }); const pending = request({ url: fixture.url, message: {}, onMessage: received }); assert.deepEqual(await message, { id: 1, result: {} }); end(); await pending; } finally { fixture.s.close(); }
});
test('redirects are refused', async () => {
  const fixture = await server((req, res) => { res.writeHead(302, { location: '/other' }); res.end(); });
  try { await assert.rejects(request({ url: fixture.url, message: {} }), /redirect \(302\)/); } finally { fixture.s.close(); }
});
test('HTTP handshake negotiates, lists and deletes session', async () => {
  const calls = []; const fixture = await server((req, res) => { let data = ''; req.on('data', b => { data += b; }); req.on('end', () => {
    if (req.method === 'DELETE') { calls.push('delete'); res.writeHead(204); res.end(); return; }
    const msg = JSON.parse(data); calls.push(msg.method); res.setHeader('mcp-session-id', 'session');
    if (msg.method === 'notifications/initialized') { assert.equal(req.headers['mcp-session-id'], 'session'); res.writeHead(202); res.end(); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: msg.method === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'test' } } : { tools: [{ name: 'one' }] } }));
  }); });
  try { const result = await httpHandshake({ url: fixture.url, timeoutMs: 3000 }); assert.equal(result.ok, true); assert.deepEqual(result.tools, ['one']); assert.deepEqual(calls, ['initialize', 'notifications/initialized', 'tools/list', 'delete']); } finally { fixture.s.close(); }
});

test('proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), { spawn } = require('node:child_process'), readline = require('node:readline');
  const { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp(), dir = path.join(root, 'web'), state = path.join(root, 'state'), seen = []; let generation = 0;
  await fs.mkdir(dir, { recursive: true }); await fs.mkdir(path.join(state, 'shared-keys'), { recursive: true });
  await fs.writeFile(path.join(state, 'shared-keys', 'keys.json'), JSON.stringify({ shared: true, revision: 1, keys: { API_KEY: 'secret123456' } }));
  const fixture = await server((req, res) => { let data = ''; req.on('data', b => { data += b; }); req.on('end', () => {
    seen.push({ method: req.method, sid: req.headers['mcp-session-id'], auth: req.headers.authorization });
    if (req.method === 'DELETE') { res.writeHead(204); res.end(); return; }
    const msg = JSON.parse(data); if (msg.method === 'initialize') { generation++; res.setHeader('mcp-session-id', `s${generation}`); }
    if (msg.method === 'notifications/initialized') { setTimeout(() => { res.writeHead(202); res.end(); }, 50); return; }
    if (msg.method === 'incomplete') { res.setHeader('content-type', 'text/event-stream'); res.end('data: {\"id\":6'); return; }
    if (msg.method === 'ping' && req.headers['mcp-session-id'] === 's1') { const fail = () => { res.writeHead(404); res.end(); }; if (msg.id === 3) setTimeout(fail, 150); else fail(); return; }
    res.setHeader('content-type', 'application/json'); const result = msg.method === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: {} } : msg.id === 4 ? { secret123456: 'hidden' } : { text: 'value secret123456' };
    res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
  }); });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'web', description: 'x', kind: 'server', url: fixture.url, keys: ['API_KEY'], headers: { Authorization: 'Bearer ${API_KEY}' } }));
  const child = spawn(process.execPath, [path.join(__dirname, '../lib/http-tool-proxy.js'), '--project-dir', root, '--tool', dir, '--state-dir', state, '--key-store', 'shared', '--key', 'API_KEY'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = readline.createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const next = async () => JSON.parse((await Promise.race([lines.next(), new Promise((_, reject) => setTimeout(() => reject(new Error('proxy reply timed out')), 3000))])).value);
  try {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n'); assert.equal((await next()).id, 1);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n'); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' }) + '\n'); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'ping' }) + '\n'); const replies = [await next(), await next(), await next()].sort((a, b) => a.id - b.id); assert.deepEqual(replies.map(r => r.id), [2, 3, 5]); assert.equal(replies[0].result.text, 'value [key]'); assert.equal(generation, 2);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'ping' }) + '\n'); const held = await next(); assert.equal(held.error.code, -32603); assert.doesNotMatch(JSON.stringify(held), /secret123456/);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'incomplete' }) + '\n'); assert.equal((await next()).error.code, -32603);
    child.stdin.end(); await new Promise(resolve => child.on('exit', resolve)); assert.ok(seen.some(x => x.method === 'DELETE' && x.sid === 's2')); assert.ok(seen.every(x => x.auth === 'Bearer secret123456'));
  } finally { child.kill(); fixture.s.close(); }
});

test('oversized JSON is reported with its prefix', async () => {
  const { LINE_LIMIT } = require('../lib/server-lines');
  const fixture = await server((req, res) => { res.setHeader('content-type', 'application/json'); res.write('{"id":7,"result":"'); const chunk = Buffer.alloc(1024 * 1024, 97); for (let i = 0; i < 33; i++) res.write(chunk); res.end('"}'); });
  try { let prefix; const result = await request({ url: fixture.url, message: {}, onOversized: b => { prefix = b; } }); assert.equal(result.oversized, true); assert.equal(prefix.length, LINE_LIMIT); assert.match(prefix.subarray(0, 30).toString(), /"id":7/); } finally { fixture.s.close(); }
});

test('proxy refuses Node network debugging', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), { spawn } = require('node:child_process'); const { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp(), dir = path.join(root, 'web'); await fs.mkdir(dir); await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'web', description: 'x', kind: 'server', url: 'http://localhost', keys: ['API_KEY'] }));
  const child = spawn(process.execPath, [path.join(__dirname, '../lib/http-tool-proxy.js'), '--project-dir', root, '--tool', dir, '--key', 'API_KEY'], { env: { ...process.env, NODE_DEBUG: 'net' }, stdio: ['ignore', 'pipe', 'pipe'] }); let err = ''; child.stderr.on('data', data => { err += data; }); const code = await new Promise(resolve => child.on('exit', resolve)); assert.notEqual(code, 0); assert.match(err, /debug output is on/);
});

test('failed initialized notification gates queued calls and the next call recovers', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), { spawn } = require('node:child_process'), readline = require('node:readline'), { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp(), dir = path.join(root, 'web'), state = path.join(root, 'state'); await fs.mkdir(dir); await fs.mkdir(path.join(state, 'shared-keys'), { recursive: true });
  await fs.writeFile(path.join(state, 'shared-keys', 'keys.json'), JSON.stringify({ shared: true, revision: 1, keys: { API_KEY: 'secret123456' } })); let count = 0;
  const fixture = await server((req, res) => { let body = ''; req.on('data', b => { body += b; }); req.on('end', () => {
    if (req.method === 'DELETE') { res.writeHead(204); res.end(); return; } const msg = JSON.parse(body);
    if (msg.method === 'initialize') { count++; res.setHeader('mcp-session-id', `s${count}`); }
    if (msg.method === 'notifications/initialized') { setTimeout(() => { res.writeHead(count === 1 ? 500 : 202); res.end(); }, 60); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: msg.method === 'initialize' ? { protocolVersion: '2025-06-18' } : {} }));
  }); });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'web', description: 'x', kind: 'server', url: fixture.url, keys: ['API_KEY'] }));
  const child = spawn(process.execPath, [path.join(__dirname, '../lib/http-tool-proxy.js'), '--project-dir', root, '--tool', dir, '--state-dir', state, '--key-store', 'shared', '--key', 'API_KEY'], { stdio: ['pipe', 'pipe', 'pipe'] }); const lines = readline.createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const next = async () => JSON.parse((await Promise.race([lines.next(), new Promise((_, reject) => setTimeout(() => reject(new Error('reply timed out')), 3000))])).value);
  const send = msg => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
  try { send({ id: 1, method: 'initialize', params: {} }); assert.equal((await next()).id, 1); send({ method: 'notifications/initialized' }); send({ id: 2, method: 'ping' }); assert.equal((await next()).error.code, -32603); send({ id: 3, method: 'ping' }); assert.deepEqual((await next()).result, {}); assert.equal(count, 2); child.stdin.end(); await new Promise(resolve => child.on('exit', resolve)); } finally { child.kill(); fixture.s.close(); }
});

test('proxy forwards client replies to server requests on an open SSE stream', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), { spawn } = require('node:child_process'), readline = require('node:readline'), { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp(), dir = path.join(root, 'web'), state = path.join(root, 'state'); await fs.mkdir(dir); await fs.mkdir(path.join(state, 'shared-keys'), { recursive: true });
  await fs.writeFile(path.join(state, 'shared-keys', 'keys.json'), JSON.stringify({ shared: true, revision: 1, keys: { API_KEY: 'secret123456' } }));
  let stream, received;
  const fixture = await server((req, res) => { let body = ''; req.on('data', b => { body += b; }); req.on('end', () => {
    if (req.method === 'DELETE') { res.writeHead(204); res.end(); return; }
    const msg = JSON.parse(body);
    if (msg.method === 'initialize') { res.setHeader('mcp-session-id', 'session'); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2025-06-18' } })); }
    else if (msg.method === 'notifications/initialized') { res.writeHead(202); res.end(); }
    else if (msg.method === 'tools/call') { stream = res; res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: 'srv-1', method: 'roots/list' })}\n\n`); }
    else { received = msg; res.writeHead(202); res.end(); stream.end(`data: ${JSON.stringify({ jsonrpc: '2.0', id: 2, result: { content: [] } })}\n\n`); }
  }); });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'web', description: 'x', kind: 'server', url: fixture.url, keys: ['API_KEY'] }));
  const child = spawn(process.execPath, [path.join(__dirname, '../lib/http-tool-proxy.js'), '--project-dir', root, '--tool', dir, '--state-dir', state, '--key-store', 'shared', '--key', 'API_KEY'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = readline.createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const next = async () => JSON.parse((await Promise.race([lines.next(), new Promise((_, reject) => setTimeout(() => reject(new Error('reply timed out')), 3000))])).value);
  const send = msg => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
  try {
    send({ id: 1, method: 'initialize', params: {} }); assert.equal((await next()).id, 1);
    send({ method: 'notifications/initialized' }); send({ id: 2, method: 'tools/call' });
    assert.deepEqual(await next(), { jsonrpc: '2.0', id: 'srv-1', method: 'roots/list' });
    const reply = { jsonrpc: '2.0', id: 'srv-1', result: { roots: [] } }; child.stdin.write(JSON.stringify(reply) + '\n');
    assert.deepEqual(await next(), { jsonrpc: '2.0', id: 2, result: { content: [] } }); assert.deepEqual(received, reply);
  } finally { child.kill(); fixture.s.close(); }
});

test('initialization deadline aborts late replies', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), { spawn } = require('node:child_process'), readline = require('node:readline'), { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp(), dir = path.join(root, 'web'), state = path.join(root, 'state'); await fs.mkdir(dir); await fs.mkdir(path.join(state, 'shared-keys'), { recursive: true });
  await fs.writeFile(path.join(state, 'shared-keys', 'keys.json'), JSON.stringify({ shared: true, revision: 1, keys: { API_KEY: 'secret123456' } }));
  const fixture = await server((req, res) => { req.resume(); req.on('end', () => { setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } })); }, 400); }); });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'web', description: 'x', kind: 'server', url: fixture.url, keys: ['API_KEY'] }));
  const child = spawn(process.execPath, [path.join(__dirname, '../lib/http-tool-proxy.js'), '--project-dir', root, '--tool', dir, '--state-dir', state, '--key-store', 'shared', '--key', 'API_KEY'], { env: { ...process.env, WHEELCHAIR_HTTP_INIT_DEADLINE_MS: '200' }, stdio: ['pipe', 'pipe', 'pipe'] });
  const replies = []; readline.createInterface({ input: child.stdout }).on('line', line => replies.push(JSON.parse(line)));
  try {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(replies.length, 1); assert.equal(replies[0].id, 1); assert.equal(replies[0].error.code, -32603);
  } finally { child.kill(); fixture.s.close(); }
});

test('handshake handles null JSON and deletes the session', async () => {
  let deleted;
  const fixture = await server((req, res) => {
    if (req.method === 'DELETE') { deleted = req.headers['mcp-session-id']; res.writeHead(204); res.end(); return; }
    req.resume(); res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 's-null' }); res.end('null');
  });
  try { const result = await httpHandshake({ url: fixture.url, timeoutMs: 3000 }); assert.equal(result.ok, false); assert.equal(deleted, 's-null'); } finally { fixture.s.close(); }
});

test('request rejects errors thrown by message callbacks', async () => {
  const fixture = await server((req, res) => { req.resume(); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); });
  try { await assert.rejects(request({ url: fixture.url, message: {}, onMessage: () => { throw new SyntaxError('callback failed'); } }), /callback failed/); } finally { fixture.s.close(); }
});

test('proxy forwards a client reply during initialization', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), { spawn } = require('node:child_process'), readline = require('node:readline'), { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp(), dir = path.join(root, 'web'), state = path.join(root, 'state'); await fs.mkdir(dir); await fs.mkdir(path.join(state, 'shared-keys'), { recursive: true });
  await fs.writeFile(path.join(state, 'shared-keys', 'keys.json'), JSON.stringify({ shared: true, revision: 1, keys: { API_KEY: 'secret123456' } }));
  let stream, received, replySession;
  const fixture = await server((req, res) => { let body = ''; req.on('data', b => { body += b; }); req.on('end', () => {
    if (req.method === 'DELETE') { res.writeHead(204); res.end(); return; }
    const msg = JSON.parse(body);
    if (msg.method === 'initialize') { stream = res; res.writeHead(200, { 'content-type': 'text/event-stream', 'mcp-session-id': 'init-session' }); res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: 'init-ping', method: 'ping' })}\n\n`); }
    else { received = msg; replySession = req.headers['mcp-session-id']; res.writeHead(202); res.end(); stream.end(`data: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18', capabilities: {} } })}\n\n`); }
  }); });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'web', description: 'x', kind: 'server', url: fixture.url, keys: ['API_KEY'] }));
  const child = spawn(process.execPath, [path.join(__dirname, '../lib/http-tool-proxy.js'), '--project-dir', root, '--tool', dir, '--state-dir', state, '--key-store', 'shared', '--key', 'API_KEY'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = readline.createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const next = async () => JSON.parse((await Promise.race([lines.next(), new Promise((_, reject) => setTimeout(() => reject(new Error('reply timed out')), 3000))])).value);
  try {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
    assert.deepEqual(await next(), { jsonrpc: '2.0', id: 'init-ping', method: 'ping' });
    const reply = { jsonrpc: '2.0', id: 'init-ping', result: {} }; child.stdin.write(JSON.stringify(reply) + '\n');
    assert.deepEqual(await next(), { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18', capabilities: {} } });
    assert.deepEqual(received, reply); assert.equal(replySession, 'init-session');
  } finally { child.kill(); fixture.s.close(); }
});
