'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const http = require('node:http');
const { Readable } = require('node:stream');
const path = require('node:path');
const crypto = require('node:crypto');
const { startServer } = require('./helpers/server');
const { makeTemp } = require('../../test-support/run-dir');
const { State } = require('../app/state');
const background = require('../app/background');
const { normalize } = require('../pages/background-format');
const settings = require('../app/settings');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
// Small structural containers exercise the server's bounded header checks, not pixel decoding.
const jpeg = Buffer.from('ffd8ffc0000b080001000101011100ffda0008010100003f0001ffd9', 'hex');
const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAAh+QQBAAAAACwAAAAAAQABAAACAUQAOw==', 'base64');
const infinite = Buffer.from('21ff0b4e45545343415045322e300301000000', 'hex');
const headerEnd = 19;

test('background normalization retains current harness, onboarding, lessons and merge preferences', () => {
  const saved = settings.defaults();
  saved.background = { image_id: 'a'.repeat(64), media_type: 'image/png', opacity: 79, revision: 4 };
  saved.harnesses.openrouter = false;
  saved.onboarding_done = true;
  saved.auto_merge = 'on';
  saved.auto_merge_delete_branch = 'on';
  saved.user_name = 'Taylor';
  const normalized = settings.normalize(saved);
  for (const key of ['background', 'harnesses', 'onboarding_done', 'auto_merge', 'auto_merge_delete_branch', 'lessons', 'lesson_history', 'lesson_waiting', 'user_name']) {
    assert.deepEqual(normalized[key], saved[key], key);
  }
});

