'use strict';
const fs = require('fs');
const path = require('path');
const { validateHeaderValue } = require('http');
const { windowsTarget } = require('./win-mark');
const { KEY_NAME, isReserved } = require('./project-keys');
const NAME_RE = /^[A-Za-z0-9_-]{1,40}$/;
const RESERVED = 'wheelchair-tools';
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function validateToolJson(folderName, value) {
  const bad = field => { const parts = field.split('.'); let parent = value; for (const part of parts.slice(0, -1)) parent = object(parent) ? parent[part] : undefined; const missing = !object(parent) || !Object.hasOwn(parent, parts.at(-1)); return { ok: false, reason: missing ? `tool.json is missing "${field}"` : `tool.json has an invalid "${field}"` }; };
  if (!NAME_RE.test(folderName) || folderName === RESERVED) return bad('name');
  if (!object(value)) return bad('name');
  if (value.name !== folderName) return bad('name');
  if (typeof value.description !== 'string' || !value.description.trim() || /[\r\n]/.test(value.description)) return bad('description');
  if (!['script', 'server'].includes(value.kind)) return bad('kind');
  if (Object.hasOwn(value, 'keys') && (!Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 20 || new Set(value.keys).size !== value.keys.length || !value.keys.every(k => typeof k === 'string' && KEY_NAME.test(k) && !isReserved(k)))) return bad('keys');
  const tool = { name: value.name, description: value.description, kind: value.kind, keys: value.keys ? value.keys.slice() : [] };
  const argv = field => Array.isArray(value[field]) && value[field].length > 0 && value[field].every(x => typeof x === 'string' && x.length > 0);
  if (value.kind === 'server') {
    const start = Object.hasOwn(value, 'start'), url = Object.hasOwn(value, 'url');
    if (start && url) return { ok: false, reason: 'tool.json cannot have both "start" and "url"' };
    if (!url) {
      if (!argv('start')) return bad('start');
      if (Object.hasOwn(value, 'headers')) return bad('headers');
      if (Object.hasOwn(value, 'windows')) return bad('windows');
      tool.start = value.start.slice(); tool.transport = 'stdio';
    } else {
      try { if (typeof value.url !== 'string' || /[\s\x00-\x1f\x7f]/.test(value.url) || !['http:', 'https:'].includes(new URL(value.url).protocol)) return bad('url'); } catch { return bad('url'); }
      tool.url = value.url; tool.transport = 'http';
      if (Object.hasOwn(value, 'headers')) {
        if (!object(value.headers) || ![Object.prototype, null].includes(Object.getPrototypeOf(value.headers)) || Object.keys(value.headers).length > 20) return bad('headers');
        const seen = new Set();
        for (const [key, val] of Object.entries(value.headers)) {
          const lower = key.toLowerCase();
          if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(key) || seen.has(lower) || ['accept', 'content-type', 'mcp-protocol-version', 'mcp-session-id'].includes(lower) || typeof val !== 'string' || !val || /[\r\n]/.test(val)) return bad('headers');
          seen.add(lower);
          try { validateHeaderValue(key, val); } catch { return bad('headers'); }
          let rest = val;
          while (rest.includes('${')) { const at = rest.indexOf('${'), match = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}/.exec(rest.slice(at)); if (!match || !tool.keys.includes(match[1])) return bad('headers'); rest = rest.slice(at + match[0].length); }
        }
        tool.headers = { ...value.headers };
      }
      if (Object.hasOwn(value, 'windows')) { if (typeof value.windows !== 'boolean' || (value.windows && !windowsTarget({ type: 'http', url: tool.url }))) return bad('windows'); tool.windows = value.windows; }
    }
  } else {
    if (Object.hasOwn(value, 'headers')) return bad('headers');
    if (Object.hasOwn(value, 'windows')) return bad('windows');
    if (!object(value.inputs)) return bad('inputs');
    tool.inputs = {};
    for (const [name, input] of Object.entries(value.inputs)) {
      if (!object(input) || !['string','number','boolean','object','array'].includes(input.type)) return bad(`inputs.${name}.type`);
      if (typeof input.description !== 'string' || !input.description.trim()) return bad(`inputs.${name}.description`);
      if (typeof input.required !== 'boolean') return bad(`inputs.${name}.required`);
      Object.defineProperty(tool.inputs, name, { value: { type: input.type, description: input.description, required: input.required }, enumerable: true, writable: true, configurable: true });
    }
    if (!argv('run')) return bad('run');
    tool.run = value.run.slice();
    if (value.timeout_seconds !== undefined && (!Number.isInteger(value.timeout_seconds) || value.timeout_seconds < 1 || value.timeout_seconds > 240)) return bad('timeout_seconds');
    tool.timeout_seconds = value.timeout_seconds === undefined ? 120 : value.timeout_seconds;
  }
  return { ok: true, tool };
}
function findProgram(argv0, toolDir, pathText) {
  const candidates = argv0.includes('/') ? [path.resolve(toolDir, argv0)] : (pathText || '').split(path.delimiter).map(p => path.resolve(toolDir, p || '.', argv0));
  return candidates.some(p => { try { return fs.statSync(p).isFile() && (fs.accessSync(p, fs.constants.X_OK), true); } catch { return false; } });
}
async function readToolsDir(root, source) {
  const base = path.resolve(root, '.wheelchair/tools');
  let entries;
  try { entries = await fs.promises.readdir(base, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return []; throw e; }
  const rows = [];
  for (const ent of entries.filter(e => e.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
    const dir = path.join(base, ent.name), row = { name: ent.name, source, dir, kind: null, tool: null, status: 'invalid', reason: null };
    try {
      const file = path.join(dir, 'tool.json'), stat = await fs.promises.stat(file);
      if (!stat.isFile()) throw new Error('tool.json is not a regular file');
      if (stat.size > 32768) throw new Error('tool.json is over 32 KiB');
      const content = await fs.promises.readFile(file, 'utf8');
      let value; try { value = JSON.parse(content); } catch { throw new Error('tool.json is not JSON'); }
      const result = validateToolJson(ent.name, value);
      if (!result.ok) throw new Error(result.reason);
      row.tool = result.tool; row.kind = result.tool.kind; row.status = 'ok';
    } catch (e) { row.reason = e.code === 'ENOENT' ? 'tool.json is missing' : e.message; }
    rows.push(row);
  }
  return rows;
}
async function discover({ worktree, shared, path: pathText }) {
  const project = await readToolsDir(worktree, 'project'), others = shared ? await readToolsDir(shared, 'shared') : [];
  const names = new Set(project.map(r => r.name));
  for (const row of [...project, ...others]) {
    if (row.source === 'shared' && names.has(row.name)) { row.status = 'hidden'; row.reason = 'hidden: this project has its own tool with the same name'; }
    else if (row.status === 'ok' && row.tool.transport !== 'http') { const program = row.tool.kind === 'script' ? row.tool.run[0] : row.tool.start[0]; if (!findProgram(program, row.dir, pathText)) { row.status = 'missing-program'; row.reason = `its program ${program} wasn't found`; } }
  }
  const rows = [...project, ...others];
  return { rows, usable: rows.filter(r => r.status === 'ok'), problems: rows.filter(r => r.status !== 'ok').map(r => ({ names: [r.name], text: `${r.source === 'shared' ? 'shared tool' : 'tool'} ${r.name}: ${r.reason}` })) };
}
function inputSchema(inputs) {
  const properties = {}, required = [];
  for (const [name, input] of Object.entries(inputs)) { Object.defineProperty(properties, name, { value: { type: input.type, description: input.description }, enumerable: true }); if (input.required) required.push(name); }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}
function bridgeEntry(worktree, rows, { stateDir } = {}) { return { name: RESERVED, folder: 'bridge', entry: { type: 'stdio', command: process.execPath, args: [path.join(__dirname, 'tool-bridge.js'), '--project-dir', worktree, ...(rows.some(r => r.tool?.keys?.length) ? ['--state-dir', stateDir] : []), ...rows.flatMap(r => ['--tool', r.dir, ...(r.tool?.keys?.length ? ['--key-store', r.key_store, ...r.tool.keys.flatMap(k => ['--key', k])] : [])])], env: {} } }; }
function serverEntry(worktree, row, { stateDir, urlOverride } = {}) {
  if (row.tool?.transport === 'http') {
    const entry = row.tool.keys.length ? { command: process.execPath, args: [path.join(__dirname, 'http-tool-proxy.js'), '--project-dir', worktree, '--tool', row.dir, '--state-dir', stateDir, '--key-store', row.key_store, ...row.tool.keys.flatMap(k => ['--key', k]), ...(urlOverride ? ['--url-override', urlOverride] : [])], env: {} } : { type: 'http', url: urlOverride || row.tool.url, ...(row.tool.headers ? { headers: row.tool.headers } : {}) };
    return { name: row.name, folder: 'server', windows: false, wrapped: false, entry };
  }
  return { name: row.name, folder: 'server', entry: { type: 'stdio', command: process.execPath, args: [path.join(__dirname, 'tool-launch.js'), '--project-dir', worktree, '--tool', row.dir, ...(row.tool?.keys?.length ? ['--state-dir', stateDir, '--key-store', row.key_store, ...row.tool.keys.flatMap(k => ['--key', k])] : [])], env: {} } };
} 
function toolKeyStore(row, ownShared) { return row.source === 'shared' || ownShared ? 'shared' : 'project'; }
module.exports = { toolKeyStore, NAME_RE, RESERVED, validateToolJson, readToolsDir, findProgram, discover, inputSchema, bridgeEntry, serverEntry };
