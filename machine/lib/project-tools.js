'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { entryReason, checkDocumentText } = require('./project-mcp');
const folderTools = require('./folder-tools');
const connectors = require('../../connectors');
const projectConnectors = connectors.list().filter(m => m.capabilities.projectTools).map(m => connectors.machine(m.cli));
const { KEY_NAME, reservedNames, isReserved, keyReferences, projectIdentity, readKeyStore, writeKeyStore, usableReason } = require('./project-keys');
const { readSharedKeys } = require('./shared-keys');
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const reason = r => (r.stderr || r.stdout || 'command failed').trim();
const keys = store => Object.keys(store.keys);
const refused = (reason, status = 400) => ({ status, body: { outcome: 'refused', reason } });
const changed = () => refused('changed since you opened it', 409);
const encBranch = b => encodeURIComponent(b).replace(/%2F/gi, '/');
function repoName(url) {
  const m = /^(?:https:\/\/github\.com\/|ssh:\/\/(?:git@)?github\.com\/|git@github\.com:)([a-z0-9_.-]+)\/([a-z0-9_.-]+?)(?:\.git)?$/i.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}
function checksFor(servers, store) {
  const checks = Object.create(null), valid = Object.create(null), { references, heldBack } = keyReferences(servers);
  for (const [name, entry] of Object.entries(servers)) {
    const skip = [], key_warnings = [], why = entryReason(name, entry);
    if (why) skip.push(why);
    else { Object.defineProperty(valid, name, { value: entry, enumerable: true }); for (const connector of projectConnectors) { const reason = connector.projectToolReason(name, entry); if (reason) skip.push(reason); } }
    for (const [key, tools] of Object.entries(references)) if (tools.includes(name)) {
      if (!Object.hasOwn(store.keys, key)) key_warnings.push(`needs ${key}, not set on this machine`);
      for (const item of heldBack[key] || []) key_warnings.push(`${key} is held back: also used in ${item.field}`);
    }
    const keys = Object.keys(references).filter(key => references[key].includes(name)).sort();
    const held_back = Object.keys(heldBack).filter(key => heldBack[key].some(item => item.tool === name)).sort();
    Object.defineProperty(checks, name, { value: { skip, key_warnings, keys, held_back }, enumerable: true });
  }
  return { checks, references, file_warnings: projectConnectors.map(connector => connector.projectToolFileWarning(valid)).filter(Boolean) };
}
const marks = document => object(document?.wheelchair) && Array.isArray(document.wheelchair.windows) && document.wheelchair.windows.every(x => typeof x === 'string') ? document.wheelchair.windows : [];
function validateName(name) { if (!KEY_NAME.test(name)) return `invalid key name: ${name}`; if (isReserved(name)) return `${name} can't be set here: it would change how the agent itself runs`; return null; }
function createProjectTools({ commandAsync, stateDir, wsl = () => false, id = () => crypto.randomBytes(6).toString('hex') }) {
  const run = (program, args, options = {}) => commandAsync(program, args, { ...options, timeout: 60000, env: { ...process.env, GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' } });
  const git = (dir, ...args) => run('git', ['-C', dir, ...args]);
  const identity = dir => projectIdentity(dir, (p, a) => run(p, a));
  const must = async promise => { const r = await promise; if (!r.ok) throw new Error(reason(r)); return r.stdout; };
  async function remote(dir) {
    const a = await git(dir, 'config', '--get-all', 'remote.origin.url'), b = await git(dir, 'config', '--get-all', 'remote.origin.pushurl');
    if (!a.ok || (!b.ok && b.status !== 1)) return null;
    const urls = a.stdout.trim().split('\n'), pushes = b.ok ? b.stdout.trim().split('\n') : urls;
    if (urls.length !== 1 || pushes.length !== 1) return null;
    const push = pushes[0];
    const repo = repoName(urls[0]), pushRepo = repoName(push);
    return repo && pushRepo && repo.toLowerCase() === pushRepo.toLowerCase() ? { repo, url: push.trim() } : null;
  }
  async function sourceAt(dir, ref) {
    const tree = await must(git(dir, 'ls-tree', ref, '--', '.mcp.json'));
    if (!tree.trim()) return { state: 'missing', reason: null, document: null, mode: null, oid: null };
    const m = /^(\d+) (\S+) ([0-9a-f]+)\t/.exec(tree);
    if (!m) throw new Error('invalid git ls-tree response');
    const [, mode, type, oid] = m;
    if (!['100644', '100755'].includes(mode) || type !== 'blob') return { state: 'unreadable', reason: 'not a regular file; edit it by hand or Start over', document: null, mode, oid };
    const text = await must(git(dir, 'cat-file', 'blob', oid)), checked = checkDocumentText(text);
    return checked.ok ? { state: 'ok', reason: null, document: checked.data, mode, oid } : { state: 'unreadable', reason: checked.reason, document: null, mode, oid };
  }
  async function fetched(dir, destination, action, includeSource = true) {
    const output = await must(git(dir, 'ls-remote', '--symref', destination.url, 'HEAD'));
    const match = /^ref: refs\/heads\/(.+)\s+HEAD$/m.exec(output);
    if (!match) throw new Error('could not determine default branch');
    const branch = match[1], ref = `refs/wheelchair/tools/${id()}`;
    try {
      await must(git(dir, 'fetch', '--no-write-fetch-head', '--no-tags', destination.url, `+refs/heads/${branch}:${ref}`));
      return await action({ branch, ref, source: includeSource ? await sourceAt(dir, ref) : null });
    } finally { await git(dir, 'update-ref', '-d', ref); }
  }
  async function project(dir) { if (typeof dir !== 'string' || !dir) throw new Error('invalid project path'); return identity(dir); }
  async function folderRows(dir, ref) {
    const base = '.wheelchair/tools';
    const listing = await must(git(dir, '--literal-pathspecs', 'ls-tree', '-z', ref, '--', base + '/'));
    const rows = [];
    for (const item of listing.split('\0').filter(Boolean)) {
      const match = /^(\d+) (\S+) ([0-9a-f]+)\t([\s\S]+)$/.exec(item);
      if (!match || match[2] !== 'tree') continue;
      const name = match[4].slice(base.length + 1), toolDir = path.resolve(dir, base, name);
      const row = { name, source: 'project', dir: toolDir, kind: null, tool: null, status: 'invalid', reason: null };
      const file = await must(git(dir, '--literal-pathspecs', 'ls-tree', '-z', ref, '--', `${base}/${name}/tool.json`));
      const meta = /^(\d+) (\S+) ([0-9a-f]+)\t/.exec(file);
      if (!meta) row.reason = 'tool.json is missing';
      else if (!['100644', '100755'].includes(meta[1]) || meta[2] !== 'blob') row.reason = 'tool.json is not a regular file';
      else {
        const size = Number((await must(git(dir, 'cat-file', '-s', meta[3]))).trim());
        if (size > 32768) row.reason = 'tool.json is over 32 KiB';
        else {
          const content = await must(git(dir, 'cat-file', 'blob', meta[3]));
          let value; try { value = JSON.parse(content); } catch { row.reason = 'tool.json is not JSON'; }
          if (!row.reason) {
            if (['script', 'server'].includes(value?.kind)) row.kind = value.kind;
            const checked = folderTools.validateToolJson(name, value);
            if (!checked.ok) row.reason = checked.reason;
            else { row.kind = checked.tool.kind; row.tool = checked.tool; row.status = 'ok'; }
          }
        }
      }
      if (row.status === 'ok' && row.tool.transport !== 'http') {
        const program = row.kind === 'script' ? row.tool.run[0] : row.tool.start[0];
        let found;
        let notExecutable = false;
        if (program.includes('/') && !path.isAbsolute(program)) {
          const folder = `${base}/${name}`, target = path.posix.normalize(`${folder}/${program}`);
          const result = target !== '..' && !target.startsWith('../') ? await must(git(dir, '--literal-pathspecs', 'ls-tree', ref, '--', target)) : '';
          found = /^100755 blob /.test(result) || (target.startsWith(folder + '/') && /^120000 blob /.test(result));
          notExecutable = /^100644 blob /.test(result);
        } else found = folderTools.findProgram(program, toolDir, process.env.PATH);
        if (!found) { row.status = 'missing-program'; row.reason = notExecutable ? `its program ${program} isn't executable` : `its program ${program} wasn't found`; }
      }
      rows.push(row);
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }
  const folderError = e => `couldn't list folder tools: ${String(e?.message || e).replace(/\s+/g, ' ').trim()}`;
  async function folderListing(input, origin, projectRows = null) {
    const result = { rows: projectRows || [], notes: [] };
    if (!origin) result.notes.push('folder tools can only be listed for GitHub projects');
    else if (!projectRows) try { result.rows = await fetched(input.path, origin, ({ ref }) => folderRows(input.path, ref), false); }
    catch (e) { result.notes.push(folderError(e)); }
    const choice = input.shared_tools;
    try { if (choice && typeof choice.repo === 'string' && Array.isArray(choice.candidates) && origin?.repo.toLowerCase() !== choice.repo.toLowerCase()) {
      const shared = require('./shared-tools');
      const projectPath = await shared.findSharedProject(choice.repo, choice.candidates);
      if (!projectPath) result.notes.push("the shared tools project isn't added on this machine");
      else {
        const id = await shared.identityFor(projectPath), copy = shared.newestCopy(stateDir, id);
        if (!copy) {
          result.notes.push('no shared copy on this machine yet');
          const last = shared.lastRefresh(stateDir, id);
          if (last && !last.ok) result.notes.push(`last refresh failed: ${last.error}`);
        } else {
          const discovered = await folderTools.discover({ worktree: copy, shared: null, path: process.env.PATH });
          const names = new Set(result.rows.map(row => row.name));
          for (const row of discovered.rows) {
            row.source = 'shared';
            if (names.has(row.name)) { row.status = 'hidden'; row.reason = 'hidden: this project has its own tool with the same name'; }
            if (!origin) row.note = "not checked against this project's own tools";
            result.rows.push(row);
          }
        }
      }
    }
    } catch (e) { result.notes.push(folderError(e)); }
    return result;
  }
  async function decorate(input, origin, listing, store) {
    const ownShared = !!(origin && typeof input.shared_tools?.repo === 'string' && origin.repo.toLowerCase() === input.shared_tools.repo.toLowerCase());
    let shared; try { shared = await readSharedKeys(stateDir); } catch { shared = { keys: {} }; listing.notes.push("the shared key store on this machine can't be read"); }
    const declarations = new Map();
    for (const row of listing.rows) {
      if (row.status === 'hidden' || !row.tool?.keys?.length) continue;
      const names = row.tool.keys, keyStore = folderTools.toolKeyStore(row, ownShared);
      const source = keyStore === 'shared' ? shared : store;
      const missing = names.filter(name => !Object.hasOwn(source.keys, name) || usableReason(source.keys[name]));
      row.keys = names; row.key_store = keyStore; row.key_missing = !!missing.length;
      row.key_lines = missing.length ? [`needs ${missing.length === 1 ? 'key' : 'keys'} ${missing.join(', ')}, not set on this machine${ownShared ? '; set it in Settings, Shared tools, Shared keys' : ''}`] : row.status === 'ok' && row.kind === 'script' ? ['uses keys: not available over MCP on Kimi or Pi'] : [];
      if (keyStore === 'project') for (const name of names) { if (!declarations.has(name)) declarations.set(name, []); declarations.get(name).push(row.name); }
    }
    return [...new Set([...Object.keys(store.keys), ...declarations.keys()])].sort().map(name => {
      const stored = Object.hasOwn(store.keys, name), why = stored ? usableReason(store.keys[name]) : null;
      return { name, stored, folder_usable: stored ? !why : null, reason: why, tools: (declarations.get(name) || []).sort() };
    });
  }
  async function keyStatus(input) {
    let projectId; try { projectId = await project(input.path); } catch (e) { return refused(e.message); }
    let store; try { store = await readKeyStore(stateDir, projectId); } catch (e) { return { status: 502, body: { outcome: 'failed', error: e.message } }; }
    const configured = await git(input.path, 'config', '--get-all', 'remote.origin.url');
    const urls = configured.ok ? configured.stdout.trim().split('\n') : [];
    const repo = urls.length === 1 ? repoName(urls[0]) : null, origin = repo ? { repo, url: urls[0] } : null;
    const destination = await remote(input.path);
    const folder_tools = await folderListing(input, destination || origin);
    const key_info = await decorate(input, origin, folder_tools, store);
    return { status: 200, body: { key_revision: store.revision, keys: keys(store), key_info, folder_tools } };
  }
  async function read(input) {
    let projectId; try { projectId = await project(input.path); } catch (e) { return refused(e.message); }
    if (input.repo_only === true) {
      const configured = await git(input.path, 'config', '--get-all', 'remote.origin.url');
      const urls = configured.ok ? configured.stdout.trim().split('\n') : [];
      return { status: 200, body: { repo: urls.length === 1 ? repoName(urls[0]) : null } };
    }
    let store, notice = null;
    try { store = await readKeyStore(stateDir, projectId); } catch (e) { store = { revision: 0, keys: Object.create(null) }; notice = "the key store on this machine can't be read"; }
    const base = { wsl: !!wsl(), windows: [], mode: 'keys-only', notice: "Tools can't be shown or edited here: pull requests need a GitHub origin", repo: null, default_branch: null, token: { project: projectId, baseline: null, key_revision: store.revision }, source: null, checks: Object.create(null), file_warnings: [], keys: keys(store), references: Object.create(null), reserved: reservedNames(), waiting: [], waiting_error: null };
    const configured = await git(input.path, 'config', '--get-all', 'remote.origin.url');
    const urls = configured.ok ? configured.stdout.trim().split('\n') : [];
    const originRepo = urls.length === 1 ? repoName(urls[0]) : null;
    const origin = originRepo ? { repo: originRepo, url: urls[0] } : null;
    base.repo = originRepo;
    const destination = await remote(input.path);
    if (!destination) base.folder_tools = await folderListing(input, origin);
    if (!destination) { base.key_info = await decorate(input, origin, base.folder_tools, store); if (notice) base.notice += `; ${notice}`; return { status: 200, body: base }; }
    try {
      return await fetched(input.path, destination, async ({ branch, ref, source }) => {
        let rows = [], folderFailure = null;
        try { rows = await folderRows(input.path, ref); } catch (e) { folderFailure = folderError(e); }
        base.folder_tools = await folderListing(input, origin, rows);
        if (folderFailure) base.folder_tools.notes.unshift(folderFailure);
        base.key_info = await decorate(input, origin, base.folder_tools, store);
        const result = { ...base, mode: 'tools', notice, repo: destination.repo, default_branch: branch, source: { state: source.state, reason: source.reason, document: source.document }, token: { ...base.token, baseline: { repo: destination.repo, source_state: source.state, branch, mode: source.mode, oid: source.oid } } };
        if (source.document) { result.windows = marks(source.document); Object.assign(result, checksFor(source.document.mcpServers, store)); }
        const listed = await run('gh', ['pr', 'list', '--repo', destination.repo, '--base', branch, '--state', 'open', '--limit', '1000', '--json', 'number,url,title,headRefName,isCrossRepository']);
        if (!listed.ok) result.waiting_error = reason(listed);
        else try { result.waiting = JSON.parse(listed.stdout).filter(p => !p.isCrossRepository && p.headRefName.startsWith('wc-tools/')).map(p => ({ number: p.number, url: p.url, title: p.title, branch: p.headRefName })); } catch { result.waiting_error = 'invalid pull request response'; }
        return { status: 200, body: result };
      });
    } catch (e) { if (!base.folder_tools) { base.folder_tools = await folderListing(input, origin, []); base.folder_tools.notes.unshift(folderError(e)); } base.key_info = await decorate(input, origin, base.folder_tools, store); base.mode = 'unreachable'; base.notice = `Couldn't reach GitHub: ${e.message}${notice ? `; ${notice}` : ''}`; return { status: 200, body: base }; }
  }
  async function save(input) {
    let projectId; try { projectId = await project(input.path); } catch (e) { return refused(e.message); }
    let store; try { store = await readKeyStore(stateDir, projectId); } catch (e) { return { status: 502, body: { outcome: 'failed', key_revision: 0, keys: [], error: "the key store on this machine can't be read" } }; }
    const failed = error => ({ status: 502, body: { outcome: 'failed', key_revision: store.revision, keys: keys(store), error: error.message || String(error) } });
    if (input.token?.project !== projectId || input.token?.key_revision !== store.revision) return changed();
    if (input.start_over && (!object(input.tools) || Object.getPrototypeOf(input.tools) !== Object.prototype || Reflect.ownKeys(input.tools).length !== 0)) return refused('start over replaces the file with an empty tool list');
    if ((Object.hasOwn(input, 'windows') && (!Array.isArray(input.windows) || !input.windows.every(x => typeof x === 'string'))) || !object(input.keys) || !(input.tools === null || object(input.tools))) return refused('invalid save request');
    for (const [name, value] of Object.entries(input.keys)) { const error = validateName(name); if (error) return refused(error); if (typeof value !== 'string') return refused('invalid key value'); }
    const baseline = input.token.baseline;
    let toolsChanged = input.tools !== null;
    if (toolsChanged && baseline?.source_state === 'ok' && baseline.oid && /^[a-f0-9]+$/.test(baseline.oid)) {
      const blob = await git(input.path, 'cat-file', 'blob', baseline.oid);
      if (blob.ok) { const checked = checkDocumentText(blob.stdout); if (checked.ok && isDeepStrictEqual(input.tools, checked.data.mcpServers) && (!Object.hasOwn(input, 'windows') || isDeepStrictEqual(input.windows, marks(checked.data)))) toolsChanged = false; }
    } else if (toolsChanged && baseline?.source_state === 'missing' && isDeepStrictEqual(input.tools, {}) && (!Object.hasOwn(input, 'windows') || input.windows.length === 0)) toolsChanged = false;
    if (input.start_over && (!toolsChanged || baseline?.source_state !== 'unreadable')) return refused('start over is only allowed for an unreadable file');
    if (!toolsChanged && !Object.keys(input.keys).length) return refused('nothing to save');
    const storeKeys = async () => { if (Object.keys(input.keys).length) store = await writeKeyStore(stateDir, projectId, { set: input.keys }); };
    if (!toolsChanged) { try { await storeKeys(); return { status: 200, body: { outcome: 'saved', key_revision: store.revision, keys: keys(store), key_info: storeInfo(store), warnings: [] } }; } catch (e) { return failed(new Error("the key store on this machine can't be written")); } }
    if (!baseline) return changed();
    if (baseline.source_state === 'unreadable' && !input.start_over) return refused('unreadable source requires Start over');
    const destination = await remote(input.path); if (!destination || destination.repo.toLowerCase() !== String(baseline.repo).toLowerCase()) return changed();
    try {
      return await fetched(input.path, destination, async ({ branch, ref, source }) => {
        if (branch !== baseline.branch || source.state !== baseline.source_state || source.mode !== baseline.mode || source.oid !== baseline.oid) return changed();
        if (input.start_over && source.state !== 'unreadable') return refused('start over is only allowed for an unreadable file');
        const candidate = { ...(source.document || {}), mcpServers: input.tools };
        if (Object.hasOwn(input, 'windows')) {
          const wheelchair = object(candidate.wheelchair) ? { ...candidate.wheelchair } : {};
          if (input.windows.length) wheelchair.windows = input.windows; else delete wheelchair.windows;
          if (Object.keys(wheelchair).length) candidate.wheelchair = wheelchair; else delete candidate.wheelchair;
        }
        const text = `${JSON.stringify(candidate, null, 2)}\n`, checked = checkDocumentText(text);
        if (!checked.ok) return refused(checked.reason);
        const refs = keyReferences(input.tools), old = source.document?.mcpServers || {}, oldRefs = keyReferences(old);
        for (const [name, users] of Object.entries(refs.references)) for (const held of refs.heldBack[name] || []) {
          for (const tool of users) {
            const existed = (oldRefs.references[name] || []).includes(tool) && (oldRefs.heldBack[name] || []).some(item => item.tool === held.tool && item.field === held.field);
            if (!existed && (!isDeepStrictEqual(input.tools[tool], Object.hasOwn(old, tool) ? old[tool] : undefined) || !isDeepStrictEqual(input.tools[held.tool], Object.hasOwn(old, held.tool) ? old[held.tool] : undefined))) return refused(`${name} is also used in ${held.field}`);
          }
        }
        const report = checksFor(input.tools, store), warnings = Object.entries(report.checks).flatMap(([name, check]) => check.skip.map(s => `${name}: ${s}`)).concat(report.file_warnings);
        try { await storeKeys(); } catch (e) { return failed(new Error("the key store on this machine can't be written")); }
        let worktree;
        try {
          await fs.mkdir(path.join(stateDir, 'project-tools'), { recursive: true, mode: 0o700 });
          worktree = path.join(stateDir, 'project-tools', `worktree-${crypto.randomUUID()}`);
          await must(git(input.path, 'worktree', 'add', '--detach', worktree, ref));
          if (source.mode && !['100644', '100755'].includes(source.mode)) { await must(git(worktree, 'rm', '-r', '-f', '--cached', '--', '.mcp.json')); await fs.rm(path.join(worktree, '.mcp.json'), { recursive: true, force: true }); }
          await fs.writeFile(path.join(worktree, '.mcp.json'), text);
          await must(git(worktree, 'add', '-f', '--', '.mcp.json'));
          const authorName = await git(worktree, 'config', 'user.name'), authorEmail = await git(worktree, 'config', 'user.email');
          const config = authorName.ok && authorName.stdout.trim() && authorEmail.ok && authorEmail.stdout.trim() ? [] : ['-c', 'user.name=wheelchair', '-c', 'user.email=wheelchair@localhost'];
          await must(git(worktree, ...config, 'commit', '-m', 'Update project tools'));
          const newBranch = `wc-tools/${id()}`;
          await must(git(worktree, 'push', `--force-with-lease=refs/heads/${newBranch}:`, destination.url, `HEAD:refs/heads/${newBranch}`));
          const pr = await run('gh', ['pr', 'create', '--repo', destination.repo, '--head', newBranch, '--base', branch, '--title', 'Update project tools', '--body', "Saved from the wheelchair app's Project tools screen."]);
          if (!pr.ok) return { status: 200, body: { outcome: 'pr_failed', key_revision: store.revision, keys: keys(store), key_info: storeInfo(store), branch: newBranch, compare_url: `https://github.com/${destination.repo}/compare/${encBranch(branch)}...${encBranch(newBranch)}?expand=1`, error: reason(pr) } };
          return { status: 200, body: { outcome: 'opened', key_revision: store.revision, keys: keys(store), key_info: storeInfo(store), pr_url: pr.stdout.split(/\r?\n/).map(line => line.trim()).filter(line => line.startsWith('https://')).at(-1) || pr.stdout.trim(), warnings } };
        } catch (e) { return failed(e); } finally {
          if (worktree) {
            await git(input.path, 'worktree', 'remove', '--force', worktree);
            await git(input.path, 'worktree', 'prune');
          }
        }
      });
    } catch (e) { return failed(e); }
  }
  async function removeKey(input) {
    let projectId; try { projectId = await project(input.path); } catch (e) { return refused(e.message); }
    let store; try { store = await readKeyStore(stateDir, projectId); } catch (e) { return { status: 502, body: { outcome: 'failed', key_revision: 0, keys: [], error: "the key store on this machine can't be read" } }; }
    if (input.token?.project !== projectId || input.token?.key_revision !== store.revision) return changed();
    const error = typeof input.name === 'string' ? validateName(input.name) : 'invalid key name'; if (error) return refused(error);
    if (!Object.hasOwn(store.keys, input.name)) return refused('key is not stored');
    try { store = await writeKeyStore(stateDir, projectId, { remove: [input.name] }); return { status: 200, body: { outcome: 'removed', key_revision: store.revision, keys: keys(store), key_info: storeInfo(store) } }; }
    catch (e) { return { status: 502, body: { outcome: 'failed', key_revision: store.revision, keys: keys(store), error: "the key store on this machine can't be written" } }; }
  }
  const storeInfo = store => Object.keys(store.keys).sort().map(name => { const why = usableReason(store.keys[name]); return { name, stored: true, folder_usable: !why, reason: why, tools: [] }; });
  return { read, save, removeKey, keyStatus, identity };
}
module.exports = { createProjectTools, repoName, validateName };
