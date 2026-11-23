'use strict';
// Keep service instances independent of the host's WSL and interop setup.
const noWsl = { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname };
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { MachineService } = require('../service.js');
const { makeTemp, trackChild } = require('../../test-support/run-dir');

const hubHeader = { 'x-wheelchair-machine-secret': 'correct-secret' };
const readyClaude = 'auto mode on\n❯ Try anything\n';
const trustDialog = 'Yes, I trust this folder\n❯ No, exit\n';
const readyCodex = '› Ask Codex to do anything\n';

async function temp() { return makeTemp('wheelchair-machine-test-'); }
async function write(file, data, mode) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, data, { mode }); }
async function port() { const server = http.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value; }
async function fakeBin(root, paneText, realGit = false) {
  const bin = path.join(root, 'bin'); const log = path.join(root, 'commands.log'); const pane = path.join(root, 'pane');
  const script = `#!/usr/bin/env bash
set -eu
echo "$(basename \"$0\") $*" >> "$FAKE_LOG"
case "$(basename \"$0\"):$1" in
  tmux:capture-pane) cat "$FAKE_PANE" ;;
  tmux:list-sessions) if [ -n "\${FAKE_LS_ERR:-}" ]; then printf '%s\\n' "$FAKE_LS_ERR" >&2; exit 1; fi; printf '%s\\n' \${FAKE_SESSIONS:-} ;;
  tmux:load-buffer) cat >> "$FAKE_LOG" ;;
  systemd-run:*) [ -z "\${FAKE_SCOPE_SLEEP:-}" ] || sleep "$FAKE_SCOPE_SLEEP"; exit 1 ;;
  git:*) if [[ " $* " == *" rev-parse "* ]]; then echo "\${FAKE_GIT_VERSION:-deadbeef}"; fi; if [[ " $* " == *" fetch "* && -n "\${FAKE_FETCH_SLEEP:-}" ]]; then sleep "$FAKE_FETCH_SLEEP"; fi; if [[ " $* " == *" fetch "* && -n "\${FAKE_FETCH_FAIL_ONCE:-}" && ! -e "$FAKE_FETCH_FAIL_ONCE" ]]; then touch "$FAKE_FETCH_FAIL_ONCE"; echo 'fetch failed' >&2; exit 1; fi ;;
  claude:-p) cat > "$FAKE_LOG.stdin"; echo "lane=\${WHEELCHAIR_LANE:-}" >> "$FAKE_LOG"; [ -z "\${FAKE_PREVIEW_SLEEP:-}" ] || sleep "$FAKE_PREVIEW_SLEEP"; [ -z "\${FAKE_PREVIEW_ERR:-}" ] || printf '%s\\n' "$FAKE_PREVIEW_ERR" >&2; [ -z "\${FAKE_PREVIEW_OUT:-}" ] || printf '%s\\n' "$FAKE_PREVIEW_OUT"; exit "\${FAKE_PREVIEW_EXIT:-0}" ;;
  claude:--version) echo claude-test ;;
  claude:auth) printf '%s\\n' "\${FAKE_CLAUDE_AUTH:-{\\"loggedIn\\":true}}" ;;
  codex:--version) echo codex-test ;;
esac
`;
  for (const name of ['tmux', 'systemd-run', 'systemctl', ...(realGit ? [] : ['git']), 'gh', 'claude', 'codex', 'agy', 'tailscale', 'sh']) await write(path.join(bin, name), script, 0o755);
  await write(pane, paneText);
  return { bin, log, pane };
}
async function hubServer(status = 200, { failAfterStore = false, delay = 0, answer: initialAnswer = {} } = {}) {
  const calls = []; let current = status; const delivered = new Set();
  const allowed = { idea: ['lead'], done: ['lead'], message: ['lead', 'sub-lead', 'worker', 'mapper'], result: ['worker', 'mapper', 'sub-lead'] };
  const server = http.createServer((request, response) => { let body = ''; request.on('data', c => { body += c; }); request.on('end', () => {
    let code = current; let answer = initialAnswer;
    let payload = {}; try { payload = JSON.parse(body || '{}'); } catch { /* test server records malformed payloads too */ }
    if (code >= 200 && code < 300 && request.url.endsWith('/events') && !payload.thread_id) { code = 404; answer = { error: 'thread not found' }; }
    if (code >= 200 && code < 300 && request.url.endsWith('/cards')) {
      const role = /-(lead|sub-lead|worker|mapper|designer|reviewer|verifier)(?:-\d+)?$/.exec(payload.session || '')?.[1];
      if (!allowed[payload.kind]?.includes(role)) { code = 422; answer = { error: `${role || 'unknown'} may not post ${payload.kind || 'that card'}` }; }
      else if (payload.delivery_id && delivered.has(`${payload.thread_id}:${payload.delivery_id}`)) answer = { ok: true, duplicate: true };
      else if (payload.delivery_id) delivered.add(`${payload.thread_id}:${payload.delivery_id}`);
      if (failAfterStore && code === 200 && !answer.duplicate) { code = 500; failAfterStore = false; }
    }
    calls.push({ path: request.url, body, status: code });
    const reply = () => { response.writeHead(code, { 'content-type': 'application/json' }); response.end(JSON.stringify(answer)); };
    if (delay && request.url.endsWith('/cards')) setTimeout(reply, delay); else reply();
  }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, calls, delivered, setStatus: value => { current = value; }, close: () => new Promise(resolve => server.close(resolve)) };
}
async function service(root, options = {}) {
  const fake = await fakeBin(root, options.pane || readyClaude, options.realGit); const state = path.join(root, 'state'); const secret = path.join(root, 'secret'); const listen = await port();
  await write(secret, 'correct-secret\n', 0o600);
  await write(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port: listen, ...(options.config || {}) }));
  const prior = { PATH: process.env.PATH, FAKE_LOG: process.env.FAKE_LOG, FAKE_PANE: process.env.FAKE_PANE };
  process.env.PATH = `${fake.bin}:${prior.PATH}`; process.env.FAKE_LOG = fake.log; process.env.FAKE_PANE = fake.pane;
  let instance = new MachineService({ win: noWsl, stateDir: state, host: '127.0.0.1', port: listen });
  try { await instance.listen(); } catch (error) { Object.assign(process.env, prior); throw error; }
  return { instance, state, fake, base: `http://127.0.0.1:${listen}`, async close() {
    // A test that fails mid-start ends with that start still running. Wait for it before PATH
    // drops the fake tmux, or it launches a real session in the user's own tmux server.
    while (instance.startingNames.size) await Promise.allSettled([...instance.startingNames.values()]);
    await new Promise(resolve => instance.server.close(resolve)); Object.assign(process.env, prior); } };
}
async function api(env, method, endpoint, body, headers = {}) {
  const response = await fetch(`${env.base}${endpoint}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function start(env, input = {}) {
  const { serviceWorktree, ...requested } = input;
  const worktree = serviceWorktree ? undefined : (requested.worktree || path.join(path.dirname(env.state), `work-${requested.thread_id || 't'}-${requested.role || 'lead'}`));
  if (worktree) await fs.mkdir(worktree, { recursive: true });
  const body = { role: 'lead', cli: 'claude', thread_id: 't', token: 'alpha', ...(worktree ? { worktree } : {}), ...requested };
  const result = await api(env, 'POST', '/v1/sessions', body, hubHeader); assert.equal(result.status, 201, JSON.stringify(result.body)); return result.body;
}
async function log(env) { return fs.readFile(env.fake.log, 'utf8'); }
async function setup(cli = 'claude', role = 'worker') {
  const root = await temp(); const prior = {};
  for (const key of ['HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'FAKE_SESSIONS']) prior[key] = process.env[key];
  process.env.HOME = root; process.env.CLAUDE_CONFIG_DIR = path.join(root, '.claude'); process.env.CODEX_HOME = path.join(root, '.codex');
  const hub = await hubServer(); const env = await service(root, { pane: cli === 'codex' ? readyCodex : readyClaude, config: { hub_url: hub.url } });
  const worktree = path.join(root, 'project'); await fs.mkdir(worktree);
  assert.equal(spawnSync('/usr/bin/git', ['init', '-q', worktree]).status, 0);
  await write(path.join(worktree, '.mcp.json'), JSON.stringify({ mcpServers: { fixture: { command: 'node', args: ['fixture-server'] } } }));
  const started = await start(env, { cli, role, worktree, project: 'project', project_dir: worktree, effort: 'high', permission_mode: 'auto', codex_mode: 'unrestricted' });
  const session = env.instance.sessions[started.name]; process.env.FAKE_SESSIONS = session.name;
  if (cli === 'codex') session.codex_thread_id = 'thread-one';
  const relative = cli === 'codex' ? 'sessions/2026/11/22/rollout-x-thread-one.jsonl' : `projects/key/${session.cli_session_id}.jsonl`;
  const oldRoot = process.env[cli === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'];
  const source = path.join(oldRoot, relative); await write(source, '{"type":"fixture"}\n');
  await env.instance.copyTranscript(session, source); session.source_transcript = source; session.last_reading = { used: 99 };
  const input = { switch_id: 'one', account: { id: 'other', dir: '~/.wheelchair/accounts/other' }, model: 'chosen-model', project: 'project', project_dir: worktree };
  return { root, hub, env, session, source, relative, input, async close() { await env.close(); await hub.close(); for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } } };
}
async function waitFor(predicate) { for (let i = 0; i < 300; i++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('timed out waiting for switch'); }
const route = f => `/v1/sessions/${f.session.name}/switch`;
const events = f => f.hub.calls.filter(c => c.path.endsWith('/events')).map(c => JSON.parse(c.body));
const postSwitch = (f, input = f.input) => api(f.env, 'POST', route(f), input, hubHeader);

test('HTTP switch validates requests, holds hooks, and deduplicates running and completed requests', async () => {
  const f = await setup(); const original = f.env.instance.copyTranscript.bind(f.env.instance); let release; let copies = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  f.env.instance.copyTranscript = async (...args) => { copies++; await barrier; return original(...args); };
  try {
    assert.equal((await postSwitch(f, { ...f.input, switch_id: 'bad id' })).status, 400);
    assert.equal((await api(f.env, 'POST', route(f), f.input, { 'x-wheelchair-session-token': 'alpha' })).status, 401);
    assert.equal((await api(f.env, 'POST', '/v1/sessions/wc-unknown/switch', f.input, hubHeader)).status, 404);
    for (const cli of ['agy', 'kimi', 'pi']) { f.session.cli = cli; assert.equal((await postSwitch(f)).status, 400); } f.session.cli = 'claude';
    process.env.FAKE_SESSIONS = ''; assert.equal((await postSwitch(f)).status, 409); process.env.FAKE_SESSIONS = f.session.name;
    const first = await postSwitch(f); assert.equal(first.status, 202); assert.deepEqual(first.body, { accepted: true, switch_id: 'one', state: 'running' });
    assert.equal((await postSwitch(f, { ...f.input, switch_id: 'two' })).status, 409);
    const runningRepeat = await postSwitch(f); assert.equal(runningRepeat.status, 202); assert.deepEqual(runningRepeat.body, first.body);
    const before = events(f).length;
    assert.equal((await api(f.env, 'POST', '/v1/agent/hooks', { type: 'limit-hit' }, { 'x-wheelchair-session-token': 'alpha' })).status, 202);
    assert.equal(events(f).length, before);
    release(); await waitFor(() => f.session.active_switch === 'one');
    await f.env.instance.checkReady(f.session); assert.equal(f.session.switches.one.state, 'done');
    const doneRepeat = await postSwitch(f); assert.equal(doneRepeat.status, 202); assert.deepEqual(doneRepeat.body, { accepted: true, switch_id: 'one', state: 'done' });
    assert.equal(copies, 1); assert.equal((await log(f.env)).split('\n').filter(line => line.startsWith('tmux respawn-pane')).length, 1);
    assert.equal(events(f).filter(e => e.type === 'ready' && e.switch_id === 'one').length, 1);
  } finally { release(); await f.close(); }
});

test('real launch preparation copies and resumes both providers without new worktrees or first messages', async () => {
  for (const [cli, role] of [['claude', 'worker'], ['codex', 'worker'], ['codex', 'reviewer']]) {
    const f = await setup(cli, role);
    try {
      const offset = f.session.transcript_source.offset; const worktreeList = () => { const result = spawnSync('/usr/bin/git', ['-C', f.session.worktree, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout; }; const beforeWorktrees = worktreeList(); const beforeLog = await log(f.env);
      const result = await postSwitch(f); assert.equal(result.status, 202);
      await waitFor(() => f.session.active_switch === 'one' || f.session.switches.one.state === 'failed');
      assert.equal(f.session.active_switch, 'one', JSON.stringify(events(f)));
      const destination = path.join(f.root, '.wheelchair/accounts/other', f.relative);
      assert.equal(await fs.readFile(f.source, 'utf8'), await fs.readFile(destination, 'utf8'));
      assert.equal(f.session.source_transcript, destination); assert.equal(f.session.transcript_source.path, destination); assert.equal(f.session.transcript_source.ino, (await fs.stat(destination)).ino); assert.equal(f.session.transcript_source.offset, offset); assert.equal(f.session.last_reading, undefined);
      const added = (await log(f.env)).slice(beforeLog.length); const respawn = added.split('\n').find(line => line.startsWith('tmux respawn-pane'));
      assert.match(respawn, new RegExp(`respawn-pane -k -t =${f.session.name}:`)); assert.doesNotMatch(added, /new-session|worktree add/);
      assert.ok(respawn.includes(`${cli === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'}=${path.join(f.root, '.wheelchair/accounts/other')}`));
      assert.ok(respawn.includes('chosen-model')); assert.ok(respawn.includes('high'));
      if (cli === 'claude') { assert.match(respawn, /'--resume' '[^']+'/); assert.doesNotMatch(respawn, /--session-id/); assert.match(respawn, /--permission-mode.*auto/); assert.equal(JSON.parse(await fs.readFile(path.join(f.env.state, 'settings', `${f.session.name}.json`), 'utf8')).enableAllProjectMcpServers, true); }
      else { if (role === 'reviewer') assert.match(respawn, /'-s' 'read-only' '-a' 'never'/); else { assert.match(respawn, /--dangerously-bypass-approvals-and-sandbox/); assert.ok(respawn.includes('fixture')); } assert.match(respawn, /'resume' 'thread-one'\s*$/); }
      await f.env.instance.checkReady(f.session); const afterReady = (await log(f.env)).slice(beforeLog.length); assert.doesNotMatch(afterReady, /load-buffer|paste-buffer/);
      assert.equal(worktreeList(), beforeWorktrees);
      const second = { ...f.input, switch_id: 'back', account: { id: cli === 'claude' ? 'default-claude' : 'default-gpt', dir: null } };
      const backLog = await log(f.env); assert.equal((await postSwitch(f, second)).status, 202); await waitFor(() => f.session.active_switch === 'back' || f.session.switches.back.state === 'failed'); assert.equal(f.session.active_switch, 'back');
      const back = (await log(f.env)).slice(backLog.length).split('\n').find(line => line.startsWith('tmux respawn-pane')); assert.doesNotMatch(back, /CLAUDE_CONFIG_DIR=|CODEX_HOME=/);
    } finally { await f.close(); }
  }
});

