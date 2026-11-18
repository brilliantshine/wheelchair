'use strict';
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
  for (const name of ['tmux', 'systemd-run', ...(realGit ? [] : ['git']), 'gh', 'claude', 'codex', 'agy', 'tailscale', 'sh']) await write(path.join(bin, name), script, 0o755);
  await write(pane, paneText);
  return { bin, log, pane };
}
async function hubServer(status = 200, { failAfterStore = false } = {}) {
  const calls = []; let current = status; const delivered = new Set();
  const allowed = { idea: ['lead'], done: ['lead'], message: ['lead', 'sub-lead', 'worker', 'mapper'], result: ['worker', 'mapper', 'sub-lead'] };
  const server = http.createServer((request, response) => { let body = ''; request.on('data', c => { body += c; }); request.on('end', () => {
    let code = current; let answer = {};
    let payload = {}; try { payload = JSON.parse(body || '{}'); } catch { /* test server records malformed payloads too */ }
    if (code >= 200 && code < 300 && request.url.endsWith('/events') && !payload.thread_id) { code = 404; answer = { error: 'thread not found' }; }
    if (code >= 200 && code < 300 && request.url.endsWith('/cards')) {
      const role = /-(lead|sub-lead|worker|mapper|reviewer|verifier)(?:-\d+)?$/.exec(payload.session || '')?.[1];
      if (!allowed[payload.kind]?.includes(role)) { code = 422; answer = { error: `${role || 'unknown'} may not post ${payload.kind || 'that card'}` }; }
      else if (payload.delivery_id && delivered.has(`${payload.thread_id}:${payload.delivery_id}`)) answer = { ok: true, duplicate: true };
      else if (payload.delivery_id) delivered.add(`${payload.thread_id}:${payload.delivery_id}`);
      if (failAfterStore && code === 200 && !answer.duplicate) { code = 500; failAfterStore = false; }
    }
    calls.push({ path: request.url, body, status: code }); response.writeHead(code, { 'content-type': 'application/json' }); response.end(JSON.stringify(answer));
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
  let instance = new MachineService({ stateDir: state, host: '127.0.0.1', port: listen });
  try { await instance.listen(); } catch (error) { Object.assign(process.env, prior); throw error; }
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
async function project(root, branch = 'main') {
  const origin = path.join(root, 'origin.git'); const repo = path.join(root, 'project');
  git(['init', '--bare', `--initial-branch=${branch}`, origin]);
  git(['clone', origin, repo]);
  git(['-C', repo, 'config', 'user.name', 'Machine test']);
  git(['-C', repo, 'config', 'user.email', 'machine-test@example.test']);
  await write(path.join(repo, 'README.md'), 'base\n');
  git(['-C', repo, 'add', 'README.md']); git(['-C', repo, 'commit', '-m', 'base']); git(['-C', repo, 'push', '-u', 'origin', branch]);
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
test('archive forgets sessions whose worktree was already removed', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { repo, worktree } = await startedWorktree(env, root, 'archive-gone');
    git(['-C', repo, 'worktree', 'remove', '--force', worktree]);
    const result = await api(env, 'POST', '/v1/archive', { thread_id: 'archive-gone' }, hubHeader);
    assert.equal(result.status, 200); assert.deepEqual(result.body.kept, []);
    assert.equal(env.instance.sessions['wc-archive-gone-lead'], undefined);
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
    await write(path.join(env.state, 'uploads', 'archive-rebase', '1-file'), 'saved');
    const result = await api(env, 'POST', '/v1/archive', { thread_id: 'archive-rebase' }, hubHeader);
    assert.equal(result.body.uploads_removed, null);
    assert.equal(await fs.readFile(path.join(env.state, 'uploads', 'archive-rebase', '1-file'), 'utf8'), 'saved');
    assert.equal(env.instance.archivedThreads.has('archive-rebase'), false);
    assert.equal(result.status, 200); assert.deepEqual(result.body.removed, []);
    assert.deepEqual(result.body.kept, [{ worktree, reason: 'rebase in progress' }]);
    await fs.access(worktree);
  } finally { await env.close(); }
});
test('a retained rebase worktree is removed by archive after the rebase is aborted', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { repo, worktree } = await startedWorktree(env, root, 'archive-rebase-retry');
    const mapper = await start(env, { role: 'mapper', thread_id: 'archive-rebase-retry', token: 'archive-rebase-retry-mapper', worktree });
    await write(path.join(worktree, 'rebase.txt'), 'worktree\n');
    git(['-C', worktree, 'add', 'rebase.txt']); git(['-C', worktree, 'commit', '-m', 'worktree change']);
    await write(path.join(repo, 'rebase.txt'), 'main\n');
    git(['-C', repo, 'add', 'rebase.txt']); git(['-C', repo, 'commit', '-m', 'main change']);
    assert.equal(git(['-C', worktree, 'rebase', 'main'], { allowFailure: true }).status, 1);
    const first = await api(env, 'POST', '/v1/archive', { thread_id: 'archive-rebase-retry' }, hubHeader);
    assert.deepEqual(first.body.kept, [{ worktree, reason: 'rebase in progress' }]);
    const name = 'wc-archive-rebase-retry-lead';
    assert.equal(env.instance.sessions[name].archived_pending, true);
    assert.equal(env.instance.sessions[name].status, 'stopped');
    assert.equal(env.instance.sessions[mapper.name].archived_pending, true);
    git(['-C', worktree, 'rebase', '--abort']);
    const second = await api(env, 'POST', '/v1/archive', { thread_id: 'archive-rebase-retry' }, hubHeader);
    assert.deepEqual(second.body.kept, []);
    assert.deepEqual(second.body.removed, [worktree]);
    assert.equal(env.instance.sessions[name], undefined);
    await assert.rejects(fs.access(worktree));
  } finally { await env.close(); }
});
test('archive route refuses a session token', async () => {
  const env = await service(await temp()); try { await start(env); assert.equal((await api(env, 'POST', '/v1/archive', { thread_id: 't' }, { 'x-wheelchair-session-token': 'alpha' })).status, 401); } finally { await env.close(); }
});
test('agent route refuses the machine secret', async () => {
  const env = await service(await temp()); try { await start(env); assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'idea' }, hubHeader)).status, 401); } finally { await env.close(); }
});
test('Claude command line has session, hooks, auto permission, and appended role prompt', async () => {
  const env = await service(await temp(), { pane: trustDialog }); try { await start(env); const calls = await log(env); assert.match(calls, /'claude' '--session-id' .* '--settings' .* '--permission-mode' 'auto' '--append-system-prompt-file'/); assert.match(calls, /'WHEELCHAIR_MACHINE_ORIGIN=http:\/\/127\.0\.0\.1:\d+'/); const settings = await fs.readdir(path.join(env.state, 'settings')); const text = await fs.readFile(path.join(env.state, 'settings', settings[0]), 'utf8'); assert.match(text, /"Stop"/); assert.match(text, /"Notification"/); assert.match(text, /"cleanupPeriodDays":30/); assert.match(text, /"promptSuggestionEnabled":false/); } finally { await env.close(); }
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
test('down-service hook is rebound to its session and drained when service starts', async () => {
  const root = await temp(); const first = await service(root); await start(first); await first.close();
  const state = path.join(root, 'state'); const configured = JSON.parse(await fs.readFile(path.join(state, 'machine.json'), 'utf8')); await write(path.join(state, 'machine.json'), JSON.stringify({ ...configured, host: '127.0.0.1', port: 1 }));
  const hook = path.join(process.cwd(), 'machine', 'hook.sh'); const priorState = process.env.WHEELCHAIR_STATE_DIR; const priorToken = process.env.WHEELCHAIR_SESSION_TOKEN;
  process.env.WHEELCHAIR_STATE_DIR = state; process.env.WHEELCHAIR_SESSION_TOKEN = 'alpha'; spawnSync(hook, ['claude', 'wc-t-lead'], { input: JSON.stringify({ hook_event_name: 'Stop' }), encoding: 'utf8' }); Object.assign(process.env, { WHEELCHAIR_STATE_DIR: priorState, WHEELCHAIR_SESSION_TOKEN: priorToken });
  const spooled = await Promise.all((await fs.readdir(path.join(state, 'spool', 'events'))).map(async file => JSON.parse(await fs.readFile(path.join(state, 'spool', 'events', file), 'utf8'))));
  // The first service's own ready event spooled too (no hub then); the hook's event has no thread_id until drained.
  const hooked = spooled.filter(event => event.type === 'turn-ended'); assert.equal(hooked.length, 1); assert.equal(hooked[0].thread_id, undefined);
  const hub = await hubServer(); const env = await service(root, { config: { hub_url: hub.url } }); try { await new Promise(resolve => setTimeout(resolve, 15)); assert.equal((await fs.readdir(path.join(env.state, 'spool', 'events'))).length, 0); const call = hub.calls.find(entry => entry.path === '/api/machine/events' && JSON.parse(entry.body).type === 'turn-ended'); assert.ok(call); const posted = JSON.parse(call.body); assert.equal(posted.thread_id, 't'); assert.match(posted.delivery_id, /^[0-9a-f-]{36}$/); } finally { await env.close(); await hub.close(); }
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
  const hub = await hubServer(503); const env = await service(await temp(), { config: { hub_url: hub.url } }); try { await start(env); await api(env, 'POST', '/v1/agent/cards', { kind: 'idea', bullets: [{ id: 'one', text: 'one' }] }, { 'x-wheelchair-session-token': 'alpha' }); await api(env, 'POST', '/v1/agent/cards', { kind: 'idea', bullets: [{ id: 'two', text: 'two' }] }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 2); hub.setStatus(200); await env.instance.drainSpool('cards'); assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 0); const cards = hub.calls.filter(call => call.path.endsWith('/cards')); assert.match(cards.at(-2).body, /"id":"one"/); assert.match(cards.at(-1).body, /"id":"two"/); } finally { await env.close(); await hub.close(); }
});
test('a card stored before a hub 500 is queued and deduplicated on drain', async () => {
  const hub = await hubServer(200, { failAfterStore: true }); const env = await service(await temp(), { config: { hub_url: hub.url } }); try {
    await start(env);
    const result = await api(env, 'POST', '/v1/agent/cards', { kind: 'idea', bullets: [{ id: 'one', text: 'one' }] }, { 'x-wheelchair-session-token': 'alpha' });
    assert.equal(result.status, 202);
    assert.equal(result.body.spooled, true);
    await env.instance.drainSpool('cards');
    assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 0);
    assert.equal(hub.delivered.size, 1);
    const cards = hub.calls.filter(call => call.path.endsWith('/cards')).map(call => JSON.parse(call.body));
    assert.equal(cards.length, 2);
    assert.ok(cards[0].delivery_id);
    assert.equal(cards[0].delivery_id, cards[1].delivery_id);
  } finally { await env.close(); await hub.close(); }
});
test('a refused card is returned to its worker, retained as rejected, and does not stop a following result', async () => {
  const hub = await hubServer(); const env = await service(await temp(), { config: { hub_url: hub.url } }); try {
    await start(env); await start(env, { role: 'worker', token: 'worker-token' });
    const refused = await api(env, 'POST', '/v1/agent/cards', { kind: 'done' }, agentHeader('worker-token'));
    assert.equal(refused.status, 422); assert.match(refused.body.error, /worker may not post done/);
    const rejected = await fs.readdir(path.join(env.state, 'spool', 'rejected', 'cards'));
    assert.equal(rejected.length, 1);
    const accepted = await api(env, 'POST', '/v1/agent/cards', { kind: 'result' }, agentHeader('worker-token'));
    assert.equal(accepted.status, 200);
    assert.equal(JSON.parse(hub.calls.filter(call => call.path.endsWith('/cards')).at(-1).body).kind, 'result');
  } finally { await env.close(); await hub.close(); }
});
test('a refused spooled card moves aside and the following card drains', async () => {
  const hub = await hubServer(503); const env = await service(await temp(), { config: { hub_url: hub.url } }); try {
    await start(env); await start(env, { role: 'worker', token: 'worker-token' });
    assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'done' }, agentHeader('worker-token'))).status, 202);
    assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'result' }, agentHeader('worker-token'))).status, 202);
    hub.setStatus(200); await env.instance.drainSpool('cards');
    assert.equal((await fs.readdir(path.join(env.state, 'spool', 'rejected', 'cards'))).length, 1);
    assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 0);
    const delivered = hub.calls.filter(call => call.path.endsWith('/cards') && call.status === 200).map(call => JSON.parse(call.body).kind);
    assert.deepEqual(delivered, ['result']);
  } finally { await env.close(); await hub.close(); }
});
test('concurrent card drains send each spooled card exactly once', async () => {
  const hub = await hubServer(); const env = await service(await temp(), { config: { hub_url: hub.url } }); try {
    await start(env);
    await env.instance.spool('cards', { kind: 'idea', bullets: [{ id: 'one', text: 'one' }], session: 'wc-t-lead', thread_id: 't' });
    await Promise.all([env.instance.drainSpool('cards'), env.instance.drainSpool('cards')]);
    assert.equal(hub.calls.filter(call => call.path.endsWith('/cards')).length, 1);
  } finally { await env.close(); await hub.close(); }
});
test('status keeps the version read when the service was constructed', async () => {
  await withEnv({ FAKE_GIT_VERSION: 'boot-commit' }, async () => {
    const env = await service(await temp()); try {
      process.env.FAKE_GIT_VERSION = 'after-pull';
      const status = await api(env, 'GET', '/v1/status', undefined, hubHeader);
      assert.equal(status.body.version, 'boot-commit');
    } finally { await env.close(); }
  });
});
test('two starts of one name at once launch one tmux session', async () => {
  const root = await temp(); const env = await service(root); try {
    const worktree = path.join(root, 'work-twice'); await fs.mkdir(worktree, { recursive: true });
    const body = { role: 'worker', cli: 'claude', thread_id: 't', token: 'twice', name: 'wc-t-worker-1', worktree };
    const [first, second] = await Promise.all([env.instance.start(body), env.instance.start(body)]);
    assert.equal(first.name, second.name);
    const launches = (await log(env)).split('\n').filter(line => line.startsWith('tmux new-session') && line.includes('wc-t-worker-1'));
    assert.equal(launches.length, 1);
  } finally { await env.close(); }
});
test('a worktree starts from origin trunk and records trunk as its default branch', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const repo = await project(root, 'trunk');
    const session = await start(env, { thread_id: 'trunk', token: 'trunk-token', project_dir: repo, project: 'project', serviceWorktree: true });
    assert.equal(session.default_branch, 'trunk');
    assert.equal(git(['-C', repo, 'merge-base', '--is-ancestor', 'origin/trunk', session.branch]).status, 0);
  } finally { await env.close(); }
});
for (const [what, variable] of [['git fetch', 'FAKE_FETCH_SLEEP'], ['systemd-run', 'FAKE_SCOPE_SLEEP']]) test(`a slow ${what} in a session start does not hold up a status check`, async () => {
  const root = await temp(); const env = await service(root); process.env[variable] = '3'; try {
    const repo = path.join(root, 'project'); await fs.mkdir(repo, { recursive: true });
    // The status check runs in its own process: a service that blocks would also freeze a timer
    // in this one, and the check would then only begin once the fetch was over.
    const probe = `setTimeout(async () => { const began = Date.now(); const r = await fetch(${JSON.stringify(`${env.base}/v1/status`)}, { headers: ${JSON.stringify(hubHeader)} }); await r.text(); console.log(JSON.stringify({ status: r.status, waited: Date.now() - began })); }, 500);`;
    const checked = new Promise((resolve, reject) => { let out = ''; const child = spawn(process.execPath, ['-e', probe]); child.stdout.on('data', c => { out += c; }); child.on('error', reject); child.on('close', () => resolve(out)); });
    const starting = start(env, { thread_id: 'slow', token: 'slow-token', project_dir: repo, project: 'project', serviceWorktree: true });
    const { status, waited } = JSON.parse(await checked);
    assert.equal(status, 200);
    assert.ok(waited < 1000, `status took ${waited} ms while it ran`);
    assert.equal((await starting).name, 'wc-slow-lead');
  } finally { delete process.env[variable]; await env.close(); }
});
test('a worker start after an overlapping failed one skips the branch the other took', async () => {
  const root = await temp(); const env = await service(root); try {
    const repo = path.join(root, 'project'); await fs.mkdir(repo, { recursive: true });
    const input = (n) => ({ role: 'worker', thread_id: 'gap', token: `gap-${n}`, name: `wc-gap-worker-${n}`, project_dir: repo, project: 'project', serviceWorktree: true });
    process.env.FAKE_FETCH_FAIL_ONCE = path.join(root, 'fetch-failed');
    const [failed, second] = await Promise.all([
      api(env, 'POST', '/v1/sessions', { cli: 'claude', ...input(1) }, hubHeader),
      start(env, input(2)),
    ]);
    assert.notEqual(failed.status, 201);
    assert.equal(second.branch, 'wc-gap-w2');
    assert.equal((await start(env, input(3))).branch, 'wc-gap-w3');
  } finally { delete process.env.FAKE_FETCH_FAIL_ONCE; await env.close(); }
});
test('two worker starts in one thread overlapping in git get different branches', async () => {
  const root = await temp(); const env = await service(root); process.env.FAKE_FETCH_SLEEP = '1'; try {
    const repo = path.join(root, 'project'); await fs.mkdir(repo, { recursive: true });
    const input = (n) => ({ role: 'worker', thread_id: 'pair', token: `pair-${n}`, name: `wc-pair-worker-${n}`, project_dir: repo, project: 'project', serviceWorktree: true });
    const [first, second] = await Promise.all([start(env, input(1)), start(env, input(2))]);
    assert.notEqual(first.branch, second.branch);
    assert.deepEqual([first.branch, second.branch].sort(), ['wc-pair-w1', 'wc-pair-w2']);
  } finally { delete process.env.FAKE_FETCH_SLEEP; await env.close(); }
});
test('a worker restart reuses its worktree and branch, while a missing worktree is refused', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { repo } = await startedWorktree(env, root, 'reuse');
    const first = await start(env, { role: 'worker', thread_id: 'reuse', token: 'worker-one', project_dir: repo, project: 'project', serviceWorktree: true });
    const before = git(['-C', repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/wc-reuse-w']).stdout;
    const replacement = await start(env, { role: 'worker', name: 'wc-reuse-worker-2', thread_id: 'reuse', token: 'worker-two', worktree: first.worktree, branch: first.branch });
    assert.equal(replacement.worktree, first.worktree); assert.equal(replacement.branch, first.branch);
    assert.equal(git(['-C', repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/wc-reuse-w']).stdout, before);
    const missing = await api(env, 'POST', '/v1/sessions', { role: 'worker', cli: 'claude', thread_id: 'reuse', token: 'worker-three', name: 'wc-reuse-worker-3', worktree: path.join(root, 'missing-worker-worktree'), branch: first.branch }, hubHeader);
    assert.equal(missing.status, 400); assert.match(missing.body.error, /does not exist/);
  } finally { await env.close(); }
});
test('transcript copies wait for a complete JSONL line before advancing their offset', async () => {
  const env = await service(await temp()); try {
    await start(env); const session = env.instance.sessions['wc-t-lead']; const source = path.join(path.dirname(env.state), 'partial.jsonl');
    await write(source, '{"one":1}\n{"two":'); await env.instance.copyTranscript(session, source);
    assert.deepEqual((await fs.readFile(session.transcript_path, 'utf8')).trim().split('\n').map(JSON.parse), [{ one: 1 }]);
    await fs.appendFile(source, '2}\n'); await env.instance.copyTranscript(session, source);
    assert.deepEqual((await fs.readFile(session.transcript_path, 'utf8')).trim().split('\n').map(JSON.parse), [{ one: 1 }, { two: 2 }]);
  } finally { await env.close(); }
});
test('overlapping transcript copies append each new line once', async () => {
  const env = await service(await temp()); try {
    await start(env); const session = env.instance.sessions['wc-t-lead']; const source = path.join(path.dirname(env.state), 'busy.jsonl');
    await write(source, '{"one":1}\n{"two":2}\n');
    await Promise.all(Array.from({ length: 8 }, () => env.instance.copyTranscript(session, source)));
    assert.deepEqual((await fs.readFile(session.transcript_path, 'utf8')).trim().split('\n').map(JSON.parse), [{ one: 1 }, { two: 2 }]);
  } finally { await env.close(); }
});

test('a live session serves its kept transcript copy after the source transcript disappears', async () => {
  const env = await service(await temp()); try {
    await start(env); const session = env.instance.sessions['wc-t-lead']; const source = path.join(path.dirname(env.state), 'gone.jsonl');
    await write(source, '{"kept":true}\n'); await env.instance.copyTranscript(session, source); session.source_transcript = source;
    await fs.rename(source, `${source}.gone`);
    const transcript = await env.instance.transcript(session.name);
    assert.equal(transcript.data, '{"kept":true}\n');
  } finally { await env.close(); }
});
test('Claude trust is checked within a second instead of waiting for the two-second readiness poll', async () => {
  const env = await service(await temp(), { pane: 'loading' }); try {
    await start(env); await write(env.fake.pane, trustDialog); const deadline = Date.now() + 1_000;
    let calls = '';
    while (Date.now() < deadline) {
      calls = await log(env);
      if (calls.includes('send-keys -t wc-t-lead Down') && calls.includes('send-keys -t wc-t-lead Enter')) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.match(calls, /send-keys -t wc-t-lead Down/); assert.match(calls, /send-keys -t wc-t-lead Enter/);
  } finally { await env.close(); }
});
test('agent session forward retries then reports hub unavailable', async () => {
  const hub = await hubServer(503); const env = await service(await temp(), { config: { hub_url: hub.url } }); try { await start(env); env.instance.retryWindow = 20; env.instance.retryDelay = 5; await assert.rejects(() => env.instance.forwardSession(env.instance.sessions['wc-t-lead'], { action: 'start', attempt_id: 'a' }), /hub unavailable/); assert.ok(hub.calls.filter(call => call.path.endsWith('/session')).length > 1); } finally { await env.close(); await hub.close(); }
});
test('git refuses paths outside the calling worktree', async () => {
  const env = await service(await temp()); try { await start(env); const result = await api(env, 'POST', '/v1/agent/git', { operation: 'commit', paths: ['../outside'], message: 'm' }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.status, 403); } finally { await env.close(); }
});
test('git commit refuses no paths', async () => {
  const env = await service(await temp()); try { await start(env); const result = await api(env, 'POST', '/v1/agent/git', { operation: 'commit' }, { 'x-wheelchair-session-token': 'alpha' }); assert.equal(result.status, 400); } finally { await env.close(); }
});
test('a verifier gets its own detached worktree at the lead\'s unpushed commit', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { repo, worktree } = await startedWorktree(env, root, 'verify');
    await write(path.join(worktree, 'fix.txt'), 'fixed\n');
    git(['-C', worktree, 'add', 'fix.txt']); git(['-C', worktree, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-m', 'fix']);
    const head = git(['-C', worktree, 'rev-parse', 'HEAD']).stdout.trim();
    const verifier = await start(env, { role: 'verifier', cli: 'codex', name: 'wc-verify-verifier', thread_id: 'verify', token: 'v-token', project_dir: repo, project: 'project', default_branch: 'main', verify_ref: 'wc/verify', serviceWorktree: true });
    assert.notEqual(verifier.worktree, worktree);
    assert.equal(git(['-C', verifier.worktree, 'rev-parse', 'HEAD']).stdout.trim(), head);
  } finally { await env.close(); }
});
test('stopping a verifier removes its throwaway worktree even with untracked files', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { repo, worktree } = await startedWorktree(env, root, 'verify-stop');
    const verifier = await start(env, { role: 'verifier', cli: 'codex', name: 'wc-verify-stop-verifier', thread_id: 'verify-stop', token: 'verify-stop-token', project_dir: repo, project: 'project', default_branch: 'main', verify_ref: 'wc/verify-stop', serviceWorktree: true });
    assert.notEqual(verifier.worktree, worktree);
    await write(path.join(verifier.worktree, 'left-by-test.txt'), 'untracked\n');
    const stopped = await api(env, 'DELETE', `/v1/sessions/${verifier.name}`, undefined, hubHeader);
    assert.equal(stopped.status, 200);
    await assert.rejects(fs.access(verifier.worktree));
  } finally { await env.close(); }
});
test('a hub refusal reaches the agent at once, without retries', async () => {
  const hub = await hubServer(400); const env = await service(await temp(), { config: { hub_url: hub.url } }); try { await start(env); env.instance.retryWindow = 2000; env.instance.retryDelay = 5; await assert.rejects(() => env.instance.forwardSession(env.instance.sessions['wc-t-lead'], { action: 'start', attempt_id: 'a' }), (error) => error.status === 400); assert.equal(hub.calls.filter(call => call.path.endsWith('/session')).length, 1); } finally { await env.close(); await hub.close(); }
});
test('a commit with no message is refused rather than titled for the agent', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { worktree, session } = await startedWorktree(env, root, 'nomsg');
    await write(path.join(worktree, 'a.txt'), 'a\n');
    const result = await api(env, 'POST', '/v1/agent/git', { operation: 'commit', paths: ['a.txt'] }, { 'x-wheelchair-session-token': 'nomsg-token' });
    assert.equal(result.status, 400); assert.match(JSON.stringify(result.body), /message/);
    assert.ok(session);
  } finally { await env.close(); }
});
test('a thread branch made from origin/main tracks nothing', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { worktree } = await startedWorktree(env, root, 'track');
    const upstream = git(['-C', worktree, 'rev-parse', '--abbrev-ref', '@{upstream}'], { allowFailure: true });
    assert.notEqual(upstream.status, 0, upstream.stdout);
  } finally { await env.close(); }
});
test('a new worktree links the clone\'s installed packages and git ignores the link', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const repo = await project(root);
    await write(path.join(repo, 'viewer', 'package.json'), '{}\n');
    git(['-C', repo, 'add', 'viewer/package.json']); git(['-C', repo, 'commit', '-m', 'viewer']); git(['-C', repo, 'push']);
    await write(path.join(repo, 'viewer', 'node_modules', 'dep', 'index.js'), 'x\n');
    const session = await start(env, { thread_id: 'pkgs', token: 'pkgs-token', project_dir: repo, project: 'project', default_branch: 'main', serviceWorktree: true });
    const link = path.join(session.worktree, 'viewer', 'node_modules');
    assert.equal(await fs.readlink(link), path.join(repo, 'viewer', 'node_modules'));
    assert.equal(await fs.readFile(path.join(link, 'dep', 'index.js'), 'utf8'), 'x\n');
    assert.equal(git(['-C', session.worktree, 'status', '--porcelain']).stdout, '');
  } finally { await env.close(); }
});
test('a hub 500 reaches the agent at once; a 502 is retried', async () => {
  const hub = await hubServer(500); const env = await service(await temp(), { config: { hub_url: hub.url } }); try { await start(env); env.instance.retryWindow = 2000; env.instance.retryDelay = 5; await assert.rejects(() => env.instance.forwardSession(env.instance.sessions['wc-t-lead'], { action: 'start', attempt_id: 'a' }), (error) => error.status === 500); assert.equal(hub.calls.filter(call => call.path.endsWith('/session')).length, 1); hub.setStatus(502); env.instance.retryWindow = 30; await assert.rejects(() => env.instance.forwardSession(env.instance.sessions['wc-t-lead'], { action: 'start', attempt_id: 'b' }), /hub unavailable/); assert.ok(hub.calls.filter(call => call.path.endsWith('/session')).length > 2); } finally { await env.close(); await hub.close(); }
});
test('a refused start is a 400 with the reason', async () => {
  const env = await service(await temp()); try { const result = await api(env, 'POST', '/v1/sessions', { role: 'lead', cli: 'claude', thread_id: 't', token: 'alpha' }, hubHeader); assert.equal(result.status, 400); assert.match(result.body.error, /worktree or project_dir required/); } finally { await env.close(); }
});
test('a Codex notify payload is posted as turn-ended, keeping its last message', async () => {
  const root = await temp(); const state = path.join(root, 'state'); const bodies = [];
  const server = http.createServer((request, response) => { let body = ''; request.on('data', c => { body += c; }); request.on('end', () => { bodies.push(JSON.parse(body)); response.writeHead(202); response.end('{}'); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await write(path.join(state, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: server.address().port }));
    const notify = JSON.stringify({ type: 'agent-turn-complete', 'thread-id': 'x', 'last-assistant-message': 'No findings.' });
    await new Promise((resolve, reject) => { const child = spawn(process.execPath, [path.join(process.cwd(), 'machine', 'lib', 'hook-post.js'), state, 'tok', 'codex', 'wc-t-reviewer'], { stdio: ['pipe', 'ignore', 'inherit'] }); trackChild(child); child.on('exit', resolve); child.on('error', reject); child.stdin.end(notify); });
    assert.equal(bodies[0].type, 'turn-ended'); assert.equal(bodies[0]['last-assistant-message'], 'No findings.');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('an archived session\'s kept transcript is still served; an unknown one is not', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { session } = await startedWorktree(env, root, 'kept');
    await write(path.join(env.state, 'transcripts', 'kept', `${session.name}.jsonl`), '{"line":1}\n');
    const archived = await api(env, 'POST', '/v1/archive', { thread_id: 'kept' }, hubHeader);
    assert.equal(archived.status, 200, JSON.stringify(archived.body));
    const result = await api(env, 'GET', `/v1/sessions/${session.name}/transcript`, undefined, hubHeader);
    assert.equal(result.status, 200); assert.equal(result.body.data, '{"line":1}\n');
    const unknown = await api(env, 'GET', '/v1/sessions/wc-nope-lead/transcript', undefined, hubHeader);
    assert.equal(unknown.status, 404);
  } finally { await env.close(); }
});
test('a stopped session is not reported stuck while it shuts down', async () => {
  const hub = await hubServer(); const env = await service(await temp(), { pane: 'shutting down', config: { hub_url: hub.url } }); try {
    await start(env); const session = env.instance.sessions['wc-t-lead'];
    session.status = 'stopped'; session.created_at = new Date(Date.now() - 60_000).toISOString();
    await env.instance.pollReadiness();
    assert.equal(session.status, 'stopped');
    assert.equal(hub.calls.filter(call => call.body.includes('"stuck"')).length, 0);
  } finally { await env.close(); await hub.close(); }
});

async function withEnv(vars, body) {
  const prior = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(vars)) process.env[key] = value;
  try { return await body(); } finally { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
const agentHeader = token => ({ 'x-wheelchair-session-token': token });

test('a relayed permission prompt is reported cleared when the pane shows input again', async () => {
  const hub = await hubServer(); const env = await service(await temp(), { pane: 'Do you want to proceed?\n❯ 1. Yes\n', config: { hub_url: hub.url } }); try {
    await start(env); const session = env.instance.sessions['wc-t-lead']; session.status = 'ready';
    await api(env, 'POST', '/v1/agent/hooks', { type: 'prompt', notification_type: 'permission_prompt' }, agentHeader('alpha'));
    assert.equal(session.prompt_open, true);
    await env.instance.pollReadiness();
    assert.equal(hub.calls.filter(call => call.body.includes('prompt-cleared')).length, 0);
    await write(env.fake.pane, readyClaude); await env.instance.pollReadiness();
    const cleared = hub.calls.filter(call => call.body.includes('prompt-cleared'));
    assert.equal(cleared.length, 1); assert.equal(JSON.parse(cleared[0].body).session, 'wc-t-lead'); assert.equal(session.prompt_open, false);
    await env.instance.pollReadiness();
    assert.equal(hub.calls.filter(call => call.body.includes('prompt-cleared')).length, 1);
    assert.equal(hub.calls.filter(call => call.body.includes('"ready"')).length, 0);
  } finally { await env.close(); await hub.close(); }
});
test('a Claude transcript is found by session id before any Stop hook', async () => {
  const root = await temp(); const config = path.join(root, 'claude-config');
  await withEnv({ CLAUDE_CONFIG_DIR: config }, async () => {
    const env = await service(root); try {
      await start(env); const session = env.instance.sessions['wc-t-lead'];
      assert.equal((await api(env, 'GET', '/v1/sessions/wc-t-lead/transcript', undefined, hubHeader)).body.data, '');
      await write(path.join(config, 'projects', '-some-project', `${session.cli_session_id}.jsonl`), '{"a":1}\n');
      const result = await api(env, 'GET', '/v1/sessions/wc-t-lead/transcript', undefined, hubHeader);
      assert.equal(result.body.data, '{"a":1}\n'); assert.match(session.source_transcript, /-some-project/);
    } finally { await env.close(); }
  });
});
test('the spool is retried on a timer until the hub acknowledges', async () => {
  const hub = await hubServer(503);
  await withEnv({ WHEELCHAIR_SPOOL_INTERVAL_MS: '20' }, async () => {
    const env = await service(await temp(), { config: { hub_url: hub.url } }); try {
      await start(env); await api(env, 'POST', '/v1/agent/cards', { kind: 'idea', bullets: [{ id: 'one', text: 'one' }] }, agentHeader('alpha'));
      assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 1);
      hub.setStatus(200);
      for (let i = 0; i < 50 && (await fs.readdir(path.join(env.state, 'spool', 'cards'))).length; i += 1) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 0);
    } finally { await env.close(); await hub.close(); }
  });
});
test('a failed tmux listing reports running as unknown, and "no server" as not running', async () => {
  await withEnv({ FAKE_SESSIONS: 'wc-t-lead scratch' }, async () => {
    const env = await service(await temp()); try {
      await start(env);
      const listed = async () => (await api(env, 'GET', '/v1/sessions', undefined, hubHeader)).body;
      assert.equal((await listed()).find(s => s.name === 'wc-t-lead').running, true);
      await withEnv({ FAKE_LS_ERR: 'server exited unexpectedly' }, async () => {
        const sessions = await listed();
        assert.equal('running' in sessions.find(s => s.name === 'wc-t-lead'), false);
        assert.equal(sessions.some(s => s.name === 'scratch'), false);
      });
      await withEnv({ FAKE_LS_ERR: 'no server running on /tmp/tmux-1000/default' }, async () => {
        assert.equal((await listed()).find(s => s.name === 'wc-t-lead').running, false);
      });
      await withEnv({ FAKE_LS_ERR: 'error connecting to /tmp/tmux-1000/default (Permission denied)' }, async () => {
        assert.equal('running' in (await listed()).find(s => s.name === 'wc-t-lead'), false);
      });
    } finally { await env.close(); }
  });
});
test('a replacement worker is refused while another worker still runs in its worktree', async () => {
  await withEnv({ FAKE_GIT_VERSION: 'wc-t-w1' }, async () => {
    const env = await service(await temp()); try {
      const worktree = path.join(path.dirname(env.state), 'work-shared');
      const first = await start(env, { role: 'worker', cli: 'codex', name: 'wc-t-worker', worktree, branch: 'wc-t-w1' });
      const replace = (name) => api(env, 'POST', '/v1/sessions', { role: 'worker', cli: 'codex', thread_id: 't', token: 'beta', name, worktree, branch: 'wc-t-w1' }, hubHeader);
      await withEnv({ FAKE_SESSIONS: first.name }, async () => {
        const refused = await replace('wc-t-worker-2');
        assert.equal(refused.status, 409); assert.match(refused.body.error, /in use \(wc-t-worker\)/);
      });
      await withEnv({ FAKE_LS_ERR: 'server exited unexpectedly' }, async () => {
        assert.equal((await replace('wc-t-worker-2')).status, 409);
      });
      // Recorded as stopped while tmux still has it (a failed kill) is still in use.
      env.instance.sessions[first.name].status = 'stopped';
      await withEnv({ FAKE_SESSIONS: first.name }, async () => {
        assert.equal((await replace('wc-t-worker-2')).status, 409);
      });
      assert.equal((await replace('wc-t-worker-2')).status, 201);
      await withEnv({ FAKE_SESSIONS: 'wc-t-worker-2' }, async () => {
        const second = await replace('wc-t-worker-3');
        assert.equal(second.status, 409); assert.match(second.body.error, /wc-t-worker-2/);
      });
      await withEnv({ FAKE_SESSIONS: 'wc-t-worker-2' }, async () => {
        const noBranch = await api(env, 'POST', '/v1/sessions', { role: 'worker', cli: 'codex', thread_id: 't', token: 'gamma', name: 'wc-t-worker-4', worktree }, hubHeader);
        assert.equal(noBranch.status, 409);
      });
    } finally { await env.close(); }
  });
});
test('status lists other tmux sessions read-only and typing into them is refused', async () => {
  await withEnv({ FAKE_SESSIONS: 'wc-t-lead scratch' }, async () => {
    const env = await service(await temp()); try {
      await start(env);
      const sessions = (await api(env, 'GET', '/v1/sessions', undefined, hubHeader)).body;
      assert.equal(sessions.find(s => s.name === 'wc-t-lead').managed, true);
      assert.deepEqual(sessions.find(s => s.name === 'scratch'), { name: 'scratch', managed: false, running: true });
      assert.equal((await api(env, 'POST', '/v1/sessions/scratch/keys', { keys: 'C-c' }, hubHeader)).status, 404);
      assert.equal((await api(env, 'POST', '/v1/sessions/scratch/submit', { text: 'x' }, hubHeader)).status, 404);
      assert.equal((await api(env, 'DELETE', '/v1/sessions/scratch', undefined, hubHeader)).status, 404);
      assert.doesNotMatch(await log(env), /kill-session -t scratch|send-keys -t scratch/);
    } finally { await env.close(); }
  });
});
test('a live wc-* tmux session missing from sessions.json is rebuilt and tokenless', async () => {
  await withEnv({ FAKE_SESSIONS: 'wc-abc-worker-2 other' }, async () => {
    const env = await service(await temp()); try {
      const recovered = env.instance.sessions['wc-abc-worker-2'];
      assert.equal(recovered.thread_id, 'abc'); assert.equal(recovered.role, 'worker'); assert.equal(recovered.status, 'ready'); assert.equal(recovered.recovered, true);
      assert.equal(env.instance.sessions.other, undefined);
      assert.equal((await api(env, 'POST', '/v1/sessions/wc-abc-worker-2/keys', { keys: 'C-c' }, hubHeader)).status, 200);
      assert.equal((await api(env, 'GET', '/v1/sessions/wc-abc-worker-2/pane', undefined, hubHeader)).status, 200);
      assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'idea' }, {})).status, 401);
      assert.equal(JSON.parse(await fs.readFile(path.join(env.state, 'sessions.json'), 'utf8'))['wc-abc-worker-2'].recovered, true);
      assert.equal((await api(env, 'DELETE', '/v1/sessions/wc-abc-worker-2', undefined, hubHeader)).status, 200);
    } finally { await env.close(); }
  });
});
test('pane history captures requested scrollback and rejects invalid values', async () => {
  const env = await service(await temp()); try {
    await start(env);
    assert.equal((await api(env, 'GET', '/v1/sessions/wc-t-lead/pane?history=2000', undefined, hubHeader)).status, 200);
    assert.match(await log(env), /tmux capture-pane -p -e -S -2000 -t wc-t-lead/);
    await fs.writeFile(env.fake.log, '');
    assert.equal((await api(env, 'GET', '/v1/sessions/wc-t-lead/pane', undefined, hubHeader)).status, 200);
    assert.doesNotMatch(await log(env), /capture-pane.* -S /);
    for (const value of ['2001', 'abc']) {
      const response = await api(env, 'GET', `/v1/sessions/wc-t-lead/pane?history=${value}`, undefined, hubHeader);
      assert.equal(response.status, 400); assert.deepEqual(response.body, { error: 'history must be 0-2000' });
    }
  } finally { await env.close(); }
});
test('worktree-remove: only a merged, finished worker of the same thread, called by a sub-lead', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const { repo, worktree } = await startedWorktree(env, root, 'wr');
    const common = { thread_id: 'wr', project_dir: repo, project: 'project', default_branch: 'main', serviceWorktree: true };
    const lead = agentHeader('wr-token'); const remove = (header, args) => api(env, 'POST', '/v1/agent/git', { operation: 'worktree-remove', args }, header);
    const worker = await start(env, { ...common, role: 'worker', token: 'w-token' });
    assert.equal((await remove(agentHeader('w-token'), [worker.name])).status, 400);
    env.instance.sessions['wc-wr-lead'].role = 'sub-lead';
    assert.equal((await remove(lead, ['wc-other-worker'])).status, 400);
    assert.equal((await remove(lead, ['wc-wr-lead'])).status, 400);
    await withEnv({ FAKE_SESSIONS: worker.name }, async () => { const r = await remove(lead, [worker.name]); assert.equal(r.status, 400); assert.match(r.body.error, /running/); });
    await write(path.join(worker.worktree, 'w.txt'), 'w\n');
    git(['-C', worker.worktree, 'add', 'w.txt']); git(['-C', worker.worktree, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-m', 'w']);
    const unmerged = await remove(lead, [worker.name]); assert.equal(unmerged.status, 400); assert.match(unmerged.body.error, /not fully merged/);
    await fs.access(worker.worktree);
    git(['-C', worktree, '-c', 'user.name=t', '-c', 'user.email=t@example.test', 'merge', 'wc-wr-w1']);
    const done = await remove(lead, [worker.name]); assert.equal(done.status, 200); assert.equal(done.body.ok, true, JSON.stringify(done.body));
    await assert.rejects(fs.access(worker.worktree));
    assert.equal(env.instance.sessions[worker.name].worktree_removed, true);
  } finally { await env.close(); }
});
test('a Claude session gets the model the hub chose, and none when it chose none', async () => {
  const env = await service(await temp()); try {
    await start(env, { model: 'haiku' }); assert.match(await log(env), /'--model' 'haiku'/);
  } finally { await env.close(); }
  const plain = await service(await temp()); try { await start(plain); assert.doesNotMatch(await log(plain), /--model/); } finally { await plain.close(); }
});
test('Claude login comes from claude auth status', async () => {
  const env = await service(await temp()); const prior = process.env.FAKE_CLAUDE_AUTH; try {
    assert.equal(env.instance.cliStatus('claude').logged_in, true);
    process.env.FAKE_CLAUDE_AUTH = '{"loggedIn":false}';
    assert.equal(env.instance.cliStatus('claude').logged_in, false);
    process.env.FAKE_CLAUDE_AUTH = 'not json';
    assert.equal(env.instance.cliStatus('claude').logged_in, false);
  } finally { if (prior === undefined) delete process.env.FAKE_CLAUDE_AUTH; else process.env.FAKE_CLAUDE_AUTH = prior; await env.close(); }
});

