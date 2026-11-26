'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { projectIdentity } = require('./project-keys');
const { repoName } = require('./project-tools');

const locks = new Map();
const building = new Set();
const rootFor = (stateDir, identity) => path.resolve(stateDir, 'shared-tools', identity);
const line = error => String(error?.message || error).replace(/[\r\n]+/g, ' ').trim();
function command(program, args, deadline, input) {
  return new Promise((resolve, reject) => {
    const left = deadline - Date.now();
    if (left <= 0) return reject(new Error(`${program} timed out`));
    const child = spawn(program, args, { detached: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    let stdout = [], stderr = [], settled = false;
    const finish = (err, result) => { if (settled) return; settled = true; clearTimeout(timer); err ? reject(err) : resolve(result); };
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy(); finish(new Error(`${program} timed out`)); }, left);
    child.on('error', e => finish(e));
    child.stdout.on('data', b => stdout.push(b)); child.stderr.on('data', b => stderr.push(b));
    child.stdin.on('error', () => {});
    child.on('close', code => { const out = Buffer.concat(stdout), err = Buffer.concat(stderr).toString().trim(); finish(code === 0 ? null : new Error(`${program} failed${err ? ': ' + err : ''}`), out); });
    child.stdin.end(input);
  });
}
async function identityFor(projectPath) {
  const identity = await projectIdentity(projectPath);
  return crypto.createHash('sha256').update(identity).digest('hex');
}
async function findSharedProject(repo, candidates) {
  for (const candidate of candidates) {
    try {
      await projectIdentity(candidate);
      const url = (await command('git', ['-C', candidate, 'config', '--get', 'remote.origin.url'], Date.now() + 5000)).toString().trim();
      if (repoName(url)?.toLowerCase() === repo.toLowerCase()) return path.resolve(candidate);
    } catch {}
  }
  return null;
}
function newestCopy(stateDir, identity) {
  try {
    const root = rootFor(stateDir, identity), commit = fs.readFileSync(path.join(root, 'current'), 'utf8').trim();
    if (!/^[a-f0-9]{40,64}$/.test(commit)) return null;
    const copy = path.join(root, commit);
    return fs.statSync(copy).isDirectory() ? copy : null;
  } catch { return null; }
}
function lastRefresh(stateDir, identity) {
  try { return JSON.parse(fs.readFileSync(path.join(rootFor(stateDir, identity), 'last-refresh.json'), 'utf8')); } catch { return null; }
}
async function writable(dir) {
  let entries; try { await fsp.chmod(dir, 0o700); entries = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  for (const entry of entries) if (entry.isDirectory()) await writable(path.join(dir, entry.name));
}
async function remove(dir) { await writable(dir); await fsp.rm(dir, { recursive: true, force: true }); }
async function readonly(dir, deadline) {
  if (Date.now() >= deadline) throw new Error('copy build timed out');
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await readonly(file, deadline);
    else if (entry.isFile()) { const mode = (await fsp.stat(file)).mode; await fsp.chmod(file, mode & 0o111 ? 0o555 : 0o444); }
  }
  await fsp.chmod(dir, 0o555);
}
async function atomic(file, data) {
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  try { await fsp.writeFile(tmp, data); await fsp.rename(tmp, file); } finally { await fsp.rm(tmp, { force: true }); }
}
async function refreshShared({ stateDir, projectPath, deadlineMs = 20000 }) {
  const deadline = Date.now() + deadlineMs;
  let identity;
  try {
    const raw = await projectIdentity(projectPath, async (p, args) => ({ ok: true, stdout: (await command(p, args, deadline)).toString() }));
    identity = crypto.createHash('sha256').update(raw).digest('hex');
  } catch (e) { return { identity: null, copy: null, commit: null, error: line(e) }; }
  const existing = locks.get(identity);
  if (existing) {
    let timer;
    const result = await Promise.race([existing, new Promise(resolve => { timer = setTimeout(() => resolve(null), Math.max(0, deadline - Date.now())); })]);
    clearTimeout(timer);
    if (result) return result;
    const copy = newestCopy(stateDir, identity);
    return { identity, copy, commit: copy ? path.basename(copy) : null, error: 'refresh was still running at the deadline' };
  }
  const work = (async () => {
    const root = rootFor(stateDir, identity); let temp;
    try {
      await fsp.mkdir(root, { recursive: true });
      const git = (...args) => command('git', ['-C', projectPath, ...args], deadline);
      const remote = (await git('ls-remote', '--symref', 'origin', 'HEAD')).toString();
      const branch = /^ref: refs\/heads\/(.+)\s+HEAD$/m.exec(remote)?.[1];
      if (!branch) throw new Error('could not determine default branch');
      const ref = `refs/wheelchair/shared-tools/${crypto.randomUUID()}`;
      let commit;
      try {
        await git('fetch', '--no-write-fetch-head', '--no-tags', 'origin', `+refs/heads/${branch}:${ref}`);
        commit = (await git('rev-parse', '--verify', `${ref}^{commit}`)).toString().trim();
      } finally { if (Date.now() < deadline) await git('update-ref', '-d', ref).catch(() => {}); }
      const copy = path.join(root, commit);
      if (!fs.existsSync(copy)) {
        temp = await fsp.mkdtemp(path.join(root, '.tmp-')); building.add(temp);
        const exists = (await git('ls-tree', commit, '--', '.wheelchair/tools')).length > 0;
        if (exists) {
          const archive = await git('archive', commit, '.wheelchair/tools');
          await command('tar', ['-x', '-C', temp], deadline, archive);
        }
        await readonly(temp, deadline);
        if (Date.now() >= deadline) throw new Error('copy build timed out');
        await fsp.rename(temp, copy); building.delete(temp); temp = null;
      }
      if (Date.now() >= deadline) throw new Error('copy build timed out');
      await atomic(path.join(root, 'current'), `${commit}\n`);
      await atomic(path.join(root, 'last-refresh.json'), JSON.stringify({ at: new Date().toISOString(), ok: true, error: null }));
      return { identity, copy, commit, error: null };
    } catch (e) {
      if (temp) { building.delete(temp); await remove(temp).catch(() => {}); }
      const error = line(e); const copy = newestCopy(stateDir, identity);
      await fsp.mkdir(root, { recursive: true }).then(() => atomic(path.join(root, 'last-refresh.json'), JSON.stringify({ at: new Date().toISOString(), ok: false, error }))).catch(() => {});
      return { identity, copy, commit: copy ? path.basename(copy) : null, error };
    }
  })();
  locks.set(identity, work);
  try { return await work; } finally { if (locks.get(identity) === work) locks.delete(identity); }
}
async function cleanupCopies(stateDir, inUse) {
  const root = path.resolve(stateDir, 'shared-tools');
  let identities; try { identities = await fsp.readdir(root, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  for (const entry of identities) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name), newest = newestCopy(stateDir, entry.name);
    for (const item of await fsp.readdir(dir, { withFileTypes: true })) {
      if (!item.isDirectory() || (!/^[a-f0-9]{40,64}$/.test(item.name) && !item.name.startsWith('.tmp-'))) continue;
      const copy = path.join(dir, item.name);
      if (copy !== newest && !inUse.has(copy) && !building.has(copy)) await remove(copy);
    }
  }
}
module.exports = { findSharedProject, identityFor, refreshShared, newestCopy, lastRefresh, cleanupCopies };
