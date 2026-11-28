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

test('assistant start uses its own folder and prompt, and switch requires the matching session', async () => {
  const root = await temp(); const env = await service(root);
  try {
    await fs.writeFile(env.fake.log, '');
    const folder = path.join(env.state, 'assistant');
    await assert.rejects(fs.stat(folder), { code: 'ENOENT' });
    const body = { role: 'lead', cli: 'claude', thread_id: 'assistant', token: 'alpha', assistant: true, prompt_role: 'assistant', role_layers: 'hub layer' };
    const result = await api(env, 'POST', '/v1/sessions', body, hubHeader);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.worktree, folder); assert.equal(result.body.branch, null);
    assert.equal(result.body.assistant, true); assert.equal((await fs.stat(folder)).isDirectory(), true);
    const prompt = await fs.readFile(path.join(env.state, 'prompts', `${result.body.name}.md`), 'utf8');
    const app = path.join(__dirname, '../../protocol/app');
    assert.ok(prompt.includes((await fs.readFile(path.join(app, 'assistant.md'), 'utf8')).trimEnd()));
    assert.ok(prompt.includes((await fs.readFile(path.join(app, 'cards-lead.md'), 'utf8')).trimEnd()));
    assert.ok(!prompt.includes((await fs.readFile(path.join(app, 'lead.md'), 'utf8')).trimEnd()));
    assert.match(prompt, /wc\.js assistant settings \[--include-history\]/);
    assert.match(prompt, /setting <target> --file/);
    assert.match(prompt, /temporary JSON or text\s+files outside any project repository/);
    assert.doesNotMatch(prompt, /Do not change Settings\./);
    assert.ok(!prompt.includes('--- realism.md ---')); assert.ok(prompt.endsWith('hub layer'));
    const commands = await log(env); assert.match(commands, new RegExp(`new-session .* -c ${folder}`)); assert.doesNotMatch(commands, /^git /m);
    const invalid = await api(env, 'POST', '/v1/sessions', { ...body, thread_id: 'invalid', assistant: false }, hubHeader);
    assert.equal(invalid.status, 400);
    const wrong = await api(env, 'POST', '/v1/sessions', { ...body, thread_id: 'wrong', worktree: root }, hubHeader);
    assert.equal(wrong.status, 400);
    process.env.FAKE_SESSIONS = result.body.name;
    const switchBody = { switch_id: 'one', account: { id: 'default-claude', dir: null }, model: null, assistant: true };
    assert.equal((await api(env, 'POST', `/v1/sessions/${result.body.name}/switch`, switchBody, hubHeader)).status, 202);
    const normal = await start(env, { thread_id: 'normal' });
    assert.equal((await api(env, 'POST', `/v1/sessions/${normal.name}/switch`, { ...switchBody, switch_id: 'two' }, hubHeader)).status, 400);
  } finally { delete process.env.FAKE_SESSIONS; await env.close(); }
});

test('assistant relay forwards once, preserves refusals, and waits beyond five seconds', async () => {
  const root = await temp(); let status = 200; let delay = 0; let answer = null; const calls = [];
  const hub = http.createServer((req, res) => { let body = ''; req.on('data', c => body += c); req.on('end', () => {
    if (req.url !== '/api/machine/assistant') { res.end('{}'); return; }
    calls.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
    if (status === 0) return req.socket.destroy();
    setTimeout(() => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(answer || { answer: status })); }, delay);
  }); });
  await new Promise(resolve => hub.listen(0, '127.0.0.1', resolve));
  const env = await service(root, { config: { hub_url: `http://127.0.0.1:${hub.address().port}` } });
  try {
    const session = await start(env); const headers = { 'x-wheelchair-session-token': 'alpha' };
    const post = () => api(env, 'POST', '/v1/agent/assistant', { action: 'threads', calling_session: 'forged' }, headers);
    delay = 6100; assert.deepEqual(await post(), { status: 200, body: { answer: 200 } });
    assert.equal(calls[0].url, '/api/machine/assistant'); assert.equal(calls[0].body.calling_session, session.name);
    assert.equal(calls[0].headers['x-wheelchair-machine-secret'], 'correct-secret');
    delay = 0; answer = { ok: false, error: 'some machines failed', result: { machines: [{ name: 'hub', ok: true }, { name: 'remote', ok: false, error: 'unavailable' }] } };
    const partial = await api(env, 'POST', '/v1/agent/assistant', { action: 'setting', target: 'diagram-sensitivity', payload: { level: 'high' } }, headers);
    assert.deepEqual(partial, { status: 200, body: answer });
    answer = null; status = 403; assert.deepEqual(await post(), { status: 403, body: { answer: 403 } });
    status = 0; assert.deepEqual(await post(), { status: 503, body: { error: 'hub unavailable' } });
    assert.equal(calls.length, 4);
    env.instance.config.hub_url = ''; assert.deepEqual(await post(), { status: 503, body: { error: 'hub unavailable' } });
  } finally { await env.close(); await new Promise(resolve => hub.close(resolve)); }
});
