'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');

test('marked Claude tool is rewritten once, written privately and removed at stop', async () => {
  const root = await makeTemp('forward-service-'), state = path.join(root, 'state'), work = path.join(root, 'work'), bin = path.join(root, 'bin');
  fs.mkdirSync(work); fs.mkdirSync(bin);
  for (const name of ['git', 'tmux', 'systemd-run']) fs.writeFileSync(path.join(bin, name), '#!/bin/sh\ncase "$1" in capture-pane) echo "❯ Try anything";; esac\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(work, '.mcp.json'), JSON.stringify({ mcpServers: { tool: { type: 'http', url: 'http://localhost:1234/mcp' } }, wheelchair: { windows: ['tool'] } }));
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  const forwards = { get: async port => { assert.equal(port, 1234); return 4567; }, restore: async () => {}, status: () => ({}), check: async () => ({ ok: true }) };
  const service = new MachineService({ stateDir: state, win: { procRoot: root, etcRoot: root, runRoot: root, forwards } });
  service.win.detected.kernel = true;
  let calls = 0; const command = service.commandFor.bind(service); service.commandFor = (...args) => { calls++; return command(...args); };
  try {
    await service.init();
    const session = await service.start({ name: 'wc-forward', cli: 'claude', role: 'worker', thread_id: 'forward', token: 'token', worktree: work });
    const file = path.join(state, 'settings', `${session.name}.mcp.json`);
    assert.equal(calls, 1); assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(JSON.parse(fs.readFileSync(file)).mcpServers.tool.url, 'http://127.0.0.1:4567/mcp');
    assert.ok(JSON.parse(fs.readFileSync(path.join(state, 'settings', `${session.name}.json`))).disabledMcpjsonServers.includes('tool'));
    assert.ok(session.command.includes('--mcp-config'));
    await service.stop(session.name); assert.equal(fs.existsSync(file), false);
  } finally {
    for (const key of ['pollTimer', 'stepsTimer', 'kimiTimer', 'trustTimer', 'agyToolsTimer', 'winTimer', 'screenTimer']) clearInterval(service[key]);
    clearInterval(service.win.healthTimer); process.env.PATH = old;
  }
});

test('status route checks only eligible tools without creating forwards', async () => {
  const state = await makeTemp('forward-status-');
  let gets = 0, checks = 0;
  const forwards = { get: async () => { gets++; }, restore: async () => {}, status: () => ({ note: 'restored', last: { reason: 'refused' } }), check: async port => { checks++; return port === 7 ? { ok: true } : { ok: false, reason: 'refused' }; } };
  const service = new MachineService({ stateDir: state, win: { procRoot: state, etcRoot: state, runRoot: state, forwards } });
  service.win.detected.kernel = true; service.win.forwardReady = () => true; service.authorize = async () => {};
  const { Readable } = require('node:stream');
  const input = { tools: [{ id: '__proto__', type: 'http', url: 'http://localhost:7' }, { id: 'bad', type: 'http', url: 'http://localhost:8' }, { id: 'sse', type: 'sse', url: 'http://localhost:9' }] };
  const request = Readable.from([Buffer.from(JSON.stringify(input))]); request.method = 'POST'; request.url = '/v1/project-tools/windows-status'; request.headers = {};
  let body; const response = { writeHead(code) { this.statusCode = code; }, end(value) { body = JSON.parse(value); } };
  await service.handle(request, response);
  assert.equal(response.statusCode, 200); assert.equal(body.status.__proto__.state, 'reachable'); assert.equal(body.status.__proto__.note, 'restored'); assert.equal(body.status.bad.reason, 'refused'); assert.equal(Object.hasOwn(body.status, 'sse'), false); assert.equal(checks, 2); assert.equal(gets, 0);
});

const net = require('node:net');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const agy = require('../../connectors/agy/machine.js');
const { createWinForward } = require('../lib/win-forward');

async function route(service, endpoint, input) {
  const request = Readable.from([Buffer.from(JSON.stringify(input))]);
  request.method = 'POST'; request.url = endpoint; request.headers = {};
  let body; const response = { writeHead(code) { this.statusCode = code; }, end(value) { body = JSON.parse(value); } };
  await service.handle(request, response); return { code: response.statusCode, body };
}
async function fixture(t, { kernel = true, ready = true, real = false, live = [] } = {}) {
  const root = await makeTemp('forward-matrix-'), state = path.join(root, 'state'), bin = path.join(root, 'bin');
  fs.mkdirSync(bin); fs.mkdirSync(state);
  const script = `#!/bin/sh
case "$(basename "$0"):$1" in
 systemd-run:*) exit 1;;
 tmux:new-session) printf '%s' "$*" > "$FORWARD_STATE/argv-$4"; cp "$FORWARD_STATE/win/forwards.json" "$FORWARD_STATE/hook-$4.json" 2>/dev/null || :;;
 tmux:list-sessions) printf '%s\\n' "$FORWARD_LIVE";;
 tmux:capture-pane) printf '❯ Try anything\\n? for shortcuts\\n';;
 git:*) case "$*" in *--git-common-dir*) echo .;; *) exit 1;; esac;;
esac
exit 0
`;
  for (const name of ['git', 'tmux', 'systemd-run', 'pi']) fs.writeFileSync(path.join(bin, name), script, { mode: 0o755 });
  const old = { PATH: process.env.PATH, FORWARD_STATE: process.env.FORWARD_STATE, FORWARD_LIVE: process.env.FORWARD_LIVE }, prepare = agy.prepare;
  process.env.PATH = `${bin}:${old.PATH}`; process.env.FORWARD_STATE = state; process.env.FORWARD_LIVE = live.join('\n'); agy.prepare = () => {};
  let gets = [], isReady = ready;
  const forwards = real ? createWinForward({ stateDir: state, ready: () => isReady, relayScript: 'fixture', spawnRelay: text => spawn(process.execPath, [path.join(__dirname, 'fixtures/fake-relay.js'), text, '{}']) }) : {
    get: async port => { gets.push(port); if (!isReady) throw Error('Windows bridge not available'); return port + 20000; }, restore: async () => {}, check: async () => ({ ok: true }), status: () => ({}),
  };
  const service = new MachineService({ stateDir: state, win: { procRoot: root, etcRoot: root, runRoot: root, forwards } });
  service.win.detected.kernel = kernel; service.win.forwardReady = () => isReady;
  service.win.runBridgeProbe = () => {}; service.authorize = async () => {};
  service.checkVersion = () => {}; service.cliStatus = () => ({ installed: true }); service.launchPath = async () => ({ executable: '/fake/kimi' });
  await service.init();
  t.after(() => {
    for (const key of ['pollTimer', 'stepsTimer', 'kimiTimer', 'trustTimer', 'agyToolsTimer', 'winTimer', 'screenTimer']) clearInterval(service[key]);
    clearInterval(service.win.healthTimer); agy.prepare = prepare;
    for (const [key, value] of Object.entries(old)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  });
  let serial = 0;
  function work(port = 1234, extra = {}) {
    const dir = path.join(root, `work-${++serial}`); fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { tool: { type: 'http', url: `http://localhost:${port}/mcp`, headers: { Secret: 'sensitive' } }, ...extra }, wheelchair: { windows: ['tool', ...Object.keys(extra)] } }));
    return dir;
  }
  const start = (name, cli, role = 'worker', port = 1234, dir = work(port)) => service.start({ name, cli, role, thread_id: name, token: 'token', worktree: dir });
  return { root, state, service, start, work, gets, ready: value => { isReady = value; } };
}
function filesUnder(root) {
  if (!fs.existsSync(root)) return '';
  return fs.readdirSync(root, { withFileTypes: true }).map(e => e.isDirectory() ? filesUnder(path.join(root, e.name)) : fs.readFileSync(path.join(root, e.name), 'utf8')).join('\n');
}

