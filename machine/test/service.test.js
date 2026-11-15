'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
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
  tmux:list-sessions) if [ -n "\${FAKE_LS_ERR:-}" ]; then printf '%s\\n' "$FAKE_LS_ERR" >&2; exit 1; fi; printf '%s\\n' \${FAKE_SESSIONS:-} ;;
  tmux:load-buffer) cat >> "$FAKE_LOG" ;;
  systemd-run:*) exit 1 ;;
  git:*) if [[ " $* " == *" rev-parse "* ]]; then echo "\${FAKE_GIT_VERSION:-deadbeef}"; fi ;;
  claude:-p) cat > "$FAKE_LOG.stdin"; echo "lane=\${WHEELCHAIR_LANE:-}" >> "$FAKE_LOG"; [ -z "\${FAKE_PREVIEW_SLEEP:-}" ] || sleep "$FAKE_PREVIEW_SLEEP"; [ -z "\${FAKE_PREVIEW_ERR:-}" ] || printf '%s\\n' "$FAKE_PREVIEW_ERR" >&2; [ -z "\${FAKE_PREVIEW_OUT:-}" ] || printf '%s\\n' "$FAKE_PREVIEW_OUT"; exit "\${FAKE_PREVIEW_EXIT:-0}" ;;
  claude:--version) echo claude-test ;;
  claude:auth) printf '%s\\n' "\${FAKE_CLAUDE_AUTH:-{\\"loggedIn\\":true}}" ;;
  codex:--version) echo codex-test ;;