const readyBypass = '⏵⏵ bypass permissions on (shift+tab to cycle)\n❯ Try anything\n';
const bypassWarning = 'WARNING: Claude Code running in Bypass Permissions mode\n❯ 1. No, exit\n  2. Yes, I accept\n';
const argvOf = (env, name = 'wc-t-lead') => env.instance.sessions[name].command;
const flagValue = (argv, flag) => argv[argv.indexOf(flag) + 1];

test('permission_mode: auto by default and when named, bypass maps to bypassPermissions, anything else is refused', async () => {
  const env = await service(await temp()); try {
    await start(env, { thread_id: 'a', token: 'a' });
    assert.equal(flagValue(argvOf(env, 'wc-a-lead'), '--permission-mode'), 'auto');
    assert.equal(env.instance.sessions['wc-a-lead'].permission_mode, 'auto');
    await start(env, { thread_id: 'b', token: 'b', permission_mode: 'auto' });
    assert.equal(flagValue(argvOf(env, 'wc-b-lead'), '--permission-mode'), 'auto');
    env.fake.pane && await fs.writeFile(env.fake.pane, readyBypass);
    await start(env, { thread_id: 'c', token: 'c', permission_mode: 'bypass' });
    assert.equal(flagValue(argvOf(env, 'wc-c-lead'), '--permission-mode'), 'bypassPermissions');
    assert.equal(env.instance.sessions['wc-c-lead'].permission_mode, 'bypass');
    const settings = JSON.parse(await fs.readFile(path.join(env.state, 'settings', 'wc-c-lead.json'), 'utf8'));
    assert.equal(settings.skipDangerousModePermissionPrompt, true);
    const autoSettings = JSON.parse(await fs.readFile(path.join(env.state, 'settings', 'wc-a-lead.json'), 'utf8'));
    assert.equal(autoSettings.skipDangerousModePermissionPrompt, undefined);
    for (const bad of ['bypassPermissions', 'yolo', 5, '']) {
      const result = await api(env, 'POST', '/v1/sessions', { role: 'lead', cli: 'claude', thread_id: 'd', token: 'd', worktree: env.state, permission_mode: bad }, hubHeader);
      assert.equal(result.status, 400, String(bad)); assert.match(result.body.error, /permission_mode/);
    }
    assert.equal(env.instance.sessions['wc-d-lead'], undefined);
  } finally { await env.close(); }
});
test('permission_mode does not change Codex', async () => {
  const env = await service(await temp(), { pane: readyCodex }); try {
    await start(env, { cli: 'codex', role: 'worker', token: 'beta', permission_mode: 'bypass', effort: 'max' });
    const argv = argvOf(env, 'wc-t-worker');
    assert.deepEqual(argv.slice(0, 6), ['codex', '-s', 'workspace-write', '-a', 'never', '-c']);
    assert.ok(!argv.some(a => /bypass|--effort|--permission-mode/.test(a)));
  } finally { await env.close(); }
});
test('codex_mode: sandboxed by default, unrestricted drops the sandbox, reviewers stay read-only, anything else is refused', async () => {
  const env = await service(await temp(), { pane: readyCodex }); try {
    await start(env, { cli: 'codex', role: 'worker', token: 'a', thread_id: 'a' });
    assert.deepEqual(argvOf(env, 'wc-a-worker').slice(0, 7), ['codex', '-s', 'workspace-write', '-a', 'never', '-c', 'sandbox_workspace_write.network_access=true']);
    assert.equal(env.instance.sessions['wc-a-worker'].codex_mode, 'sandboxed');
    await start(env, { cli: 'codex', role: 'worker', token: 'b', thread_id: 'b', codex_mode: 'unrestricted' });
    const free = argvOf(env, 'wc-b-worker');
    assert.deepEqual(free.slice(0, 2), ['codex', '--dangerously-bypass-approvals-and-sandbox']);
    assert.ok(!free.includes('-s') && !free.includes('-a'));
    assert.ok(free.some(a => /^notify=/.test(a)) && free.some(a => /trust_level/.test(a)));
    assert.equal(env.instance.sessions['wc-b-worker'].codex_mode, 'unrestricted');
    await start(env, { cli: 'codex', role: 'reviewer', token: 'c', thread_id: 'c', codex_mode: 'unrestricted' });
    const reviewer = argvOf(env, 'wc-c-reviewer');
    assert.deepEqual(reviewer.slice(0, 5), ['codex', '-s', 'read-only', '-a', 'never']);
    assert.ok(!reviewer.includes('--dangerously-bypass-approvals-and-sandbox'));
    for (const bad of ['yolo', '', 1, null]) {
      const result = await api(env, 'POST', '/v1/sessions', { role: 'worker', cli: 'codex', thread_id: 'd', token: 'd', worktree: env.state, codex_mode: bad }, hubHeader);
      assert.equal(result.status, 400, String(bad)); assert.match(result.body.error, /codex_mode/);
    }
  } finally { await env.close(); }
});
test('codex_mode does not change Claude', async () => {
  const env = await service(await temp()); try {
    await start(env, { thread_id: 'u', token: 'u', codex_mode: 'unrestricted' });
    assert.ok(!argvOf(env, 'wc-u-lead').some(a => /dangerously|sandbox/.test(a)));
  } finally { await env.close(); }
});
test('Codex effort is passed as model_reasoning_effort when set', async () => {
  const env = await service(await temp(), { pane: readyCodex }); try {
    await start(env, { cli: 'codex', role: 'worker', thread_id: 'effort', token: 'effort', effort: 'xhigh' });
    const argv = argvOf(env, 'wc-effort-worker');
    const index = argv.indexOf('model_reasoning_effort=xhigh');
    assert.ok(index > 0);
    assert.deepEqual(argv.slice(index - 1, index + 1), ['-c', 'model_reasoning_effort=xhigh']);
  } finally { await env.close(); }
});
test('Codex without effort has no model_reasoning_effort setting', async () => {
  const env = await service(await temp(), { pane: readyCodex }); try {
    await start(env, { cli: 'codex', role: 'worker', thread_id: 'noeffort', token: 'noeffort' });
    assert.ok(!argvOf(env, 'wc-noeffort-worker').some(a => a.startsWith('model_reasoning_effort')));
  } finally { await env.close(); }
});
test('a bypass session is ready on the bypass status line, not on the auto one, and an auto session the reverse', async () => {
  const env = await service(await temp(), { pane: readyBypass }); try {
    const bypass = await start(env, { thread_id: 'x', token: 'x', permission_mode: 'bypass' });
    assert.equal(bypass.status, 'ready');
    const auto = await start(env, { thread_id: 'y', token: 'y' });
    assert.equal(auto.status, 'starting');
    await fs.writeFile(env.fake.pane, readyClaude);
    const other = await start(env, { thread_id: 'z', token: 'z', permission_mode: 'bypass' });
    assert.equal(other.status, 'starting');
  } finally { await env.close(); }
});
test('a Bypass Permissions confirmation is answered Down then Enter, and the session is not ready until it clears', async () => {
  const env = await service(await temp(), { pane: bypassWarning }); try {
    const session = await start(env, { permission_mode: 'bypass' });
    assert.equal(session.status, 'starting');
    const calls = await log(env);
    assert.match(calls, /send-keys -t wc-t-lead Down\nbash|send-keys -t wc-t-lead Down/);
    assert.match(calls, /send-keys -t wc-t-lead Enter/);
    await fs.writeFile(env.fake.pane, readyBypass);
    assert.equal(await env.instance.checkReady(env.instance.sessions['wc-t-lead']), true);
  } finally { await env.close(); }
});
test('effort adds --effort for Claude and is refused when unknown', async () => {
  const env = await service(await temp()); try {
    for (const effort of ['low', 'medium', 'high', 'xhigh', 'max']) {
      await start(env, { thread_id: `e${effort}`, token: effort, effort });
      assert.equal(flagValue(argvOf(env, `wc-e${effort}-lead`), '--effort'), effort);
    }
    await start(env, { thread_id: 'none', token: 'none' });
    assert.ok(!argvOf(env, 'wc-none-lead').includes('--effort'));
    const bad = await api(env, 'POST', '/v1/sessions', { role: 'lead', cli: 'claude', thread_id: 'bad', token: 'bad', worktree: env.state, effort: 'ultra' }, hubHeader);
    assert.equal(bad.status, 400); assert.match(bad.body.error, /effort/);
  } finally { await env.close(); }
});
test('composed prompts, provider pointers, and ledger', async () => {
  const env = await service(await temp()); try {
    const root = path.resolve(__dirname, '../..');
    const names = ['Artifact','Workflow','ScheduleWakeup','SendFeedback','ShareOnboardingGuide','ReportFindings','ListAgents','ArtifactComments','ArtifactData','CronCreate','CronDelete','CronList','RemoteTrigger','PushNotification','PublishPlugin','DesignSync','EnterWorktree','ExitWorktree','EnterPlanMode','ExitPlanMode','AskUserQuestion','EndConversation'];
    for (const role of ['lead', 'sub-lead', 'worker', 'mapper', 'reviewer', 'verifier']) {
      const session = await start(env, { role, thread_id: role, role_layers: '  final layer  ' });
      const file = path.join(env.state, 'prompts', `${session.name}.md`), prompt = await fs.readFile(file, 'utf8');
      const cards = !['reviewer', 'verifier'].includes(role);
      assert.ok(prompt.startsWith(`Role: ${role}\nYour role rules${cards ? ' and card rules' : ''} are below, already loaded: do not read these files again unless this text is no longer in your context. \`<root>\` is \`${root}\`.`));
      assert.ok(prompt.includes((await fs.readFile(path.join(root, 'protocol/app', `${role}.md`), 'utf8')).trimEnd()));
      assert.equal(prompt.includes('--- cards.md ---'), cards);
      assert.equal(prompt.includes('--- cards-lead.md ---'), role === 'lead');
      assert.ok(prompt.endsWith('\n\nfinal layer'));
      assert.equal(flagValue(session.command, '--append-system-prompt-file'), file);
      assert.equal(flagValue(session.command, '--disallowedTools'), names.join(','));
      for (const flag of ['--append-system-prompt', '--strict-mcp-config', '--disable-slash-commands']) assert.ok(!session.command.includes(flag));
      if (role === 'lead') { assert.ok(Buffer.byteLength(prompt) > 30000); assert.ok(session.command.join(' ').length < 8192); }
    }
    const custom = await start(env, { thread_id: 'custom', role_prompt: 'custom prompt', role_layers: 'ignored' });
    assert.equal(await fs.readFile(path.join(env.state, 'prompts', `${custom.name}.md`), 'utf8'), 'Role: lead\ncustom prompt');
    const ledger = (await fs.readFile(path.join(env.state, 'session-ledger.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(ledger.length, 7); assert.deepEqual(Object.keys(ledger[0]), ['at','name','role','provider','model','account_dir','cli_session_id','thread_id']);
    assert.equal(ledger[0].account_dir, null); assert.equal(ledger[0].provider, 'claude');
    await fs.unlink(path.join(env.state, 'session-ledger.jsonl')); await fs.mkdir(path.join(env.state, 'session-ledger.jsonl'));
    await start(env, { thread_id: 'ledger-error' });
    const bad = await api(env, 'POST', '/v1/sessions', { role: 'lead', cli: 'claude', thread_id: 'bad', token: 'bad', worktree: env.state, role_layers: 5 }, hubHeader); assert.equal(bad.status, 400);
  } finally { await env.close(); }
});
test('Codex and Antigravity first messages point to prompt files', async () => {
  for (const cli of ['codex', 'agy']) {
    const env = await service(await temp(), { pane: cli === 'codex' ? readyCodex : '? for shortcuts' }); try {
      const brief = 'x'.repeat(100000);
      const session = await start(env, { cli, role: 'worker', brief });
      const message = env.instance.sessions[session.name].pending_initial || await log(env);
      const pointer = `[wc:role] Role: worker\nRead ${path.join(env.state, 'prompts', `${session.name}.md`)} before responding: it holds your role rules and card rules. Read it again only if it is no longer in your context.\n\n${brief}`;
      assert.ok(message.includes(pointer)); assert.ok(pointer.length - brief.length < 1000);
    } finally { await env.close(); }
  }
});
test('prompt failures precede worktree creation and permit retry', async () => {
  const root = await temp(), env = await service(root, { realGit: true }); try {
    const repo = await project(root);
    const body = { role: 'worker', cli: 'claude', thread_id: 'failure', token: 'x', project_dir: repo, project: 'project', name: 'wc-failure-worker' };
    const originalRead = require('node:fs').readFileSync;
    require('node:fs').readFileSync = function(file, ...args) { if (String(file).endsWith('/protocol/app/worker.md')) throw new Error(`missing ${file}`); return originalRead.call(this, file, ...args); };
    try { const result = await api(env, 'POST', '/v1/sessions', body, hubHeader); assert.notEqual(result.status, 201); assert.match(result.body.error, /worker.md/); } finally { require('node:fs').readFileSync = originalRead; }
    await fs.mkdir(path.join(env.state, 'prompts', 'wc-failure-worker.md'), { recursive: true });
    assert.notEqual((await api(env, 'POST', '/v1/sessions', body, hubHeader)).status, 201);
    assert.equal(git(['-C', repo, 'worktree', 'list', '--porcelain']).stdout.match(/^worktree /gm).length, 1);
    assert.equal(git(['-C', repo, 'branch', '--list', 'wc-failure*']).stdout.trim(), '');
    await fs.rmdir(path.join(env.state, 'prompts', 'wc-failure-worker.md'));
    assert.equal((await api(env, 'POST', '/v1/sessions', body, hubHeader)).status, 201);
  } finally { await env.close(); }
});

async function withEnv(values, body) {
  const prior = {}; for (const key of Object.keys(values)) { prior[key] = process.env[key]; process.env[key] = values[key]; }
  try { return await body(); } finally { for (const key of Object.keys(values)) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key]; } }
}
test('/v1/preview runs claude -p with the prompt on stdin and returns trimmed stdout', async () => {
  const env = await service(await temp()); try {
    const result = await withEnv({ FAKE_PREVIEW_OUT: '  rewritten sample  ' }, () => api(env, 'POST', '/v1/preview', { prompt: 'rewrite this', model: 'claude-haiku-5-5' }, hubHeader));
    assert.equal(result.status, 200); assert.deepEqual(result.body, { text: 'rewritten sample' });
    const calls = await log(env);
    assert.match(calls, /claude -p --model claude-haiku-5-5 --permission-mode dontAsk/);
    assert.match(calls, /lane=1/);
    assert.equal(await fs.readFile(`${env.fake.log}.stdin`, 'utf8'), 'rewrite this');
  } finally { await env.close(); }
});
test('/v1/preview refuses a bad request, a session token, and reports a non-zero exit with the last stderr line', async () => {
  const env = await service(await temp()); try {
    assert.equal((await api(env, 'POST', '/v1/preview', { prompt: 'x', model: 'm' }, { 'x-wheelchair-session-token': 'alpha' })).status, 401);
    assert.equal((await api(env, 'POST', '/v1/preview', { prompt: 'x' }, hubHeader)).status, 400);
    assert.equal((await api(env, 'POST', '/v1/preview', { prompt: 'x', model: '--bad flag' }, hubHeader)).status, 400);
    assert.equal((await api(env, 'POST', '/v1/preview', { prompt: '  ', model: 'm' }, hubHeader)).status, 400);
    let result = await withEnv({ FAKE_PREVIEW_EXIT: '3', FAKE_PREVIEW_ERR: 'first\nNot logged in' }, () => api(env, 'POST', '/v1/preview', { prompt: 'x', model: 'm' }, hubHeader));
    assert.equal(result.status, 502); assert.deepEqual(result.body, { error: 'Not logged in' });
    result = await withEnv({ FAKE_PREVIEW_EXIT: '4' }, () => api(env, 'POST', '/v1/preview', { prompt: 'x', model: 'm' }, hubHeader));
    assert.equal(result.status, 502); assert.deepEqual(result.body, { error: 'claude exited 4' });
  } finally { await env.close(); }
});
test('/v1/preview times out with 504 without blocking the service, and reports claude not installed with 503', async () => {
  const env = await service(await temp()); try {
    env.instance.previewTimeoutMs = 300;
    const slow = withEnv({ FAKE_PREVIEW_SLEEP: '5' }, () => api(env, 'POST', '/v1/preview', { prompt: 'x', model: 'm' }, hubHeader));
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal((await api(env, 'GET', '/health')).status, 200); // the loop is free while the preview waits
    const result = await slow;
    assert.equal(result.status, 504); assert.deepEqual(result.body, { error: 'preview timed out after 60 s' });
    const missing = await withEnv({ PATH: '/nonexistent-wheelchair-test' }, () => api(env, 'POST', '/v1/preview', { prompt: 'x', model: 'm' }, hubHeader));
    assert.equal(missing.status, 503); assert.deepEqual(missing.body, { error: 'claude is not installed' });
  } finally { await env.close(); }
});

test('account starts bind the CLI environment, validate directories, and report account status', async () => {
  const root = await temp(); const oldHome = process.env.HOME; process.env.HOME = root;
  const env = await service(root);
  try {
    for (const [cli, variable, id] of [['claude', 'CLAUDE_CONFIG_DIR', 'one'], ['codex', 'CODEX_HOME', 'two']]) {
      await start(env, { cli, thread_id: id, account: { id, dir: `~/.wheelchair/accounts/${id}` } });
      assert.match(await log(env), new RegExp(`${variable}=${root}/\\.wheelchair/accounts/${id}`));
    }
    const defaultSession = await start(env, { thread_id: 'default' });
    assert.equal(defaultSession.account, 'default-claude');
    const invalid = await api(env, 'POST', '/v1/sessions', { role: 'lead', cli: 'claude', thread_id: 'bad', token: 'x', worktree: root, account: { id: 'bad', dir: '~/elsewhere/bad' } }, hubHeader);
    assert.equal(invalid.status, 400);
    const status = await api(env, 'GET', '/v1/status', undefined, hubHeader);
    assert.deepEqual(status.body.accounts.map(a => a.id).sort(), ['default-claude', 'default-gemini', 'default-gpt', 'one', 'two']);
    const preflight = await api(env, 'POST', '/v1/preflight', { dir: '~/elsewhere/bad' }, hubHeader); assert.equal(preflight.status, 400);
  } finally { await env.close(); process.env.HOME = oldHome; }
});

test('usage and failures are forwarded with account and limit time', async () => {
  const root = await temp(); const hub = await hubServer(); const env = await service(root, { config: { hub_url: hub.url } });
  try {
    const session = await start(env);
    const headers = { 'x-wheelchair-session-token': 'alpha' };
    await api(env, 'POST', '/v1/agent/hooks', { type: 'usage-source', payload: { rate_limits: { five_hour: { used_percentage: 100, resets_at: 2000000000 }, seven_day: { used_percentage: 40, resets_at: 2100000000 } } } }, headers);
    await api(env, 'POST', '/v1/agent/hooks', { type: 'limit-hit', error: 'rate_limit' }, headers);
    await api(env, 'POST', '/v1/agent/hooks', { type: 'turn-failed', error: 'broken' }, headers);
    const events = hub.calls.map(c => JSON.parse(c.body)).filter(x => x.session === session.name);
    assert.equal(events.find(e => e.type === 'usage').reading.account, 'default-claude');
    assert.equal(events.find(e => e.type === 'limit-hit').limited_until, new Date(2000000000 * 1000).toISOString());
    assert.equal(events.find(e => e.type === 'turn-failed').error, 'broken');
  } finally { await env.close(); await hub.close(); }
});

test('statusline posts a live reading and preflight accepts an account directory', async () => {
  const root = await temp(); const oldHome = process.env.HOME; process.env.HOME = root;
  const hub = await hubServer(); const env = await service(root, { config: { hub_url: hub.url } });
  try {
    await start(env);
    const payload = JSON.stringify({ model: { display_name: 'opus' }, rate_limits: { five_hour: { used_percentage: 42, resets_at: 2000000000 } } });
    const child = spawn(path.join(__dirname, '../statusline.sh'), ['claude', 'wc-t-lead'], { env: { ...process.env, WHEELCHAIR_STATE_DIR: env.state, WHEELCHAIR_SESSION_TOKEN: 'alpha' }, stdio: ['pipe', 'pipe', 'pipe'] });
    trackChild(child);
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stdin.end(payload);
    assert.equal(await new Promise(resolve => child.on('close', resolve)), 0);
    assert.equal(output.trim(), 'opus · 5h 42%');
    const second = spawn(path.join(__dirname, '../statusline.sh'), ['claude', 'wc-t-lead'], { env: { ...process.env, WHEELCHAIR_STATE_DIR: env.state, WHEELCHAIR_SESSION_TOKEN: 'alpha' }, stdio: ['pipe', 'pipe', 'pipe'] });
    trackChild(second);
    second.stdin.end(payload);
    assert.equal(await new Promise(resolve => second.on('close', resolve)), 0);
    assert.equal(hub.calls.map(c => JSON.parse(c.body)).filter(e => e.type === 'usage').length, 1);
    assert.equal(hub.calls.map(c => JSON.parse(c.body)).find(e => e.type === 'usage').reading.five_hour.used, 42);
    const dir = path.join(root, '.wheelchair/accounts/test'); await write(path.join(dir, 'auth.json'), '{}');
    const preflight = await api(env, 'POST', '/v1/preflight', { dir: '~/.wheelchair/accounts/test' }, hubHeader);
    assert.equal(preflight.status, 200); assert.ok((await fs.stat(path.join(dir, '.wheelchair-refresh.lock'))).isFile());
  } finally { await env.close(); await hub.close(); process.env.HOME = oldHome; }
});
test('login sessions start, expose state, accept code and stay out of session recovery', async () => {
  const root = await temp(), previous = process.env.HOME; process.env.HOME = root;
  const env = await service(root); try {
    const started = await api(env, 'POST', '/v1/logins', { account: 'test', cli: 'claude', dir: '~/.wheelchair/accounts/test' }, hubHeader);
    assert.equal(started.status, 201); const cmd = await log(env); assert.doesNotMatch(cmd.split('\n').find(line => line.includes('new-session') && line.includes('wc-login-test')), / -c /); assert.match(cmd, /CLAUDE_CONFIG_DIR=/); assert.match(cmd, /auth.*login/); assert.doesNotMatch(cmd, /WHEELCHAIR_SESSION_TOKEN/);
    await write(env.fake.pane, 'starting'); assert.equal((await api(env, 'GET', '/v1/logins/test', undefined, hubHeader)).body.state, 'starting');
    await write(env.fake.pane, await fs.readFile(path.join(__dirname, 'fixtures/login/claude.txt'), 'utf8'));
    assert.equal((await api(env, 'GET', '/v1/logins/test', undefined, hubHeader)).body.state, 'waiting');
    assert.equal((await api(env, 'POST', '/v1/logins/test/code', { code: 'test-code' }, hubHeader)).status, 200);
    assert.match(await log(env), /test-code[\s\S]*send-keys -t wc-login-test Enter/);
    await write(env.fake.pane, '__wc_login_exit 0'); assert.equal((await api(env, 'GET', '/v1/logins/test', undefined, hubHeader)).body.state, 'done');
    process.env.FAKE_CLAUDE_AUTH = '{"loggedIn":false}'; assert.equal((await api(env, 'GET', '/v1/logins/test', undefined, hubHeader)).body.state, 'failed'); delete process.env.FAKE_CLAUDE_AUTH;
    process.env.FAKE_SESSIONS = 'wc-login-test'; await env.instance.recoverFromTmux(); assert.equal(env.instance.sessions['wc-login-test'], undefined);
    assert.equal((await api(env, 'GET', '/v1/sessions', undefined, hubHeader)).body.some(s => s.name === 'wc-login-test'), false);
    assert.equal((await api(env, 'POST', '/v1/logins', { account: 'test', cli: 'claude', dir: '~/bad/test' }, hubHeader)).status, 400);
    assert.equal((await api(env, 'POST', '/v1/logins', { account: 'default-gpt', cli: 'codex', dir: null }, hubHeader)).status, 201);
    const codexCommand = (await log(env)).split('\n').find(line => line.includes('new-session') && line.includes('wc-login-default-gpt'));
    assert.doesNotMatch(codexCommand, / -c \/[^ ]/); assert.match(codexCommand, /codex.*login.*--device-auth/); assert.doesNotMatch(codexCommand, /WHEELCHAIR_SESSION_TOKEN/);
    assert.equal((await api(env, 'POST', '/v1/logins', { account: 'other', cli: 'codex', dir: '~/.wheelchair/accounts/other' }, hubHeader)).status, 201);
    assert.match(await log(env), /CODEX_HOME=.*accounts\/other/);
  } finally { delete process.env.FAKE_SESSIONS; delete process.env.FAKE_CLAUDE_AUTH; if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous; await env.close(); }
});
test('Claude login menu is answered once across repeated login state reads', async () => {
  const root = await temp(), previous = process.env.HOME; process.env.HOME = root;
  const env = await service(root); try {
    const started = await api(env, 'POST', '/v1/logins', { account: 'menu', cli: 'claude', dir: '~/.wheelchair/accounts/menu' }, hubHeader);
    assert.equal(started.status, 201);
    await write(env.fake.pane, await fs.readFile(path.join(__dirname, 'fixtures/login/claude-menu.txt'), 'utf8'));
    const first = await api(env, 'GET', '/v1/logins/menu', undefined, hubHeader);
    assert.equal(first.body.state, 'starting');
    await api(env, 'GET', '/v1/logins/menu', undefined, hubHeader);
    const commands = (await log(env)).split('\n').filter(line => line.includes('send-keys -t wc-login-menu Enter'));
    assert.equal(commands.length, 1);
    await write(env.fake.pane, await fs.readFile(path.join(__dirname, 'fixtures/login/claude.txt'), 'utf8'));
    assert.equal((await api(env, 'GET', '/v1/logins/menu', undefined, hubHeader)).body.state, 'waiting');
  } finally { if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous; await env.close(); }
});
test('default Claude start preserves complete command and settings', async () => {
  const root = await temp(), env = await service(root); try {
    const session = await start(env, { cli_session_id: 'fixed', role_prompt: 'role' });
    const settingsPath = path.join(env.state, 'settings', 'wc-t-lead.json');
    assert.equal(flagValue(session.command, '--append-system-prompt-file'), path.join(env.state, 'prompts', 'wc-t-lead.md'));
    assert.equal(await fs.readFile(flagValue(session.command, '--append-system-prompt-file'), 'utf8'), 'Role: lead\nrole');
    const hook = `'${path.resolve(__dirname, '../hook.sh')}' claude 'wc-t-lead'`;
    const entry = [{ hooks: [{ type: 'command', command: hook }] }];
    assert.deepEqual(JSON.parse(await fs.readFile(settingsPath, 'utf8')), { cleanupPeriodDays: 30, promptSuggestionEnabled: false, hooks: { Stop: entry, Notification: entry, StopFailure: entry, ...Object.fromEntries(['PreToolUse', 'PostToolUse', 'PostToolUseFailure'].map(name => [name, [{ matcher: '*', hooks: [{ type: 'command', command: hook, async: true }] }]])) }, statusLine: { type: 'command', command: `'${path.resolve(__dirname, '../statusline.sh')}' claude 'wc-t-lead'` } });
    const expected = ['env', 'WHEELCHAIR_LANE=1', 'WHEELCHAIR_SESSION_TOKEN=alpha', `WHEELCHAIR_STATE_DIR=${env.state}`, `WHEELCHAIR_MACHINE_ORIGIN=http://127.0.0.1:${env.instance.config.port}`, ...session.command].map(x => `'${x}'`).join(' ');
    assert.ok((await log(env)).includes(`tmux new-session -d -s wc-t-lead -x 200 -y 50 -c ${session.worktree} ${expected}`));
  } finally { await env.close(); }
});
test('Codex account turn ends read only new rollout lines and report limits', async () => {
  const root = await temp(), previous = process.env.HOME; process.env.HOME = root;
  const hub = await hubServer(), env = await service(root, { config: { hub_url: hub.url } });
  try {
    const session = await start(env, { cli: 'codex', account: { id: 'acct', dir: '~/.wheelchair/accounts/acct' } });
    const file = path.join(root, '.wheelchair/accounts/acct/sessions/2026/rollout-abc.jsonl');
    const line = (used, reached = null) => JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', payload: { rate_limits: { primary: { used_percent: used, window_minutes: 300, resets_at: 2100000000 }, rate_limit_reached_type: reached } } }) + '\n';
    await write(file, line(20));
    const event = { type: 'turn-ended', 'thread-id': 'abc', 'input-messages': ['[wc:role] hi'] };
    await env.instance.hook(session.name, event); await env.instance.hook(session.name, event);
    await fs.appendFile(file, line(100, 'primary')); await env.instance.hook(session.name, event);
    const events = hub.calls.map(c => JSON.parse(c.body));
    const ends = events.filter(e => e.type === 'turn-ended');
    assert.equal(events.filter(e => e.type === 'usage').length, 0); assert.equal(ends.length, 3);
    assert.equal(ends[0].reading.account, 'acct'); assert.equal(ends[0].reading.five_hour.used, 20); assert.equal(ends[2].reading.limited_until, new Date(2100000000 * 1000).toISOString());
  } finally { await env.close(); await hub.close(); if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous; }
});

test('spooled Codex turn end carries its limit reading on drain', async () => {
  const root = await temp(), previous = process.env.HOME; process.env.HOME = root;
  const first = await service(root); await start(first, { cli: 'codex', account: { id: 'acct', dir: '~/.wheelchair/accounts/acct' } }); await first.close();
  try {
    const state = path.join(root, 'state');
    const configured = JSON.parse(await fs.readFile(path.join(state, 'machine.json'), 'utf8'));
    await write(path.join(state, 'machine.json'), JSON.stringify({ ...configured, host: '127.0.0.1', port: 1 }));
    await write(path.join(root, '.wheelchair/accounts/acct/sessions/2026/rollout-abc.jsonl'), JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', payload: { rate_limits: { primary: { used_percent: 100, window_minutes: 300, resets_at: 2100000000 }, rate_limit_reached_type: 'primary' } } }) + '\n');
    const hook = path.join(process.cwd(), 'machine', 'hook.sh');
    const result = spawnSync(hook, ['codex', 'wc-t-lead', JSON.stringify({ type: 'agent-turn-complete', 'thread-id': 'abc', 'input-messages': ['[wc:role] hi'] })], { encoding: 'utf8', env: { ...process.env, WHEELCHAIR_STATE_DIR: state, WHEELCHAIR_SESSION_TOKEN: 'alpha' } });
    assert.equal(result.status, 0);
    const hub = await hubServer(), env = await service(root, { config: { hub_url: hub.url } });
    try {
      await env.instance.drainSpool('events');
      const events = hub.calls.map(c => JSON.parse(c.body));
      const ends = events.filter(e => e.type === 'turn-ended');
      assert.equal(ends.length, 1); assert.equal(ends[0].reading.limited_until, new Date(2100000000 * 1000).toISOString());
      assert.equal(events.filter(e => e.type === 'usage').length, 0);
    } finally { await env.close(); await hub.close(); }
  } finally { if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous; }
});

for (const source of ['raw spool', 'live hook']) {
  test(`Codex ${source} retries the same prepared reading`, async () => {
    const root = await temp(), previous = process.env.HOME; process.env.HOME = root;
    const hub = await hubServer(), env = await service(root, { pane: readyCodex, config: { hub_url: hub.url } });
    try {
      const session = await start(env, { cli: 'codex', account: { id: 'acct', dir: '~/.wheelchair/accounts/acct' } });
      const rollout = path.join(root, '.wheelchair/accounts/acct/sessions/2026/rollout-abc.jsonl');
      const line = (used, reset) => JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', payload: { rate_limits: { primary: { used_percent: used, window_minutes: 300, resets_at: reset }, rate_limit_reached_type: 'primary' } } }) + '\n';
      await write(rollout, line(100, 2100000000));
      const event = { type: 'turn-ended', 'thread-id': 'abc', 'input-messages': ['[wc:role] hi'] };
      hub.setStatus(503);
      const dir = path.join(env.state, 'spool', 'events');
      if (source === 'raw spool') {
        await write(path.join(dir, '000000000000001-12345678-1234-1234-1234-123456789abc.json'), JSON.stringify({ ...event, session: session.name }) + '\n');
        await env.instance.drainSpool('events');
      } else {
        await env.instance.hook(session.name, event);
      }
      const files = await fs.readdir(dir); assert.equal(files.length, 1);
      const stored = JSON.parse(await fs.readFile(path.join(dir, files[0]), 'utf8'));
      assert.equal(stored.prepared, true);
      assert.equal(stored.reading.limited_until, new Date(2100000000 * 1000).toISOString());
      await fs.appendFile(rollout, line(100, 2200000000));
      hub.setStatus(200); await env.instance.drainSpool('events');
      const ends = hub.calls.filter(c => c.path.endsWith('/events')).map(c => JSON.parse(c.body)).filter(e => e.type === 'turn-ended');
      assert.equal(ends.length, 2); assert.deepEqual(ends[0], ends[1]);
      assert.equal(ends[1].reading.limited_until, new Date(2100000000 * 1000).toISOString());
      assert.equal(Object.hasOwn(ends[0], 'prepared'), false);
      assert.deepEqual(await fs.readdir(dir), []);
    } finally { await env.close(); await hub.close(); if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous; }
  });
}
test('/v1/projects lists git folders, expands ~, and checks paths', async () => {
  const root = await temp(); const env = await service(root); const home = path.join(root, 'home'); const code = path.join(home, 'code');
  try {
    await fs.mkdir(path.join(code, 'alpha', '.git'), { recursive: true });
    await write(path.join(code, 'filegit', '.git'), 'gitdir: x\n');
    await fs.mkdir(path.join(code, 'plain'), { recursive: true });
    await fs.mkdir(path.join(code, '.hidden', '.git'), { recursive: true });
    await fs.mkdir(path.join(code, 'bad name', '.git'), { recursive: true });
    await fs.mkdir(path.join(code, 'a..b', '.git'), { recursive: true });
    await write(path.join(code, 'afile'), 'x');
    await fs.mkdir(path.join(root, 'elsewhere', '.git'), { recursive: true });
    await fs.symlink(path.join(root, 'elsewhere'), path.join(code, 'linked'));
    await withEnv({ HOME: home }, async () => {
      const get = query => api(env, 'GET', `/v1/projects?${query}`, undefined, hubHeader);
      const listed = await get(`folder=${encodeURIComponent('~/code')}`);
      assert.equal(listed.status, 200);
      assert.deepEqual(listed.body, { found: ['alpha', 'filegit', 'linked'].map(name => ({ name, path: path.join(code, name) })) });
      assert.equal((await get('folder=~')).body.found.length, 0);
      assert.deepEqual((await get(`folder=${encodeURIComponent(path.join(code, 'nope'))}`)).body, { found: [], folder_error: 'does not exist' });
      assert.deepEqual((await get(`folder=${encodeURIComponent(path.join(code, 'afile'))}`)).body, { found: [], folder_error: 'is not a directory' });
      assert.equal((await get('folder=relative/dir')).status, 400);
      assert.equal((await get('folder=~root')).status, 400);
      assert.equal((await get('')).status, 400);
      assert.equal((await api(env, 'GET', '/v1/projects?folder=~', undefined, {})).status, 401);
      const check = async value => (await get(`check=${encodeURIComponent(value)}`)).body.checked;
      assert.deepEqual(await check('~/code/alpha'), { path: path.join(code, 'alpha'), ok: true });
      assert.deepEqual(await check(path.join(code, 'filegit')), { path: path.join(code, 'filegit'), ok: true });
      assert.equal((await check(path.join(code, 'plain'))).reason, 'is not a git repository');
      assert.equal((await check(path.join(code, 'nope'))).reason, 'does not exist');
      assert.equal((await check(path.join(code, 'afile'))).reason, 'is not a directory');
      assert.equal((await check('rel/path')).reason, 'must be an absolute path');
      assert.deepEqual(await check('~root/x'), { path: '~root/x', ok: false, reason: 'must be an absolute path' });
      assert.equal((await check(path.join(code, 'bad name'))).reason, "has characters a thread can't use in its name");
      const both = (await get(`folder=${encodeURIComponent(code)}&check=~/code/alpha`)).body;
      assert.ok(both.found && both.checked.ok);
      assert.equal('checked' in listed.body, false);
    });
  } finally { await env.close(); }
});

test('a vouched upload is admitted without a lead session, but not for a closing or archived thread', async () => {
  const env = await service(await temp());
  const upload = (id, pending) => fetch(`${env.base}/v1/uploads?thread_id=${id}&name=x${pending ? '&vouched=1' : ''}`, { method: 'POST', headers: hubHeader, body: 'hi' });
  try {
    assert.equal((await upload('w', false)).status, 409);
    assert.equal((await upload('w', true)).status, 201);
    await start(env);
    env.instance.sessions['wc-t-lead'].status = 'stopped';
    assert.equal((await upload('t', false)).status, 409);
    assert.equal((await upload('t', true)).status, 201);
    env.instance.closingThreads.set('w', 1);
    assert.equal((await upload('w', true)).status, 409);
    env.instance.closingThreads.delete('w');
    assert.equal((await api(env, 'POST', '/v1/archive', { thread_id: 'w' }, hubHeader)).body.uploads_removed, true);
    assert.equal((await upload('w', true)).status, 409);
    await assert.rejects(fs.stat(path.join(env.state, 'uploads', 'w')), { code: 'ENOENT' });
  } finally { await env.close(); }
});

test('uploads sanitize, stream, serve, and enforce admission and size', async () => {
  const env = await service(await temp());
  const upload = async (name, body = 'hello') => fetch(`${env.base}/v1/uploads?thread_id=t&name=${encodeURIComponent(name)}`, { method: 'POST', headers: hubHeader, body });
  try {
    assert.equal((await upload('x')).status, 409);
    await start(env);
    for (const [name, expected] of [['name', '1-name'], ['name', '2-name'], ['...é x.txt', '3---x.txt'], ['...', '4-file'], ['a'.repeat(116) + '.png', `5-${'a'.repeat(96)}.png`]]) {
      const r = await upload(name); assert.equal(r.status, 201); assert.equal(path.basename((await r.json()).path), expected);
    }
    const dir = path.join(env.state, 'uploads', 't');
    const over = await upload('huge', Buffer.alloc(25 * 1024 * 1024 + 1)); assert.equal(over.status, 413);
    assert.equal((await fs.readdir(dir)).length, 5);
    await write(path.join(dir, '6-image.png'), 'png');
    let r = await fetch(`${env.base}/v1/uploads/t/6-image.png`, { headers: hubHeader });
    assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal(await r.text(), 'png');
    r = await fetch(`${env.base}/v1/uploads/t/3---x.txt`, { headers: hubHeader }); assert.equal(r.headers.get('content-type'), 'application/octet-stream'); assert.equal(r.headers.get('content-disposition'), 'attachment'); await r.text();
    assert.equal((await fetch(`${env.base}/v1/uploads/t/1-missing`, { headers: hubHeader })).status, 404);
    assert.equal((await fetch(`${env.base}/v1/uploads/t/bad`, { headers: hubHeader })).status, 400);
    env.instance.sessions['wc-t-lead'].archived_pending = true; assert.equal((await upload('x')).status, 409);
    env.instance.sessions['wc-t-lead'].archived_pending = false; env.instance.sessions['wc-t-lead'].status = 'stopped'; assert.equal((await upload('x')).status, 409);
    const archived = await api(env, 'POST', '/v1/archive', { thread_id: 't' }, hubHeader); assert.equal(archived.body.uploads_removed, true); await assert.rejects(fs.stat(dir), { code: 'ENOENT' });
  } finally { await env.close(); }
});

test('image cards are validated and copied before spooling, including archive ordering', async () => {
  const root = await temp(); const env = await service(root); const headers = { 'x-wheelchair-session-token': 'alpha' };
  try {
    await start(env); const png = path.join(root, 'picture.PNG'); await write(png, 'image'); const txt = path.join(root, 'picture.txt'); await write(txt, 'text');
    const relative = await api(env, 'POST', '/v1/agent/cards', { kind: 'image', path: 'shot.png', title: 'x' }, headers);
    assert.equal(relative.status, 422); assert.match(JSON.stringify(relative.body), /image path must be absolute/);
    assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 0);
    await assert.rejects(fs.stat(path.join(env.state, 'uploads', 't')), { code: 'ENOENT' });
    assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'image', path: txt, title: 'x' }, headers)).status, 422);
    assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 0);
    assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'image', path: png, title: 'x' }, headers)).status, 202);
    const spool = await fs.readdir(path.join(env.state, 'spool', 'cards')); const card = JSON.parse(await fs.readFile(path.join(env.state, 'spool', 'cards', spool[0]), 'utf8'));
    assert.equal(await fs.readFile(card.path, 'utf8'), 'image'); assert.notEqual(card.path, png);
    let release, entered; const gate = new Promise(r => { release = r; }); const started = new Promise(r => { entered = r; });
    env.instance.options.beforeImageLock = async () => { entered(); await gate; };
    const late = api(env, 'POST', '/v1/agent/cards', { kind: 'image', path: png, title: 'late' }, headers); await started;
    assert.equal((await api(env, 'POST', '/v1/archive', { thread_id: 't' }, hubHeader)).body.uploads_removed, true); release(); assert.equal((await late).status, 409);
    await assert.rejects(fs.stat(path.join(env.state, 'uploads', 't')), { code: 'ENOENT' });
  } finally { await env.close(); }
});

