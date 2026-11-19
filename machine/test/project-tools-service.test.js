'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const agy = require('../adapters/agy');

test('project tools launch privately and stale Antigravity files are swept', async () => {
  const root = await makeTemp('project-tools-service-'), bin = path.join(root, 'bin'), state = path.join(root, 'state'), work = path.join(root, 'work'), log = path.join(root, 'commands');
  await fsp.mkdir(bin); await fsp.mkdir(work);
  const script = `#!/bin/sh\nprintf '%s %s\n' "$(basename "$0")" "$*" >> "$FAKE_TOOLS_LOG"\ncase "$(basename "$0"):$1" in\n systemd-run:*) exit 1;;\n tmux:capture-pane) printf 'Ask Codex to do anything\\n? for shortcuts\\n';;\n git:*) echo deadbeef;;\nesac\n`;
  for (const name of ['git', 'tmux', 'systemd-run']) await fsp.writeFile(path.join(bin, name), script, { mode: 0o755 });
  const oldPath = process.env.PATH, oldLog = process.env.FAKE_TOOLS_LOG, oldPrepare = agy.prepare, oldError = console.error, lines = [];
  process.env.PATH = `${bin}:${oldPath}`; process.env.FAKE_TOOLS_LOG = log; agy.prepare = () => {}; console.error = (...args) => lines.push(args.join(' '));
  const service = new MachineService({ stateDir: state, host: '127.0.0.1', port: 0 });
  try {
    await service.init();
    await fsp.writeFile(path.join(work, '.mcp.json'), JSON.stringify({ mcpServers: { gh: { type: 'http', url: 'https://example.test/?x=secret', headers: { Authorization: 'Bearer ${TOK}', 'X-Literal': 'literal-secret' } }, local: { command: 'runner', args: ['https://example.test/secret'] } } }));
    const start = (name, cli, role = 'worker') => service.start({ name, cli, role, thread_id: name, token: 'token', worktree: work });
    const codex = await start('wc-codex-worker', 'codex');
    const overrides = codex.command.filter(arg => arg.startsWith('mcp_servers.project_'));
    assert.ok(overrides.length > 0); assert.ok(overrides.every(arg => arg.endsWith('=<redacted>')));
    const commands = await fsp.readFile(log, 'utf8');
    assert.match(commands, /--description=wheelchair wc-codex-worker/); assert.match(commands, /literal-secret/); assert.match(commands, /example.test\/secret/); assert.match(commands, /TOK/);
    assert.doesNotMatch(JSON.stringify(codex.command), /literal-secret/); assert.doesNotMatch(await fsp.readFile(path.join(state, 'sessions.json'), 'utf8'), /literal-secret/); assert.doesNotMatch(lines.join('\n'), /literal-secret/);
    // Antigravity cannot pass the bearer variable, so use a literal header for this launch.
    await fsp.writeFile(path.join(work, '.mcp.json'), JSON.stringify({ mcpServers: { gh: { type: 'http', url: 'https://example.test', headers: { 'X-Literal': 'literal-secret' } } } }));
    const name = 'wc-agy/worker', agent = await start(name, 'agy'), dir = path.join(state, 'agy-tools', encodeURIComponent(name)), plugin = path.join(dir, '.agents/plugins/wheelchair-project');
    assert.ok(agent.command.includes('--add-dir')); assert.ok(agent.command.includes(dir));
    for (const d of [path.join(state, 'agy-tools'), dir, path.join(dir, '.agents'), path.join(dir, '.agents/plugins'), plugin]) assert.equal(fs.statSync(d).mode & 0o777, 0o700);
    for (const file of ['plugin.json', 'mcp_config.json']) assert.equal(fs.statSync(path.join(plugin, file)).mode & 0o777, 0o600);
    assert.match(fs.readFileSync(path.join(plugin, 'mcp_config.json'), 'utf8'), /literal-secret/); assert.doesNotMatch(JSON.stringify(agent.command), /literal-secret/); assert.doesNotMatch(lines.join('\n'), /literal-secret/);
    const reviewer = await start('wc-reviewer', 'agy', 'reviewer'); assert.ok(!reviewer.command.includes('--add-dir')); assert.ok(!fs.existsSync(path.join(state, 'agy-tools', 'wc-reviewer')));
    assert.doesNotMatch(MachineService.prototype.sweepAgyTools.toString(), /await/);
    const base = path.join(state, 'agy-tools'), old = new Date(Date.now() - 120000);
    for (const entry of ['wc-dead', 'wc-live', 'wc-starting', 'wc-young', '%broken', '%fresh', encodeURIComponent('wc-dot.name-worker'), encodeURIComponent('wc-other.name-worker')]) fs.mkdirSync(path.join(base, entry));
    for (const entry of ['wc-dead', 'wc-live', 'wc-starting', '%broken', encodeURIComponent(name), encodeURIComponent('wc-dot.name-worker'), encodeURIComponent('wc-other.name-worker')]) fs.utimesSync(path.join(base, entry), old, old);
    service.startingNames.set('wc-starting', Promise.resolve()); service.liveTmux = () => null; service.sweepAgyTools(); assert.ok(fs.existsSync(path.join(base, 'wc-dead')));
    service.liveTmux = () => new Set(['wc-live', 'wc-dot_name-worker']); service.agyToolsTimer._onTimeout();
    for (const entry of ['wc-dead', '%broken', encodeURIComponent(name), encodeURIComponent('wc-other.name-worker')]) assert.ok(!fs.existsSync(path.join(base, entry)));
    for (const entry of ['wc-live', 'wc-starting', 'wc-young', '%fresh', encodeURIComponent('wc-dot.name-worker')]) assert.ok(fs.existsSync(path.join(base, entry)));
    assert.equal(agent.status, 'ready');
  } finally {
    for (const timer of [service.pollTimer, service.stepsTimer, service.trustTimer, service.agyToolsTimer]) clearInterval(timer);
    process.env.PATH = oldPath; if (oldLog === undefined) delete process.env.FAKE_TOOLS_LOG; else process.env.FAKE_TOOLS_LOG = oldLog; agy.prepare = oldPrepare; console.error = oldError;
  }
});

