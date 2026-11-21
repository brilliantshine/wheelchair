'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { readState } = require('./win-sync');

const git = promisify(execFile);
const REFRESH_MS = 10 * 60 * 1000;
const GB = 1e9;
const COPIES_WARNING_BYTES = 20 * GB;
const CONFLICT_WARNING_COUNT = 10;
const FREE_WARNING_BYTES = 10 * GB;

class WinDisk {
  constructor(winEnv) {
    this.winEnv = winEnv;
    this.cache = new Map();
  }

  refresh(ctx, entry) {
    entry.pending = (async () => {
      let dirs;
      try { dirs = await fs.readdir(path.dirname(ctx.copy.linux), { withFileTypes: true }); }
      catch (err) { if (err.code === 'ENOENT') dirs = []; else throw err; }
      const copies = [];
      for (const dir of dirs.filter(item => item.isDirectory())) {
        const windows = path.win32.join(path.win32.dirname(ctx.copy.windows), dir.name);
        const quoted = `'${windows.replace(/'/g, "''")}'`;
        const result = await this.winEnv.ps(`$ErrorActionPreference = 'Stop'\n(Get-ChildItem -LiteralPath ${quoted} -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object -Sum Length).Sum`);
        if (result.code !== 0) throw new Error(result.stderr.trim() || 'PowerShell copy measurement failed');
        const value = result.stdout.trim();
        const bytes = value === '' ? 0 : Number(value);
        if (!Number.isFinite(bytes) || bytes < 0) throw new Error('Invalid copy size from PowerShell');
        copies.push({ path: windows, bytes });
      }
      entry.copies = copies;
      entry.measured_at = new Date().toISOString();
      entry.reason = null;
    })().catch(err => { entry.reason = err.message; }).finally(() => { entry.pending = null; });
  }

  async info(ctx) {
    let entry = this.cache.get(ctx.threadId);
    if (!entry) {
      entry = { copies: [], measured_at: null, pending: null, reason: null };
      this.cache.set(ctx.threadId, entry);
    }
    if (!entry.pending && (!entry.measured_at || Date.now() - Date.parse(entry.measured_at) > REFRESH_MS)) this.refresh(ctx, entry);
    const copies = entry.copies;
    const disk = { copies, copies_bytes: copies.reduce((sum, copy) => sum + copy.bytes, 0), git_bytes: null, conflict_refs: null, windows_free_bytes: null, measured_at: entry.measured_at, warnings: [] };
    const errors = entry.reason ? [entry.reason] : [];
    let repo = ctx.worktree;
    try { repo = readState(ctx.stateDir, ctx.key).git_dir || repo; } catch (err) { errors.push(err.message); }
    const measurements = await Promise.allSettled([
      git('git', ['count-objects', '-v'], { cwd: repo }).then(({ stdout }) => {
        const loose = stdout.match(/^size:\s*(\d+)\s*$/m);
        const packed = stdout.match(/^size-pack:\s*(\d+)\s*$/m);
        if (!loose || !packed) throw new Error('Invalid git count-objects output');
        return (Number(loose[1]) + Number(packed[1])) * 1024;
      }),
      git('git', ['for-each-ref', '--format=%(refname)', 'refs/wheelchair/conflicts/'], { cwd: repo }).then(({ stdout }) => stdout.split(/\r?\n/).filter(Boolean).length),
      this.winEnv.localAppData().then(value => fs.statfs(this.winEnv.toLinux(value))).then(stat => stat.bavail * stat.bsize),
    ]);
    ['git_bytes', 'conflict_refs', 'windows_free_bytes'].forEach((field, i) => {
      const result = measurements[i];
      if (result.status === 'fulfilled') disk[field] = result.value;
      else errors.push(result.reason.message);
    });
    if (disk.copies_bytes > COPIES_WARNING_BYTES) disk.warnings.push(`This thread's Windows copies use ${(disk.copies_bytes / GB).toFixed(1)} GB.`);
    if (disk.conflict_refs >= CONFLICT_WARNING_COUNT) disk.warnings.push(`${disk.conflict_refs} kept conflict snapshots; see README to remove them.`);
    if (disk.windows_free_bytes !== null && disk.windows_free_bytes < FREE_WARNING_BYTES) disk.warnings.push(`Only ${(disk.windows_free_bytes / GB).toFixed(1)} GB free on the Windows drive.`);
    if (errors.length) disk.reason = errors.join('; ');
    return disk;
  }
}

module.exports = { WinDisk, REFRESH_MS, COPIES_WARNING_BYTES, CONFLICT_WARNING_COUNT, FREE_WARNING_BYTES };