test('archive cancels a paused upload before acquiring the lock', async () => {
  const env = await service(await temp()); try {
    await start(env); let began; const started = new Promise(r => { began = r; });
    const upload = new Promise(resolve => {
      const req = http.request(`${env.base}/v1/uploads?thread_id=t&name=slow`, { method: 'POST', headers: hubHeader }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', () => resolve('dropped')); req.write('partial');
      const poll = setInterval(() => { if (env.instance.uploadRequests.get('t')?.size) { clearInterval(poll); began(); } }, 5);
    });
    await started; const at = Date.now(); const result = await api(env, 'POST', '/v1/archive', { thread_id: 't' }, hubHeader);
    assert.ok(Date.now() - at < 5000); assert.equal(result.body.uploads_removed, true); assert.ok([409, 'dropped'].includes(await upload));
    await assert.rejects(fs.stat(path.join(env.state, 'uploads', 't')), { code: 'ENOENT' });
  } finally { await env.close(); }
});


test('a retained non-rebase session cannot post an image after archive', async () => {
  const root = await temp(); const env = await service(root); try {
    const session = await start(env); const record = env.instance.sessions[session.name];
    record.created_worktree = true; env.instance.mergeInProgress = () => false; env.instance.rebaseInProgress = () => false;
    // Force a non-rebase retention without relying on a real checkout.
    env.instance.archiveCommit = () => ({ ok: false, reason: 'cannot commit' });
    env.instance.mergeInProgress = () => true;
    const image = path.join(root, 'image.png'); await write(image, 'image');
    const result = await api(env, 'POST', '/v1/archive', { thread_id: 't' }, hubHeader);
    assert.equal(result.body.kept[0].reason, 'cannot commit'); assert.equal(result.body.uploads_removed, true);
    assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'image', path: image, title: 'x' }, { 'x-wheelchair-session-token': 'alpha' })).status, 409);
    assert.equal((await fs.readdir(path.join(env.state, 'spool', 'cards'))).length, 0);
  } finally { await env.close(); }
});


