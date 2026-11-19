'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const fsc = require('node:fs').constants;

const TOOL_ROLES = new Set(['lead', 'sub-lead', 'worker', 'verifier']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = reason => ({ mcp: null, warnings: [`.mcp.json could not be read: ${JSON.stringify(reason)}`] });

function checkDocumentText(text) {
  if (Buffer.byteLength(text, 'utf8') > 32768) return { ok: false, reason: 'larger than 32 KiB' };
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, reason: 'invalid JSON' }; }
  if (!object(data) || !object(data.mcpServers)) return { ok: false, reason: 'mcpServers is not an object' };
  return { ok: true, data };
}
function entryReason(name, entry) {
  const stdio = object(entry) && (entry.type === undefined || entry.type === 'stdio') && typeof entry.command === 'string' && entry.command.length > 0 && (entry.args === undefined || (Array.isArray(entry.args) && entry.args.every(arg => typeof arg === 'string'))) && (entry.env === undefined || (object(entry.env) && Object.values(entry.env).every(value => typeof value === 'string')));
  const http = object(entry) && entry.type === 'http' && typeof entry.url === 'string' && entry.url.length > 0;
  return stdio || http ? null : 'not a valid stdio or http entry';
}
async function readProjectMcp(worktree) {
  try {
    const file = path.join(worktree, '.mcp.json');
    let info;
    try { info = await fs.stat(file); } catch (error) {
      if (error.code === 'ENOENT') return { mcp: null, warnings: [] };
      return failure(error.code || 'stat failed');
    }
    if (!info.isFile()) return failure('not a regular file');
    if (info.size > 32768) return failure('larger than 32 KiB');
    // Opened non-blocking and checked again on the open handle, so a file swapped for a pipe
    // after the stat above can neither block the start nor be read.
    let text, handle;
    try {
      handle = await fs.open(file, fsc.O_RDONLY | fsc.O_NONBLOCK);
      const opened = await handle.stat();
      if (!opened.isFile()) return failure('not a regular file');
      if (opened.size > 32768) return failure('larger than 32 KiB');
      text = await handle.readFile('utf8');
    } catch (error) { return failure(error.code || 'read failed'); } finally { await handle?.close().catch(() => {}); }
    const checked = checkDocumentText(text);
    if (!checked.ok) return failure(checked.reason);
    const { data } = checked;
    const names = Object.keys(data.mcpServers), servers = {}, warnings = [];
    for (const name of names) {
      const entry = data.mcpServers[name];
      const reason = entryReason(name, entry);
      if (!reason) Object.defineProperty(servers, name, { value: entry, enumerable: true, writable: true, configurable: true });
      else warnings.push(`server ${JSON.stringify(name)} skipped: ${reason}`);
    }
    return { mcp: { names, servers, rawServers: data.mcpServers }, warnings };
  } catch { return failure('read failed'); }
}
module.exports = { TOOL_ROLES, readProjectMcp, entryReason, checkDocumentText };
