'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const fsc = require('node:fs').constants;

const TOOL_ROLES = new Set(['lead', 'sub-lead', 'worker', 'verifier']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// How a server is named in a skip line: bare when it is a plain name, JSON-quoted otherwise, so a
// name with control characters or spaces cannot break the line's text.
const serverLabel = name => /^[A-Za-z0-9_-]+$/.test(name) ? name : JSON.stringify(name);
const failure = (reason, hash = null) => ({ mcp: null, warnings: [{ names: [], text: `.mcp.json could not be read: ${JSON.stringify(reason)}` }], hash });

async function readProjectMcp(worktree) {
  try {
    const file = path.join(worktree, '.mcp.json');
    let info;
    try { info = await fs.stat(file); } catch (error) {
      if (error.code === 'ENOENT') return { mcp: null, warnings: [], hash: null };
      return failure(error.code || 'stat failed');
    }
    if (!info.isFile()) return failure('not a regular file');
    if (info.size > 32768) return failure('larger than 32 KiB');
    // Opened non-blocking and checked again on the open handle, so a file swapped for a pipe
    // after the stat above can neither block the start nor be read.
    let bytes, handle;
    try {
      handle = await fs.open(file, fsc.O_RDONLY | fsc.O_NONBLOCK);
      const opened = await handle.stat();
      if (!opened.isFile()) return failure('not a regular file');
      if (opened.size > 32768) return failure('larger than 32 KiB');
      bytes = await handle.readFile();
    } catch (error) { return failure(error.code || 'read failed'); } finally { await handle?.close().catch(() => {}); }
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    let data;
    try { data = JSON.parse(bytes.toString('utf8')); } catch { return failure('invalid JSON', hash); }
    if (!object(data) || !object(data.mcpServers)) return failure('mcpServers is not an object', hash);
    const names = Object.keys(data.mcpServers), servers = {}, warnings = [];
    for (const name of names) {
      const entry = data.mcpServers[name];
      const stdio = object(entry) && (entry.type === undefined || entry.type === 'stdio') && typeof entry.command === 'string' && entry.command.length > 0 && (entry.args === undefined || (Array.isArray(entry.args) && entry.args.every(arg => typeof arg === 'string'))) && (entry.env === undefined || (object(entry.env) && Object.values(entry.env).every(value => typeof value === 'string')));
      const http = object(entry) && (entry.type === 'http' || entry.type === 'sse') && typeof entry.url === 'string' && entry.url.length > 0 && (entry.headers === undefined || (object(entry.headers) && Object.values(entry.headers).every(value => typeof value === 'string')));
      if (stdio || http) Object.defineProperty(servers, name, { value: entry, enumerable: true, writable: true, configurable: true });
      else warnings.push({ names: [name], text: `${serverLabel(name)}: skipped: not a valid stdio, http or sse entry` });
    }
    return { mcp: { names, servers }, warnings, hash };
  } catch { return failure('read failed'); }
}
module.exports = { TOOL_ROLES, readProjectMcp, serverLabel };