test('Codex and Antigravity receive private URLs', async t => {
  const f = await fixture(t);
  const codex = await f.start('wc-codex-forward', 'codex');
  assert.match(fs.readFileSync(path.join(f.state, `argv-${codex.name}`), 'utf8'), /127\.0\.0\.1:21234/);
  await f.start('wc-agy-forward', 'agy');
  assert.match(filesUnder(path.join(f.state, 'agy-tools')), /127\.0\.0\.1:21234/);
  assert.deepEqual(f.gets, [1234, 1234]);
});

test('interop off withholds marked tool and logs it for every CLI', async t => {
  const f = await fixture(t, { ready: false }); const lines = [], error = console.error; console.error = (...args) => lines.push(args.join(' '));
  try {
    for (const cli of ['claude', 'codex', 'agy']) {
      const name = `wc-off-${cli}`, session = await f.start(name, cli);
      const payload = fs.readFileSync(path.join(f.state, `argv-${name}`), 'utf8') + filesUnder(path.join(f.state, 'settings')) + filesUnder(path.join(f.state, 'agy-tools'));
      assert(!payload.includes('http://localhost:1234/mcp')); assert(!session.command.includes('--mcp-config'));
      assert(lines.some(line => line.includes(`${name}: project tools: tool: couldn't reach Windows (Windows bridge not available); left out of this session`)));
      if (cli === 'claude') assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.state, 'settings', `${name}.json`))).disabledMcpjsonServers, ['tool']);
    }
  } finally { console.error = error; }
});