test('Antigravity start, prompt polling, status and login completion', async () => {
  const root = await temp();
  await withEnv({ HOME: root }, async () => {
    const hub = await hubServer(); const env = await service(root, { pane: '? for shortcuts', config: { hub_url: hub.url } });
    try {
      const session = await start(env, { cli: 'agy' });
      assert.deepEqual(JSON.parse(await fs.readFile(path.join(env.state, 'settings', `${session.name}.json`))), { trustedWorkspaces: [session.worktree] });
      assert.match(await log(env), /WHEELCHAIR_SESSION_NAME=wc-t-lead/);
      assert.ok(JSON.parse(await fs.readFile(path.join(root, '.gemini/config/hooks.json'))).wheelchair);
      await write(env.fake.pane, await fs.readFile(path.join(__dirname, 'fixtures/agy/permission-prompt.txt')));
      await env.instance.pollReadiness(); assert.equal(env.instance.sessions[session.name].prompt_open, true);
      assert.ok(env.instance.status().agy);
      await env.instance.startLogin({ account: 'default-gemini', cli: 'agy' });
      const launch = (await log(env)).split('\n').find(line => line.includes('new-session') && line.includes('wc-login-default-gemini'));
      assert.ok(launch.includes(` -c ${path.join(env.state, 'agy-login')} `));
      assert.equal((await fs.stat(path.join(env.state, 'agy-login'))).mode & 0o777, 0o700);
      const before = (await log(env)).split('\n').filter(line => line.includes('kill-session -t wc-login-default-gemini')).length;
      for (const name of ['login-menu.txt', 'login-link-joined.txt', 'login-success.txt', 'onboard-1-theme.txt', 'onboard-2-data.txt', 'onboard-3-trust.txt']) {
        await write(env.fake.pane, await fs.readFile(path.join(__dirname, 'fixtures/agy', name)));
        assert.notEqual(env.instance.loginState('default-gemini').state, 'done');
        assert.notEqual(env.instance.loginState('default-gemini').state, 'done');
        assert.equal((await log(env)).split('\n').filter(line => line.includes('kill-session -t wc-login-default-gemini')).length, before);
      }
      const sends = (await log(env)).split('\n').filter(line => line.includes('send-keys -t wc-login-default-gemini ')).map(line => line.split(' ').at(-1));
      assert.deepEqual(sends, ['Enter', 'Enter', 'Enter', 'Down', 'Right', 'Enter', 'Enter']);
      await write(env.fake.pane, await fs.readFile(path.join(__dirname, 'fixtures/agy/idle.txt')));
      assert.equal(env.instance.loginState('default-gemini').state, 'done');
      assert.equal((await log(env)).split('\n').filter(line => line.includes('kill-session -t wc-login-default-gemini')).length, before + 1);
    } finally { await env.close(); await hub.close(); }
  });
});

