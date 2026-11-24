'use strict';
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

function wayPaths(stderr, code) {
  const lines = Buffer.isBuffer(stderr) ? stderr.toString() : String(stderr || '');
  const errors = lines.split('\n').filter(line => /^error:/.test(line));
  const paths = [];
  const allLines = lines.split('\n');
  for (let i = 0; i < allLines.length; i++) {
    if (!/^error:.*:$/.test(allLines[i])) continue;
    for (let j = i + 1; j < allLines.length && /^\s+\S/.test(allLines[j]); j++) paths.push(allLines[j].trim());
  }
  if (paths.length) {
    const shown = paths.slice(0, 50);
    if (paths.length > 50) shown.push(`and ${paths.length - 50} more`);
    return `These files in your copy are in the way: ${shown.join(', ')}`;
  }
  if (code === 'killed') return 'Git took too long.';
  const first = lines.split('\n').find(line => /^(?:error|fatal):/.test(line))?.replace(/^(?:error|fatal):\s*/, '');
  return first ? `Git did not switch your copy: ${first}` : 'Git did not switch your copy.';
}

class TryService {
  constructor({ stateDir, root, projects, switchTimeout = 900000, scanTimeout = 300000, metadataTimeout = 4000, killGrace = 10000, gitExecutable = 'git' }) { this.stateDir = stateDir; this.root = root; this.projects = projects; this.locks = new Map(); this.switchTimeout = switchTimeout; this.scanTimeout = scanTimeout; this.metadataTimeout = metadataTimeout; this.killGrace = killGrace; this.gitExecutable = gitExecutable; }
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
  git(folder, args) {
    return new Promise(resolve => {
      const child = spawn(this.gitExecutable, ['-C', folder, ...args], { detached: true, env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', finished = false;
      const finish = (status, error) => { if (finished) return; finished = true; clearTimeout(timer); resolve({ status, stdout, stderr, error }); };
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
      const timer = setTimeout(() => { if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } } finish(1, Object.assign(new Error('Git metadata timed out.'), { code: 'ETIMEDOUT' })); }, this.metadataTimeout);
      child.on('error', error => finish(1, error)); child.on('close', code => finish(code ?? 1));
    });
  }
  runGit(folder, args, timeout) {
    return new Promise(resolve => {
      const child = spawn(this.gitExecutable, ['-C', folder, ...args], { detached: true, env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), killed = false, code = null, closed = false, failed = null;
      child.stdout.on('data', b => { stdout = Buffer.concat([stdout, b]); });
      child.stderr.on('data', b => { stderr = Buffer.concat([stderr, b]); });
      const signal = sig => { if (!child.pid) return; try { process.kill(-child.pid, sig); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
      const groupAlive = () => { if (!child.pid) return false; try { process.kill(-child.pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } };
      let deadline = setTimeout(() => { killed = true; signal('SIGTERM'); killer = setTimeout(() => signal('SIGKILL'), this.killGrace); }, timeout);
      let killer;
      const finish = () => {
        if (!closed) return;
        if (groupAlive()) { setTimeout(finish, 25); return; }
        clearTimeout(deadline); clearTimeout(killer);
        resolve({ code: killed ? 'killed' : code, stdout, stderr, error: failed });
      };
      child.on('error', error => {
        failed = error;
        if (!child.pid) { clearTimeout(deadline); clearTimeout(killer); resolve({ code: 1, stdout, stderr, error }); }
      });
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
  async head(folder) {
    const sha = await this.git(folder, ['rev-parse', '--verify', 'HEAD']); if (sha.status !== 0) return null;
    const branch = await this.git(folder, ['symbolic-ref', '-q', 'HEAD']); return { branch: branch.status === 0 ? branch.stdout.trim() : null, sha: sha.stdout.trim() };
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
  async identity(folder) {
    const common = await this.git(folder, ['rev-parse', '--git-common-dir']);
    if (common.error?.code === 'ETIMEDOUT') return { timedOut: true };
    if (common.status !== 0) return null;
    try { return { folder, common_dir: fs.realpathSync(path.resolve(folder, common.stdout.trim())) }; } catch { return null; }
  }
  sameIdentity(a, b) { return !!a && !!b && a.folder === b.folder && a.common_dir === b.common_dir; }
  async writeProtected(folder, paths) {
    const file = this.protectedPath(folder); await fsp.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    await fsp.writeFile(temp, paths, { mode: 0o600 }); await fsp.rename(temp, file);
  }
  async gitDir(folder) {
    const result = await this.git(folder, ['rev-parse', '--absolute-git-dir']); return result.status === 0 ? result.stdout.trim() : null;
  }
  async folderCheck(folder, record) {
    const [top, bare] = await Promise.all([this.git(folder, ['rev-parse', '--show-toplevel']), this.git(folder, ['rev-parse', '--is-bare-repository'])]);
    if ([top, bare].some(result => result.error?.code === 'ETIMEDOUT')) return 'Git did not answer in time. Try again.';
    if (top.status !== 0 || bare.stdout.trim() !== 'false' || (() => { try { return fs.realpathSync(top.stdout.trim()) !== folder; } catch { return true; } })()) return 'This folder is not the top level of a git working tree.';
    const beneath = (child, parent) => child === parent || child.startsWith(parent + path.sep);
    if (beneath(folder, path.join(this.stateDir, 'worktrees'))) return "This folder is an agent's copy.";
    let root = this.root; try { root = fs.realpathSync(root); } catch { /* root may be absent in tests */ }
    if (beneath(root, folder)) return 'This folder runs wheelchair itself; switching it would swap the running app for untested code.';
    const dirResult = await this.git(folder, ['rev-parse', '--absolute-git-dir']);
    if (dirResult.error?.code === 'ETIMEDOUT') return 'Git did not answer in time. Try again.';
    const dir = dirResult.status === 0 ? dirResult.stdout.trim() : null;
    if (!dir || ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG'].some(name => fs.existsSync(path.join(dir, name)))) return 'Git has an operation in progress. Finish it at your computer first.';
    const unmerged = await this.git(folder, ['ls-files', '-u']);
    if (unmerged.error?.code === 'ETIMEDOUT') return 'Git did not answer in time. Try again.';
    if (unmerged.stdout.trim()) return 'Git has an operation in progress. Finish it at your computer first.';
    if (record.active || record.pending) {
      const identity = await this.identity(folder);
      if (identity?.timedOut) return 'Git did not answer in time. Try again.';
      if (!this.sameIdentity(record.identity, identity)) return 'This folder is no longer the copy that was switched';
    }
    return null;
  }
  async resolveRef(folder, ref) { const result = await this.git(folder, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]); return result.status === 0 ? result.stdout.trim() : null; }
  async indexLock(folder) { const dir = await this.gitDir(folder); const file = dir && path.join(dir, 'index.lock'); return file && fs.existsSync(file) ? file : null; }
  async gitlinkChanged(folder, from, to) {
    const result = await this.runGit(folder, ['diff', '--raw', '--no-renames', '--ignore-submodules=none', from, to], this.scanTimeout);
    if (result.code !== 0) throw new Error('Git could not compare the commits.');
    return result.stdout.toString().split('\n').some(line => /^:160000 |^:[0-7]{6} 160000 /.test(line));
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
    let retained = false;
    try {
      const record = await this.read(folder);
      if (input.action !== 'try' && input.version !== record.version) { this.release(folder); retained = true; return { accepted: false, reason: 'Your copy changed since this page loaded', status: await this.status(input, folder) }; }
      if (input.action === 'forget') {
        const entry = (record.kept || []).find(item => item.ref === input.kept);
        let reason = null;
        if (!entry) reason = 'That kept entry no longer exists.';
        else if (!entry.old_identity && (await this.git(folder, ['update-ref', '-d', entry.ref])).status !== 0) reason = 'Git could not delete the kept pin.';
        else { record.kept = record.kept.filter(item => item.ref !== input.kept); await this.write(folder, record); }
        this.release(folder); retained = true;
        const status = await this.status(input, folder);
        return reason ? { accepted: false, reason, status } : { ok: true, status };
      }
      if (input.action === 'dismiss') {
        const reason = await this.dismiss(folder, record);
        this.release(folder); retained = true;
        const status = await this.status(input, folder);
        return reason ? { accepted: false, reason, status } : { ok: true, status };
      }
      const head = await this.head(folder);
      let reason = await this.folderCheck(folder, record);
      if (!reason && record.pending) reason = 'A switch was interrupted. Check your copy at your computer, then press Done.';
      if (!reason && await this.indexLock(folder)) reason = 'Git may still be running in this folder. Check at your computer.';
      if (!reason && record.active && head?.branch) reason = 'You switched your copy by hand. Dismiss first.';
      let target;
      if (input.action === 'try') {
        target = await this.resolveRef(folder, `refs/heads/wc/${input.thread_id}`);
        if (!reason && !target) reason = 'This thread has no branch in this folder.';
        if (!reason && record.active?.thread_id === input.thread_id && head?.sha === record.active.commit && target === record.active.commit) reason = 'Already showing the newest';
      } else if (!reason && !record.active) reason = 'There is no trial to switch back from.';
      else if (!reason) {
        const point = record.active.return_point;
        target = point.branch ? await this.resolveRef(folder, point.branch) : point.sha;
        if (!target) reason = 'Your earlier branch no longer exists.';
        if (!reason && point.branch) {
          const worktrees = await this.git(folder, ['worktree', 'list', '--porcelain']);
          if (worktrees.status !== 0) reason = 'Git could not check your earlier branch.';
          else if (worktrees.stdout.split('\n\n').some(block => block.split('\n').includes(`branch ${point.branch}`))) reason = 'Your earlier branch is checked out in another worktree.';
        }
      }
      if (!reason && !head) reason = 'Git could not read the current commit.';
      if (reason) { this.release(folder); retained = true; return { accepted: false, reason, status: await this.status(input, folder) }; }
      const status = await this.status(input, folder);
      retained = true;
      setImmediate(() => (input.action === 'try' ? this.performTry(input, folder, record, head, target) : this.performBack(input, folder, record, head, target)).catch(error => console.error('try failed:', error)).finally(() => this.release(folder)));
      return { accepted: true, status };
    } finally { if (!retained) this.release(folder); }
  }
  listFields(entries) { const files = entries.map(entry => entry.path); return { files: files.slice(0, 50), files_count: files.length }; }
  async performTry(input, folder, record, from, target) {
    const last = { op: 'try', thread_id: input.thread_id, at: new Date().toISOString(), outcome: 'refused', reason: 'Git could not switch your copy.' };
    let pendingWritten = false;
    try {
      const before = await this.scan(folder); const clean = await this.filtered(folder, before);
      if (before.some(entry => entry.submodule) || await this.gitlinkChanged(folder, from.sha, target)) {
        last.reason = "This thread changes a submodule, which isn't supported.";
      } else if (clean.length) {
        last.reason = 'These files have changes. Commit, undo or delete them at your computer, then press again.';
        Object.assign(last, this.listFields(clean));
      } else {
        const first = !record.active;
        if (first) {
          const ignored = await this.runGit(folder, ['ls-files', '-z', '--others', '--ignored', '--exclude-standard'], this.scanTimeout);
          if (ignored.code !== 0) throw new Error('Git could not list ignored files.');
          await this.writeProtected(folder, ignored.stdout);
          record.identity = await this.identity(folder);
        }
        if (record.active && !from.branch && from.sha !== record.active.commit) {
          const alreadyKept = await Promise.all(record.kept.filter(entry => !entry.old_identity).map(entry => this.resolveRef(folder, entry.ref)));
          if (!alreadyKept.includes(from.sha)) {
            const ref = `refs/wheelchair/kept/${this.hash(folder).slice(0, 16)}/${crypto.randomBytes(4).toString('hex')}`;
            const entry = { ref, label: `commits made while trying thread ${record.active.thread_id}`, thread_id: record.active.thread_id, at: new Date().toISOString() };
            record.kept.push(entry); await this.write(folder, record);
            if ((await this.git(folder, ['update-ref', ref, from.sha])).status !== 0) throw new Error('Git could not keep your commits.');
          }
        }
        const to = { branch: null, sha: target };
        const returnRef = first ? `refs/wheelchair/return/${this.hash(folder).slice(0, 16)}/${crypto.randomBytes(4).toString('hex')}` : null;
        record.pending = { op: 'try', first, thread_id: input.thread_id, from, to, ...(first ? { return_point: from, return_ref: returnRef } : {}) };
        await this.write(folder, record); pendingWritten = true;
        if (first && (await this.git(folder, ['update-ref', returnRef, from.sha])).status !== 0) throw new Error('Git could not remember your earlier commit.');
        const result = this.sameHead(from, to) ? { code: 0, stderr: Buffer.alloc(0) } : await this.runGit(folder, ['-c', 'submodule.recurse=false', 'switch', '--no-guess', '--no-overwrite-ignore', '--no-recurse-submodules', '--detach', target], this.switchTimeout);
        let after = null; try { after = await this.scan(folder); } catch { /* interrupted */ }
        const filtered = after && await this.filtered(folder, after);
        const outcome = this.judge(from, to, await this.head(folder), filtered, result);
        last.outcome = outcome;
        const gitMessage = result.stderr.toString().trim().split('\n').filter(Boolean).pop();
        if (outcome === 'success' || outcome === 'warning') {
          record.active = first ? { thread_id: input.thread_id, commit: target, return_point: from, return_ref: returnRef } : { ...record.active, thread_id: input.thread_id, commit: target };
          record.pending = null;
          last.reason = outcome === 'success' ? 'Your copy is showing this thread.' : (filtered?.length ? 'These files have changes after switching.' : gitMessage || 'Git reported a warning.');
          if (filtered?.length) Object.assign(last, this.listFields(filtered));
        } else if (outcome === 'nothing-moved') {
          record.pending = null;
          if (first) { await this.git(folder, ['update-ref', '-d', returnRef]); await fsp.unlink(this.protectedPath(folder)).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
          last.reason = wayPaths(result.stderr, result.code);
        } else {
          last.reason = 'A switch was interrupted. Check your copy at your computer, then press Done.';
          if (filtered) Object.assign(record.pending, this.listFields(filtered));
        }
      }
    } catch (error) {
      last.reason = error.message || 'Git could not switch your copy.';
      if (pendingWritten) { last.outcome = 'interrupted'; last.reason = 'A switch was interrupted. Check your copy at your computer, then press Done.'; }
    }
    record.last = last; await this.write(folder, record);
  }
  async dismiss(folder, record) {
    if (await this.indexLock(folder)) return 'Git may still be running in this folder. Check at your computer.';
    const pending = record.pending, active = record.active;
    const point = active?.return_point || pending?.return_point;
    const ref = active?.return_ref || pending?.return_ref;
    const owner = active?.thread_id || pending?.thread_id;
    const identity = (active || pending) && await this.identity(folder);
    if (identity?.timedOut) return 'Git did not answer in time. Try again.';
    const mismatch = (active || pending) && !this.sameIdentity(record.identity, identity);
    const keepReturn = () => {
      if (ref && !record.kept.some(entry => entry.ref === ref)) record.kept.push({ ref, label: `where your copy was before trying thread ${owner}`, thread_id: owner, ...(point?.branch ? { branch: point.branch.replace(/^refs\/heads\//, '') } : {}), at: new Date().toISOString(), ...(mismatch ? { old_identity: true } : {}) });
    };
    if (mismatch) {
      record.kept = record.kept.map(entry => ({ ...entry, old_identity: true }));
      keepReturn(); record.active = null;
    } else {
      const head = await this.head(folder);
      if (pending?.op === 'try' && !head?.branch && this.sameHead(head, pending.to)) {
        record.active = pending.first ? { thread_id: pending.thread_id, commit: pending.to.sha, return_point: pending.return_point, return_ref: pending.return_ref } : { ...active, thread_id: pending.thread_id, commit: pending.to.sha };
      } else if (pending?.op === 'back' && this.sameHead(head, pending.to)) {
        if (ref && (await this.git(folder, ['update-ref', '-d', ref])).status !== 0) return 'Git could not delete the return pin.';
        record.active = null;
      } else if ((active && head?.branch) || (pending?.op === 'try' && pending.first)) {
        let contains = false;
        if (point?.branch && await this.resolveRef(folder, point.branch)) contains = (await this.runGit(folder, ['merge-base', '--is-ancestor', point.sha, point.branch], this.scanTimeout)).code === 0;
        if (ref && contains) {
          if ((await this.git(folder, ['update-ref', '-d', ref])).status !== 0) return 'Git could not delete the return pin.';
        } else if (ref) {
          if (!await this.resolveRef(folder, ref) && (await this.git(folder, ['update-ref', ref, point.sha])).status !== 0) return 'Git could not keep your earlier commit.';
          keepReturn();
        }
        record.active = null;
      }
    }
    record.pending = null;
    if (!record.active) await fsp.unlink(this.protectedPath(folder)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await this.write(folder, record); return null;
  }
  async performBack(input, folder, record, from, target) {
    const last = { op: 'back', thread_id: input.thread_id, at: new Date().toISOString(), outcome: 'refused', reason: 'Git could not switch your copy.' };
    let pendingWritten = false;
    try {
      const active = record.active;
      const to = { branch: active.return_point.branch, sha: target };
      const before = await this.scan(folder); const clean = await this.filtered(folder, before);
      if (before.some(entry => entry.submodule) || await this.gitlinkChanged(folder, from.sha, target)) {
        last.reason = "This thread changes a submodule, which isn't supported.";
      } else if (clean.length) {
        last.reason = 'These files have changes. Commit, undo or delete them at your computer, then press again.';
        Object.assign(last, this.listFields(clean));
      } else {
        if (!from.branch && from.sha !== active.commit) {
          const alreadyKept = await Promise.all(record.kept.filter(entry => !entry.old_identity).map(entry => this.resolveRef(folder, entry.ref)));
          if (!alreadyKept.includes(from.sha)) {
            const ref = `refs/wheelchair/kept/${this.hash(folder).slice(0, 16)}/${crypto.randomBytes(4).toString('hex')}`;
            record.kept.push({ ref, label: `commits made while trying thread ${active.thread_id}`, thread_id: active.thread_id, at: new Date().toISOString() });
            await this.write(folder, record);
            if ((await this.git(folder, ['update-ref', ref, from.sha])).status !== 0) throw new Error('Git could not keep your commits.');
          }
        }
        record.pending = { op: 'back', first: false, thread_id: input.thread_id, from, to };
        await this.write(folder, record); pendingWritten = true;
        const args = ['-c', 'submodule.recurse=false', 'switch', '--no-guess', '--no-overwrite-ignore', '--no-recurse-submodules'];
        args.push(...(to.branch ? [to.branch.replace(/^refs\/heads\//, '')] : ['--detach', to.sha]));
        const result = this.sameHead(from, to) ? { code: 0, stderr: Buffer.alloc(0) } : await this.runGit(folder, args, this.switchTimeout);
        let after = null; try { after = await this.scan(folder); } catch { /* interrupted */ }
        const filtered = after && await this.filtered(folder, after);
        const outcome = this.judge(from, to, await this.head(folder), filtered, result);
        last.outcome = outcome;
        const message = result.stderr.toString().trim().split('\n').filter(Boolean).pop();
        if (outcome === 'success' || outcome === 'warning') {
          const prior = new Set(before.map(entry => entry.path)); const appeared = after.filter(entry => !prior.has(entry.path)).map(entry => entry.path);
          last.appeared = appeared.slice(0, 50); last.appeared_count = appeared.length;
          last.reason = outcome === 'success' ? 'Your copy is back where it was.' : message || 'Git reported a warning.';
          if ((await this.git(folder, ['update-ref', '-d', active.return_ref])).status !== 0) throw new Error('Git could not delete the return pin.');
          record.active = null; record.pending = null;
          await fsp.unlink(this.protectedPath(folder)).catch(error => { if (error.code !== 'ENOENT') throw error; });
        } else if (outcome === 'nothing-moved') {
          record.pending = null;
          last.reason = wayPaths(result.stderr, result.code);
        } else {
          last.reason = 'A switch was interrupted. Check your copy at your computer, then press Done.';
          if (filtered) Object.assign(record.pending, this.listFields(filtered));
        }
      }
    } catch (error) {
      last.reason = error.message || 'Git could not switch your copy.';
      if (pendingWritten) { last.outcome = 'interrupted'; last.reason = 'A switch was interrupted. Check your copy at your computer, then press Done.'; }
    }
    record.last = last; await this.write(folder, record);
  }
  async status(input, folder = this.folder(input.project)) {
    const lock = this.lockState(folder), generation = lock.generation;
    const record = await this.read(folder);
    const [head, refused, target, kept, identity, indexLock] = await Promise.all([
      this.head(folder), this.folderCheck(folder, record), this.resolveRef(folder, `refs/heads/wc/${input.thread_id}`),
      Promise.all((record.kept || []).map(async entry => ({ ...entry, missing: entry.old_identity ? true : !await this.resolveRef(folder, entry.ref), old_identity: !!entry.old_identity }))),
      record.active || record.pending ? this.identity(folder) : null, this.indexLock(folder)
    ]);
    // Nothing new: the thread's branch is already contained in what the folder shows (a thread with no commits of its own yet).
    const nothingNew = !!target && !!head?.sha && (await this.git(folder, ['merge-base', '--is-ancestor', target, head.sha])).status === 0;
    const busy = lock.held || generation !== lock.generation;
    const mismatch = (record.active || record.pending) && !identity?.timedOut && !this.sameIdentity(record.identity, identity);
    let state = 'none';
    if (mismatch) state = 'mismatch';
    else if (busy) state = 'busy';
    else if (record.pending) state = 'interrupted';
    else if (record.active && head?.branch) state = 'stale';
    else if (record.active && head?.sha !== record.active.commit) state = 'moved';
    else if (record.active) state = record.active.thread_id === input.thread_id ? 'trying-this' : 'trying-other';
    const pending = state === 'interrupted' ? record.pending : null;
    const earlier = pending && (pending.return_point || record.active?.return_point || pending.from);
    const files = pending?.files || [];
    return { version: record.version, state, active_thread_id: record.active?.thread_id || null, active_commit: record.active?.commit || null,
      target_available: !!target, nothing_new: nothingNew, newest: state === 'trying-this' && !!target && target !== record.active.commit,
      refused, earlier_branch: earlier ? (earlier.branch ? earlier.branch.replace(/^refs\/heads\//, '') : earlier.sha.slice(0, 7)) : null,
      files: files.slice(0, 50), files_count: pending ? (pending.files_count ?? files.length) : 0,
      index_lock: busy ? null : indexLock, last: record.last || null, kept };
  }
}
module.exports = { TryService, wayPaths };
