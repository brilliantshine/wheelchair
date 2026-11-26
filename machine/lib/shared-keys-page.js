'use strict';
const { readSharedKeys, writeSharedKeys } = require('./shared-keys');
const { usableReason, object } = require('./project-keys');
const { validateName } = require('./project-tools');
const folderTools = require('./folder-tools');
const sharedTools = require('./shared-tools');
const refused = (reason, status = 400) => ({ status, body: { outcome: 'refused', reason } });
function createSharedKeysPage({ stateDir }) {
  let lastChoice;
  async function entries(store, choice) {
    const declarations = new Map(), notes = [];
    try {
      if (!choice || typeof choice.repo !== 'string' || !Array.isArray(choice.candidates)) throw new Error('no shared tools project is chosen');
      const projectPath = await sharedTools.findSharedProject(choice.repo, choice.candidates);
      if (!projectPath) throw new Error("the shared tools project isn't added on this machine");
      const identity = await sharedTools.identityFor(projectPath);
      let copy = sharedTools.newestCopy(stateDir, identity);
      if (!copy) { const result = await sharedTools.refreshShared({ stateDir, projectPath, deadlineMs: 20000 }); if (!result.copy) throw new Error(result.error || 'no shared copy'); copy = result.copy; }
      const listing = await folderTools.discover({ worktree: copy, shared: null, path: process.env.PATH });
      for (const row of listing.rows) for (const name of row.tool?.keys || []) { if (!declarations.has(name)) declarations.set(name, []); declarations.get(name).push(row.name); }
    } catch (e) { notes.push(`couldn't read the shared tools: ${e.message}`); }
    const keys = [...new Set([...Object.keys(store.keys), ...declarations.keys()])].sort().map(name => {
      const stored = Object.hasOwn(store.keys, name), reason = stored ? usableReason(store.keys[name]) : null;
      return { name, stored, folder_usable: stored ? !reason : null, reason, tools: (declarations.get(name) || []).sort() };
    });
    return { keys, notes };
  }
  async function read(input) {
    lastChoice = input.shared_tools;
    try { const store = await readSharedKeys(stateDir); return { status: 200, body: { revision: store.revision, ...await entries(store, input.shared_tools) } }; }
    catch (e) { return { status: 502, body: { outcome: 'failed', error: e.message } }; }
  }
  async function change(input, remove) {
    let store; try { store = await readSharedKeys(stateDir); } catch (e) { return { status: 502, body: { outcome: 'failed', error: e.message } }; }
    if (input.revision !== store.revision) return refused('changed elsewhere, reload', 409);
    if (remove) {
      const error = typeof input.name === 'string' ? validateName(input.name) : 'invalid key name'; if (error) return refused(error);
      if (!Object.hasOwn(store.keys, input.name)) return refused('key is not stored');
    } else {
      if (!object(input.keys)) return refused('invalid save request');
      for (const [name, value] of Object.entries(input.keys)) { const error = validateName(name); if (error) return refused(error); const why = usableReason(value); if (why) return refused(why); }
    }
    try {
      store = await writeSharedKeys(stateDir, remove ? { remove: [input.name] } : { set: input.keys });
      const { keys } = await entries(store, input.shared_tools === undefined ? lastChoice : input.shared_tools);
      return { status: 200, body: { outcome: remove ? 'removed' : 'saved', revision: store.revision, keys } };
    } catch (e) { return { status: 502, body: { outcome: 'failed', error: e.message } }; }
  }
  return { read, save: input => change(input, false), remove: input => change(input, true) };
}
module.exports = { createSharedKeysPage };