test('failure before respawn restores the record, emits failure and deduplicates failed requests', async () => {
  for (const failure of ['missing', 'copy', 'prepare', 'respawn']) {
    const f = await setup(); const before = structuredClone(f.session); const originalCopy = fs.copyFile; const originalRead = fs.readFile; const copyTranscript = f.env.instance.copyTranscript.bind(f.env.instance); let copies = 0;
    f.env.instance.copyTranscript = async (...args) => { copies++; return copyTranscript(...args); };
    try {
      if (failure === 'missing') await fs.rename(f.source, `${f.source}.missing`);
      if (failure === 'copy') fs.copyFile = async () => { throw new Error('injected copy error'); };
      if (failure === 'prepare') fs.readFile = async (file, ...args) => { if (file === path.join(f.env.state, 'prompts', `${f.session.name}.md`)) throw new Error('injected prompt error'); return originalRead(file, ...args); };
      if (failure === 'respawn') { const file = path.join(f.env.fake.bin, 'tmux'); const script = await fs.readFile(file, 'utf8'); await fs.writeFile(file, script.replace('  tmux:capture-pane)', '  tmux:respawn-pane) exit 1 ;;\n  tmux:capture-pane)')); }
      const priorLog = await log(f.env); assert.equal((await postSwitch(f)).status, 202);
      await waitFor(() => f.session.switches.one.state === 'failed' && events(f).some(e => e.type === 'switch-failed'));
      const { switches, ...rest } = f.session; assert.deepEqual(rest, before); assert.equal(switches.one.state, 'failed');
      assert.equal(events(f).filter(e => e.type === 'switch-failed' && e.switch_id === 'one').length, 1); assert.doesNotMatch((await log(f.env)).slice(priorLog.length), /kill-session/);
      const failedRepeat = await postSwitch(f); assert.equal(failedRepeat.status, 202); assert.deepEqual(failedRepeat.body, { accepted: true, switch_id: 'one', state: 'failed' });
      assert.equal(copies, failure === 'missing' ? 0 : 1); assert.equal((await log(f.env)).slice(priorLog.length).split('\n').filter(line => line.startsWith('tmux respawn-pane')).length, failure === 'respawn' ? 1 : 0);
    } finally { fs.copyFile = originalCopy; fs.readFile = originalRead; await f.close(); }
  }
});

