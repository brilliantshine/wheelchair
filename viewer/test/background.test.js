'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { startServer } = require('./helpers/server');
const { normalize } = require('../pages/background-format');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7XQAAAAASUVORK5CYII=', 'base64');
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAAh+QQBAAAAACwAAAAAAQABAAACAUQAOw==', 'base64');
test('format validation and animated GIF loop normalization', () => {
  assert.equal(normalize(png).mediaType, 'image/png');
  assert.throws(() => normalize(png, 'image/gif'), { status: 415 });
  assert.throws(() => normalize(png.subarray(0, 8)), { status: 422 });
  const normalized = normalize(gif).bytes;
  assert.equal(Buffer.from(normalized).includes(Buffer.from('NETSCAPE2.0')), true);
  assert.equal(Buffer.from(normalize(normalized).bytes).toString('hex'), Buffer.from(normalized).toString('hex'));
  assert.throws(() => normalize(gif.subarray(0, gif.length - 2)), { status: 422 });
});
test('authenticated background saves, conflict, reset and restart', async () => {
  let ctx = await startServer();
  const stateDir = ctx.stateDir;
  async function call(route, method = 'GET', body, type, token = true, origin = true) {
    const headers = {}; if (token) headers['x-graph-token'] = ctx.token; if (origin) headers.origin = new URL(ctx.url).origin; if (type) headers['content-type'] = type;
    const url = new URL(`${ctx.url}/api/settings/background${route}`); if (token && method === 'GET') url.searchParams.set('token', ctx.token);
    return fetch(url, { method, headers, body });
  }
  try {
    assert.equal((await call('', 'GET', undefined, undefined, false)).status, 401);
    assert.equal((await call('/upload?revision=0&opacity=35', 'POST', png, 'image/png', true, false)).status, 403);
    let r = await call('/upload?revision=0&opacity=35', 'POST', png, 'image/png'); assert.equal(r.status, 200); const first = await r.json(); assert.equal(first.revision, 1);
    r = await call(`/image/${first.image_id}`); assert.equal(r.status, 200); assert.deepEqual(Buffer.from(await r.arrayBuffer()), png);
    const payload = JSON.stringify({ revision: 1, image_id: first.image_id, opacity: 50 });
    const pair = await Promise.all([call('', 'PUT', payload, 'application/json'), call('', 'PUT', payload, 'application/json')]); assert.deepEqual(pair.map(x => x.status).sort(), [200,409]);
    assert.equal((await call('/upload?revision=2&opacity=35', 'POST', png, 'image/gif')).status, 415);
    await ctx.stop(); ctx = await startServer({ stateDir });
    r = await call(''); assert.equal((await r.json()).opacity, 50);
    r = await call('', 'PUT', JSON.stringify({ revision: 2, image_id: null, opacity: 0 }), 'application/json'); assert.equal(r.status, 200); assert.equal((await r.json()).opacity, 35);
    assert.deepEqual(await fs.readdir(`${stateDir}/backgrounds`), []);
  } finally { await ctx.stop(); }
});
