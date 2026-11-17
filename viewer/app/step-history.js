'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const cache = new Map();
const locks = new Map();
const AGE = 30 * 86400_000;
function file(dir, project) {
  const absolute = path.resolve(project);
  return path.join(dir, 'step-history', `${path.basename(absolute)}-${crypto.createHash('sha256').update(absolute).digest('hex').slice(0, 8)}.jsonl`);
}
function serialized(name, fn) {
  const next = (locks.get(name) || Promise.resolve()).catch(() => {}).then(fn);
  locks.set(name, next);
  return next.finally(() => { if (locks.get(name) === next) locks.delete(name); });
}
async function append(dir, project, step) {
  if (!dir || !project) return;
  const name = file(dir, project);
  await serialized(name, async () => {
    await fs.mkdir(path.dirname(name), { recursive: true });
    await fs.appendFile(name, JSON.stringify({ kind: step.kind, key: step.key, ms: Math.max(0, Date.parse(step.ended_at) - Date.parse(step.started_at)), at: step.ended_at }) + '\n');
    cache.delete(name);
  });
}
async function rows(name) {
  if (!cache.has(name)) {
    const data = await fs.readFile(name, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
    cache.set(name, data.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }));
  }
  return cache.get(name);
}
async function normal(dir, project, key, now = Date.now()) {
  if (!dir || !project || !key) return null;
  const samples = (await rows(file(dir, project))).filter(r => r.key === key && Date.parse(r.at) >= now - AGE).slice(-5).map(r => r.ms);
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return { samples, typical_ms: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 };
}
async function prune(dir, now = Date.now()) {
  const folder = path.join(dir, 'step-history');
  const names = await fs.readdir(folder).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  await Promise.all(names.filter(n => n.endsWith('.jsonl')).map(n => {
    const name = path.join(folder, n);
    return serialized(name, async () => {
      cache.delete(name);
      const kept = (await rows(name)).filter(r => Date.parse(r.at) >= now - AGE);
      await fs.writeFile(name, kept.map(r => JSON.stringify(r) + '\n').join(''));
      cache.delete(name);
    });
  }));
}
module.exports = { append, normal, prune, file };
