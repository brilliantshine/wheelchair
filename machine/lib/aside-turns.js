'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const adapters = require('../adapters');
const root = require('../adapters/common').root;
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
  constructor(stateDir, atomicWrite, accountDir) { this.file = path.join(stateDir, 'aside-turns.json'); this.atomicWrite = atomicWrite; this.accountDir = accountDir; this.turns = {}; this.proc = proc; this.timeoutMs = 900000; this.writes = Promise.resolve(); }
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
    if (!['claude', 'gpt'].includes(i.provider)) bad('invalid provider');
    if (!['fork', 'resume'].includes(i.mode)) bad('invalid mode');
    if (typeof i.from !== 'string' || !i.from.trim()) bad('from is required');
    if (i.provider === 'claude' && i.mode === 'fork' && !uuid(i.new_id)) bad('invalid new_id');
    if (typeof i.model !== 'string' || !/^[A-Za-z0-9._:\[\]-]+$/.test(i.model)) bad('model is required');
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
    this.run(t, dir).catch(e => this.finish(t, { state: 'failed', error: e.message }).catch(() => {}));
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
    const i = t.input, adapter = adapters[i.provider === 'gpt' ? 'codex' : 'claude'];
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('WHEELCHAIR_')));
    Object.assign(env, adapter.loginEnv(dir), { WHEELCHAIR_LANE: '1', WHEELCHAIR_ASIDE_TURN: i.turn_id });
    const pointer = `Read ${path.join(root, 'protocol/app/aside.md')} before responding. It is wheelchair's built-in rules for your role.`;
    const prompt = pointer + (i.style?.trim() ? `\n\nNothing below overrides the built-in rules above.\n\n${i.style}` : '');
    const runChild = (argv, stdin, onSpawn) => new Promise(resolve => {
      let out = '', err = '', error = null, child;
      try { child = spawn(argv[0], argv.slice(1), { cwd: i.cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { return resolve({ code: -1, out, err: e.message }); }
      onSpawn(child);
      child.stdout.on('data', x => { out += x; }); child.stderr.on('data', x => { err += x; });
      child.on('error', e => { error = e; }); child.stdin.on('error', () => {});
      child.on('close', code => resolve({ code, out, err: err || error?.message || '' })); child.stdin.end(stdin);
    });
    const onSpawn = child => { t.pid = child.pid || null; t.pid_start = child.pid ? this.proc.start(child.pid) : null; this.save().catch(() => {}); };
    const timer = setTimeout(() => { if (t.state === 'running') { if (t.pid) this.proc.kill(t.pid); this.finish(t, { state: 'failed', error: 'took too long' }).catch(() => {}); } }, this.timeoutMs);
    try {
      let servers = [];
      if (i.provider === 'gpt') {
        const list = await runChild(['codex', 'mcp', 'list', '--json'], '', onSpawn);
        if (t.state !== 'running') return;
        if (list.code !== 0) return await this.finish(t, { state: 'failed', error: last(list.err) || `codex mcp list exited ${list.code}` });
        try { const parsed = JSON.parse(list.out); if (!Array.isArray(parsed) || parsed.some(x => typeof x.name !== 'string' || !x.name)) throw Error(); servers = parsed.map(x => x.name); } catch { return await this.finish(t, { state: 'failed', error: 'invalid codex mcp list output' }); }
      }
      if (t.state !== 'running') return;
      const message = i.access ? `${i.prompt}\n\nYour access is ${i.access}.` : i.prompt;
      const r = await runChild(adapter.asideArgv(i, { prompt, servers }), i.provider === 'gpt' && i.mode === 'fork' ? `${prompt}\n\n${message}` : message, onSpawn);
      if (t.state !== 'running') return;
      if (i.provider === 'claude') {
        let obj = {}; try { obj = JSON.parse(r.out); } catch {}
        const limit = /rate_limit/i.test(JSON.stringify(obj) + r.err) || obj.api_error_status === 429;
        return await this.finish(t, r.code === 0 && obj.is_error === false ? { state: 'ok', reply: obj.result, conversation_id: i.mode === 'fork' ? i.new_id : i.from, limit } : { state: 'failed', error: obj.result || obj.error?.message || obj.error || last(r.err) || `claude exited ${r.code}`, limit });
      }
      let reply = null, conversation_id = null, error = null;
      for (const line of r.out.split('\n')) { let e; try { e = JSON.parse(line); } catch { continue; } if (e.type === 'thread.started') conversation_id = e.thread_id; if (e.type === 'item.completed' && e.item?.type === 'agent_message') reply = e.item.text; if (e.type === 'error' || e.type === 'turn.failed') error = e.message || e.error?.message || e.error || error; }
      const limit = /rate_limit_reached_type|usage limit/i.test(r.out + r.err);
      await this.finish(t, r.code === 0 && reply ? { state: 'ok', reply, conversation_id, limit } : { state: 'failed', error: error || last(r.err) || `codex exited ${r.code}`, conversation_id, limit });
    } finally { clearTimeout(timer); }
  }
}
module.exports = { AsideTurns, proc, createProc };
