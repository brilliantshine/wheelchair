'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { object, storeError } = require('./project-keys');
function sharedKeysPath(stateDir) { return path.join(stateDir, 'shared-keys', 'keys.json'); }
async function readSharedKeys(stateDir) {
  try {
    const store = JSON.parse(await fs.readFile(sharedKeysPath(stateDir), 'utf8'));
    if (store.shared !== true || !Number.isSafeInteger(store.revision) || store.revision < 0 || !object(store.keys) || !Object.values(store.keys).every(v => typeof v === 'string')) throw new Error('invalid store');
    return { revision: store.revision, keys: Object.assign(Object.create(null), store.keys) };
  } catch (error) {
    if (error.code === 'ENOENT') return { revision: 0, keys: Object.create(null) };
    throw storeError("the shared key store on this machine can't be read", error);
  }
}
async function writeSharedKeys(stateDir, changes) {
  try {
    const old = await readSharedKeys(stateDir), keys = Object.assign(Object.create(null), old.keys, changes.set);
    for (const name of changes.remove || []) delete keys[name];
    const store = { shared: true, revision: old.revision + 1, keys }, file = sharedKeysPath(stateDir);
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${crypto.randomUUID()}.tmp`;
    try { await fs.writeFile(temp, `${JSON.stringify(store)}\n`, { mode: 0o600, flag: 'wx' }); await fs.rename(temp, file); }
    finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    return { revision: store.revision, keys };
  } catch (error) { throw storeError("the shared key store on this machine can't be written", error); }
}
module.exports = { sharedKeysPath, readSharedKeys, writeSharedKeys };
