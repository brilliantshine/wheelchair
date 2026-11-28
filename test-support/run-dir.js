'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const legacy = ['wheelchair-machine-test-', 'wc-accounts-', 'wc-statusline-', 'wc-seed-', 'aside-test-', 'aside-recover-', 'aside-groups-', 'aside-http-', 'aside-tombstone-', 'wc-doc-', 'wc-archived-', 'wc-gh-', 'wc-git-', 'wheelchair-viewer-version-', 'wheelchair-viewer-state-', 'wc-graph-', 'usage-test-', 'hub-version-', 'wc-asides-', 'app-slug-'];
const procAvailable = fs.existsSync('/proc/self/stat');
const sleeper = new Int32Array(new SharedArrayBuffer(4));
const dirs = new Map();
let installed = false;
let cleaned = false;
const children = new Map();
const callbacks = [];

function stat(pid) {
  try {
    const value = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = value.slice(value.lastIndexOf(')') + 1).trim().split(/\s+/);
    return { state: fields[0], start: fields[19] || null };
  } catch { return null; }
}
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}
function stopped(pid) {
  if (procAvailable) {
    const info = stat(pid);
    if (info) return info.state === 'Z';
    return !alive(pid);
  }
  return !alive(pid);
}
function waitStopped(pids) {
  const deadline = Date.now() + 2000;
  while (pids.some(pid => !stopped(pid))) {
    if (Date.now() >= deadline) return false;
    Atomics.wait(sleeper, 0, 0, 10);
  }
  return true;
}
function kill(child) {
  try { process.kill(child.group ? -child.pid : child.pid, 'SIGKILL'); } catch {}
}
function makeWritable(root) {
  const stack = [root];
  while (stack.length) {
    const entry = stack.pop();
    let info;
    try { info = fs.lstatSync(entry); } catch { continue; }
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) {
      if ((info.mode & 0o700) !== 0o700) {
        try { fs.chmodSync(entry, (info.mode & 0o777) | 0o700); } catch {}
      }
      let names;
      try { names = fs.readdirSync(entry); } catch { continue; }
      for (const name of names) stack.push(path.join(entry, name));
    } else if ((info.mode & 0o200) === 0) {
      try { fs.chmodSync(entry, (info.mode & 0o777) | 0o600); } catch {}
    }
  }
}
function remove(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch {
    makeWritable(target);
    try { fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch {}
  }
}
function sweepRun(target) {
  let owner;
  try {
    owner = JSON.parse(fs.readFileSync(path.join(target, 'owner.json'), 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const match = path.basename(target).match(/^wheelchair-test-run-(\d+)-/);
      if (match && !alive(Number(match[1]))) remove(target);
      else if (fs.statSync(target).mtimeMs < Date.now() - 3600000) remove(target);
    }
    return;
  }
  if (!owner || !Number.isInteger(owner.pid) || owner.pid <= 0) return;
  const current = stat(owner.pid)?.start ?? null;
  if (alive(owner.pid) && (owner.start == null || current == null || owner.start === current)) return;
  if (owner.children !== undefined && !Array.isArray(owner.children)) return;
  const waiting = [];
  for (const child of owner.children || []) {
    if (!child || !Number.isInteger(child.pid) || child.pid <= 0) return;
    if (!alive(child.pid)) continue;
    const start = stat(child.pid)?.start ?? null;
    if (child.start == null || start == null) return;
    if (child.start !== start) continue;
    kill(child);
    waiting.push(child.pid);
  }
  if (waitStopped(waiting)) remove(target);
}
function sweep(root) {
  try {
    for (const name of fs.readdirSync(root)) {
      try {
        const target = path.join(root, name);
        if (name.startsWith('wheelchair-test-run-')) sweepRun(target);
        else if (root === os.tmpdir() && legacy.some(prefix => name.startsWith(prefix)) && fs.statSync(target).mtimeMs < Date.now() - 3600000) remove(target);
      } catch {}
    }
  } catch {}
  const scratch = path.join(__dirname, '..', 'viewer', 'test', '.tmp');
  try {
    for (const name of fs.readdirSync(scratch)) {
      try {
        const target = path.join(scratch, name);
        if (fs.statSync(target).mtimeMs < Date.now() - 3600000) remove(target);
      } catch {}
    }
  } catch {}
}
function writeOwner(dir) {
  const tmp = path.join(dir, 'owner.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify({ pid: process.pid, start: stat(process.pid)?.start ?? null, children: [...children.values()] }));
  fs.renameSync(tmp, path.join(dir, 'owner.json'));
}
function cleanupNow() {
  if (!dirs.size || cleaned) return;
  cleaned = true;
  for (const fn of callbacks) { try { fn(); } catch {} }
  const tracked = [...children.values()];
  for (const child of tracked) kill(child);
  if (waitStopped(tracked.map(child => child.pid))) for (const dir of dirs.values()) remove(dir);
}
function runDir(base = os.tmpdir()) {
  base = path.resolve(base);
  if (dirs.has(base)) return dirs.get(base);
  fs.mkdirSync(base, { recursive: true });
  sweep(base);
  const dir = fs.mkdtempSync(path.join(base, `wheelchair-test-run-${process.pid}-`));
  dirs.set(base, dir);
  writeOwner(dir);
  if (installed) return dir;
  installed = true;
  process.on('exit', cleanupNow);
  const handlers = new Map();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    const handler = () => {
      cleanupNow();
      for (const [name, listener] of handlers) process.removeListener(name, listener);
      process.kill(process.pid, signal);
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
  return dir;
}
function makeTemp(prefix = 'tmp-', base) { return fs.promises.mkdtemp(path.join(runDir(base), prefix)); }
function makeTempSync(prefix = 'tmp-', base) { return fs.mkdtempSync(path.join(runDir(base), prefix)); }
function trackChild(child, { group = false } = {}) {
  runDir();
  if (!child.pid) return;
  const record = { pid: child.pid, start: stat(child.pid)?.start ?? null, group };
  children.set(child, record);
  for (const dir of dirs.values()) writeOwner(dir);
  child.once('exit', () => { children.delete(child); for (const dir of dirs.values()) try { writeOwner(dir); } catch {} });
}
function onCleanup(fn) { callbacks.push(fn); }
module.exports = { runDir, makeTemp, makeTempSync, trackChild, onCleanup, cleanupNow };
