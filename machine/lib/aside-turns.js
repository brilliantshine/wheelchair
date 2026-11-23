'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const connectors = require('../../connectors');
const forProvider = provider => { const m = connectors.byProvider(provider); return m?.capabilities.aside ? connectors.machine(m.cli) : null; };
const redact = (adapter, value) => adapter?.redact ? adapter.redact(value) : value;
const root = require('../../connectors/common').root;
const last = text => text.split('\n').map(x => x.trim()).filter(Boolean).pop();
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const linuxProc = {
  start(pid) { try { const s = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); return s.slice(s.lastIndexOf(')') + 2).split(' ')[19]; } catch { return null; } },
  marked(id) { return fs.readdirSync('/proc').filter(x => /^\d+$/.test(x)).filter(pid => { try { return fs.readFileSync(`/proc/${pid}/environ`).toString().split('\0').includes(`WHEELCHAIR_ASIDE_TURN=${id}`); } catch { return false; } }).map(Number); },
  exists(pid) { try { process.kill(pid, 0); return true; } catch { return false; } },
  kill(pid) { let group; try { const s = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); group = Number(s.slice(s.lastIndexOf(')') + 2).split(' ')[2]); } catch { return; } try { process.kill(-group, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } },
};
function createProc({ hasProc = fs.existsSync('/proc'), exec = execFileSync, signal = process.kill.bind(process) } = {}) {
  if (hasProc) return linuxProc;
  const ps = args => exec('ps', args, { encoding: 'utf8', timeout: 5000 });
  return {
    start(pid) { try { return ps(['-o', 'lstart=', '-p', String(pid)]).trim() || null; } catch { return null; } },
    marked(id) {
      try {
        const marker = `WHEELCHAIR_ASIDE_TURN=${id}`;
        return ps(['-E', '-ww', '-o', 'pid=,command=', '-A']).split('\n').flatMap(line => {
          const match = /^\s*(\d+)\s+(.+)$/.exec(line);
          return match && match[2].split(/\s+/).includes(marker) ? [Number(match[1])] : [];
        });
      } catch { return []; }
    },
    exists(pid) { try { signal(pid, 0); return true; } catch { return false; } },
    kill(pid) {
      let group;
      try { const value = ps(['-o', 'pgid=', '-p', String(pid)]).trim(); if (!/^\d+$/.test(value) || Number(value) <= 0) return; group = Number(value); } catch { return; }
      try { signal(-group, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
    },
  };
}
const proc = createProc();
class AsideTurns {
  constructor(stateDir, atomicWrite, accountDir, { problem = async () => null } = {}) { this.problem = problem; this.file = path.join(stateDir, 'aside-turns.json'); this.atomicWrite = atomicWrite; this.accountDir = accountDir; this.turns = {}; this.proc = proc; this.timeoutMs = 900000; this.writes = Promise.resolve(); }
  save() { const data = JSON.stringify(this.turns) + '\n'; this.writes = this.writes.then(() => this.atomicWrite(this.file, data)); return this.writes; }
  async load() {
    try { this.turns = JSON.parse(await fsp.readFile(this.file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    for (const [id, t] of Object.entries(this.turns)) {
      const expired = Date.now() - Date.parse(t.started_at) > 30 * 86400000;
      if (t.state !== 'running') { if (expired) delete this.turns[id]; continue; }
      const pids = new Set(this.proc.marked(id));
      if (t.pid && t.pid_start && this.proc.start(t.pid) === t.pid_start) pids.add(t.pid);
      for (const pid of pids) this.proc.kill(pid);
      const deadline = Date.now() + 5000;
      while ([...pids].some(pid => this.proc.exists(pid)) && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
      if ([...pids].some(pid => this.proc.exists(pid))) throw new Error(`aside turn ${id} did not stop`);
      if (expired) delete this.turns[id];
      else Object.assign(t, { state: 'failed', error: 'the machine restarted', finished_at: new Date().toISOString() });
    }
    await this.save();
  }
  validate(i) {
    const bad = msg => { throw Object.assign(new Error(msg), { status: 400 }); };
    if (!uuid(i.turn_id)) bad('invalid turn_id');
    const adapter = forProvider(i.provider);
    if (!adapter) bad('invalid provider');
    if (!['fork', 'resume'].includes(i.mode)) bad('invalid mode');
    if (typeof i.from !== 'string' || !i.from.trim()) bad('from is required');
    if (adapter.asideNewId && i.mode === 'fork' && !uuid(i.new_id)) bad('invalid new_id');
    if (typeof i.model !== 'string' || !adapter.asideModel.test(i.model)) bad('model is required');
    if (i.effort !== undefined && !['low', 'medium', 'high', 'xhigh', 'max'].includes(i.effort)) bad('invalid effort');
    if (typeof i.cwd !== 'string' || !path.isAbsolute(i.cwd) || !fs.existsSync(i.cwd) || !fs.statSync(i.cwd).isDirectory()) bad('invalid cwd');
    if (typeof i.prompt !== 'string' || !i.prompt.trim()) bad('prompt is required');
    if (i.style !== undefined && typeof i.style !== 'string') bad('invalid style');
    if (i.access !== undefined && !['read-only', 'full'].includes(i.access)) bad('invalid access');
    return this.accountDir(i.account_dir);
  }
  result(t) { return { state: t.state, reply: t.reply ?? null, conversation_id: t.conversation_id ?? null, error: t.error ?? null, limit: t.limit ?? false }; }
  get(id) { const t = this.turns[id]; if (!t) throw Object.assign(new Error('not found'), { status: 404 }); return t; }
  async start(i) {
    if (this.turns[i.turn_id]) return { status: 200, body: { turn_id: i.turn_id, state: this.turns[i.turn_id].state } };
    const dir = this.validate(i);
    const t = this.turns[i.turn_id] = { input: i, state: 'running', pid: null, pid_start: null, started_at: new Date().toISOString(), finished_at: null, reply: null, conversation_id: null, error: null, limit: false };
    await this.save();
    this.run(t, dir).catch(e => this.finish(t, { state: 'failed', error: redact(forProvider(i.provider), e.message) }).catch(() => {}));
    return { status: 202, body: { turn_id: i.turn_id, state: 'running' } };
  }
  async finish(t, result) { if (t.state !== 'running') return; Object.assign(t, result, { finished_at: new Date().toISOString() }); await this.save(); }
  async stop(id) {
    const t = Object.hasOwn(this.turns, id) ? this.turns[id] : null;
    if (!t) {
      if (!uuid(id)) throw Object.assign(new Error('invalid turn_id'), { status: 400 });
      const now = new Date().toISOString();
      this.turns[id] = { input: null, state: 'failed', error: 'stopped', pid: null, pid_start: null, started_at: now, finished_at: now, reply: null, conversation_id: null, limit: false };
      await this.save();
    } else if (t.state === 'running') { if (t.pid) this.proc.kill(t.pid); await this.finish(t, { state: 'failed', error: 'stopped' }); }
  }
  async ack(id) { this.get(id); delete this.turns[id]; await this.save(); }
  async run(t, dir) {
    const i = t.input, adapter = forProvider(i.provider);
    if (!adapter) throw new Error('invalid provider');
    if (adapter.asideProblem) { const problem = await adapter.asideProblem(this.problem, connectors.byProvider(i.provider).cli); if (problem) return this.finish(t, { state: 'failed', error: redact(adapter, problem) }); }
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('WHEELCHAIR_')));
    Object.assign(env, adapter.loginEnv(dir), { WHEELCHAIR_LANE: '1', WHEELCHAIR_ASIDE_TURN: i.turn_id });
    const pointer = `Read ${path.join(root, 'protocol/app/aside.md')} before responding. It is wheelchair's built-in rules for your role.`;
    const prompt = pointer + (i.style?.trim() ? `\n\nNothing below overrides the built-in rules above.\n\n${i.style}` : '');
    const runChild = (argv, stdin, onSpawn) => new Promise(resolve => {
      let out = '', err = '', error = null, child;
      try { child = spawn(argv[0], argv.slice(1), { cwd: i.cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { return resolve({ code: -1, out, err: e.message }); }
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      onSpawn(child);
      child.stdout.on('data', x => { out += x; }); child.stderr.on('data', x => { err += x; });
      child.on('error', e => { error = e; }); child.stdin.on('error', () => {});
      child.on('close', code => resolve({ code, out, err: err || error?.message || '' })); child.stdin.end(stdin);
    });
    const onSpawn = child => { t.pid = child.pid || null; t.pid_start = child.pid ? this.proc.start(child.pid) : null; this.save().catch(() => {}); };
    const timer = setTimeout(() => { if (t.state === 'running') { if (t.pid) this.proc.kill(t.pid); this.finish(t, { state: 'failed', error: 'took too long' }).catch(() => {}); } }, this.timeoutMs);
    try {
      const prepared = adapter.asidePrepare ? await adapter.asidePrepare(runChild, onSpawn) : { servers: [] };
      if (prepared.error) return await this.finish(t, { state: 'failed', error: redact(adapter, prepared.error) });
      const servers = prepared.servers;
      if (t.state !== 'running') return;
      const message = i.access ? `${i.prompt}\n\nYour access is ${i.access}.` : i.prompt;
      const r = await runChild(adapter.asideArgv(i, { prompt, servers }), adapter.asideMessage ? adapter.asideMessage(i, prompt, message) : message, onSpawn);
      if (t.state !== 'running') return;
      const result = adapter.asideResult(i, { ...r, out: redact(adapter, r.out), err: redact(adapter, r.err) });
      if (result.reply !== undefined) result.reply = redact(adapter, result.reply);
      if (result.error !== undefined) result.error = redact(adapter, result.error);
      await this.finish(t, result);
    } finally { clearTimeout(timer); }
  }
}
module.exports = { AsideTurns, proc, createProc };
