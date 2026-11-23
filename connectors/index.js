'use strict';
const contract = require('./contract');
const names = ['claude', 'codex', 'agy', 'kimi', 'pi'];
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const manifests = names.map(name => freeze(require(`./${name}/manifest`)));
const cache = { machine: new Map(), hub: new Map() };
function list() { return manifests.slice(); }
function manifest(cli) { return manifests.find(m => m.cli === cli); }
function byProvider(id) { return manifests.find(m => m.provider === id); }
function half(cli, name) { const m = manifest(cli); if (!m) throw new Error(`unknown connector: ${cli}`); if (!cache[name].has(cli)) { const mod = require(`./${cli}/${name}.js`); contract.validate(m, name, mod); cache[name].set(cli, mod); } return cache[name].get(cli); }
module.exports = { list, manifest, byProvider, machine: cli => half(cli, 'machine'), hub: cli => half(cli, 'hub') };