test('idle usage probes isolate Claude and send only Codex rate-limit RPCs', async () => {
  const root = await temp(), env = await service(root);
  try {
    const record = path.join(root, 'probe.json');
    await write(path.join(env.fake.bin, 'claude'), `#!/usr/bin/env node\nconst fs = require('fs'); fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({ args: process.argv.slice(2), env: process.env.ANTHROPIC_BASE_URL })); console.log(JSON.stringify({ num_turns: 0, result: 'Current session: 100% used' }));\n`, 0o755);
    const request = { account: 'default-claude', cli: 'claude', dir: null };
    assert.equal((await api(env, 'POST', '/v1/usage', request)).status, 401);
    assert.equal((await api(env, 'POST', '/v1/usage', { ...request, cli: 'agy' }, hubHeader)).status, 400);
    assert.equal((await api(env, 'POST', '/v1/usage', { ...request, account: 'other' }, hubHeader)).status, 400);
    const result = await api(env, 'POST', '/v1/usage', request, hubHeader);
    assert.equal(result.status, 200); assert.equal(result.body.reading.five_hour.used, 100); assert.ok(result.body.reading.limited_until);
    const capture = JSON.parse(await fs.readFile(record)); const args = capture.args;
    assert.equal(capture.env, 'http://127.0.0.1:9'); assert.equal(args[args.indexOf('--setting-sources') + 1], '');
    assert.equal(JSON.parse(args[args.indexOf('--settings') + 1]).env.ANTHROPIC_BASE_URL, capture.env);
    await write(path.join(env.fake.bin, 'codex'), `#!/usr/bin/env node\nconst fs = require('fs'); let data = ''; process.stdin.on('data', c => { data += c; if (data.trim().split('\\n').length >= 3) { fs.writeFileSync(${JSON.stringify(record)}, data); console.log(JSON.stringify({method:'notice'})); console.log(JSON.stringify({id:2,result:{rateLimits:{primary:{windowDurationMins:10080,usedPercent:42,resetsAt:1800000000}}}})); } });\n`, 0o755);
    const codex = await api(env, 'POST', '/v1/usage', { account: 'default-gpt', cli: 'codex', dir: null }, hubHeader);
    assert.equal(codex.status, 200); assert.equal(codex.body.reading.week.used, 42);
    assert.deepEqual((await fs.readFile(record, 'utf8')).trim().split('\n').map(line => JSON.parse(line).method), ['initialize', 'initialized', 'account/rateLimits/read']);
  } finally { await env.close(); }
});
test('idle usage timeout kills the child without blocking status', async () => {
  const root = await temp(), env = await service(root);
  try {
    env.instance.options.usageProbeTimeout = 200;
    const pidfile = path.join(root, 'pid');
    await write(path.join(env.fake.bin, 'claude'), `#!/usr/bin/env node\nif (process.argv[2] !== '-p') process.exit(0); require('fs').writeFileSync(${JSON.stringify(pidfile)}, String(process.pid)); setInterval(() => {}, 1000);\n`, 0o755);
    const pending = api(env, 'POST', '/v1/usage', { account: 'default-claude', cli: 'claude', dir: null }, hubHeader);
    assert.equal((await api(env, 'GET', '/v1/status', undefined, hubHeader)).status, 200);
    assert.equal((await pending).status, 502);
    const pid = Number(await fs.readFile(pidfile, 'utf8'));
    await new Promise(resolve => setTimeout(resolve, 50)); assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally { await env.close(); }
});
test('step hooks reach the hub with session and thread unchanged', async () => {
  const hub = await hubServer(); const env = await service(await temp(), { config: { hub_url: hub.url } });
  try {
    await start(env);
    const step = { id: 'call', kind: 'files', label: 'Read a', key: 'files:Read .', started_at: '2026-01-01T00:00:00.000Z' };
    await api(env, 'POST', '/v1/agent/hooks', { type: 'step', phase: 'start', step }, agentHeader('alpha'));
    await env.instance.drainSpool('events');
    const event = hub.calls.map(c => JSON.parse(c.body)).find(c => c.type === 'step');
    assert.deepEqual(event.step, step); assert.equal(event.phase, 'start'); assert.equal(event.session, 'wc-t-lead'); assert.equal(event.thread_id, 't'); assert.ok(event.delivery_id);
  } finally { await env.close(); await hub.close(); }
});
test('hook-post sends both status events individually to the service', async () => {
  const env = await service(await temp());
  try {
    await start(env);
    const child = spawn(process.execPath, [path.join(__dirname, '../lib/hook-post.js'), env.state, 'alpha', 'claude', 'wc-t-lead'], { stdio: ['pipe', 'ignore', 'ignore'] });
    child.stdin.end(JSON.stringify({ rate_limits: { five_hour: { used_percentage: 12 } }, context_window: { used_percentage: 34 } }));
    assert.equal(await new Promise(resolve => child.on('exit', resolve)), 0);
    const files = await fs.readdir(path.join(env.state, 'spool/events'));
    const events = await Promise.all(files.map(async f => JSON.parse(await fs.readFile(path.join(env.state, 'spool/events', f), 'utf8'))));
    assert.ok(events.some(e => e.type === 'usage')); assert.ok(events.some(e => e.type === 'context' && e.context.percent === 34));
  } finally { await env.close(); }
});

test('Codex rollout reads persist complete lines, serialize reads, and flush before turn end', async () => {
  const root = await temp(), file = path.join(root,'rollout.jsonl');
  const svc = new MachineService({stateDir:root});
  const session = {name:'wc-test',cli:'codex',thread_id:'thread',codex_thread_id:'codex-id',source_transcript:file};
  svc.sessions[session.name] = session;
  const seen = []; let active=0, peak=0;
  svc.spool = async (kind, event) => { active++; peak=Math.max(peak,active); await new Promise(resolve=>setTimeout(resolve,5)); seen.push(event); active--; };
  svc.emitEvent = async event => { seen.push(event); };
  svc.liveTmux = () => new Set(['wc-test','wc-unbound']);
  svc.sessions['wc-unbound'] = {name:'wc-unbound',cli:'codex',thread_id:'thread',source_transcript:file};
  const row = (id,type,extra={}) => JSON.stringify({timestamp:'2026-01-01T00:00:00Z',type:'response_item',payload:{type,call_id:id,...extra}});
  const start = row('a','custom_tool_call',{name:'exec',input:'tools.exec_command({cmd:"npm test"})'});
  const end = row('a','custom_tool_call_output',{output:'Script running with cell ID 1'});
  await write(file,start+'\n'+end);
  await Promise.all([svc.pollCodexSteps(),svc.readCodexSteps(session)]);
  assert.equal(peak,1); assert.deepEqual(seen.map(e=>e.phase),['start']); assert.equal(session.steps_offset,Buffer.byteLength(start+'\n'));
  assert.equal(svc.sessions['wc-unbound'].steps_offset,undefined);
  await fs.appendFile(file,'\n'); await svc.readCodexSteps(session);
  const saved=JSON.parse(await fs.readFile(svc.sessionsPath,'utf8')); assert.equal(saved['wc-test'].steps_state.yielded,'a');
  const restarted=new MachineService({stateDir:root}); restarted.sessions=saved; restarted.emitEvent=svc.emitEvent; restarted.spool=svc.spool;
  const poll=row('p','function_call',{name:'wait',arguments:'{}'}), finish=row('p','function_call_output',{output:'Script completed'});
  await fs.appendFile(file,poll+'\n'+finish+'\n');
  await restarted.hook('wc-test',{type:'turn-ended',thread_id:'codex-id'});
  assert.deepEqual(seen.map(e=>e.type+':'+(e.phase||'')),['step:start','step:end','turn-ended:']);
  assert.equal(seen[1].step.clean,true); assert.equal(restarted.sessions['wc-test'].steps_offset,(await fs.stat(file)).size);
});

test('Codex rollout reader tails bounded chunks, reads appends once, and resets after truncation', async () => {
  const root = await temp(), file = path.join(root,'rollout.jsonl');
  const svc = new MachineService({stateDir:root});
  const session = {name:'wc-tail',cli:'codex',thread_id:'thread',codex_thread_id:'codex-id',source_transcript:file};
  svc.sessions[session.name] = session; svc.emitEvent = async () => {};
  const row = (id,type,extra={}) => JSON.stringify({timestamp:'2026-01-01T00:00:00Z',type:'response_item',payload:{type,call_id:id,...extra}});
  const pair = id => row(id,'custom_tool_call',{name:'exec_command',input:{cmd:'true'}})+'\n'+row(id,'custom_tool_call_output',{output:'Script completed'})+'\n';
  await write(file,pair('one'));
  await svc.readCodexSteps(session); const firstOffset = session.steps_offset;
  await fs.appendFile(file,pair('two'));
  await svc.readCodexSteps(session); assert.equal(session.steps_offset, (await fs.stat(file)).size);
  assert.equal(session.steps_state.open.two, undefined);
  await svc.readCodexSteps(session); assert.equal(session.steps_offset, (await fs.stat(file)).size);
  // A full chunk without a newline is skipped, so one pathological line cannot stall the tail.
  await write(file,'x'.repeat(8 * 1024 * 1024));
  session.steps_offset = 0;
  await svc.readCodexSteps(session); assert.equal(session.steps_offset, 8 * 1024 * 1024);
  // Replacing the file with a shorter rollout resets the offset and parser state.
  session.steps_state = {open:{stale:{poll:false}},yielded:'stale'};
  await write(file,pair('replacement'));
  await svc.readCodexSteps(session);
  assert.equal(session.steps_offset, (await fs.stat(file)).size);
  assert.deepEqual(session.steps_state, {open:{},yielded:null});
  assert.ok(firstOffset > 0);
});


test('spooled Codex turn end drains without blocking later Claude events', async () => {
  const root = await temp(), file = path.join(root, 'rollout.jsonl'), hub = await hubServer();
  const svc = new MachineService({stateDir: root}); svc.config.hub_url = hub.url; svc.secret = async () => 'secret';
  const session = {name:'wc-x-worker',cli:'codex',thread_id:'t',codex_thread_id:'cid',source_transcript:file};
  svc.sessions[session.name] = session;
  svc.sessions['wc-x-lead'] = {name:'wc-x-lead',cli:'claude',thread_id:'t'};
  const row = JSON.stringify({timestamp:'2026-01-01T00:00:00Z',type:'response_item',payload:{type:'function_call',call_id:'a',name:'exec_command',arguments:'{"cmd":"npm test"}'}}) + '\n';
  try {
    await write(file, row);
    await svc.spool('events', {type:'turn-ended','thread-id':'cid',session:session.name});
    await svc.spool('events', {type:'prompt',notification_type:'permission_prompt',session:'wc-x-lead'});
    let timer;
    try {
      await Promise.race([svc.drainSpool('events'), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('drain timed out')), 3000); })]);
    } finally { clearTimeout(timer); }
    await svc.drainSpool('events');
    const events = hub.calls.map(c => JSON.parse(c.body));
    assert.ok(events.some(e => e.type === 'turn-ended' && e.session === session.name));
    assert.ok(events.some(e => e.type === 'step' && e.session === session.name));
    assert.ok(events.some(e => e.type === 'prompt' && e.session === 'wc-x-lead'));
    assert.deepEqual(await fs.readdir(path.join(root, 'spool/events')), []);
    assert.equal(JSON.parse(await fs.readFile(svc.sessionsPath, 'utf8'))[session.name].steps_offset, Buffer.byteLength(row));
  } finally { await hub.close(); }
});

