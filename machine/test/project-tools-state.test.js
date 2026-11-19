'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');

async function fixture(t) {
  const root = await makeTemp('tools-state-'), bin = path.join(root, 'bin'), state = path.join(root, 'state');
  const work = path.join(state, 'worktrees', 'project', 'wc', 'thread'), worker = path.join(root, 'worker');
  await fsp.mkdir(bin, { recursive: true }); await fsp.mkdir(work, { recursive: true }); await fsp.mkdir(worker);
  const home = path.join(root, 'home'); await fsp.mkdir(home);
  const script = `#!/bin/sh
case "$(basename "$0"):$1" in
 systemd-run:*) exit 1;;
 tmux:show-environment) echo call >> "$TOOLS_CALLS"; if [ "$TOOLS_PATH" = hang ]; then exec sleep 30; fi; printf '%s\\n' "$TOOLS_PATH";;
 tmux:load-buffer) cat >/dev/null;;
 tmux:capture-pane) printf 'Ask Codex to do anything\\n? for shortcuts\\n';;
 git:*) echo deadbeef;;
esac
`;
  for (const name of ['git', 'tmux', 'systemd-run']) await fsp.writeFile(path.join(bin, name), script, { mode: 0o755 });
  const old = { PATH: process.env.PATH, TOOLS_PATH: process.env.TOOLS_PATH, TOOLS_CALLS: process.env.TOOLS_CALLS, HOME: process.env.HOME };
  process.env.PATH = `${bin}:${old.PATH}`; process.env.TOOLS_PATH = '-PATH'; process.env.TOOLS_CALLS = path.join(root, 'calls'); process.env.HOME = home;
  const services = [];
  async function service() { const s = new MachineService({ stateDir: state, host: '127.0.0.1', port: 1 }); await s.init(); services.push(s); return s; }
  t.after(async () => { for (const s of services) { await Promise.all(s.projectToolsWrites.values()); for (const timer of [s.pollTimer, s.stepsTimer, s.trustTimer, s.agyToolsTimer]) clearInterval(timer); } for (const [k,v] of Object.entries(old)) if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  let n = 0;
  const start = (s, opts = {}) => s.start({ name: `wc-test-${++n}`, role: 'lead', cli: 'codex', thread_id: 'thread', token: 'token', project: 'project', worktree: work, ...opts });
  const file = (dir, servers) => fsp.writeFile(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: servers }));
  return { root, bin, state, work, worker, service, start, file, calls: process.env.TOOLS_CALLS };
}

test('tmux PATH, timeout and unset fallback drive program checks', async t => {
  const f = await fixture(t), s = await f.service();
  await fsp.writeFile(path.join(f.bin, 'runner'), '#!/bin/sh\n', { mode: 0o755 });
  await f.file(f.work, { a: { command: 'runner' } });
  process.env.TOOLS_PATH = 'PATH=/nonexistent';
  assert.equal((await f.start(s)).project_tools.programs.length, 1);
  process.env.TOOLS_PATH = `PATH=${f.bin}`;
  assert.deepEqual((await f.start(s)).project_tools.programs, []);
  process.env.TOOLS_PATH = '-PATH'; assert.deepEqual((await f.start(s)).project_tools.programs, []);
  process.env.TOOLS_PATH = 'hang'; const before = Date.now();
  assert.deepEqual((await f.start(s)).project_tools.programs, []); assert.ok(Date.now() - before >= 1900 && Date.now() - before < 5000);
});

