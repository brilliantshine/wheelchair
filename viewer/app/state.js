'use strict';

// Spec "State": hub files, safe thread identifiers, and atomic persistence.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_STATE = path.join(os.homedir(), '.local', 'state', 'wheelchair');
// Filesystem timestamp ticks can be coarse (up to 1 s) and clocks can skew.
const SETTLE_MS = 2000;

function appError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function atomicWrite(file, value, mode = 0o600) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${crypto.randomUUID()}.tmp`,
  );
  await fs.writeFile(temporary, value, { mode });
  await fs.rename(temporary, file);
  await fs.chmod(file, mode);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

class State {
  constructor(stateDir = DEFAULT_STATE) {
    this.dir = path.resolve(stateDir);
    this.threadsDir = path.join(this.dir, 'threads');
    this.machinesPath = path.join(this.dir, 'machines.json');
    this.projectsPath = path.join(this.dir, 'projects.json');
    this.settingsPath = path.join(this.dir, 'settings.json');
    this.writes = new Map();
    this.threadCache = new Map();
  }

  // Atomic replacement protects a single write; this queue protects the read-modify-write
  // transaction that precedes it.  Keep the queue keyed by path so unrelated threads do not
  // block each other.
  queued(file, operation) {
    const previous = this.writes.get(file) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    // The chain swallows a failed operation's error (the caller still gets it from `next`);
    // left uncaught, one refused card would end the whole viewer process.
    const retained = next.catch(() => {}).finally(() => {
      if (this.writes.get(file) === retained) this.writes.delete(file);
    });
    this.writes.set(file, retained);
    return next;
  }

  async init() {
    await fs.mkdir(this.threadsDir, { recursive: true, mode: 0o700 });
    await fs.chmod(this.threadsDir, 0o700);
    if (!(await readJson(this.machinesPath, null))) {
      const service = await readJson(path.join(this.dir, 'machine.json'), {});
      const hub = {
        name: 'hub',
        address: service.host || '127.0.0.1',
        port: service.port || 7374,
        secret_file: service.secret_file || '',
      };
      await atomicWrite(this.machinesPath, json({ hub }));
    }
    if (!(await readJson(this.projectsPath, null))) {
      await atomicWrite(this.projectsPath, json([]));
    }
  }

  threadPath(id) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      throw appError(400, 'invalid thread id');
    }
    return path.join(this.threadsDir, `${id}.json`);
  }

  sentPath(id) {
    this.threadPath(id);
    return path.join(this.threadsDir, `${id}.sent.jsonl`);
  }

  // Sent history rolls out of the thread's bounded JSON record into an append-only sibling.
  // The thread lock owns this append, so records stay in their submit order.
  async appendSent(id, entries) {
    if (!entries.length) return;
    await fs.appendFile(
      this.sentPath(id),
      `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
      { mode: 0o600 },
    );
  }

  async thread(id) {
    const thread = await readJson(this.threadPath(id), null);
    if (!thread) throw appError(404, 'thread not found');
    return thread;
  }

  async save(thread) {
    const file = this.threadPath(thread.id);
    return this.queued(file, async () => {
      thread.updated_at = new Date().toISOString();
      await atomicWrite(file, json(thread));
      this.threadCache.delete(file);
      return thread;
    });
  }

  async updateThread(id, operation) {
    const file = this.threadPath(id);
    return this.queued(file, async () => {
      const thread = await readJson(file, null);
      if (!thread) throw appError(404, 'thread not found');
      const result = await operation(thread);
      thread.updated_at = new Date().toISOString();
      await atomicWrite(file, json(thread));
      this.threadCache.delete(file);
      return result;
    });
  }

  async cachedThread(file) {
    try {
      const checkedAt = Date.now();
      const stat = await fs.stat(file);
      const cached = this.threadCache.get(file);
      if (cached
        && ['mtimeMs', 'ctimeMs', 'size', 'ino'].every((key) => cached[key] === stat[key])
        && Math.max(cached.mtimeMs, cached.ctimeMs) < cached.checkedAt - SETTLE_MS) return cached.record;
      this.threadCache.delete(file);
      const record = JSON.parse(await fs.readFile(file, 'utf8'));
      const freeze = (value) => {
        if (value && typeof value === 'object') {
          for (const child of Object.values(value)) freeze(child);
          Object.freeze(value);
        }
        return value;
      };
      freeze(record);
      this.threadCache.set(file, { mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, size: stat.size, ino: stat.ino, checkedAt, record });
      return record;
    } catch (error) {
      this.threadCache.delete(file);
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async threadSnapshot(id) {
    const thread = await this.cachedThread(this.threadPath(id));
    if (!thread) throw appError(404, 'thread not found');
    return thread;
  }

  async allThreads() {
    const names = await fs.readdir(this.threadsDir).catch(() => []);
    const files = names.filter((name) => name.endsWith('.json')).map((name) => path.join(this.threadsDir, name));
    const present = new Set(files);
    for (const file of this.threadCache.keys()) if (!present.has(file)) this.threadCache.delete(file);
    const threads = await Promise.all(files.map((file) => this.cachedThread(file)));
    return threads.filter(Boolean).sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)));
  }

  async machines() {
    const machines = await readJson(this.machinesPath, {});
    if (!Array.isArray(machines)) return machines;
    return Object.fromEntries(machines.map((machine) => [machine.name, machine]));
  }

  // Threads name the hub's own machine "hub" (the default in threads.js and the new-thread
  // form), but the installer registers it under the machine's hostname so worker machines can
  // join beside it. "hub" therefore also means the entry for this host's own service.
  async resolveMachine(machines, name) {
    if (machines[name]) return machines[name];
    if (name !== 'hub') return null;
    const service = await readJson(path.join(this.dir, 'machine.json'), {});
    const local = Object.values(machines).filter((machine) => (
      (machine.address || machine.host) === service.host && (machine.port || 7374) === (service.port || 7374)
    ));
    return local.length === 1 ? local[0] : null;
  }

  async machine(name) {
    const machine = await this.resolveMachine(await this.machines(), name);
    if (!machine) throw appError(404, `unknown machine: ${name}`);
    return machine;
  }

  async projects() {
    const list = await readJson(this.projectsPath, []);
    return Array.isArray(list) ? list : [];
  }

  async settings(fallback) {
    return readJson(this.settingsPath, fallback);
  }

  saveSettings(value) {
    return this.queued(this.settingsPath, () => atomicWrite(this.settingsPath, json(value)));
  }

  // Settings saves are edited independently by the page.  Keep reading, changing, and
  // replacing the file in one queue entry so a simultaneous save cannot restore an older
  // snapshot over a newer field.
  updateSettings(change) {
    return this.queued(this.settingsPath, async () => {
      const current = await readJson(this.settingsPath, null);
      const updated = await change(current);
      await atomicWrite(this.settingsPath, json(updated));
      return updated;
    });
  }

  // Spec "State": projects.json is the repos the app lists. Serialized so two threads created
  // together can't lose each other's entry.
  addProject(project) {
    return this.queued(this.projectsPath, async () => {
      const list = await this.projects();
      if (list.includes(project)) return;
      await atomicWrite(this.projectsPath, json([...list, project]));
    });
  }

  async markMachineSeen(name, lastSeen) {
    return this.queued(this.machinesPath, async () => {
      const machines = await this.machines();
      const machine = await this.resolveMachine(machines, name);
      if (!machine) throw appError(404, `unknown machine: ${name}`);
      machine.last_seen = lastSeen;
      await atomicWrite(this.machinesPath, json(machines));
      return machine;
    });
  }
}

module.exports = { DEFAULT_STATE, SETTLE_MS, State, appError, atomicWrite, readJson };