test('failed relaunches use fatal stop cleanup and plain starts retain readiness behavior', async () => {
  for (const failure of ['gone', 'timeout']) {
    const f = await setup();
    try {
      await postSwitch(f); await waitFor(() => f.session.active_switch === 'one');
      const config = path.join(f.env.state, 'settings', `${f.session.name}.mcp.json`); await write(config, 'old config'); let stopped = 0; f.env.instance.win.onStop = () => { stopped++; };
      const priorEvents = events(f).length; const beforeLog = await log(f.env);
      await write(f.env.fake.pane, 'loading');
      if (failure === 'gone') { f.env.instance.pane = () => { throw new Error('gone'); }; process.env.FAKE_SESSIONS = ''; }
      else { f.session.relaunched_at = new Date(Date.now() - 31_000).toISOString(); process.env.FAKE_SESSIONS = ''; }
      await f.env.instance.checkReady(f.session);
      assert.equal(f.session.status, 'stopped'); assert.equal(f.session.end_reason, 'switch-resume-failed'); assert.equal(f.session.switches.one.state, 'failed'); assert.equal(stopped, 1);
      await assert.rejects(fs.stat(config), { code: 'ENOENT' }); assert.match((await log(f.env)).slice(beforeLog.length), /kill-session/);
      assert.equal(events(f).slice(priorEvents).filter(e => e.type === 'stuck' || e.type === 'ready').length, 0);
    } finally { await f.close(); }
  }
  const f = await setup();
  try {
    assert.match(await log(f.env), /--session-id/); assert.ok(events(f).some(e => e.type === 'ready' && !Object.hasOwn(e, 'switch_id')));
    f.session.status = 'starting'; f.session.created_at = new Date(Date.now() - 31_000).toISOString(); await write(f.env.fake.pane, 'loading'); await f.env.instance.checkReady(f.session);
    assert.ok(events(f).some(e => e.type === 'stuck' && !Object.hasOwn(e, 'switch_id')));
  } finally { await f.close(); }
});

