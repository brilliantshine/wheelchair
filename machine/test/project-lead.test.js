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
  const allowed = { idea: ['lead'], done: ['lead'], permit: ['lead'], message: ['lead', 'sub-lead', 'worker', 'mapper'], result: ['worker', 'mapper', 'sub-lead'] };
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

test('project lead clone refreshes, contains local branches, and enforces its agent fence', async () => {
  const root = await temp(); const env = await service(root, { realGit: true });
  try {
    const repo = await project(root);
    git(['-C', repo, 'branch', 'wc/other']);
    const body = { role: 'lead', cli: 'codex', thread_id: 'abc', token: 'alpha', project_lead: true, prompt_role: 'project-lead', project_dir: repo, project: 'project', project_machine: 'local', codex_mode: 'unrestricted' };
    const started = await api(env, 'POST', '/v1/sessions', body, hubHeader);
    assert.equal(started.status, 201, JSON.stringify(started.body));
    const clone = started.body.worktree;
    assert.equal(clone, path.join(env.state, 'worktrees', 'project', 'project-lead-abc'));
    assert.equal(git(['-C', clone, 'rev-parse', 'HEAD']).stdout.trim(), git(['-C', repo, 'rev-parse', 'origin/main']).stdout.trim());
    git(['-C', clone, 'rev-parse', '--verify', 'origin/wc/other']);
    assert.notEqual(git(['-C', clone, 'rev-parse', '--verify', 'upstream/wc/other'], { allowFailure: true }).status, 0);
    const prompt = await fs.readFile(path.join(env.state, 'prompts', `${started.body.name}.md`), 'utf8');
    assert.match(prompt, /# The project lead/); assert.match(prompt, /Your project: project on local/); assert.doesNotMatch(prompt, /--- realism.md ---|--- repo-law.md ---/);
    assert.match(await log(env), /workspace-write/); assert.doesNotMatch(await log(env), /dangerously-bypass/);
    await write(path.join(clone, 'README.md'), 'changed');
    await write(path.join(repo, 'README.md'), 'new'); git(['-C', repo, 'add', '.']); git(['-C', repo, 'commit', '-m', 'new']);
    const refresh = await api(env, 'POST', '/v1/project-lead/refresh', { thread_id: 'abc', project_dir: repo }, hubHeader);
    assert.equal(refresh.status, 200); assert.equal(await fs.readFile(path.join(clone, 'README.md'), 'utf8'), 'base\n');
    for (const route of ['session', 'git', 'screen', 'win']) assert.equal((await api(env, 'POST', `/v1/agent/${route}`, {}, { 'x-wheelchair-session-token': 'alpha' })).status, 403);
    assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'file', title: 'x', path: path.join(repo, 'README.md') }, { 'x-wheelchair-session-token': 'alpha' })).status, 403);
    assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'file', title: 'x', path: path.join(clone, 'README.md') }, { 'x-wheelchair-session-token': 'alpha' })).status, 202);
    assert.equal((await api(env, 'POST', '/v1/agent/hooks', {}, { 'x-wheelchair-session-token': 'alpha' })).status, 202);
    await write(path.join(clone, 'test.png'), 'image'); await write(path.join(repo, 'test.png'), 'image');
    assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'image', title: 'x', path: path.join(repo, 'test.png') }, { 'x-wheelchair-session-token': 'alpha' })).status, 403);
    assert.equal((await api(env, 'POST', '/v1/agent/cards', { kind: 'image', title: 'x', path: path.join(clone, 'test.png') }, { 'x-wheelchair-session-token': 'alpha' })).status, 202);
  } finally { await env.close(); }
});

test('refresh selects local defaults and current branch, and rejects an unborn repository', async () => {
  const root = await temp(); const env = await service(root, { realGit: true });
  try {
    for (const branch of ['main', 'master', 'topic']) {
      const repo = path.join(root, branch); await fs.mkdir(repo);
      git(['init', `--initial-branch=${branch}`, repo]); git(['-C', repo, 'config', 'user.name', 'Test']); git(['-C', repo, 'config', 'user.email', 'test@example.test']);
      await write(path.join(repo, 'file'), branch); git(['-C', repo, 'add', '.']); git(['-C', repo, 'commit', '-m', 'initial']);
      const result = await env.instance.projectLead().run(repo, branch, true);
      assert.equal(result.commit, git(['-C', repo, 'rev-parse', 'HEAD']).stdout.trim());
      await write(path.join(repo, 'file'), 'new'); git(['-C', repo, 'add', '.']); git(['-C', repo, 'commit', '-m', 'next']);
      const refreshed = await env.instance.projectLead().run(repo, branch, true);
      assert.equal(refreshed.commit, git(['-C', repo, 'rev-parse', 'HEAD']).stdout.trim());
    }
    const empty = path.join(root, 'empty'); git(['init', '--initial-branch=main', empty]);
    await assert.rejects(env.instance.projectLead().run(empty, 'empty', true), /this project has no branch to read/);
    await assert.rejects(env.instance.projectLead().run(empty, 'missing', false), { status: 404 });
  } finally { await env.close(); }
});

test('refresh keeps the fetched upstream tip during an origin outage', async () => {
  const root = await temp(); const env = await service(root, { realGit: true });
  try {
    const repo = await project(root); const upstream = git(['-C', repo, 'rev-parse', 'origin/main']).stdout.trim();
    await write(path.join(repo, 'README.md'), 'local'); git(['-C', repo, 'add', '.']); git(['-C', repo, 'commit', '-m', 'local']);
    git(['-C', repo, 'remote', 'set-url', 'origin', path.join(root, 'missing')]);
    const result = await env.instance.projectLead().run(repo, 'outage', true);
    assert.equal(result.commit, upstream);
    assert.equal(git(['-C', result.worktree, 'rev-parse', 'origin/main']).stdout.trim(), git(['-C', repo, 'rev-parse', 'main']).stdout.trim());
  } finally { await env.close(); }
});
