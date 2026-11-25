'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

// Workspace harness configuration must not be discovered by a project lead's CLI.
const sparsePatterns = ['/*', '!/.kimi-code/', '!/.agents/', '!/.mcp.json', '!/.claude/', '!/.codex/', '!/.pi/'];

module.exports = function projectLead({ stateDir, commandAsync, inRepoQueue }) {
  const folder = (repo, id) => {
    const name = path.basename(path.resolve(repo));
    if (!name || name === '.' || name === '..') throw Object.assign(new Error('invalid project'), { status: 400 });
    return path.join(stateDir, 'worktrees', name, `project-lead-${id}`);
  };
  const git = (dir, ...args) => commandAsync('git', ['-C', dir, ...args]);
  const required = async (dir, ...args) => { const r = await git(dir, ...args); if (!r.ok) throw new Error(r.stderr.trim() || 'git command failed'); return r.stdout.trim(); };
  const exists = async (dir, ref) => (await git(dir, 'rev-parse', '--verify', `${ref}^{commit}`)).ok;
  async function refresh(repo, clone) {
    const remote = await git(repo, 'remote', 'get-url', 'origin');
    if (remote.ok) await commandAsync('git', ['-C', repo, 'fetch', 'origin'], { timeout: 60000 });
    await required(clone, 'remote', 'set-url', '--push', 'origin', 'no-push-from-project-lead');
    const symbolic = await git(repo, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
    let branch = symbolic.ok && symbolic.stdout.trim().startsWith('origin/') ? symbolic.stdout.trim().slice(7) : null;
    if (!branch) for (const candidate of ['main', 'master']) if (await exists(repo, `refs/heads/${candidate}`)) { branch = candidate; break; }
    if (!branch) { const current = await git(repo, 'symbolic-ref', '--short', 'HEAD'); if (current.ok) branch = current.stdout.trim(); }
    if (!branch) throw Object.assign(new Error('this project has no branch to read'), { status: 409 });
    const upstream = await exists(repo, `refs/remotes/origin/${branch}`);
    const refs = ['+refs/heads/*:refs/remotes/origin/*'];
    if (upstream) refs.push(`+refs/remotes/origin/${branch}:refs/remotes/upstream/${branch}`);
    await required(clone, 'fetch', '--prune', 'origin', ...refs);
    const target = upstream ? `refs/remotes/upstream/${branch}` : `refs/remotes/origin/${branch}`;
    if (!await exists(clone, target)) throw Object.assign(new Error('this project has no branch to read'), { status: 409 });
    await required(clone, 'reset', '--hard', 'HEAD');
    await required(clone, 'clean', '-fdx');
    await required(clone, 'sparse-checkout', 'set', '--no-cone', ...sparsePatterns);
    await required(clone, 'checkout', '--detach', '--force', target);
    await required(clone, 'clean', '-fdx');
    return required(clone, 'rev-parse', 'HEAD');
  }
  return {
    folder,
    async run(repo, id, create) {
      repo = path.resolve(repo);
      const clone = folder(repo, id);
      return inRepoQueue(path.resolve(repo), async () => {
        const present = await fs.stat(clone).then(s => s.isDirectory(), () => false);
        if (!present && !create) throw Object.assign(new Error('not found'), { status: 404 });
        if (!present) { await fs.mkdir(path.dirname(clone), { recursive: true }); const r = await commandAsync('git', ['clone', repo, clone]); if (!r.ok) throw new Error(r.stderr.trim() || 'git clone failed'); }
        return { worktree: clone, commit: await refresh(repo, clone) };
      });
    },
  };
};
