'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { appError } = require('./state.js');
const git = promisify(execFile);
const FILES = ['MAP.md', 'IDEA.md', 'PLAN.md'];
const cache = new Map();
const validSlug = (slug) => typeof slug === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(slug) && slug !== '.' && slug !== '..';

async function eligible(thread, file) {
  if (!validSlug(thread.slug) || !thread.worktree || !FILES.includes(file)) return null;
  try {
    const dir = path.join(thread.worktree, 'docs', 'plans', thread.slug);
    const candidate = path.join(dir, file);
    const stat = await fs.lstat(candidate);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return null;
    const [realDir, realFile] = await Promise.all([fs.realpath(dir), fs.realpath(candidate)]);
    if (!realFile.startsWith(realDir + path.sep)) return null;
    return candidate;
  } catch { return null; }
}

async function readLive(thread, file) {
  const candidate = await eligible(thread, file);
  if (candidate) {
    try { return await fs.readFile(candidate); } catch {}
  }
  throw appError(404, 'document not found');
}

async function list(thread) {
  if (!validSlug(thread.slug)) return [];
  if (!thread.archived) {
    const results = await Promise.all(FILES.map((file) => eligible(thread, file)));
    return FILES.filter((_, i) => results[i]);
  }
  if (!thread.branch || !thread.project) return [];
  const key = JSON.stringify([thread.id, thread.branch]);
  if (!cache.has(key)) {
    cache.set(key, Promise.all(FILES.map(async (file) => {
      try { await git('git', ['-C', thread.project, 'cat-file', '-e', `${thread.branch}:docs/plans/${thread.slug}/${file}`]); return file; } catch { return null; }
    })).then((files) => files.filter(Boolean)));
  }
  return cache.get(key);
}
module.exports = { FILES, eligible, list, readLive, validSlug };
