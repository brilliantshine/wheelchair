'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify, getSystemErrorMap } = require('node:util');
const adapters = require('../adapters');
const KEY_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const exact = ['IFS', 'OPTIND', 'OPTARG', 'PS1', 'PS2', 'PS4', 'PPID', 'ENV', 'CDPATH', 'HISTFILE', 'MAIL', 'MAILPATH', 'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TERM', 'TMPDIR', 'PWD', 'LANG', 'TZ', 'NODE_OPTIONS', 'NODE_PATH', 'NODE_EXTRA_CA_CERTS', 'PYTHONPATH', 'PYTHONHOME', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'GITHUB_TOKEN', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID'];
const prefixes = ['LD_', 'DYLD_', 'LC_', 'XDG_', 'TMUX', 'SSH_', 'DBUS_', 'GIT_', 'GH_', 'WHEELCHAIR_', 'CLAUDE_', 'CODEX_', 'ANTHROPIC_'];
function reservedNames() { return { exact: [...new Set([...exact, ...Object.values(adapters).flatMap(a => Object.keys(a.loginEnv('x')))])], prefixes: [...prefixes] }; }
function isReserved(name) { const rules = reservedNames(); return rules.exact.some(key => key.toUpperCase() === name.toUpperCase()) || rules.prefixes.some(prefix => name.startsWith(prefix)); }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function keyReferences(mcpServers) {
  const references = Object.create(null), heldBack = Object.create(null);
  const add = (map, name, value) => { if (!Object.hasOwn(map, name)) Object.defineProperty(map, name, { value: [], enumerable: true }); if (!map[name].some(item => JSON.stringify(item) === JSON.stringify(value))) map[name].push(value); };
  const scan = (value, tool, field) => {
    if (typeof value !== 'string') return;
    const names = text => { for (const match of text.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)/g)) add(heldBack, match[1], { tool, field }); };
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== '$' || value[i + 1] !== '{') continue;
      const start = i; let depth = 1; i += 2;
      for (; i < value.length && depth; i++) {
        if (value[i] === '{') depth++;
        else if (value[i] === '}') depth--;
      }
      if (depth) { names(value); return; }
      names(value.slice(start, i)); i--;
    }
  };
  if (!object(mcpServers)) return { references, heldBack };
  for (const [tool, entry] of Object.entries(mcpServers)) {
    if (!object(entry)) continue;
    scan(entry.command, tool, 'command'); if (Array.isArray(entry.args)) for (const arg of entry.args) scan(arg, tool, 'args'); scan(entry.url, tool, 'url');
    const eligible = value => { if (KEY_NAME.test(value) && !isReserved(value)) add(references, value, tool); };
    if ((entry.type === undefined || entry.type === 'stdio') && object(entry.env)) for (const value of Object.values(entry.env)) { if (typeof value !== 'string') continue; const match = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value); if (match) eligible(match[1]); }
    if (entry.type === 'http' && object(entry.headers)) for (const value of Object.values(entry.headers)) { if (typeof value !== 'string') continue; for (const match of value.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) eligible(match[1]); }
  }
  return { references, heldBack };
}
async function projectIdentity(dir, runner) {
  let output;
  if (runner) { const result = await runner('git', ['-C', dir, 'rev-parse', '--git-common-dir']); if (!result.ok) throw new Error(result.stderr || 'git rev-parse failed'); output = result.stdout; }
  else output = (await promisify(execFile)('git', ['-C', dir, 'rev-parse', '--git-common-dir'])).stdout;
  return fs.realpath(path.resolve(dir, output.trim()));
}
function storePath(stateDir, identity) { return path.join(stateDir, 'project-keys', `${crypto.createHash('sha256').update(identity).digest('hex')}.json`); }
const fsCodes = new Set([...getSystemErrorMap().values()].map(([code]) => code));
function storeError(message, error) {
  const safe = new Error(message);
  if (typeof error?.code === 'string' && fsCodes.has(error.code)) safe.code = error.code;
  return safe;
}
async function readKeyStore(stateDir, identity) {
  try { const store = JSON.parse(await fs.readFile(storePath(stateDir, identity), 'utf8')); if (store.project !== identity || !Number.isSafeInteger(store.revision) || store.revision < 0 || !object(store.keys) || !Object.values(store.keys).every(v => typeof v === 'string')) throw new Error('invalid project key store'); store.keys = Object.assign(Object.create(null), store.keys); return store; }
  catch (error) { if (error.code === 'ENOENT') return { project: identity, revision: 0, keys: Object.create(null) }; throw storeError("the key store on this machine can't be read", error); }
}
async function writeKeyStore(stateDir, identity, changes) {
  try {
    const old = await readKeyStore(stateDir, identity), keys = Object.assign(Object.create(null), old.keys, changes.set);
    for (const name of changes.remove || []) delete keys[name];
    const store = { project: identity, revision: old.revision + 1, keys }, file = storePath(stateDir, identity);
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${crypto.randomUUID()}.tmp`;
    try { await fs.writeFile(temp, `${JSON.stringify(store)}\n`, { mode: 0o600, flag: 'wx' }); await fs.rename(temp, file); }
    finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    return store;
  } catch (error) { throw storeError("the key store on this machine can't be written", error); }
}
function launchKeys(mcpServers, store) {
  const { references, heldBack } = keyReferences(mcpServers), env = Object.create(null);
  for (const name of Object.keys(references)) if (!Object.hasOwn(heldBack, name) && Object.hasOwn(store.keys, name)) Object.defineProperty(env, name, { value: store.keys[name], enumerable: true });
  return { env, heldBack: Object.keys(references).filter(name => Object.hasOwn(heldBack, name) && Object.hasOwn(store.keys, name)) };
}
module.exports = { KEY_NAME, reservedNames, isReserved, keyReferences, projectIdentity, readKeyStore, writeKeyStore, launchKeys };
