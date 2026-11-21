'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const EMPTY = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const statePath = (dir, key) => path.join(dir, 'win', 'copies', key);
function readState(dir, key) { try { return JSON.parse(fs.readFileSync(path.join(statePath(dir,key), 'state.json'), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return { last_ok: null, last_failed: null, used_since_ok: false, unresolved: [] }; throw e; } }
function writeState(dir, key, state) { const folder = statePath(dir,key); fs.mkdirSync(folder, { recursive: true }); const target = path.join(folder, 'state.json'); const tmp = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}`; try { fs.writeFileSync(tmp, JSON.stringify(state)); fs.renameSync(tmp, target); } finally { try { fs.unlinkSync(tmp); } catch {} } }
function hasUnresolved(dir, key) { return !!readState(dir,key).unresolved?.length; }
function shellLiteral(s) { return `'${s.replace(/'/g, "''")}'`; }
function script(op, args, body) { return `# wc:${op} ${Buffer.from(JSON.stringify(args)).toString('base64')}\n${body}`; }
function setup(ctx) { const dir = statePath(ctx.stateDir,ctx.key); fs.mkdirSync(dir,{recursive:true}); const empty = path.join(dir,'empty-attributes'); fs.closeSync(fs.openSync(empty,'a')); return empty; }
async function command(ctx, win, args, opts = {}) { const empty = setup(ctx); const env = { GIT_ATTR_NOSYSTEM: '1', ...opts.env }; const emptyFile = win ? ctx.winEnv.toWindows(empty) : empty; const result = await (win ? ctx.winEnv.gitWin : ctx.winEnv.git)([`--attr-source=${EMPTY}`, '-c', `core.attributesFile=${emptyFile}`, '-c', 'core.autocrlf=false', ...args], { ...opts, env }); if (result.code !== 0 && !opts.allowFailure) throw Object.assign(new Error(`git ${args[0]} failed: ${result.stderr}`), { status: 422 }); return result; }
async function ensureCopy(ctx) {
  const { copy, sources = [], winEnv } = ctx; if (fs.existsSync(path.join(copy.linux,'.git'))) return { created: false, seeded_from: null };
  fs.mkdirSync(copy.linux, { recursive: true });
  await command(ctx,true,['init'],{cwd:copy.linux});
  for (const [k,v] of Object.entries({ 'core.autocrlf':'false', 'core.ignorecase':'true', 'core.filemode':'false', 'core.longpaths':'true' })) await command(ctx,true,['config',k,v],{cwd:copy.linux});
  let seeded_from = null;
  if (sources.length) {
    const source = [...sources].sort((a,b) => String(b.last_ok || '').localeCompare(String(a.last_ok || '')))[0]; seeded_from = source.copy;
    await command(ctx,true,['fetch',source.copy.windows,'refs/wheelchair/base'],{cwd:copy.linux});
    const files = await command(ctx,true,['ls-files','--others','--ignored','--exclude-standard','-z'],{cwd:source.copy.linux});
    if (files.stdout.length) {
      const ignored = await command(ctx,false,['check-ignore','--stdin','-z'],{cwd:ctx.worktree,input:files.stdout,allowFailure:true});
      if (ignored.code > 1) throw Object.assign(new Error(`git check-ignore failed: ${ignored.stderr}`),{status:422});
      const paths = ignored.stdout.toString().split('\0').filter(Boolean);
      if (paths.length) {
        const args = { source: source.copy.windows, destination: copy.windows, paths };
        const body = paths.map(p => { const rel = path.win32.dirname(p.replace(/\//g,'\\')); const name = path.win32.basename(p); return `robocopy ${shellLiteral(path.win32.join(source.copy.windows,rel))} ${shellLiteral(path.win32.join(copy.windows,rel))} ${shellLiteral(name)} /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null\nif ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }`; }).join('\n');
        const result = await winEnv.ps(script('seed',args,body)); if (result.code) throw Object.assign(new Error(`seed failed: ${result.stderr}`),{status:422});
      }
    }
  }
  return { created:true, seeded_from };
}
async function deleteCopy(ctx, { saveUnresolved = false } = {}) {
  const { stateDir,key,worktree,threadId,copy } = ctx;
  if (saveUnresolved && hasUnresolved(stateDir,key)) { const ref = `refs/wheelchair/conflicts/${threadId}/${key}/${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(3).toString('hex')}`; const r = await command(ctx,false,['rev-parse','--verify',`refs/wheelchair/${key}/windows`],{cwd:worktree,allowFailure:true}); if (!r.code) await command(ctx,false,['update-ref',ref,r.stdout.toString().trim()],{cwd:worktree}); }
  fs.rmSync(copy.linux,{recursive:true,force:true});
  for (const ref of ['base','windows']) await command(ctx,false,['update-ref','-d',`refs/wheelchair/${key}/${ref}`],{cwd:worktree});
  fs.rmSync(statePath(stateDir,key),{recursive:true,force:true});
}
module.exports = { ensureCopy, readState, writeState, deleteCopy, hasUnresolved };