function api(ctx, route = '', options = {}) {
  const { method = 'GET', body, type, auth = true, origin = true } = options;
  const url = new URL(`${ctx.url}/api/settings/background${route}`);
  if (auth && method === 'GET') url.searchParams.set('token', ctx.token);
  const headers = {};
  if (auth && method !== 'GET') headers['x-graph-token'] = ctx.token;
  if (origin) headers.origin = origin === true ? new URL(ctx.url).origin : origin;
  if (type) headers['content-type'] = type;
  return fetch(url, { method, body, headers });
}
function upload(ctx, bytes, type, revision = 0, opacity = 35) {
  return api(ctx, `/upload?revision=${revision}&opacity=${opacity}`, { method: 'POST', body: bytes, type });
}
function put(ctx, body) { return api(ctx, '', { method: 'PUT', type: 'application/json', body: JSON.stringify(body) }); }
function raw(ctx, route, { method = 'POST', headers = {}, chunks = [], abort = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${ctx.url}/api/settings/background${route}`, {
      method, headers: { 'x-graph-token': ctx.token, origin: new URL(ctx.url).origin, ...headers },
    }, res => { const data = []; res.on('data', c => data.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(data).toString() })); });
    req.on('error', error => abort ? resolve(null) : reject(error));
    for (const chunk of chunks) req.write(chunk);
    if (abort) { req.flushHeaders(); setTimeout(() => req.destroy(), 50); } else req.end();
  });
}

test('GIF loop variants preserve frames, control blocks and empty comments', () => {
  const fixture = name => fsSync.readFileSync(path.join(__dirname, 'fixtures/background', name));
  const base = fixture('no-loop.gif');
  for (const input of [base, fixture('finite.gif'), fixture('animated-87a.gif')]) {
    const out = Buffer.from(normalize(input).bytes);
    assert.equal(out.subarray(0, 6).toString(), 'GIF89a');
    assert.equal(out.indexOf(infinite), headerEnd);
    assert.equal(out.indexOf(Buffer.from('NETSCAPE2.0'), headerEnd + infinite.length), -1);
    const withoutLoop = Buffer.concat([out.subarray(0, headerEnd), out.subarray(headerEnd + infinite.length)]);
    const finiteLoop = Buffer.from('21ff0b4e45545343415045322e300301050000', 'hex');
    const loopOffset = input.indexOf(finiteLoop);
    const expected = loopOffset < 0 ? input : Buffer.concat([input.subarray(0, loopOffset), input.subarray(loopOffset + finiteLoop.length)]);
    assert.deepEqual(withoutLoop.subarray(6), expected.subarray(6));
  }
  const staticGif = Buffer.concat([gif.subarray(0, 19), gif.subarray(19, 41), Buffer.from([0x3b])]);
  assert.deepEqual(Buffer.from(normalize(staticGif).bytes), staticGif);
  for (const bad of [gif.subarray(0, gif.length - 1), Buffer.from('47494638396101000100800000000000', 'hex')]) assert.throws(() => normalize(bad), { status: 422 });
});

test('containers reject malformed dimensions, payload, signatures and mismatches', () => {
  for (const [bytes, type] of [[png, 'image/png'], [jpeg, 'image/jpeg'], [webp, 'image/webp'], [gif, 'image/gif']]) {
    assert.equal(normalize(bytes).mediaType, type);
    assert.throws(() => normalize(bytes, type === 'image/png' ? 'image/jpeg' : 'image/png'), { status: 415 });
    assert.throws(() => normalize(bytes.subarray(0, bytes.length - 1)), { status: 422 });
  }
  const zeroJpeg = Buffer.from(jpeg); zeroJpeg[7] = zeroJpeg[8] = 0;
  const emptyJpeg = Buffer.concat([jpeg.subarray(0, jpeg.length - 3), jpeg.subarray(jpeg.length - 2)]);
  const badWebp = Buffer.from(webp); badWebp[23] = 0;
  for (const input of [zeroJpeg, emptyJpeg, badWebp, Buffer.from('ffd8ffd9', 'hex'), Buffer.from('524946460400000057454250', 'hex')]) assert.throws(() => normalize(input), { status: 422 });
  assert.throws(() => normalize(Buffer.from('<svg/>')), { status: 415 });
});

test('API saves and serves all formats, validates metadata and preserves unrelated settings', async () => {
  let ctx = await startServer();
  try {
    let revision = 0, saved;
    for (const [bytes, type] of [[png, 'image/png'], [jpeg, 'image/jpeg'], [webp, 'image/webp'], [gif, 'image/gif']]) {
      const response = await upload(ctx, bytes, type, revision++, 0);
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      saved = await response.json(); assert.equal(saved.opacity, 0);
      const image = await api(ctx, `/image/${saved.image_id}`);
      assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), type); assert.equal(image.headers.get('cache-control'), 'no-store'); assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(normalize(bytes).bytes));
    }
    const originalFile = await fs.stat(path.join(ctx.stateDir, 'backgrounds', saved.image_id));
    const sameFile = await upload(ctx, gif, 'image/gif', revision, 0);
    assert.equal(sameFile.status, 200);
    saved = await sameFile.json(); revision++;
    assert.equal((await fs.stat(path.join(ctx.stateDir, 'backgrounds', saved.image_id))).ino, originalFile.ino);
    for (const route of ['/image/bad', '/image/' + 'A'.repeat(64)]) assert.equal((await api(ctx, route)).status, 400);
    assert.equal((await api(ctx, '/image/' + '0'.repeat(64))).status, 404);
    for (const body of [{ revision, image_id: 'bad', opacity: 1 }, { revision, image_id: '0'.repeat(64), opacity: 1 }, { revision, image_id: saved.image_id, opacity: 1.2 }, { revision, image_id: null, opacity: 101 }, { revision, image_id: null, opacity: 1, extra: true }]) assert.equal((await put(ctx, body)).status, 400);
    for (const query of ['revision=4&revision=4&opacity=1', 'revision=4&opacity=1&x=2', 'revision=-1&opacity=1', 'revision=4&opacity=1.2']) assert.equal((await api(ctx, `/upload?${query}`, { method: 'POST', body: png, type: 'image/png' })).status, 400);
    assert.equal((await api(ctx, '?extra=1', { method: 'PUT', type: 'application/json', body: '{}' })).status, 400);
    assert.equal((await upload(ctx, png, 'image/gif', revision)).status, 415);
    assert.equal((await upload(ctx, Buffer.from('<svg/>'), 'image/svg+xml', revision)).status, 415);
    assert.equal((await upload(ctx, png.subarray(0, 8), 'image/png', revision)).status, 422);
    assert.equal((await upload(ctx, Buffer.alloc(0), 'image/png', revision)).status, 415);
    assert.equal((await put(ctx, { revision, image_id: saved.image_id, opacity: 0 })).status, 200);
    assert.equal((await (await api(ctx)).json()).revision, revision);
    let r = await put(ctx, { revision, image_id: saved.image_id, opacity: 61 }); assert.equal(r.status, 200); revision++;
    const headers = { 'x-graph-token': ctx.token, origin: new URL(ctx.url).origin, 'content-type': 'application/json' };
    r = await fetch(`${ctx.url}/api/settings/balancing`, { method: 'PUT', headers, body: JSON.stringify({ leave: 11 }) }); assert.equal(r.status, 200);
    const stateDir = ctx.stateDir;
    assert.equal((await fs.stat(path.join(stateDir, 'backgrounds'))).mode & 0o777, 0o700);
    assert.equal((await fs.stat(path.join(stateDir, 'backgrounds', saved.image_id))).mode & 0o777, 0o600);
    await ctx.stop(); ctx = await startServer({ stateDir });
    saved = await (await api(ctx)).json(); assert.equal(saved.opacity, 61); assert.equal(saved.revision, revision);
    assert.equal(JSON.parse(await fs.readFile(path.join(stateDir, 'settings.json'))).leave, 11);
    r = await put(ctx, { revision, image_id: null, opacity: 0 }); assert.equal(r.status, 200); assert.equal((await r.json()).opacity, 35);
    assert.deepEqual(await fs.readdir(path.join(stateDir, 'backgrounds')), []);
  } finally { await ctx.stop(); }
});

test('authentication, origin and bounded declared and streamed bodies', async () => {
  const ctx = await startServer();
  try {
    await fs.writeFile(path.join(ctx.stateDir, 'settings.json'), JSON.stringify({ background: { image_id: 'bad', media_type: 'image/png', opacity: 42, revision: 2 }, leave: 11 }));
    const fallback = await (await api(ctx)).json();
    assert.deepEqual([fallback.image_id, fallback.opacity, fallback.revision], [null, 35, 0]);
    assert.equal((await api(ctx, '', { auth: false })).status, 401);
    assert.equal((await api(ctx, '/upload?revision=0&opacity=35', { method: 'POST', body: png, type: 'image/png', auth: false })).status, 401);
    assert.equal((await api(ctx, '', { method: 'PUT', body: '{}', type: 'application/json', origin: 'http://evil.invalid' })).status, 403);
    const binaryRoute = '/upload?revision=0&opacity=35';
    assert.equal((await raw(ctx, binaryRoute, { headers: { 'content-type': 'image/png', 'content-length': String(25 * 1024 * 1024 + 1) } })).status, 413);
    assert.equal((await raw(ctx, binaryRoute, { headers: { 'content-type': 'image/png' }, chunks: Array(26).fill(Buffer.alloc(1024 * 1024)) })).status, 413);
    assert.equal((await raw(ctx, '', { method: 'PUT', headers: { 'content-length': '4097' } })).status, 413);
    assert.equal((await raw(ctx, '', { method: 'PUT', chunks: [Buffer.alloc(4097)] })).status, 413);
    assert.equal((await raw(ctx, '', { method: 'PUT' })).status, 400);
    await raw(ctx, binaryRoute, { headers: { 'content-type': 'image/png', 'content-length': String(png.length + 10) }, chunks: [png.subarray(0, 16)], abort: true });
    assert.equal((await (await api(ctx)).json()).revision, 0);
  } finally { await ctx.stop(); }
});

test('concurrent uploads and slow upload recheck revision after reading', async () => {
  const ctx = await startServer();
  try {
    const pair = await Promise.all([upload(ctx, png, 'image/png'), upload(ctx, jpeg, 'image/jpeg')]);
    assert.deepEqual(pair.map(r => r.status).sort(), [200, 409]);
    const slow = http.request(`${ctx.url}/api/settings/background/upload?revision=1&opacity=35`, { method: 'POST', headers: { 'x-graph-token': ctx.token, origin: new URL(ctx.url).origin, 'content-type': 'image/png', 'content-length': png.length } });
    const result = new Promise((resolve, reject) => { slow.on('response', res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); slow.on('error', reject); });
    slow.write(png.subarray(0, 12));
    const current = await (await api(ctx)).json();
    assert.equal((await put(ctx, { revision: 1, image_id: current.image_id, opacity: 10 })).status, 200);
    slow.end(png.subarray(12)); assert.equal(await result, 409);
    assert.equal((await (await api(ctx)).json()).revision, 2);
  } finally { await ctx.stop(); }
});

test('failed metadata commit preserves old file; cleanup failure is retried after commit', async () => {
  const stateDir = await makeTemp('background-fault-');
  const hub = { stateDir, state: new State(stateDir) };
  const id1 = crypto.createHash('sha256').update(png).digest('hex');
  const id2 = crypto.createHash('sha256').update(jpeg).digest('hex');
  await background.commit(hub, 0, 35, id1, 'image/png', png);
  const rename = fs.rename;
  try {
    fs.rename = async (from, to) => { if (to === hub.state.settingsPath) throw new Error('injected metadata failure'); return rename(from, to); };
    await assert.rejects(background.commit(hub, 1, 20, id2, 'image/jpeg', jpeg));
  } finally { fs.rename = rename; }
  assert.equal((await background.metadata(hub)).image_id, id1);
  assert.deepEqual(await fs.readFile(path.join(stateDir, 'backgrounds', id1)), png);
  assert.deepEqual(await fs.readdir(path.join(stateDir, 'backgrounds')), [id1]);
  const unlink = fs.unlink; let failed = false;
  try {
    fs.unlink = async file => { if (file === path.join(stateDir, 'backgrounds', id1) && !failed) { failed = true; throw new Error('injected cleanup failure'); } return unlink(file); };
    const request = Readable.from([jpeg]);
    request.method = 'POST';
    request.headers = { 'content-type': 'image/jpeg' };
    const response = { setHeader() {} };
    let sent;
    await background.handle(hub, request, response, new URL('http://localhost/settings/background/upload?revision=1&opacity=20'), ['settings', 'background', 'upload'], (_response, status, body) => { sent = { status, body }; });
    assert.equal(sent.status, 200);
    assert.equal(sent.body.image_id, id2);
  } finally { fs.unlink = unlink; }
  assert.equal(failed, true);
  assert.deepEqual(await fs.readFile(path.join(stateDir, 'backgrounds', id2)), jpeg);
  await background.commit(hub, 2, 21, id2, null, null);
  assert.deepEqual(await fs.readdir(path.join(stateDir, 'backgrounds')), [id2]);
});
