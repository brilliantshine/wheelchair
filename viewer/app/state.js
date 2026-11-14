'use strict';

// Spec "State": hub files, safe thread identifiers, and atomic persistence.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_STATE = path.join(os.homedir(), '.local', 'state', 'wheelchair');

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

  async thread(id) {
    const thread = await readJson(this.threadPath(id), null);
    if (!thread) throw appError(404, 'thread not found');
    return thread;
  }

  async save(thread) {
    thread.updated_at = new Date().toISOString();
    await atomicWrite(this.threadPath(thread.id), json(thread));
    return thread;
  }

  async allThreads() {
    const names = await fs.readdir(this.threadsDir).catch(() => []);
    const threads = await Promise.all(
      names
        .filter((name) => name.endsWith('.json'))
        .map((name) => readJson(path.join(this.threadsDir, name), null)),
    );
    return threads
      .filter(Boolean)
      .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)));
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

  async markMachineSeen(name, lastSeen) {
    const machines = await this.machines();
    const machine = await this.resolveMachine(machines, name);
    if (!machine) throw appError(404, `unknown machine: ${name}`);
    machine.last_seen = lastSeen;
    await atomicWrite(this.machinesPath, json(machines));
    return machine;
  }
}

module.exports = { DEFAULT_STATE, State, appError, atomicWrite, readJson };