test('live Codex turn end flushes every bounded chunk before the turn event', async () => {
  const root = await temp(), file = path.join(root, 'rollout.jsonl'), hub = await hubServer();
  const svc = new MachineService({stateDir:root, codexStepChunkSize:256}); svc.config.hub_url = hub.url; svc.secret = async () => 'secret';
  const session = {name:'wc-x-worker',cli:'codex',thread_id:'t',codex_thread_id:'cid',source_transcript:file}; svc.sessions[session.name] = session;
  const row = id => JSON.stringify({timestamp:'2026-01-01T00:00:00Z',type:'response_item',payload:{type:'function_call',call_id:id,name:'exec_command',arguments:'{"cmd":"npm test"}'}}) + '\n';
  const data = row('one') + row('two') + row('three');
  try {
    await write(file, data); assert.ok(Buffer.byteLength(data) > svc.codexStepChunkSize);
    await svc.hook(session.name, {type:'turn-ended','thread-id':'cid'});
    const events = hub.calls.map(c => JSON.parse(c.body));
    assert.deepEqual(events.map(e => e.type), ['step','step','step','turn-ended']);
    assert.equal(session.steps_offset, Buffer.byteLength(data));
  } finally { await hub.close(); }
});

test('handoff normalizes GitHub origins', () => {
  const { normalizeGithubOrigin } = require('../service');
  for (const [origin, expected] of [
    ['git@github.com:Owner/Repo.git', 'github.com/owner/repo'],
    ['https://github.com/Owner/Repo', 'github.com/owner/repo'],
    ['https://github.com/Owner/Repo.git', 'github.com/owner/repo'],
    ['ssh://git@github.com/Owner/Repo.git', 'github.com/owner/repo'],
    ['ssh://git@github.com/Owner/Repo', 'github.com/owner/repo'],
    ['https://example.com/Owner/Repo', null], ['', null], [null, null],
  ]) assert.equal(normalizeGithubOrigin(origin), expected, String(origin));
});

