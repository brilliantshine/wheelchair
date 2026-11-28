'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawn } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir.js');
const cli = path.resolve(__dirname, '../app/wc.js');
function repo() {
  const dir = makeTempSync('wc cli space ');
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.com');
  fs.writeFileSync(path.join(dir, 'seed'), 'seed\n'); git('add', '.'); git('commit', '-qm', 'base'); git('branch', 'base');
  return { dir, git };
}
function write(dir, name, value) { const p = path.join(dir, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, value); }
function size(dir, ...args) { const env = { ...process.env }; delete env.WHEELCHAIR_SESSION_TOKEN; return JSON.parse(execFileSync(process.execPath, [cli, 'diff', 'size', 'base', 'HEAD', ...args], { cwd: dir, env, encoding: 'utf8' })); }
function commit(git) { git('add', '-A'); git('commit', '-qm', 'change'); }
test('line bands and tricky', () => {
  for (const [n, band] of [[199, 'scout'], [200, 'bigger-scout'], [800, 'bigger-scout'], [801, 'self']]) {
    const { dir, git } = repo(); write(dir, 'file', 'x\n'.repeat(n)); commit(git);
    assert.equal(size(dir).lines, n); assert.equal(size(dir).band, band); assert.equal(size(dir, '--tricky').band, 'self');
  }
});
test('excluded paths, raw names, subdirectories and executable scout diff', () => {
  const { dir, git } = repo(); write(dir, 'docs/plans/a[*].md', 'secret\n'); write(dir, 'src/a', 'visible\n'); commit(git);
  const result = size(dir); assert.equal(result.lines, 1); assert.deepEqual(result.excluded_paths, [{ status: 'A', old: null, new: 'docs/plans/a[*].md' }]);
  assert.deepEqual(size(path.join(dir, 'src')), result);
  const diff = execFileSync('sh', ['-c', result.scout_diff], { cwd: '/', encoding: 'utf8' }); assert.match(diff, /visible/); assert.doesNotMatch(diff, /secret/);
});
test('only excluded changes and exact file or symlink', () => {
  for (const type of ['nested', 'file', 'symlink']) {
    const { dir, git } = repo(); fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    if (type === 'nested') write(dir, 'docs/plans/x', 'hidden\n');
    else if (type === 'file') write(dir, 'docs/plans', 'hidden\n');
    else fs.symlinkSync('../seed', path.join(dir, 'docs/plans'));
    commit(git); const result = size(dir); assert.equal(result.lines, 0); assert.equal(result.band, 'scout'); assert.equal(size(dir, '--tricky').band, 'self');
    assert.equal(result.excluded_paths[0].new, type === 'nested' ? 'docs/plans/x' : 'docs/plans');
  }
});
test('renames across exclusion with renames disabled in config', () => {
  const { dir, git } = repo(); write(dir, 'src/x.js', 'unique x\n'); write(dir, 'docs/plans/y.md', 'unique y\n'); git('add', '.'); git('commit', '-qm', 'sources'); git('branch', '-f', 'base');
  fs.renameSync(path.join(dir, 'src/x.js'), path.join(dir, 'docs/plans/x.js')); fs.renameSync(path.join(dir, 'docs/plans/y.md'), path.join(dir, 'src/y.md')); git('config', 'diff.renames', 'false'); commit(git);
  assert.deepEqual(size(dir).excluded_paths, [{ status: 'R100', old: 'src/x.js', new: 'docs/plans/x.js' }, { status: 'R100', old: 'docs/plans/y.md', new: 'src/y.md' }]);
});
test('binary counts zero and errors are prefixed', () => {
  const { dir, git } = repo(); write(dir, 'binary', Buffer.from([0, 1, 2])); commit(git); assert.equal(size(dir).lines, 0);
  assert.throws(() => execFileSync(process.execPath, [cli, 'diff', 'size', 'base'], { cwd: dir, stdio: 'pipe' }), e => e.status === 1 && e.stderr.toString().startsWith('wc:'));
});
test('session output compact and full', async () => {
  const dir = makeTempSync('wc session '); const brief = path.join(dir, 'brief'); fs.writeFileSync(brief, 'work');
  const session = { name: 'worker', role: 'worker', branch: 'branch', worktree: '/tree', status: 'running', command: 'secret', extra: 1 };
  const received = []; const server = http.createServer(async (req, res) => { let body = ''; for await (const chunk of req) body += chunk; const input = JSON.parse(body); received.push(input); res.end(JSON.stringify(input.action === 'list' ? { sessions: [session], review_families: 'both' } : { session, note: 'note' })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const run = args => new Promise((resolve, reject) => { const child = spawn(process.execPath, [cli, 'session', ...args], { env: { ...process.env, WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}`, WHEELCHAIR_SESSION_TOKEN: 'test' } }); let out = ''; child.stdout.on('data', c => out += c); child.on('error', reject); child.on('close', code => code ? reject(new Error(`exit ${code}`)) : resolve(JSON.parse(out))); });
  try {
    const list = await run(['list']); assert.deepEqual(list, { sessions: [{ name: 'worker', role: 'worker', status: 'running', branch: 'branch', worktree: '/tree' }], review_families: 'both' });
    assert.deepEqual(await run(['list', '--full']), { sessions: [session], review_families: 'both' });
    const args = ['start', '--role', 'worker', '--attempt', 'a', '--brief-file', brief];
    assert.deepEqual(await run(args), { session: list.sessions[0], note: 'note' }); assert.deepEqual(await run([...args, '--full']), { session, note: 'note' });
    assert.ok(received.every(body => !Object.hasOwn(body, 'full')));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('session leads sends the all-projects flag and prints the response', async () => {
  const received = []; const server = http.createServer(async (req, res) => { let body = ''; for await (const chunk of req) body += chunk; received.push(JSON.parse(body)); res.end(JSON.stringify({ leads: [{ thread: 'a' }] })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const run = args => new Promise((resolve, reject) => { const child = spawn(process.execPath, [cli, 'session', 'leads', ...args], { env: { ...process.env, WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}`, WHEELCHAIR_SESSION_TOKEN: 'test' } }); let out = ''; child.stdout.on('data', c => out += c); child.on('error', reject); child.on('close', code => code ? reject(new Error(`exit ${code}`)) : resolve(out)); });
  try { assert.equal(await run([]), '{"leads":[{"thread":"a"}]}\n'); assert.equal(await run(['--all-projects']), '{"leads":[{"thread":"a"}]}\n'); assert.deepEqual(received, [{ action: 'leads', all_projects: false }, { action: 'leads', all_projects: true }]); } finally { await new Promise(resolve => server.close(resolve)); }
});

test('assistant settings reads retry and setting writes do not', async () => {
  const dir = makeTempSync('wc assistant '); const file = path.join(dir, 'payload.json');
  fs.writeFileSync(file, JSON.stringify({ enabled: true, nested: { value: 1 } }));
  const received = []; let response = () => ({ status: 200, body: { ok: true } });
  const server = http.createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk;
    received.push({ path: req.url, body: JSON.parse(text) });
    const result = response(); res.statusCode = result.status; res.end(JSON.stringify(result.body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const run = (group, args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, group, ...args], { env: { ...process.env, WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}`, WHEELCHAIR_SESSION_TOKEN: 'test' } });
    let out = ''; child.stdout.on('data', c => out += c); child.on('error', reject); child.on('close', code => resolve({ code, out }));
  });
  try {
    for (const extra of [[], ['--include-history']]) {
      received.length = 0; let calls = 0;
      response = () => ++calls === 1 ? { status: 503, body: { error: 'hub unavailable' } } : { status: 200, body: { ok: true } };
      assert.deepEqual(await run('assistant', ['settings', ...extra]), { code: 0, out: '{"ok":true}\n' });
      const body = { action: 'settings', ...(extra.length ? { include_history: true } : {}) };
      assert.deepEqual(received, [{ path: '/assistant', body }, { path: '/assistant', body }]);
    }
    received.length = 0; response = () => ({ status: 200, body: { ok: true } });
    assert.deepEqual(await run('assistant', ['setting', 'preferences', '--file', file]), { code: 0, out: '{"ok":true}\n' });
    assert.deepEqual(received, [{ path: '/assistant', body: { action: 'setting', target: 'preferences', payload: { enabled: true, nested: { value: 1 } } } }]);
    for (const [status, error] of [[503, 'hub unavailable'], [409, 'Background changed elsewhere']]) {
      received.length = 0; response = () => ({ status, body: { error } });
      assert.deepEqual(await run('assistant', ['setting', 'background', '--file', file]), { code: 0, out: `${JSON.stringify({ ok: false, error })}\n` });
      assert.equal(received.length, 1);
    }
    for (const args of [['setting'], ['setting', 'target'], ['setting', '--file', file]]) {
      assert.deepEqual(await run('assistant', args), { code: 0, out: '{"ok":false,"error":"setting requires <target> and --file"}\n' });
    }
    for (const value of ['{', 'null', '[]', '123', '"text"', 'true']) {
      fs.writeFileSync(file, value);
      assert.deepEqual(await run('assistant', ['setting', 'target', '--file', file]), { code: 0, out: '{"ok":false,"error":"setting --file must contain a JSON object"}\n' });
    }
    for (const operation of ['settings', 'setting']) {
      assert.deepEqual(await run('project-lead', [operation]), { code: 0, out: '{"ok":false,"error":"unsupported assistant action"}\n' });
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
