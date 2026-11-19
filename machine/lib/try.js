'use strict';
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

class TryService {
  constructor({ stateDir, root, projects }) { this.stateDir = stateDir; this.root = root; this.projects = projects; }
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
  git(folder, args) { return spawnSync('git', ['-C', folder, ...args], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, timeout: 4000 }); }
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
    const status = await this.status(input);
    return input.action === 'status' ? status : { accepted: false, reason: 'Not built yet', status };
  }
  async status() {
    return { version: null, state: 'none', active_thread_id: null, active_commit: null, target_available: false, newest: false, refused: null, earlier_branch: null, files: [], files_count: 0, index_lock: null, last: null, kept: [] };
  }
}
module.exports = { TryService };
