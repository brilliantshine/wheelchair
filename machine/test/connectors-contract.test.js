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
test('connector files do not require another connector folder', () => {
  for (const m of manifests) for (const file of fs.readdirSync(path.join(__dirname, '../../connectors', m.cli)).filter(f => f.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(__dirname, '../../connectors', m.cli, file), 'utf8');
    for (const match of source.matchAll(/require\s*\(\s*['"]\.\.\/(?!\.\.\/)([^/'"\n]+)\//g)) assert.equal(match[1], m.cli, `${m.cli}/${file}: ${match[0]}`);
  }
});
test('contract rejects missing and inconsistent members and fields', () => {
  const m = structuredClone(manifests[0]); const mod = { ...connectors.machine(m.cli) };
  mod.provider = m.provider; assert.throws(() => contract.validate(m, 'machine', mod), /provider/); delete mod.provider;
  delete mod.command; assert.throws(() => contract.validate(m, 'machine', mod), /command/);
  mod.command = connectors.machine(m.cli).command; delete mod.usageProbe; assert.throws(() => contract.validate(m, 'machine', mod), /usageProbe/);
  mod.usageProbe = () => {}; m.capabilities.usageProbe = false; assert.throws(() => contract.validate(m, 'machine', mod), /usageProbe/);
  const stepsManifest = structuredClone(manifests.find(x => x.capabilities.steps)); const stepsMod = { ...connectors.machine(stepsManifest.cli) }; delete stepsMod.stepsReady; assert.throws(() => contract.validate(stepsManifest, 'machine', stepsMod), /stepsReady/); stepsMod.stepsReady = () => true; stepsManifest.capabilities.steps = false; delete stepsMod.readSteps; assert.throws(() => contract.validate(stepsManifest, 'machine', stepsMod), /stepsReady/);
  const turnMod = { ...connectors.machine(manifests[0].cli) }; delete turnMod.hookEvent; assert.throws(() => contract.validate(manifests[0], 'machine', turnMod), /hookEvent\/turnPoller/); turnMod.hookEvent = () => {}; turnMod.turnPoller = () => {}; assert.throws(() => contract.validate(manifests[0], 'machine', turnMod), /hookEvent\/turnPoller/);
  for (const member of ['asideArgv', 'asideResult', 'asideModel']) { const aside = structuredClone(manifests[0]); const half = { ...connectors.machine(aside.cli) }; delete half[member]; assert.throws(() => contract.validate(aside, 'machine', half), new RegExp(member)); half[member] = member === 'asideModel' ? () => {} : /invalid/; assert.throws(() => contract.validate(aside, 'machine', half), new RegExp(member)); aside.capabilities.aside = false; for (const key of ['asideArgv', 'asideResult', 'asideModel']) delete half[key]; half[member] = member === 'asideModel' ? /x/ : () => {}; assert.throws(() => contract.validate(aside, 'machine', half), new RegExp(member)); }
  const noHook = structuredClone(manifests[0]); delete noHook.hook; assert.throws(() => contract.validate(noHook, 'machine', connectors.machine(noHook.cli)), /hook.payload/); noHook.hook = { payload: 'bad' }; assert.throws(() => contract.validate(noHook, 'machine', connectors.machine(noHook.cli)), /hook.payload/);
  const polled = structuredClone(manifests.find(x => x.cli === 'kimi')); polled.hook = { payload: 'stdin' }; assert.throws(() => contract.validate(polled, 'machine', connectors.machine(polled.cli)), /hook/);
  for (const member of ['bindTranscript', 'spoolWaiting', 'validTranscript']) { const pollManifest = manifests.find(x => x.cli === 'kimi'); const pollHalf = { ...connectors.machine(pollManifest.cli) }; delete pollHalf[member]; assert.throws(() => contract.validate(pollManifest, 'machine', pollHalf), new RegExp(member)); const hookHalf = { ...connectors.machine(manifests[0].cli), [member]: () => {} }; assert.throws(() => contract.validate(manifests[0], 'machine', hookHalf), new RegExp(member)); }
  const missing = structuredClone(manifests[0]); delete missing.models.format; assert.throws(() => contract.validateManifest(missing), /models.format/);
  missing.models.format = 42; assert.throws(() => contract.validateManifest(missing), /models.format/);
  missing.models.format = 'pattern'; missing.settings.modelHeadsUp = 'yes'; assert.throws(() => contract.validateManifest(missing), /settings.modelHeadsUp/);
  const noAsideField = structuredClone(manifests[0]); delete noAsideField.asideParentField; assert.throws(() => contract.validateManifest(noAsideField), /asideParentField/); noAsideField.asideParentField = 1; assert.throws(() => contract.validateManifest(noAsideField), /asideParentField/); noAsideField.capabilities.aside = false; noAsideField.asideParentField = 'id'; assert.throws(() => contract.validateManifest(noAsideField), /asideParentField/);
  const noWeights = structuredClone(manifests[0]); delete noWeights.settings.weights; assert.throws(() => contract.validateManifest(noWeights), /settings.weights/); noWeights.settings.weights = {}; assert.throws(() => contract.validateManifest(noWeights), /settings.weights.unknown/);
  const noPlans = structuredClone(manifests[0]); delete noPlans.settings.plans; assert.throws(() => contract.validateManifest(noPlans), /settings.plans/);
  const noUnknownPlan = structuredClone(manifests[0]); noUnknownPlan.settings.plans = noUnknownPlan.settings.plans.filter(([key]) => key !== 'unknown'); assert.throws(() => contract.validateManifest(noUnknownPlan), /settings.plans/);
  const unmatchedPlan = structuredClone(manifests[0]); unmatchedPlan.settings.plans.push(['missing', 'Missing']); assert.throws(() => contract.validateManifest(unmatchedPlan), /settings.plans/);
  const badOptions = structuredClone(manifests[0]); badOptions.settings.modelOptions = { fixed: [['a']] }; assert.throws(() => contract.validateManifest(badOptions), /settings.modelOptions/);
  const noRank = structuredClone(manifests.find(x => x.capabilities.recover)); delete noRank.recoverRank; assert.throws(() => contract.validateManifest(noRank), /recoverRank/); noRank.recoverRank = '1'; assert.throws(() => contract.validateManifest(noRank), /recoverRank/); noRank.recoverRank = null; assert.throws(() => contract.validateManifest(noRank), /recoverRank/); noRank.capabilities.recover = false; assert.doesNotThrow(() => contract.validateManifest(noRank));
  const noLabel = structuredClone(manifests[0]); delete noLabel.install.label; assert.throws(() => contract.validateManifest(noLabel), /install.label/); noLabel.install.label = 42; assert.throws(() => contract.validateManifest(noLabel), /install.label/);
  const badFamily = structuredClone(manifests[0]); badFamily.models.familyCommand = 'yes'; assert.throws(() => contract.validateManifest(badFamily), /models.familyCommand/);
  const badBare = structuredClone(manifests[0]); badBare.models.bareTierSet = 'yes'; assert.throws(() => contract.validateManifest(badBare), /models.bareTierSet/);
  const badScout = structuredClone(manifests[0]); badScout.settings.scoutAgentTool = 'yes'; assert.throws(() => contract.validateManifest(badScout), /settings.scoutAgentTool/);
  const badWarning = structuredClone(manifests[0]); badWarning.usage = { showWarning: 'yes' }; assert.throws(() => contract.validateManifest(badWarning), /usage.showWarning/);
  for (const field of ['probeWhileLive', 'tryEveryMachine', 'defaultProblem']) { const bad = structuredClone(manifests[0]); bad.usage = { [field]: 'yes' }; assert.throws(() => contract.validateManifest(bad), new RegExp(`usage.${field}`)); }
  const badPage = structuredClone(manifests[0]); badPage.settings.monoModelNames = 'yes'; assert.throws(() => contract.validateManifest(badPage), /settings.monoModelNames/); delete badPage.settings.monoModelNames; badPage.settings.keyPrompt = 1; assert.throws(() => contract.validateManifest(badPage), /settings.keyPrompt/);
  const badFlag = structuredClone(manifests[0]); badFlag.joinPaneLines = 'yes'; assert.throws(() => contract.validateManifest(badFlag), /joinPaneLines/);
  const previewManifest = structuredClone(manifests.find(m => m.stylePreview)); const previewMod = { ...connectors.machine(previewManifest.cli) }; delete previewMod.stylePreviewArgv; assert.throws(() => contract.validate(previewManifest, 'machine', previewMod), /stylePreviewArgv/); previewMod.stylePreviewArgv = () => []; previewManifest.stylePreview = false; assert.throws(() => contract.validate(previewManifest, 'machine', previewMod), /stylePreviewArgv/);
  const badPreview = structuredClone(manifests[0]); badPreview.stylePreview = 'yes'; assert.throws(() => contract.validateManifest(badPreview), /stylePreview/);
  const previews = manifests.map(m => ({ ...m, stylePreview: true })); assert.throws(() => contract.validateRegistry(previews), /stylePreview/);
  const badLogin = structuredClone(manifests[0]); badLogin.login = { killTarget: 'invalid' }; assert.throws(() => contract.validateManifest(badLogin), /login.killTarget/);
  const badLookup = structuredClone(manifests[0]); badLookup.install.lookup = 42; assert.throws(() => contract.validateManifest(badLookup), /install.lookup/);
  badLookup.install.lookup = 'unknown'; assert.throws(() => contract.validateManifest(badLookup), /install.lookup/);
  const fallback = structuredClone(manifests[0]); fallback.install.lookup = 'fallback'; delete fallback.install.fallbackPath; assert.throws(() => contract.validateManifest(fallback), /install.fallbackPath/); fallback.install.fallbackPath = ''; assert.throws(() => contract.validateManifest(fallback), /install.fallbackPath/); fallback.install.fallbackPath = '~/bin/tool'; assert.doesNotThrow(() => contract.validateManifest(fallback));
  const duplicated = manifests.map(m => structuredClone(m)); duplicated[0].capabilities.preflight = true; assert.throws(() => contract.validateRegistry(duplicated), /preflight/);
  duplicated[0].capabilities.preflight = false; duplicated[0].capabilities.spend = true; assert.throws(() => contract.validateRegistry(duplicated), /capabilities.spend/); duplicated[0].capabilities.spend = false;
  duplicated[0].capabilities.preflight = false; duplicated[2].install.sensitivity = true; assert.throws(() => contract.validateRegistry(duplicated), /sensitivity/);
});
test('provider snapshot remains unchanged', () => {
  const snapshot = Object.freeze({"PROVIDERS":{"claude":{"cli":"claude","label":"Claude","effort":true,"preflight":false,"typesRoleMessage":false,"asideFork":true,"singleAccount":false},"gpt":{"cli":"codex","label":"GPT","effort":true,"preflight":true,"typesRoleMessage":true,"asideFork":true,"singleAccount":false},"gemini":{"cli":"agy","label":"Antigravity","effort":true,"preflight":false,"typesRoleMessage":true,"asideFork":false,"singleAccount":true},"kimi":{"cli":"kimi","label":"Kimi Code","effort":false,"preflight":false,"typesRoleMessage":true,"asideFork":false,"singleAccount":false},"openrouter":{"cli":"pi","label":"OpenRouter","effort":true,"preflight":false,"typesRoleMessage":false,"asideFork":true,"singleAccount":false}},"DISPLAY_NAMES":{"claude":"Claude Code","gpt":"Codex","gemini":"Antigravity","kimi":"Kimi Code","openrouter":"Pi (OpenRouter)"}});
  const actual = require('../../viewer/app/providers'); assert.deepEqual({ PROVIDERS: actual.PROVIDERS, DISPLAY_NAMES: actual.DISPLAY_NAMES }, snapshot);
});