test('relaunch timeout wins over first-run prompts while recent relaunches and plain starts answer them', async () => {
  const f = await setup();
  try {
    await postSwitch(f); await waitFor(() => f.session.active_switch === 'one');
    const beforeLog = await log(f.env); const priorEvents = events(f).length;
    await write(f.env.fake.pane, trustDialog);
    f.session.relaunched_at = new Date(Date.now() - 31_000).toISOString();
    process.env.FAKE_SESSIONS = '';
    await f.env.instance.checkReady(f.session);
    const expiredLog = (await log(f.env)).slice(beforeLog.length);
    assert.equal(f.session.status, 'stopped'); assert.equal(f.session.end_reason, 'switch-resume-failed'); assert.equal(f.session.switches.one.state, 'failed');
    assert.match(expiredLog, /kill-session/); assert.doesNotMatch(expiredLog, /send-keys/);
    assert.equal(events(f).slice(priorEvents).filter(e => e.type === 'stuck' || e.type === 'ready').length, 0);
  } finally { await f.close(); }

  const recent = await setup();
  try {
    await postSwitch(recent); await waitFor(() => recent.session.active_switch === 'one');
    const beforeLog = await log(recent.env); await write(recent.env.fake.pane, trustDialog);
    recent.session.relaunched_at = new Date(Date.now() - 5_000).toISOString();
    await recent.env.instance.checkReady(recent.session);
    assert.match((await log(recent.env)).slice(beforeLog.length), /send-keys/); assert.notEqual(recent.session.status, 'stopped');
  } finally { await recent.close(); }

  const plain = await setup();
  try {
    const beforeLog = await log(plain.env); await write(plain.env.fake.pane, trustDialog);
    plain.session.status = 'starting'; plain.session.created_at = new Date(Date.now() - 31_000).toISOString();
    await plain.env.instance.checkReady(plain.session);
    assert.match((await log(plain.env)).slice(beforeLog.length), /send-keys/); assert.notEqual(plain.session.status, 'stopped');
  } finally { await plain.close(); }
});
