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
const cleaning = new Map();
const rootFor = (stateDir, identity) => path.resolve(stateDir, 'shared-tools', identity);
const line = error => String(error?.message || error).split(/[\r\n]/, 1)[0].trim().slice(0, 200);
function command(program, args, deadline, input, limitMs = Math.max(0, deadline - Date.now())) {
  const step = program === 'git' ? `git ${args.find(a => ['rev-parse', 'ls-remote', 'fetch', 'update-ref', 'for-each-ref', 'ls-tree', 'archive', 'remote', 'config'].includes(a)) || 'command'}` : program;
  const limit = `${Number((limitMs / 1000).toFixed(3))} s`;
  return new Promise((resolve, reject) => {
    const left = deadline - Date.now();
    if (left <= 0) return reject(new Error(`${step} timed out after ${limit}`));
    const child = spawn(program, args, { detached: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    let stdout = [], stderr = [], settled = false, timedOut = false;
    const finish = (err, result) => { if (settled) return; settled = true; clearTimeout(timer); err ? reject(err) : resolve(result); };
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGKILL'); } catch {} child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy(); }, left);
    child.on('error', e => finish(new Error(`${step} failed: ${line(e)}`)));
    child.stdout.on('data', b => stdout.push(b)); child.stderr.on('data', b => stderr.push(b));
    child.stdin.on('error', () => {});
    child.on('close', code => { const out = Buffer.concat(stdout), err = line(Buffer.concat(stderr).toString()); finish(timedOut ? new Error(`${step} timed out after ${limit}`) : code === 0 ? null : new Error(`${step} failed${err ? ': ' + err : ''}`), out); });
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
      let url;
      try { url = (await command('git', ['-C', candidate, 'remote', 'get-url', 'origin'], Date.now() + 5000)).toString().trim(); } catch {}
      if (!url || !repoName(url)) url = (await command('git', ['-C', candidate, 'config', '--get', 'remote.origin.url'], Date.now() + 5000)).toString().trim();
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
async function readonly(dir, deadline, limitMs) {
  if (Date.now() >= deadline) throw new Error(`copy build timed out after ${Number((limitMs / 1000).toFixed(3))} s`);
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await readonly(file, deadline, limitMs);
    else if (entry.isFile()) { const mode = (await fsp.stat(file)).mode; await fsp.chmod(file, mode & 0o111 ? 0o555 : 0o444); }
  }
  await fsp.chmod(dir, 0o555);
}
async function atomic(file, data) {
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  try { await fsp.writeFile(tmp, data); await fsp.rename(tmp, file); } finally { await fsp.rm(tmp, { force: true }); }
}
function outcomeText(stateDir, identity) {
  try { return fs.readFileSync(path.join(rootFor(stateDir, identity), 'last-refresh.json'), 'utf8'); } catch { return null; }
}
function recordOutcome(stateDir, identity, ok, error, expected) {
  const root = rootFor(stateDir, identity);
  try {
    fs.mkdirSync(root, { recursive: true });
    if (expected !== undefined && outcomeText(stateDir, identity) !== expected) return;
    const file = path.join(root, 'last-refresh.json'), tmp = `${file}.${crypto.randomUUID()}.tmp`;
    try { fs.writeFileSync(tmp, JSON.stringify({ at: new Date().toISOString(), ok, error })); fs.renameSync(tmp, file); } finally { fs.rmSync(tmp, { force: true }); }
  } catch {}
}
async function clearPrivateRefs(projectPath, commonDir, deadline = Date.now() + 3000, limitMs = 3000) {
  const refDir = path.join(commonDir, 'refs/wheelchair/shared-tools');
  async function clearLocks(dir) {
    let entries; try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await clearLocks(file);
      else if (entry.name.endsWith('.lock')) await fsp.rm(file, { force: true });
    }
  }
  await clearLocks(refDir);
  const git = (...args) => command('git', ['-C', projectPath, ...args], deadline, undefined, limitMs);
  const refs = (await git('for-each-ref', '--format=%(refname)', 'refs/wheelchair/shared-tools/')).toString().trim().split('\n').filter(Boolean);
  for (const ref of refs) await git('update-ref', '-d', ref);
}
async function refreshShared({ stateDir, projectPath, deadlineMs = 20000 }) {
  const deadline = Date.now() + deadlineMs;
  let identity, commonDir;
  try {
    commonDir = await projectIdentity(projectPath, async (p, args) => ({ ok: true, stdout: (await command(p, args, deadline, undefined, deadlineMs)).toString() }));
    identity = crypto.createHash('sha256').update(commonDir).digest('hex');
  } catch (e) { return { identity: null, copy: null, commit: null, error: line(e.message?.startsWith('git rev-parse') ? e : `git rev-parse failed: ${line(e)}`) }; }
  const cleanup = cleaning.get(identity);
  if (cleanup) {
    let timer;
    const finished = await Promise.race([cleanup.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), Math.max(0, deadline - Date.now())); })]);
    clearTimeout(timer);
    if (!finished) {
      const error = `cleanup was still running after ${Number((deadlineMs / 1000).toFixed(3))} s`, copy = newestCopy(stateDir, identity);
      recordOutcome(stateDir, identity, false, error);
      return { identity, copy, commit: copy ? path.basename(copy) : null, error };
    }
  }
  const existing = locks.get(identity);
  if (existing) {
    let timer; const prior = outcomeText(stateDir, identity);
    const result = await Promise.race([existing, new Promise(resolve => { timer = setTimeout(() => resolve(null), Math.max(0, deadline - Date.now())); })]);
    clearTimeout(timer);
    if (result) return result;
    const copy = newestCopy(stateDir, identity);
    const error = `refresh was still running after ${Number((deadlineMs / 1000).toFixed(3))} s`;
    recordOutcome(stateDir, identity, false, error, prior);
    return { identity, copy, commit: copy ? path.basename(copy) : null, error };
  }
  const work = (async () => {
    const root = rootFor(stateDir, identity); let temp, step = 'shared tools setup';
    try {
      await fsp.mkdir(root, { recursive: true });
      const git = (...args) => command('git', ['-C', projectPath, ...args], deadline, undefined, deadlineMs);
      step = 'private ref sweep';
      await clearPrivateRefs(projectPath, commonDir, deadline, deadlineMs);
      const remote = (await git('ls-remote', '--symref', 'origin', 'HEAD')).toString();
      const branch = /^ref: refs\/heads\/(.+)\s+HEAD$/m.exec(remote)?.[1];
      if (!branch) throw new Error('git ls-remote failed: could not determine default branch');
      const ref = `refs/wheelchair/shared-tools/${crypto.randomUUID()}`;
      let commit;
      try {
        await git('-c', 'gc.auto=0', '-c', 'maintenance.auto=false', 'fetch', '--no-write-fetch-head', '--no-tags', 'origin', `+refs/heads/${branch}:${ref}`);
        commit = (await git('rev-parse', '--verify', `${ref}^{commit}`)).toString().trim();
      } finally { await clearPrivateRefs(projectPath, commonDir).catch(() => {}); }
      step = 'copy build';
      const copy = path.join(root, commit);
      if (!fs.existsSync(copy)) {
        temp = await fsp.mkdtemp(path.join(root, '.tmp-')); building.add(temp);
        const exists = (await git('ls-tree', commit, '--', '.wheelchair/tools')).length > 0;
        if (exists) {
          const archive = await git('archive', commit, '.wheelchair/tools');
          await command('tar', ['-x', '-C', temp], deadline, archive, deadlineMs);
        }
        await readonly(temp, deadline, deadlineMs);
        if (Date.now() >= deadline) throw new Error(`copy build timed out after ${Number((deadlineMs / 1000).toFixed(3))} s`);
        await fsp.rename(temp, copy); building.delete(temp); temp = null;
      }
      if (Date.now() >= deadline) throw new Error(`copy build timed out after ${Number((deadlineMs / 1000).toFixed(3))} s`);
      step = 'copy publication';
      await atomic(path.join(root, 'current'), `${commit}\n`);
      recordOutcome(stateDir, identity, true, null);
      return { identity, copy, commit, error: null };
    } catch (e) {
      if (temp) { building.delete(temp); await remove(temp).catch(() => {}); }
      const detail = line(e);
      const error = line(/^(git |tar |copy build timed out)/.test(detail) ? detail : `${step} failed: ${detail}`); const copy = newestCopy(stateDir, identity);
      recordOutcome(stateDir, identity, false, error);
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
    if (locks.has(entry.name) || cleaning.has(entry.name)) continue;
    let done; const guard = new Promise(resolve => { done = resolve; }); cleaning.set(entry.name, guard);
    try {
      const dir = path.join(root, entry.name), newest = newestCopy(stateDir, entry.name);
      for (const item of await fsp.readdir(dir, { withFileTypes: true })) {
        if (!item.isDirectory() || (!/^[a-f0-9]{40,64}$/.test(item.name) && !item.name.startsWith('.tmp-'))) continue;
        const copy = path.join(dir, item.name);
        if (copy !== newest && !inUse.has(copy) && !building.has(copy)) await remove(copy);
      }
    } finally { cleaning.delete(entry.name); done(); }
  }
}
module.exports = { findSharedProject, identityFor, refreshShared, newestCopy, lastRefresh, cleanupCopies };