test('handoff validates input, authorization, and waits for the archive lock', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const repo = await project(root); const id = '012345abcdef';
    const call = body => api(env, 'POST', '/v1/handoff', body, hubHeader);
    assert.equal((await api(env, 'POST', '/v1/handoff', { action: 'running', thread_id: id })).status, 401);
    const malformed = await fetch(`${env.base}/v1/handoff`, { method: 'POST', headers: hubHeader, body: '{' }); const badJson = await malformed.json();
    assert.equal(malformed.status, 422, JSON.stringify(badJson)); assert.equal(badJson.result, 'failed', JSON.stringify(badJson));
    for (const body of [
      { action: 'running', thread_id: 'bad' }, { action: 'running', thread_id: 123456789012 }, { action: 'bogus', thread_id: id },
      { action: 'inspect', thread_id: id, project: repo, branch: 'main', head: 'a'.repeat(40), slug: 'ok' },
      { action: 'inspect', thread_id: id, project: repo, branch: `wc/${id}`, head: 'bad', slug: 'ok' },
      { action: 'inspect', thread_id: id, project: repo, branch: `wc/${id}`, head: 'a'.repeat(40), slug: '../bad' },
      { action: 'status', thread_id: id, project: repo, worktree: repo, slug: 'ok' },
      { action: 'known', thread_id: id, project: '/missing', head: 'a'.repeat(40) },
      { action: 'kill', thread_id: id, names: ['wc-other-lead'] },
    ]) { const result = await call(body); assert.equal(result.status, 422, JSON.stringify(result.body)); assert.equal(result.body.result, 'failed', JSON.stringify(result.body)); }
    env.instance.sessions[`wc-${id}-lead`] = { name: `wc-${id}-lead`, thread_id: id };
    let release; const originalStop = env.instance.stop.bind(env.instance);
    env.instance.stop = async name => { await new Promise(resolve => { release = resolve; }); return originalStop(name); };
    const held = env.instance.archive(id);
    while (!release) await new Promise(resolve => setImmediate(resolve));
    let finished = false; const pending = call({ action: 'running', thread_id: id }).then(result => { finished = true; return result; });
    await new Promise(resolve => setTimeout(resolve, 50)); assert.equal(finished, false);
    release(); await held; assert.equal((await pending).status, 200);
  } finally { await env.close(); }
});

test('handoff fetch checks exact remote ref and updates a single-branch clone', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const repo = await project(root); const id = '012345abcdef'; const branch = `wc/${id}`;
    git(['-C', repo, 'push', 'origin', `HEAD:refs/heads/backup/${branch}`]);
    const clone = path.join(root, 'single');
    git(['clone', '--single-branch', '--branch', 'main', `file://${path.join(root, 'origin.git')}`, clone]);
    let state = await env.instance.fetchHandoffBranch(clone, branch);
    assert.deepEqual(state, { remote_has_branch: false, remote_tip: null }, JSON.stringify(state));
    git(['-C', repo, 'push', 'origin', `HEAD:refs/heads/${branch}`]);
    state = await env.instance.fetchHandoffBranch(clone, branch);
    const head = git(['-C', repo, 'rev-parse', 'HEAD']).stdout.trim();
    assert.deepEqual(state, { remote_has_branch: true, remote_tip: head }, JSON.stringify(state));
    assert.equal(git(['-C', clone, 'rev-parse', `refs/remotes/origin/${branch}`]).stdout.trim(), head);
  } finally { await env.close(); }
});

