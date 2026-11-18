'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const TOOL_ROLES = new Set(['lead', 'sub-lead', 'worker', 'verifier']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = reason => ({ mcp: null, warnings: [`.mcp.json could not be read: ${JSON.stringify(reason)}`] });

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
    let text;
    try { text = await fs.readFile(file, 'utf8'); } catch (error) { return failure(error.code || 'read failed'); }
    let data;
    try { data = JSON.parse(text); } catch { return failure('invalid JSON'); }
    if (!object(data) || !object(data.mcpServers)) return failure('mcpServers is not an object');
    const names = Object.keys(data.mcpServers), servers = {}, warnings = [];
    for (const name of names) {
      const entry = data.mcpServers[name];
      const stdio = object(entry) && (entry.type === undefined || entry.type === 'stdio') && typeof entry.command === 'string' && entry.command.length > 0 && (entry.args === undefined || (Array.isArray(entry.args) && entry.args.every(arg => typeof arg === 'string'))) && (entry.env === undefined || (object(entry.env) && Object.values(entry.env).every(value => typeof value === 'string')));
      const http = object(entry) && entry.type === 'http' && typeof entry.url === 'string' && entry.url.length > 0;
      if (stdio || http) Object.defineProperty(servers, name, { value: entry, enumerable: true, writable: true, configurable: true });
      else warnings.push(`server ${JSON.stringify(name)} skipped: not a valid stdio or http entry`);
    }
    return { mcp: { names, servers }, warnings };
  } catch { return failure('read failed'); }
}
module.exports = { TOOL_ROLES, readProjectMcp };
