'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const connectors = require('../../connectors');
const contract = require('../../connectors/contract');
const manifests = connectors.list();
test('registry, manifests and connector halves satisfy the contract', () => {
  const folders = fs.readdirSync(path.join(__dirname, '../../connectors'), { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(path.join(__dirname, '../../connectors', e.name, 'manifest.js'))).map(e => e.name).sort();
  assert.deepEqual(folders, manifests.map(m => m.cli).sort());
  for (const field of ['cli', 'provider']) assert.equal(new Set(manifests.map(m => m[field])).size, manifests.length);
  contract.validateRegistry(manifests);
  for (const m of manifests) { assert.deepEqual(JSON.parse(JSON.stringify(m)), m); assert.ok(Object.isFrozen(m)); for (const half of ['machine', 'hub']) contract.validate(m, half, connectors[half](m.cli)); }
  const result = spawnSync(process.execPath, ['connectors/export.js', '--check'], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr);
});
test('contract rejects missing and inconsistent members and fields', () => {
  const m = structuredClone(manifests[0]); const mod = { ...connectors.machine(m.cli) };
  delete mod.command; assert.throws(() => contract.validate(m, 'machine', mod), /command/);
  mod.command = connectors.machine(m.cli).command; delete mod.usageProbe; assert.throws(() => contract.validate(m, 'machine', mod), /usageProbe/);
  mod.usageProbe = () => {}; m.capabilities.usageProbe = false; assert.throws(() => contract.validate(m, 'machine', mod), /usageProbe/);
  const turnMod = { ...connectors.machine(manifests[0].cli) }; delete turnMod.hookEvent; assert.throws(() => contract.validate(manifests[0], 'machine', turnMod), /hookEvent\/turnPoller/); turnMod.hookEvent = () => {}; turnMod.turnPoller = () => {}; assert.throws(() => contract.validate(manifests[0], 'machine', turnMod), /hookEvent\/turnPoller/);
  const missing = structuredClone(manifests[0]); delete missing.models.format; assert.throws(() => contract.validateManifest(missing), /models.format/);
  missing.models.format = 42; assert.throws(() => contract.validateManifest(missing), /models.format/);
  missing.models.format = 'pattern'; missing.settings.modelHeadsUp = 'yes'; assert.throws(() => contract.validateManifest(missing), /settings.modelHeadsUp/);
  const badFamily = structuredClone(manifests[0]); badFamily.models.familyCommand = 'yes'; assert.throws(() => contract.validateManifest(badFamily), /models.familyCommand/);
  const badBare = structuredClone(manifests[0]); badBare.models.bareTierSet = 'yes'; assert.throws(() => contract.validateManifest(badBare), /models.bareTierSet/);
  const badScout = structuredClone(manifests[0]); badScout.settings.scoutAgentTool = 'yes'; assert.throws(() => contract.validateManifest(badScout), /settings.scoutAgentTool/);
  const badWarning = structuredClone(manifests[0]); badWarning.usage = { showWarning: 'yes' }; assert.throws(() => contract.validateManifest(badWarning), /usage.showWarning/);
  for (const field of ['probeWhileLive', 'tryEveryMachine', 'defaultProblem']) { const bad = structuredClone(manifests[0]); bad.usage = { [field]: 'yes' }; assert.throws(() => contract.validateManifest(bad), new RegExp(`usage.${field}`)); }
  const badPage = structuredClone(manifests[0]); badPage.settings.monoModelNames = 'yes'; assert.throws(() => contract.validateManifest(badPage), /settings.monoModelNames/); delete badPage.settings.monoModelNames; badPage.settings.keyPrompt = 1; assert.throws(() => contract.validateManifest(badPage), /settings.keyPrompt/);
  const badFlag = structuredClone(manifests[0]); badFlag.joinPaneLines = 'yes'; assert.throws(() => contract.validateManifest(badFlag), /joinPaneLines/);
  const badPreview = structuredClone(manifests[0]); badPreview.stylePreview = 'yes'; assert.throws(() => contract.validateManifest(badPreview), /stylePreview/);
  const previews = manifests.map(m => ({ ...m, stylePreview: true })); assert.throws(() => contract.validateRegistry(previews), /stylePreview/);
  const badLogin = structuredClone(manifests[0]); badLogin.login = { killTarget: 'invalid' }; assert.throws(() => contract.validateManifest(badLogin), /login.killTarget/);
  const badLookup = structuredClone(manifests[0]); badLookup.install.lookup = 42; assert.throws(() => contract.validateManifest(badLookup), /install.lookup/);
  badLookup.install.lookup = 'unknown'; assert.throws(() => contract.validateManifest(badLookup), /install.lookup/);
  const duplicated = manifests.map(m => structuredClone(m)); duplicated[0].capabilities.preflight = true; assert.throws(() => contract.validateRegistry(duplicated), /preflight/);
  duplicated[0].capabilities.preflight = false; duplicated[2].install.sensitivity = true; assert.throws(() => contract.validateRegistry(duplicated), /sensitivity/);
});
test('provider snapshot remains unchanged', () => {
  const snapshot = Object.freeze({"PROVIDERS":{"claude":{"cli":"claude","label":"Claude","effort":true,"preflight":false,"typesRoleMessage":false,"asideFork":true,"singleAccount":false},"gpt":{"cli":"codex","label":"GPT","effort":true,"preflight":true,"typesRoleMessage":true,"asideFork":true,"singleAccount":false},"gemini":{"cli":"agy","label":"Antigravity","effort":true,"preflight":false,"typesRoleMessage":true,"asideFork":false,"singleAccount":true},"kimi":{"cli":"kimi","label":"Kimi Code","effort":false,"preflight":false,"typesRoleMessage":true,"asideFork":false,"singleAccount":false},"openrouter":{"cli":"pi","label":"OpenRouter","effort":true,"preflight":false,"typesRoleMessage":false,"asideFork":true,"singleAccount":false}},"DISPLAY_NAMES":{"claude":"Claude Code","gpt":"Codex","gemini":"Antigravity","kimi":"Kimi Code","openrouter":"Pi (OpenRouter)"}});
  const actual = require('../../viewer/app/providers'); assert.deepEqual({ PROVIDERS: actual.PROVIDERS, DISPLAY_NAMES: actual.DISPLAY_NAMES }, snapshot);
});