test('state ownership, invalid files, failure, reset, retry and persistence', async t => {
  const f = await fixture(t), s = await f.service();
  await f.file(f.work, { a: { command: 'missing-program' }, b: { type: 'sse', url: 'https://example.test' } });
  const first = await f.start(s); assert.equal(first.project_tools.seq, 1); assert.equal(first.project_tools.programs.length, 1); assert.equal(first.project_tools.clis.codex.lines.length, 1);
  assert.deepEqual((await s.start({ name: first.name, role: 'lead', cli: 'codex', thread_id: 'thread', token: 'token', project: 'project', worktree: f.work })).project_tools, first.project_tools);
  await f.file(f.worker, { x: { type: 'sse', url: 'https://example.test' } });
  const worker = await f.start(s, { worktree: f.worker, role: 'worker', cli: 'codex' });
  assert.equal(worker.project_tools.seq, 2); assert.deepEqual(worker.project_tools.file, first.project_tools.file); assert.deepEqual(worker.project_tools.programs, first.project_tools.programs);
  await f.file(f.worker, {}); const noreset = await f.start(s, { worktree: f.worker }); assert.equal(noreset.project_tools.clis.codex.lines.length, 1);
  await fsp.writeFile(path.join(f.work, '.mcp.json'), '{'); const failure = await f.start(s); assert.equal(failure.project_tools.file.length, 1); assert.equal(failure.project_tools.programs.length, 1);
  const calls = (await fsp.readFile(f.calls, 'utf8')).split('\n').length;
  await f.file(f.work, { invalid: {} }); const invalid = await f.start(s); assert.equal(invalid.project_tools.file.length, 1); assert.deepEqual(invalid.project_tools.programs, []); assert.equal((await fsp.readFile(f.calls, 'utf8')).split('\n').length, calls);
  await f.file(f.work, {}); const reset = await f.start(s); assert.deepEqual(reset.project_tools.clis, {}); assert.deepEqual(reset.project_tools.file, []);
  await s.projectToolsWrites.get('thread'); const disk = JSON.parse(await fsp.readFile(path.join(f.state, 'project-tools/thread.json'))); assert.equal(disk.seq, reset.project_tools.seq);
  assert.ok(!('project_tools' in s.sessionList()[0])); assert.ok(!('project_tools' in s.status().sessions[0]));
  const review = await f.start(s, { role: 'reviewer' }); assert.ok(!('project_tools' in review)); assert.equal(s.projectTools.get('thread').seq, disk.seq);
  const s2 = await f.service(); const restarted = await f.start(s2); assert.equal(restarted.project_tools.seq, disk.seq + 1); assert.notEqual(restarted.project_tools.boot, reset.project_tools.boot);
});

test('startup sweeps temporary files and write failure does not prevent start', async t => {
  const f = await fixture(t); const dir = path.join(f.state, 'project-tools'); await fsp.mkdir(dir, { recursive: true }); await fsp.writeFile(path.join(dir, 'old.tmp'), 'x');
  const s = await f.service(); assert.ok(!fs.existsSync(path.join(dir, 'old.tmp')));
  await fsp.mkdir(path.join(dir, 'thread.json.tmp')); const result = await f.start(s); await s.projectToolsWrites.get('thread'); assert.equal(result.project_tools.seq, 1);
});

test('cross-CLI recomputation honors hashes and thread checkout ownership', async t => {
  const f = await fixture(t), s = await f.service();
  const skip = { a: { type: 'sse', url: 'https://example.test' } };
  await f.file(f.work, skip); await f.file(f.worker, skip);
  const a = await f.start(s, { cli: 'agy' }); assert.equal(a.project_tools.clis.agy.lines.length, 1);
  await f.file(f.work, { a: { type: 'http', url: 'https://example.test' } });
  const fixed = await f.start(s); assert.deepEqual(fixed.project_tools.clis.agy.lines, []);
  await f.file(f.worker, skip); const worker = await f.start(s, { cli: 'agy', role: 'worker', worktree: f.worker }); assert.equal(worker.project_tools.clis.agy.lines.length, 1);
  const unchanged = await f.start(s); assert.equal(unchanged.project_tools.clis.agy.lines.length, 1);
  await f.file(f.work, skip); const same = await f.start(s); assert.equal(same.project_tools.clis.agy.thread, true);
  await f.file(f.work, { a: { type: 'http', url: 'https://example.test' } }); const cleared = await f.start(s); assert.deepEqual(cleared.project_tools.clis.agy.lines, []);
});

