'use strict';
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');

class TryService {
  constructor({ stateDir, root, projects, switchTimeout = 900000, scanTimeout = 300000, killGrace = 10000, gitExecutable = 'git' }) { this.stateDir = stateDir; this.root = root; this.projects = projects; this.locks = new Map(); this.switchTimeout = switchTimeout; this.scanTimeout = scanTimeout; this.killGrace = killGrace; this.gitExecutable = gitExecutable; }
  lockState(folder) { if (!this.locks.has(folder)) this.locks.set(folder, { held: false, generation: 0 }); return this.locks.get(folder); }
  acquire(folder) { const lock = this.lockState(folder); if (lock.held) return false; lock.held = true; lock.generation++; return true; }
  release(folder) { const lock = this.lockState(folder); lock.held = false; lock.generation++; }
  folder(project) { return fs.realpathSync(project); }
  hash(folder) { return crypto.createHash('sha256').update(folder).digest('hex'); }
  recordPath(folder) { return path.join(this.stateDir, 'tries', `${this.hash(folder)}.json`); }
  protectedPath(folder) { return this.recordPath(folder).replace(/\.json$/, '.protected'); }
  async read(folder) {
    try { return JSON.parse(await fsp.readFile(this.recordPath(folder), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { folder, identity: null, version: null, active: null, pending: null, last: null, kept: [] }; throw error; }
  }
  async write(folder, record) {
    const file = this.recordPath(folder); await fsp.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    record.version = crypto.randomBytes(16).toString('hex');
    const temp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    await fsp.writeFile(temp, JSON.stringify(record), { mode: 0o600 }); await fsp.rename(temp, file);
  }
  git(folder, args) { return spawnSync(this.gitExecutable, ['-C', folder, ...args], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, timeout: 4000 }); }
  runGit(folder, args, timeout) {
    return new Promise(resolve => {
      const child = spawn(this.gitExecutable, ['-C', folder, ...args], { detached: true, env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), killed = false, code = null, closed = false, failed = null;
      child.stdout.on('data', b => { stdout = Buffer.concat([stdout, b]); });
      child.stderr.on('data', b => { stderr = Buffer.concat([stderr, b]); });
      const signal = sig => { try { process.kill(-child.pid, sig); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
      const groupAlive = () => { try { process.kill(-child.pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } };
      let deadline = setTimeout(() => { killed = true; signal('SIGTERM'); killer = setTimeout(() => signal('SIGKILL'), this.killGrace); }, timeout);
      let killer;
      const finish = () => {
        if (!closed) return;
        if (groupAlive()) { setTimeout(finish, 25); return; }
        clearTimeout(deadline); clearTimeout(killer);
        resolve({ code: killed ? 'killed' : code, stdout, stderr, error: failed });
      };
      child.on('error', error => { failed = error; });
      child.on('close', value => { code = value; closed = true; finish(); });
    });
  }
  async scan(folder) {
    const result = await this.runGit(folder, ['--no-optional-locks', 'status', '--porcelain=v2', '-z', '--no-renames', '--untracked-files=all', '--ignore-submodules=none'], this.scanTimeout);
    if (result.code !== 0) throw new Error(result.code === 'killed' ? 'Git took too long to check your copy.' : (result.stderr.toString().trim().split('\n').pop() || 'Git could not check your copy.'));
    const fields = result.stdout.toString('utf8').split('\0'); const entries = [];
    for (let i = 0; i < fields.length; i++) {
      const line = fields[i]; if (!line) continue;
      const kind = line[0]; let file, submodule = false;
      if (kind === '?' || kind === '!') file = line.slice(2);
      else { const n = kind === '1' ? 8 : kind === '2' ? 9 : kind === 'u' ? 10 : 0; if (!n) continue;
        let at = 0; for (let j = 0; j < n; j++) at = line.indexOf(' ', at) + 1;
        file = line.slice(at); submodule = line.split(' ')[2]?.startsWith('S') || false;
        if (kind === '2') i++;
      }
      entries.push({ path: file, untracked: kind === '?', submodule });
    }
    return entries;
  }
  async filtered(folder, entries) {
    const protectedPaths = new Set((await fsp.readFile(this.protectedPath(folder)).catch(error => { if (error.code === 'ENOENT') return Buffer.alloc(0); throw error; })).toString().split('\0'));
    return entries.filter(entry => !entry.untracked || !protectedPaths.has(entry.path));
  }
  head(folder) {
    const sha = this.git(folder, ['rev-parse', '--verify', 'HEAD']); if (sha.status !== 0) return null;
    const branch = this.git(folder, ['symbolic-ref', '-q', 'HEAD']); return { branch: branch.status === 0 ? branch.stdout.trim() : null, sha: sha.stdout.trim() };
  }
  sameHead(a, b) { return !!a && !!b && a.branch === b.branch && a.sha === b.sha; }
  judge(from, to, head, entries, result) {
    const target = this.sameHead(head, to), clean = entries && entries.length === 0;
    if (target && /^warning: unable to (?:unlink|rmdir) '/m.test(result.stderr.toString())) return 'interrupted';
    if (target && clean && result.code === 0) return 'success';
    if (target && clean && result.code !== 0 && result.code !== 'killed') return 'warning';
    if (target && entries && !clean && result.code === 0) return 'warning';
    if (this.sameHead(head, from) && clean && result.code !== 0) return 'nothing-moved';
    return 'interrupted';
  }
  identity(folder) {
    const common = this.git(folder, ['rev-parse', '--git-common-dir']);
    if (common.status !== 0) return null;
    try { return { folder, common_dir: fs.realpathSync(path.resolve(folder, common.stdout.trim())) }; } catch { return null; }
  }
  sameIdentity(a, b) { return !!a && !!b && a.folder === b.folder && a.common_dir === b.common_dir; }
  async writeProtected(folder, paths) {
    const file = this.protectedPath(folder); await fsp.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    await fsp.writeFile(temp, paths, { mode: 0o600 }); await fsp.rename(temp, file);
  }
  gitDir(folder) {
    const result = this.git(folder, ['rev-parse', '--absolute-git-dir']); return result.status === 0 ? result.stdout.trim() : null;
  }
  folderCheck(folder, record) {
    const top = this.git(folder, ['rev-parse', '--show-toplevel']);
    const bare = this.git(folder, ['rev-parse', '--is-bare-repository']);
    if (top.status !== 0 || bare.stdout.trim() !== 'false' || (() => { try { return fs.realpathSync(top.stdout.trim()) !== folder; } catch { return true; } })()) return 'This folder is not the top level of a git working tree.';
    const beneath = (child, parent) => child === parent || child.startsWith(parent + path.sep);
    if (beneath(folder, path.join(this.stateDir, 'worktrees'))) return "This folder is an agent's copy.";
    let root = this.root; try { root = fs.realpathSync(root); } catch { /* root may be absent in tests */ }
    if (beneath(root, folder)) return 'This folder runs wheelchair itself; switching it would swap the running app for untested code.';
    const dir = this.gitDir(folder);
    if (!dir || ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG'].some(name => fs.existsSync(path.join(dir, name))) || this.git(folder, ['ls-files', '-u']).stdout.trim()) return 'Git has an operation in progress. Finish it at your computer first.';
    if ((record.active || record.pending) && !this.sameIdentity(record.identity, this.identity(folder))) return 'This folder is no longer the copy that was switched';
    return null;
  }
  resolveRef(folder, ref) { const result = this.git(folder, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]); return result.status === 0 ? result.stdout.trim() : null; }
  indexLock(folder) { const dir = this.gitDir(folder); const file = dir && path.join(dir, 'index.lock'); return file && fs.existsSync(file) ? file : null; }
  gitlinkChanged(folder, from, to) {
    const result = this.git(folder, ['diff', '--raw', '--no-renames', '--ignore-submodules=none', from, to]);
    if (result.status !== 0) throw new Error('Git could not compare the commits.');
    return result.stdout.split('\n').some(line => /^:160000 |^:[0-7]{6} 160000 /.test(line));
  }
  async handle(input) {
    const invalid = message => { throw Object.assign(new Error(message), { status: 422 }); };
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Invalid request.');
    if (!['status', 'try', 'back', 'dismiss', 'forget'].includes(input.action)) invalid('Invalid action.');
    if (typeof input.thread_id !== 'string' || !/^[0-9a-f]{12}$/.test(input.thread_id)) invalid('Invalid thread ID.');
    if (typeof input.project !== 'string' || !path.isAbsolute(input.project)) invalid('Invalid project.');
    const checked = await this.projects(new URLSearchParams({ check: input.project }));
    if (!checked.checked.ok) invalid('Invalid project.');
    if (['back', 'dismiss', 'forget'].includes(input.action) && (typeof input.version !== 'string' || !input.version)) invalid('Version is required.');
    if (input.action === 'forget' ? typeof input.kept !== 'string' || !input.kept : Object.hasOwn(input, 'kept')) invalid('Invalid kept ref.');
    const folder = this.folder(input.project);
    if (input.action === 'status') return this.status(input, folder);
    if (!this.acquire(folder)) return { accepted: false, reason: 'A switch is already running', status: await this.status(input, folder) };
    try { return { accepted: false, reason: 'Not built yet', status: await this.status(input, folder) }; }
    finally { this.release(folder); }
  }
  async status() {
    return { version: null, state: 'none', active_thread_id: null, active_commit: null, target_available: false, newest: false, refused: null, earlier_branch: null, files: [], files_count: 0, index_lock: null, last: null, kept: [] };
  }
}
module.exports = { TryService };
