'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const EMPTY = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const locks = new Map();

function statePath(dir, key) {
  return path.join(dir, 'win', 'copies', key);
}

function readState(dir, key) {
  try {
    return JSON.parse(fs.readFileSync(path.join(statePath(dir, key), 'state.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { last_ok: null, last_failed: null, used_since_ok: false, unresolved: [] };
    throw error;
  }
}

function writeState(dir, key, state) {
  const folder = statePath(dir, key);
  fs.mkdirSync(folder, { recursive: true });
  const target = path.join(folder, 'state.json');
  const temporary = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(state));
    fs.renameSync(temporary, target);
  } finally {
    try { fs.unlinkSync(temporary); } catch {}
  }
}

function hasUnresolved(dir, key) {
  return !!readState(dir, key).unresolved?.length;
}

function shellLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function script(op, args, body) {
  return `# wc:${op} ${Buffer.from(JSON.stringify(args)).toString('base64')}\n${body}`;
}

function setup(ctx) {
  const dir = statePath(ctx.stateDir, ctx.key);
  fs.mkdirSync(dir, { recursive: true });
  const empty = path.join(dir, 'empty-attributes');
  fs.closeSync(fs.openSync(empty, 'a'));
  return empty;
}

async function command(ctx, win, args, opts = {}) {
  const empty = setup(ctx);
  const env = { GIT_ATTR_NOSYSTEM: '1', ...opts.env };
  const emptyFile = win ? ctx.winEnv.toWindows(empty) : empty;
  const result = await (win ? ctx.winEnv.gitWin : ctx.winEnv.git)(
    [`--attr-source=${EMPTY}`, '-c', `core.attributesFile=${emptyFile}`, '-c', 'core.autocrlf=false', ...args],
    { ...opts, env }
  );
  if (result.code !== 0 && !opts.allowFailure) {
    throw Object.assign(new Error(`git ${args[0]} failed: ${result.stderr}`), { status: 422 });
  }
  return result;
}

async function ensureCopy(ctx) {
  const { copy, sources = [], winEnv } = ctx;
  if (fs.existsSync(path.join(copy.linux, '.git'))) return { created: false, seeded_from: null };
  fs.mkdirSync(copy.linux, { recursive: true });
  await command(ctx, true, ['init'], { cwd: copy.linux });
  const config = { 'core.autocrlf': 'false', 'core.ignorecase': 'true', 'core.filemode': 'false', 'core.longpaths': 'true' };
  for (const [key, value] of Object.entries(config)) {
    await command(ctx, true, ['config', key, value], { cwd: copy.linux });
  }
  let seeded_from = null;
  if (sources.length) {
    const source = [...sources].sort((a, b) => String(b.last_ok || '').localeCompare(String(a.last_ok || '')))[0];
    seeded_from = source.copy;
    await command(ctx, true, ['fetch', source.copy.windows, 'refs/wheelchair/base'], { cwd: copy.linux });
    const files = await command(ctx, true, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z'], { cwd: source.copy.linux });
    if (files.stdout.length) {
      const ignored = await command(ctx, false, ['check-ignore', '--stdin', '-z'], { cwd: ctx.worktree, input: files.stdout, allowFailure: true });
      if (ignored.code > 1) throw Object.assign(new Error(`git check-ignore failed: ${ignored.stderr}`), { status: 422 });
      const paths = ignored.stdout.toString().split('\0').filter(Boolean);
      if (paths.length) {
        const args = { source: source.copy.windows, destination: copy.windows, paths };
        const body = paths.map(relative => {
          const dir = path.win32.dirname(relative.replace(/\//g, '\\'));
          const name = path.win32.basename(relative);
          return `robocopy ${shellLiteral(path.win32.join(source.copy.windows, dir))} ${shellLiteral(path.win32.join(copy.windows, dir))} ${shellLiteral(name)} /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null\nif ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }`;
        }).join('\n');
        const result = await winEnv.ps(script('seed', args, body));
        if (result.code) throw Object.assign(new Error(`seed failed: ${result.stderr}`), { status: 422 });
      }
    }
  }
  return { created: true, seeded_from };
}

function conflictRef(ctx) {
  return `refs/wheelchair/conflicts/${ctx.threadId}/${ctx.key}/${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
}

async function deleteCopy(ctx, { saveUnresolved = false } = {}) {
  const { stateDir, key, worktree, copy } = ctx;
  if (saveUnresolved && hasUnresolved(stateDir, key)) {
    const result = await command(ctx, false, ['rev-parse', '--verify', `refs/wheelchair/${key}/windows`], { cwd: worktree, allowFailure: true });
    if (!result.code) await command(ctx, false, ['update-ref', conflictRef(ctx), result.stdout.toString().trim()], { cwd: worktree });
  }
  fs.rmSync(copy.linux, { recursive: true, force: true });
  for (const ref of ['base', 'windows']) {
    await command(ctx, false, ['update-ref', '-d', `refs/wheelchair/${key}/${ref}`], { cwd: worktree });
  }
  fs.rmSync(statePath(stateDir, key), { recursive: true, force: true });
}

function indexOptions(ctx, win) {
  return {
    cwd: win ? ctx.copy.linux : ctx.worktree,
    env: { GIT_INDEX_FILE: win ? '.git/wheelchair.index' : path.join(statePath(ctx.stateDir, ctx.key), 'linux.index') }
  };
}

function entries(output) {
  return output.toString().split('\0').filter(Boolean);
}

async function snapshot(ctx, win) {
  const options = indexOptions(ctx, win);
  const indexPath = win ? path.join(ctx.copy.linux, '.git/wheelchair.index') : options.env.GIT_INDEX_FILE;
  if (!fs.existsSync(indexPath)) {
    await command(ctx, win, win ? ['read-tree', '--empty'] : ['read-tree', 'HEAD'], options);
  }
  const real = await command(ctx, win, ['ls-files', '-z'], { cwd: options.cwd });
  const indexed = await command(ctx, win, ['ls-files', '-z'], options);
  const realPaths = new Set(entries(real.stdout));
  const indexPaths = new Set(entries(indexed.stdout));
  const force = [...realPaths].filter(file => !indexPaths.has(file) && fs.existsSync(path.join(options.cwd, file)));
  if (force.length) await command(ctx, win, ['add', '-f', '--', ...force], options);
  const ignored = await command(ctx, win, ['ls-files', '-ci', '--exclude-standard', '-z'], options);
  const remove = entries(ignored.stdout).filter(file => !realPaths.has(file));
  if (remove.length) await command(ctx, win, ['rm', '--cached', '--ignore-unmatch', '--', ...remove], options);
  await command(ctx, win, ['add', '-A'], options);
  const result = await command(ctx, win, ['write-tree'], options);
  return result.stdout.toString().trim();
}

const identity = {
  GIT_AUTHOR_NAME: 'Wheelchair', GIT_AUTHOR_EMAIL: 'wheelchair@localhost',
  GIT_COMMITTER_NAME: 'Wheelchair', GIT_COMMITTER_EMAIL: 'wheelchair@localhost'
};

async function commitTree(ctx, win, tree, parent) {
  const args = ['commit-tree', tree];
  if (parent) args.push('-p', parent);
  const result = await command(ctx, win, args, { cwd: win ? ctx.copy.linux : ctx.worktree, env: identity, input: 'Wheelchair snapshot\n' });
  return result.stdout.toString().trim();
}

async function resolveRef(ctx, ref) {
  const result = await command(ctx, false, ['rev-parse', '--verify', ref], { cwd: ctx.worktree, allowFailure: true });
  return result.code ? null : result.stdout.toString().trim();
}

async function changedPaths(ctx, before, after) {
  const result = await command(ctx, false, ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', before, after], { cwd: ctx.worktree });
  return entries(result.stdout);
}

async function reconcileAttempt(ctx, hooks) {
  const baseRef = `refs/wheelchair/${ctx.key}/base`;
  const windowsRef = `refs/wheelchair/${ctx.key}/windows`;
  const base = await resolveRef(ctx, baseRef);
  const linuxTree = await snapshot(ctx, false);
  const windowsTree = await snapshot(ctx, true);
  const windowsCommit = await commitTree(ctx, true, windowsTree);
  await command(ctx, true, ['update-ref', 'refs/wheelchair/snapshot', windowsCommit], { cwd: ctx.copy.linux });
  await command(ctx, false, ['fetch', ctx.copy.linux, `+refs/wheelchair/snapshot:${windowsRef}`], { cwd: ctx.worktree });
  if (hooks?.afterSnapshot) await hooks.afterSnapshot();
  const linuxCommit = await commitTree(ctx, false, linuxTree, base);
  let resultTree = linuxTree;
  if (base) {
    const baseTree = (await command(ctx, false, ['rev-parse', `${base}^{tree}`], { cwd: ctx.worktree })).stdout.toString().trim();
    if (linuxTree === baseTree) resultTree = windowsTree;
    else if (windowsTree !== baseTree && windowsTree !== linuxTree) {
      const mergeWindows = await commitTree(ctx, false, windowsTree, base);
      const merge = await command(ctx, false, ['merge-tree', '--write-tree', `--merge-base=${base}`, linuxCommit, mergeWindows], { cwd: ctx.worktree, allowFailure: true });
      if (merge.code) throw Object.assign(new Error(`merge failed: ${merge.stdout.toString()} ${merge.stderr}`), { status: 422 });
      resultTree = merge.stdout.toString().trim();
    }
  }
  const result = await commitTree(ctx, false, resultTree, base);
  const toWindows = await changedPaths(ctx, windowsTree, resultTree);
  const toLinux = await changedPaths(ctx, linuxTree, resultTree);
  const linuxApply = await command(ctx, false, ['read-tree', '-m', '-u', linuxCommit, result], { ...indexOptions(ctx, false), allowFailure: true });
  if (linuxApply.code) throw Object.assign(new Error(`Linux apply failed: ${linuxApply.stderr}`), { status: 422 });
  await command(ctx, false, ['push', ctx.copy.linux, `${result}:refs/wheelchair/linux`], { cwd: ctx.worktree });
  const windowsApply = await command(ctx, true, base ? ['read-tree', '-m', '-u', windowsCommit, result] : ['read-tree', '--reset', '-u', result], { ...indexOptions(ctx, true), allowFailure: true });
  if (windowsApply.code) throw Object.assign(new Error(`Windows apply failed: ${windowsApply.stderr}`), { status: 422 });
  await command(ctx, false, ['update-ref', baseRef, result], { cwd: ctx.worktree });
  await command(ctx, true, ['update-ref', 'refs/wheelchair/base', result], { cwd: ctx.copy.linux });
  return { to_windows: toWindows, to_linux: toLinux, conflicts: [], unresolved: [], skipped: [] };
}

async function reconcileUnlocked(ctx, hooks) {
  const state = readState(ctx.stateDir, ctx.key);
  try {
    const result = await reconcileAttempt(ctx, hooks);
    state.last_ok = new Date().toISOString();
    state.last_failed = null;
    state.used_since_ok = false;
    state.unresolved = result.unresolved;
    writeState(ctx.stateDir, ctx.key, state);
    return result;
  } catch (error) {
    error.status = 422;
    state.last_failed = { reason: error.message, at: new Date().toISOString() };
    writeState(ctx.stateDir, ctx.key, state);
    throw error;
  }
}

async function reconcile(ctx, { hooks } = {}) {
  const key = path.resolve(ctx.worktree) + '\0' + ctx.key;
  const previous = locks.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => reconcileUnlocked(ctx, hooks));
  locks.set(key, current);
  try {
    return await current;
  } finally {
    if (locks.get(key) === current) locks.delete(key);
  }
}

module.exports = { ensureCopy, reconcile, readState, writeState, deleteCopy, hasUnresolved };
