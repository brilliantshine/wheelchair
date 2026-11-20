'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pi = require('../adapters/pi');
test('Pi maps settled and tool events, redacting errors', () => {
  const event = { hook_event_name: 'agent_settled', turn: 2, entry_id: 'reply' };
  assert.deepEqual(pi.hookEvent(event), { type: 'turn-ended', turn_id: 2, entry_id: 'reply' });
  assert.deepEqual(pi.hookEvent({ ...event, aborted: true, entry_id: null }), { type: 'turn-ended', turn_id: 2, entry_id: null, interrupted: true });
  assert.deepEqual(pi.hookEvent({ ...event, stopReason: 'error', errorMessage: 'rate limit sk-or-v1-0000synthetic0000' }), { type: 'turn-failed', error: 'rate limit [redacted key]' });
  assert.equal(pi.hookEvent({ ...event, entry_id: null }).type, 'turn-failed');
  assert.equal(pi.hookEvent({ hook_event_name: 'tool_execution_start', toolCallId: 'x', toolName: 'read', args: { path: 'a' } }).step.kind, 'files');
  assert.equal(pi.hookEvent({ hook_event_name: 'tool_execution_end', toolCallId: 'x', isError: true }).step.failed, true);
});

test('real extension posts tool and turn events through hook.sh', async () => {
  const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
  const { makeTempSync } = require('../../test-support/run-dir');
  const root = makeTempSync('pi-bridge-'), bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  fs.symlinkSync(path.join(__dirname, 'fixtures/fake-pi.js'), path.join(bin, 'pi'));
  const oldPath = process.env.PATH; process.env.PATH = `${bin}:${oldPath}`;
  let built; try { built = pi.command({ role: 'worker' }, { name: 'wc-test-worker', cli_session_id: '123' }, root, { stateDir: root, promptPath: '/prompt' }); } finally { process.env.PATH = oldPath; }
  const child = spawn(built.argv[0], built.argv.slice(1), { env: { ...process.env, PI_CODING_AGENT_DIR: root, WHEELCHAIR_STATE_DIR: root, WHEELCHAIR_SESSION_TOKEN: 'synthetic' }, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
  assert.match(output, /escape interrupt/); child.stdin.end('hello\n');
  await new Promise((resolve, reject) => { child.once('exit', code => code === 0 ? resolve() : reject(new Error(errors))); });
  const spool = path.join(root, 'spool/events'); let events = [];
  for (let i = 0; i < 100; i++) { events = fs.existsSync(spool) ? fs.readdirSync(spool).filter(x => x.endsWith('.json')).map(x => JSON.parse(fs.readFileSync(path.join(spool, x), 'utf8'))) : []; if (events.length >= 3) break; await new Promise(resolve => setTimeout(resolve, 25)); }
  assert.ok(events.some(event => event.type === 'turn-ended' && event.entry_id === 'a1')); assert.equal(events.filter(event => event.type === 'step').length, 2);
});

test('service starts Pi, submits a turn, binds its transcript, and forwards extension events', async () => {
  const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), { spawn } = require('node:child_process');
  const { MachineService } = require('../service'), { makeTempSync } = require('../../test-support/run-dir');
  const root = makeTempSync('pi-service-'), bin = path.join(root, 'bin'), commandFile = path.join(root, 'command'); fs.mkdirSync(bin);
  fs.symlinkSync(path.join(__dirname, 'fixtures/fake-pi.js'), path.join(bin, 'pi'));
  fs.writeFileSync(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'tmux'), `#!/bin/sh\nfor arg do :; done\nprintf %s "$arg" > '${commandFile}'\n`, { mode: 0o755 });
  const old = { PATH: process.env.PATH, HOME: process.env.HOME }; process.env.PATH = `${bin}:${old.PATH}`; process.env.HOME = root;
  const machine = Object.create(MachineService.prototype), events = []; let child, pane = '', buffer = '';
  Object.assign(machine, { stateDir: root, config: { host: '127.0.0.1', port: 0 }, sessions: {}, cancelledStarts: new Set(), startingNames: new Map(), startingBranches: new Set(), startingWorktrees: new Set() });
  machine.createWorktree = async () => ({ worktree: root }); machine.persistSessions = async () => {}; machine.emitEvent = async event => { events.push(event); }; machine.log = () => {};
  machine.tmux = (args, options) => { if (args[0] === 'capture-pane') return { ok: true, stdout: pane }; if (args[0] === 'load-buffer') buffer = options.input; if (args[0] === 'send-keys' && args.at(-1) === 'Enter') child.stdin.write(buffer + '\n'); return { ok: true, stdout: '' }; };
  const server = http.createServer((req, res) => { let text = ''; req.on('data', chunk => { text += chunk; }); req.on('end', async () => { try { assert.equal(req.headers['x-wheelchair-session-token'], 'token'); await machine.hook('wc-test-worker', JSON.parse(text)); res.writeHead(202).end(); } catch { res.writeHead(500).end(); } }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); machine.config.port = server.address().port;
  fs.writeFileSync(path.join(root, 'machine.json'), JSON.stringify(machine.config));
  machine.checkReady = async session => { child = spawn('sh', ['-c', fs.readFileSync(commandFile, 'utf8')], { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] }); child.stderr.resume(); await new Promise((resolve, reject) => { child.stdout.once('data', chunk => { pane = chunk.toString(); resolve(); }); child.once('error', reject); }); return MachineService.prototype.checkReady.call(machine, session); };
  try {
    const session = await machine.start({ cli: 'pi', role: 'worker', thread_id: 'test', token: 'token', brief: 'hello', role_prompt: 'rules' });
    assert.equal(session.status, 'ready');
    const waitFor = async fn => { for (let i = 0; i < 150 && !fn(); i++) await new Promise(resolve => setTimeout(resolve, 20)); assert.ok(fn()); };
    await waitFor(() => events.some(e => e.type === 'turn-ended'));
    assert.equal(events.find(e => e.type === 'turn-ended').entry_id, 'a1');
    assert.ok(machine.sessions[session.name].source_transcript.endsWith(`_${machine.sessions[session.name].cli_session_id}.jsonl`));
    await machine.submit(session.name, 'abort'); await waitFor(() => events.some(e => e.interrupted));
    assert.equal(events.find(e => e.interrupted).entry_id, null);
    assert.ok(events.some(e => e.type === 'step' && e.phase === 'start')); assert.ok(events.some(e => e.type === 'step' && e.phase === 'end'));
    const forged = path.join(root, 'forged'); fs.writeFileSync(forged, 'secret\n');
    await machine.hook(session.name, { type: 'turn-ended', turn_id: 3, entry_id: 'x', transcript_path: forged });
    assert.notEqual(machine.sessions[session.name].source_transcript, forged); assert.equal(events.at(-1).transcript_path, undefined);
  } finally { if (child) { child.stdin.end(); await new Promise(resolve => child.once('exit', resolve)); } await new Promise(resolve => server.close(resolve)); process.env.PATH = old.PATH; process.env.HOME = old.HOME; }
});

test('offline hook spool redacts Pi error before writing and does not emit a limit', async () => {
  const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
  const { makeTempSync } = require('../../test-support/run-dir');
  const root = makeTempSync('pi-spool-');
  const result = spawnSync(path.join(__dirname, '../hook.sh'), ['pi', 'wc-test-worker'], { input: JSON.stringify({ hook_event_name: 'agent_settled', turn: 1, entry_id: 'a', stopReason: 'error', errorMessage: 'rate limit sk-or-v1-0000synthetic0000' }), encoding: 'utf8', env: { ...process.env, WHEELCHAIR_STATE_DIR: root, WHEELCHAIR_SESSION_TOKEN: 'synthetic' } });
  assert.equal(result.status, 0); const files = fs.readdirSync(path.join(root, 'spool/events')); assert.equal(files.length, 1);
  const content = fs.readFileSync(path.join(root, 'spool/events', files[0]), 'utf8'); assert.doesNotMatch(content, /sk-or-/);
  assert.equal(JSON.parse(content).type, 'turn-failed'); assert.match(JSON.parse(content).error, /\[redacted key\]/);
});