test('off WSL loads original tool and emits no mark warnings', async t => {
  const f = await fixture(t, { kernel: false }); const lines = [], error = console.error; console.error = (...args) => lines.push(args.join(' '));
  try {
    const dir = f.work(1234, { sse: { type: 'sse', url: 'http://localhost:9999' } });
    const session = await f.start('wc-off-wsl', 'codex', 'worker', 1234, dir);
    assert.match(fs.readFileSync(path.join(f.state, `argv-${session.name}`), 'utf8'), /http:\/\/localhost:1234\/mcp/); assert.deepEqual(f.gets, []);
    assert(!lines.some(line => line.includes('Runs on Windows')));
  } finally { console.error = error; }
});

test('reviewer, mapper, Kimi and Pi do not request forwards or Claude config', async t => {
  const f = await fixture(t);
  for (const [cli, role] of [['claude', 'reviewer'], ['claude', 'mapper'], ['kimi', 'worker'], ['pi', 'worker']]) {
    const name = `wc-excluded-${cli}-${role}`, session = await f.start(name, cli, role);
    assert(!session.command.includes('--mcp-config')); assert(!fs.existsSync(path.join(f.state, 'settings', `${name}.mcp.json`)));
  }
  assert.deepEqual(f.gets, []);
});

test('shared forward survives both stops and concurrent records precede tmux', async t => {
  const f = await fixture(t, { real: true });
  const [a, b] = await Promise.all([f.start('wc-share-a', 'claude'), f.start('wc-share-b', 'claude')]);
  const file = name => JSON.parse(fs.readFileSync(path.join(f.state, 'settings', `${name}.mcp.json`))).mcpServers.tool.url;
  const url = file(a.name); assert.equal(file(b.name), url);
  const record = () => JSON.parse(fs.readFileSync(path.join(f.state, 'win/forwards.json'))).forwards;
  assert.equal(record().length, 1); const port = record()[0].private_port;
  await f.service.stop(a.name); await f.service.stop(b.name);
  const socket = net.connect(port, '127.0.0.1'); await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); }); socket.destroy();
  const [c, d] = await Promise.all([f.start('wc-record-c', 'claude', 'worker', 1235), f.start('wc-record-d', 'claude', 'worker', 1236)]);
  for (const [s, toolPort] of [[c, 1235], [d, 1236]]) {
    const captured = JSON.parse(fs.readFileSync(path.join(f.state, `hook-${s.name}.json`))).forwards;
    assert(captured.some(x => x.tool_port === toolPort && file(s.name).includes(`:${x.private_port}/`)));
  }
  assert.deepEqual(record().map(x => x.tool_port).sort(), [1234, 1235, 1236]);
});

test('startup restores recorded ports even with interop off and new starts are withheld', async t => {
  const f = await fixture(t, { real: true, ready: false });
  const reserve = net.createServer(); await new Promise(r => reserve.listen(0, '127.0.0.1', r)); const port = reserve.address().port; await new Promise(r => reserve.close(r));
  fs.mkdirSync(path.join(f.state, 'win'), { recursive: true });
  fs.writeFileSync(path.join(f.state, 'win/forwards.json'), JSON.stringify({ forwards: [{ tool_port: 1234, private_port: port }] }));
  f.service.liveTmux = () => new Set(['wc-existing']); await f.service.win.startup();
  const socket = net.connect(port, '127.0.0.1'); await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); }); socket.destroy();
  const error = console.error; console.error = () => {};
  try { const session = await f.start('wc-restored-off', 'claude'); assert(!session.command.includes('--mcp-config')); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.state, 'settings', `${session.name}.json`))).disabledMcpjsonServers, ['tool']); }
  finally { console.error = error; }
});