test('handoff status, exact push, and inspect read committed state and ancestry', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const id = '012345abcdef'; const { repo, worktree } = await startedWorktree(env, root, id); const branch = `wc/${id}`;
    const call = async (action, fields) => { const response = await api(env, 'POST', '/v1/handoff', { action, thread_id: id, project: repo, ...fields }, hubHeader); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body; };
    await write(path.join(worktree, 'docs/plans/sample/IDEA.md'), '---\nstatus: confirmed\n---\n');
    await write(path.join(worktree, 'docs/plans/sample/PLAN.md'), '---\nstatus: approved\n---\n');
    await write(path.join(worktree, 'docs/plans/sample/MAP.md'), 'map\n');
    git(['-C', worktree, 'add', '.']); git(['-C', worktree, 'commit', '-m', 'plan']);
    const old = git(['-C', worktree, 'rev-parse', 'HEAD']).stdout.trim();
    await write(path.join(worktree, 'docs/plans/sample/IDEA.md'), 'status: draft\n');
    let body = await call('status', { worktree, slug: 'sample' });
    assert.equal(body.dirty, true, JSON.stringify(body)); assert.equal(body.idea_status, 'confirmed', JSON.stringify(body));
    assert.equal(body.plan_status, 'approved', JSON.stringify(body)); assert.equal(body.map_committed, true, JSON.stringify(body));
    assert.equal(body.remote_has_branch, false, JSON.stringify(body)); assert.equal(body.pr_state, null, JSON.stringify(body));
    git(['-C', worktree, 'checkout', '--', 'docs/plans/sample/IDEA.md']);
    body = await call('push', { worktree, branch, sha: old }); assert.equal(body.head, old, JSON.stringify(body));
    await write(path.join(env.fake.bin, 'gh'), '#!/bin/sh\necho unavailable >&2\nexit 1\n', 0o755);
    body = await call('status', { worktree, slug: 'sample', pr_url: 'https://example.test/pr' });
    assert.equal(body.dirty, false, JSON.stringify(body)); assert.equal(body.remote_tip, old, JSON.stringify(body));
    assert.equal(body.pr_state, null, JSON.stringify(body)); assert.ok(body.pr_error, JSON.stringify(body));
    await write(path.join(env.fake.bin, 'gh'), '#!/bin/sh\necho "{\\"state\\":\\"OPEN\\"}"\n', 0o755);
    body = await call('status', { worktree, slug: 'sample', pr_url: 'https://example.test/pr' }); assert.equal(body.pr_state, 'OPEN', JSON.stringify(body));
    git(['-C', worktree, 'commit', '--allow-empty', '-m', 'next']); const newer = git(['-C', worktree, 'rev-parse', 'HEAD']).stdout.trim();
    body = await call('push', { worktree, branch, sha: old }); assert.equal(body.head, old, JSON.stringify(body));
    assert.equal(git(['--git-dir', path.join(root, 'origin.git'), 'rev-parse', `refs/heads/${branch}`]).stdout.trim(), old);
    await call('push', { worktree, branch, sha: newer });
    body = await call('inspect', { branch, head: old, worktree, slug: 'sample' });
    assert.equal(body.relation, 'behind', JSON.stringify(body)); assert.equal(body.remote_contains_head, true, JSON.stringify(body)); assert.ok(body.picked_up_at, JSON.stringify(body));
    body = await call('inspect', { branch, head: newer, worktree, slug: 'sample' }); assert.equal(body.relation, 'same', JSON.stringify(body));
    git(['-C', worktree, 'checkout', '--detach', old]);
    body = await call('inspect', { branch, head: newer, worktree, slug: 'sample' }); assert.equal(body.relation, 'ahead', JSON.stringify(body));
    git(['-C', worktree, 'commit', '--allow-empty', '-m', 'diverge']);
    body = await call('inspect', { branch, head: newer, worktree, slug: 'missing' }); assert.equal(body.relation, 'diverged', JSON.stringify(body)); assert.equal(body.idea_status, null, JSON.stringify(body)); assert.equal(body.map_committed, false, JSON.stringify(body));
    body = await call('inspect', { branch, head: old, slug: 'sample' }); assert.equal(body.local_head, newer, JSON.stringify(body));
    git(['-C', repo, 'branch', '-D', branch]);
    body = await call('inspect', { branch, head: old, slug: 'sample', fallback_head: old }); assert.equal(body.local_head, old, JSON.stringify(body)); assert.equal(body.worktree_exists, false, JSON.stringify(body));
  } finally { await env.close(); }
});

test('handoff claims use exact leases, state checks, and safe revocation', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const id = '012345abcdef'; const repo = await project(root); const branch = `wc/${id}`;
    const parent = git(['-C', repo, 'rev-parse', 'HEAD']).stdout.trim();
    git(['-C', repo, 'push', 'origin', `HEAD:refs/heads/${branch}`]);
    const call = async (action, fields) => { const response = await api(env, 'POST', '/v1/handoff', { action, thread_id: id, project: repo, ...fields }, hubHeader); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body; };
    const first = await call('claim-commit', { parent, message: 'pickup nonce1' });
    const second = await call('claim-commit', { parent, message: 'pickup nonce2' });
    assert.notEqual(first.sha, second.sha, JSON.stringify({ first, second }));
    const args = { branch, parent, sha: first.sha };
    let body = await call('claim-state', args); assert.equal(body.result, 'parent', JSON.stringify(body)); assert.equal(body.remote_tip, parent, JSON.stringify(body));
    body = await call('claim-revoke', args); assert.equal(body.result, 'waiting', JSON.stringify(body));
    body = await call('claim-push', args); assert.equal(body.result, 'landed', JSON.stringify(body)); assert.equal(body.remote_tip, first.sha, JSON.stringify(body));
    const hook = path.join(root, 'origin.git/hooks/pre-receive'); await write(hook, '#!/bin/sh\necho denied >&2\nexit 1\n', 0o755);
    body = await call('claim-revoke', args); assert.equal(body.result, 'failed', JSON.stringify(body)); assert.ok(body.error, JSON.stringify(body));
    await fs.unlink(hook);
    body = await call('claim-revoke', args); assert.equal(body.result, 'revoked', JSON.stringify(body));
    const replacement = await call('claim-push', { branch, parent, sha: second.sha }); assert.equal(replacement.result, 'landed', JSON.stringify(replacement));
    body = await call('claim-push', args); assert.equal(body.result, 'moved', JSON.stringify(body)); assert.equal(body.remote_tip, second.sha, JSON.stringify(body));
    body = await call('claim-revoke', args); assert.equal(body.result, 'gone', JSON.stringify(body));
    const child = await call('claim-commit', { parent: second.sha, message: 'child' });
    git(['-C', repo, 'push', 'origin', `${child.sha}:refs/heads/${branch}`]);
    body = await call('claim-revoke', { branch, parent, sha: second.sha }); assert.equal(body.result, 'gone', JSON.stringify(body));
    git(['-C', repo, 'push', '--force', 'origin', `${parent}:refs/heads/${branch}`]);
    body = await call('claim-push', { branch, parent: second.sha, sha: child.sha }); assert.equal(body.result, 'moved', JSON.stringify(body)); assert.equal(body.remote_tip, parent, JSON.stringify(body));
    git(['-C', repo, 'push', 'origin', `:refs/heads/${branch}`]);
    body = await call('claim-push', args); assert.equal(body.result, 'unknown', JSON.stringify(body));
  } finally { await env.close(); }
});

test('handoff local branch operations guard divergence and report ownership', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const id = '012345abcdef'; const { repo, worktree } = await startedWorktree(env, root, id); const branch = `wc/${id}`;
    const call = async (action, fields) => { const response = await api(env, 'POST', '/v1/handoff', { action, thread_id: id, project: repo, ...fields }, hubHeader); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body; };
    const old = git(['-C', worktree, 'rev-parse', 'HEAD']).stdout.trim();
    git(['-C', repo, 'commit', '--allow-empty', '-m', 'new']); const next = git(['-C', repo, 'rev-parse', 'HEAD']).stdout.trim();
    let body = await call('known', { head: next }); assert.deepEqual(body, { known: true, local_branch: true, local_ancestor: true, checked_out: worktree }, JSON.stringify(body));
    await write(path.join(worktree, 'dirty'), 'x'); body = await call('fast-forward', { worktree, branch, head: next }); assert.equal(body.result, 'failed', JSON.stringify(body)); await fs.unlink(path.join(worktree, 'dirty'));
    body = await call('fast-forward', { worktree, branch, head: next }); assert.equal(body.result, 'ok', JSON.stringify(body));
    assert.equal(git(['-C', worktree, 'config', `branch.${branch}.remote`]).stdout.trim(), 'origin'); assert.equal(git(['-C', worktree, 'config', `branch.${branch}.merge`]).stdout.trim(), `refs/heads/${branch}`);
    body = await call('fast-forward', { worktree, branch, head: old }); assert.equal(body.result, 'failed', JSON.stringify(body));
    git(['-C', worktree, 'checkout', '--detach']); body = await call('fast-forward', { worktree, branch, head: next }); assert.equal(body.result, 'failed', JSON.stringify(body));
    body = await call('set-branch', { branch, sha: old }); assert.equal(body.result, 'failed', JSON.stringify(body));
    body = await call('set-branch', { branch, sha: next }); assert.equal(body.result, 'ok', JSON.stringify(body));
    body = await call('known', { head: old }); assert.equal(body.local_ancestor, false, JSON.stringify(body)); assert.equal(body.checked_out, null, JSON.stringify(body));
    git(['-C', repo, 'branch', '-D', branch]); body = await call('known', { head: old }); assert.equal(body.local_branch, false, JSON.stringify(body)); assert.equal(body.local_ancestor, null, JSON.stringify(body));
  } finally { await env.close(); }
});

test('handoff kills exact session names and cancels starts before tmux', async () => {
  const root = await temp(); const env = await service(root); const oldSessions = process.env.FAKE_SESSIONS; try {
    const id = '012345abcdef'; const lead = `wc-${id}-lead`; const sub = `wc-${id}-sub-lead`; const lead2 = `${lead}-2`;
    process.env.FAKE_SESSIONS = `${lead} ${sub} ${lead2}`;
    const call = async (action, fields = {}) => { const response = await api(env, 'POST', '/v1/handoff', { action, thread_id: id, ...fields }, hubHeader); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body; };
    let body = await call('running'); assert.deepEqual(body.names.sort(), [lead, lead2, sub].sort(), JSON.stringify(body));
    await call('kill', { names: [lead] }); const recorded = await log(env);
    assert.match(recorded, new RegExp(`kill-session -t =${lead}\\n`)); assert.doesNotMatch(recorded, new RegExp(`kill-session -t =${lead2}\\n|kill-session -t =${sub}\\n`));
    process.env.FAKE_SESSIONS = '';
    let release; const original = env.instance.createWorktree.bind(env.instance);
    env.instance.createWorktree = async (...args) => { await new Promise(resolve => { release = resolve; }); return original(...args); };
    const worktree = path.join(root, 'waiting'); await fs.mkdir(worktree);
    const pending = api(env, 'POST', '/v1/sessions', { name: lead, role: 'lead', cli: 'claude', thread_id: id, token: 'token', worktree }, hubHeader);
    while (!release) await new Promise(resolve => setImmediate(resolve));
    body = await call('kill', { names: [lead] }); assert.ok(body.names.includes(lead), JSON.stringify(body));
    release(); const result = await pending; assert.notEqual(result.status, 201, JSON.stringify(result.body)); assert.match(result.body.error, /cancelled/);
    const after = await log(env); assert.doesNotMatch(after, new RegExp(`new-session .* -s ${lead}(?: |\\n)`));
  } finally { if (oldSessions === undefined) delete process.env.FAKE_SESSIONS; else process.env.FAKE_SESSIONS = oldSessions; await env.close(); }
});

test('archive ownership markers survive restart and reopening clears them', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const id = '012345abcdef'; const repo = await project(root); const head = git(['-C', repo, 'rev-parse', 'HEAD']).stdout.trim();
    let response = await api(env, 'POST', '/v1/archive', { thread_id: id }, hubHeader); assert.equal(response.status, 200, JSON.stringify(response.body));
    const restarted = new MachineService({ stateDir: env.state, host: '127.0.0.1', port: await port() }); await restarted.init();
    try {
      assert.equal(restarted.archivedThreads.has(id), true);
      let result = await restarted.handoff({ action: 'known', thread_id: id, project: repo, head }); assert.equal(result.known, true, JSON.stringify(result));
      await assert.rejects(restarted.upload(id, 'a.txt', null, true), /not writable/);
      result = await restarted.handoff({ action: 'reopen', thread_id: id }); assert.deepEqual(result, { ok: true }, JSON.stringify(result));
      result = await restarted.handoff({ action: 'known', thread_id: id, project: repo, head }); assert.equal(result.known, false, JSON.stringify(result));
      const markers = JSON.parse(await fs.readFile(path.join(env.state, 'archive-markers.json'), 'utf8')); assert.deepEqual(markers, { archiving: [], archived: [] });
    } finally { clearInterval(restarted.pollTimer); clearInterval(restarted.stepsTimer); clearInterval(restarted.trustTimer); }
  } finally { await env.close(); }
});

test('a kept-open archive clears archiving and continues to accept uploads', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const id = '012345abcdef'; const { worktree } = await startedWorktree(env, root, id);
    const marker = git(['-C', worktree, 'rev-parse', '--git-path', 'rebase-merge']).stdout.trim();
    await fs.mkdir(path.resolve(worktree, marker), { recursive: true });
    const archived = await api(env, 'POST', '/v1/archive', { thread_id: id }, hubHeader); assert.equal(archived.body.kept[0].reason, 'rebase in progress', JSON.stringify(archived.body));
    assert.equal(env.instance.archivingThreads.has(id), false); assert.equal(env.instance.archivedThreads.has(id), false);
    const uploaded = await fetch(`${env.base}/v1/uploads?thread_id=${id}&name=test.txt&vouched=1`, { method: 'POST', headers: hubHeader, body: 'hello' }); assert.equal(uploaded.status, 201, await uploaded.text());
  } finally { await env.close(); }
});

test('imported worktree creates, advances, reuses, and rejects unsafe states', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const repo = await project(root); const parent = git(['-C', repo, 'rev-parse', 'HEAD']).stdout.trim();
    git(['-C', repo, 'commit', '--allow-empty', '-m', 'remote tip']); const tip = git(['-C', repo, 'rev-parse', 'HEAD']).stdout.trim();
    const create = (id, sha) => env.instance.createWorktree({ role: 'lead', thread_id: id, project_dir: repo, project: 'project', from_remote_branch: { sha } }, `wc-${id}-lead`);
    const push = id => git(['-C', repo, 'push', 'origin', `${tip}:refs/heads/wc/${id}`]);
    const a = '111111111111'; push(a); let result = await create(a, tip); assert.equal(git(['-C', result.worktree, 'rev-parse', 'HEAD']).stdout.trim(), tip);
    assert.equal(git(['-C', result.worktree, 'config', `branch.wc/${a}.merge`]).stdout.trim(), `refs/heads/wc/${a}`);
    result = await create(a, tip); assert.equal(git(['-C', result.worktree, 'config', `branch.wc/${a}.remote`]).stdout.trim(), 'origin');
    const b = '222222222222'; push(b); git(['-C', repo, 'branch', `wc/${b}`, parent]); result = await create(b, tip); assert.equal(git(['-C', result.worktree, 'rev-parse', 'HEAD']).stdout.trim(), tip);
    const c = '333333333333'; push(c); git(['-C', repo, 'checkout', '--detach', parent]); git(['-C', repo, 'commit', '--allow-empty', '-m', 'diverged']); git(['-C', repo, 'branch', `wc/${c}`, 'HEAD']);
    await assert.rejects(create(c, tip), /already exists and differs/);
    const d = '444444444444'; push(d); await assert.rejects(create(d, 'f'.repeat(40)), /not on the remote branch/);
    const e = '555555555555'; push(e); await fs.mkdir(path.join(env.state, 'worktrees', 'project', 'wc', e), { recursive: true }); await assert.rejects(create(e, tip), /unexpected state/);
    const f = '666666666666'; push(f); const session = await start(env, { thread_id: f, token: 'remote-token', project_dir: repo, project: 'project', serviceWorktree: true, from_remote_branch: { sha: tip } });
    assert.equal(session.created_worktree, true); const archived = await api(env, 'POST', '/v1/archive', { thread_id: f }, hubHeader); assert.ok(archived.body.removed.includes(session.worktree), JSON.stringify(archived.body));
  } finally { await env.close(); }
});