async function sweepFixture(names, live = ['wc-name_part-worker']) {
  const state = await makeTemp('agy-sweep-'), base = path.join(state, 'agy-tools');
  fs.mkdirSync(base);
  const old = new Date(Date.now() - 600000);
  for (const name of names) { fs.mkdirSync(path.join(base, encodeURIComponent(name))); fs.utimesSync(path.join(base, encodeURIComponent(name)), old, old); }
  const service = new MachineService({ stateDir: state });
  service.liveTmux = () => live === null ? null : new Set(live);
  service.sessions = {};
  return { service, dir: name => path.join(base, encodeURIComponent(name)), exists: name => fs.existsSync(path.join(base, encodeURIComponent(name))) };
}
const dot = 'wc-name.part-worker', under = 'wc-name_part-worker';
const record = (status, created_at = '2025-01-01T00:00:00Z') => ({ status, created_at });

test('sweep protects the live underscore record over a stopped dot record', async () => {
  const f = await sweepFixture([dot, under]);
  f.service.sessions = { [dot]: record('stopped'), [under]: record('ready') };
  f.service.sweepAgyTools(); assert.equal(f.exists(dot), false); assert.equal(f.exists(under), true);
});

test('sweep protects the live dot record over a stopped underscore record', async () => {
  const f = await sweepFixture([dot, under]);
  f.service.sessions = { [dot]: record('ready'), [under]: record('stopped') };
  f.service.sweepAgyTools(); assert.equal(f.exists(under), false); assert.equal(f.exists(dot), true);
});

test('a refused start is retained only for the grace period', async () => {
  const f = await sweepFixture([dot, under]);
  f.service.sessions = { [under]: record('ready') };
  const now = new Date(); fs.utimesSync(f.dir(dot), now, now);
  f.service.sweepAgyTools(); assert.equal(f.exists(dot), true); assert.equal(f.exists(under), true);
  const old = new Date(Date.now() - 600000); fs.utimesSync(f.dir(dot), old, old);
  f.service.sweepAgyTools(); assert.equal(f.exists(dot), false); assert.equal(f.exists(under), true);
});

test('the newest non-stopped record wins a collision', async () => {
  const f = await sweepFixture([dot, under]);
  f.service.sessions = { [dot]: record('ready', '2025-02-01T00:00:00Z'), [under]: record('ready') };
  f.service.sweepAgyTools(); assert.equal(f.exists(dot), true); assert.equal(f.exists(under), false);
});

test('without records the exact spelling wins, or a lone rewritten name survives', async () => {
  const f = await sweepFixture([dot, under]);
  f.service.sweepAgyTools(); assert.equal(f.exists(dot), false); assert.equal(f.exists(under), true);
  const lone = await sweepFixture([dot]);
  lone.service.sweepAgyTools(); assert.equal(lone.exists(dot), true);
});

test('non-live entries respect grace and an unknown tmux state removes nothing', async () => {
  const f = await sweepFixture(['wc-old', 'wc-young'], null);
  const now = new Date(); fs.utimesSync(f.dir('wc-young'), now, now);
  f.service.sweepAgyTools(); assert.equal(f.exists('wc-old'), true); assert.equal(f.exists('wc-young'), true);
  f.service.liveTmux = () => new Set();
  f.service.sweepAgyTools(); assert.equal(f.exists('wc-old'), false); assert.equal(f.exists('wc-young'), true);
});
