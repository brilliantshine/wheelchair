'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const fsc = require('node:fs').constants;

const DUPLICATE_HEADERS = Symbol('duplicate headers');
const TOOL_ROLES = new Set(['lead', 'sub-lead', 'worker', 'verifier']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// How a server is named in a skip line: bare when it is a plain name, JSON-quoted otherwise, so a
// name with control characters or spaces cannot break the line's text.
const serverLabel = name => /^[A-Za-z0-9_-]+$/.test(name) ? name : JSON.stringify(name);
const failure = (reason, hash = null) => ({ mcp: null, warnings: [{ names: [], text: `.mcp.json could not be read: ${JSON.stringify(reason)}` }], hash });

// JSON.parse has already validated the text, but discards repeated object keys.
function duplicateHeaderServers(text) {
  const duplicates = new Set();
  let i = 0;
  function string() {
    const start = i++;
    while (text[i] !== '"') {
      if (text[i] === '\\') i++;
      i++;
    }
    return JSON.parse(text.slice(start, ++i));
  }
  const stack = [];
  while (i < text.length) {
    const char = text[i];
    const frame = stack[stack.length - 1];
    if (char === '{' || char === '[') {
      const key = frame?.type === 'object' ? frame.key : null;
      const headers = char === '{' && stack.length === 3 &&
        stack[0].type === 'object' && stack[1].type === 'object' &&
        stack[1].pathKey === 'mcpServers' && stack[2].type === 'object' && key === 'headers';
      stack.push({ type: char === '{' ? 'object' : 'array', pathKey: key, key: null, expectingKey: char === '{', seen: headers ? new Set() : null });
      i++;
    } else if (char === '}' || char === ']') {
      stack.pop();
      i++;
    } else if (char === '"') {
      const token = string();
      if (frame?.type === 'object' && frame.expectingKey) {
        frame.key = token;
        frame.expectingKey = false;
        if (stack.length === 1 && token === 'mcpServers') duplicates.clear();
        if (stack.length === 2 && stack[0].type === 'object' && frame.pathKey === 'mcpServers') duplicates.delete(token);
        if (stack.length === 3 && stack[0].type === 'object' && stack[1].type === 'object' &&
            stack[1].pathKey === 'mcpServers' && token === 'headers') duplicates.delete(frame.pathKey);
        if (frame.seen) {
          const lower = token.toLowerCase();
          if (frame.seen.has(lower)) duplicates.add(stack[2].pathKey);
          frame.seen.add(lower);
        }
      }
    } else if (char === ',') {
      if (frame?.type === 'object') frame.expectingKey = true;
      i++;
    } else if (char === ':' || ' \t\r\n'.includes(char)) {
      i++;
    } else {
      while (i < text.length && !' \t\r\n,]}'.includes(text[i])) i++;
    }
  }
  return duplicates;
}

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
    const duplicates = duplicateHeaderServers(bytes.toString('utf8'));
    for (const name of Object.keys(servers)) {
      const entry = servers[name];
      if ((entry.type === 'http' || entry.type === 'sse') && duplicates.has(name)) entry[DUPLICATE_HEADERS] = true;
    }
    return { mcp: { names, servers }, warnings, hash };
  } catch { return failure('read failed'); }
}
module.exports = { DUPLICATE_HEADERS, TOOL_ROLES, readProjectMcp, serverLabel };
