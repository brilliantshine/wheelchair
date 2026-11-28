'use strict';
const { atomicWrite } = require('./state.js');
const DEFAULT = Object.freeze({ mode: 'dark', preset: 'default', accent: null, revision: 0 });
const MODES = ['system', 'light', 'dark'];
const PRESETS = ['default', 'midnight', 'forest', 'amber', 'rose', 'slate'];
function valid(raw, uppercase = false) {
  return raw && typeof raw === 'object' && !Array.isArray(raw) && MODES.includes(raw.mode) && PRESETS.includes(raw.preset) &&
    (raw.accent === null || (typeof raw.accent === 'string' && (uppercase ? /^#[0-9a-fA-F]{6}$/ : /^#[0-9a-f]{6}$/).test(raw.accent))) &&
    Number.isSafeInteger(raw.revision) && raw.revision >= 0;
}
function normalizeTheme(raw) { return valid(raw) ? { mode: raw.mode, preset: raw.preset, accent: raw.accent, revision: raw.revision } : { ...DEFAULT }; }
async function readBody(request, response) {
  const tooLarge = () => { request.pause(); response.setHeader('Connection', 'close'); response.once('finish', () => request.destroy()); return Object.assign(new Error('Request body too large'), { status: 413 }); };
  const length = request.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > 4096)) throw tooLarge();
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, done = false;
    request.on('data', chunk => { if (done) return; size += chunk.length; if (size > 4096) { done = true; reject(tooLarge()); } else chunks.push(chunk); });
    request.once('end', () => { if (!done) resolve(Buffer.concat(chunks)); });
    request.once('aborted', () => { if (!done) { done = true; reject(Object.assign(new Error('Interrupted request'), { status: 400 })); } });
    request.once('error', reject);
  });
}
async function handle(hub, request, response, url, bits, send) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (bits.length !== 2) return send(response, 404, { error: 'Route not found' });
  if (!['GET', 'PUT'].includes(request.method)) return send(response, 405, { error: 'Method not allowed' });
  if (request.method === 'GET') {
    try { return send(response, 200, normalizeTheme((await hub.state.settings(null))?.theme)); }
    catch { return send(response, 500, { error: 'Could not read settings.json' }); }
  }
  if ([...url.searchParams].length) return send(response, 400, { error: 'Invalid parameters' });
  let body;
  try { body = JSON.parse((await readBody(request, response)).toString('utf8')); }
  catch (error) { return send(response, error.status || 400, { error: error.status ? error.message : 'Invalid JSON' }); }
  if (!valid(body, true) || Object.keys(body).sort().join(',') !== 'accent,mode,preset,revision') return send(response, 400, { error: 'Invalid theme metadata' });
  body = { ...body, accent: body.accent?.toLowerCase() ?? null };
  return hub.state.queued(hub.state.settingsPath, async () => {
    let raw;
    try { raw = await hub.state.settings(null); }
    catch { return send(response, 500, { error: 'Could not read settings.json' }); }
    const settings = require('./settings.js').normalize(raw), current = settings.theme;
    if (body.revision !== current.revision) return send(response, 409, { error: 'Theme changed elsewhere', ...current });
    if (body.mode === current.mode && body.preset === current.preset && body.accent === current.accent) return send(response, 200, current);
    if (current.revision === Number.MAX_SAFE_INTEGER) return send(response, 400, { error: 'Revision limit reached' });
    settings.theme = { mode: body.mode, preset: body.preset, accent: body.accent, revision: current.revision + 1 };
    try { await atomicWrite(hub.state.settingsPath, `${JSON.stringify(settings, null, 2)}\n`); }
    catch { return send(response, 500, { error: 'Could not write settings.json' }); }
    return send(response, 200, settings.theme);
  });
}
module.exports = { DEFAULT, MODES, PRESETS, normalizeTheme, handle };
