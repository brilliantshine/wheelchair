'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { MachineService } = require('../service.js');

const hubHeader = { 'x-wheelchair-machine-secret': 'correct-secret' };
const readyClaude = 'auto mode on\n❯ Try anything\n';
const trustDialog = 'Yes, I trust this folder\n❯ No, exit\n';
const readyCodex = '› Ask Codex to do anything\n';

async function temp() { return fs.mkdtemp(path.join(os.tmpdir(), 'wheelchair-machine-test-')); }
async function write(file, data, mode) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, data, { mode }); }
async function port() { const server = http.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value; }
async function fakeBin(root, paneText, realGit = false) {
  const bin = path.join(root, 'bin'); const log = path.join(root, 'commands.log'); const pane = path.join(root, 'pane');
  const script = `#!/usr/bin/env bash
set -eu
echo "$(basename \"$0\") $*" >> "$FAKE_LOG"
case "$(basename \"$0\"):$1" in
  tmux:capture-pane) cat "$FAKE_PANE" ;;
  tmux:list-sessions) echo wc-t-lead ;;
  tmux:load-buffer) cat >> "$FAKE_LOG" ;;
  systemd-run:*) exit 1 ;;
  git:rev-parse) echo deadbeef ;;
  claude:--version) echo claude-test ;;
  codex:--version) echo codex-test ;;
esac
`;
  for (const name of ['tmux', 'systemd-run', ...(realGit ? [] : ['git']), 'gh', 'claude', 'codex', 'tailscale', 'sh']) await write(path.join(bin, name), script, 0o755);
  await write(pane, paneText);
  return { bin, log, pane };
}
async function hubServer(status = 200) {
  const calls = []; let current = status;
  const server = http.createServer((request, response) => { let body = ''; request.on('data', c => { body += c; }); request.on('end', () => { calls.push({ path: request.url, body }); response.writeHead(current); response.end('{}'); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, calls, setStatus: value => { current = value; }, close: () => new Promise(resolve => server.close(resolve)) };
}
async function service(root, options = {}) {
  const fake = await fakeBin(root, options.pane || readyClaude, options.realGit); const state = path.join(root, 'state'); const secret = path.join(root, 'secret'); const listen = await port();
  await write(secret, 'correct-secret\n', 0o600);
  await write(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port: listen, ...(options.config || {}) }));
  const prior = { PATH: process.env.PATH, FAKE_LOG: process.env.FAKE_LOG, FAKE_PANE: process.env.FAKE_PANE };
  process.env.PATH = `${fake.bin}:${prior.PATH}`; process.env.FAKE_LOG = fake.log; process.env.FAKE_PANE = fake.pane;
  const instance = new MachineService({ stateDir: state, host: '127.0.0.1', port: listen }); await instance.listen();
  return { instance, state, fake, base: `http://127.0.0.1:${listen}`, async close() { await new Promise(resolve => instance.server.close(resolve)); Object.assign(process.env, prior); } };
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
function git(args, options = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', ...options });
  if (!options.allowFailure) assert.equal(result.status, 0, result.stderr);
  return result;
}
async function project(root) {
  const origin = path.join(root, 'origin.git'); const repo = path.join(root, 'project');
  git(['init', '--bare', '--initial-branch=main', origin]);
  git(['clone', origin, repo]);
  git(['-C', repo, 'config', 'user.name', 'Machine test']);
  git(['-C', repo, 'config', 'user.email', 'machine-test@example.test']);
  await write(path.join(repo, 'README.md'), 'base\n');
  git(['-C', repo, 'add', 'README.md']); git(['-C', repo, 'commit', '-m', 'base']); git(['-C', repo, 'push', '-u', 'origin', 'main']);
  return repo;
}
async function startedWorktree(env, root, threadId) {
  const repo = await project(root);
  const session = await start(env, { thread_id: threadId, token: `${threadId}-token`, project_dir: repo, project: 'project', default_branch: 'main', serviceWorktree: true });
  return { repo, session, worktree: session.worktree };
}

test('hub route refuses a session token', async () => {
  const env = await service(await temp()); try { assert.equal((await api(env, 'GET', '/v1/sessions', undefined, { 'x-wheelchair-session-token': 'alpha' })).status, 401); } finally { await env.close(); }
});
test('archive stops the thread sessions and not another thread', async () => {
  const env = await service(await temp()); try {
    await start(env, { role: 'lead', thread_id: 'archive', token: 'archive-token' });
    await start(env, { role: 'worker', thread_id: 'archive', token: 'archive-worker-token' });
    await start(env, { role: 'lead', thread_id: 'other', token: 'other-token' });
    const result = await api(env, 'POST', '/v1/archive', { thread_id: 'archive' }, hubHeader);
    assert.equal(result.status, 200); assert.deepEqual(result.body.stopped.sort(), ['wc-archive-lead', 'wc-archive-worker']);
    assert.equal(env.instance.sessions['wc-archive-lead'], undefined);
    assert.equal(env.instance.sessions['wc-other-lead'].thread_id, 'other');
    assert.match(await log(env), /kill-session -t wc-archive-lead/);
    assert.match(await log(env), /kill-session -t wc-archive-worker/);
    assert.doesNotMatch(await log(env), /kill-session -t wc-other-lead/);
  } finally { await env.close(); }
});
test('archive commits a dirty worktree and removes it while retaining its branch', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { repo, worktree } = await startedWorktree(env, root, 'archive-dirty');
    await write(path.join(worktree, 'dirty.txt'), 'unfinished\n');
    const result = await api(env, 'POST', '/v1/archive', { thread_id: 'archive-dirty' }, hubHeader);
    assert.equal(result.status, 200); assert.deepEqual(result.body.removed, [worktree]);
    assert.equal(result.body.committed[0].worktree, worktree);
    assert.match(git(['-C', repo, 'log', '-1', '--format=%s', 'wc/archive-dirty']).stdout, /^WIP: archived\n$/);
    assert.equal(git(['-C', repo, 'branch', '--list', 'wc/archive-dirty']).stdout.trim(), 'wc/archive-dirty');
    await assert.rejects(fs.access(worktree));
  } finally { await env.close(); }
});
test('archive commits a worktree mid-merge as it stands', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { repo, worktree } = await startedWorktree(env, root, 'archive-merge');
    await write(path.join(worktree, 'conflict.txt'), 'worktree\n');
    git(['-C', worktree, 'add', 'conflict.txt']); git(['-C', worktree, 'commit', '-m', 'worktree change']);
    git(['-C', repo, 'checkout', '-b', 'archive-merge-conflict']);
    await write(path.join(repo, 'conflict.txt'), 'other\n');
    git(['-C', repo, 'add', 'conflict.txt']); git(['-C', repo, 'commit', '-m', 'other change']);
    assert.equal(git(['-C', worktree, 'merge', 'archive-merge-conflict'], { allowFailure: true }).status, 1);
    const result = await api(env, 'POST', '/v1/archive', { thread_id: 'archive-merge' }, hubHeader);
    assert.equal(result.status, 200); assert.deepEqual(result.body.removed, [worktree]);
    assert.match(git(['-C', repo, 'log', '-1', '--format=%s', 'wc/archive-merge']).stdout, /^WIP: archived \(mid-merge\)\n$/);
  } finally { await env.close(); }
});
test('archive keeps and reports a worktree mid-rebase', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { repo, worktree } = await startedWorktree(env, root, 'archive-rebase');
    await write(path.join(worktree, 'rebase.txt'), 'worktree\n');
    git(['-C', worktree, 'add', 'rebase.txt']); git(['-C', worktree, 'commit', '-m', 'worktree change']);
    await write(path.join(repo, 'rebase.txt'), 'main\n');
    git(['-C', repo, 'add', 'rebase.txt']); git(['-C', repo, 'commit', '-m', 'main change']);
    assert.equal(git(['-C', worktree, 'rebase', 'main'], { allowFailure: true }).status, 1);
    const result = await api(env, 'POST', '/v1/archive', { thread_id: 'archive-rebase' }, hubHeader);
    assert.equal(result.status, 200); assert.deepEqual(result.body.removed, []);
    assert.deepEqual(result.body.kept, [{ worktree, reason: 'rebase in progress' }]);
    await fs.access(worktree);
  } finally { await env.close(); }
});
test('archive route refuses a session token', async () => {
  const env = await service(await temp()); try { await start(env); assert.equal((await api(env, 'POST', '/v1/archive', { thread_id: 't' }, { 'x-wheelchair-session-token': 'alpha' })).status, 401); } finally { await env.close(); }
});
test('agent route refuses the machine secret', async () => {
  const env = await service(await temp()); try { await start(env); assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'idea' }, hubHeader)).status, 401); } finally { await env.close(); }
});
test('Claude command line has session, hooks, auto permission, and appended role prompt', async () => {
  const env = await service(await temp(), { pane: trustDialog }); try { await start(env); const calls = await log(env); assert.match(calls, /'claude' '--session-id' .* '--settings' .* '--permission-mode' 'auto' '--append-system-prompt'/); const settings = await fs.readdir(path.join(env.state, 'settings')); const text = await fs.readFile(path.join(env.state, 'settings', settings[0]), 'utf8'); assert.match(text, /"Stop"/); assert.match(text, /"Notification"/); assert.match(text, /"cleanupPeriodDays":30/); } finally { await env.close(); }
});
test('Codex command line has session-name notify and inline projects trust', async () => {
  const env = await service(await temp(), { pane: readyCodex }); try { await start(env, { cli: 'codex', role: 'worker', token: 'beta', brief: 'build it' }); const calls = await log(env); assert.match(calls, /'codex' '-s' 'workspace-write' '-a' 'never'/); assert.match(calls, /notify=\[.*"codex","wc-t-worker"\]/); assert.match(calls, /projects=\{.*trust_level/); assert.match(calls, /\[wc:role\]/); } finally { await env.close(); }
});
test('Claude trust dialog is answered Down then Enter', async () => {
  const env = await service(await temp(), { pane: trustDialog }); try { await start(env); const calls = await log(env); assert.match(calls, /send-keys -t wc-t-lead Down/); assert.match(calls, /send-keys -t wc-t-lead Enter/); } finally { await env.close(); }
});
test('session is stuck after 30 seconds then becomes ready', async () => {
  const env = await service(await temp(), { pane: 'loading' }); try { await start(env); const session = env.instance.sessions['wc-t-lead']; session.created_at = new Date(Date.now() - 31_000).toISOString(); await env.instance.checkReady(session); assert.equal(session.status, 'stuck'); await write(env.fake.pane, readyClaude); await env.instance.checkReady(session); assert.equal(session.status, 'ready'); } finally { await env.close(); }
});
test('submit is bracketed paste followed by one Enter', async () => {
  const env = await service(await temp()); try { await start(env); await api(env, 'POST', '/v1/sessions/wc-t-lead/submit', { text: 'first\nsecond' }, hubHeader); const calls = await log(env); assert.match(calls, /load-buffer -b/); assert.match(calls, /paste-buffer -p -b .* -t wc-t-lead/); assert.match(calls, /send-keys -t wc-t-lead Enter/); } finally { await env.close(); }
});
test('raw keys add no Enter', async () => {
  const env = await service(await temp()); try { await start(env); const before = (await log(env)).split('\n').length; await api(env, 'POST', '/v1/sessions/wc-t-lead/keys', { keys: 'C-c' }, hubHeader); const after = (await log(env)).split('\n').slice(before - 1).join('\n'); assert.match(after, /send-keys -t wc-t-lead C-c/); assert.doesNotMatch(after, /C-c Enter/); } finally { await env.close(); }
});
test('hook posts a turn-ended event', async () => {
  const env = await service(await temp()); try { await start(env); const before = (await fs.readdir(path.join(env.state, 'spool', 'events'))).length; const result = await api(env, 'POST', '/v1/agent/hooks', { type: 'turn-ended' }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.status, 202); assert.equal((await fs.readdir(path.join(env.state, 'spool', 'events'))).length, before + 1); } finally { await env.close(); }
});
test('hook posts a permission prompt', async () => {
  const env = await service(await temp()); try { await start(env); const result = await api(env, 'POST', '/v1/agent/hooks', { type: 'prompt', notification_type: 'permission_prompt' }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.body.ok, true); } finally { await env.close(); }
});
test('hook ignores an idle prompt', async () => {
  const env = await service(await temp()); try { await start(env); const result = await api(env, 'POST', '/v1/agent/hooks', { type: 'prompt', notification_type: 'idle_prompt' }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.body.ignored, true); } finally { await env.close(); }
});
test('down-service hook is spooled and drained when service starts', async () => {
  const root = await temp(); const state = path.join(root, 'state'); await write(path.join(state, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: 1 }));
  const hook = path.join(process.cwd(), 'machine', 'hook.sh'); const priorState = process.env.WHEELCHAIR_STATE_DIR; const priorToken = process.env.WHEELCHAIR_SESSION_TOKEN;
  process.env.WHEELCHAIR_STATE_DIR = state; process.env.WHEELCHAIR_SESSION_TOKEN = 'alpha'; spawnSync(hook, ['claude', 'wc-t-lead'], { input: JSON.stringify({ hook_event_name: 'Stop' }), encoding: 'utf8' }); Object.assign(process.env, { WHEELCHAIR_STATE_DIR: priorState, WHEELCHAIR_SESSION_TOKEN: priorToken });
  assert.equal((await fs.readdir(path.join(state, 'spool', 'events'))).length, 1);
  const hub = await hubServer(); const env = await service(root, { config: { hub_url: hub.url } }); try { await new Promise(resolve => setTimeout(resolve, 15)); assert.equal((await fs.readdir(path.join(env.state, 'spool', 'events'))).length, 0); assert.equal(hub.calls[0].path, '/api/machine/events'); } finally { await env.close(); await hub.close(); }
});
test('Codex binding rejects title notify and requires literal role marker plus rollout', async () => {
  const env = await service(await temp(), { pane: readyCodex }); const prior = process.env.CODEX_HOME;
  try {
    await start(env, { cli: 'codex' }); process.env.CODEX_HOME = path.join(path.dirname(env.state), 'codex');
    let result = await api(env, 'POST', '/v1/agent/hooks', { type: 'turn-ended', 'thread-id': 'title', 'input-messages': ['Generate a concise title'] }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.body.ignored, true);
    result = await api(env, 'POST', '/v1/agent/hooks', { type: 'turn-ended', 'thread-id': 'none', 'input-messages': ['[wc:role] work'] }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.body.ignored, true);
    await write(path.join(process.env.CODEX_HOME, 'sessions', '2026', '11', '14', 'rollout-x-real.jsonl'), '{}\n');
    result = await api(env, 'POST', '/v1/agent/hooks', { type: 'turn-ended', 'thread-id': 'real', 'input-messages': ['[wc:role] work'] }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.body.ok, true); assert.equal(env.instance.sessions['wc-t-lead'].codex_thread_id, 'real');
  } finally { process.env.CODEX_HOME = prior; await env.close(); }
});
test('transcript copy dedupes content after source shrinks', async () => {
  const env = await service(await temp()); try { await start(env); const source = path.join(path.dirname(env.state), 'source.jsonl'); await write(source, '{"one":1}\n{"two":2}\n'); const session = env.instance.sessions['wc-t-lead']; await env.instance.copyTranscript(session, source); await write(source, '{"one":1}\n'); await env.instance.copyTranscript(session, source); assert.equal((await fs.readFile(session.transcript_path, 'utf8')).trim().split('\n').length, 2); } finally { await env.close(); }
});
test('card spool keeps order and retries until acknowledged', async () => {
  const hub = await hubServer(503); const env = await service(await temp(), { config: { hub_url: hub.url } }); try { await start(env); await api(env, 'POST', '/v1/agent/cards', { n: 1 }, { 'x-wheelchair-session-token': 'alpha' }); await api(env, 'POST', '/v1/agent/cards', { n: 2 }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 2); hub.setStatus(200); await env.instance.drainSpool('cards'); assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 0); const cards = hub.calls.filter(call => call.path.endsWith('/cards')); assert.match(cards.at(-2).body, /"n":1/); assert.match(cards.at(-1).body, /"n":2/); } finally { await env.close(); await hub.close(); }
});
test('agent session forward retries then reports hub unavailable', async () => {
  const hub = await hubServer(503); const env = await service(await temp(), { config: { hub_url: hub.url } }); try { await start(env); env.instance.retryWindow = 20; env.instance.retryDelay = 5; await assert.rejects(() => env.instance.forwardSession(env.instance.sessions['wc-t-lead'], { action: 'start', attempt_id: 'a' }), /hub unavailable/); assert.ok(hub.calls.filter(call => call.path.endsWith('/session')).length > 1); } finally { await env.close(); await hub.close(); }
});
test('git refuses paths outside the calling worktree', async () => {
  const env = await service(await temp()); try { await start(env); const result = await api(env, 'POST', '/v1/agent/git', { operation: 'commit', paths: ['../outside'] }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.status, 403); } finally { await env.close(); }
});
test('git commit refuses no paths', async () => {
  const env = await service(await temp()); try { await start(env); const result = await api(env, 'POST', '/v1/agent/git', { operation: 'commit' }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.status, 400); } finally { await env.close(); }
});