test('missing thread directory is harmless and concurrent retry joins the same start', async t => {
  const f = await fixture(t), s = await f.service();
  await f.file(f.worker, { a: { command: 'missing' } });
  const input = { name: 'wc-joined', cli: 'codex', role: 'worker', thread_id: 'other', token: 'token', project: 'project', worktree: f.worker };
  const [a, b] = await Promise.all([s.start(input), s.start(input)]); assert.deepEqual(a.project_tools, b.project_tools); assert.equal(a.project_tools.seq, 1); assert.deepEqual(a.project_tools.programs, []);
});

test('verifier checkout cannot reset; deleting thread file resets', async t => {
  const f = await fixture(t), s = await f.service();
  await f.file(f.work, { a: { command: 'missing' }, b: { type: 'sse', url: 'https://example.test' } });
  const first = await f.start(s); await f.file(f.worker, {});
  const verifier = await f.start(s, { role: 'verifier', worktree: f.worker, branch: 'wc/thread' });
  assert.deepEqual(verifier.project_tools.programs, first.project_tools.programs); assert.deepEqual(verifier.project_tools.clis, first.project_tools.clis);
  await fsp.unlink(path.join(f.work, '.mcp.json')); const reset = await f.start(s);
  assert.deepEqual(reset.project_tools.file, []); assert.deepEqual(reset.project_tools.programs, []); assert.deepEqual(reset.project_tools.clis, {});
});

test('queued saves persist the latest state after overlapping updates', async t => {
  const f = await fixture(t), s = await f.service();
  const input = { thread_id: 'thread', cli: 'codex', role: 'worker' };
  const read = { mcp: { names: ['a'], servers: {} }, warnings: [], hash: 'hash' };
  for (let i = 0; i < 20; i++) s.updateProjectTools(input, { name: `wc-${i}` }, f.work, '', '', read, { warnings: [] }, true, [{ names: ['a'], text: String(i) }]);
  await s.projectToolsWrites.get('thread');
  const state = JSON.parse(await fsp.readFile(path.join(f.state, 'project-tools/thread.json')));
  assert.equal(state.seq, 20); assert.equal(state.programs[0].text, '19');
});


test('invalid saved state falls back and valid saved state loads', async t => {
  const f = await fixture(t);
  const saved = path.join(f.state, 'project-tools', 'thread.json');
  await fsp.mkdir(path.dirname(saved), { recursive: true });
  const empty = { seq: 0, file: [], programs: [], clis: {} };
  const cases = [null, {}, [], { ...empty, seq: -1 }, { ...empty, seq: '3' },
    { ...empty, file: [{ names: [1], text: 'bad' }] },
    { ...empty, programs: [{ names: [], text: 1 }] },
    { ...empty, clis: { codex: { lines: [], thread: 'yes', hash: null } } },
    { ...empty, clis: { codex: { lines: [], thread: true, hash: 3 } } }];
  for (const value of cases) {
    await fsp.writeFile(saved, JSON.stringify(value));
    const s = await f.service();
    const result = await f.start(s);
    assert.equal(result.project_tools.seq, 1);
    assert.deepEqual(result.project_tools.file, []);
    assert.deepEqual(result.project_tools.programs, []);
    assert.deepEqual(result.project_tools.clis, {});
    assert.ok(s.sessions[result.name]);
    await s.projectToolsWrites.get('thread');
  }
  const valid = { seq: 7, file: [{ names: [], text: 'saved' }], programs: [], clis: { codex: { lines: [], thread: true, hash: null } } };
  await fsp.writeFile(saved, JSON.stringify(valid));
  const s = await f.service();
  const result = await f.start(s, { worktree: f.worker, role: 'worker' });
  assert.equal(result.project_tools.seq, 8);
  assert.deepEqual(result.project_tools.file, valid.file);
  assert.deepEqual(result.project_tools.clis, valid.clis);
  assert.ok(s.sessions[result.name]);
});