test('startup with no live wheelchair tmux session clears the forward record', async t => {
  const f = await fixture(t, { real: true }); fs.mkdirSync(path.join(f.state, 'win'), { recursive: true });
  fs.writeFileSync(path.join(f.state, 'win/forwards.json'), JSON.stringify({ forwards: [{ tool_port: 1234, private_port: 2345 }] }));
  f.service.liveTmux = () => new Set(['other']); await f.service.win.startup();
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.state, 'win/forwards.json'))), { forwards: [] });
});

test('a marked tool named __proto__ next to a wrapped Windows program is rewritten, never left at its Linux URL', async t => {
  const f = await fixture(t); f.service.win.detected.wsl = true; f.service.beforeLaunch = async () => {};
  const dir = f.work(1234, { ['__proto__']: { type: 'http', url: 'http://localhost:1235/mcp', headers: { Secret: 'sensitive' } } });
  const file = path.join(dir, '.mcp.json'), cfg = JSON.parse(fs.readFileSync(file));
  cfg.mcpServers.wintool = { command: '/mnt/c/tools/wintool.exe', args: [] }; fs.writeFileSync(file, JSON.stringify(cfg));
  const own = (name, cli) => cli === 'claude' ? fs.readFileSync(path.join(f.state, 'settings', `${name}.mcp.json`), 'utf8')
    : cli === 'codex' ? fs.readFileSync(path.join(f.state, `argv-${name}`), 'utf8') : filesUnder(path.join(f.state, 'agy-tools'));
  for (const cli of ['claude', 'codex', 'agy']) {
    const name = `wc-proto-${cli}`; await f.start(name, cli, 'worker', 1234, dir);
    const payload = own(name, cli);
    assert(!payload.includes('localhost:1235'), `${cli} kept the Linux URL`); assert(payload.includes('127.0.0.1:21235'), `${cli} missing the private URL`);
  }
  f.ready(false); const name = 'wc-proto-off'; await f.start(name, 'codex', 'worker', 1234, dir);
  const off = own(name, 'codex'); assert(!off.includes('localhost:1235')); assert(!off.includes('127.0.0.1:21235'));
});

test('windows status validates input, reports unavailable, thrown and timed-out checks and off WSL', async t => {
  const f = await fixture(t); const forward = f.service.win.forwards;
  for (const input of [null, 3, {}, { tools: Array(101).fill({}) }]) assert.equal((await route(f.service, '/v1/project-tools/windows-status', input)).code, 400);
  const tools = [{ id: 'throw', type: 'http', url: 'http://localhost:31' }, { id: 'timeout', type: 'http', url: 'http://localhost:32' }, { id: 'sse', type: 'sse', url: 'http://localhost:33' }, { type: 'http', url: 'http://localhost:34' }];
  forward.check = port => port === 31 ? Promise.reject(Error('secret internal error')) : new Promise(() => {});
  forward.status = () => ({ note: 'stale', last: { reason: 'no', at: 'then' } });
  let result = await route(f.service, '/v1/project-tools/windows-status', { tools });
  assert.deepEqual(result.body.status.throw, { state: 'unreachable', reason: "couldn't check Windows for port 31", note: 'stale', last: { reason: 'no', at: 'then' } });
  assert.equal(result.body.status.timeout.reason, "couldn't check Windows for port 32"); assert(!Object.hasOwn(result.body.status, 'sse'));
  f.ready(false); result = await route(f.service, '/v1/project-tools/windows-status', { tools }); assert.equal(result.body.status.throw.reason, 'Windows bridge not available');
  f.service.win.detected.kernel = false; result = await route(f.service, '/v1/project-tools/windows-status', { tools }); assert.deepEqual(result.body, { wsl: false, status: {} });
  assert.deepEqual(f.gets, []); assert(!fs.existsSync(path.join(f.state, 'win/forwards.json')));
});

test('project tools read route reports kernel WSL state', async t => {
  const f = await fixture(t); const dir = f.work();
  let result = await route(f.service, '/v1/project-tools/read', { path: dir }); assert.equal(result.code, 200); assert.equal(result.body.wsl, true);
  f.service.win.detected.kernel = false; result = await route(f.service, '/v1/project-tools/read', { path: dir }); assert.equal(result.body.wsl, false);
});
