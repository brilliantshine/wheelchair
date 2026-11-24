'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { appError, atomicWrite } = require('./state.js');
const format = require('../pages/background-format.js');
const DEFAULT = Object.freeze({ image_id: null, media_type: null, opacity: 35, revision: 0 });
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ID = /^[a-f0-9]{64}$/;
function normalizeMetadata(b) {
  const validImage = b && ((b.image_id === null && b.media_type === null) ||
    (typeof b.image_id === 'string' && ID.test(b.image_id) && TYPES.includes(b.media_type)));
  if (!validImage || !Number.isSafeInteger(b.revision) || b.revision < 0 ||
      !Number.isInteger(b.opacity) || b.opacity < 0 || b.opacity > 100) return { ...DEFAULT };
  return { image_id: b.image_id, media_type: b.media_type, opacity: b.opacity, revision: b.revision };
}
function dir(hub) { return path.join(hub.stateDir, 'backgrounds'); }
async function metadata(hub, b) {
  b ||= normalizeMetadata((await hub.state.settings(null))?.background);
  let missing = false;
  if (b.image_id) {
    try { await fs.access(path.join(dir(hub), b.image_id)); }
    catch { missing = true; }
  }
  return { ...b, image_url: b.image_id && !missing ? `/wheelchair/api/settings/background/image/${b.image_id}` : null, missing_image: missing };
}
async function cleanup(hub) {
  const current = normalizeMetadata((await hub.state.settings(null))?.background);
  await fs.mkdir(dir(hub), { recursive: true, mode: 0o700 });
  await fs.chmod(dir(hub), 0o700);
  for (const name of await fs.readdir(dir(hub))) {
    const owned = ID.test(name) || /^\.[a-f0-9]{64}\.[a-f0-9-]+\.tmp$/.test(name);
    if (owned && name !== current.image_id) await fs.unlink(path.join(dir(hub), name));
  }
}
async function sweep(hub) { return hub.state.queued(hub.state.settingsPath, () => cleanup(hub)).catch(e => console.error('Background cleanup failed:', e.message)); }
async function read(request, response, limit) {
  function oversized() {
    request.pause();
    response.setHeader('Connection', 'close');
    response.once('finish', () => request.destroy());
    return appError(413, 'Request body too large');
  }
  const length = request.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > limit)) throw oversized();
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, done = false;
    request.on('data', chunk => {
      if (done) return;
      size += chunk.length;
      if (size > limit) { done = true; reject(oversized()); }
      else chunks.push(chunk);
    });
    request.once('end', () => { if (!done) resolve(Buffer.concat(chunks)); });
    request.once('aborted', () => {
      if (!done) { done = true; reject(appError(400, 'Interrupted request')); }
    });
    request.once('error', error => { if (!done) { done = true; reject(error); } });
  });
}
function integer(n, max) { return Number.isSafeInteger(n) && n >= 0 && n <= max; }
async function commit(hub, revision, opacity, imageId, mediaType, bytes) {
  return hub.state.queued(hub.state.settingsPath, async () => {
    try {
      const settings = require('./settings.js').normalize(await hub.state.settings(null));
      const current = settings.background;
      if (revision !== current.revision) {
        const error = appError(409, 'Background changed elsewhere');
        error.background = await metadata(hub, current);
        throw error;
      }
      if (!bytes && imageId !== null && imageId !== current.image_id) throw appError(400, 'Image is not current');
      if (!bytes && imageId === current.image_id && (imageId === null || opacity === current.opacity)) return metadata(hub, current);
      if (current.revision === Number.MAX_SAFE_INTEGER) throw appError(400, 'Revision limit reached');
      if (bytes) {
        await fs.mkdir(dir(hub), { recursive: true, mode: 0o700 });
        await fs.chmod(dir(hub), 0o700);
        const imagePath = path.join(dir(hub), imageId);
        const reusable = imageId === current.image_id && await fs.access(imagePath).then(() => true, error => {
          if (error.code === 'ENOENT') return false;
          throw error;
        });
        if (!reusable) await atomicWrite(imagePath, bytes);
      }
      settings.background = {
        image_id: imageId, media_type: imageId ? (mediaType || current.media_type) : null,
        opacity: imageId ? opacity : 35, revision: current.revision + 1,
      };
      await atomicWrite(hub.state.settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
      return await metadata(hub, settings.background);
    } finally {
      // Read the committed reference inside the same queue, even after a failed write.
      try { await cleanup(hub); }
      catch (error) { console.error('Background cleanup failed:', error.message); }
    }
  });
}
async function sendCommit(hub, response, send, revision, opacity, imageId, mediaType, bytes) {
  try {
    const result = await commit(hub, revision, opacity, imageId, mediaType, bytes);
    return send(response, 200, result);
  } catch (error) {
    if (error.status === 409) return send(response, 409, { error: error.message, ...error.background });
    throw error;
  }
}
async function dispatch(hub, request, response, url, bits, send) {
  if (request.method === 'GET' && bits.length === 2) return send(response, 200, await metadata(hub));
  if (request.method === 'GET' && bits.length === 4 && bits[2] === 'image') {
    const id = bits[3];
    if (!ID.test(id)) throw appError(400, 'Invalid image ID');
    const current = normalizeMetadata((await hub.state.settings(null))?.background);
    if (id !== current.image_id) throw appError(404, 'Image not found');
    let data;
    try { data = await fs.readFile(path.join(dir(hub), id)); }
    catch (error) {
      if (error.code === 'ENOENT') throw appError(404, 'Image not found');
      throw error;
    }
    response.writeHead(200, { 'content-type': current.media_type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    return response.end(data);
  }
  if (request.method === 'POST' && bits.length === 3 && bits[2] === 'upload') {
    const keys = [...url.searchParams.keys()];
    if (keys.length !== 2 || keys.filter(k => k === 'revision').length !== 1 ||
        keys.filter(k => k === 'opacity').length !== 1 ||
        !/^\d+$/.test(url.searchParams.get('revision')) || !/^\d+$/.test(url.searchParams.get('opacity'))) {
      throw appError(400, 'Invalid parameters');
    }
    const revision = Number(url.searchParams.get('revision'));
    const opacity = Number(url.searchParams.get('opacity'));
    if (!integer(revision, Number.MAX_SAFE_INTEGER) || !integer(opacity, 100)) throw appError(400, 'Invalid parameters');
    const input = await read(request, response, 25 * 1024 * 1024);
    const type = request.headers['content-type'];
    if (!TYPES.includes(type)) throw appError(415, 'Unsupported image type');
    const parsed = format.normalize(input, type);
    const id = crypto.createHash('sha256').update(parsed.bytes).digest('hex');
    return sendCommit(hub, response, send, revision, opacity, id, type, parsed.bytes);
  }
  if (request.method === 'PUT' && bits.length === 2) {
    if ([...url.searchParams].length) throw appError(400, 'Invalid parameters');
    let body;
    try { body = JSON.parse((await read(request, response, 4096)).toString('utf8')); }
    catch (error) {
      if (error.status) throw error;
      throw appError(400, 'Invalid JSON');
    }
    const validId = body && (body.image_id === null || (typeof body.image_id === 'string' && ID.test(body.image_id)));
    if (!body || Array.isArray(body) || typeof body !== 'object' ||
        Object.keys(body).sort().join(',') !== 'image_id,opacity,revision' ||
        !integer(body.revision, Number.MAX_SAFE_INTEGER) || !integer(body.opacity, 100) || !validId) {
      throw appError(400, 'Invalid background metadata');
    }
    return sendCommit(hub, response, send, body.revision, body.opacity, body.image_id, null, null);
  }
  throw appError(404, 'Route not found');
}
async function handle(hub, request, response, url, bits, send) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    return await dispatch(hub, request, response, url, bits, send);
  } catch (error) {
    if (error.status) throw error;
    console.error('Background request failed:', error.message);
    throw appError(500, 'Background operation failed');
  }
}
module.exports = { normalizeMetadata, metadata, sweep, handle, commit };