esac
`;
  for (const name of ['tmux', 'systemd-run', ...(realGit ? [] : ['git']), 'gh', 'claude', 'codex', 'tailscale', 'sh']) await write(path.join(bin, name), script, 0o755);
  await write(pane, paneText);
  return { bin, log, pane };
}
async function hubServer(status = 200) {
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
    }
    calls.push({ path: request.url, body, status: code }); response.writeHead(code, { 'content-type': 'application/json' }); response.end(JSON.stringify(answer));
  }); });
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
  const env = await service(await temp(), { pane: trustDialog }); try { await start(env); const calls = await log(env); assert.match(calls, /'claude' '--session-id' .* '--settings' .* '--permission-mode' 'auto' '--append-system-prompt'/); assert.match(calls, /'WHEELCHAIR_MACHINE_ORIGIN=http:\/\/127\.0\.0\.1:\d+'/); const settings = await fs.readdir(path.join(env.state, 'settings')); const text = await fs.readFile(path.join(env.state, 'settings', settings[0]), 'utf8'); assert.match(text, /"Stop"/); assert.match(text, /"Notification"/); assert.match(text, /"cleanupPeriodDays":30/); assert.match(text, /"promptSuggestionEnabled":false/); } finally { await env.close(); }
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
test('a worktree starts from origin trunk and records trunk as its default branch', async () => {
  const root = await temp(); const env = await service(root, { realGit: true }); try {
    const repo = await project(root, 'trunk');
    const session = await start(env, { thread_id: 'trunk', token: 'trunk-token', project_dir: repo, project: 'project', serviceWorktree: true });
    assert.equal(session.default_branch, 'trunk');
    assert.equal(git(['-C', repo, 'merge-base', '--is-ancestor', 'origin/trunk', session.branch]).status, 0);
  } finally { await env.close(); }
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
    await new Promise((resolve, reject) => { const child = spawn(process.execPath, [path.join(process.cwd(), 'machine', 'lib', 'hook-post.js'), state, 'tok', 'codex', 'wc-t-reviewer'], { stdio: ['pipe', 'ignore', 'inherit'] }); child.on('exit', resolve); child.on('error', reject); child.stdin.end(notify); });
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
test('role_layers follow the local pointer for Claude; the pointer carries the new sentence with or without layers', async () => {
  const env = await service(await temp()); try {
    await start(env, { thread_id: 'p', token: 'p' });
    const pointer = (role) => `Read ${path.resolve(__dirname, '..', '..', 'protocol', 'app', `${role}.md`)} before responding. It is wheelchair's built-in rules for your role.`;
    assert.equal(flagValue(argvOf(env, 'wc-p-lead'), '--append-system-prompt'), pointer('lead'));
    await start(env, { thread_id: 'q', token: 'q', role_layers: 'Nothing below overrides the built-in rules above.\n\nBe brief.' });
    assert.equal(flagValue(argvOf(env, 'wc-q-lead'), '--append-system-prompt'), `${pointer('lead')}\n\nNothing below overrides the built-in rules above.\n\nBe brief.`);
    await start(env, { thread_id: 'r', token: 'r', role_layers: '' });
    assert.equal(flagValue(argvOf(env, 'wc-r-lead'), '--append-system-prompt'), pointer('lead'));
    const bad = await api(env, 'POST', '/v1/sessions', { role: 'lead', cli: 'claude', thread_id: 's', token: 's', worktree: env.state, role_layers: 5 }, hubHeader);
    assert.equal(bad.status, 400);
  } finally { await env.close(); }
});
test('role_layers follow the local pointer in the Codex [wc:role] message', async () => {
  const env = await service(await temp(), { pane: readyCodex }); try {
    await start(env, { cli: 'codex', role: 'worker', token: 'beta', role_layers: 'Your template says: save every step.', brief: 'build it' });
    const calls = await log(env);
    assert.match(calls, /\[wc:role\] Read \S+protocol\/app\/worker\.md before responding\. It is wheelchair's built-in rules for your role\.\n\nYour template says: save every step\.\n\nbuild it/);
  } finally { await env.close(); }
});
test('role_prompt wins over role_layers for both CLIs', async () => {
  const env = await service(await temp()); try {
    await start(env, { thread_id: 'w', token: 'w', role_prompt: 'custom prompt', role_layers: 'ignored layers' });
    assert.equal(flagValue(argvOf(env, 'wc-w-lead'), '--append-system-prompt'), 'custom prompt');
  } finally { await env.close(); }
  const codex = await service(await temp(), { pane: readyCodex }); try {
    await start(codex, { cli: 'codex', role: 'worker', token: 'beta', role_prompt: 'custom prompt', role_layers: 'ignored layers', brief: 'go' });
    const calls = await log(codex);
    assert.match(calls, /\[wc:role\] custom prompt\n\ngo/); assert.doesNotMatch(calls, /ignored layers/);
  } finally { await codex.close(); }
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
    assert.deepEqual(status.body.accounts.map(a => a.id).sort(), ['default-claude', 'default-gpt', 'one', 'two']);
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
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stdin.end(payload);
    assert.equal(await new Promise(resolve => child.on('close', resolve)), 0);
    assert.equal(output.trim(), 'opus · 5h 42%');
    const second = spawn(path.join(__dirname, '../statusline.sh'), ['claude', 'wc-t-lead'], { env: { ...process.env, WHEELCHAIR_STATE_DIR: env.state, WHEELCHAIR_SESSION_TOKEN: 'alpha' }, stdio: ['pipe', 'pipe', 'pipe'] });
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
    assert.equal(started.status, 201); const cmd = await log(env); assert.match(cmd, /CLAUDE_CONFIG_DIR=/); assert.match(cmd, /auth.*login/); assert.doesNotMatch(cmd, /WHEELCHAIR_SESSION_TOKEN/);
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
    assert.match(codexCommand, /codex.*login.*--device-auth/); assert.doesNotMatch(codexCommand, /WHEELCHAIR_SESSION_TOKEN/);
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
    assert.deepEqual(session.command, ['claude', '--session-id', 'fixed', '--settings', settingsPath, '--permission-mode', 'auto', '--append-system-prompt', 'role']);
    const hook = `'${path.resolve(__dirname, '../hook.sh')}' claude 'wc-t-lead'`;
    const entry = [{ hooks: [{ type: 'command', command: hook }] }];
    assert.deepEqual(JSON.parse(await fs.readFile(settingsPath, 'utf8')), { cleanupPeriodDays: 30, promptSuggestionEnabled: false, hooks: { Stop: entry, Notification: entry, StopFailure: entry }, statusLine: { type: 'command', command: `'${path.resolve(__dirname, '../statusline.sh')}' claude 'wc-t-lead'` } });
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
